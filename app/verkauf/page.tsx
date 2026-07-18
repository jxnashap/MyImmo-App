import { createClient } from "@/lib/supabase/server";
import VerkaufAssistent from "@/components/VerkaufAssistent";
import type { VerkaufObjekt } from "@/components/VerkaufRechner";

export const metadata = { title: "Verkauf-Assistent — MyImmo" };
export const dynamic = "force-dynamic";

// Verkauf-Assistent: Ablaufschema von der Wertermittlung bis zur Übergabe.
// Bestandsobjekte (inkl. Restschuld-Summe) werden serverseitig geladen, damit
// der Rechner sie vorbefüllen kann.
export default async function VerkaufPage() {
  const supabase = createClient();
  const [{ data: props }, { data: kredite }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung,kaufpreis,kaufdatum,wert").order("bezeichnung"),
    supabase.from("kredite").select("prop_id,restschuld,betrag"),
  ]);

  const restschuld = new Map<string, number>();
  for (const k of kredite ?? []) {
    if (!k.prop_id) continue;
    restschuld.set(k.prop_id, (restschuld.get(k.prop_id) ?? 0) + (k.restschuld ?? k.betrag ?? 0));
  }
  const objekte: VerkaufObjekt[] = (props ?? []).map((p) => ({
    id: p.id,
    name: p.bezeichnung,
    kaufpreis: p.kaufpreis,
    kaufdatum: p.kaufdatum ?? null,
    wert: p.wert,
    restschuld: restschuld.get(p.id) ?? 0,
  }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Verkauf-Assistent</div>
          <div className="topbar-sub">Vom Wert bis zur Übergabe — mit Spekulationssteuer- und Netto-Erlös-Check</div>
        </div>
      </div>
      <VerkaufAssistent objekte={objekte} />
    </div>
  );
}
