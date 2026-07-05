// Bodenrichtwert-Adapter (BORIS). Best-effort „freier Auto-Abruf": ruft — wenn per
// ENV konfiguriert — einen Bodenrichtwert-Endpunkt für den Punkt (lat/lng) ab.
// Realität: BORIS ist je Bundesland unterschiedlich (NRW frei, andere tlw.
// kostenpflichtig / nur PDF / eigene WFS). Ohne konfigurierten Endpunkt liefert
// der Adapter `null` → der Aufrufer nutzt die manuell eingetragene Zahl.
//
// ENV:
//   VALUATION_BORIS_ENABLED = "true"
//   BORIS_ENDPOINT_URL      = JSON-Endpunkt, der {lat}/{lng} als Query akzeptiert und
//                             { brw:number, stichtag?:string } zurückgibt (z. B. ein
//                             kleiner Proxy vor dem Landes-WFS). Platzhalter {lat}/{lng}.

export type BodenrichtwertTreffer = { wert: number; stichtag: string | null; quelle: string };

export async function bodenrichtwertAbrufen(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<BodenrichtwertTreffer | null> {
  if (process.env.VALUATION_BORIS_ENABLED !== "true") return null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tmpl = process.env.BORIS_ENDPOINT_URL;
  if (!tmpl) return null;
  const url = tmpl.replace("{lat}", String(lat)).replace("{lng}", String(lng));
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { brw?: number; stichtag?: string };
    if (data?.brw == null || !Number.isFinite(data.brw)) return null;
    return { wert: data.brw, stichtag: data.stichtag ?? null, quelle: "BORIS" };
  } catch {
    return null;
  }
}
