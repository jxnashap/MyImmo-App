import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

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

export async function POST(req: Request) {
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

  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json({ error: `KI-Dienst antwortete mit ${resp.status}.`, detail }, { status: 502 });
    }
    const result = await resp.json();
    const text: string = (result?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "Keine Kostenpositionen erkannt." }, { status: 422 });
    const positionen = JSON.parse(match[0]);
    return NextResponse.json({ positionen });
  } catch (err) {
    return NextResponse.json({ error: `Fehler beim Auslesen: ${(err as Error).message}` }, { status: 500 });
  }
}
