import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladeAufbauDaten } from "@/lib/aufbauDaten";
import { fahrplan } from "@/lib/fahrplan";
import { wegSchritt } from "@/lib/kaufweg";
import { heuteBerlin } from "@/lib/zeitraum";
import WegKopf from "@/components/aufbau/WegKopf";
import StationListe from "@/components/aufbau/StationListe";
import DarlehenAusWunsch from "@/components/aufbau/DarlehenAusWunsch";

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

      {/* Paket E (06.10.2026): Gekauft → Objekt aus der Kaufprüfung anlegen, statt alles neu zu tippen. */}
      <div className="section">
        <div className="section-header"><h3>Gekauft? Übernimm deine Kaufprüfung</h3></div>
        <div className="section-body">
          {d.kaufpruefungen.length === 0 ? (
            <p className="sanierung-klein" style={{ margin: 0 }}>
              Noch keine Kaufprüfung gespeichert. Ohne sie legst du das Objekt <Link href="/properties/new">von Hand an</Link>.
            </p>
          ) : (
            d.kaufpruefungen.map((k) =>
              k.uebernommen_prop_id ? (
                <Link key={k.id} href={`/properties/${k.uebernommen_prop_id}`} className="listen-zeile">
                  <span className="listen-zeile-text">
                    <span className="listen-zeile-titel">{k.name}</span>
                    <span className="listen-zeile-sub">Als Objekt übernommen</span>
                  </span>
                  <span className="listen-zeile-datum">Objekt öffnen</span>
                </Link>
              ) : (
                <Link key={k.id} href={`/properties/new?aus=${encodeURIComponent(k.id)}`} className="listen-zeile">
                  <span className="listen-zeile-text">
                    <span className="listen-zeile-titel">{k.name}</span>
                    <span className="listen-zeile-sub">Adresse, Kaufpreis, Fläche und Miete werden vorbelegt</span>
                  </span>
                  <span className="listen-zeile-datum">Als Objekt anlegen</span>
                </Link>
              ),
            )
          )}
          <div style={{ marginTop: 12 }}><DarlehenAusWunsch /></div>
        </div>
      </div>

      <p className="sanierung-klein" style={{ margin: 0 }}>
        Allgemeine Informationen zum Ablauf, keine Rechtsberatung. Was für deinen Vertrag gilt, klärst du mit dem Notar. Alle
        Schritte als Checkliste: <Link href="/fahrplan">Fahrplan</Link>.
      </p>
    </div>
  );
}
