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
  /** Nur Portfolio: kürzestes Fenster der Objekte, wenn sie verschieden lang sind. */
  monateMin?: number;
};

// KOSTEN, DIE SCHON IN DER KREDITRATE STECKEN (30.09.2026).
//
// Die Anlage V rät, gezahlte Zinsen als Kosten der Kategorie „Schuldzinsen"
// zu buchen — dann gelten die gebuchten statt geschätzter Zinsen. Der
// Monats-Cashflow zieht aber die volle Kreditrate ab, und die ENTHÄLT die
// Zinsen. Ohne diesen Filter wurden sie zweimal abgezogen. Eingetreten war das
// noch nicht (live: keine einzige Schuldzinsen-Buchung) — es wäre beim ersten
// Nutzer passiert, der dem Rat der Anlage V folgt.
export const IN_KREDITRATE_ENTHALTEN = ["Schuldzinsen"] as const;

/** Kostenbuchungen ohne die, die bereits über die Kreditrate abgezogen werden. */
export function laufendeKosten<T extends { kategorie?: string | null }>(kosten: T[]): T[] {
  return kosten.filter((k) => !(IN_KREDITRATE_ENTHALTEN as readonly string[]).includes(k.kategorie ?? ""));
}

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

// WARMMIETE STATT KALTMIETE (Entscheidung des Betreibers, 30.09.2026).
//
// Bis dahin zählte die Formel nur die KALTmiete als Einnahme, zog aber ALLE
// Kosten ab — auch umlagefähiges Hausgeld, Grundsteuer, Versicherung, die die
// Mieter über die NK-Vorauszahlung erstatten. Der Cashflow war dadurch
// systematisch zu schlecht (Demo: 4 von 6 Objekten rot, +518 € statt +1.548 €).
// Liquidität ist, was aufs Konto kommt, minus was abgeht — also Warmmiete.
//
// DIE STEUER BERÜHRT DAS NICHT: Die Anlage V rechnet aus den BUCHUNGEN
// (lib/anlageV.ts: Kaltmiete = Betrag − nk_anteil → Zeile 9, nk_anteil →
// Zeile 13 Umlagen), dieser Cashflow aus den VERTRÄGEN. Bruttorendite und
// Kaufpreisfaktor bleiben ebenfalls kalt — das ist dort die Marktkonvention.
//
// Nicht enthalten: Stellplatzmieten außerhalb von Garagen-Objekten (ob sie im
// Objektfeld „Miete" schon stecken, ist nicht feststellbar — lieber zu wenig
// als doppelt) und NK-Nachzahlungen/-Erstattungen (einmal jährlich, stehen in
// den Buchungen, nicht in den Verträgen).

export type MieterNk = { nk_vorauszahlung: number | string | null; mietbeginn: string | null; mietende: string | null };

/** Summe der NK-Vorauszahlungen aller Mieter, deren Vertrag heute läuft. */
export function nkVorauszahlungenMonat(mieter: MieterNk[], heuteIso: string): number {
  const heute = /^\d{4}-\d{2}-\d{2}/.exec(heuteIso)?.[0];
  if (!heute) return 0;
  return mieter.reduce((s, m) => {
    const beginn = (m.mietbeginn ?? "").slice(0, 10);
    const ende = (m.mietende ?? "").slice(0, 10);
    if (beginn && beginn > heute) return s; // zieht erst noch ein
    if (ende && ende < heute) return s;     // ist ausgezogen
    const nk = Number(m.nk_vorauszahlung);
    return Number.isFinite(nk) && nk > 0 ? s + nk : s;
  }, 0);
}

/** Warmmiete − Kreditraten − Ø laufende Kosten, je Monat. */
export function monatsCashflow(teile: { warmmiete: number; kreditraten: number; kostenSchnitt: number }): number {
  return teile.warmmiete - teile.kreditraten - teile.kostenSchnitt;
}

