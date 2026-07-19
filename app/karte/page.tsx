import { createClient } from "@/lib/supabase/server";
import PortfolioKarte, { type KartenObjekt } from "@/components/PortfolioKarte";
import { geocodeAdresse, GEOCODE_PAUSE_MS } from "@/lib/geocode";
import { MapPin, TriangleAlert } from "lucide-react";

export const metadata = { title: "Portfolio-Karte — MyImmo" };
export const dynamic = "force-dynamic";

// Portfolio-Karte: Objekte mit Adresse werden einmalig geocodiert (Nominatim,
// max. 1 Anfrage/s, deshalb höchstens 3 pro Seitenaufruf) und die Koordinaten
// in der properties-Zeile gecacht. Danach kommt die Karte ohne externe
// Geocoding-Aufrufe aus.
const MAX_GEOCODE_PRO_AUFRUF = 3;

export default async function KartePage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("properties")
    .select("id,bezeichnung,adresse,typ,wert,lat,lng")
    .order("bezeichnung");

  const alle = rows ?? [];

  // Fehlende Koordinaten nachziehen (sequentiell, Nominatim-Policy).
  const ohneKoord = alle.filter((p) => p.adresse && (p.lat == null || p.lng == null));
  let geocodiert = 0;
  for (const p of ohneKoord.slice(0, MAX_GEOCODE_PRO_AUFRUF)) {
    if (geocodiert > 0) await new Promise((r) => setTimeout(r, GEOCODE_PAUSE_MS));
    const punkt = await geocodeAdresse(p.adresse as string);
    geocodiert++;
    if (!punkt) continue;
    await supabase.from("properties").update({ lat: punkt.lat, lng: punkt.lng }).eq("id", p.id);
    p.lat = punkt.lat;
    p.lng = punkt.lng;
  }

  const objekte: KartenObjekt[] = alle
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      name: p.bezeichnung,
      adresse: p.adresse ?? "",
      typ: p.typ,
      wert: p.wert,
      lat: p.lat as number,
      lng: p.lng as number,
    }));

  const ohneAdresse = alle.filter((p) => !p.adresse).length;
  const nochOffen = alle.filter((p) => p.adresse && (p.lat == null || p.lng == null)).length;
  const wertGesamt = objekte.reduce((s, o) => s + (o.wert ?? 0), 0);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Portfolio-Karte</div>
          <div className="topbar-sub">
            {objekte.length} {objekte.length === 1 ? "Objekt" : "Objekte"} auf der Karte
            {wertGesamt > 0 && <> · Gesamtwert € {Math.round(wertGesamt).toLocaleString("de-DE")}</>}
          </div>
        </div>
      </div>

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
          <PortfolioKarte objekte={objekte} />
          {(nochOffen > 0 || ohneAdresse > 0) && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
              <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {nochOffen > 0 && <>{nochOffen} {nochOffen === 1 ? "Objekt wird" : "Objekte werden"} beim nächsten Aufruf der Karte verortet (Adresssuche läuft schonend im Hintergrund). </>}
                {ohneAdresse > 0 && <>{ohneAdresse} {ohneAdresse === 1 ? "Objekt hat" : "Objekte haben"} keine Adresse — trage sie in den Objektdaten nach, um sie auf der Karte zu sehen.</>}
              </span>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 8 }}>
            Verortung über OpenStreetMap/Nominatim (nur die Objektadresse wird übermittelt); Kartendarstellung © OpenStreetMap / CARTO.
          </div>
        </>
      )}
    </div>
  );
}
