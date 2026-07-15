import { createClient } from "@/lib/supabase/server";
import AfaAssistent, { type AfaObjekt } from "@/components/kalkulator/AfaAssistent";

export const dynamic = "force-dynamic";

// AfA-Assistent (Kalkulator): degressiv-vs-linear-Vergleich, § 7b-Check,
// § 82b-Verteilung und Kaufpreisaufteilung — mit Objekt-Vorbefüllung.
export default async function AfaAssistentPage() {
  const supabase = createClient();
  const { data: props } = await supabase
    .from("properties")
    .select("id,bezeichnung,kaufpreis,flaeche,grundstuecksflaeche,bodenrichtwert,baujahr,afa_gebaeudeanteil")
    .order("bezeichnung");

  const objekte: AfaObjekt[] = ((props ?? []) as any[]).map((p) => ({
    id: p.id,
    bezeichnung: p.bezeichnung ?? "Objekt",
    kaufpreis: p.kaufpreis != null ? Number(p.kaufpreis) : null,
    flaeche: p.flaeche != null ? Number(p.flaeche) : null,
    grundstuecksflaeche: p.grundstuecksflaeche != null ? Number(p.grundstuecksflaeche) : null,
    bodenrichtwert: p.bodenrichtwert != null ? Number(p.bodenrichtwert) : null,
    baujahr: p.baujahr != null ? Number(p.baujahr) : null,
    gebaeudeanteil: p.afa_gebaeudeanteil != null ? Number(p.afa_gebaeudeanteil) : null,
  }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">AfA-Assistent</div>
          <div className="topbar-sub">
            Abschreibung planen: Kaufpreisaufteilung, degressiv vs. linear, § 7b-Sonder-AfA und § 82b-Verteilung · Angaben ohne Gewähr
          </div>
        </div>
      </div>
      <AfaAssistent objekte={objekte} />
    </div>
  );
}