/** Die Formel als Text — steht an jeder Stelle, die die Zahl zeigt. */
export function cashflowFormel(schnitt: KostenSchnitt): string {
  if (schnitt.monate === 0) return "Warmmiete − Kreditraten (noch keine Kosten gebucht)";
  if (schnitt.monateMin != null && schnitt.monateMin !== schnitt.monate) {
    return `Warmmiete − Kreditraten − Ø Kosten (je Objekt ${schnitt.monateMin}–${schnitt.monate} Monate)`;
  }
  const fenster = schnitt.monate === 1 ? "1 Monat" : `${schnitt.monate} Monate`;
  return `Warmmiete − Kreditraten − Ø Kosten (${fenster})`;
}

// JE OBJEKT RECHNEN, DAS DASHBOARD SUMMIERT (Gesamtprüfung P8, 09.10.2026, B25 + C17).
//
// Bis dahin bildete das Dashboard EIN Kostenfenster über alle Buchungen, die Objektseite je Objekt
// eines. Ein Zukauf mit drei Monaten Kosten wurde auf dem Dashboard durch zwölf geteilt — der
// Cashflow war bis zu elf Monate lang zu gut (Beispiel: 100 € + 300 € je Monat → 175 € statt 400 €).
// Und gerundet wurde an verschiedenen Stellen: Σ Objekt-Cashflows 1.547 €, Dashboard 1.548 €.
//
// Jetzt hat jedes Objekt sein Fenster (dieselbe Rechnung wie auf seiner Seite), und JEDER Teil wird
// je Objekt auf ganze Euro gerundet, BEVOR summiert wird — so ergeben die angezeigten Zahlen der
// Objektseiten zusammen genau das Dashboard, und auf dem Dashboard bleibt
// Warmmiete − Kosten = Cashflow nachrechenbar. Was keinem Objekt gehört (Kosten oder Darlehen ohne
// Objekt), steht als eigener Posten „ohne Objekt“ im Dashboard und mit dem Fenster ALLER Buchungen.

export type KostenBuchung = Buchung & { kategorie?: string | null };

export type MonatsTeile = {
  kaltmiete: number;
  nk: number;
  warmmiete: number;
  raten: number;
  /** Ø laufende Kosten je Monat, ganze Euro. */
  kosten: number;
  schnitt: KostenSchnitt;
  cashflow: number;
};

/** Monatsrechnung EINES Objekts (oder des Postens „ohne Objekt“), alle Teile ganze Euro. */
export function objektMonat(e: {
  kaltmiete: number;
  nk: number;
  raten: number;
  kosten: KostenBuchung[];
  einnahmen: Buchung[];
  heuteIso: string;
}): MonatsTeile {
  const schnitt = kostenSchnittMonat(laufendeKosten(e.kosten), [...e.einnahmen, ...e.kosten], e.heuteIso);
  const kaltmiete = Math.round(e.kaltmiete);
  const nk = Math.round(e.nk);
  const raten = Math.round(e.raten);
  const kosten = Math.round(schnitt.betrag);
  const warmmiete = kaltmiete + nk;
  return { kaltmiete, nk, warmmiete, raten, kosten, schnitt, cashflow: monatsCashflow({ warmmiete, kreditraten: raten, kostenSchnitt: kosten }) };
}

/** Summe der Objekte (+ Posten ohne Objekt) — die Zahlen des Dashboards. */
export function portfolioMonat(teile: MonatsTeile[]): MonatsTeile {
  const sum = (f: (t: MonatsTeile) => number) => teile.reduce((s, t) => s + f(t), 0);
  const fenster = teile.map((t) => t.schnitt.monate).filter((m) => m > 0);
  const max = fenster.length ? Math.max(...fenster) : 0;
  const min = fenster.length ? Math.min(...fenster) : 0;
  return {
    kaltmiete: sum((t) => t.kaltmiete),
    nk: sum((t) => t.nk),
    warmmiete: sum((t) => t.warmmiete),
    raten: sum((t) => t.raten),
    kosten: sum((t) => t.kosten),
    schnitt: { betrag: sum((t) => t.kosten), monate: max, ...(min !== max ? { monateMin: min } : {}) },
    cashflow: sum((t) => t.cashflow),
  };
}
