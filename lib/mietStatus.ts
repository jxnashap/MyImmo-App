// EINE Regel für „wann ist die Miete fällig, wann überfällig, wann bezahlt“
// (Gesamtprüfung 07.10.2026, Paket P7: B7, B11, B13, Zusammenführung 10).
//
// Vorher drei Regeln für „überfällig“ (Dashboard ab dem 5. des Monats, Rückstands-Wächter mit
// Server-Ortszeit, Mahnung mit Berliner ISO-Datum), zwei Toleranzen für Teilzahlung (Vermieter 1 €,
// Portal 0,50 €) und eine Fälligkeit ohne Feiertage (Ostermontag als „dritter Werktag“).
// Reine Funktionen auf den ZAHLEN des ISO-Datums — keine Ortszeit (vgl. naechsteFaelligkeit).

/** Fehlbetrag, ab dem ein Monat als offen gilt (Rundung, Bankgebühr): offen ab 1,00 € Fehlbetrag. */
export const TEILZAHLUNG_TOLERANZ = 1;

const rund = (x: number) => Math.round(x * 100) / 100;

/** Gilt der Monat als bezahlt? Fehlbetrag unter 1,00 € = bezahlt. EINE Regel für Vermieter und Portal. */
export function mieteBezahlt(soll: number, gezahlt: number): boolean {
  return rund(soll - gezahlt) < TEILZAHLUNG_TOLERANZ;
}

const iso = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t)).toISOString().slice(0, 10);

/** Ostersonntag (Gaußsche Osterformel, gregorianisch). */
function ostersonntag(j: number): { m: number; t: number } {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  return { m: monat, t: ((h + l - 7 * m + 114) % 31) + 1 };
}

/**
 * Bundesweite gesetzliche Feiertage eines Jahres (ISO). Landesfeiertage (Heilige Drei Könige,
 * Fronleichnam, Reformationstag …) sind NICHT dabei — sie hängen am Bundesland; der Brief nennt sie
 * deshalb als Hinweis (`LANDESFEIERTAG_HINWEIS`). Seit 07.10.2026; vorher galt jeder Mo–Fr.
 */
export function bundesFeiertage(j: number): Set<string> {
  const o = ostersonntag(j);
  const plus = (n: number) => iso(j, o.m, o.t + n);
  return new Set([
    iso(j, 1, 1), plus(-2), plus(1), iso(j, 5, 1), plus(39), plus(50), iso(j, 10, 3), iso(j, 12, 25), iso(j, 12, 26),
  ]);
}

/** Werktag im Sinne der Mietzahlung: Mo–Fr, kein bundesweiter Feiertag (Samstag zählt nicht, BGH VIII ZR 129/09). */
export function istWerktag(isoDatum: string): boolean {
  const [j, m, t] = isoDatum.slice(0, 10).split("-").map(Number);
  const tag = new Date(Date.UTC(j, m - 1, t)).getUTCDay();
  if (tag === 0 || tag === 6) return false;
  return !bundesFeiertage(j).has(isoDatum.slice(0, 10));
}

/** 3. Werktag eines Monats (§ 556b Abs. 1 BGB) als ISO-Datum — ohne Sa/So und bundesweite Feiertage. */
export function dritterWerktag(jahrMonat: string): string {
  const [j, m] = jahrMonat.split("-").map(Number);
  let werktage = 0;
  for (let tag = 1; tag <= 31; tag++) {
    const d = iso(j, m, tag);
    if (d.slice(0, 7) !== jahrMonat) break;
    if (!istWerktag(d)) continue;
    werktage += 1;
    if (werktage === 3) return d;
  }
  return `${jahrMonat}-03`;
}

/** Erster Werktag ab einem Datum (Fristende auf Sa/So/Feiertag → nächster Werktag, § 193 BGB / § 108 Abs. 3 AO). */
export function naechsterWerktag(isoDatum: string): string {
  let d = isoDatum.slice(0, 10);
  for (let i = 0; i < 10 && !istWerktag(d); i++) {
    const [j, m, t] = d.split("-").map(Number);
    d = iso(j, m, t + 1);
  }
  return d;
}

export const LANDESFEIERTAG_HINWEIS =
  "Berücksichtigt sind die bundesweiten Feiertage. Gilt in Ihrem Bundesland zusätzlich ein Feiertag in diesem Zeitraum, verschiebt sich die Fälligkeit entsprechend.";

/** Tage zwischen zwei ISO-Daten (b − a), ohne Ortszeit. */
export function tageZwischen(a: string, b: string): number {
  const z = (s: string) => { const [j, m, t] = s.slice(0, 10).split("-").map(Number); return Date.UTC(j, m - 1, t); };
  return Math.round((z(b) - z(a)) / 86400000);
}

export type MietFaelligkeit = {
  faellig: string;
  /** nicht_faellig: vor dem 3. Werktag · faellig: am 3. Werktag · ueberfaellig: danach. */
  stand: "nicht_faellig" | "faellig" | "ueberfaellig";
  /** Tage nach der Fälligkeit (0 am Fälligkeitstag, negativ davor). */
  tage: number;
};

/** Stand der Miete eines Monats am Stichtag (Berliner ISO-Datum). EINE Regel für Dashboard, Wächter, Brief. */
export function mietFaelligkeit(jahrMonat: string, heuteISO: string): MietFaelligkeit {
  const faellig = dritterWerktag(jahrMonat);
  const tage = tageZwischen(faellig, heuteISO);
  return { faellig, tage, stand: tage < 0 ? "nicht_faellig" : tage === 0 ? "faellig" : "ueberfaellig" };
}

/** Überfällig = nach dem 3. Werktag (am Fälligkeitstag selbst ist nichts versäumt). */
export const mieteUeberfaellig = (jahrMonat: string, heuteISO: string) =>
  mietFaelligkeit(jahrMonat, heuteISO).stand === "ueberfaellig";
