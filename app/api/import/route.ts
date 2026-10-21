import { NextResponse } from "next/server";
import { featureSperre } from "@/lib/planGate";
import { darfWeiter } from "@/lib/net/bremse";
import { getAuthedUser, MB, kiBereit, KI_NICHT_BEREIT } from "@/lib/aiRoute";
import { jsonBegrenzt, jsonGrenzeFuerBase64, ZuGrossFehler } from "@/lib/net/grenzen";
import { extrahiereImmodaten, AiImportFehler } from "@/lib/aiImport";

export const runtime = "nodejs";

// Exposé-Import: Anzeigentext ODER hochgeladenes Exposé-PDF → Immobiliendaten
// (KI-Extraktion). Response-Shape: { data: {...} } — identisch zu /api/import-url.
export const maxDuration = 60;

const MAX_PDF_BYTES = 20 * MB;
export async function POST(req: Request) {
  const { user, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Du bist nicht mehr angemeldet — bitte neu anmelden." }, { status: 401 });
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

  let text = "";
  let pdfBase64 = "";
  try {
    // B16: Body mit Grenze lesen, bevor irgendetwas davon im Speicher liegt.
    const body = (await jsonBegrenzt(req, jsonGrenzeFuerBase64(MAX_PDF_BYTES))) as Record<string, unknown> | null;
    text = String(body?.text ?? "").trim();
    pdfBase64 = String(body?.pdfBase64 ?? "").trim();
  } catch (e) {
    if (e instanceof ZuGrossFehler) return NextResponse.json({ error: "PDF zu groß (max. 20 MB)." }, { status: 413 });
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
