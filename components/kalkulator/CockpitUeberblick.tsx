"use client";

import { useState } from "react";
import { fmtE, pct, fmt } from "@/lib/kalk";

export type UeberblickProps = {
  kp: number;
  gesamtInvest: number;
  eigenkapital: number;
  gesRate: number;
  nettokaltmiete: number;
  brutto: number;
  nettomiet: number;
  ekRendite: number;
  faktor: number;
  cfOp: number;
  cfNetto: number;
  verlauf: { yr: number; wert: number; rs: number }[];
};

// kleiner Ampel-Score 0..1 aus vier Kernkriterien
function score(p: UeberblickProps): number {
  let s = 0;
  s += p.brutto >= 5 ? 1 : p.brutto >= 4 ? 0.5 : 0;
  s += p.cfNetto >= 0 ? 1 : p.cfNetto >= -100 ? 0.5 : 0;
  s += p.ekRendite >= 15 ? 1 : p.ekRendite >= 8 ? 0.5 : 0;
  s += p.faktor > 0 && p.faktor <= 22 ? 1 : p.faktor > 0 && p.faktor <= 28 ? 0.5 : 0;
  return s / 4;
}

export default function CockpitUeberblick(p: UeberblickProps) {
  const [zielfaktor, setZielfaktor] = useState(25);

  const sc = score(p);
  const verdict =
    sc >= 0.75
      ? { label: "Solide", color: "var(--green)", bg: "var(--green-dim)", icon: "🟢" }
      : sc >= 0.45
        ? { label: "Grenzwertig", color: "var(--amber)", bg: "rgba(240,160,48,0.12)", icon: "🟡" }
        : { label: "Kritisch", color: "var(--red)", bg: "var(--red-dim)", icon: "🔴" };
  const satz =
    sc >= 0.75
      ? "Rendite, Cashflow und Kaufpreisfaktor liegen im gesunden Bereich — tragfähiges Investment."
      : sc >= 0.45
        ? "Einzelne Kennzahlen sind knapp — vor dem Kauf Finanzierung und Miete kritisch prüfen."
        : "Mehrere Kennzahlen sind schwach — so gerechnet ist das Objekt riskant/zu teuer.";

  // Preis-Einordnung: fairer Preis nach Zielfaktor vs. Angebot
  const fairerPreis = p.nettokaltmiete > 0 ? p.nettokaltmiete * 12 * zielfaktor : 0;
  const abweichung = fairerPreis > 0 && p.kp > 0 ? ((p.kp - fairerPreis) / fairerPreis) * 100 : 0;

  // 30-Jahre-Chart (Wert vs. Restschuld, Fläche = Eigenkapital)
  const W = 600, H = 200, PAD = 8;
  const maxV = Math.max(1, ...p.verlauf.map((r) => r.wert));
  const n = p.verlauf.length;
  const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / maxV) * (H - 2 * PAD);
  const wertPts = p.verlauf.map((r, i) => `${x(i)},${y(r.wert)}`).join(" ");
  const rsPts = p.verlauf.map((r, i) => `${x(i)},${y(r.rs)}`).join(" ");
  const areaPts =
    p.verlauf.map((r, i) => `${x(i)},${y(r.wert)}`).join(" ") +
    " " +
    [...p.verlauf].map((r, i) => `${x(n - 1 - i)},${y(p.verlauf[n - 1 - i].rs)}`).join(" ");

  const kern: [string, string, string][] = [
    ["Gesamtinvestition", fmtE(p.gesamtInvest), ""],
    ["Eigenkapital", fmtE(p.eigenkapital), "gold"],
    ["Cashflow n. St.", fmtE(p.cfNetto) + "/Mo", p.cfNetto >= 0 ? "green" : "red"],
    ["EK-Rendite", pct(p.ekRendite), p.ekRendite >= 10 ? "green" : ""],
  ];

  return (
    <div className="fade-up">
      {/* Verdict-Banner */}
      <div
        className="card mb-20"
        style={{ borderColor: verdict.color, background: verdict.bg }}
      >
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 30, lineHeight: 1 }}>{verdict.icon}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: verdict.color }}>
              {verdict.label}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{satz}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Score</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: verdict.color }}>{Math.round(sc * 100)}</div>
          </div>
        </div>
      </div>

      {/* Kernzahlen */}
      <div className="grid-4 mb-20">
        {kern.map((k, i) => (
          <div key={i} className="stat-box">
            <div className="stat-lbl">{k[0]}</div>
            <div className={`stat-val ${k[2]}`} style={{ fontSize: 16 }}>{k[1]}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-20">
        {/* Preis-Einordnung */}
        <div className="card">
          <div className="card-header"><div className="card-title">💰 Preis-Einordnung</div></div>
          <div className="card-body">
            <div className="range-row" style={{ marginBottom: 14 }}>
              <label style={{ minWidth: 130, fontSize: 12, color: "var(--muted)" }}>Zielfaktor</label>
              <input type="range" min={15} max={35} step={0.5} value={zielfaktor} onChange={(e) => setZielfaktor(Number(e.target.value))} />
              <span className="range-val">{fmt(zielfaktor, 1)}x</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="stat-box"><div className="stat-lbl">Fairer Preis (Ziel)</div><div className="stat-val gold" style={{ fontSize: 15 }}>{fairerPreis > 0 ? fmtE(fairerPreis) : "–"}</div></div>
              <div className="stat-box"><div className="stat-lbl">Angebot (Kaufpreis)</div><div className="stat-val" style={{ fontSize: 15 }}>{p.kp > 0 ? fmtE(p.kp) : "–"}</div></div>
            </div>
            {fairerPreis > 0 && p.kp > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: abweichung <= 0 ? "var(--green)" : abweichung <= 10 ? "var(--amber)" : "var(--red)", fontWeight: 600 }}>
                {abweichung <= 0
                  ? `${pct(-abweichung, 0)} unter deinem Zielpreis — günstig.`
                  : `${pct(abweichung, 0)} über deinem Zielpreis (Faktor ${fmt(p.faktor, 1)}x).`}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--faint)" }}>
              Fairer Preis = Jahresnettokaltmiete × Zielfaktor. Aktueller Faktor: {p.faktor > 0 ? fmt(p.faktor, 1) + "x" : "–"}.
            </div>
          </div>
        </div>

        {/* 30-Jahre-Verlauf-Chart */}
        <div className="card">
          <div className="card-header"><div className="card-title">📈 Vermögensaufbau (30 J.)</div></div>
          <div className="card-body">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" preserveAspectRatio="none" role="img" aria-label="Immobilienwert gegen Restschuld über 30 Jahre">
              <polygon points={areaPts} fill="var(--gold-pale)" />
              <polyline points={wertPts} fill="none" stroke="var(--gold)" strokeWidth={2} />
              <polyline points={rsPts} fill="none" stroke="var(--red)" strokeWidth={2} strokeDasharray="4 3" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
              <span>{p.verlauf[0]?.yr ?? ""}</span>
              <span style={{ color: "var(--gold)" }}>■ Wert</span>
              <span style={{ color: "var(--red)" }}>▬ Restschuld</span>
              <span>{p.verlauf[n - 1]?.yr ?? ""}</span>
            </div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="stat-box"><div className="stat-lbl">Wert in {p.verlauf[n - 1]?.yr ?? "30 J."}</div><div className="stat-val" style={{ fontSize: 15 }}>{fmtE(p.verlauf[n - 1]?.wert ?? 0)}</div></div>
              <div className="stat-box"><div className="stat-lbl">Eigenkapital dann</div><div className="stat-val gold" style={{ fontSize: 15 }}>{fmtE((p.verlauf[n - 1]?.wert ?? 0) - (p.verlauf[n - 1]?.rs ?? 0))}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
