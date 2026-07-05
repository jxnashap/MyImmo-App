"use client";

// Interaktives Donut-Diagramm für die Ein-/Ausgaben-Seite.
// Ebene 1 (Overview): Einnahmen (orange) vs. Ausgaben (rot).
// Ebene 2 (Drilldown): Kategorien der gewählten Seite — GLEICHE Seitenfarbe, die pro
// Segment weiter verblasst (nach Betrag absteigend sortiert: groß = kräftig, klein = blass).
// Nur zwei Marken-Farben (var(--gold), var(--red)); Verblassung via color-mix gegen
// warmes Off-White. Eigenes SVG: dicker, leicht gekippter Ring, radiales Volumen,
// weicher Schatten, Glanz-Bogen. Segmente fahren per stroke-dasharray smooth ein.
// Wechsel per Toggle und horizontalem Swipe. prefers-reduced-motion wird respektiert.

import { useEffect, useMemo, useRef, useState, useId } from "react";
import { euro } from "@/lib/format";

type Kat = [string, number];

// Die einzigen beiden Diagrammfarben (aus globals.css).
const GOLD = "var(--gold)"; // #D4A847 — Einnahmen
const RED = "var(--red)";   //  #E05C4B — Ausgaben
const OFFWHITE = "#F7EFDD";  // nur Aufhell-Ziel der Rampe, keine eigene Diagrammfarbe

// Verblass-Rampe: base bleibt bei i=0 voll gesättigt, jedes weitere Segment blasser.
const ramp = (base: string, i: number, n: number) =>
  n <= 1 ? base : `color-mix(in srgb, ${base}, ${OFFWHITE} ${Math.round((i / (n - 1)) * 62)}%)`;

// Volumen: innen heller, außen dunkler — funktioniert auch mit der Rampenfarbe.
const inner = (c: string) => `color-mix(in srgb, ${c}, #fff 22%)`;
const outer = (c: string) => `color-mix(in srgb, ${c}, #000 30%)`;

type Seg = { key: string; label: string; value: number; color: string };

// Kategorien (bereits absteigend sortiert) in Segmente mit Verblass-Rampe wandeln.
// >8 Kategorien: kleinste zu „Sonstige" bündeln, damit der Ring lesbar bleibt.
function drill(kat: Kat[], base: string): Seg[] {
  const pos = kat.filter(([, v]) => v > 0);
  let items = pos;
  if (pos.length > 8) {
    const top = pos.slice(0, 7);
    const restSum = pos.slice(7).reduce((s, [, v]) => s + v, 0);
    items = restSum > 0 ? [...top, ["Sonstige", restSum] as Kat] : top;
  }
  const n = items.length;
  return items.map(([label, value], i) => ({ key: `${label}-${i}`, label, value, color: ramp(base, i, n) }));
}

