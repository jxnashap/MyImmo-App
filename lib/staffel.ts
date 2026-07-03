// Staffelmiete: Plan der vereinbarten Stufen im Voraus berechnen.
// Wahlweise fester Erhöhungsbetrag ODER Prozentsatz je Stufe — der Prozentsatz
// wird jeweils auf die aktuelle (zuletzt erhöhte) Miete gerechnet (Zinseszins-
// Prinzip: 500 → +3 % → 515,00 → 530,45 → …).
//
// Rechtlicher Rahmen (§ 557a BGB): Vertraglich müssen konkrete Euro-Beträge
// vereinbart sein — die Prozent-Angabe hier ist nur eine Rechenhilfe, angezeigt
// werden immer die konkreten Beträge.

export type StaffelStufe = {
  datum: string; // ISO (YYYY-MM-DD)
  miete: number; // neue Kaltmiete ab diesem Datum
  delta: number; // Erhöhung gegenüber der vorherigen Stufe
};

const iso = (d: Date) => d.toISOString().split("T")[0];

// Monate addieren OHNE Tag-Rollover (wie lib/fristen.ts):
// 31.03. + 11 Monate → 28./29.02., nicht 03.03.
function addMonate(d: Date, monate: number): Date {
  const r = new Date(d);
  const tag = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + monate);
  const letzterTag = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(tag, letzterTag));
  return r;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function staffelPlan(p: {
  startMiete: number;
  startDatum: string; // Datum der ersten Stufe
  intervallMonate: number;
  typ: "betrag" | "prozent";
  betrag?: number | null;
  prozent?: number | null;
  stufen: number;
}): StaffelStufe[] {
  const intervall = p.intervallMonate > 0 ? p.intervallMonate : 12;
  const stufen = p.stufen > 0 ? p.stufen : 5;
  const start = new Date(p.startDatum);
  if (Number.isNaN(start.getTime()) || p.startMiete <= 0) return [];
  if (p.typ === "prozent" ? !(p.prozent && p.prozent > 0) : !(p.betrag && p.betrag > 0)) return [];

  const plan: StaffelStufe[] = [];
  let prev = p.startMiete;
  for (let i = 1; i <= stufen; i++) {
    const datum = iso(addMonate(start, (i - 1) * intervall));
    const neu =
      p.typ === "prozent"
        ? round2(prev * (1 + (p.prozent ?? 0) / 100))
        : round2(prev + (p.betrag ?? 0));
    plan.push({ datum, miete: neu, delta: round2(neu - prev) });
    prev = neu;
  }
  return plan;
}
