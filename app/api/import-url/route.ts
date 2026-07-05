import { NextResponse } from "next/server";
import { getAuthedUser, MB } from "@/lib/aiRoute";
import { extrahiereImmodaten, AiImportFehler } from "@/lib/aiImport";

export const runtime = "nodejs";
export const maxDuration = 60;

// Link-Import: Exposé-/Inserats-URL server-seitig laden (HTML → Text,
// PDF → direkt an die KI) und mit derselben Extraktion wie /api/import
// auswerten. Response-Shape identisch: { data: {...} }.

const FETCH_TIMEOUT = 20_000;
const MAX_PDF_BYTES = 20 * MB;
const MAX_HTML_BYTES = 4 * MB;
const MIN_TEXT = 400; // darunter: vermutlich JS-Rendering nötig → Reader-Fallback

const FEHLER_MELDUNG =
  "Diese Seite ließ sich nicht automatisch laden. Bitte den Exposé-Text einfügen.";

const BOT_MARKER = [
  "zugriff verweigert",
  "access denied",
  "aktiviere javascript",
  "aktivieren sie javascript",
  "enable javascript",
  "are you a robot",
  "ich bin kein roboter",
  "captcha",
  "checking your browser",
  "datadome",
  "request blocked",
  "bot detection",
];

function sieht_nach_botwall_aus(text: string): boolean {
  const t = text.slice(0, 3000).toLowerCase();
  return BOT_MARKER.some((m) => t.includes(m));
}

/** HTML grob zu Klartext strippen (Skripte/Styles raus, Tags raus, Entities). */
function htmlZuText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&euro;/g, "€")
    .replace(/&(uuml|Uuml);/g, (m) => (m[1] === "U" ? "Ü" : "ü"))
    .replace(/&(auml|Auml);/g, (m) => (m[1] === "A" ? "Ä" : "ä"))
    .replace(/&(ouml|Ouml);/g, (m) => (m[1] === "O" ? "Ö" : "ö"))
    .replace(/&szlig;/g, "ß")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function holeMitTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, {
      redirect: "follow",
      headers: {
        // Realistischer UA — viele Makler-Seiten blocken Default-Fetch-UAs.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: accept,
        "Accept-Language": "de-DE,de;q=0.9",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Kein ANTHROPIC_API_KEY hinterlegt. Bitte in Vercel unter Settings → Environment Variables setzen." },
      { status: 503 }
    );
  }

  let urlRoh = "";
  try {
    const body = await req.json();
    urlRoh = String(body?.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(urlRoh);
  } catch {
    return NextResponse.json({ error: "Bitte einen gültigen Link einfügen." }, { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return NextResponse.json({ error: "Nur http/https-Links werden unterstützt." }, { status: 400 });
  // Kein SSRF auf interne Dienste (grobe Absicherung).
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    return NextResponse.json({ error: "Dieser Link wird nicht unterstützt." }, { status: 400 });

  try {
    // ---- Seite/PDF laden --------------------------------------------------
    let seite: Response;
    try {
      seite = await holeMitTimeout(url.href, "text/html,application/pdf,*/*");
    } catch {
      return NextResponse.json({ error: FEHLER_MELDUNG }, { status: 422 });
    }

    const contentType = (seite.headers.get("content-type") ?? "").toLowerCase();
    const istPdf =
      contentType.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf");

    // ---- PDF: direkt als Dokument an die KI --------------------------------
    if (istPdf && seite.ok) {
      const buf = await seite.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_PDF_BYTES)
        return NextResponse.json(
          { error: buf.byteLength ? "PDF zu groß (max. 20 MB)." : FEHLER_MELDUNG },
          { status: 422 }
        );
      const parsed = await extrahiereImmodaten(apiKey, {
        pdfBase64: Buffer.from(buf).toString("base64"),
      });
      return NextResponse.json({ data: parsed });
    }

    // ---- HTML: strippen, ggf. Reader-Fallback ------------------------------
    let text = "";
    if (seite.ok) {
      const html = (await seite.text()).slice(0, MAX_HTML_BYTES);
      text = htmlZuText(html);
    }

    if (text.length < MIN_TEXT || sieht_nach_botwall_aus(text)) {
      // Reader-Dienst rendert JS-lastige Seiten zu Klartext (kein API-Key).
      try {
        const reader = await holeMitTimeout(`https://r.jina.ai/${url.href}`, "text/plain");
        if (reader.ok) {
          const readerText = (await reader.text()).slice(0, MAX_HTML_BYTES).trim();
          if (readerText.length >= MIN_TEXT && !sieht_nach_botwall_aus(readerText))
            text = readerText;
        }
      } catch {
        // Fallback fehlgeschlagen — unten sauber melden.
      }
    }

    if (text.length < MIN_TEXT || sieht_nach_botwall_aus(text))
      return NextResponse.json({ error: FEHLER_MELDUNG }, { status: 422 });

    const parsed = await extrahiereImmodaten(apiKey, { text });
    return NextResponse.json({ data: parsed });
  } catch (err) {
    if (err instanceof AiImportFehler)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("import-url: unerwarteter Fehler", err);
    return NextResponse.json({ error: FEHLER_MELDUNG }, { status: 422 });
  }
}
