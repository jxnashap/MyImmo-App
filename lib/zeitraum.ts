// Zentrale Logik für den globalen Zeitraum-Filter (1M · 1J · 5J · Max).
// Rein (keine React-/DOM-Abhängigkeit) und damit testbar.

export type Zeitraum = "1M" | "1J" | "5J" | "Max";
export const ZEITRAEUME: Zeitraum[] = ["1M", "1J", "5J", "Max"];
export const ZEITRAUM_LABEL: Record<Zeitraum, string> = { "1M": "1M", "1J": "1J", "5J": "5J", Max: "Max" };

export type RawPoint = { date: string; value: number };
export type Granularitaet = "day" | "month" | "year";
export type Bucket = { date: string; value: number };
export type Aggregation = { gran: Granularitaet; buckets: Bucket[] };

const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// ---- Zahlen-Kurzformat für Achsen-Ticks ---------------------------------
// >= 1000 → „1k", „1,5k", „12k", „250k"; darunter ausgeschrieben („850").
export function kurzTick(v: number): string {
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (a < 1000) {
    s = String(Math.round(a));
  } else {
    const k = a / 1000;
    const gerundet = Math.round(k * 10) / 10;
    s = (Number.isInteger(gerundet) ? String(gerundet) : gerundet.toFixed(1).replace(".", ",")) + "k";
  }
  return (neg ? "−" : "") + s;
}

// ---- „Nice" Y-Skala -----------------------------------------------------
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const f = range / Math.pow(10, exp);
  let nf: number;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

export function niceScale(min: number, max: number, maxTicks = 5): { min: number; max: number; ticks: number[]; step: number } {
  if (max <= min) max = min + 1;
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(Math.round(v));
  return { min: niceMin, max: niceMax, ticks, step };
}

// ---- Datums-Helfer ------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function rangeStart(zeitraum: Zeitraum, now: Date, earliest: Date | null): { start: Date; gran: Granularitaet } {
  switch (zeitraum) {
    case "1M": {
      // Tag klemmen, damit z. B. 31.03. − 1 Monat nicht in den März zurückrollt.
      const letzterTagVormonat = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      return { start: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), letzterTagVormonat))), gran: "day" };
    }
    case "1J": return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), gran: "month" };
    case "5J": return { start: new Date(now.getFullYear(), now.getMonth() - 59, 1), gran: "month" };
    case "Max":
    default: {
      const y = earliest ? earliest.getFullYear() : now.getFullYear();
      return { start: new Date(y, 0, 1), gran: "year" };
    }
  }
}

function bucketKey(d: Date, gran: Granularitaet): string {
  if (gran === "day") return isoDay(d);
  if (gran === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return String(d.getFullYear());
}

// Erzeugt die (lückenlose) Bucket-Reihe von start bis now in der Granularität.
function leereBuckets(start: Date, now: Date, gran: Granularitaet): { date: string; cursor: Date }[] {
  const out: { date: string; cursor: Date }[] = [];
  const d = new Date(start);
  let guard = 0;
  while (d <= now && guard++ < 5000) {
    out.push({ date: isoDay(d), cursor: new Date(d) });
    if (gran === "day") d.setDate(d.getDate() + 1);
    else if (gran === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  return out;
}

/**
 * Aggregiert Rohpunkte (Datum + Betrag) auf den gewählten Zeitraum.
 * - kurze Zeiträume tageweise, lange monats-/jahresweise
 * - cumulative=true: laufende Summe inkl. Grundlinie aus der Historie vor dem Zeitraum
 * - zu wenig Historie ⇒ es werden einfach 0-Buckets gezeigt, kein Fehler
 */
export function aggregate(
  points: RawPoint[],
  zeitraum: Zeitraum,
  now: Date = new Date(),
  opts: { cumulative?: boolean } = {}
): Aggregation {
  const gueltig = points.filter((p) => p.date && !Number.isNaN(new Date(p.date).getTime()));
  const sortiert = [...gueltig].sort((a, b) => a.date.localeCompare(b.date));
  const earliest = sortiert.length ? new Date(sortiert[0].date) : null;

  const { start, gran } = rangeStart(zeitraum, now, earliest);
  const reihe = leereBuckets(start, now, gran);
  const summen = new Map<string, number>();
  for (const b of reihe) summen.set(bucketKey(b.cursor, gran), 0);

  // Grundlinie: Summe aller Punkte VOR dem Zeitraum (nur bei cumulative relevant).
  let basis = 0;
  for (const p of gueltig) {
    const d = new Date(p.date);
    if (d < start) {
      basis += p.value;
      continue;
    }
    const key = bucketKey(d, gran);
    if (summen.has(key)) summen.set(key, (summen.get(key) ?? 0) + p.value);
  }

  let lauf = basis;
  const buckets: Bucket[] = reihe.map((b) => {
    const wert = summen.get(bucketKey(b.cursor, gran)) ?? 0;
    if (opts.cumulative) {
      lauf += wert;
      return { date: b.date, value: lauf };
    }
    return { date: b.date, value: wert };
  });

  return { gran, buckets };
}

// ---- Achsenbeschriftung pro Bucket --------------------------------------
// Liefert den X-Tick-Text — oder "" wenn dieser Bucket keinen Tick bekommt
// (Ausdünnung bei vielen Datenpunkten).
export function xTickLabel(buckets: Bucket[], i: number, gran: Granularitaet): string {
  const d = new Date(buckets[i].date);
  if (gran === "year") return String(d.getFullYear());
  if (gran === "month") {
    // 1J (≤14 Buckets): jeder Monat. 5J: nur Januar = Jahreswechsel.
    if (buckets.length <= 14) return MONATE_KURZ[d.getMonth()];
    return d.getMonth() === 0 ? String(d.getFullYear()) : "";
  }
  // Tage: auf ~8 Ticks ausdünnen.
  const step = Math.max(1, Math.ceil(buckets.length / 8));
  return i % step === 0 || i === buckets.length - 1 ? `${d.getDate()}.${d.getMonth() + 1}.` : "";
}
