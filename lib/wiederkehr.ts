// Wiederkehrende Buchungen: aus einer Vorlage (Zyklus + Zeitraum) die einzelnen
// Fälligkeitstermine als VORSCHLÄGE erzeugen — reine Funktionen ohne DB-Zugriff,
// gebucht wird an anderer Stelle. Rückwirkend gekappt auf 10 Jahre.
//
// § 11 EStG (Zufluss-/Abflussprinzip): steuerlich zählt der Tag der tatsächlichen
// Zahlung. Die erzeugten Daten sind Vorschläge auf Basis des Start-Zahltags und
// beim Buchen weiterhin editierbar. Keine Steuerberatung.

export const ZYKLEN = [
  "monatlich",
  "quartalsweise",
  "halbjaehrlich",
  "jaehrlich",
  "alle_2_jahre",
  "alle_3_jahre",
] as const;
export type Zyklus = (typeof ZYKLEN)[number];

export const ZYKLUS_LABEL: Record<Zyklus, string> = {
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  halbjaehrlich: "halbjährlich",
  jaehrlich: "jährlich",
  alle_2_jahre: "alle 2 Jahre",
  alle_3_jahre: "alle 3 Jahre",
};

export const ZYKLUS_MONATE: Record<Zyklus, number> = {
  monatlich: 1,
  quartalsweise: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
  alle_2_jahre: 24,
  alle_3_jahre: 36,
};

export type WiederkehrVorlage = {
  zyklus: string;
  start_datum: string; // YYYY-MM-DD
  ende_datum: string | null; // YYYY-MM-DD oder null = laufend
};

const istIsoDatum = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** ISO-Datum + n Monate, ohne Tag-Rollover (31.01. + 1 Mon. → 28./29.02.). */
export function addMonate(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number);
  const gesamt = (j * 12 + (m - 1)) + n;
  const jj = Math.floor(gesamt / 12);
  const mm = (gesamt % 12) + 1;
  const letzterTag = new Date(Date.UTC(jj, mm, 0)).getUTCDate();
  const tag = Math.min(t, letzterTag);
  return `${jj}-${String(mm).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/** heute (Date) → "YYYY-MM-DD" (lokale Zeit, wie die übrige App). */
export function heuteIso(heute: Date = new Date()): string {
  return `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}-${String(heute.getDate()).padStart(2, "0")}`;
}

/**
 * Fällige Termine einer Vorlage von start_datum bis min(heute, ende_datum),
 * je einschließlich, im gewählten Zyklus. Rückwirkend gekappt auf 10 Jahre
 * (Termine vor heute−10 Jahre werden übersprungen — der Start selbst darf
 * älter sein, es wird dann ab dem ersten Termin innerhalb der Kappung erzeugt).
 * `heute` ist nur für Tests übersteuerbar.
 */
export function faelligeDaten(v: WiederkehrVorlage, heute: Date = new Date()): string[] {
  const monate = ZYKLUS_MONATE[v.zyklus as Zyklus];
  if (!monate || !istIsoDatum(v.start_datum)) return [];

  const heuteS = heuteIso(heute);
  const zehnJahre = addMonate(heuteS, -120);
  const ende = v.ende_datum && istIsoDatum(v.ende_datum) ? v.ende_datum : heuteS;
  const bis = ende < heuteS ? ende : heuteS; // nie in die Zukunft erzeugen

  const daten: string[] = [];
  let d = v.start_datum;
  // Vor der Kappung liegende Termine überspringen (Zyklus beibehalten).
  let sicherung = 0;
  while (d <= bis && sicherung < 1500) {
    if (d >= zehnJahre) daten.push(d);
    d = addMonate(d, monate);
    sicherung++;
  }
  return daten;
}

/**
 * Aus den fälligen Terminen die noch OFFENEN ermitteln. Zählbasiert statt
 * datumsgenau: existieren zur Vorlage bereits n Buchungen, gelten die ersten
 * n fälligen Termine als gebucht — so erzeugt ein nachträglich umdatiertes
 * Buchungsdatum (§ 11 EStG, tatsächlicher Zufluss) keine Dublette, und eine
 * gelöschte Buchung wird beim nächsten Erzeugen wieder aufgefüllt.
 */
export function offeneDaten(faellig: string[], vorhandeneDaten: (string | null)[]): string[] {
  const anzahlGebucht = vorhandeneDaten.filter(Boolean).length;
  return faellig.slice(Math.min(anzahlGebucht, faellig.length));
}
