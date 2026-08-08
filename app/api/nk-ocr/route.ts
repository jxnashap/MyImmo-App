import { NextResponse } from "next/server";
import { getAuthedUser, callAnthropic, base64Bytes, MB } from "@/lib/aiRoute";

export const runtime = "nodejs";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// Erlaubte Bild-Typen (PDF wird separat über isPdf behandelt).
const ALLOWED_IMAGE = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5 * MB; // Anthropic-Bildlimit
const MAX_PDF_BYTES = 20 * MB;

// Gesamtkosten und Wohnungsanteil werden bewusst GETRENNT abgefragt. Die alte
// Fassung bat um „den Anteil oder den Gesamtbetrag" in EINEM Feld — damit
// konnte der Gebäude-Gesamtbetrag unbemerkt als Mieteranteil in der
// Abrechnung landen. Jetzt entscheidet die Übernahme-Logik anhand beider
// Werte, und die Abrechnung weist Gesamtkosten + Rechenweg aus (BGH-Pflicht).
const PROMPT = `Du bist ein Assistent für Nebenkostenabrechnungen. Analysiere dieses Dokument der Hausverwaltung und extrahiere die Kostenpositionen.

Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach:
{
  "jahr": 2025,
  "flaeche_gesamt": 400.0,
  "positionen": [
    {"name": "Positionsname", "gesamt": 6400.00, "anteil": 1280.00}
  ]
}

Bedeutung der Felder:
- "jahr": das Abrechnungsjahr laut Dokument (null, wenn nicht erkennbar)
- "flaeche_gesamt": Gesamtwohnfläche des Gebäudes in m² (null, wenn nicht angegeben)
- je Position: "gesamt" = Gesamtkosten des Gebäudes für diese Kostenart,
  "anteil" = der in der Abrechnung ausgewiesene Anteil der Wohnung.
  Fehlt einer der beiden Werte im Dokument, setze ihn auf null — NIE raten
  und NIE den einen Wert in das andere Feld schreiben.

Wichtig:
- Nur umlagefähige Betriebskosten gemäß § 2 BetrKV
- Beträge als Zahlen (keine Währungszeichen, Tausenderpunkte entfernen)
- Keine Instandhaltung, Reparaturen oder Verwaltungskosten`;

type Position = { name: string; gesamt: number | null; anteil: number | null };
type OcrErgebnis = { jahr: number | null; flaecheGesamt: number | null; positionen: Position[] };

const zahlOderNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/** KI-Antwort robust validieren (gegen Halluzinationen). Versteht auch das
 *  alte Array-Format {name, betrag}, falls das Modell darauf zurückfällt. */
function parseErgebnis(text: string): OcrErgebnis | null {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const liste = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.positionen)
      ? ((raw as Record<string, unknown>).positionen as unknown[])
      : null;
  if (!liste) return null;

  const positionen: Position[] = [];
  for (const item of liste) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    const gesamt = zahlOderNull(r.gesamt);
    // Altformat: "betrag" ohne Zuordnung → als Anteil behandeln (konservativ:
    // lieber ein zu kleiner Vorschlag als Gebäudekosten beim Mieter).
    const anteil = zahlOderNull(r.anteil) ?? (gesamt == null ? zahlOderNull(r.betrag) : null);
    if (!name || (gesamt == null && anteil == null)) continue;
    positionen.push({ name: name.slice(0, 120), gesamt, anteil });
  }

  const kopf = Array.isArray(raw) ? {} : (raw as Record<string, unknown>);
  const jahrRoh = Number(kopf.jahr);
  return {
    jahr: Number.isInteger(jahrRoh) && jahrRoh >= 2000 && jahrRoh <= 2100 ? jahrRoh : null,
    flaecheGesamt: zahlOderNull(kopf.flaeche_gesamt),
    positionen,
  };
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
    const ergebnis = parseErgebnis(text);
    if (ergebnis === null) return NextResponse.json({ error: "Antwort der KI war nicht lesbar." }, { status: 422 });
    if (ergebnis.positionen.length === 0) return NextResponse.json({ error: "Keine Kostenpositionen erkannt." }, { status: 422 });
    return NextResponse.json(ergebnis);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "Zeitüberschreitung beim KI-Dienst. Bitte erneut versuchen." }, { status: 504 });
    }
    console.error("nk-ocr: unerwarteter Fehler", err);
    return NextResponse.json({ error: "Fehler beim Auslesen. Bitte später erneut versuchen." }, { status: 500 });
  }
}
