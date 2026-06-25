"use client";

import { useZeitraum } from "./ZeitraumProvider";
import { aggregate, niceScale, kurzTick, xTickLabel, type RawPoint } from "@/lib/zeitraum";
import { euro } from "@/lib/format";

// Wiederverwendbarer Betrags-Chart mit globalem Zeitraum-Filter.
// mode "area"  → Linie/Fläche (z. B. kumulierte Portfolio-Entwicklung)
// mode "bars"  → Balken je Periode (z. B. Einnahmen/Ausgaben)
export default function BetragChart({
  points,
  mode = "bars",
  cumulative = false,
  color = "var(--green)",
  caption,
}: {
  points: RawPoint[];
  mode?: "area" | "bars";
  cumulative?: boolean;
  color?: string;
  caption?: string;
}) {
  const { zeitraum } = useZeitraum();

  if (!points || points.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">📊</div>
        <p>Noch keine Daten für die Auswertung</p>
      </div>
    );
  }

  const { gran, buckets } = aggregate(points, zeitraum, new Date(), { cumulative });
  const werte = buckets.map((b) => b.value);
  const scale = niceScale(Math.min(0, ...werte), Math.max(0, ...werte), 5);

  const W = 660, H = 250, padL = 56, padR = 16, padT = 16, padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = buckets.length;

  const yOf = (v: number) => padT + ((scale.max - v) / (scale.max - scale.min)) * plotH;
  const zeroY = yOf(0);

  // x-Position: bei Balken Slot-Mitte, bei Fläche gleichmäßig verteilt.
  const slot = plotW / Math.max(1, n);
  const xCenter = (i: number) => padL + slot * (i + 0.5);
  const xLine = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1));

  const linePath = buckets.map((b, i) => `${i === 0 ? "M" : "L"}${xLine(i).toFixed(1)},${yOf(b.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xLine(n - 1).toFixed(1)},${zeroY.toFixed(1)} L${xLine(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const barW = Math.max(1, Math.min(28, slot * 0.62));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Betragsverlauf">
        {/* Gitterlinien + Y-Ticks */}
        {scale.ticks.map((t) => {
          const y = yOf(t);
          return (
            <g key={`y${t}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line2)" strokeWidth={t === 0 ? 1 : 0.6} strokeDasharray={t === 0 ? "0" : "3 4"} opacity={t === 0 ? 0.8 : 0.5} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">{kurzTick(t)}</text>
            </g>
          );
        })}

        {/* Daten */}
        {mode === "area" ? (
          <>
            <path d={areaPath} fill={color} opacity="0.10" />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {buckets.map((b, i) => (
              <circle key={i} cx={xLine(i).toFixed(1)} cy={yOf(b.value).toFixed(1)} r={n > 40 ? 0 : 2.5} fill={color}>
                <title>{`${tooltipLabel(b.date, gran)}: ${euro(b.value)}`}</title>
              </circle>
            ))}
          </>
        ) : (
          buckets.map((b, i) => {
            const top = Math.min(yOf(b.value), zeroY);
            const h = Math.abs(yOf(b.value) - zeroY);
            return (
              <rect key={i} x={(xCenter(i) - barW / 2).toFixed(1)} y={top.toFixed(1)} width={barW.toFixed(1)} height={Math.max(0, h).toFixed(1)} rx="2" fill={color} opacity={b.value === 0 ? 0.15 : 0.85}>
                <title>{`${tooltipLabel(b.date, gran)}: ${euro(b.value)}`}</title>
              </rect>
            );
          })
        )}

        {/* X-Ticks */}
        {buckets.map((b, i) => {
          const label = xTickLabel(buckets, i, gran);
          if (!label) return null;
          const x = mode === "bars" ? xCenter(i) : xLine(i);
          return <text key={`x${i}`} x={x.toFixed(1)} y={H - padB + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{label}</text>;
        })}

        {/* Achsentitel */}
        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">Zeitraum</text>
        <text x={14} y={padT + plotH / 2} textAnchor="middle" fontSize="10" fill="var(--faint)" transform={`rotate(-90 14 ${padT + plotH / 2})`}>Betrag (€)</text>
      </svg>

      {caption && (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>{caption}</div>
      )}
    </div>
  );
}

function tooltipLabel(iso: string, gran: "day" | "month" | "year"): string {
  const d = new Date(iso);
  if (gran === "year") return String(d.getFullYear());
  if (gran === "month") return d.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" });
}
