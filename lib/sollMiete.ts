// Soll-Kaltmiete eines Objekts — EINE Regel für Dashboard, Objektseite und
// Objektliste.
//
// WARUM (30.09.2026, Prüfung der echten Konten nach der Demo-Runde):
// Dashboard und Objektseite nahmen das Objektfeld „Miete", das Mietkonto die
// Kaltmieten der Mieter. Bei 6 von 23 echten Objekten wichen beide ab. Gegen
// die tatsächlich gebuchten Mieten geprüft: 3× stimmten die Mieter, 0× das
// Objektfeld; einmal war das Objektfeld leer, das Dashboard zählte 0 €,
// obwohl jeden Monat Miete einging. Das Objektfeld veraltet, die Mieter werden
// gepflegt.
//
// Die Regel:
//   laufende Mieter vorhanden  → Summe ihrer Kaltmieten (wie das Mietkonto)
//   nur beendete/künftige      → 0 (vorher „Phantom-Soll": Die Wohnung stand
//                                  als vermietet mit Miete da, niemand zahlte)
//   gar keine Mieter angelegt  → Objektfeld (wer ohne Mieterverwaltung
//                                  arbeitet, behält seine Zahl)
// Garagen-Objekte zählen zusätzlich die Stellplatzmiete — dort steckt die
// Miete je Einheit auf dem Mieter (wie bisher).
//
// Weichen Objektfeld und Mieter ab, wird NICHT still umgestellt, sondern
// `abweichung` gesetzt: Die Objektseite zeigt beide Zahlen. Ein Mehrfamilien-
// haus, bei dem nur ein Teil der Mieter angelegt ist, verlöre sonst ohne
// Hinweis Miete (echter Fall: Objektfeld 2.080 €, Mieter zusammen 780 €).

export const GARAGEN_TYPEN = ["Garage / Stellplatz", "Garagenkomplex"];

export type SollObjekt = { id: string; typ?: string | null; miete?: number | null };
export type SollMieter = {
  prop_id: string | null;
  kaltmiete?: number | string | null;
  stellplatz_miete?: number | string | null;
  mietbeginn?: string | null;
  mietende?: string | null;
};

export type SollMiete = {
  betrag: number;
  quelle: "mieter" | "objekt" | "beendet";
  /** Objektfeld und Mieter-Summe weichen um mehr als 1 € ab (nur bei quelle „mieter"). */
  abweichung: { objekt: number; mieter: number } | null;
};

const zahl = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Läuft der Vertrag am Stichtag? Datumsvergleich auf ISO-Text, ohne Zeitzone. */
export function laeuftAm(m: { mietbeginn?: string | null; mietende?: string | null }, heuteIso: string): boolean {
  const heute = heuteIso.slice(0, 10);
  const beginn = (m.mietbeginn ?? "").slice(0, 10);
  const ende = (m.mietende ?? "").slice(0, 10);
  if (beginn && beginn > heute) return false;
  if (ende && ende < heute) return false;
  return true;
}

export function sollKaltmiete(objekt: SollObjekt, alleMieter: SollMieter[], heuteIso: string): SollMiete {
  const eigene = alleMieter.filter((m) => m.prop_id === objekt.id);
  const objektFeld = zahl(objekt.miete);
  if (eigene.length === 0) return { betrag: objektFeld, quelle: "objekt", abweichung: null };

  const laufend = eigene.filter((m) => laeuftAm(m, heuteIso));
  if (laufend.length === 0) return { betrag: 0, quelle: "beendet", abweichung: null };

  const garage = GARAGEN_TYPEN.includes(objekt.typ ?? "");
  const summe = laufend.reduce((s, m) => s + zahl(m.kaltmiete) + (garage ? zahl(m.stellplatz_miete) : 0), 0);
  const abweichung = objektFeld > 0 && Math.abs(objektFeld - summe) > 1 ? { objekt: objektFeld, mieter: summe } : null;
  return { betrag: summe, quelle: "mieter", abweichung };
}
