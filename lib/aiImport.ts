// KI-Extraktion von Immobiliendaten aus Exposé-Text ODER -PDF — gemeinsamer
// Helfer für /api/import (Text einfügen) und /api/import-url (Link laden).
// Kapselt Prompt, Anthropic-Call und JSON-Parsing; wirft AiImportFehler mit
// HTTP-Status + nutzerfreundlicher Meldung.

import { callAnthropic } from "@/lib/aiRoute";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

export class AiImportFehler extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ImmoDaten = {
  name?: string | null;
  typ?: string | null;
  adresse?: string | null;
  kaufpreis?: number | null;
  wert?: number | null;
  flaeche?: number | null;
  zimmer?: number | null;
  baujahr?: number | null;
  miete?: number | null;
  energieklasse?: string | null;
  status?: string | null;
  notiz?: string | null;
  konfidenz?: number | null;
};

const PROMPT_KOPF = `Du bist ein Immobilien-Datenextraktor. Analysiere den folgenden Anzeigentext und extrahiere alle relevanten Immobiliendaten.

Antworte NUR mit einem JSON-Objekt, ohne Markdown-Backticks, ohne Erklärungen. Nur reines JSON.

Felder:
- name: Kurze Bezeichnung (z.B. "3-Zi-Wohnung Hamburg-Altona")
- typ: Einer von: "Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Grundstück"
- adresse: Vollständige Adresse wenn vorhanden
- kaufpreis: Zahl (nur Zahl, kein €-Zeichen)
- wert: Gleich wie kaufpreis wenn kein anderer Wert angegeben
- flaeche: Wohnfläche in m² als Zahl
- zimmer: Anzahl Zimmer als Zahl
- baujahr: Baujahr als Zahl
- miete: Monatliche Kaltmiete als Zahl (0 wenn keine angegeben)
- energieklasse: Energieeffizienzklasse (A+, A, B, C, D, E, F, G, H) oder leer
- status: "Leer", "Vermietet", "Selbst bewohnt" oder "Feriennutzung"
- notiz: Kurze Zusammenfassung besonderer Merkmale (max 100 Zeichen)
- konfidenz: Zahl 0-100 wie sicher du bist (100 = alle Daten klar)

Wenn ein Wert nicht gefunden wird, setze null.`;

/**
 * Extraktion aus Text oder PDF (base64). Gibt das geparste Objekt zurück
 * oder wirft AiImportFehler (Status ist als HTTP-Status verwendbar).
 */
export async function extrahiereImmodaten(
  apiKey: string,
  input: { text: string } | { pdfBase64: string },
): Promise<ImmoDaten> {
  const content =
    "text" in input
      ? `${PROMPT_KOPF}\n\nAnzeigentext:\n${input.text.substring(0, 15000)}`
      : [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
          },
          { type: "text", text: PROMPT_KOPF },
        ];

  let resp: Response;
  try {
    resp = await callAnthropic(apiKey, {
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    if ((err as Error).name === "AbortError")
      throw new AiImportFehler(504, "Zeitüberschreitung beim KI-Dienst. Bitte erneut versuchen.");
    throw new AiImportFehler(500, "Fehler beim Analysieren. Bitte später erneut versuchen.");
  }

  if (!resp.ok) {
    console.error("aiImport: Anthropic-Fehler", resp.status, await resp.text().catch(() => ""));
    throw new AiImportFehler(502, `KI-Dienst antwortete mit ${resp.status}.`);
  }

  const data = await resp.json();
  const raw: string = data?.content?.[0]?.text ?? "";
  const clean = raw.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new AiImportFehler(422, "Antwort der KI war nicht lesbar.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new AiImportFehler(422, "Antwort der KI hatte ein unerwartetes Format.");

  return parsed as ImmoDaten;
}
