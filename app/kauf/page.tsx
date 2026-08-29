import { createClient } from "@/lib/supabase/server";
import type { Kalkulation } from "@/lib/types";
import KaufAssistent from "@/components/KaufAssistent";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";
import { istDemoKonto } from "@/lib/demo";

export const metadata = { title: "Kauf-Assistent — MyImmo" };
export const dynamic = "force-dynamic";

// Kauf-Assistent: geführter Ablauf inkl. eingebettetem Objekt-Rechner
// (früher „Cockpit"/„Roter Faden"). Die gespeicherten Kalkulationen und die
// Selbstauskunft werden hier serverseitig geladen und an den Client-Stepper
// übergeben.
export default async function KaufPage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("kalkulationen")
    .select("*")
    .order("created_at", { ascending: false });
  const selbstauskunft = await ladeSelbstauskunft();
  const { data: { user } } = await supabase.auth.getUser();
  const demo = istDemoKonto(user?.email);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Kalkulator · Kauf</div>
          <div className="topbar-title">Kauf-Assistent</div>
          <div className="topbar-sub">Vom gefundenen Objekt bis zur Finanzierungsanfrage — Schritt für Schritt</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <KaufAssistent gespeichert={(rows ?? []) as Kalkulation[]} selbstauskunft={selbstauskunft} demo={demo} />
    </div>
  );
}
