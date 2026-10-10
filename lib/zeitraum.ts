// Zentrale Logik für den globalen Zeitraum-Filter (1J · 3J · 5J · Max).
// Rein (keine React-/DOM-Abhängigkeit) und damit testbar.
//
// 30.09.2026 (Vorgabe des Betreibers): „1M" entfällt — Miete kommt einmal im
// Monat, eine Tagesansicht zeigte 29 leere Tage und einen Ausschlag. Alles
// rechnet jetzt MONATSWEISE; „Max" erst ab mehr als sechs Jahren Bestand
// jahresweise (vorher immer — zwei Jahre Buchungen ergaben zwei Punkte).
//
// Datumsrechnung auf den ZAHLEN des ISO-Datums, nie über `new Date(iso)` mit
// Ortszeit-Zugriffen: „2026-03-01" ist westlich von UTC sonst der 28. Februar
// (dieselbe Falle wie `naechsteFaelligkeit`, siehe CLAUDE.md).

export type Zeitraum = "1J" | "3J" | "5J" | "Max";
export const ZEITRAEUME: Zeitraum[] = ["1J", "3J", "5J", "Max"];
export const ZEITRAUM_LABEL: Record<Zeitraum, string> = { "1J": "1J", "3J": "3J", "5J": "5J", Max: "Max" };
const MONATE_JE_ZEITRAUM: Record<Exclude<Zeitraum, "Max">, number> = { "1J": 12, "3J": 36, "5J": 60 };
/** Bis zu so vielen Monaten zeigt „Max" noch Monate, darüber Jahre. */
export const MAX_MONATE_MONATSWEISE = 72;

export function istZeitraum(s: unknown): s is Zeitraum {
  return typeof s === "string" && (ZEITRAEUME as string[]).includes(s);
}

export type RawPoint = { date: string; value: number };
export type Granularitaet = "month" | "year";
export type Bucket = { date: string; value: number };
export type Aggregation = { gran: Granularitaet; buckets: Bucket[] };

const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// ---- Zahlen-Kurzformat für Achsen-Ticks ---------------------------------
// Deutsche Kürzel: ab 1 Mio. „1 Mio.“, „1,5 Mio.“; ab 1.000 „1 Tsd.“, „250 Tsd.“;
// darunter ausgeschrieben („850“). Früher „2000k“ — für 2 Mio. € ungewohnt.
// Bei Mio. zwei Nachkommastellen: Achsenschritte von 250 Tsd. ergäben sonst
// „1,3 Mio.“ für 1,25 Mio. — eine falsche Achsenbeschriftung.
function kurzZahl(x: number, stellen = 1): string {
  const f = 10 ** stellen;
  const gerundet = Math.round(x * f) / f;
  return gerundet.toLocaleString("de-DE", { maximumFractionDigits: stellen, useGrouping: false });
}

/** Geschätzte Breite eines Achsen-Labels bei 11,5 px Schrift (Durchschnitt je Zeichen, eher großzügig). */
export const ZEICHEN_PX = 6.6;
/** Breite des gedrehten Achsentitels „Betrag (€)“ links (Mitte bei x = 12, Glyphenhöhe ≈ 12 px). */
export const ACHSENTITEL_BAND = 20;

/**
 * Linker Rand eines Diagramms: Platz für den gedrehten Achsentitel UND die längste Y-Beschriftung.
 * Vorher fest 56 px — „40 Tsd.“ reichte bis x ≈ 8 und lag unter dem Titel bei x ≈ 8–20
 * (Gesamtprüfung C1, „die 4 von 40 Tsd. ist verdeckt“).
 */
export function linkerRand(ticks: number[]): number {
  const laengste = Math.max(0, ...ticks.map((t) => kurzTick(t).length));
  return Math.max(56, Math.ceil(ACHSENTITEL_BAND + 6 + laengste * ZEICHEN_PX + 8));
}

