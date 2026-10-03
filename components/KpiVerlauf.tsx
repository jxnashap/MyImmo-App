// Kleine Verlaufslinie + Trend-Hinweis unter einer Dashboard-Kennzahl (03.10.2026).
// Die Werte kommen aus lib/kpiVerlauf.ts — dieselbe Rechnung wie die Zahl darüber.
//
// Bewusst OHNE Text in der Grafik: Die Linie wird über die Kartenbreite gestreckt
// (`preserveAspectRatio="none"`), die Strichstärke bleibt per `non-scaling-stroke`
// gleich. Schrift in einer gestreckten viewBox wäre verzerrt (Regel aus #408).
import { euro } from "@/lib/format";
import { trendTon, type Trend } from "@/lib/kpiVerlauf";

const FARBE = { gut: "var(--green)", schlecht: "var(--red)", neutral: "var(--faint)" } as const;

export function Sparkline({ werte, ton, titel }: { werte: number[]; ton: "gut" | "schlecht" | "neutral"; titel: string }) {
  if (werte.length < 2) return null;
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const spanne = max - min;
  const H = 32;
  const y = (v: number) => (spanne === 0 ? H / 2 : 3 + (1 - (v - min) / spanne) * (H - 6));
  const x = (i: number) => (i / (werte.length - 1)) * 100;
  const linie = werte.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const flaeche = `${linie} L100,${H} L0,${H} Z`;
  const farbe = FARBE[ton];
  return (
    <svg className="kpi-spark" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label={titel}>
      <title>{titel}</title>
      <path d={flaeche} fill={farbe} opacity={0.08} />
      <path d={linie} fill="none" stroke={farbe} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** „▲ 120 € ggü. Vormonat“ — als Betrag, weil Prozent bei negativem Cashflow nichts aussagt. */
export function TrendHinweis({ trend, steigendIstGut }: { trend: Trend | null; steigendIstGut: boolean }) {
  if (!trend) return null;
  const ton = trendTon(trend, steigendIstGut);
  if (ton === "neutral") return <span className="kpi-trend kpi-trend-neutral">unverändert ggü. Vormonat</span>;
  const pfeil = trend.delta > 0 ? "▲" : "▼";
  const wert = euro(Math.abs(Math.round(trend.delta)));
  return <span className={`kpi-trend kpi-trend-${ton}`}>{pfeil} {wert} <span className="kpi-trend-bezug">ggü. Vormonat</span></span>;
}
