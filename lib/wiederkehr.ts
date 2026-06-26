// Wiederkehr-/Zyklus-Logik — rein und testbar. Arbeitet ausschließlich mit
// reinen Kalenderdaten (ISO "YYYY-MM-DD"), kein Date-Parsing/UTC-Versatz.

export type Zyklus = "monatlich" | "quartalsweise" | "halbjaehrlich" | "jaehrlich";

export const ZYKLUS_MONATE: Record<Zyklus, number> = {
  monatlich: 1,
  quartalsweise: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
};

export const ZYKLUS_LABEL: Record<Zyklus, string> = {
  monatlich: "Monatlich",
  quartalsweise: "Quartalsweise",
  halbjaehrlich: "Halbjährlich",
  jaehrlich: "Jährlich",
};

export const ZYKLEN: Zyklus[] = ["monatlich", "quartalsweise", "halbjaehrlich", "jaehrlich"];
export function istZyklus(v: unknown): v is Zyklus {
  return typeof v === "string" && (ZYKLEN as string[]).includes(v);
}

type YMD = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, "0");
function iso(y: number, m: number, d: number): string { return `${y}-${pad(m)}-${pad(d)}`; }
function parse(s: string): YMD { const [y, m, d] = s.split("-").map(Number); return { y, m, d }; }
// letzter Tag im Monat m (1–12) — deckt Schaltjahr automatisch ab.
function lastDay(y: number, m: number): number { return new Date(y, m, 0).getDate(); }
// Vergleich a<b → -1, a==b → 0, a>b → 1.
function cmp(a: YMD, b: YMD): number {
  if (a.y !== b.y) return a.y < b.y ? -1 : 1;
  if (a.m !== b.m) return a.m < b.m ? -1 : 1;
  if (a.d !== b.d) return a.d < b.d ? -1 : 1;
  return 0;
}

// Buchungstag in einem Monat: Ankertag, aber höchstens letzter Monatstag
// (31. → Februar = 28./29.).
export function terminDatum(y: number, m: number, ankerTag: number): string {
  return iso(y, m, Math.min(ankerTag, lastDay(y, m)));
}

/**
 * Alle fälligen Termine einer Reihe vom Startdatum bis (einschließlich) heute.
 * - Zyklus-Ankerung am Startmonat (z. B. Start 15.03 + halbjährlich → 15.03, 15.09, …)
 * - Tag-Ankerung am Start-Tag, geklemmt auf Monatslänge
 * - höchstens `maxJahre` zurück (frühere Termine werden ausgelassen)
 * - endDatum (optional): keine Termine danach
 */
export function termine(
  startIso: string,
  zyklus: Zyklus,
  heuteIso: string,
  endIso?: string | null,
  maxJahre = 10,
): string[] {
  const start = parse(startIso);
  const heute = parse(heuteIso);
  const end = endIso ? parse(endIso) : null;
  const step = ZYKLUS_MONATE[zyklus];
  const anker = start.d;
  // Frühestes erlaubtes Datum: heute minus maxJahre (gleicher Tag/Monat).
  const minDate: YMD = { y: heute.y - maxJahre, m: heute.m, d: heute.d };

  const out: string[] = [];
  let y = start.y;
  let m = start.m;
  for (let guard = 0; guard < 100000; guard++) {
    const dIso = terminDatum(y, m, anker);
    const dp = parse(dIso);
    if (cmp(dp, heute) > 0) break;            // Zukunft (über heute hinaus)
    if (end && cmp(dp, end) > 0) break;        // nach Enddatum
    if (cmp(dp, minDate) >= 0) out.push(dIso); // innerhalb 10-Jahres-Fenster
    m += step;
    while (m > 12) { m -= 12; y += 1; }
  }
  return out;
}

export type Periode = { von: string; bis: string | null; betrag: number };

// Gültiger Betrag für ein Datum aus den Mietverlauf-Zeiträumen (oder null).
export function betragFuerDatum(perioden: Periode[], datumIso: string): number | null {
  const d = parse(datumIso);
  for (const p of perioden) {
    const abVon = cmp(d, parse(p.von)) >= 0;
    const bisOk = !p.bis || cmp(d, parse(p.bis)) <= 0;
    if (abVon && bisOk) return p.betrag;
  }
  return null;
}

/**
 * Prüft eine Mietverlauf-Liste auf Lückenlosigkeit & Überschneidungsfreiheit.
 * Erwartung: nach `von` sortiert; genau ein offener (bis=null) Zeitraum am Ende.
 */
export function validierePerioden(perioden: Periode[]): { ok: boolean; error?: string } {
  if (perioden.length === 0) return { ok: true };
  const sorted = [...perioden].sort((a, b) => cmp(parse(a.von), parse(b.von)));
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (p.betrag <= 0) return { ok: false, error: "Beträge müssen größer als 0 sein." };
    if (p.bis && cmp(parse(p.bis), parse(p.von)) < 0) return { ok: false, error: 'Das „bis"-Datum darf nicht vor dem „von"-Datum liegen.' };
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      if (!p.bis) return { ok: false, error: 'Nur der letzte Zeitraum darf offen (ohne „bis"-Datum) sein.' };
      // nächster „von" muss exakt am Tag nach diesem „bis" beginnen (lückenlos, überschneidungsfrei)
      const nachBis = naechsterTag(p.bis);
      if (next.von !== nachBis) return { ok: false, error: "Zeiträume müssen lückenlos und überschneidungsfrei sein." };
    }
  }
  return { ok: true };
}

// Kalendertag + 1 (für Lückenlosigkeits-Check).
export function naechsterTag(isoStr: string): string {
  const { y, m, d } = parse(isoStr);
  if (d < lastDay(y, m)) return iso(y, m, d + 1);
  if (m < 12) return iso(y, m + 1, 1);
  return iso(y + 1, 1, 1);
}

// Heutiges Kalenderdatum (lokal) als ISO — bewusst ohne UTC-Konvertierung.
export function heuteIso(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
