"use client";

import { useState } from "react";
import { saveKalkulationAlsImmobilie } from "@/lib/actions/kalkulation";

const fmt = (n: number, dec = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtE = (n: number) => "€ " + fmt(Math.round(n));
const pct = (n: number, dec = 2) => fmt(n, dec) + " %";

// Grenzsteuersatz 2024 (immocation-Formel, vereinfacht)
function calcGrenzsteuer(zvE: number, splitting: boolean) {
  const z = splitting ? zvE / 2 : zvE;
  if (z <= 11604) return 0;
  if (z <= 17005) return 0.14 + ((z - 11604) / 10000) * 0.1;
  if (z <= 66760) return 0.24 + ((z - 17005) / 49755) * 0.18;
  if (z <= 277825) return 0.42;
  return 0.45;
}

const BUNDESLAENDER = [
  { v: 0.035, l: "Bayern (3,5%)" },
  { v: 0.06, l: "Berlin (6,0%)" },
  { v: 0.055, l: "Hamburg (5,5%)" },
  { v: 0.05, l: "Baden-Württemberg (5,0%)" },
  { v: 0.065, l: "Brandenburg (6,5%)" },
  { v: 0.05, l: "Bremen (5,0%)" },
  { v: 0.06, l: "Hessen (6,0%)" },
  { v: 0.065, l: "NRW (6,5%)" },
  { v: 0.05, l: "Niedersachsen (5,0%)" },
  { v: 0.05, l: "Sachsen (3,5%)" },
  { v: 0.065, l: "Thüringen (6,5%)" },
];

const num = (s: string) => parseFloat(s) || 0;

export default function RoterFaden() {
  const [kaufpreis, setKaufpreis] = useState("");
  const [flaeche, setFlaeche] = useState("");
  const [miete, setMiete] = useState("");
  const [bundesland, setBundesland] = useState("0.055");
  const [makler, setMakler] = useState("3.57");
  const [notar, setNotar] = useState("1.5");
  const [grundbuch, setGrundbuch] = useState("0.5");
  const [sofort, setSofort] = useState("2000");
  const [darlPct, setDarlPct] = useState(80);
  const [zins, setZins] = useState(2.5);
  const [tilg, setTilg] = useState(2.0);
  const [bindung, setBindung] = useState(15);
  const [hausgeld, setHausgeld] = useState("52");
  const [mietausfall, setMietausfall] = useState("3");
  const [instandhaltung, setInstandhaltung] = useState("10");
  const [einkommen, setEinkommen] = useState("40000");
  const [afaSatz, setAfaSatz] = useState("0.02");
  const [gebaeude, setGebaeude] = useState("80");
  const [saveName, setSaveName] = useState("");
  const [mitDarlehen, setMitDarlehen] = useState(true);

  const kp = num(kaufpreis), fl = num(flaeche), mi = num(miete);
  const gew = num(bundesland);
  const mak = num(makler) / 100, not = num(notar) / 100, gb = num(grundbuch) / 100, sof = num(sofort);
  const darl = darlPct / 100, zinsPa = zins / 100, tilgPa = tilg / 100;
  const hg = num(hausgeld), mietausfallPct = num(mietausfall) / 100, instand = num(instandhaltung);
  const eink = num(einkommen), afa = num(afaSatz), gebAnteil = num(gebaeude) / 100;

  const nk = kp * (gew + mak + not + gb) + sof;
  const kapital = kp + nk;
  const darlehen = kp * darl;
  const ek = kapital - darlehen;
  const rate = (darlehen * (zinsPa + tilgPa)) / 12;
  const annuitat = zinsPa + tilgPa;
  const lt = annuitat > 0 ? Math.ceil(Math.log(1 / (1 - (darlehen * zinsPa) / (darlehen * annuitat))) / Math.log(1 + zinsPa / 12) / 12) : 0;

  const qm = kp > 0 && fl > 0 ? kp / fl : 0;
  const faktor = mi > 0 ? kp / (mi * 12) : 0;
  const brutto = kp > 0 && mi > 0 ? ((mi * 12) / kp) * 100 : 0;

  const instandhMo = (instand * fl) / 12;
  const mietausfallMo = mi * mietausfallPct;
  const bewirt = hg + instandhMo + mietausfallMo;
  const warmmiete = mi;
  const cfOp = warmmiete - bewirt - rate;

  const afaBasis = kp * gebAnteil;
  const afaMo = (afaBasis * afa) / 12;
  const grenzsteuer = calcGrenzsteuer(eink, false);
  const zvCf = warmmiete - hg - (darlehen * zinsPa) / 12 - afaMo;
  const steuerMo = zvCf * grenzsteuer;
  const cfNetto = cfOp - steuerMo;

  const nettoRendite = kp > 0 ? ((mi - bewirt) * 12 / kp) * 100 : 0;
  const ekRendite = ek > 0 ? (cfNetto * 12 / ek) * 100 : 0;

  const restschuld = darlehen * Math.pow(1 + zinsPa, bindung) - rate * 12 * ((Math.pow(1 + zinsPa, bindung) - 1) / zinsPa);
  const rateNeu = (restschuld * (0.05 + tilgPa)) / 12;
  const cfZins = warmmiete - bewirt - rateNeu;

  const farbeKz = (v: number, gruen: number, gelb: number) => (v >= gruen ? "green" : v >= gelb ? "gold" : "red");
  const cfCol = (v: number) => (v >= 0 ? "var(--green)" : "var(--red)");

  let ampel: { c: string; t: string } | null = null;
  if (faktor > 0) {
    if (faktor < 20) ampel = { c: "var(--green)", t: `🟢 Faktor ${fmt(faktor, 1)}x — Sehr günstig. Starke Mietrendite möglich.` };
    else if (faktor < 25) ampel = { c: "var(--green)", t: `🟢 Faktor ${fmt(faktor, 1)}x — Günstig. Solide B/C-Städte-Investition.` };
    else if (faktor < 30) ampel = { c: "var(--amber)", t: `🟡 Faktor ${fmt(faktor, 1)}x — Marktüblich. Typisch für A-Städte.` };
    else if (faktor < 35) ampel = { c: "var(--amber)", t: `🟠 Faktor ${fmt(faktor, 1)}x — Teuer. Cashflow oft negativ.` };
    else ampel = { c: "var(--red)", t: `🔴 Faktor ${fmt(faktor, 1)}x — Sehr teuer. Schwer durch Miete zu rechtfertigen.` };
  }

  const numField = (label: string, value: string, set: (v: string) => void, ph?: string, step?: string) => (
    <div className="field"><label>{label}</label><input type="number" value={value} step={step} placeholder={ph} onChange={(e) => set(e.target.value)} /></div>
  );

  const stat = (lbl: string, val: string, cls?: string, fs = 15) => (
    <div className="stat-box"><div className="stat-lbl">{lbl}</div><div className={`stat-val ${cls ?? ""}`} style={{ fontSize: fs }}>{val}</div></div>
  );

  return (
    <>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
        Schritt-für-Schritt durch die Kalkulation — gibt dir schnell ein Gefühl für die Zahlen.
      </div>

      <div className="grid-2 mb-20">
        {/* Schritt 1 */}
        <div className="card">
          <div className="card-header"><div className="card-title">Schritt 1 · Kaufpreis &amp; Miete</div></div>
          <div className="card-body">
            {numField("Kaufpreis (€) *", kaufpreis, setKaufpreis, "250000")}
            {numField("Wohnfläche (m²)", flaeche, setFlaeche, "75")}
            {numField("Kaltmiete / Monat (€)", miete, setMiete, "900")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
              {stat("Preis/m²", qm > 0 ? fmtE(qm) + "/m²" : "–", "gold")}
              {stat("Faktor", faktor > 0 ? fmt(faktor, 1) + "x" : "–")}
              {stat("Bruttomietrendite", brutto > 0 ? pct(brutto) : "–", brutto >= 5 ? "green" : brutto >= 4 ? "gold" : "red")}
            </div>
            {ampel && (
              <div style={{ marginTop: 10, fontSize: 12, padding: "8px 12px", borderRadius: 7, background: "rgba(0,0,0,0.15)", borderLeft: `3px solid ${ampel.c}`, color: ampel.c }}>{ampel.t}</div>
            )}
          </div>
        </div>

        {/* Schritt 2 */}
        <div className="card">
          <div className="card-header"><div className="card-title">Schritt 2 · Kaufnebenkosten</div></div>
          <div className="card-body">
            <div className="field"><label>Bundesland (Grunderwerbsteuer)</label>
              <select value={bundesland} onChange={(e) => setBundesland(e.target.value)}>
                {BUNDESLAENDER.map((b, i) => <option key={i} value={b.v}>{b.l}</option>)}
              </select>
            </div>
            <div className="field-row">
              {numField("Makler (%)", makler, setMakler, undefined, "0.1")}
              {numField("Notar (%)", notar, setNotar, undefined, "0.1")}
            </div>
            <div className="field-row">
              {numField("Grundbuch (%)", grundbuch, setGrundbuch, undefined, "0.1")}
              {numField("Sofortmaßnahmen (€)", sofort, setSofort)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {stat("Nebenkosten", fmtE(nk), undefined, 14)}
              <div className="stat-box highlight"><div className="stat-lbl">Kapitalbedarf gesamt</div><div className="stat-val gold" style={{ fontSize: 14 }}>{fmtE(kapital)}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-20">
        {/* Schritt 3 */}
        <div className="card">
          <div className="card-header"><div className="card-title">Schritt 3 · Finanzierung</div></div>
          <div className="card-body">
            <div className="range-row"><label>Darlehen % vom KP</label><input type="range" min={50} max={100} step={1} value={darlPct} onChange={(e) => setDarlPct(+e.target.value)} /><span className="range-val">{darlPct}%</span></div>
            <div className="range-row"><label>Zinssatz p.a.</label><input type="range" min={0.5} max={8} step={0.05} value={zins} onChange={(e) => setZins(+e.target.value)} /><span className="range-val">{fmt(zins, 1)}%</span></div>
            <div className="range-row"><label>Tilgung p.a.</label><input type="range" min={1} max={6} step={0.1} value={tilg} onChange={(e) => setTilg(+e.target.value)} /><span className="range-val">{fmt(tilg, 1)}%</span></div>
            <div className="range-row"><label>Zinsbindung (Jahre)</label><input type="range" min={5} max={30} step={1} value={bindung} onChange={(e) => setBindung(+e.target.value)} /><span className="range-val">{bindung}</span></div>
            <div className="divider" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {stat("Darlehenssumme", fmtE(darlehen), undefined, 13)}
              {stat("Rate/Monat", fmtE(rate), "gold", 13)}
              {stat("Eigenkapital", fmtE(ek), undefined, 13)}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Schuldfrei in ca. <strong style={{ color: "var(--text)" }}>{lt > 0 && lt < 100 ? lt + " Jahren" : "> 50 J."}</strong></div>
          </div>
        </div>

        {/* Schritt 4 */}
        <div className="card">
          <div className="card-header"><div className="card-title">Schritt 4 · Bewirtschaftung &amp; Steuern</div></div>
          <div className="card-body">
            <div className="field-row">
              {numField("Nicht umlagef. Hausgeld (€/Mo)", hausgeld, setHausgeld)}
              {numField("Mietausfall-Rücklage (%)", mietausfall, setMietausfall, undefined, "0.5")}
            </div>
            <div className="field-row">
              {numField("Instandh.-Rücklage (€/m²/Jahr)", instandhaltung, setInstandhaltung)}
              {numField("Zu verst. Einkommen (€/Jahr)", einkommen, setEinkommen)}
            </div>
            <div className="field-row">
              <div className="field"><label>Baujahr (für AfA)</label>
                <select value={afaSatz} onChange={(e) => setAfaSatz(e.target.value)}>
                  <option value="0.02">nach 1924 (2% AfA)</option>
                  <option value="0.025">vor 1925 (2,5% AfA)</option>
                </select>
              </div>
              {numField("Gebäudeanteil am KP (%)", gebaeude, setGebaeude, undefined, "1")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {stat("Grenzsteuersatz", pct(grenzsteuer * 100, 1), undefined, 13)}
              {stat("Steuern/Monat", fmtE(steuerMo) + "/Mo", steuerMo > 0 ? "red" : "green", 13)}
            </div>
          </div>
        </div>
      </div>

      {/* Ergebnis */}
      <div className="card mb-20">
        <div className="card-header"><div className="card-title">📊 Ergebnis — Cashflow-Übersicht</div></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
            {stat("Warmmiete", fmtE(warmmiete) + "/Mo", "green", 16)}
            {stat("Bewirtschaftungskosten", fmtE(bewirt) + "/Mo", "red", 16)}
            {stat("Kapitaldienst/Monat", fmtE(rate) + "/Mo", "red", 16)}
            <div className="stat-box"><div className="stat-lbl">Cashflow operativ</div><div className="stat-val" style={{ fontSize: 16, color: cfCol(cfOp) }}>{fmtE(cfOp)}/Mo</div></div>
            {stat("Steuern/Monat", fmtE(steuerMo) + "/Mo", undefined, 16)}
            <div className="stat-box highlight"><div className="stat-lbl">Cashflow nach Steuern</div><div className="stat-val" style={{ fontSize: 16, color: cfCol(cfNetto) }}>{fmtE(cfNetto)}/Mo</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {stat("Bruttomietrendite", brutto > 0 ? pct(brutto) : "–", farbeKz(brutto, 5, 4), 14)}
            {stat("Nettomietrendite", nettoRendite !== 0 ? pct(nettoRendite) : "–", farbeKz(nettoRendite, 4, 3), 14)}
            {stat("Eigenkapitalrendite", ek > 0 ? pct(ekRendite) : "–", farbeKz(ekRendite, 20, 10), 14)}
            {stat("Kaufpreisfaktor", faktor > 0 ? fmt(faktor, 1) + "x" : "–", undefined, 14)}
          </div>
          {kp > 0 && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg3)", borderLeft: `3px solid ${cfCol(cfZins)}`, borderRadius: "0 7px 7px 0", fontSize: 12 }}>
              ⚡ Zinsänderungsrisiko nach {bindung} Jahren (bei 5%): Rate würde <strong style={{ color: cfCol(cfZins) }}>{fmtE(rateNeu)}/Mo</strong> → Cashflow: <strong style={{ color: cfCol(cfZins) }}>{fmtE(cfZins)}/Mo</strong>
            </div>
          )}
        </div>
      </div>

      {/* Ins Portfolio übernehmen */}
      <div className="card mb-20">
        <div className="card-header"><div className="card-title">💾 Ergebnis ins Portfolio übernehmen</div></div>
        <div className="card-body">
          <form action={saveKalkulationAlsImmobilie} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
            <input type="hidden" name="kaufpreis" value={kp} />
            <input type="hidden" name="wert" value={kp} />
            <input type="hidden" name="flaeche" value={fl} />
            <input type="hidden" name="miete" value={mi} />
            <input type="hidden" name="darlehen" value={Math.round(darlehen)} />
            <input type="hidden" name="monatsrate" value={Math.round(rate)} />
            <input type="hidden" name="zinssatz" value={zins} />
            <input type="hidden" name="tilgungssatz" value={tilg} />
            <input type="hidden" name="mit_darlehen" value={mitDarlehen ? "1" : "0"} />
            <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
              <label>Bezeichnung</label>
              <input name="name" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="z.B. ETW Musterstraße" required />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", paddingBottom: 9 }}>
              <input type="checkbox" checked={mitDarlehen} onChange={(e) => setMitDarlehen(e.target.checked)} style={{ width: "auto" }} />
              auch als Darlehen anlegen
            </label>
            <button type="submit" className="btn btn-gold" disabled={kp <= 0}>＋ Als Immobilie speichern</button>
          </form>
          <div className="hint" style={{ marginTop: 8 }}>Legt ein neues Objekt mit Kaufpreis, Wert, Fläche und Miete an{mitDarlehen ? " und verknüpft das Darlehen aus Schritt 3" : ""}.</div>
        </div>
      </div>
    </>
  );
}
