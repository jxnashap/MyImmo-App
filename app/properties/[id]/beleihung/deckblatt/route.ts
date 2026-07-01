// Deckblatt/Übersicht fürs Bankpaket als PDF: Objekt-Kennblatt +
// Wunsch-Konditionen (Query-Parameter) + Checkliste als Anlagenverzeichnis.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BELEIHUNG_CHECKLISTE, BEL_GRUPPEN, itemSichtbar, type BelKontext } from "@/lib/beleihung";
import { buildDeckblattPdf, type BelObjektDaten, type BelAngaben } from "@/lib/pdf/beleihungPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const [{ data: prop }, { data: mieter }, { data: kredite }, { data: profil }, { data: docs }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("bezeichnung,adresse,typ,baujahr,flaeche,zimmer,energieklasse,kaufpreis,wert,miete,hausgeld")
        .eq("id", params.id)
        .single(),
      supabase.from("mieter").select("kaltmiete,mietende").eq("prop_id", params.id),
      supabase.from("kredite").select("restschuld,betrag").eq("prop_id", params.id),
      supabase.from("vermieter_profil").select("name,strasse,plz,ort,email").limit(1).maybeSingle(),
      supabase.from("beleihung_dokumente").select("item_key,status").eq("prop_id", params.id),
    ]);
  if (!prop) return new NextResponse("Objekt nicht gefunden", { status: 404 });

  const q = req.nextUrl.searchParams;
  const angaben: BelAngaben = {
    darlehen: q.get("darlehen") ?? undefined,
    zweck: q.get("zweck") ?? undefined,
    zinsbindung: q.get("zinsbindung") ?? undefined,
    tilgung: q.get("tilgung") ?? undefined,
    wunschrate: q.get("wunschrate") ?? undefined,
    eigenkapital: q.get("eigenkapital") ?? undefined,
    sondertilgung: q.get("sondertilgung") ?? undefined,
  };

  const aktive = (mieter ?? []).filter((m) => !m.mietende || new Date(m.mietende) >= new Date());
  const mieteMo = aktive.reduce((s, m) => s + (m.kaltmiete ?? 0), 0);
  const objekt: BelObjektDaten = {
    bezeichnung: prop.bezeichnung,
    adresse: prop.adresse,
    typ: prop.typ,
    baujahr: prop.baujahr,
    flaeche: prop.flaeche,
    zimmer: prop.zimmer,
    energieklasse: prop.energieklasse,
    kaufpreis: prop.kaufpreis,
    wert: prop.wert,
    mieteMo: mieteMo > 0 ? mieteMo : prop.miete ?? 0,
    restschuld: (kredite ?? []).reduce((s, k) => s + (k.restschuld ?? k.betrag ?? 0), 0),
    hausgeld: prop.hausgeld,
  };

  const ctx: BelKontext = {
    istEtw: prop.typ === "Eigentumswohnung",
    hatMieter: aktive.length > 0,
    modusKauf: q.get("modus") === "kauf",
    selbststaendig: q.get("selbst") === "1",
  };
  const statusMap = new Map((docs ?? []).map((d) => [d.item_key, d.status]));
  const gruppenLabel = new Map(BEL_GRUPPEN.map((g) => [g.id, g.label]));
  const checkliste = BELEIHUNG_CHECKLISTE.filter((i) => itemSichtbar(i, ctx)).map((i) => ({
    label: i.label,
    gruppe: gruppenLabel.get(i.gruppe) || i.gruppe,
    erledigt: statusMap.get(i.key) === "erledigt" || statusMap.get(i.key) === "hochgeladen",
  }));

  const pdf = await buildDeckblattPdf(objekt, angaben, checkliste, {
    name: profil?.name || "MyImmo",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  });

  const safe = prop.bezeichnung.replace(/[^a-zA-Z0-9]+/g, "_");
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Bankpaket_${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
