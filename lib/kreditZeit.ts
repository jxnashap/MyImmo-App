// Wann läuft ein Darlehen? (Gesamtprüfung 07.10.2026, B3 / Doppelberechnung 8.)
//
// Die Zinsschätzung der Anlage V rechnete Restschuld × Zins für JEDES Jahr — auch vor der
// Auszahlung und vor dem Kauf (Kauf 03/2026 → je 7.000 € Zinsen 2024 und 2025). Diese Funktion
// liefert die Monate, in denen das Darlehen im Jahr läuft: ab Auszahlung (ersatzweise Kaufdatum),
// bis zum Laufzeitende, wenn eines bekannt ist. Der Auszahlungsmonat zählt voll.

export type KreditZeitraumInput = {
  auszahlung_datum?: string | null;
  /** < 100 = Dauer in Jahren, ≥ 1900 = Endjahr (Altbestand, siehe lib/kreditLaufzeit.ts). */
  laufzeit?: number | null;
};

const ym = (iso: string | null | undefined): { j: number; m: number } | null => {
  const t = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  return t ? { j: Number(t[1]), m: Number(t[2]) } : null;
};

/** Monate (0–12), in denen das Darlehen im Jahr läuft. `ohneStart` = kein Datum bekannt, ganzjährig angenommen. */
export function kreditMonateImJahr(
  k: KreditZeitraumInput,
  jahr: number,
  ersatzStart?: string | null,
): { monate: number; ohneStart: boolean } {
  const start = ym(k.auszahlung_datum) ?? ym(ersatzStart);
  if (!start) return { monate: 12, ohneStart: true };
  if (jahr < start.j) return { monate: 0, ohneStart: false };
  const erster = jahr === start.j ? start.m : 1;

  let ende: { j: number; m: number } | null = null;
  const l = Number(k.laufzeit);
  if (Number.isFinite(l) && l >= 1900) ende = { j: Math.round(l), m: 12 };
  else if (Number.isFinite(l) && l > 0 && l < 100) {
    // Dauer ab Auszahlung: letzter Monat ist der Monat VOR dem Jahrestag.
    const j = start.j + Math.round(l);
    ende = start.m === 1 ? { j: j - 1, m: 12 } : { j, m: start.m - 1 };
  }
  if (ende && jahr > ende.j) return { monate: 0, ohneStart: false };
  const letzter = ende && jahr === ende.j ? ende.m : 12;
  return { monate: Math.max(0, letzter - erster + 1), ohneStart: false };
}
