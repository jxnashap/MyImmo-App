import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladeAufbauDaten } from "@/lib/aufbauDaten";
import { fahrplan, fortschritt } from "@/lib/fahrplan";
import { KAUFWEG } from "@/lib/kaufweg";
import StationListe from "@/components/aufbau/StationListe";
import { heuteBerlin } from "@/lib/zeitraum";
import NebenkostenRechner from "@/components/NebenkostenRechner";

export const metadata = { title: "Fahrplan — BuyImmo" };
export const dynamic = "force-dynamic";

// BuyImmo-Fahrplan (05.10.2026): der geführte Weg zum ersten bzw. nächsten Objekt. Was jeder
// Schritt braucht, und — nur wo BuyImmo es aus den Daten weiß — wie weit du bist. Keine
// Empfehlung, kein Urteil über die Person (lib/fahrplan.ts, docs/zukunft/BUYIMMO.md).
// Seit dem Umbau (06.10.2026) die ausführliche Checkliste zum Kaufweg: Stationen gruppiert nach den
// fünf Schritten der Seitenleiste (lib/kaufweg.ts).

export default async function FahrplanPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const d = await ladeAufbauDaten(supabase, user, heuteBerlin());
  const stationen = fahrplan({
    hatSelbstauskunft: d.hatSelbstauskunft,
    makler: d.makler,
    kaufpruefungen: d.kaufpruefungen.length,
    vertreterGueltig: d.vertreterGueltig,
    vertreterGrundbuch: d.vertreterGrundbuch,
    objekte: d.objekte.length,
  });
  const stand = fortschritt(stationen);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Bestand aufbauen</div>
          <div className="topbar-title">Fahrplan</div>
          <div className="topbar-sub">Vom ersten Kassensturz bis zum Objekt, das MyImmo für dich verwaltet — Schritt für Schritt</div>
        </div>
      </div>
      <hr className="topbar-rule" />

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Was du zusätzlich zum Kaufpreis brauchst</h3>
            <div className="section-sub">Kaufnebenkosten — mit derselben Rechnung wie in Schritt 1 (Objekte vergleichen)</div>
          </div>
        </div>
        <div className="section-body">
          <NebenkostenRechner />
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Dein Weg zum Objekt</h3>
            <div className="section-sub">
              Was BuyImmo prüfen kann: {stand.erledigt} von {stand.pruefbar} erledigt. Besichtigung und Notar kennst nur du.
            </div>
          </div>
        </div>
        <div className="section-body">
          {KAUFWEG.map((w) => {
            const eigene = stationen.filter((st) => w.stationen.includes(st.id));
            const start = stationen.findIndex((st) => st.id === eigene[0]?.id) + 1;
            return (
              <div key={w.id} className="fahrplan-gruppe">
                <h4 className="fahrplan-gruppe-titel">
                  <Link href={w.href}>Schritt {w.nr} · {w.titel}</Link>
                </h4>
                <StationListe stationen={eigene} start={start} />
              </div>
            );
          })}
        </div>
      </div>

      <p className="sanierung-klein" style={{ margin: 0 }}>
        Allgemeine Informationen zum Ablauf, keine Finanzierungs- oder Rechtsberatung. Was für dich passt, klärst du mit
        deiner Bank und dem Notar.
      </p>
    </div>
  );
}
