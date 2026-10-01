import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import KarteVerortung from "@/components/KarteVerortung";
import { ordneFuerKarte, type KartenZeile } from "@/lib/geocode";
import { MapPin } from "lucide-react";

export const metadata = { title: "Portfolio-Karte — MyImmo" };
export const dynamic = "force-dynamic";

// Portfolio-Karte. Seit 01.10.2026 rendert die Seite SOFORT mit allem, was
// schon Koordinaten hat; offene Objekte verortet der Browser danach einzeln
// (KarteVerortung → /api/karte/verorten). Vorher wartete der Server auf bis zu
// drei Nominatim-Anfragen, bevor überhaupt etwas zu sehen war — und versuchte
// gescheiterte Adressen bei jedem Aufruf erneut (siehe lib/geocode.ts).

export default async function KartePage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const { data: rows } = await supabase
    .from("properties")
    .select("id,bezeichnung,adresse,typ,wert,lat,lng,latitude,longitude,geo_status,geo_versucht_am")
    .eq("user_id", user?.id ?? "")
    .order("bezeichnung");

  const alle = rows ?? [];
  const { verortet, offen, nichtGefunden, ohneAdresse, pausiert } = ordneFuerKarte(alle as KartenZeile[]);
  const wertGesamt = verortet.reduce((s, o) => s + (o.wert ?? 0), 0);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Auswertung · Standorte</div>
          <div className="topbar-title">Portfolio-Karte</div>
          <div className="topbar-sub">
            {verortet.length} {verortet.length === 1 ? "Objekt" : "Objekte"} auf der Karte
            {alle.length > verortet.length && <> · {alle.length} insgesamt</>}
            {wertGesamt > 0 && <> · Gesamtwert € {Math.round(wertGesamt).toLocaleString("de-DE")}</>}
          </div>
        </div>
      </div>
      <hr className="topbar-rule" />

      {alle.length === 0 ? (
        <div className="section"><div className="section-body">
          <div className="empty">
            <MapPin className="empty-icon" size={36} color="var(--faint)" />
            <h4>Noch keine Objekte</h4>
            <p>Lege zuerst eine Immobilie mit Adresse an — sie erscheint dann automatisch hier auf der Karte.</p>
          </div>
        </div></div>
      ) : (
        <>
          <KarteVerortung
            verortet={verortet}
            offen={offen}
            nichtGefunden={nichtGefunden}
            ohneAdresse={ohneAdresse}
            pausiert={pausiert}
          />
          <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 8 }}>
            Verortung über OpenStreetMap/Nominatim (nur die Objektadresse wird übermittelt, einmal je Adresse);
            Kartendarstellung © OpenStreetMap / CARTO. Details in der <a href="/datenschutz" style={{ color: "inherit" }}>Datenschutzerklärung</a>.
          </div>
        </>
      )}
    </div>
  );
}
