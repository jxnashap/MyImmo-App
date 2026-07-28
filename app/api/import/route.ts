import { NextResponse } from "next/server";
import { getAuthedUser, MB } from "@/lib/aiRoute";
import { extrahiereImmodaten, AiImportFehler } from "@/lib/aiImport";

export const runtime = "nodejs";

// Exposé-Import: Anzeigentext ODER hochgeladenes Exposé-PDF → Immobiliendaten
// (KI-Extraktion). Response-Shape: { data: {...} } — identisch zu /api/import-url.
export const maxDuration = 60;

const MAX_PDF_BYTES = 20 * MB;
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

  let text = "";
  let pdfBase64 = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
    pdfBase64 = String(body?.pdfBase64 ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (pdfBase64) {
    // base64 ist ~4/3 der Rohgröße — grob gegen die Obergrenze prüfen.
    if ((pdfBase64.length * 3) / 4 > MAX_PDF_BYTES)
      return NextResponse.json({ error: "PDF zu groß (max. 20 MB)." }, { status: 413 });
  } else if (text.length < 30) {
    return NextResponse.json({ error: "Bitte ein Exposé-PDF wählen oder Anzeigentext einfügen." }, { status: 400 });
  }

  try {
    const parsed = await extrahiereImmodaten(apiKey, pdfBase64 ? { pdfBase64 } : { text });
    return NextResponse.json({ data: parsed });
  } catch (err) {
    if (err instanceof AiImportFehler)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("import: unerwarteter Fehler", err);
    return NextResponse.json({ error: "Fehler beim Analysieren. Bitte später erneut versuchen." }, { status: 500 });
  }
}
