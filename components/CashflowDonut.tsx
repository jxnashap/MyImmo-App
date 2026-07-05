"use client";

// Interaktives Donut-Diagramm (Trade-Republic-Look) für die Ein-/Ausgaben-Seite.
// Ebene 1: Einnahmen vs. Ausgaben. Klick auf ein Segment/Legende → Ebene 2 mit den
// Kategorien der gewählten Seite (prozentual). Eigenes SVG (kein 3D-Framework):
// dicker Ring, runde Enden, Lücken, radiale Verläufe für Volumen, weicher Schatten,
// dezente Neigung. Reagiert auf prefers-reduced-motion.

import { useMemo, useState, useId } from "react";
import { euro } from "@/lib/format";

type Kat = [string, number];

// Warm-/Rot-Palette (Ausgaben) und Grün-/Gold-Palette (Einnahmen). Mitteltöne mit
// genug Sättigung, damit Segmente UND die farbigen €-Beträge in der Legende in
// beiden Themes (hell/dunkel) lesbar bleiben.
const PAL_AUS = ["#DB5138", "#E07B2E", "#C28A1E", "#B44A57", "#9C4722", "#CF6A4E", "#8A5A2B", "#D08A2E"];
const PAL_EIN = ["#3E9E6C", "#2F8F5B", "#C29A2E", "#5A9E5B", "#3B7D77", "#7A8A2C", "#2E7D4F", "#A07E2A"];

const light = (c: string) => `color-mix(in srgb, ${c}, white 30%)`;
const dark = (c: string) => `color-mix(in srgb, ${c}, black 24%)`;

type Seg = { key: string; label: string; value: number; color: string };

// >8 Kategorien: kleinste zu „Sonstige" bündeln, damit der Ring lesbar bleibt.
function bundle(kat: Kat[], palette: string[]): Seg[] {
  const pos = kat.filter(([, v]) => v > 0);
  let items = pos;
  if (pos.length > 8) {
    const top = pos.slice(0, 7);
    const restSum = pos.slice(7).reduce((s, [, v]) => s + v, 0);
    items = restSum > 0 ? [...top, ["Sonstige", restSum] as Kat] : top;
  }
  return items.map(([label, value], i) => ({ key: `${label}-${i}`, label, value, color: palette[i % palette.length] }));
}

