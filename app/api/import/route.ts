import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/aiRoute";
import { extrahiereImmodaten, AiImportFehler } from "@/lib/aiImport";

export const runtime = "nodejs";

// Text-Import: Exposé-/Anzeigentext → Immobiliendaten (KI-Extraktion).
// Response-Shape: { data: {...} } — identisch zu /api/import-url.
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
    const parsed = await extrahiereImmodaten(apiKey, { text });
    return NextResponse.json({ data: parsed });
  } catch (err) {
    if (err instanceof AiImportFehler)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("import: unerwarteter Fehler", err);
    return NextResponse.json({ error: "Fehler beim Analysieren. Bitte später erneut versuchen." }, { status: 500 });
  }
}
