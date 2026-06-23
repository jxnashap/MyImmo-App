// Einfacher Cashflow-Balkengraph als SVG (keine externe Library).
import { eur } from "@/lib/format";

export default function CashflowChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const W = 720;
  const H = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 12 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const zeroY = pad.top + innerH / 2;
  const barW = innerW / data.length;

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg">Cashflow-Verlauf (laufendes Jahr)</h2>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <line x1={pad.left} y1={zeroY} x2={W - pad.right} y2={zeroY} stroke="var(--line2)" strokeWidth="1" />
        {data.map((d, i) => {
          const h = (Math.abs(d.value) / max) * (innerH / 2);
          const x = pad.left + i * barW + barW * 0.2;
          const w = barW * 0.6;
          const positive = d.value >= 0;
          const y = positive ? zeroY - h : zeroY;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={Math.max(1, h)}
                rx="2"
                fill={positive ? "var(--green)" : "var(--red)"}
                opacity="0.85"
              >
                <title>{`${d.label}: ${eur(d.value)}`}</title>
              </rect>
              <text x={x + w / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
