// Portfolio-Entwicklung — kumulierter Cashflow (SVG-Liniendiagramm), 1:1 wie Vorlage.
import { euro } from "@/lib/format";

export default function CashflowChart({ data }: { data: { label: string; wert: number }[] }) {
  if (data.length === 0 || data.every((p) => p.wert === 0)) {
    return (
      <div className="empty">
        <div className="empty-icon">📈</div>
        <p>Noch keine Buchungen für die Entwicklung</p>
      </div>
    );
  }

  const W = 600, H = 200, padL = 50, padR = 10, padT = 14, padB = 26;
  const min = Math.min(0, ...data.map((p) => p.wert));
  const max = Math.max(0, ...data.map((p) => p.wert));
  const span = max - min || 1;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / span;
  const pfad = data.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.wert).toFixed(1)}`).join(" ");
  const flaeche = `${pfad} L${x(data.length - 1).toFixed(1)},${y(Math.min(0, min)).toFixed(1)} L${x(0).toFixed(1)},${y(Math.min(0, min)).toFixed(1)} Z`;
  const endWert = data[data.length - 1].wert;
  const farbe = endWert >= 0 ? "var(--green)" : "var(--red)";
  const nullY = y(0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <line x1={padL} y1={nullY} x2={W - padR} y2={nullY} stroke="var(--line2)" strokeDasharray="4 4" />
        <text x={padL - 6} y={y(max) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{euro(max)}</text>
        <text x={padL - 6} y={nullY + 4} textAnchor="end" fontSize="10" fill="var(--muted)">€ 0</text>
        {min < 0 && (
          <text x={padL - 6} y={y(min) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">−{euro(Math.abs(min))}</text>
        )}
        <path d={flaeche} fill={farbe} opacity="0.10" />
        <path d={pfad} fill="none" stroke={farbe} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((p, i) => (
          <circle key={i} cx={x(i).toFixed(1)} cy={y(p.wert).toFixed(1)} r="3" fill={farbe}>
            <title>{`${p.label}: ${euro(p.wert)}`}</title>
          </circle>
        ))}
        {data.map((p, i) => (i % 2 === 0 ? (
          <text key={`t${i}`} x={x(i).toFixed(1)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.label}</text>
        ) : null))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
        <span>Kumulierter Cashflow — letzte 12 Monate</span>
        <span style={{ color: farbe, fontWeight: 600 }}>{endWert >= 0 ? "+ " : "− "}{euro(Math.abs(endWert))}</span>
      </div>
    </div>
  );
}
