import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladeAufbauDaten } from "@/lib/aufbauDaten";
import { fahrplan, fortschritt, type StationStatus } from "@/lib/fahrplan";
import { heuteBerlin } from "@/lib/zeitraum";
import NebenkostenRechner from "@/components/NebenkostenRechner";

export const metadata = { title: "Fahrplan — BuyImmo" };
export const dynamic = "force-dynamic";

// BuyImmo-Fahrplan (05.10.2026): der geführte Weg zum ersten bzw. nächsten Objekt. Was jeder
// Schritt braucht, und — nur wo BuyImmo es aus den Daten weiß — wie weit du bist. Keine
// Empfehlung, kein Urteil über die Person (lib/fahrplan.ts, docs/zukunft/BUYIMMO.md).

const BADGE: Record<StationStatus["art"], string> = {
  erledigt: "badge-green",
  teilweise: "badge-amber",
  offen: "badge-neutral",
  info: "badge-neutral",
};

export default async function FahrplanPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const d = await ladeAufbauDaten(supabase, user, heuteBerlin());
  const stationen = fahrplan({
    hatSelbstauskunft: d.hatSelbstauskunft,
    makler: d.makler,
    kaufpruefungen: d.kaufpruefungen.length,
    vertreterGueltig: d.vertreterGueltig,
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
            <div className="section-sub">Kaufnebenkosten — mit derselben Rechnung wie im Kauf-Assistenten</div>
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
              Was BuyImmo prüfen kann: {stand.erledigt} von {stand.pruefbar} erledigt. Besichtigung und Notar kennt nur du.
            </div>
          </div>
        </div>
        <div className="section-body">
          <ol className="fahrplan">
            {stationen.map((s, i) => (
              <li key={s.id} className={`fahrplan-station${s.status?.art === "erledigt" ? " fertig" : ""}`}>
                <span className="fahrplan-nummer" aria-hidden>{i + 1}</span>
                <div className="fahrplan-inhalt">
                  <div className="fahrplan-kopf">
                    <h4>{s.titel}</h4>
                    {s.status && <span className={`badge ${BADGE[s.status.art]}`}>{s.status.text}</span>}
                  </div>
                  <p>{s.satz}</p>
                  {s.punkte.length > 0 && (
                    <ul>
                      {s.punkte.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {s.ziel && (
                    <Link href={s.ziel.href} className="fahrplan-link">
                      {s.ziel.label} <ChevronRight size={14} aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="sanierung-klein" style={{ margin: 0 }}>
        Allgemeine Informationen zum Ablauf, keine Finanzierungs- oder Rechtsberatung. Was für dich passt, klärst du mit
        deiner Bank und dem Notar.
      </p>
    </div>
  );
}