export function kurzTick(v: number): string {
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (a < 1000) {
    s = String(Math.round(a));
  } else if (a < 1_000_000) {
    s = kurzZahl(a / 1000) + " Tsd.";
  } else {
    s = kurzZahl(a / 1_000_000, 2) + " Mio.";
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

// ---- Monats-Helfer auf Zahlen -------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
/** Monatsindex (Jahr*12 + Monat-1) aus „YYYY-MM…", sonst null. */
function monatsIndex(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const jahr = Number(m[1]), monat = Number(m[2]);
  if (monat < 1 || monat > 12) return null;
  return jahr * 12 + (monat - 1);
}
const indexZuDatum = (i: number) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}-01`;

/**
 * Datum, unter dem eine EINNAHME in der Grafik zählt: der Mietmonat
 * (`soll_monat`), wenn bekannt — sonst das Buchungsdatum.
 * Eine Januar-Miete, die am 2. Februar eingeht, gehört in den Januar; sonst
 * steht der Januar leer und der Februar doppelt.
 */
export function einnahmeDatum(e: { buchungsdatum?: string | null; soll_monat?: string | null }): string | null {
  if (e.soll_monat && /^\d{4}-(0[1-9]|1[0-2])$/.test(e.soll_monat)) return `${e.soll_monat}-01`;
  return e.buchungsdatum ?? null;
}

/**
 * Aggregiert Rohpunkte (Datum + Betrag) auf den gewählten Zeitraum.
 * - Monats-Buckets bis einschließlich des laufenden Monats
 * - cumulative=true: laufende Summe, beginnt im Zeitraum bei 0
 * - Punkte nach dem laufenden Monat (Vorausbuchungen) zählen nicht
 * - zu wenig Historie ⇒ 0-Buckets, kein Fehler
 */
/**
 * Heutiges Datum in Europe/Berlin als `YYYY-MM-DD` — der EINE Stichtag für
 * Server und Browser. Bis 01.10.2026 (Audit A10) rechnete das Dashboard den
 * Monatsanker serverseitig in UTC und im Browser in Ortszeit: an jedem
 * Monatsersten 00–02 Uhr ein Hydration-Fehler (#418, gemessen) und eine
 * andere letzte Spalte. Die Zeitzone ist die der Nutzer, nicht die des
 * Servers (Vercel läuft in UTC).
 */
export function heuteBerlin(jetzt: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
}

/** Jetzt in Berliner Ortszeit als „JJJJMMTTHHMMSS“ (z. B. für Zeitstempel in Exportdateien). */
export function zeitstempelBerlin(jetzt: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(jetzt).replace(/\D/g, "");
}

export function aggregate(
  points: RawPoint[],
  zeitraum: Zeitraum,
  now: Date | string = new Date(),
  opts: { cumulative?: boolean } = {}
): Aggregation {
  // Ein ISO-Datum (vom Server) zählt auf seinen ZAHLEN — ein Date-Objekt auf
  // der Ortszeit des Prozesses (nur noch Rückfall für alte Aufrufer/Tests).
  const jetzt =
    typeof now === "string"
      ? (monatsIndex(now) ?? new Date().getFullYear() * 12 + new Date().getMonth())
      : now.getFullYear() * 12 + now.getMonth();
  const gueltig = points
    .map((p) => ({ i: monatsIndex(p.date), value: p.value }))
    .filter((p): p is { i: number; value: number } => p.i !== null && Number.isFinite(p.value));
  const fruehester = gueltig.length ? Math.min(...gueltig.map((p) => p.i)) : jetzt;

  let gran: Granularitaet = "month";
  let start: number;
  if (zeitraum === "Max") {
    start = Math.min(fruehester, jetzt);
    if (jetzt - start + 1 > MAX_MONATE_MONATSWEISE) gran = "year";
  } else {
    start = jetzt - MONATE_JE_ZEITRAUM[zeitraum] + 1;
  }

  // Schlüssel je Bucket: Monatsindex, bei Jahren der Januar des Jahres.
  const schluessel = (i: number) => (gran === "year" ? Math.floor(i / 12) * 12 : i);
  const reihe: number[] = [];
  for (let i = schluessel(start); i <= jetzt; i += gran === "year" ? 12 : 1) reihe.push(i);
  const summen = new Map<number, number>(reihe.map((k) => [k, 0]));

  // Punkte VOR dem Zeitraum zählen NICHT — auch nicht bei `cumulative`.
  // Bis 30.09.2026 startete die kumulierte Linie beim Saldo aller früheren
  // Buchungen („Grundlinie"); der Endwert hing dann davon ab, wann jemand mit
  // dem Buchen angefangen hat (externes Review). Wer den Saldo seit Beginn
  // will, wählt „Max".
  for (const p of gueltig) {
    if (p.i < start || p.i > jetzt) continue;
    const k = schluessel(p.i);
    if (summen.has(k)) summen.set(k, (summen.get(k) ?? 0) + p.value);
  }

  let lauf = 0;
  const buckets: Bucket[] = reihe.map((k) => {
    const wert = summen.get(k) ?? 0;
    lauf += wert;
    return { date: indexZuDatum(k), value: opts.cumulative ? lauf : wert };
  });
  return { gran, buckets };
}

// ---- Achsenbeschriftung pro Bucket --------------------------------------
// Liefert den X-Tick-Text — oder "" wenn dieser Bucket keinen Tick bekommt.
export function xTickLabel(buckets: Bucket[], i: number, gran: Granularitaet): string {
  const idx = monatsIndex(buckets[i].date);
  if (idx === null) return "";
  const jahr = Math.floor(idx / 12), monat = idx % 12;
  if (gran === "year") return String(jahr);
  const n = buckets.length;
  if (n <= 14) return MONATE_KURZ[monat]; // 1J: jeder Monat
  if (n <= 40) return monat % 3 === 0 ? `${MONATE_KURZ[monat]} ${String(jahr).slice(2)}` : ""; // 3J: Quartale
  return monat === 0 ? String(jahr) : ""; // 5J/Max: Jahreswechsel
}

/** Titel eines Buckets für den Tooltip: „Mär 2026" bzw. „2026". */
export function bucketTitel(date: string, gran: Granularitaet): string {
  const idx = monatsIndex(date);
  if (idx === null) return date;
  const jahr = Math.floor(idx / 12);
  return gran === "year" ? String(jahr) : `${MONATE_KURZ[idx % 12]} ${jahr}`;
}
