"use client";

// Szenario-/Stresstest-Rechner (Design-Handoff Phase 2, /kredite): fünf
// Regler — und sofort sehen, ob es trägt. Formeln aus lib/finanz.ts
// (Kern-Logik des Handoffs), Rechenweg offen in der Fußnote.

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { szenario, urteilCf, BEWIRTSCHAFTUNG } from "@/lib/finanz";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const signed = (n: number) => `${n >= 0 ? "+ " : "− "}${eur(Math.abs(n))}`;
const pct1 = (n: number) => n.toFixed(1).replace(".", ",") + " %";
const FARBE: Record<string, string> = { green: "var(--green)", amber: "var(--amber)", red: "var(--red)" };

export default function SzenarioRechner() {
  const [kaufpreis, setKaufpreis] = useState(250000);
  const [ekQuote, setEkQuote] = useState(20);
  const [zins, setZins] = useState(3.9);
  const [tilgung, setTilgung] = useState(2);
  const [miete, setMiete] = useState(800);
  const [stressOn, setStressOn] = useState(false);

  const s = szenario({ kaufpreis, ekQuote, zins, tilgung, miete });
  const aktivCf = stressOn ? s.stress.cashflow : s.cashflow;
  const u = urteilCf(aktivCf);
  const cfFarbe = FARBE[u.badge];
  // Balken: −500 € … +500 € auf 0–100 % abgebildet
  const cfPct = Math.max(4, Math.min(100, ((aktivCf + 500) / 1000) * 100));

  return (
    <div className="section">
      <div className="section-header">
        <div><h3>Szenario-Rechner</h3><div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>Zins, Tilgung, Eigenkapital schieben — und sofort sehen, ob es trägt</div></div>
        <div className="seg" role="tablist" aria-label="Rechenmodus" style={{ display: "inline-flex", gap: 4, background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 9, padding: 3 }}>
          {([["Normal", false], ["Stresstest", true]] as const).map(([lbl, val]) => (
            <button key={lbl} type="button" role="tab" aria-selected={stressOn === val} onClick={() => setStressOn(val)}
              className="btn btn-sm" style={{
                border: "none", background: stressOn === val ? "var(--gold)" : "transparent",
                color: stressOn === val ? "var(--gold-contrast, #1A1814)" : "var(--muted)", fontWeight: 600,
              }}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="section-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
          <div>
            <div className="range-row"><label>Kaufpreis</label><input type="range" min={120000} max={420000} step={5000} value={kaufpreis} onChange={(e) => setKaufpreis(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{eur(kaufpreis)}</span></div>
            <div className="range-row"><label>Eigenkapital</label><input type="range" min={0} max={50} step={5} value={ekQuote} onChange={(e) => setEkQuote(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{ekQuote} %</span></div>
            <div className="range-row"><label>Sollzins p. a.</label><input type="range" min={2.5} max={6.5} step={0.1} value={zins} onChange={(e) => setZins(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{pct1(zins)}</span></div>
            <div className="range-row"><label>Tilgung p. a.</label><input type="range" min={1} max={4} step={0.25} value={tilgung} onChange={(e) => setTilgung(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>{pct1(tilgung)}</span></div>
            <div className="range-row" style={{ marginBottom: 0 }}><label>Kaltmiete / Mo.</label><input type="range" min={400} max={1400} step={10} value={miete} onChange={(e) => setMiete(Number(e.target.value))} /><span className="range-val" style={{ minWidth: 78 }}>€ {miete.toLocaleString("de-DE")}</span></div>
            <div style={{ height: 1, background: "var(--line)", margin: "18px 0" }} />
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="stat-box"><div className="stat-lbl">Kaufnebenkosten</div><div className="stat-val">{eur(s.nebenkosten)}</div></div>
              <div className="stat-box"><div className="stat-lbl">Eigenkapital</div><div className="stat-val">{eur(s.eigenkapital)}</div></div>
              <div className="stat-box"><div className="stat-lbl">Darlehen</div><div className="stat-val">{eur(s.darlehen)}</div></div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="section" style={{ marginBottom: 0, borderColor: cfFarbe }}>
              <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div className="stat-lbl">{stressOn ? "Cashflow im Stresstest" : "Cashflow"}</div>
                    <div className="serif" style={{ fontSize: 38, lineHeight: 1.1, marginTop: 6, color: cfFarbe }}>{signed(aktivCf)}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>pro Monat, nach Rate und Bewirtschaftung</div>
                  </div>
                  <span className={`badge badge-${u.badge}`} style={{ fontSize: 12, padding: "6px 12px" }}>{u.label}</span>
                </div>
                <div className="bar-track" style={{ height: 8 }}><div className="bar-fill" style={{ width: `${cfPct}%`, background: cfFarbe }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                  <span>Miete € {miete.toLocaleString("de-DE")}</span><span>Rate {eur(stressOn ? s.stress.rate : s.rate)}</span><span>Bewirtschaftung € {BEWIRTSCHAFTUNG}</span>
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 18 }}>
              <div className="stat-box"><div className="stat-lbl">Monatsrate</div><div className="stat-val">{eur(s.rate)}</div></div>
              <div className="stat-box"><div className="stat-lbl">Bruttorendite</div><div className="stat-val gold">{pct1(s.rendite)}</div></div>
              <div className="stat-box"><div className="stat-lbl">Restschuld nach 10 J.</div><div className="stat-val">{eur(s.rest10)}</div></div>
              <div className="stat-box"><div className="stat-lbl">Getilgt nach 10 J.</div><div className="stat-val">{eur(s.getilgt10)}</div></div>
            </div>

            {stressOn && (
              <div className="section" style={{ marginBottom: 0, background: "var(--gold-pale)", borderColor: "var(--gold-dim)" }}>
                <div className="section-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <TriangleAlert size={15} style={{ color: "var(--gold)" }} /><h3 style={{ fontSize: 14 }}>Stresstest aktiv</h3>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
                    Anschlusszins {pct1(s.stress.zins)} auf die Restschuld ab Jahr 11, dazu ein Monat Leerstand pro Jahr.
                    Rate steigt auf <strong style={{ color: "var(--text)" }}>{eur(s.stress.rate)}</strong>, Cashflow dann{" "}
                    <strong style={{ color: FARBE[urteilCf(s.stress.cashflow).badge] }}>{signed(s.stress.cashflow)}</strong> pro Monat.
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--faint)" }}>Rechenweg offen: Annuität = Darlehen × (Zins + Tilgung) / 12. Keine Prognose-Magie, keine versteckten Annahmen.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
