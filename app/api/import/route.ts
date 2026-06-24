import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

const PROMPT = (text: string) => `Du bist ein Immobilien-Datenextraktor. Analysiere den folgenden Anzeigentext und extrahiere alle relevanten Immobiliendaten.

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

Wenn ein Wert nicht gefunden wird, setze null.

Anzeigentext:
${text.substring(0, 4000)}`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Kein ANTHROPIC_API_KEY hinterlegt. Bitte in Vercel unter Settings → Environment Variables setzen." },
      { status: 503 }
    );
  }

  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (text.length < 30) {
    return NextResponse.json({ error: "Bitte zuerst einen Anzeigentext einfügen." }, { status: 400 });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: PROMPT(text) }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json({ error: `KI-Dienst antwortete mit ${resp.status}.`, detail }, { status: 502 });
    }

    const data = await resp.json();
    const raw: string = data?.content?.[0]?.text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ data: parsed });
  } catch (err) {
    return NextResponse.json({ error: `Fehler beim Analysieren: ${(err as Error).message}` }, { status: 500 });
  }
}
