// Vergleichsangebote (Comparables) der Umgebung. Zwei Quellen:
//   1) Eigenbestand (immer): andere Objekte des Nutzers mit Koordinaten im Umkreis.
//   2) IS24-Search-API (Stub, Feature-Flag): erst nach Partner-Freigabe + Secrets.
// Aggregation: Ausreißer per IQR kappen, Median €/m² bilden. Reine Funktionen für
// Distanz/Aggregation → unit-testbar; Netz-Zugriff nur im IS24-Stub.

export type Vergleichsangebot = {
  quelle: string;
  externe_id: string | null;
  art: string | null;
  flaeche: number | null;
  zimmer: number | null;
  preis: number | null;
  preis_pro_qm: number | null;
  distanz_km: number;
  angebots_datum: string | null;
};

/** Haversine-Distanz in Kilometern. */
export function distanzKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export type Kandidat = {
  id: string; typ: string | null; flaeche: number | null; zimmer: number | null;
  wert: number | null; latitude: number | null; longitude: number | null;
};

/**
 * Vergleichsangebote aus dem eigenen Bestand: gleicher Typ, Fläche ±25 %,
 * innerhalb `umkreisKm`, mit Koordinaten. `wert` als Preisindikator (Marktwert
 * oder Kaufpreis des Vergleichsobjekts).
 */
export function eigenbestandComparables(
  ziel: { id: string; typ: string | null; flaeche: number | null; latitude: number | null; longitude: number | null },
  kandidaten: Kandidat[],
  umkreisKm = 5,
): Vergleichsangebot[] {
  if (ziel.latitude == null || ziel.longitude == null) return [];
  const zf = ziel.flaeche ?? 0;
  const out: Vergleichsangebot[] = [];
  for (const k of kandidaten) {
    if (k.id === ziel.id) continue;
    if (k.latitude == null || k.longitude == null) continue;
    if (ziel.typ && k.typ && k.typ !== ziel.typ) continue;
    if (!k.wert || k.wert <= 0 || !k.flaeche || k.flaeche <= 0) continue;
    if (zf > 0 && Math.abs(k.flaeche - zf) / zf > 0.25) continue;
    const dist = distanzKm(ziel.latitude, ziel.longitude, k.latitude, k.longitude);
    if (dist > umkreisKm) continue;
    out.push({
      quelle: "Eigenbestand", externe_id: k.id, art: k.typ, flaeche: k.flaeche,
      zimmer: k.zimmer, preis: k.wert, preis_pro_qm: k.wert / k.flaeche,
      distanz_km: Math.round(dist * 10) / 10, angebots_datum: null,
    });
  }
  return out.sort((a, b) => a.distanz_km - b.distanz_km);
}

/** IS24-Comparables (Stub). Ohne Partner-Freigabe + Secrets → leer. */
export async function is24Comparables(
  _lat: number, _lng: number,
  _filter: { typ?: string | null; flaeche?: number | null },
): Promise<Vergleichsangebot[]> {
  if (process.env.VALUATION_IS24_ENABLED !== "true") return [];
  // TODO: OAuth (2-/3-legged) + Search-API → Umkreis-Listings. Erst nach
  // „API Permission Request"/Partnerfreigabe und hinterlegten Secrets.
  return [];
}

/** IQR-Ausreißerkappung + Median der €/m². Liefert Kennzahlen der Stichprobe. */
export function aggregiereComparables(list: Vergleichsangebot[]): {
  anzahl: number; medianPreisProQm: number | null; minProQm: number | null; maxProQm: number | null;
} {
  const werte = list.map((x) => x.preis_pro_qm).filter((x): x is number => x != null && x > 0).sort((a, b) => a - b);
  if (werte.length === 0) return { anzahl: 0, medianPreisProQm: null, minProQm: null, maxProQm: null };
  const q = (p: number) => {
    const idx = (werte.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return werte[lo] + (werte[hi] - werte[lo]) * (idx - lo);
  };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const gefiltert = werte.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  const basis = gefiltert.length ? gefiltert : werte;
  const median = q(0.5);
  return {
    anzahl: list.length,
    medianPreisProQm: Math.round(median),
    minProQm: Math.round(basis[0]),
    maxProQm: Math.round(basis[basis.length - 1]),
  };
}
