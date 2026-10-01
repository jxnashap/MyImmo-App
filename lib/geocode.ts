// Die EINE Verortung (Adresse → lat/lng) für Karte, Bewertung und Wert-Cron,
// über Nominatim (OpenStreetMap). Neu gefasst 01.10.2026, nachdem nur 7 von 23
// echten Objekten auf der Karte standen.
//
// Was vorher schiefging (gemessen, nicht vermutet):
//   - Nominatim antwortet unter Last mit 429 „Too many requests". Das wurde wie
//     „Adresse nicht gefunden" behandelt — und beim nächsten Aufruf dieselbe
//     Anfrage wiederholt. Die Nutzungsregeln sagen wörtlich: „Clients sending
//     repeatedly the same query may be classified as faulty and blocked."
//   - Die Karte versuchte je Aufruf drei Objekte, immer in derselben
//     Reihenfolge — dauerhaft scheiternde Adressen blockierten alle dahinter.
//   - Ein Zusatz wie „(EG)" oder „Whg. 3" lässt die Freitextsuche leer laufen.
//   - Drei Stellen verorteten unabhängig, in zwei Spaltenpaare (lat/lng und
//     latitude/longitude) — dieselbe Adresse ging bis zu dreimal hinaus.
//
// Jetzt: Ergebnis wird gemerkt (`geo_status`), „nicht gefunden" erst nach einer
// Adressänderung erneut versucht, „gedrosselt" frühestens nach einer Pause.
// Nominatim-Regeln: eigener User-Agent, höchstens 1 Anfrage/Sekunde, Ergebnisse
// cachen. Übermittelt wird nur die Objektadresse.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MyImmo/1.0 (https://www.myimmoapp.de)";

export const GEOCODE_PAUSE_MS = 1100; // Nominatim-Policy: max. 1 req/s
/** Nach einer Drosselung (429/5xx/Netz) frühestens nach dieser Pause erneut. */
export const GEDROSSELT_PAUSE_MS = 6 * 60 * 60 * 1000;

export type GeoPunkt = { lat: number; lng: number };
export type GeoStatus = "ok" | "nicht_gefunden" | "gedrosselt";
export type GeoErgebnis =
  | { art: "treffer"; lat: number; lng: number }
  | { art: "leer" }
  | { art: "gedrosselt" };

/** Wohnungs-/Lagezusätze, die Nominatim nicht kennt — nur hinter einem Komma oder in Klammern. */
const ZUSATZ = /^(whg\.?|wohnung|we|app\.?|appartement|eg|og|dg|ug|hh|vh|hinterhaus|vorderhaus|seitenflügel|\d+\.\s*(og|etage|stock)|etage|stock|stellplatz|tg|garage|links|rechts|mitte)\b/i;

/** Adresse für die Suche säubern: Klammern raus, Lagezusätze raus, Leerraum glätten. */
export function bereinigeAdresse(adresse: string): string {
  const ohneKlammern = adresse.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  const teile = ohneKlammern
    .split(/[,;\n]/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t && !ZUSATZ.test(t));
  return teile.join(", ");
}

/** „Straße 12, 12345 Ort" → Teile für die strukturierte Suche; null, wenn keine PLZ erkennbar. */
export function zerlegeAdresse(adresse: string): { strasse: string | null; plz: string; ort: string } | null {
  const m = bereinigeAdresse(adresse).match(/^(?:(.*?)[,\s]+)?(\d{5})\s+([^,]+?)\s*(?:,.*)?$/);
  if (!m) return null;
  const strasse = m[1]?.replace(/,\s*$/, "").trim() || null;
  return { strasse, plz: m[2], ort: m[3].trim() };
}

