// Serverseitiges Geocoding für die Portfolio-Karte über Nominatim (OpenStreetMap).
// Höflich gemäß Usage-Policy: eigener User-Agent, max. 1 Anfrage/Sekunde, und
// jede Adresse wird nur EINMAL geocodiert (Ergebnis landet als lat/lng in der
// properties-Zeile; bei Adressänderung wird der Cache geleert).

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MyImmo/1.0 (https://my-immo-app.vercel.app)";

export type GeoPunkt = { lat: number; lng: number };

export async function geocodeAdresse(adresse: string): Promise<GeoPunkt | null> {
  const q = adresse.trim();
  if (!q) return null;
  try {
    const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      // Nominatim cacht selbst; wir wollen keinen Next-Cache auf Fehlversuche.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat?: string; lon?: string }[];
    const t = json?.[0];
    if (!t?.lat || !t?.lon) return null;
    const lat = parseFloat(t.lat);
    const lng = parseFloat(t.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export const GEOCODE_PAUSE_MS = 1100; // Nominatim-Policy: max. 1 req/s
