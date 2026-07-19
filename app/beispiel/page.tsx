"use client";

// Beispiel-Design ("Bento / Glow"-Richtung) auf echten MyImmo-Daten-Attrappen.
// Eigene Route, Vollbild-Overlay, gekapseltes CSS-Modul — die bestehende App
// bleibt unberührt. Zweck: Design-Richtung live in der App-Umgebung zeigen.

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./beispiel.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
const eur = (n: number) => "€ " + n.toLocaleString("de-DE");

// ---- Donut-Daten: Portfolio-Wert nach Objekt (außen 2026, innen 2025) ----
type Seg = { key: string; name: string; sub: string; wert: number; prevWert: number; color: string; glow: string };
const OBJEKTE: Seg[] = [
  { key: "lind", name: "Lindenweg 4", sub: "Mehrfamilienhaus", wert: 638000, prevWert: 600000, color: "#DDB65C", glow: "rgba(221,182,92,.9)" },
  { key: "must", name: "Musterstraße 12", sub: "Eigentumswohnung", wert: 342000, prevWert: 320000, color: "#35C7E0", glow: "rgba(53,199,224,.9)" },
  { key: "gart", name: "Gartenstraße 8", sub: "Einfamilienhaus", wert: 214000, prevWert: 208000, color: "#4FD1A1", glow: "rgba(79,209,161,.9)" },
  { key: "hafe", name: "Hafenblick 21", sub: "Ferienimmobilie", wert: 90000, prevWert: 84000, color: "#F0A93E", glow: "rgba(240,169,62,.9)" },
];
const TOTAL = OBJEKTE.reduce((s, o) => s + o.wert, 0);
const TOTAL_PREV = OBJEKTE.reduce((s, o) => s + o.prevWert, 0);

// ---- Donut-Geometrie ----
const C = 144, RO = 108, RI = 68, SWO = 30, SWI = 15, GAP = 14;
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
const arc = (r: number, a0: number, a1: number) => {
  const s = polar(r, a0), e = polar(r, a1), large = a1 - a0 > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
};
function ring(r: number, key: "wert" | "prevWert", total: number) {
  let start = 0;
  return OBJEKTE.map((o, i) => {
    const sweep = (o[key] / total) * 360;
    let a0 = start + GAP / 2, a1 = start + sweep - GAP / 2;
    if (a1 - a0 < 3) a1 = a0 + 3;
    start += sweep;
    const mid = (a0 + a1) / 2;
    const rad = ((mid - 90) * Math.PI) / 180;
    return { i, d: arc(r, a0, a1), color: o.color, glow: o.glow, dx: Math.cos(rad) * 9, dy: Math.sin(rad) * 9 };
  });
}

// ---- Area-Chart-Daten ----
const AW = 560, AH = 180, APAD = 14;
type AreaKey = "wert" | "cashflow" | "miete";
const SERIES: Record<AreaKey, { title: string; big: string; chip: string; up: boolean; color: string; pts: number[] }> = {
  wert:     { title: "Portfolio-Wert", big: eur(1284000), chip: "+5,9 %", up: true, color: "#DDB65C", pts: [62, 60, 58, 52, 50, 44, 40, 34, 30, 24, 20, 15] },
  cashflow: { title: "Cashflow", big: "+ " + eur(1920), chip: "+8,4 %", up: true, color: "#4FD1A1", pts: [74, 70, 66, 62, 58, 52, 50, 42, 38, 30, 26, 20] },
  miete:    { title: "Kaltmiete", big: eur(5840), chip: "+3,1 %", up: true, color: "#35C7E0", pts: [40, 40, 38, 36, 35, 33, 32, 30, 29, 27, 26, 24] },
};
function areaPaths(pts: number[]) {
  const n = pts.length, step = AW / (n - 1);
  const co = pts.map((v, i) => ({ x: i * step, y: APAD + (v / 100) * (AH - APAD * 2) }));
  let d = `M${co[0].x} ${co[0].y}`;
  for (let i = 1; i < n; i++) {
    const p0 = co[i - 1], p1 = co[i], cxp = (p0.x + p1.x) / 2;
    d += ` C${cxp} ${p0.y} ${cxp} ${p1.y} ${p1.x} ${p1.y}`;
  }
  return { stroke: d, fill: `${d} L${AW} ${AH} L0 ${AH} Z`, last: co[n - 1] };
}

