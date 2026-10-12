import { NextResponse } from "next/server";
import { featureSperre } from "@/lib/planGate";
import { darfWeiter } from "@/lib/net/bremse";
import { getAuthedUser, MB, kiBereit, KI_NICHT_BEREIT } from "@/lib/aiRoute";
import { extrahiereImmodaten, AiImportFehler } from "@/lib/aiImport";
import { sicheresFetch, pruefeZielUrl, ZielNichtErlaubtFehler, type Antwort } from "@/lib/net/ssrf";
import { jsonBegrenzt, ZuGrossFehler } from "@/lib/net/grenzen";

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

// Realistischer UA — viele Makler-Seiten blocken Default-Fetch-UAs.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Lädt eine URL mit SSRF-Prüfung vor JEDEM Sprung (siehe lib/net/ssrf.ts): Weiterleitungen einzeln
 * geprüft, Verbindung nur zur geprüften Adresse (B17), Body mit Grenze innerhalb des Zeitgebers (B16).
 * HTML wird nach `MAX_HTML_BYTES` abgeschnitten (der Anfang genügt), ein zu großes PDF abgelehnt.
 */
async function holeMitTimeout(url: string, accept: string, art: "pdf-oder-html" | "text"): Promise<Antwort> {
  return sicheresFetch(new URL(url), {
    accept,
    timeoutMs: FETCH_TIMEOUT,
    userAgent: UA,
    maxBytes: art === "text" ? MAX_HTML_BYTES : MAX_PDF_BYTES,
    abschneiden: art === "text",
  });
}

// Mengenbremse je Nutzer: Der Link-Import lädt fremde Server und ruft danach
// die KI — beides kostet Zeit und Geld. Ohne Bremse kann ein einzelnes Konto
// die Route als Anfrage-Schleuder benutzen.
const LIMIT_PRO_STUNDE = 30;
const zugriffe = new Map<string, number[]>();

function limitUeberschritten(userId: string): boolean {
  const jetzt = Date.now();
  const grenze = jetzt - 60 * 60 * 1000;
  const bisher = (zugriffe.get(userId) ?? []).filter((t) => t > grenze);
  if (bisher.length >= LIMIT_PRO_STUNDE) {
    zugriffe.set(userId, bisher);
    return true;
  }
  bisher.push(jetzt);
  zugriffe.set(userId, bisher);
  // Aufräumen, damit die Map nicht unbegrenzt wächst.
  if (zugriffe.size > 500) {
    for (const [k, v] of zugriffe) if (v.every((t) => t <= grenze)) zugriffe.delete(k);
  }
  return false;
}

export async function POST(req: Request) {
  const { user, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  // Tarif-Schranke. Im Early Access (ohne BILLING_ENFORCED) kehrt
  // featureSperre() sofort mit null zurueck — ohne Datenbankabfrage.
  const sperre = await featureSperre(supabase, "ki_import");
  if (sperre) return NextResponse.json({ error: sperre }, { status: 402 });
  // Mengenbremse je Konto wie in nk-ocr — jeder Aufruf kostet Geld beim
  // KI-Anbieter. Datenbankgestützt, überlebt Serverless-Instanzen.
  if (!(await darfWeiter("ki_import", 20, 3600, user.id, { sperrtBeiAusfall: true }))) {
    return NextResponse.json(
      { error: "Zu viele Importe in kurzer Zeit. Bitte in einer Stunde erneut versuchen." },
      { status: 429 },
    );
  }

  if (!kiBereit()) return NextResponse.json({ error: KI_NICHT_BEREIT }, { status: 503 });
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ""; // bei Bedrock nicht benutzt

  let urlRoh = "";
  try {
    const body = (await jsonBegrenzt(req, 16 * 1024)) as Record<string, unknown> | null; // ein Link, mehr nicht
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
  if (limitUeberschritten(user.id)) {
    return NextResponse.json(
      { error: "Zu viele Link-Importe in kurzer Zeit. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  // SSRF: Adresse auflösen und gegen private/lokale Netze prüfen. Reine
  // Hostnamen-Regexe waren umgehbar (IPv6-Loopback, dezimal kodierte IPs,
  // DNS-Namen auf interne Adressen) — siehe lib/net/ssrf.ts.
  try {
    await pruefeZielUrl(url);
  } catch (e) {
    if (e instanceof ZielNichtErlaubtFehler)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  try {
    // ---- Seite/PDF laden --------------------------------------------------
    let seite: Antwort;
    try {
      seite = await holeMitTimeout(url.href, "text/html,application/pdf,*/*", "pdf-oder-html");
    } catch (e) {
      if (e instanceof ZuGrossFehler) return NextResponse.json({ error: "PDF zu groß (max. 20 MB)." }, { status: 422 });
      return NextResponse.json({ error: FEHLER_MELDUNG }, { status: 422 });
    }

    const contentType = (seite.headers.get("content-type") ?? "").toLowerCase();
    const istPdf =
      contentType.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf");

    // ---- PDF: direkt als Dokument an die KI --------------------------------
    if (istPdf && seite.ok) {
      if (seite.bytes.byteLength === 0) return NextResponse.json({ error: FEHLER_MELDUNG }, { status: 422 });
      const parsed = await extrahiereImmodaten(apiKey, {
        pdfBase64: Buffer.from(seite.bytes).toString("base64"),
      });
      return NextResponse.json({ data: parsed });
    }

    // ---- HTML: strippen, ggf. Reader-Fallback ------------------------------
    let text = "";
    if (seite.ok) {
      // Ein PDF-Link, der als HTML-Seite gemeint war, kam bis 20 MB herein — für Text nur der Anfang.
      const html = new TextDecoder().decode(seite.bytes.subarray(0, MAX_HTML_BYTES));
      text = htmlZuText(html);
    }

    if (text.length < MIN_TEXT || sieht_nach_botwall_aus(text)) {
      // Reader-Dienst rendert JS-lastige Seiten zu Klartext (kein API-Key).
      try {
        const reader = await holeMitTimeout(`https://r.jina.ai/${url.href}`, "text/plain", "text");
        if (reader.ok) {
          const readerText = new TextDecoder().decode(reader.bytes).trim();
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
