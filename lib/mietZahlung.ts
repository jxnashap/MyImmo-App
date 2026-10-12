// Mietzahlungen zuordnen — Soll, Zahlung, Rest, Überzahlung getrennt (B09/B10, Prüfstand 11.10.2026).
//
// VORHER (lib/actions/mietkonto.ts bis 11.10.2026):
//   · Jede weitere Zahlung in einem Monat, in dem schon IRGENDETWAS gebucht war, wurde verworfen —
//     eine legitime zweite Teilzahlung ließ sich nicht buchen („bereits gebucht“).
//   · Beim Kontoauszug-Abgleich kam der Nebenkostenanteil aus dem Browser, berechnet für den
//     ZUERST erkannten Monat. Wählte der Vermieter einen anderen Monat, wurde der alte Anteil mit dem
//     neuen Monat gespeichert (Anlage V und NK-Abrechnung trennen Miete und Umlagen nach ihm).
//
// JETZT rechnet der SERVER mit dieser Datei — aus Vertrag (`sollFuerMonat`, inkl. Miet-Zeiträumen,
// Mietminderung, Teilmonat) und den bereits gebuchten Zahlungen des Monats.
//
// ENTSCHEIDUNG (offen zur Bestätigung durch den Betreiber): Der NK-Anteil einer Teilzahlung ist
// ANTEILIG — Vorauszahlung × Zahlung / Gesamtsoll, höchstens die noch nicht gedeckte Vorauszahlung.
// Bestimmt der Mieter die Zahlung ausdrücklich anders, trägt der Vermieter den Anteil von Hand ein.
// Diese Datei behauptet keine Rechtsregel zur Tilgungsreihenfolge.

import { sollFuerMonat, ymPlus, zuJahrMonat, type MietkontoMieter, type MietkontoZeitraum, type SollMiete } from "@/lib/mietkonto";
import { TEILZAHLUNG_TOLERANZ } from "@/lib/mietStatus";

const rund2 = (x: number) => Math.round(x * 100) / 100;

export type GebuchteMiete = {
  soll_monat: string | null;
  buchungsdatum: string;
  betrag: number | null;
  nk_anteil: number | null;
};

export type MonatsStand = {
  jahrMonat: string;
  soll: SollMiete | null;
  /** Summe der gebuchten Zahlungen für diesen Mietmonat. */
  gezahlt: number;
  /** Davon als Nebenkosten-Vorauszahlung gebucht. */
  nkGezahlt: number;
  /** Soll − gezahlt; negativ = Überzahlung. */
  rest: number;
};

export function monatsStand(
  mieter: MietkontoMieter,
  zeitraeume: MietkontoZeitraum[],
  buchungen: GebuchteMiete[],
  jahrMonat: string,
): MonatsStand {
  const soll = sollFuerMonat(mieter, zeitraeume, jahrMonat);
  let gezahlt = 0;
  let nkGezahlt = 0;
  for (const b of buchungen) {
    if ((b.soll_monat ?? zuJahrMonat(b.buchungsdatum)) !== jahrMonat) continue;
    gezahlt += Number(b.betrag) || 0;
    nkGezahlt += Number(b.nk_anteil) || 0;
  }
  gezahlt = rund2(gezahlt);
  nkGezahlt = rund2(nkGezahlt);
  return { jahrMonat, soll, gezahlt, nkGezahlt, rest: rund2((soll?.gesamt ?? 0) - gezahlt) };
}

/** Ist der Monat (bis auf die Toleranz) bezahlt? */
export const monatBezahlt = (s: MonatsStand) => s.soll != null && s.rest <= TEILZAHLUNG_TOLERANZ;

/**
 * NK-Anteil einer Zahlung für DIESEN Monat: anteilig zur Vorauszahlung, nie mehr als die noch offene
 * Vorauszahlung des Monats. `null`, wenn der Vertrag keine Vorauszahlung vorsieht.
 */
export function nkAnteilFuer(stand: MonatsStand, betrag: number): number | null {
  const soll = stand.soll;
  if (!soll || soll.nk <= 0 || soll.gesamt <= 0) return null;
  const anteilig = rund2(soll.nk * Math.min(1, Math.max(0, betrag) / soll.gesamt));
  const frei = rund2(Math.max(0, soll.nk - stand.nkGezahlt));
  return Math.min(anteilig, frei);
}

export type Teil = { jahrMonat: string; betrag: number; nk: number | null };
export type Verteilung = { teile: Teil[]; ueberzahlung: number };

/**
 * Verteilt EINE Zahlung (z. B. aus dem Kontoauszug) ab `startMonat` auf offene Monate bis `bisMonat`:
 * zuerst der Rest des Startmonats, ein Überschuss auf die folgenden offenen Monate (Sammelzahlung).
 * Was danach übrig bleibt, ist Überzahlung — sie wird dem letzten Teil zugeschlagen (das Geld ist
 * eingegangen) und gesondert ausgewiesen. Monate vor dem Startmonat werden nie angefasst.
 */
export function verteileZahlung(
  betrag: number,
  startMonat: string,
  bisMonat: string,
  standFuer: (jahrMonat: string) => MonatsStand,
): Verteilung {
  const teile: Teil[] = [];
  let uebrig = rund2(betrag);
  const ende = bisMonat < startMonat ? startMonat : bisMonat;
  for (let ym = startMonat; ym <= ende && uebrig > TEILZAHLUNG_TOLERANZ; ym = ymPlus(ym, 1)) {
    const s = standFuer(ym);
    const offen = s.soll ? Math.max(0, s.rest) : 0;
    if (offen <= TEILZAHLUNG_TOLERANZ) continue;
    // Bleibt nach dem Ausgleich nur ein Rest bis zur Toleranz übrig, gehört er zu diesem Monat.
    const anteil = uebrig - offen <= TEILZAHLUNG_TOLERANZ ? uebrig : rund2(offen);
    teile.push({ jahrMonat: ym, betrag: rund2(anteil), nk: nkAnteilFuer(s, anteil) });
    uebrig = rund2(uebrig - anteil);
  }
  let ueberzahlung = 0;
  if (uebrig > 0.004) {
    ueberzahlung = uebrig;
    if (teile.length > 0) {
      const letzt = teile[teile.length - 1];
      letzt.betrag = rund2(letzt.betrag + uebrig);
    } else {
      const s = standFuer(startMonat);
      teile.push({ jahrMonat: startMonat, betrag: uebrig, nk: nkAnteilFuer(s, uebrig) });
    }
  }
  return { teile, ueberzahlung };
}
