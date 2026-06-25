import { NextResponse } from "next/server";
import { getAuthedUser, callAnthropic, base64Bytes, MB } from "@/lib/aiRoute";

export const runtime = "nodejs";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// Erlaubte Bild-Typen (PDF wird separat über isPdf behandelt).
const ALLOWED_IMAGE = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5 * MB; // Anthropic-Bildlimit
const MAX_PDF_BYTES = 20 * MB;

const PROMPT = `Du bist ein Assistent für Nebenkostenabrechnungen. Analysiere dieses Dokument der Hausverwaltung und extrahiere alle Kostenpositionen mit ihren Beträgen.

Antworte NUR mit einem JSON-Array, kein Text davor oder danach:
[
  {"name": "Positionsname", "betrag": 123.45}
]

Wichtig:
- Nur umlagefähige Betriebskosten gemäß § 2 BetrKV
- Beträge als Zahlen (keine Währungszeichen)
- Falls Gesamtkosten für das Gebäude angegeben: den Anteil für die Wohnung nutzen (wenn angegeben) oder Gesamtbetrag
- Keine Instandhaltung, Reparaturen oder Verwaltungskosten`;

type Position = { name: string; betrag: number };

/** KI-Antwort robust zu sauberen Positionen validieren (gegen Halluzinationen). */
function parsePositionen(text: string): Position[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const clean: Position[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as Record<string, unknown>).name ?? "").trim();
    const betrag = Number((item as Record<string, unknown>).betrag);
    if (!name || !Number.isFinite(betrag) || betrag <= 0) continue;
    clean.push({ name: name.slice(0, 120), betrag: Math.round(betrag * 100) / 100 });
  }
  return clean;
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Kein ANTHROPIC_API_KEY hinterlegt. Bitte in Vercel setzen." }, { status: 503 });
  }

  let data = "", mediaType = "", isPdf = false;
  try {
    const body = await req.json();
    data = String(body?.data ?? "");
    mediaType = String(body?.mediaType ?? "");
    isPdf = !!body?.isPdf;
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Keine Datei übergeben." }, { status: 400 });

  // MIME-Typ prüfen
  if (!isPdf && !ALLOWED_IMAGE.includes(mediaType)) {
    return NextResponse.json({ error: "Nicht unterstützter Dateityp. Erlaubt: PDF, PNG, JPG, GIF, WebP." }, { status: 415 });
  }

  // Größe prüfen (vor dem teuren KI-Call)
  const bytes = base64Bytes(data);
  const limit = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (bytes > limit) {
    return NextResponse.json(
      { error: `Datei zu groß (${(bytes / MB).toFixed(1)} MB). Maximal ${(limit / MB).toFixed(0)} MB.` },
      { status: 413 }
    );
  }

  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  try {
    const resp = await callAnthropic(apiKey, {
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
    });
    if (!resp.ok) {
      console.error("nk-ocr: Anthropic-Fehler", resp.status, await resp.text().catch(() => ""));
      return NextResponse.json({ error: `KI-Dienst antwortete mit ${resp.status}.` }, { status: 502 });
    }
    const result = await resp.json();
    const text: string = (result?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    const positionen = parsePositionen(text);
    if (positionen === null) return NextResponse.json({ error: "Antwort der KI war nicht lesbar." }, { status: 422 });
    if (positionen.length === 0) return NextResponse.json({ error: "Keine Kostenpositionen erkannt." }, { status: 422 });
    return NextResponse.json({ positionen });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "Zeitüberschreitung beim KI-Dienst. Bitte erneut versuchen." }, { status: 504 });
    }
    console.error("nk-ocr: unerwarteter Fehler", err);
    return NextResponse.json({ error: "Fehler beim Auslesen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
