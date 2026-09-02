"use client";

// Interaktives Donut-Diagramm für die Ein-/Ausgaben-Seite.
// Ebene 1 (Overview): Einnahmen (grün) vs. Ausgaben (rot).
// Ebene 2 (Drilldown): Kategorien der gewählten Seite — GLEICHE Seitenfarbe, die pro
// Segment weiter verblasst (nach Betrag absteigend sortiert: groß = kräftig, klein = blass).
// Nur zwei Semantik-Farben (var(--green), var(--red)); Verblassung via color-mix gegen
// die Kartenfläche (theme-aware). Design bewusst FLACH & minimal (Frosted Paper):
// echter Kreis (keine Fake-3D-Kippung, kein Glanz-Bogen), schlanker Ring mit
// weichen Kappen, dezenter Grundring. Segmente fahren per stroke-dasharray smooth ein.
// Hover lässt das Segment in seiner eigenen Farbe sanft glühen.
// Wechsel per Toggle und horizontalem Swipe. prefers-reduced-motion wird respektiert.

import { useEffect, useMemo, useRef, useState, useId } from "react";
import { euro, prozent } from "@/lib/format";

type Kat = [string, number];

// Die einzigen beiden Diagrammfarben (aus globals.css).
const GRUEN = "var(--green)"; // Einnahmen — semantisch wie die KPI-Karten
const RED = "var(--red)";   //  #E05C4B — Ausgaben
// Aufhell-Ziel der Rampe = die Kartenfläche (--bg2) → funktioniert in Hell UND Dunkel
// (Segmente verblassen in den Hintergrund statt in ein festes warmes Creme).
const FADE = "var(--bg2)";

// Verblass-Rampe: base bleibt bei i=0 voll gesättigt, jedes weitere Segment blasser.
const ramp = (base: string, i: number, n: number) =>
  n <= 1 ? base : `color-mix(in srgb, ${base}, ${FADE} ${Math.round((i / (n - 1)) * 60)}%)`;

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
// Schlanker Ring = größeres Innenloch → die Zahl darf etwas kräftiger stehen.
const centerFont = (s: string) => (s.length <= 9 ? 30 : s.length <= 12 ? 24 : s.length <= 15 ? 19 : 15);

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
      { key: "ein", label: "Einnahmen", value: einnahmenTotal, color: GRUEN },
      { key: "aus", label: "Ausgaben", value: ausgabenTotal, color: RED },
    ].filter((s) => s.value > 0),
    [einnahmenTotal, ausgabenTotal],
  );

  const drillSegs = useMemo(
    () => (side === "ein" ? drill(einKat, GRUEN) : side === "aus" ? drill(ausKat, RED) : []),
    [side, einKat, ausKat],
  );

  const segs = side ? drillSegs : overview;
  const total = segs.reduce((s, x) => s + x.value, 0);

  const sideBase = side === "ein" ? GRUEN : side === "aus" ? RED : netto >= 0 ? GRUEN : RED;
  const sideSum = side === "ein" ? einnahmenTotal : side === "aus" ? ausgabenTotal : 0;
  const centerBig = side ? euro(sideSum) : `${netto >= 0 ? "+ " : "− "}${euro(Math.abs(netto))}`;
  const centerLabel = side === "ein" ? "Einnahmen" : side === "aus" ? "Ausgaben" : "Netto";

  // Geometrie — schlanker Ring, echter Kreis (keine Kippung mehr).
  const CX = 120, CY = 120, R = 88, SW = 22;
  const C = 2 * Math.PI * R;
  const gapPx = segs.length > 1 ? 6 : 0;

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
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${label} · ${euro(value)} · ${prozent(pct)}` } : null;
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
    if (side && Math.abs(dx) > 45) {
      swiped.current = true;
      setSide(dx < 0 ? "aus" : "ein"); setPin(null); setTip(null);
      // Marke wieder freigeben, sobald der Klick durch ist. Vorher wurde sie
      // NUR in onSegClick zurückgesetzt — endete ein Wisch neben einem Segment
      // (Innenloch, Leerfläche), blieb sie stehen und verschluckte den nächsten
      // echten Tap. Auf dem Handy war das der Regelfall.
      setTimeout(() => { swiped.current = false; }, 0);
    }
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
          <div style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 999, overflow: "hidden", padding: 2, gap: 2 }} onClick={(e) => e.stopPropagation()}>
            {(["ein", "aus"] as const).map((s) => {
              const on = side === s;
              const col = s === "ein" ? GRUEN : RED;
              return (
                <button key={s} type="button" onClick={() => goSide(s)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 14px", border: "none", borderRadius: 999, cursor: "pointer",
                    // Einnahmen grün, Ausgaben rot — vorher war die aktive
                    // Einnahmen-Pille gold hinterlegt (grüner Text auf Gold).
                    background: on ? (s === "ein" ? "var(--green-dim)" : "var(--red-dim)") : "transparent",
                    color: on ? col : "var(--muted)", transition: "background .15s ease, color .15s ease",
                  }}>{s === "ein" ? "Einnahmen" : "Ausgaben"}</button>
              );
            })}
          </div>
        </div>
      )}

      {empty ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
          <svg width="180" height="180" viewBox="0 0 240 240" aria-hidden>
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
              width="240" height="240" viewBox="0 0 240 240"
              style={{ overflow: "visible", maxWidth: "100%" }}
              role="img"
              aria-label={side ? `Kategorien ${centerLabel}` : "Einnahmen und Ausgaben im Vergleich"}
            >
              {/* Dezenter Grundring (der „leere" Rest des Kreises) */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--bg4)" strokeWidth={SW} opacity={0.45} />

              {arcs.map((a) => {
                const active = hover === a.key;
                const targetDash = grown ? a.dash : 0.001;
                return (
                  <circle
                    key={a.key}
                    cx={CX} cy={CY} r={R}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={active ? SW + 5 : SW}
                    strokeDasharray={`${targetDash} ${C - targetDash}`}
                    strokeLinecap="round"
                    transform={`rotate(${a.rot} ${CX} ${CY})`}
                    style={{
                      cursor: side ? "default" : "pointer",
                      transition: segTransition(a.i),
                      // Hover: sanftes Glühen in der EIGENEN Segmentfarbe (statt Aufhellen).
                      filter: active ? `drop-shadow(0 0 7px ${a.color})` : undefined,
                      opacity: hover && !active ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => onEnter(a.key, a.label, a.value, a.pct, e)}
                    onMouseMove={(e) => onMove(a.label, a.value, a.pct, e)}
                    onClick={(e) => onSegClick(a, e)}
                  >
                    <title>{`${a.label} · ${euro(a.value)} · ${prozent(a.pct)}`}</title>
                  </circle>
                );
              })}

              {/* Zentrum (Auto-Font) — flach, ohne Glanz. Label klein & versal. */}
              <text x={CX} y={CY - 3} textAnchor="middle" style={{ fill: sideBase, fontSize: centerFont(centerBig), fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>{centerBig}</text>
              <text x={CX} y={CY + 21} textAnchor="middle" style={{ fill: "var(--muted)", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" }}>{centerLabel}</text>
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
                <span style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{prozent(a.pct)}</span>
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