// ---- Tabelle ----
const Rows = [
  { name: "Musterstraße 12", sub: "Eigentumswohnung · Lübeck", status: "Vermietet", miete: "€ 1.180", rendite: "5,8 %", tilg: 62, wert: "€ 342.000", sc: "#4FD1A1" },
  { name: "Lindenweg 4", sub: "Mehrfamilienhaus · 6 Einheiten", status: "Vermietet", miete: "€ 3.240", rendite: "6,1 %", tilg: 38, wert: "€ 638.000", sc: "#4FD1A1" },
  { name: "Gartenstraße 8", sub: "Einfamilienhaus · Ratzeburg", status: "Eigennutzung", miete: "—", rendite: "—", tilg: 81, wert: "€ 214.000", sc: "#DDB65C" },
  { name: "Hafenblick 21", sub: "Ferienimmobilie · Timmendorf", status: "Leer", miete: "€ 1.420", rendite: "4,9 %", tilg: 24, wert: "€ 90.000", sc: "#F06E6E" },
];

const Up = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 15 7-7 7 7" /></svg>);
const Dn = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 9 7 7 7-7" /></svg>);
const HouseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V10l9-6 9 6v11" /><path d="M9 21v-6h6v6" /></svg>);

export default function BeispielPage() {
  const [active, setActive] = useState<number | null>(null);
  const [showPrev, setShowPrev] = useState(true);
  const [tab, setTab] = useState<AreaKey>("wert");

  const outer = useMemo(() => ring(RO, "wert", TOTAL), []);
  const inner = useMemo(() => ring(RI, "prevWert", TOTAL_PREV), []);
  const s = SERIES[tab];
  const ap = useMemo(() => areaPaths(s.pts), [s]);

  const centerCap = active === null ? "Portfolio-Wert 2026" : OBJEKTE[active].name;
  const centerVal = active === null ? eur(TOTAL) : eur(OBJEKTE[active].wert);
  const centerColor = active === null ? "var(--text)" : OBJEKTE[active].color;
  const pctOf = (o: Seg) => Math.round((o.wert / TOTAL) * 1000) / 10;

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <Link href="/" className={styles.back}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
          Zurück zur App
        </Link>
        <div>
          <div className={styles.wm}>My<em>Immo</em></div>
          <div className={styles.tagline}>Dashboard · Design-Entwurf</div>
        </div>
        <span className={styles.demoBadge}>BEISPIEL-DESIGN</span>
      </header>

      <div className={styles.grid}>
        {/* KPI */}
        {[
          { lbl: "Portfolio-Wert", val: eur(1284000), chip: "+5,9 %", up: true, note: "4 Objekte" },
          { lbl: "Einnahmen / Mo.", val: eur(5840), chip: "+3,1 %", up: true, note: "5,5 % Rendite" },
          { lbl: "Cashflow / Mo.", val: "+ " + eur(1920), chip: "Positiv", up: true, note: "nach Kredit" },
          { lbl: "Leerstandsquote", val: "3,1 %", chip: "gesund", up: true, note: "1 von 12" },
        ].map((k) => (
          <div key={k.lbl} className={cx(styles.card, styles.kpi)}>
            <div className={styles.lbl}>{k.lbl}</div>
            <div className={styles.val}>{k.val}</div>
            <div className={styles.foot}>
              <span className={cx(styles.chip, k.up ? styles.up : styles.dn)}>{k.up ? <Up /> : <Dn />}{k.chip}</span>
              <span className={styles.note}>{k.note}</span>
            </div>
          </div>
        ))}

        {/* DONUT */}
        <div className={cx(styles.card, styles.donutCard)}>
          <div className={styles.cardH}>
            <div><h3>Portfolio-Wert nach Objekt</h3><div className={styles.sub}>Außen = 2026 · Innen = 2025</div></div>
            <div className={styles.ringToggle}>
              <button className={showPrev ? styles.on : undefined} onClick={() => setShowPrev(true)}>Beide</button>
              <button className={!showPrev ? styles.on : undefined} onClick={() => setShowPrev(false)}>2026</button>
            </div>
          </div>
          <div className={styles.donutWrap}>
            <div className={styles.donut}>
              <svg viewBox="0 0 288 288" role="img" aria-label="Portfolio-Wert nach Objekt">
                <circle cx={C} cy={C} r={RO} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={SWO} />
                <circle cx={C} cy={C} r={RI} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={SWI} />
                {showPrev && inner.map((seg) => (
                  <path key={"in" + seg.i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={SWI} strokeLinecap="round"
                    className={cx(styles.seg, styles.segIn)} style={{ opacity: active === null || active === seg.i ? 0.5 : 0.18 }} />
                ))}
                {outer.map((seg) => {
                  const on = active === seg.i;
                  return (
                    <path key={"out" + seg.i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={SWO} strokeLinecap="round"
                      className={cx(styles.seg, active !== null && !on && styles.segDim)}
                      style={{ transform: on ? `translate(${seg.dx.toFixed(1)}px,${seg.dy.toFixed(1)}px) scale(1.05)` : undefined, filter: on ? `drop-shadow(0 0 10px ${seg.glow})` : undefined }}
                      onMouseEnter={() => setActive(seg.i)} onMouseLeave={() => setActive(null)} />
                  );
                })}
              </svg>
              <div className={styles.center}>
                <div className={styles.cCap} style={{ color: active === null ? undefined : centerColor }}>{centerCap}</div>
                <div className={styles.cVal} style={{ color: centerColor }}>{centerVal}</div>
                <div className={styles.cSub}>
                  {active === null ? <><b>+5,9 %</b> ggü. 2025</> : <><b>{pctOf(OBJEKTE[active])} %</b> des Portfolios</>}
                </div>
              </div>
            </div>
            <div className={styles.legend}>
              {OBJEKTE.map((o, i) => (
                <div key={o.key} className={cx(styles.lg, active === i && styles.lgHot)}
                  onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                  <span className={styles.sw} style={{ background: o.color }} />
                  <span><div className={styles.lName}>{o.name}</div><div className={styles.lPct}>{pctOf(o)} % · {o.sub}</div></span>
                  <span className={styles.lAmt}>{eur(o.wert)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AREA */}
        <div className={cx(styles.card, styles.span2)}>
          <div className={styles.cardH}>
            <div><h3>{s.title}</h3><div className={styles.sub}>Letzte 12 Monate · rollierend</div></div>
            <div className={styles.tabs}>
              {(["wert", "cashflow", "miete"] as AreaKey[]).map((k) => (
                <button key={k} className={tab === k ? styles.on : undefined} onClick={() => setTab(k)}>
                  {SERIES[k].title}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.areaVal}>
            <span className={cx(styles.big, styles.num)}>{s.big}</span>
            <span className={cx(styles.chip, s.up ? styles.up : styles.dn)}>{s.up ? <Up /> : <Dn />}{s.chip}</span>
          </div>
          <svg viewBox={`0 0 ${AW} ${AH}`} width="100%" height="auto" preserveAspectRatio="none" style={{ display: "block" }}>
            <defs>
              <linearGradient id="bg-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="1" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {[30, 70, 110, 150].map((y) => <line key={y} x1={0} x2={AW} y1={y} y2={y} stroke="rgba(255,255,255,.05)" />)}
            <path d={ap.fill} fill="url(#bg-area)" />
            <path key={tab} className={styles.areaLine} pathLength={1} d={ap.stroke} fill="none" stroke={s.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={ap.last.x} cy={ap.last.y} r={4.5} fill={s.color} style={{ filter: `drop-shadow(0 0 7px ${s.color})` }} />
          </svg>
        </div>

        {/* TABELLE */}
        <div className={cx(styles.card, styles.span4, styles.pad0)}>
          <div style={{ padding: "18px 18px 12px" }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 650 }}>Objekte</h3>
            <div className={styles.sub} style={{ marginTop: 2 }}>4 Immobilien · 12 Einheiten</div>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead><tr><th>Objekt</th><th>Status</th><th style={{ textAlign: "right" }}>Kaltmiete / Mo.</th><th style={{ textAlign: "right" }}>Rendite</th><th>Tilgung</th><th style={{ textAlign: "right" }}>Aktueller Wert</th></tr></thead>
              <tbody>
                {Rows.map((r) => (
                  <tr key={r.name}>
                    <td><div className={styles.obj}><span className={styles.thumb}><HouseIcon /></span><div><div className={styles.oName}>{r.name}</div><div className={styles.oSub}>{r.sub}</div></div></div></td>
                    <td><span className={styles.pill} style={{ background: r.sc + "24", color: r.sc }}>{r.status}</span></td>
                    <td className={cx(styles.num, "r")} style={{ textAlign: "right", fontWeight: 650 }}>{r.miete}</td>
                    <td className={cx(styles.num, "r")} style={{ textAlign: "right", color: r.rendite === "—" ? "var(--faint)" : "var(--emerald)", fontWeight: 650 }}>{r.rendite}</td>
                    <td><div className={styles.tilg}><div className={styles.bar}><div className={styles.fill} style={{ width: r.tilg + "%" }} /></div><span className={cx(styles.pct, styles.num)}>{r.tilg} % getilgt</span></div></td>
                    <td className={cx(styles.num, styles.money, "r")} style={{ textAlign: "right" }}>{r.wert}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.footNote}>Design-Entwurf · nur Beispiel-Daten · die bestehende App ist unverändert</div>
      </div>
    </div>
  );
}
