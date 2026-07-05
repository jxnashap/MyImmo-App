// Geocoding-Adapter: Adresse → lat/lng. Nutzt OpenStreetMap/Nominatim (kostenlos,
// EU-gehostet). Nominatim-Policy: gültiger User-Agent, max ~1 Anfrage/Sekunde —
// daher nur bei „Jetzt aktualisieren"/Cron mit Throttle einsetzen, nicht im Render.
// Bei Fehlern: null → Aufrufer nutzt gespeicherte Koordinaten / manuelle Eingabe.

export type GeoTreffer = { lat: number; lng: number; quelle: string };

export async function geocode(adresse: string | null | undefined): Promise<GeoTreffer | null> {
  if (process.env.VALUATION_GEOCODE_ENABLED === "false") return null;
  const q = (adresse ?? "").trim();
  if (q.length < 4) return null;
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&q=" +
    encodeURIComponent(q);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MyImmo-App/1.0 (Immobilienbewertung; +https://my-immo-app.vercel.app)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, quelle: "OpenStreetMap/Nominatim" };
  } catch {
    return null;
  }
}