async function frage(params: Record<string, string>): Promise<GeoErgebnis> {
  try {
    const qs = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "de", ...params });
    const res = await fetch(`${NOMINATIM}?${qs}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      // Kein Next-Cache: Das Ergebnis merkt sich die properties-Zeile.
      cache: "no-store",
    });
    // 429 und 5xx sind „später nochmal", nicht „gibt es nicht".
    if (res.status === 429 || res.status >= 500) return { art: "gedrosselt" };
    if (!res.ok) return { art: "leer" };
    const json = (await res.json()) as { lat?: string; lon?: string }[];
    const t = Array.isArray(json) ? json[0] : undefined;
    if (!t?.lat || !t?.lon) return { art: "leer" };
    const lat = parseFloat(t.lat);
    const lng = parseFloat(t.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { art: "leer" };
    return { art: "treffer", lat, lng };
  } catch {
    return { art: "gedrosselt" }; // Netz weg ist ebenfalls „später nochmal"
  }
}

/**
 * Höchstens zwei Anfragen: bereinigter Freitext, bei leerem Ergebnis die
 * strukturierte Suche (Straße/PLZ/Ort getrennt). Dazwischen die Pflichtpause.
 */
export async function geocodeAdresse(adresse: string, pause: (ms: number) => Promise<unknown> = warte): Promise<GeoErgebnis> {
  const q = bereinigeAdresse(adresse);
  if (q.length < 4) return { art: "leer" };
  const erst = await frage({ q });
  if (erst.art !== "leer") return erst;
  const teile = zerlegeAdresse(adresse);
  if (!teile?.strasse) return erst;
  await pause(GEOCODE_PAUSE_MS);
  return frage({ street: teile.strasse, postalcode: teile.plz, city: teile.ort });
}

function warte(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export type GeoZeile = {
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  latitude?: number | null;
  longitude?: number | null;
  geo_status?: string | null;
  geo_versucht_am?: string | null;
};

/** Gespeicherte Koordinaten — `lat/lng` zuerst, `latitude/longitude` als Altbestand. */
export function koordinaten(p: GeoZeile): GeoPunkt | null {
  const lat = p.lat ?? p.latitude ?? null;
  const lng = p.lng ?? p.longitude ?? null;
  return lat != null && lng != null ? { lat, lng } : null;
}

/** Darf (wieder) bei Nominatim gefragt werden? Reine Entscheidung — `jetzt` als Zahl (ms). */
export function sollVerorten(p: GeoZeile, jetzt: number): boolean {
  if (koordinaten(p)) return false;
  if (!p.adresse || bereinigeAdresse(p.adresse).length < 4) return false;
  // „Gibt es nicht" bleibt so, bis die Adresse sich ändert (das Speichern
  // setzt den Status zurück). Dieselbe Anfrage zu wiederholen verbietet die Policy.
  if (p.geo_status === "nicht_gefunden") return false;
  if (p.geo_status === "gedrosselt" && p.geo_versucht_am) {
    const zuletzt = Date.parse(p.geo_versucht_am);
    if (Number.isFinite(zuletzt) && jetzt - zuletzt < GEDROSSELT_PAUSE_MS) return false;
  }
  return true;
}

/** Spalten, die nach einer Verortung in die properties-Zeile gehören. */
export function geoAenderung(erg: GeoErgebnis, jetztIso: string): Record<string, unknown> {
  if (erg.art === "treffer") {
    return { lat: erg.lat, lng: erg.lng, latitude: erg.lat, longitude: erg.lng, geo_status: "ok", geo_versucht_am: jetztIso };
  }
  return { geo_status: erg.art === "leer" ? "nicht_gefunden" : "gedrosselt", geo_versucht_am: jetztIso };
}

/** Beim Speichern mit geänderter Adresse: alles vergessen, was zur alten gehörte. */
export const GEO_ZURUECKSETZEN = { lat: null, lng: null, latitude: null, longitude: null, geo_status: null, geo_versucht_am: null } as const;

export type KartenZeile = GeoZeile & { id: string; bezeichnung: string | null; typ: string | null; wert: number | null };
type Basis = { id: string; name: string; adresse: string; typ: string | null; wert: number | null };

/**
 * Ordnet die Objekte für die Karte: verortet (mit Punkt), offen (Browser darf
 * fragen), nicht gefunden, ohne Adresse, pausiert (nach Drosselung). Jedes
 * Objekt landet in GENAU einer Gruppe — die Seite sagt so für jedes, warum es
 * (noch) nicht auf der Karte ist.
 */
export function ordneFuerKarte(zeilen: KartenZeile[], jetzt: number = Date.now()) {
  const basis = (p: KartenZeile): Basis => ({
    id: p.id, name: p.bezeichnung || "Objekt", adresse: p.adresse ?? "", typ: p.typ, wert: p.wert,
  });
  const verortet: (Basis & GeoPunkt)[] = [];
  const offen: Basis[] = [];
  const nichtGefunden: { id: string; name: string }[] = [];
  const ohneAdresse: { id: string; name: string }[] = [];
  const pausiert: { id: string; name: string }[] = [];
  for (const p of zeilen) {
    const k = koordinaten(p);
    const b = basis(p);
    if (k) verortet.push({ ...b, ...k });
    else if (!p.adresse?.trim()) ohneAdresse.push({ id: b.id, name: b.name });
    else if (p.geo_status === "nicht_gefunden") nichtGefunden.push({ id: b.id, name: b.name });
    else if (sollVerorten(p, jetzt)) offen.push(b);
    else pausiert.push({ id: b.id, name: b.name });
  }
  return { verortet, offen, nichtGefunden, ohneAdresse, pausiert };
}
