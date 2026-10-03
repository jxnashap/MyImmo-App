"use client";
import { BarChart3 } from "lucide-react";

import { useZeitraum } from "./ZeitraumProvider";
import { aggregate, niceScale, kurzTick, xTickLabel, bucketTitel, type RawPoint } from "@/lib/zeitraum";
import { euro } from "@/lib/format";
import Leer from "@/components/Leer";
import { useBreite } from "@/lib/hooks/useBreite";

// Wiederverwendbarer Betrags-Chart mit globalem Zeitraum-Filter.
// mode "area"  → Linie/Fläche (z. B. kumulierte Portfolio-Entwicklung)
// mode "bars"  → Balken je Periode (z. B. Einnahmen/Ausgaben)
export default function BetragChart({
  points,
  mode = "bars",
  cumulative = false,
  color = "var(--green)",
  caption,
  heute,
  hoehe = 280,
}: {
  points: RawPoint[];
  mode?: "area" | "bars";
  cumulative?: boolean;
  color?: string;
  caption?: string;
  /** Stichtag `YYYY-MM-DD` vom Server (Europe/Berlin) — nie `new Date()` hier:
   *  Server (UTC) und Browser (Ortszeit) kämen sonst am Monatsersten auf
   *  verschiedene Monate → Hydration-Fehler (Audit A10). */
  heute: string;
  /** Höhe in Pixeln — fest, damit Spalten nebeneinander gleich hoch sind. */
  hoehe?: number;
}) {
  const { zeitraum } = useZeitraum();
  const [rahmen, breite] = useBreite<HTMLDivElement>();

  // Zwei Sorten leer (Audit B27): GAR keine Buchungen → anlegen; Buchungen
  // vorhanden, aber keine im Fenster → Zeitraum vergrößern. Vorher stand der
  // Zeitraum-Hinweis nur im ersten Fall — wo er nichts nützt.
  if (!points || points.length === 0) {
    return (
      <Leer
        art="nichts"
        icon={BarChart3}
        titel="Noch keine Buchungen"
        text="Sobald Einnahmen und Ausgaben erfasst sind, zeigt diese Kurve ihren Saldo Monat für Monat."
        aktion={{ href: "/cashflow/neu", label: "Erste Buchung erfassen" }}
      />
    );
  }

  const { gran, buckets } = aggregate(points, zeitraum, heute, { cumulative });
  if (buckets.every((b) => b.value === 0)) {
    return (
      <Leer
        art="filter"
        icon={BarChart3}
        titel="Nichts im gewählten Zeitraum"
        text="Es gibt Buchungen, aber keine in diesem Fenster. Wähle oben einen größeren Zeitraum."
      />
    );
  }
  const werte = buckets.map((b) => b.value);
  const scale = niceScale(Math.min(0, ...werte), Math.max(0, ...werte), 5);

  // Koordinaten = Pixel (siehe lib/hooks/useBreite.ts). Vor dem Messen ein Platzhalter
  // in der richtigen Höhe, damit nichts springt.
  const W = breite ?? 600, H = hoehe, padL = 56, padR = 16, padT = 18, padB = 46;
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

  // X-Beschriftung nach Platz ausdünnen: höchstens ein Label je ~44 px.
  const labelIdx = buckets.map((_, i) => i).filter((i) => xTickLabel(buckets, i, gran));
  const jedesK = Math.max(1, Math.ceil((labelIdx.length * 44) / plotW));
  const zeigeX = new Set(labelIdx.filter((_, j) => j % jedesK === 0));

  return (
    <div ref={rahmen}>
      {breite === null ? <div style={{ height: H }} aria-hidden /> : (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img" aria-label="Betragsverlauf">
        {/* Gitterlinien + Y-Ticks */}
        {scale.ticks.map((t) => {
          const y = yOf(t);
          return (
            <g key={`y${t}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line2)" strokeWidth={t === 0 ? 1 : 0.6} strokeDasharray={t === 0 ? "0" : "3 4"} opacity={t === 0 ? 0.8 : 0.5} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="11.5" fill="var(--muted)">{kurzTick(t)}</text>
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
                <title>{`${bucketTitel(b.date, gran)}: ${euro(b.value)}`}</title>
              </circle>
            ))}
            {/* Endwert dauerhaft annotieren — auf Mobil ohne Hover ablesbar */}
            {n > 0 && (() => {
              const last = buckets[n - 1];
              const lx = xLine(n - 1);
              const ly = yOf(last.value);
              return (
                <text x={Math.min(lx, W - padR).toFixed(1)} y={(ly - 8 < padT + 6 ? ly + 14 : ly - 8).toFixed(1)} textAnchor="end" fontSize="11" fontWeight={600} fill={color}>
                  {euro(last.value)}
                </text>
              );
            })()}
          </>
        ) : (
          buckets.map((b, i) => {
            const top = Math.min(yOf(b.value), zeroY);
            const h = Math.abs(yOf(b.value) - zeroY);
            return (
              <rect key={i} x={(xCenter(i) - barW / 2).toFixed(1)} y={top.toFixed(1)} width={barW.toFixed(1)} height={Math.max(0, h).toFixed(1)} rx="2" fill={color} opacity={b.value === 0 ? 0.15 : 0.85}>
                <title>{`${bucketTitel(b.date, gran)}: ${euro(b.value)}`}</title>
              </rect>
            );
          })
        )}

        {/* X-Ticks */}
        {buckets.map((b, i) => {
          const label = xTickLabel(buckets, i, gran);
          if (!label || !zeigeX.has(i)) return null;
          const x = mode === "bars" ? xCenter(i) : xLine(i);
          return <text key={`x${i}`} x={x.toFixed(1)} y={H - padB + 16} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{label}</text>;
        })}

        {/* Achsentitel */}
        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill="var(--faint)">Zeitraum</text>
        <text x={14} y={padT + plotH / 2} textAnchor="middle" fontSize="11.5" fill="var(--faint)" transform={`rotate(-90 14 ${padT + plotH / 2})`}>Betrag (€)</text>
      </svg>
      )}

      {caption && (
        <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, color: "var(--muted)" }}>{caption}</div>
      )}
    </div>
  );
}
