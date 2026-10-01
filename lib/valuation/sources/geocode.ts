// Geocoding-Adapter der Bewertung — seit 01.10.2026 nur noch eine dünne Hülle
// um die EINE Verortung in lib/geocode.ts (Bereinigung, Drosselungs-Erkennung,
// User-Agent). Wer das Ergebnis speichern will, nimmt `geocodeAdresse` +
// `geoAenderung` direkt; diese Hülle bleibt für Aufrufer, die nur einen Punkt
// brauchen.

import { geocodeAdresse } from "@/lib/geocode";

export type GeoTreffer = { lat: number; lng: number; quelle: string };

export async function geocode(adresse: string | null | undefined): Promise<GeoTreffer | null> {
  if (process.env.VALUATION_GEOCODE_ENABLED === "false") return null;
  const erg = await geocodeAdresse(adresse ?? "");
  return erg.art === "treffer" ? { lat: erg.lat, lng: erg.lng, quelle: "OpenStreetMap/Nominatim" } : null;
}