// Auto-Schriftgröße für die Mittelzahl, damit große Beträge im Ring bleiben.
const centerFont = (s: string) => (s.length <= 9 ? 26 : s.length <= 12 ? 21 : s.length <= 15 ? 17 : 14);

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
  const [side, setSide] = useState<null | "ein" | "aus">(null); // null = Overview
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null); // Hover (flüchtig)
  const [pin, setPin] = useState<{ x: number; y: number; text: string } | null>(null); // Tap (fixiert)

  const [reduce, setReduce] = useState(false);
  const [grown, setGrown] = useState(false); // steuert die Einfahr-Animation je Ebene
  useEffect(() => {
    setReduce(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);
  useEffect(() => {
    if (reduce) { setGrown(true); return; }
    setGrown(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setGrown(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [side, reduce]);

  const overview: Seg[] = useMemo(
    () => [
      { key: "ein", label: "Einnahmen", value: einnahmenTotal, color: GOLD },
      { key: "aus", label: "Ausgaben", value: ausgabenTotal, color: RED },
    ].filter((s) => s.value > 0),
    [einnahmenTotal, ausgabenTotal],
  );

  const drillSegs = useMemo(
    () => (side === "ein" ? drill(einKat, GOLD) : side === "aus" ? drill(ausKat, RED) : []),
    [side, einKat, ausKat],
  );

  const segs = side ? drillSegs : overview;
  const total = segs.reduce((s, x) => s + x.value, 0);

  const sideBase = side === "ein" ? GOLD : side === "aus" ? RED : netto >= 0 ? GOLD : RED;
  const sideSum = side === "ein" ? einnahmenTotal : side === "aus" ? ausgabenTotal : 0;
  const centerBig = side ? euro(sideSum) : `${netto >= 0 ? "+ " : "− "}${euro(Math.abs(netto))}`;
  const centerLabel = side === "ein" ? "Einnahmen" : side === "aus" ? "Ausgaben" : "Netto";

  // Geometrie.
  const CX = 120, CY = 120, R = 84, SW = 30;
  const C = 2 * Math.PI * R;
  const gapPx = segs.length > 1 ? 7 : 0;

  let acc = 0;
  const arcs = segs.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const start = acc;
    acc += frac;
    const seg = frac * C;
    const dash = Math.max(seg - gapPx, 0.001);
    const gapDeg = (gapPx / C) * 360;
    const rot = -90 + start * 360 + gapDeg / 2;
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    return { ...s, dash, rot, pct, i };
  });

  const empty = total <= 0;

  const mkTip = (label: string, value: number, pct: number, e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const rect = (e.currentTarget.closest(".donut-wrap") as HTMLElement)?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${label} · ${euro(value)} · ${pct.toFixed(1)} %` } : null;
  };
  const onEnter = (key: string, label: string, value: number, pct: number, e: React.MouseEvent) => {
    setHover(key); const t = mkTip(label, value, pct, e); if (t) setTip(t);
  };
  const onMove = (label: string, value: number, pct: number, e: React.MouseEvent) => {
    const t = mkTip(label, value, pct, e); if (t) setTip(t);
  };
  const onLeave = () => { setHover(null); setTip(null); };

  // Swipe: horizontaler Wisch > 45px wechselt im Drilldown die Seite.
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; swiped.current = false; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current; startX.current = null;
    if (side && Math.abs(dx) > 45) { swiped.current = true; setSide(dx < 0 ? "aus" : "ein"); setPin(null); setTip(null); }
  };

  const onSegClick = (a: { key: string; label: string; value: number; pct: number }, e: React.MouseEvent) => {
    if (swiped.current) { swiped.current = false; return; } // war ein Swipe, kein Tap
    if (!side) {
      if (a.key === "ein" || a.key === "aus") { setSide(a.key); setPin(null); setTip(null); }
    } else {
      const t = mkTip(a.label, a.value, a.pct, e); setPin(t); setHover(a.key); e.stopPropagation();
    }
  };
  const onLegendClick = (a: { key: string }) => {
    if (!side && (a.key === "ein" || a.key === "aus")) { setSide(a.key); setPin(null); setTip(null); }
  };
  const goSide = (s: "ein" | "aus") => { setSide(s); setPin(null); setTip(null); };
  const back = () => { setSide(null); setPin(null); onLeave(); };
  const show = pin ?? tip;

  const segTransition = (i: number) =>
    reduce
      ? "stroke-width .18s ease, filter .18s ease, opacity .18s ease"
      : `stroke-dasharray .66s cubic-bezier(.22,.61,.36,1) ${i * 0.05}s, stroke-width .18s ease, filter .18s ease, opacity .18s ease`;

  return (
    <div className="donut-wrap" style={{ position: "relative", touchAction: "pan-y" }} onMouseLeave={onLeave} onClick={() => setPin(null)}>
      {/* Kopfzeile im Drilldown: Zurück + Umschalter */}
      {side && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); back(); }} style={{ fontSize: 12 }}>← Zurück</button>
          <div style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 8, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            {(["ein", "aus"] as const).map((s) => {
              const on = side === s;
              const col = s === "ein" ? GOLD : RED;
              return (
                <button key={s} type="button" onClick={() => goSide(s)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "6px 12px", border: "none", cursor: "pointer",
                    background: on ? (s === "ein" ? "var(--gold-pale)" : "var(--red-dim)") : "transparent",
                    color: on ? col : "var(--muted)",
                  }}>{s === "ein" ? "Einnahmen" : "Ausgaben"}</button>
              );
            })}
          </div>
        </div>
      )}

      {empty ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
          <svg width="180" height="180" viewBox="0 0 240 240" style={{ transform: "scaleY(.9)" }} aria-hidden>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth={SW} />
          </svg>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {side ? "Keine Buchungen auf dieser Seite im Zeitraum." : "Keine Buchungen im Zeitraum."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}
               onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            <svg
              width="260" height="240" viewBox="0 0 240 240"
              style={{ transform: "scaleY(.9)", overflow: "visible", maxWidth: "100%" }}
              role="img"
              aria-label={side ? `Kategorien ${centerLabel}` : "Einnahmen und Ausgaben im Vergleich"}
            >
              <defs>
                <filter id={`sh-${uid}`} x="-30%" y="-25%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1" stdDeviation="4" floodColor="#000" floodOpacity="0.22" />
                </filter>
                {arcs.map((a) => (
                  <radialGradient key={a.key} id={`g-${uid}-${a.key}`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R + SW / 2}>
                    <stop offset="0" style={{ stopColor: inner(a.color) }} />
                    <stop offset={String((R - SW / 2) / (R + SW / 2))} style={{ stopColor: inner(a.color) }} />
                    <stop offset="0.82" style={{ stopColor: a.color }} />
                    <stop offset="1" style={{ stopColor: outer(a.color) }} />
                  </radialGradient>
                ))}
              </defs>

              {/* Schatten-Basisring (dezent) */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth={SW} opacity={0.3} filter={`url(#sh-${uid})`} />

              {arcs.map((a) => {
                const active = hover === a.key;
                const targetDash = grown ? a.dash : 0.001;
                return (
                  <circle
                    key={a.key}
                    cx={CX} cy={CY} r={R}
                    fill="none"
                    stroke={`url(#g-${uid}-${a.key})`}
                    strokeWidth={active ? SW + 6 : SW}
                    strokeDasharray={`${targetDash} ${C - targetDash}`}
                    strokeLinecap="round"
                    transform={`rotate(${a.rot} ${CX} ${CY})`}
                    style={{
                      cursor: side ? "default" : "pointer",
                      transition: segTransition(a.i),
                      filter: active ? "brightness(1.1)" : undefined,
                      opacity: hover && !active ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => onEnter(a.key, a.label, a.value, a.pct, e)}
                    onMouseMove={(e) => onMove(a.label, a.value, a.pct, e)}
                    onClick={(e) => onSegClick(a, e)}
                  >
                    <title>{`${a.label} · ${euro(a.value)} · ${a.pct.toFixed(1)} %`}</title>
                  </circle>
                );
              })}

              {/* Glanz-Bogen am oberen Rand (Highlight) */}
              <circle
                cx={CX} cy={CY} r={R} fill="none" stroke="#fff" strokeWidth={SW * 0.44}
                strokeLinecap="round" strokeDasharray={`${C * 0.13} ${C}`}
                transform={`rotate(-118 ${CX} ${CY})`}
                style={{ opacity: 0.22, pointerEvents: "none" }}
              />

              {/* Zentrum (Auto-Font) */}
              <text x={CX} y={CY - 4} textAnchor="middle" style={{ fill: sideBase, fontSize: centerFont(centerBig), fontWeight: 700 }}>{centerBig}</text>
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
