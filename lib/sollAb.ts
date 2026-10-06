// „Miete ab Monat X“ — Verknüpfungs-Audit 06.10.2026, Paket B.
//
// Vorher überschrieb eine Mieterhöhung im Mieterformular `kaltmiete`/`nk_vorauszahlung`
// am Mieter. Ohne Miet-Zeitraum nimmt `sollFuerMonat` diese Felder für ALLE Monate — die
// Nacherfassung, der Rückstands-Wächter und die NK-Vorauszahlungen rechneten danach
// rückwirkend mit der neuen Miete. Ebenso endeten Staffel und § 560-Anpassung in einem
// Brief bzw. einer Erinnerung, das Soll blieb alt.
//
// Diese Datei plant, was in `miet_zeitraeume` geschrieben werden muss, damit eine Änderung
// erst AB einem Monat gilt und die Vergangenheit bleibt, wie sie war. Rein, ohne Datenbank.

import { vertragswerte, ymPlus, zuJahrMonat, type MietkontoZeitraum } from "@/lib/mietkonto";

export type Betraege = { kaltmiete: number | null; nk_vorauszahlung: number | null; stellplatz_miete: number | null };
export type ZeitraumZeile = MietkontoZeitraum & { id: string };

export type MietaenderungsPlan = {
  /** Lücken vor dem Stichmonat — neue Zeilen mit den ALTEN Beträgen (von/bis YYYY-MM-01). */
  luecken: (Betraege & { von: string; bis: string })[];
  /** Neuer Zeitraum ab dem Stichmonat (null, wenn `ersetzen` greift). */
  neu: (Betraege & { von: string; bis: string | null }) | null;
  /** Bestehende Zeilen, deren `bis` gesetzt wird (sie enden vor dem Stichmonat). */
  beenden: { id: string; bis: string }[];
  /** Bestehende Zeile, die genau im Stichmonat beginnt — bekommt die neuen Beträge. */
  ersetzen: { id: string; betraege: Betraege } | null;
};

const zahl = (v: unknown) => (v == null || v === "" ? null : Number(v));
// Leer und 0 sind gleich: Beide ergeben im Mietkonto 0 €.
const gleich = (a: unknown, b: unknown) => Math.abs((zahl(a) ?? 0) - (zahl(b) ?? 0)) < 0.005;

/** Haben sich Kaltmiete, NK-Vorauszahlung oder Stellplatzmiete geändert? */
export function betraegeGeaendert(alt: Betraege, neu: Betraege): boolean {
  return !gleich(alt.kaltmiete, neu.kaltmiete) || !gleich(alt.nk_vorauszahlung, neu.nk_vorauszahlung) || !gleich(alt.stellplatz_miete, neu.stellplatz_miete);
}

/**
 * Muss gefragt werden, AB WANN eine Betragsänderung gilt? Nur, wenn es schon Monate gibt,
 * für die das Mietkonto ein Soll kennt (Mietbeginn vor dem laufenden Monat). Bei einem
 * künftigen oder fehlenden Mietbeginn ist jede Änderung eine Korrektur.
 */
export function abWannFragen(mietbeginn: string | null, alt: Betraege, neu: Betraege, aktuellerMonat: string): boolean {
  const b = zuJahrMonat(mietbeginn);
  return !!b && b < aktuellerMonat && betraegeGeaendert(alt, neu);
}

/**
 * Plan für „neue Beträge ab `abYm`“.
 *
 * 1. Monate zwischen Mietbeginn und dem Vormonat von `abYm`, die KEIN Zeitraum abdeckt,
 *    rechneten bisher mit den Feldern am Mieter → sie bekommen einen Zeitraum mit den
 *    ALTEN Feldwerten (sonst gälte die neue Miete dort rückwirkend, sobald das Feld sich ändert).
 * 2. Zeiträume, die über `abYm` hinaus laufen und vorher begonnen haben, enden im Vormonat.
 * 3. Ab `abYm` gilt ein Zeitraum mit den neuen Beträgen — bis zum Vormonat des nächsten
 *    schon geplanten Zeitraums (z. B. einer späteren Staffelstufe), sonst offen.
 *    Beginnt schon ein Zeitraum genau in `abYm`, bekommt er die neuen Beträge.
 *
 * `abYm` am oder vor dem Mietbeginn heißt: Korrektur seit Beginn → leerer Plan.
 */
