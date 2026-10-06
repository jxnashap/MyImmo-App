import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladeAufbauDaten } from "@/lib/aufbauDaten";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";
import { istDemoKonto } from "@/lib/demo";
import { DEMO_SELBSTAUSKUNFT, eigenkapitalGesamt } from "@/lib/kauf/selbstauskunft";
import { bestandAus } from "@/lib/strategie";
import { heuteBerlin } from "@/lib/zeitraum";
import StrategiePlaner from "@/components/strategie/StrategiePlaner";

export const metadata = { title: "Strategie — BuyImmo" };
export const dynamic = "force-dynamic";

// Strategie (BuyImmo, Umbau 06.10.2026, Jonas: „stammbaumartig seine Kaufziele für das nächste
// Jahrzehnt vorbereiten“): Kaufschritte mit wählbaren Taktiken, gerechnet nach den Annahmen des Nutzers.
// Start aus MyImmo: Bestand (Wert, Kredite je Objekt) und das Eigenkapital der Selbstauskunft als
// Vorschlag fürs Ersparte. Rechner, keine Empfehlung — Grenze und Risiken: lib/strategie.ts und
// docs/zukunft/STRATEGIE-REITER.md (§ 34i anwaltlich offen).

export default async function StrategiePage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const heute = heuteBerlin();
  const [d, selbstauskunft] = await Promise.all([ladeAufbauDaten(supabase, user, heute), ladeSelbstauskunft()]);
  // Demo: dieselbe Beispiel-Selbstauskunft wie im Kauf-Assistenten (die echte liegt verschlüsselt).
  const auskunft = istDemoKonto(user?.email) ? DEMO_SELBSTAUSKUNFT : selbstauskunft;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Überblick</div>
          <div className="topbar-title">Strategie</div>
          <div className="topbar-sub">Deine Käufe der nächsten zehn Jahre — mit der Taktik, die du wählst</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <StrategiePlaner
        bestand={bestandAus(d.objekte, d.kredite)}
        erspartesStart={auskunft ? eigenkapitalGesamt(auskunft) : 0}
        startJahr={Number(heute.slice(0, 4))}
      />
    </div>
  );
}
