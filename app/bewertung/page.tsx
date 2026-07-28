import { createClient } from "@/lib/supabase/server";
import BewertungAssistent, { type SchaetzerObjekt } from "@/components/BewertungAssistent";

export const metadata = { title: "Marktwert schätzen — MyImmo" };
export const dynamic = "force-dynamic";

export default async function BewertungPage() {
  const supabase = createClient();
  // Eigene Objekte laden, damit das Schätz-Ergebnis direkt an einem Objekt
  // gespeichert werden kann (Wertentwicklung + Verkauf-Assistent).
  const { data: props } = await supabase
    .from("properties")
    .select("id,bezeichnung,typ,flaeche,grundstuecksflaeche,baujahr,miete,kaufpreis,einheiten_anzahl")
    .order("bezeichnung");
  const objekte: SchaetzerObjekt[] = (props ?? []).map((p) => ({
    id: p.id,
    name: p.bezeichnung,
    typ: p.typ ?? null,
    flaeche: p.flaeche ?? null,
    grundstuecksflaeche: p.grundstuecksflaeche ?? null,
    baujahr: p.baujahr ?? null,
    // properties.miete ist die MONATS-Kaltmiete; der Schätzer rechnet mit der Jahresmiete.
    jahresmiete: p.miete != null && p.miete > 0 ? Math.round(p.miete * 12) : null,
    kaufpreis: p.kaufpreis ?? null,
    einheiten: p.einheiten_anzahl ?? null,
  }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Kalkulator · Marktwert</div>
          <div className="topbar-title">Marktwert-Schätzer</div>
          <div className="topbar-sub">Objekt selbst bewerten nach ImmoWertV — Ertrags- oder Sachwert</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <BewertungAssistent objekte={objekte} />
    </div>
  );
}
