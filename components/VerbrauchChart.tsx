// Verbrauchsverlauf je Zähler-Art als SVG-Balkendiagramm (Menge pro Eintrag).
import { euro } from "@/lib/format";
import { Zap, Flame, Droplet, Fuel, Heater, Package, BarChart3, type LucideIcon } from "lucide-react";

const ART_ICONS: Record<string, LucideIcon> = { Strom: Zap, Gas: Flame, Wasser: Droplet, Heizöl: Fuel, Fernwärme: Heater, Heizung: Heater, Sonstiges: Package };

export type VPoint = { label: string; menge: number; kosten: number };

export default function VerbrauchChart({ art, einheit, points }: { art: string; einheit: string; points: VPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.menge));
  const summeKosten = points.reduce((s, p) => s + p.kosten, 0);
  const W = 600, H = 150, padT = 12, padB = 26, padL = 8, padR = 8;
  const n = points.length;
  const slot = (W - padL - padR) / Math.max(n, 1);
  const barW = Math.min(46, slot * 0.6);
  const fmtMenge = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });

  return (
    <div className="section" style={{ marginBottom: 14 }}>
      <div className="section-header">
        <div>
          <h3>{(() => { const Icon = ART_ICONS[art] || BarChart3; return <Icon size={16} style={{ verticalAlign: "-3px" }} />; })()} {art}</h3>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{n} {n === 1 ? "Ablesung" : "Ablesungen"} · Kosten gesamt {euro(summeKosten)}</span>
        </div>
      </div>
      <div className="section-body">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
          {points.map((p, i) => {
            const h = ((H - padT - padB) * p.menge) / max;
            const cx = padL + slot * i + slot / 2;
            const yTop = H - padB - h;
            return (
              <g key={i}>
                <rect x={cx - barW / 2} y={yTop} width={barW} height={h} rx={4} fill="var(--gold)" opacity={0.85}>
                  <title>{`${p.label}: ${fmtMenge(p.menge)} ${einheit} · ${euro(p.kosten)}`}</title>
                </rect>
                <text x={cx} y={yTop - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{fmtMenge(p.menge)}</text>
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.label}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Menge in {einheit || "Einheiten"} je Ablesung</div>
      </div>
    </div>
  );
}
