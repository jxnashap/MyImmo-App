"use client";

// Kauf-Radar (Design-Handoff Phase 2): gespeicherte Kauf-Kalkulationen als
// Deal-Score-Karten (4 Teilwerte à 0–25, conic-gradient-Ring) + Duell
// (7 Kriterien, Gold markiert den Gewinner). Rendite/Cashflow kommen aus den
// Zahlen, Lage/Zustand schätzt der Nutzer je Objekt selbst ein (0–25).

import { useMemo, useState, useTransition } from "react";
import { Building2, SlidersHorizontal } from "lucide-react";
import { dealScore, scoreUrteil, szenario, NEBENKOSTEN_SATZ, BEWIRTSCHAFTUNG } from "@/lib/finanz";
import { saveRadarWerte } from "@/lib/actions/kalkulation";

export type RadarKandidat = {
  id: string;
  name: string;
  preis: number;
  miete: number; // Kaltmiete €/Monat
  flaeche: number | null;
  lage: number | null; // 0–25, null = noch nicht eingeschätzt
  zustand: number | null;
};

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const signed = (n: number) => `${n >= 0 ? "+ " : "− "}${eur(Math.abs(n))}`;
const pct1 = (n: number) => n.toFixed(1).replace(".", ",") + " %";

export default function KaufRadar({ kandidaten }: { kandidaten: RadarKandidat[] }) {
  // Szenario-Werte für den Cashflow-Anteil (gleiche Formeln wie /kredite).
  const [ekQuote, setEkQuote] = useState(20);
  const [zins, setZins] = useState(3.9);
  const [tilgung, setTilgung] = useState(2);
  const [duellA, setDuellA] = useState(0);
  const [duellB, setDuellB] = useState(Math.min(1, Math.max(0, kandidaten.length - 1)));

  const cfFor = (k: RadarKandidat) =>
    szenario({ kaufpreis: k.preis, ekQuote, zins, tilgung, miete: k.miete }).cashflow;

  const karten = useMemo(
    () =>
      kandidaten.map((k) => {
        const rendite = k.preis > 0 ? ((k.miete * 12) / k.preis) * 100 : 0;
        const cf = cfFor(k);
        const d = dealScore(rendite, cf, k.lage ?? 12, k.zustand ?? 12);
        const u = scoreUrteil(d.score);
        return { k, rendite, cf, ...d, urteil: u, offen: k.lage == null || k.zustand == null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kandidaten, ekQuote, zins, tilgung],
  );

  if (kandidaten.length === 0) {
    return (
      <div className="section">
        <div className="section-header"><div><h3>Kauf-Radar</h3><div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>Jedes gespeicherte Objekt bekommt einen Deal-Score aus harten Fakten</div></div></div>
        <div className="section-body">
          <div className="empty">
            <Building2 className="empty-icon" size={36} color="var(--faint)" />
            <p>Noch keine gespeicherten Objekte — rechne unten im Objekt-Rechner und tippe auf „Objekt speichern". Jedes gespeicherte Objekt erscheint hier mit Deal-Score und im Duell.</p>
          </div>
        </div>
      </div>
    );
  }

  const twLbl = ["Rendite", "Cashflow", "Lage", "Zustand"];
  const A = karten[Math.min(duellA, karten.length - 1)];
  const B = karten[Math.min(duellB, karten.length - 1)];

  type Row = { lbl: string; a: string; b: string; aWin: boolean; bWin: boolean };
  const mkRow = (lbl: string, va: number, vb: number, fa: string, fb: string, higherWins: boolean): Row => {
    const tie = va === vb;
    const aWin = !tie && (higherWins ? va > vb : va < vb);
    return { lbl, a: fa, b: fb, aWin, bWin: !tie && !aWin };
  };
  const rows: Row[] = A && B ? [
    mkRow("Kaufpreis", A.k.preis, B.k.preis, eur(A.k.preis), eur(B.k.preis), false),
    mkRow("Preis je m²", A.k.flaeche ? A.k.preis / A.k.flaeche : Infinity, B.k.flaeche ? B.k.preis / B.k.flaeche : Infinity,
      A.k.flaeche ? eur(A.k.preis / A.k.flaeche) : "—", B.k.flaeche ? eur(B.k.preis / B.k.flaeche) : "—", false),
    mkRow("Kaltmiete / Jahr", A.k.miete * 12, B.k.miete * 12, eur(A.k.miete * 12), eur(B.k.miete * 12), true),
    mkRow("Bruttorendite", A.rendite, B.rendite, pct1(A.rendite), pct1(B.rendite), true),
    mkRow("Cashflow / Mo. (dein Szenario)", A.cf, B.cf, signed(A.cf), signed(B.cf), true),
    mkRow("Zustand (Score-Anteil)", A.teilwerte[3], B.teilwerte[3], `${A.teilwerte[3]} / 25`, `${B.teilwerte[3]} / 25`, true),
    mkRow("Deal-Score", A.score, B.score, `${A.score} / 100`, `${B.score} / 100`, true),
  ] : [];
  const punkteA = rows.filter((r) => r.aWin).length;
  const punkteB = rows.filter((r) => r.bWin).length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 22 }}>
        {karten.map((c) => <ScoreKarte key={c.k.id} c={c} twLbl={twLbl} />)}
      </div>

      <div className="section">
        <div className="section-header">
          <div><h3>Szenario für den Cashflow-Anteil</h3><div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>Gilt für alle Karten und das Duell — {NEBENKOSTEN_SATZ * 100} % Nebenkosten, € {BEWIRTSCHAFTUNG} Bewirtschaftung</div></div>
        </div>
        <div className="section-body">
          <div className="range-row"><label>Eigenkapital</label><input type="range" min={0} max={50} step={5} value={ekQuote} onChange={(e) => setEkQuote(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{ekQuote} %</span></div>
          <div className="range-row"><label>Sollzins p. a.</label><input type="range" min={2.5} max={6.5} step={0.1} value={zins} onChange={(e) => setZins(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{pct1(zins)}</span></div>
          <div className="range-row" style={{ marginBottom: 0 }}><label>Tilgung p. a.</label><input type="range" min={1} max={4} step={0.25} value={tilgung} onChange={(e) => setTilgung(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{pct1(tilgung)}</span></div>
        </div>
      </div>

      {karten.length >= 2 && (
        <div className="section">
          <div className="section-header">
            <div><h3>Duell</h3><div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>Zwei Objekte, Zeile für Zeile — Gold markiert den Gewinner</div></div>
            <span className="badge badge-gold">{punkteA} : {punkteB}</span>
          </div>
          <div className="section-body">
            <div className="grid-2" style={{ gap: 14, marginBottom: 18 }}>
              <div className="field"><label>Objekt A</label>
                <select value={duellA} onChange={(e) => setDuellA(Number(e.target.value))}>
                  {karten.map((c, i) => <option key={c.k.id} value={i}>{c.k.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Objekt B</label>
                <select value={duellB} onChange={(e) => setDuellB(Number(e.target.value))}>
                  {karten.map((c, i) => <option key={c.k.id} value={i}>{c.k.name}</option>)}
                </select>
              </div>
            </div>
            <table>
              <thead><tr><th style={{ width: "34%" }}>Kriterium</th><th>{A.k.name}</th><th>{B.k.name}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.lbl}>
                    <td style={{ color: "var(--muted)" }}>{r.lbl}</td>
                    <td style={{ fontWeight: r.aWin ? 700 : 400, color: r.aWin ? "var(--gold)" : "var(--text)" }}>{r.a}</td>
                    <td style={{ fontWeight: r.bWin ? 700 : 400, color: r.bWin ? "var(--gold)" : "var(--text)" }}>{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>
              Cashflow gerechnet mit deinen Szenario-Werten: {pct1(zins)} Zins, {pct1(tilgung)} Tilgung, {ekQuote} % Eigenkapital.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScoreKarte({ c, twLbl }: {
  c: { k: RadarKandidat; rendite: number; cf: number; teilwerte: [number, number, number, number]; score: number; urteil: { label: string; badge: string }; offen: boolean };
  twLbl: string[];
}) {
  const [auf, setAuf] = useState(false);
  const [lage, setLage] = useState(c.k.lage ?? 12);
  const [zustand, setZustand] = useState(c.k.zustand ?? 12);
  const [busy, start] = useTransition();
  const deg = Math.round((c.score / 100) * 360);

  const speichern = () =>
    start(async () => {
      const res = await saveRadarWerte(c.k.id, lage, zustand);
      if (res.ok) { c.k.lage = lage; c.k.zustand = zustand; setAuf(false); }
    });

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(var(--gold) ${deg}deg, var(--bg4) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bg2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--gold)", lineHeight: 1 }}>{c.score}</span>
              <span style={{ fontSize: 8, letterSpacing: ".1em", color: "var(--faint)", textTransform: "uppercase" }}>Score</span>
            </div>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.k.name}</div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
              {c.k.flaeche ? `${c.k.flaeche.toLocaleString("de-DE")} m² · ` : ""}{eur(c.k.miete)} Kaltmiete
            </div>
            <span className={`badge badge-${c.urteil.badge}`} style={{ marginTop: 7 }}>{c.urteil.label}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {c.teilwerte.map((v, i) => (
            <div key={twLbl[i]} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--muted)", width: 74, flexShrink: 0 }}>{twLbl[i]}</span>
              <div className="bar-track" style={{ flex: 1 }}><div className="bar-fill" style={{ width: `${(v / 25) * 100}%`, background: "var(--gold)" }} /></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", width: 38, textAlign: "right" }}>{v}/25</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div><div className="stat-lbl">Kaufpreis</div><div className="serif" style={{ fontSize: 17, marginTop: 3 }}>{eur(c.k.preis)}</div></div>
          <div><div className="stat-lbl">Miete / Mo.</div><div className="serif" style={{ fontSize: 17, marginTop: 3 }}>{eur(c.k.miete)}</div></div>
          <div style={{ textAlign: "right" }}><div className="stat-lbl">Rendite</div><div className="serif" style={{ fontSize: 17, marginTop: 3, color: "var(--gold)" }}>{pct1(c.rendite)}</div></div>
        </div>

        {auf ? (
          <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
            <div className="range-row"><label>Lage</label><input type="range" min={0} max={25} step={1} value={lage} onChange={(e) => setLage(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 52 }}>{lage}/25</span></div>
            <div className="range-row" style={{ marginBottom: 10 }}><label>Zustand</label><input type="range" min={0} max={25} step={1} value={zustand} onChange={(e) => setZustand(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 52 }}>{zustand}/25</span></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAuf(false)} disabled={busy}>Abbrechen</button>
              <button type="button" className="btn btn-gold btn-sm" onClick={speichern} disabled={busy}>{busy ? "Speichert …" : "Übernehmen"}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setAuf(true)}>
            <SlidersHorizontal size={13} /> {c.offen ? "Lage & Zustand einschätzen" : "Einschätzung anpassen"}
          </button>
        )}
      </div>
    </div>
  );
}
