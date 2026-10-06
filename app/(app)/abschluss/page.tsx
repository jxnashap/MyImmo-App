import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladeAufbauDaten } from "@/lib/aufbauDaten";
import { fahrplan } from "@/lib/fahrplan";
import { wegSchritt } from "@/lib/kaufweg";
import { heuteBerlin } from "@/lib/zeitraum";
import WegKopf from "@/components/aufbau/WegKopf";
import StationListe from "@/components/aufbau/StationListe";

export const metadata = { title: "Notar & Übergabe — BuyImmo" };
export const dynamic = "force-dynamic";

// Kaufweg Schritt 5 (Umbau 06.10.2026): Beurkundung, Vollmacht, Übergabe an MyImmo. Die Inhalte sind
// die Fahrplan-Stationen „Notartermin“ und „Übergabe“ (lib/fahrplan.ts) — dieselben Texte und
// derselbe Status wie auf /fahrplan, keine zweite Fassung. Allgemeine Information, keine Rechtsberatung.

export default async function AbschlussPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const d = await ladeAufbauDaten(supabase, user, heuteBerlin());
  const alle = fahrplan({
    hatSelbstauskunft: d.hatSelbstauskunft,
    makler: d.makler,
    kaufpruefungen: d.kaufpruefungen.length,
    vertreterGueltig: d.vertreterGueltig,
    vertreterGrundbuch: d.vertreterGrundbuch,
    objekte: d.objekte.length,
  });
  const schritt = wegSchritt("abschluss");
  const stationen = alle.filter((s) => schritt.stationen.includes(s.id));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Schritt 5</div>
          <div className="topbar-title">Notar & Übergabe</div>
          <div className="topbar-sub">Vom Kaufvertrag bis zum Objekt, das MyImmo für dich verwaltet</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <WegKopf schritt="abschluss" />

      <div className="section">
        <div className="section-body">
          <StationListe stationen={stationen} />
        </div>
      </div>

      <p className="sanierung-klein" style={{ margin: 0 }}>
        Allgemeine Informationen zum Ablauf, keine Rechtsberatung. Was für deinen Vertrag gilt, klärst du mit dem Notar. Alle
        Schritte als Checkliste: <Link href="/fahrplan">Fahrplan</Link>.
      </p>
    </div>
  );
}
