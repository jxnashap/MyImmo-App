// Monatlicher Cashflow — EINE Rechnung für Dashboard und Objektseite.
//
// WARUM ES DIESE DATEI GIBT (Phase 4 nach dem externen Review, 30.09.2026)
//
// 1. Vier Zahlen hießen „Cashflow", und niemand sagte, welche Frage sie
//    beantworten. Das Review hielt sie für widersprüchlich. Sie waren es
//    nicht — aber eine Finanz-App, deren Zahlen man für widersprüchlich hält,
//    hat das Vertrauen schon verloren. Jede Anzeige nennt jetzt ihre Formel.
//
// 2. Die Objektseite rechnete „Miete − Kreditrate" OHNE laufende Kosten,
//    während die Übersicht darunter auf derselben Seite die Kosten als
//    eigenen Posten führte. Die Summe der Objekte ergab nicht das Dashboard.
//    Jetzt rechnen beide dieselbe Formel.
//
// 3. DER SCHNITT SCHÖNTE SICH SELBST. Bisher: Kosten der letzten 12 Monate
//    geteilt durch 12 — egal, wie lange schon gebucht wird. Wer vor drei
//    Monaten angefangen hat, sah ein Viertel seiner Kosten und einen viel zu
//    guten Cashflow. Wer ein paar Monate nichts gebucht hat, ebenso; in der
//    Demo sank der Schnitt dadurch von 1.006 € auf 629 € (gemessen).
//    Jetzt: das Fenster sind die letzten 12 Monate MIT BUCHUNGEN — es endet
//    am letzten gebuchten Monat und beginnt nicht vor dem ersten — und
//    geteilt wird durch die Zahl der Monate, die es tatsächlich umfasst.
//
// Bewusst NICHT gelöst: Lücken MITTEN im Zeitraum (ein Nutzer bucht drei
// Monate lang nichts und macht dann weiter). Dort bleibt der Schnitt zu
// niedrig. Monate ohne Kostenbuchung einfach wegzulassen wäre falsch:
// Grundsteuer und Versicherung fallen nur in einzelnen Monaten an, der
// Schnitt würde dann zu HOCH.
//
// Datumsrechnung auf den Zahlen des ISO-Datums, nie über `Date` mit
// Ortszeit — dieselbe Regel wie bei `naechsteFaelligkeit` (CLAUDE.md).

export type Buchung = { buchungsdatum: string | null; betrag: number | null };

/** Laufende Monatsnummer aus "YYYY-MM-…" (Jahr × 12 + Monat − 1), sonst null. */
function monatsIndex(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const monat = Number(m[2]);
  if (monat < 1 || monat > 12) return null;
  return Number(m[1]) * 12 + (monat - 1);
}

export type KostenSchnitt = {
  /** Durchschnittliche Kosten je Monat im Fenster. */
  betrag: number;
  /** Wie viele Monate das Fenster umfasst (0 = keine Buchungen). */
  monate: number;
};

/**
 * Durchschnittliche laufende Kosten je Monat.
 *
 * @param kosten   Kostenbuchungen (Betrag positiv).
 * @param alle     ALLE Buchungen, die den erfassten Zeitraum bestimmen —
 *                 Einnahmen UND Kosten. Wer nur Mieten bucht, hat trotzdem
 *                 einen Zeitraum, in dem eben keine Kosten anfielen.
 * @param heuteIso "YYYY-MM-DD"; Buchungen danach zählen nicht.
 */
export function kostenSchnittMonat(
  kosten: Buchung[],
  alle: Buchung[],
  heuteIso: string,
): KostenSchnitt {
  const heute = monatsIndex(heuteIso);
  if (heute == null) return { betrag: 0, monate: 0 };

  const monate = alle
    .map((b) => monatsIndex(b.buchungsdatum))
    .filter((m): m is number => m != null && m <= heute);
  if (monate.length === 0) return { betrag: 0, monate: 0 };

  const ende = Math.max(...monate);
  const anfang = Math.max(Math.min(...monate), ende - 11);
  const anzahl = ende - anfang + 1;

  const summe = kosten.reduce((s, k) => {
    const m = monatsIndex(k.buchungsdatum);
    return m != null && m >= anfang && m <= ende ? s + (k.betrag ?? 0) : s;
  }, 0);

  return { betrag: summe / anzahl, monate: anzahl };
}

/** Kaltmiete − Kreditraten − Ø laufende Kosten, je Monat. */
export function monatsCashflow(teile: { miete: number; kreditraten: number; kostenSchnitt: number }): number {
  return teile.miete - teile.kreditraten - teile.kostenSchnitt;
}

/** Die Formel als Text — steht an jeder Stelle, die die Zahl zeigt. */
export function cashflowFormel(schnitt: KostenSchnitt): string {
  if (schnitt.monate === 0) return "Kaltmiete − Kreditraten (noch keine Kosten gebucht)";
  const fenster = schnitt.monate === 1 ? "1 Monat" : `${schnitt.monate} Monate`;
  return `Kaltmiete − Kreditraten − Ø Kosten (${fenster})`;
}
