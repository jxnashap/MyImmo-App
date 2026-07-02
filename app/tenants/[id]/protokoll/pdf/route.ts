import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildProtokollPdf, type ProtokollDaten } from "@/lib/pdf/protokollPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const form = await req.formData();
  const typ = String(form.get("typ") ?? "einzug") === "auszug" ? "auszug" : "einzug";
  const datum = String(form.get("datum") ?? "");
  const strom = String(form.get("strom") ?? "").trim();
  const gas = String(form.get("gas") ?? "").trim();
  const wasser = String(form.get("wasser") ?? "").trim();
  const schluessel = String(form.get("schluessel") ?? "").trim();
  let raeume: ProtokollDaten["raeume"] = [];
  try {
    const parsed = JSON.parse(String(form.get("raeume") ?? "[]"));
    if (Array.isArray(parsed)) {
      raeume = parsed
        .filter((r) => r && typeof r.name === "string")
        .map((r) => ({
          name: String(r.name ?? ""),
          zustand: String(r.zustand ?? ""),
          notiz: String(r.notiz ?? ""),
        }));
    }
  } catch {
    /* leere Liste, wenn JSON kaputt */
  }

  const { data: tenant } = await supabase
    .from("mieter")
    .select("vorname,nachname,einheit,prop_id")
    .eq("id", params.id)
    .single();
  if (!tenant) return new NextResponse("Mieter nicht gefunden", { status: 404 });

  const [{ data: property }, { data: profil }] = await Promise.all([
    tenant.prop_id
      ? supabase.from("properties").select("bezeichnung,adresse").eq("id", tenant.prop_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("vermieter_profil").select("name").eq("user_id", user.id).maybeSingle(),
  ]);

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";

  const pdf = await buildProtokollPdf({
    typ,
    datum,
    objekt,
    mieterName: mieterName || "–",
    vermieterName: profil?.name ?? "",
    strom,
    gas,
    wasser,
    schluessel,
    raeume,
  });

  const safeName = (mieterName || "Mieter").replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = `Uebergabeprotokoll_${safeName}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
