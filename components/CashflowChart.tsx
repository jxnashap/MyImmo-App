// Portfolio-Entwicklung — kumulierter Cashflow als Flächen-/Liniendiagramm (SVG, ohne Library).
import { eur } from "@/lib/format";

export default function CashflowChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const W = 960;
  const H = 300;
  const pad = { top: 24, right: 24, bottom: 36, left: 24 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  const x = (i: number) => pad.left + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / span) * innerH;

  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPts = `${pad.left},${pad.top + innerH} ${linePts} ${pad.left + innerW},${pad.top + innerH}`;
  const last = data[data.length - 1]?.value ?? 0;

  return (
    <div className="card">
      <div className="mb-1 section-title">📈 Portfolio-Entwicklung</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="cfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Nulllinie */}
        <line x1={pad.left} y1={y(0)} x2={W - pad.right} y2={y(0)} stroke="var(--line2)" strokeWidth="1" strokeDasharray="3 4" />

        {/* Fläche + Linie */}
        <polygon points={areaPts} fill="url(#cfFill)" />
        <polyline points={linePts} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Punkte */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r="3.5" fill="var(--green)">
            <title>{`${d.label}: ${eur(d.value)}`}</title>
          </circle>
        ))}

        {/* Höchstwert oben links */}
        <text x={pad.left} y={pad.top - 6} fontSize="13" fill="var(--muted)">{eur(max)}</text>
        <text x={pad.left} y={pad.top + innerH + 4} fontSize="13" fill="var(--muted)">{eur(min)}</text>

        {/* X-Achsen-Beschriftung (jedes zweite Label) */}
        {data.map((d, i) =>
          i % 2 === 0 ? (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--muted)">
              {d.label}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-white/40">Kumulierter Cashflow — letzte 12 Monate</span>
        <span style={{ color: last >= 0 ? "var(--green)" : "var(--red)" }}>
          {last >= 0 ? "+ " : ""}{eur(last)}
        </span>
      </div>
    </div>
  );
}
