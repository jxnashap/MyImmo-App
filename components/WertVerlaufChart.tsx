// Wertentwicklungs-Chart (Fläche + Linie) für Objekt- und Portfolio-Verlauf.
// Server-Komponente: reines SVG, Tooltips über <title>. Datenpunkte kommen aus
// lib/wert/verlauf (Kaufpreis → erfasste Stände → aktueller Wert).

import { niceScale, kurzTick } from "@/lib/zeitraum";
import { euro } from "@/lib/format";
import type { WertPunkt } from "@/lib/wert/verlauf";

const tagLabel = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])}.${Number(m[2])}.${m[1]}`;
};
const kurzLabel = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const monat = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"][Number(m[2]) - 1];
  return `${monat} ${m[1].slice(2)}`;
};

export default function WertVerlaufChart({
  punkte,
  color = "var(--gold)",
  caption,
}: {
  punkte: WertPunkt[];
  color?: string;
  caption?: string;
}) {
  if (!punkte || punkte.length < 2) return null;

  const werte = punkte.map((p) => p.marktwert);
  const scale = niceScale(Math.min(...werte), Math.max(...werte), 5);

  const W = 660, H = 240, padL = 62, padR = 16, padT = 16, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = punkte.length;

  const yOf = (v: number) => padT + ((scale.max - v) / (scale.max - scale.min)) * plotH;
  const xOf = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1));
  const baseY = padT + plotH;

  const linePath = punkte.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.marktwert).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xOf(n - 1).toFixed(1)},${baseY.toFixed(1)} L${xOf(0).toFixed(1)},${baseY.toFixed(1)} Z`;

  // X-Beschriftung ausdünnen: max. ~6 Labels, immer erstes und letztes.
  const maxLabels = 6;
  const jeder = Math.max(1, Math.ceil(n / maxLabels));
  const zeigeLabel = (i: number) => i === 0 || i === n - 1 || i % jeder === 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Wertentwicklung">
        {scale.ticks.map((t) => {
          const y = yOf(t);
          if (y < padT - 1 || y > baseY + 1) return null;
          return (
            <g key={`y${t}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line2)" strokeWidth={0.6} strokeDasharray="3 4" opacity={0.5} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">{kurzTick(t)}</text>
            </g>
          );
        })}

        <path d={areaPath} fill={color} opacity="0.12" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {punkte.map((p, i) => (
          <circle key={i} cx={xOf(i).toFixed(1)} cy={yOf(p.marktwert).toFixed(1)} r={n > 30 ? 0 : 3} fill={color} stroke="var(--bg2)" strokeWidth={1}>
            <title>{`${tagLabel(p.datum)}: ${euro(p.marktwert)}`}</title>
          </circle>
        ))}

        {punkte.map((p, i) =>
          zeigeLabel(i) ? (
            <text key={`x${i}`} x={xOf(i).toFixed(1)} y={baseY + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {kurzLabel(p.datum)}
            </text>
          ) : null,
        )}
      </svg>
      {caption && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>{caption}</div>
      )}
    </div>
  );
}
