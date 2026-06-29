import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { berechneNk, type NkRawPosition } from "@/lib/nk";
import { buildNkPdf, vermieterAus } from "@/lib/pdf/nkPdf";
import { decryptIbanRow } from "@/lib/ibanData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const jahrParam = req.nextUrl.searchParams.get("jahr");
  const jahr = Number(jahrParam) || new Date().getFullYear() - 1;

  const { data: tenant, error } = await supabase
    .from("mieter")
    .select(
      "id,prop_id,vorname,nachname,mieter_adresse,einheit,flaeche,mietbeginn,mietende,nk_vorauszahlung",
    )
    .eq("id", params.id)
    .single();

  if (error || !tenant) {
    return new NextResponse("Mieter nicht gefunden", { status: 404 });
  }

  const [{ data: property }, { data: positions }, { data: profil }, { data: iban }] =
    await Promise.all([
      tenant.prop_id
        ? supabase
            .from("properties")
            .select("bezeichnung,adresse")
            .eq("id", tenant.prop_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("mieter_positionen")
        .select("bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr")
        .eq("mieter_id", params.id)
        .order("created_at"),
      supabase
        .from("vermieter_profil")
        .select("name,strasse,plz,ort,email")
        .limit(1)
        .maybeSingle(),
      supabase.from("ibans").select("kontoname,inhaber,iban").order("created_at").limit(1).maybeSingle(),
    ]);

  const abrechnung = berechneNk(
    jahr,
    tenant,
    property ?? null,
    (positions ?? []) as NkRawPosition[],
  );

  const pdf = await buildNkPdf(
    abrechnung,
    vermieterAus(profil, iban ? decryptIbanRow(iban) : null),
  );

  const safeName = abrechnung.mieterName.replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = `NK-Abrechnung_${jahr}_${safeName}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