export function planeMietaenderung(args: {
  mietbeginn: string | null;
  alt: Betraege;
  neu: Betraege;
  zeitraeume: ZeitraumZeile[];
  abYm: string;
}): MietaenderungsPlan {
  const plan: MietaenderungsPlan = { luecken: [], neu: null, beenden: [], ersetzen: null };
  const beginn = zuJahrMonat(args.mietbeginn);
  if (!beginn || !/^\d{4}-\d{2}$/.test(args.abYm) || args.abYm <= beginn) return plan;

  const ab = `${args.abYm}-01`;
  const vormonat = `${ymPlus(args.abYm, -1)}-01`;
  const zr = [...args.zeitraeume].sort((a, b) => a.von.localeCompare(b.von));

  // 1. Lücken vor dem Stichmonat mit den alten Feldwerten schließen.
  const gedeckt = (ym: string) => {
    const m = `${ym}-01`;
    return zr.some((z) => z.von <= m && (z.bis == null || z.bis >= m));
  };
  let start: string | null = null;
  for (let ym = beginn; ym < args.abYm; ym = ymPlus(ym, 1)) {
    if (!gedeckt(ym)) {
      if (!start) start = ym;
    } else if (start) {
      plan.luecken.push({ ...args.alt, von: `${start}-01`, bis: `${ymPlus(ym, -1)}-01` });
      start = null;
    }
  }
  if (start) plan.luecken.push({ ...args.alt, von: `${start}-01`, bis: vormonat });

  // 2. Laufende Zeiträume vor dem Stichmonat beenden.
  for (const z of zr) {
    if (z.von < ab && (z.bis == null || z.bis >= ab)) plan.beenden.push({ id: z.id, bis: vormonat });
  }

  // 3. Neuer Zeitraum ab dem Stichmonat.
  const genau = zr.find((z) => z.von === ab);
  if (genau) {
    plan.ersetzen = { id: genau.id, betraege: args.neu };
  } else {
    const naechster = zr.find((z) => z.von > ab);
    plan.neu = { ...args.neu, von: ab, bis: naechster ? `${ymPlus(naechster.von.slice(0, 7), -1)}-01` : null };
  }
  return plan;
}

/**
 * Mieterzeilen mit den Beträgen, die im Monat `ym` gelten (`vertragswerte`, Zeitraum vor
 * Mieterfeld). Für alles, was „aktuelle Miete“ zeigt — Dashboard, Objektseite, Objektliste,
 * Briefe —, damit es dieselbe Zahl ist wie im Mietkonto. Zeiträume anderer Mieter stören nicht.
 */
export function mitGeltendenBetraegen<T extends { id: string } & Partial<Betraege>>(
  mieter: T[],
  zeitraeume: (MietkontoZeitraum & { mieter_id: string })[],
  ym: string,
): T[] {
  return mieter.map((m) => {
    const eigene = zeitraeume.filter((z) => z.mieter_id === m.id);
    if (eigene.length === 0) return m;
    const w = vertragswerte(
      { kaltmiete: m.kaltmiete ?? null, nk_vorauszahlung: m.nk_vorauszahlung ?? null, stellplatz_miete: m.stellplatz_miete ?? null },
      eigene,
      ym,
    );
    return { ...m, kaltmiete: w.kaltmiete, nk_vorauszahlung: w.nk, stellplatz_miete: w.stellplatz };
  });
}
