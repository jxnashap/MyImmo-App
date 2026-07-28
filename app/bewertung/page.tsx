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
    .select("id,bezeichnung")
    .order("bezeichnung");
  const objekte: SchaetzerObjekt[] = (props ?? []).map((p) => ({ id: p.id, name: p.bezeichnung }));

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
