import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { featureSperre } from "@/lib/planGate";
import { erzeugeNkPdf } from "@/lib/pdf/erzeugen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  // Tarif-Schranke. Ohne BILLING_ENFORCED kehrt featureSperre() sofort
  // mit null zurueck — ohne Datenbankabfrage, ohne Verhaltensaenderung.
  const sperre = await featureSperre(supabase, "nk_pdf");
  if (sperre) return new NextResponse(sperre, { status: 402 });

  const jahr = Number(req.nextUrl.searchParams.get("jahr")) || new Date().getFullYear() - 1;

  const doc = await erzeugeNkPdf(supabase, params.id, jahr);
  if (!doc) return new NextResponse("Mieter nicht gefunden", { status: 404 });

  return new NextResponse(Buffer.from(doc.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.dateiname}"`,
      "Cache-Control": "no-store",
    },
  });
}
