import { heuteBerlin } from "@/lib/zeitraum";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { featureSperre } from "@/lib/planGate";
import { erzeugeNkPdf } from "@/lib/pdf/erzeugen";
import { belegung } from "@/lib/nk";
import { unvollstaendigAntwort } from "@/lib/db/auswertung";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alle NK-Abrechnungen eines Hauses für ein Jahr als EIN PDF (Stufe 1, 07.10.2026). Jede Seite
// kommt aus erzeugeNkPdf — derselben Erzeugung wie der Einzel-Download.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const sperre = await featureSperre(supabase, "nk_pdf");
  if (sperre) return new NextResponse(sperre, { status: 402 });

  const jahr = Number(req.nextUrl.searchParams.get("jahr")) || Number(heuteBerlin().slice(0, 4)) - 1;
  const { data: prop, error: e1 } = await supabase.from("properties").select("id,bezeichnung").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (e1) return new NextResponse("Objekt konnte nicht geladen werden", { status: 500 });
  if (!prop) return new NextResponse("Objekt nicht gefunden", { status: 404 });
  const { data: mieter, error: e2 } = await supabase
    .from("mieter").select("id,mietbeginn,mietende").eq("prop_id", id).eq("user_id", user.id).order("mietbeginn");
  if (e2) return new NextResponse("Mieter konnten nicht geladen werden", { status: 500 });

  const gesamt = await PDFDocument.create();
  for (const m of (mieter ?? []).filter((m) => belegung(jahr, m.mietbeginn, m.mietende).tage > 0)) {
    let doc: Awaited<ReturnType<typeof erzeugeNkPdf>>;
    try {
      doc = await erzeugeNkPdf(supabase, m.id, jahr);
    } catch (e) {
      return unvollstaendigAntwort(e);
    }
    // B08 (11.10.2026): Vorher wurde ein Mieter, dessen Abrechnung nicht entstand, still übersprungen —
    // das Sammel-PDF sah vollständig aus. Jetzt entsteht es nur mit ALLEN belegten Mietern.
    if (!doc) return new NextResponse("Eine der Abrechnungen konnte nicht erzeugt werden — es wurde kein unvollständiges Sammel-PDF erstellt.", { status: 503 });
    const quelle = await PDFDocument.load(doc.pdf);
    for (const seite of await gesamt.copyPages(quelle, quelle.getPageIndices())) gesamt.addPage(seite);
  }
  if (gesamt.getPageCount() === 0) return new NextResponse(`Keine Mieter mit Belegung in ${jahr}`, { status: 404 });

  const name = String(prop.bezeichnung ?? "Objekt").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
  return new NextResponse(Buffer.from(await gesamt.save()), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="NK-Abrechnungen_${jahr}_${name}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