export default function CashflowDonut({
  einnahmenTotal,
  ausgabenTotal,
  einKat,
  ausKat,
  netto,
}: {
  einnahmenTotal: number;
  ausgabenTotal: number;
  einKat: Kat[];
  ausKat: Kat[];
  netto: number;
}) {
  const uid = useId().replace(/[:]/g, "");
  const [side, setSide] = useState<null | "ein" | "aus">(null); // null = Ebene 1
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null); // Hover (flüchtig)
  const [pin, setPin] = useState<{ x: number; y: number; text: string } | null>(null); // Tap (fixiert, mobil)

  const overview: Seg[] = useMemo(
    () => [
      { key: "ein", label: "Einnahmen", value: einnahmenTotal, color: "var(--green)" },
      { key: "aus", label: "Ausgaben", value: ausgabenTotal, color: "var(--red)" },
    ].filter((s) => s.value > 0),
    [einnahmenTotal, ausgabenTotal],
  );

  const drillSegs = useMemo(
    () => (side === "ein" ? bundle(einKat, PAL_EIN) : side === "aus" ? bundle(ausKat, PAL_AUS) : []),
    [side, einKat, ausKat],
  );

  const segs = side ? drillSegs : overview;
  const total = segs.reduce((s, x) => s + x.value, 0);

  // Zentrums-Text.
  const sideSum = side === "ein" ? einnahmenTotal : side === "aus" ? ausgabenTotal : 0;
  const centerBig = side ? euro(sideSum) : `${netto >= 0 ? "+ " : "− "}${euro(Math.abs(netto))}`;
  const centerLabel = side === "ein" ? "Einnahmen" : side === "aus" ? "Ausgaben" : "Netto";
  const centerColor = side === "ein" ? "var(--green)" : side === "aus" ? "var(--red)" : netto >= 0 ? "var(--green)" : "var(--red)";

  // Geometrie.
  const CX = 120, CY = 120, R = 84, SW = 30;
  const C = 2 * Math.PI * R;
  const gapPx = segs.length > 1 ? 7 : 0;

  // Segment-Arcs (kumulativ).
  let acc = 0;
  const arcs = segs.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const start = acc;
    acc += frac;
    const seg = frac * C;
    const dash = Math.max(seg - gapPx, 0.001);
    const gapDeg = (gapPx / C) * 360;
    const rot = -90 + start * 360 + gapDeg / 2;
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    return { ...s, dash, rot, pct };
  });

  const empty = total <= 0;

  const mkTip = (label: string, value: number, pct: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget.closest(".donut-wrap") as HTMLElement)?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${label} · ${euro(value)} · ${pct.toFixed(1)} %` } : null;
  };
  const onEnter = (key: string, label: string, value: number, pct: number, e: React.MouseEvent) => {
    setHover(key);
    const t = mkTip(label, value, pct, e); if (t) setTip(t);
  };
  const onMove = (label: string, value: number, pct: number, e: React.MouseEvent) => {
    const t = mkTip(label, value, pct, e); if (t) setTip(t);
  };
  const onLeave = () => { setHover(null); setTip(null); }; // fixierten Tooltip (pin) bewusst NICHT löschen

  // Klick auf ein Segment: Ebene 1 → Drilldown; Ebene 2 → Tooltip fixieren (Touch).
  const onSegClick = (a: { key: string; label: string; value: number; pct: number }, e: React.MouseEvent) => {
    if (!side) {
      if (a.key === "ein" || a.key === "aus") { setSide(a.key); setPin(null); setTip(null); }
    } else {
      const t = mkTip(a.label, a.value, a.pct, e);
      setPin(t); setHover(a.key); e.stopPropagation();
    }
  };
  const onLegendClick = (a: { key: string }) => {
    if (!side && (a.key === "ein" || a.key === "aus")) { setSide(a.key); setPin(null); setTip(null); }
  };
  const back = () => { setSide(null); setPin(null); onLeave(); };
  const show = pin ?? tip;

  return (
    <div className="donut-wrap" style={{ position: "relative" }} onMouseLeave={onLeave} onClick={() => setPin(null)}>
      <style>{`
        .donut-svg { transition: opacity .35s ease; }
        .donut-seg { transition: stroke-width .18s ease, filter .18s ease, opacity .18s ease; }
        @keyframes donutIn { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: none } }
        .donut-anim { animation: donutIn .38s cubic-bezier(.22,.61,.36,1); }
        @media (prefers-reduced-motion: reduce) {
          .donut-svg, .donut-seg { transition: none; }
          .donut-anim { animation: none; }
        }
      `}</style>

      {side && (
        <button type="button" className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); back(); }}
          style={{ fontSize: 12, marginBottom: 10 }}>← Zurück</button>
      )}

      {empty ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
          <svg width="180" height="180" viewBox="0 0 240 240" style={{ transform: "scaleY(.92)" }} aria-hidden>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth={SW} />
          </svg>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {side ? "Keine Buchungen auf dieser Seite im Zeitraum." : "Keine Buchungen im Zeitraum."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
            <svg
              key={side ?? "ov"}
              className="donut-svg donut-anim"
              width="260" height="240" viewBox="0 0 240 240"
              style={{ transform: "scaleY(.92)", overflow: "visible", maxWidth: "100%" }}
              role="img"
              aria-label={side ? `Kategorien ${centerLabel}` : "Einnahmen und Ausgaben im Vergleich"}
            >
              <defs>
                <filter id={`sh-${uid}`} x="-30%" y="-20%" width="160%" height="150%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#000" floodOpacity="0.15" />
                </filter>
                {arcs.map((a) => (
                  <radialGradient key={a.key} id={`g-${uid}-${a.key}`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R + SW / 2}>
                    <stop offset="0" style={{ stopColor: light(a.color) }} />
                    <stop offset={String((R - SW / 2) / (R + SW / 2))} style={{ stopColor: light(a.color) }} />
                    <stop offset="0.82" style={{ stopColor: a.color }} />
                    <stop offset="1" style={{ stopColor: dark(a.color) }} />
                  </radialGradient>
                ))}
              </defs>

              {/* Schatten-Basisring (dezent) */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth={SW} opacity={0.35} filter={`url(#sh-${uid})`} />

              {arcs.map((a) => {
                const active = hover === a.key;
                return (
                  <circle
                    key={a.key}
                    className="donut-seg"
                    cx={CX} cy={CY} r={R}
                    fill="none"
                    stroke={`url(#g-${uid}-${a.key})`}
                    strokeWidth={active ? SW + 6 : SW}
                    strokeDasharray={`${a.dash} ${C - a.dash}`}
                    strokeLinecap="round"
                    transform={`rotate(${a.rot} ${CX} ${CY})`}
                    style={{
                      cursor: side ? "default" : "pointer",
                      filter: active ? "brightness(1.12)" : undefined,
                      opacity: hover && !active ? 0.72 : 1,
                    }}
                    onMouseEnter={(e) => onEnter(a.key, a.label, a.value, a.pct, e)}
                    onMouseMove={(e) => onMove(a.label, a.value, a.pct, e)}
                    onClick={(e) => onSegClick(a, e)}
                  >
                    <title>{`${a.label} · ${euro(a.value)} · ${a.pct.toFixed(1)} %`}</title>
                  </circle>
                );
              })}

              {/* Zentrum */}
              <text x={CX} y={CY - 4} textAnchor="middle" style={{ fill: centerColor, fontSize: 26, fontWeight: 700 }}>{centerBig}</text>
              <text x={CX} y={CY + 20} textAnchor="middle" style={{ fill: "var(--muted)", fontSize: 13, letterSpacing: 0.5 }}>{centerLabel}</text>
            </svg>

            {show && (
              <div style={{
                position: "absolute", left: show.x, top: show.y - 12, transform: "translate(-50%,-100%)",
                background: "var(--bg3)", border: "1px solid var(--line2)", borderRadius: 8, padding: "6px 10px",
                fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", pointerEvents: "none",
                boxShadow: "0 6px 18px rgba(0,0,0,.3)", zIndex: 5,
              }}>{show.text}</div>
            )}
          </div>

          {/* Legende */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 420, margin: "14px auto 0" }}>
            {arcs.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => onLegendClick(a)}
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  background: hover === a.key ? "var(--bg3)" : "transparent", border: "none",
                  borderRadius: 7, padding: "7px 8px", cursor: !side ? "pointer" : "default",
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: 3, background: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.label}>{a.label}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{a.pct.toFixed(1)} %</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: a.color, width: 96, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{euro(a.value)}</span>
              </button>
            ))}
          </div>

          {!side && (
            <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
              Tipp: Auf ein Segment tippen, um die Kategorien aufzuschlüsseln.
            </p>
          )}
        </>
      )}
    </div>
  );
}
