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
// "Sep 19" war mehrdeutig (19. September? September 2019?) — der Apostroph
// macht die Jahreszahl eindeutig.
const kurzLabel = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const monat = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"][Number(m[2]) - 1];
  return `${monat} ’${m[1].slice(2)}`;
};

// Datum → Zeitstempel. Die X-Achse muss die echte Zeit abbilden; eine rein
// kategoriale Achse (gleicher Abstand je Punkt) verzerrt den Verlauf:
// Ein Stand von 2021 landete optisch in der Mitte, obwohl er zeitlich bei
// einem Viertel lag — in einer Wertentwicklung ist das schlicht falsch.
const zeitOf = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? "1"));
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

  // W bewusst schmal: Das SVG skaliert per viewBox, ein breiteres Koordinaten-
  // system lässt die Achsenbeschriftung am Handy auf ~5 px schrumpfen.
  const W = 560, H = 230, padL = 58, padR = 14, padT = 16, padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = punkte.length;

  const yOf = (v: number) => padT + ((scale.max - v) / (scale.max - scale.min)) * plotH;

  // X zeitproportional. Fallback auf die kategoriale Verteilung, wenn die
  // Daten kein auswertbares Datum tragen oder alle auf denselben Tag fallen.
  const zeiten = punkte.map((p) => zeitOf(p.datum));
  const zeitOk = zeiten.every((t) => Number.isFinite(t));
  const tMin = zeitOk ? Math.min(...zeiten) : 0;
  const tMax = zeitOk ? Math.max(...zeiten) : 0;
  const zeitSpanne = tMax - tMin;
  const xOf = (i: number) => {
    if (n === 1) return padL + plotW / 2;
    if (!zeitOk || zeitSpanne <= 0) return padL + (i * plotW) / (n - 1);
    return padL + ((zeiten[i] - tMin) / zeitSpanne) * plotW;
  };
  const baseY = padT + plotH;

  const linePath = punkte.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.marktwert).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xOf(n - 1).toFixed(1)},${baseY.toFixed(1)} L${xOf(0).toFixed(1)},${baseY.toFixed(1)} Z`;

  // X-Beschriftung ausdünnen. Bei zeitproportionaler Achse reicht "jeder
  // k-te" nicht mehr — dicht beieinander liegende Stände würden überlappen.
  // Deshalb nach Pixelabstand: erstes und letztes Label immer, dazwischen
  // nur, was mindestens MIN_ABSTAND vom zuletzt gesetzten entfernt ist.
  const MIN_ABSTAND = 78;
  const labelIdx = new Set<number>([0, n - 1]);
  if (n > 2) {
    let letztesX = xOf(0);
    const endX = xOf(n - 1);
    for (let i = 1; i < n - 1; i++) {
      const x = xOf(i);
      if (x - letztesX >= MIN_ABSTAND && endX - x >= MIN_ABSTAND) {
        labelIdx.add(i);
        letztesX = x;
      }
    }
  }
  const zeigeLabel = (i: number) => labelIdx.has(i);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Wertentwicklung">
        {scale.ticks.map((t) => {
          const y = yOf(t);
          if (y < padT - 1 || y > baseY + 1) return null;
          return (
            <g key={`y${t}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line2)" strokeWidth={0.6} strokeDasharray="3 4" opacity={0.5} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="11.5" fill="var(--muted)">{kurzTick(t)}</text>
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
        {/* Endwert dauerhaft annotieren — auf Mobil ohne Hover ablesbar */}
        {(() => {
          const last = punkte[n - 1];
          const lx = xOf(n - 1);
          const ly = yOf(last.marktwert);
          return (
            <text x={Math.min(lx, W - padR).toFixed(1)} y={(ly - 8 < padT + 6 ? ly + 14 : ly - 8).toFixed(1)} textAnchor="end" fontSize="11" fontWeight={600} fill={color}>
              {euro(last.marktwert)}
            </text>
          );
        })()}

        {punkte.map((p, i) =>
          zeigeLabel(i) ? (
            // Randlabels einrücken, damit sie am zeitproportionalen Anfang/Ende
            // nicht aus dem Chart ragen.
            <text key={`x${i}`} x={Math.min(Math.max(xOf(i), 22), W - 22).toFixed(1)} y={baseY + 17} textAnchor="middle" fontSize="11.5" fill="var(--muted)">
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
