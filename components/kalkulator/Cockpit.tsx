"use client";

import { useEffect, useState } from "react";
import KalkImport from "@/components/kalkulator/KalkImport";
import { fmt, fmtE, pct, num, calcGrenzsteuer, berechneRestschuld, berechneVolltilgungJahr, BUNDESLAENDER, CP_STORAGE_KEY, type CpData } from "@/lib/kalk";

const JETZT = new Date().getFullYear();
const COL: Record<string, string> = { green: "var(--green)", red: "var(--red)", teal: "var(--teal)", muted: "var(--muted)" };

function CfRows({ rows }: { rows: [string, number, string][] }) {
  return (
    <>
      {rows.map(([l, v, c], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
          <span style={{ color: "var(--muted)" }}>{l}</span>
          <span style={{ fontWeight: 600, color: COL[c] }}>{fmtE(v)}</span>
        </div>
      ))}
    </>
  );
}

const SUBTABS: { id: string; label: string }[] = [
  { id: "invest", label: "Objekt & Investition" },
  { id: "miete", label: "Miete & Steuern" },
  { id: "fin", label: "Finanzierung" },
  { id: "ergebnis", label: "Cockpit-Ergebnis" },
  { id: "verlauf", label: "Verlauf 30J." },
];

export default function Cockpit() {
  const [tab, setTab] = useState("invest");

  // Invest
  const [adresse, setAdresse] = useState("");
  const [kaufpreis, setKaufpreis] = useState("");
  const [flaeche, setFlaeche] = useState("");
  const [bundesland, setBundesland] = useState("0.055");
  const [makler, setMakler] = useState("3.57");
  const [notar, setNotar] = useState("1.5");
  const [grundbuch, setGrundbuch] = useState("0.5");
  const [sonstigeNk, setSonstigeNk] = useState("0");
  const [kueche, setKueche] = useState("2500");
  const [sonderumlage, setSonderumlage] = useState("0");
  const [investSonst, setInvestSonst] = useState("0");
  // Miete & Steuern
  const [kaltmiete, setKaltmiete] = useState("");
  const [mieteStellplatz, setMieteStellplatz] = useState("0");
  const [hgUmlage, setHgUmlage] = useState("90");
  const [grundsteuer, setGrundsteuer] = useState("9");
  const [mietausfall, setMietausfall] = useState("3");
  const [instandh, setInstandh] = useState("10");
  const [hgNichtUmlage, setHgNichtUmlage] = useState("49");
  const [afaSatz, setAfaSatz] = useState("0.02");
  const [gebaeude, setGebaeude] = useState("75");
  const [einkommen, setEinkommen] = useState("40000");
  const [veranlagung, setVeranlagung] = useState("1");
  // Finanzierung
  const [d1Summe, setD1Summe] = useState("");
  const [d1Zins, setD1Zins] = useState("1.3");
  const [d1Tilg, setD1Tilg] = useState("3");
  const [d1Bindung, setD1Bindung] = useState("2032");
  const [d1ZinsNeu, setD1ZinsNeu] = useState("3");
  const [d1TilgNeu, setD1TilgNeu] = useState("5");
  const [d2Summe, setD2Summe] = useState("");
  const [d2Zins, setD2Zins] = useState("2");
  const [d2Tilg, setD2Tilg] = useState("8");
  // Zukunft
  const [zukunftJahr, setZukunftJahr] = useState("2040");
  const [kostensteigerung, setKostensteigerung] = useState("5");
  const [mietsteigerung, setMietsteigerung] = useState("2");
  const [wertsteigerung, setWertsteigerung] = useState("2");

  // ===== Berechnung (Port von calcCP) =====
  const kp = num(kaufpreis), fl = num(flaeche), gew = num(bundesland);
  const nk = kp * (gew + num(makler) / 100 + num(notar) / 100 + num(grundbuch) / 100) + num(sonstigeNk);
  const kuecheV = num(kueche);
  const gesamtInvest = kp + nk + kuecheV + num(sonderumlage) + num(investSonst);
  const qm = kp > 0 && fl > 0 ? kp / fl : 0;
  const grenze15 = kp * 0.15;

  const nettokaltmiete = num(kaltmiete) + num(mieteStellplatz);
  const warmmiete = nettokaltmiete + num(hgUmlage) + num(grundsteuer);
  const instandhMo = (num(instandh) * fl) / 12;
  const mietausfallMo = nettokaltmiete * (num(mietausfall) / 100);
  const umlagefaehig = num(hgUmlage) + num(grundsteuer);
  const nichtUmlagefaehig = num(hgNichtUmlage) + instandhMo + mietausfallMo;

  const afaBasis = kp * (num(gebaeude) / 100) + kuecheV;
  const afaMo = (afaBasis * num(afaSatz)) / 12;
  const grenzsteuer = calcGrenzsteuer(num(einkommen), veranlagung === "2");

  const d1S = num(d1Summe), d1Z = num(d1Zins) / 100, d1T = num(d1Tilg) / 100;
  const d1Rate = (d1S * (d1Z + d1T)) / 12;
  const d1BindJahr = parseInt(d1Bindung) || 2032;
  const d1Bind = Math.max(0, d1BindJahr - JETZT);
  const d1Restschuld = berechneRestschuld(d1S, d1Z, d1Rate, d1Bind);
  const d1RateNeu = (d1Restschuld * (num(d1ZinsNeu) / 100 + num(d1TilgNeu) / 100)) / 12;
  const d1LaufzeitNeu = berechneVolltilgungJahr(d1Restschuld, num(d1ZinsNeu) / 100, d1RateNeu, d1BindJahr);

  const d2S = num(d2Summe), d2Z = num(d2Zins) / 100, d2T = num(d2Tilg) / 100;
  const d2Rate = (d2S * (d2Z + d2T)) / 12;
  const d2Ende = berechneVolltilgungJahr(d2S, d2Z, d2Rate, JETZT);

  const gesDarlehen = d1S + d2S;
  const gesRate = d1Rate + d2Rate;
  const eigenkapital = gesamtInvest - gesDarlehen;
  const gewZins = gesDarlehen > 0 ? (d1S * d1Z + d2S * d2Z) / gesDarlehen : 0;

  const zinsenMo1 = (gesDarlehen * gewZins) / 12;
  const cfOp = nettokaltmiete - nichtUmlagefaehig - gesRate;
  const zvE = nettokaltmiete - num(hgNichtUmlage) - zinsenMo1 - afaMo;
  const steuernMo = zvE * grenzsteuer;
  const cfNetto = cfOp - steuernMo;

  const brutto = kp > 0 && nettokaltmiete > 0 ? (nettokaltmiete * 12 / kp) * 100 : 0;
  const nettomiet = kp > 0 ? ((nettokaltmiete - nichtUmlagefaehig) * 12 / kp) * 100 : 0;
  const faktor = nettokaltmiete > 0 ? kp / (nettokaltmiete * 12) : 0;
  const ekRendite = eigenkapital > 0 ? (cfNetto * 12 / eigenkapital) * 100 : 0;

  // Zukunft
  const zJahr = parseInt(zukunftJahr) || 2040;
  const jahre = Math.max(1, zJahr - JETZT);
  const zMiete = nettokaltmiete * Math.pow(1 + num(mietsteigerung) / 100, jahre);
  const zBewirt = nichtUmlagefaehig * Math.pow(1 + num(kostensteigerung) / 100, jahre);
  const zWarmmiete = zMiete + num(hgUmlage) + num(grundsteuer);
  const zCfOp = zMiete - zBewirt - gesRate;
  const zZinsen = (berechneRestschuld(d1S, d1Z, d1Rate, jahre) * gewZins) / 12;
  const zZvE = zMiete - num(hgNichtUmlage) - zZinsen - afaMo;
  const zSteuern = zZvE * grenzsteuer;
  const zCfNetto = zCfOp - zSteuern;
  const zWert = kp * Math.pow(1 + num(wertsteigerung) / 100, jahre);

  // localStorage für Bankgespräch
  useEffect(() => {
    const d: CpData = { kp, qm, flaeche: fl, nk, gesamtInvest, d1Summe: d1S, d2Summe: d2S, eigenkapital, kaltmiete: nettokaltmiete, brutto, faktor, cfOp, cfNetto, gesRate, adresse };
    try { localStorage.setItem(CP_STORAGE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  });

  const F = (label: string, value: string, set: (v: string) => void, step?: string, ph?: string) => (
    <div className="field"><label>{label}</label><input type="number" value={value} step={step} placeholder={ph} onChange={(e) => set(e.target.value)} /></div>
  );
  const stat = (lbl: string, val: string, cls?: string, fs = 13) => (
    <div className="stat-box"><div className="stat-lbl">{lbl}</div><div className={`stat-val ${cls ?? ""}`} style={{ fontSize: fs }}>{val}</div></div>
  );

  const ampeln = [
    { lbl: "Bruttomietrendite", val: brutto, gruen: 5, gelb: 4, f: (v: number) => pct(v) },
    { lbl: "Nettomietrendite", val: nettomiet, gruen: 4, gelb: 3, f: (v: number) => pct(v) },
    { lbl: "Eigenkapitalrendite", val: ekRendite, gruen: 20, gelb: 10, f: (v: number) => pct(v) },
    { lbl: "Cashflow operativ", val: cfOp, gruen: -1.67, gelb: -3.33, f: (v: number) => fmtE(v) + "/Mo" },
  ];

  const kennzahlen: [string, string, string][] = [
    ["Kaufpreis", fmtE(kp), ""], ["Gesamtinvestition", fmtE(gesamtInvest), ""],
    ["Preis/m²", qm > 0 ? fmtE(qm) + "/m²" : "–", ""], ["Kaufpreisfaktor", faktor > 0 ? fmt(faktor, 1) + "x" : "–", faktor < 25 ? "🟢" : faktor < 30 ? "🟡" : "🔴"],
    ["Bruttomietrendite", pct(brutto), brutto >= 5 ? "🟢" : brutto >= 4 ? "🟡" : "🔴"],
    ["Nettomietrendite", pct(nettomiet), nettomiet >= 4 ? "🟢" : nettomiet >= 3 ? "🟡" : "🔴"],
    ["Cashflow operativ", fmtE(cfOp) + "/Mo", cfOp >= -1.67 ? "🟢" : cfOp >= -3.33 ? "🟡" : "🔴"],
    ["Cashflow nach Steuern", fmtE(cfNetto) + "/Mo", cfNetto >= -1.67 ? "🟢" : cfNetto >= -3.33 ? "🟡" : "🔴"],
    ["Eigenkapitalrendite", pct(ekRendite), ekRendite >= 20 ? "🟢" : ekRendite >= 10 ? "🟡" : "🔴"],
    ["AfA/Monat", fmtE(afaMo) + "/Mo", ""], ["Grenzsteuersatz", pct(grenzsteuer * 100, 1), ""],
  ];

  // 30-Jahres-Verlauf
  const verlauf: { yr: number; m: number; wert: number; rs: number; cf: number; cfn: number }[] = [];
  {
    let rs1 = d1S, rs2 = d2S;
    for (let j = 1; j <= 30; j++) {
      const m = nettokaltmiete * Math.pow(1 + num(mietsteigerung) / 100, j);
      const b = nichtUmlagefaehig * Math.pow(1 + num(kostensteigerung) / 100, j);
      const wert = kp * Math.pow(1 + num(wertsteigerung) / 100, j);
      const z1 = rs1 * d1Z; rs1 = Math.max(0, rs1 - Math.min(rs1, d1Rate * 12 - z1));
      const z2 = rs2 * d2Z; rs2 = Math.max(0, rs2 - Math.min(rs2, d2Rate * 12 - z2));
      const zinsMo = (rs1 * d1Z + rs2 * d2Z) / 12;
      const cf = m - b - gesRate;
      const st = (m - num(hgNichtUmlage) - zinsMo - afaMo) * grenzsteuer;
      verlauf.push({ yr: JETZT + j, m, wert, rs: rs1 + rs2, cf, cfn: cf - st });
    }
  }

  return (
    <>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
        Vollständige Profi-Kalkulation mit 2 Darlehen, AfA, Steuerberechnung und 30-Jahres-Verlauf.
      </div>

      <KalkImport onResult={(d) => {
        if (d.kaufpreis != null) setKaufpreis(String(d.kaufpreis));
        if (d.flaeche != null) setFlaeche(String(d.flaeche));
        if (d.miete != null && d.miete > 0) setKaltmiete(String(d.miete));
      }} />

      <div className="subtabs" style={{ marginBottom: 20 }}>
        {SUBTABS.map((s) => (
          <button key={s.id} className={`subtab${tab === s.id ? " active" : ""}`} onClick={() => setTab(s.id)}>{s.label}</button>
        ))}
      </div>

      {/* INVEST */}
      {tab === "invest" && (
        <div className="grid-2 mb-20">
          <div className="card">
            <div className="card-header"><div className="card-title">Objekt &amp; Kaufdatum</div></div>
            <div className="card-body">
              <div className="field"><label>Adresse</label><input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Musterstr. 11, 12345 Musterstadt" /></div>
              <div className="field-row">{F("Kaufpreis (€) *", kaufpreis, setKaufpreis, undefined, "250000")}{F("Wohnfläche (m²)", flaeche, setFlaeche, undefined, "75")}</div>
              <div className="field-row">
                <div className="field"><label>Bundesland</label><select value={bundesland} onChange={(e) => setBundesland(e.target.value)}>{BUNDESLAENDER.map((b, i) => <option key={i} value={b.v}>{b.l}</option>)}</select></div>
                {F("Makler (%)", makler, setMakler, "0.1")}
              </div>
              <div className="field-row">{F("Notar (%)", notar, setNotar, "0.1")}{F("Grundbuch (%)", grundbuch, setGrundbuch, "0.1")}</div>
              {F("Sonstige NK (€)", sonstigeNk, setSonstigeNk)}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Anfängliche Investitionen</div></div>
            <div className="card-body">
              {F("Küche / Renovierung (€)", kueche, setKueche)}
              {F("Geplante Sonderumlage (€)", sonderumlage, setSonderumlage)}
              {F("Sonstiges (€)", investSonst, setInvestSonst)}
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat("Kaufnebenkosten", fmtE(nk))}
                {stat("Preis/m²", qm > 0 ? fmtE(qm) + "/m²" : "–", "gold")}
                {stat("Gesamtinvestition", fmtE(gesamtInvest), "gold")}
                {stat("15%-Grenze (Handwerker)", fmtE(grenze15))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MIETE & STEUERN */}
      {tab === "miete" && (
        <div className="grid-2 mb-20">
          <div className="card">
            <div className="card-header"><div className="card-title">Miete &amp; Rücklagen</div></div>
            <div className="card-body">
              <div className="field-row">{F("Kaltmiete Wohnfl. (€/Mo)", kaltmiete, setKaltmiete, undefined, "900")}{F("+ Stellplätze (€/Mo)", mieteStellplatz, setMieteStellplatz)}</div>
              <div className="field-row">{F("Umlagef. Hausgeld (€/Mo)", hgUmlage, setHgUmlage)}{F("Grundsteuer (€/Mo)", grundsteuer, setGrundsteuer)}</div>
              <div className="field-row">{F("Kalkulat. Mietausfall (%)", mietausfall, setMietausfall, "0.5")}{F("Instandh.-Rücklage (€/m²/Jahr)", instandh, setInstandh)}</div>
              {F("Nicht umlagef. Hausgeld (€/Mo)", hgNichtUmlage, setHgNichtUmlage)}
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat("Warmmiete", fmtE(warmmiete) + "/Mo", "green")}
                {stat("Bewirtschaftung", fmtE(umlagefaehig + nichtUmlagefaehig) + "/Mo", "red")}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">AfA &amp; Steuern</div></div>
            <div className="card-body">
              <div className="field-row">
                <div className="field"><label>AfA-Satz</label><select value={afaSatz} onChange={(e) => setAfaSatz(e.target.value)}><option value="0.02">2% (nach 1924)</option><option value="0.025">2,5% (vor 1925)</option><option value="0.03">3% (Neubau ab 2023)</option></select></div>
                {F("Gebäudeanteil am KP (%)", gebaeude, setGebaeude)}
              </div>
              <div className="field-row">
                {F("Zu verst. Einkommen (€/Jahr)", einkommen, setEinkommen)}
                <div className="field"><label>Veranlagung</label><select value={veranlagung} onChange={(e) => setVeranlagung(e.target.value)}><option value="1">Einzel</option><option value="2">Zusammen (Splitting)</option></select></div>
              </div>
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat("AfA / Monat", fmtE(afaMo) + "/Mo")}
                {stat("Grenzsteuersatz", pct(grenzsteuer * 100, 1), "gold")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINANZIERUNG */}
      {tab === "fin" && (
        <div className="grid-2 mb-20">
          <div className="card">
            <div className="card-header"><div className="card-title">Darlehen I (Hauptdarlehen)</div></div>
            <div className="card-body">
              {F("Darlehenssumme (€)", d1Summe, setD1Summe, undefined, "200000")}
              <div className="field-row">{F("Zinssatz (% p.a.)", d1Zins, setD1Zins, "0.01")}{F("Tilgung (% p.a.)", d1Tilg, setD1Tilg, "0.1")}</div>
              {F("Zinsbindung bis (Jahr)", d1Bindung, setD1Bindung)}
              <div className="form-section-label">Anschluss nach Zinsbindung</div>
              <div className="field-row">{F("Zins neu (%)", d1ZinsNeu, setD1ZinsNeu, "0.1")}{F("Tilgung neu (%)", d1TilgNeu, setD1TilgNeu, "0.1")}</div>
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat("Rate / Monat", fmtE(d1Rate) + "/Mo", "gold")}
                {stat("Volltilgung ca.", d1LaufzeitNeu > 0 ? String(d1LaufzeitNeu) : "–")}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Darlehen II (optional)</div></div>
            <div className="card-body">
              {F("Darlehenssumme (€)", d2Summe, setD2Summe)}
              <div className="field-row">{F("Zinssatz (% p.a.)", d2Zins, setD2Zins, "0.01")}{F("Tilgung (% p.a.)", d2Tilg, setD2Tilg, "0.1")}</div>
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat("Rate / Monat", d2S > 0 ? fmtE(d2Rate) + "/Mo" : "–")}
                {stat("Volltilgung ca.", d2S > 0 && d2Ende > 0 ? String(d2Ende) : "–")}
              </div>
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat("Gesamtdarlehen", fmtE(gesDarlehen))}
                {stat("Eigenkapital", fmtE(eigenkapital), "gold")}
                {stat("Rate gesamt", fmtE(gesRate) + "/Mo")}
                {stat("Ø Zins", pct(gewZins * 100, 2))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ERGEBNIS */}
      {tab === "ergebnis" && (
        <>
          <div className="grid-2 mb-20">
            <div className="card">
              <div className="card-header"><div className="card-title">📊 Cashflow heute</div></div>
              <div className="card-body">
                <CfRows rows={[
                  ["Warmmiete", warmmiete, "green"], ["Bewirtsch. (umlagef.)", -umlagefaehig, "red"],
                  ["Bewirtsch. (nicht uml.)", -nichtUmlagefaehig, "red"], ["Zinsen", -zinsenMo1, "red"],
                  ["Tilgung", -(gesRate - zinsenMo1), "red"], ["= Cashflow operativ", cfOp, cfOp >= 0 ? "green" : "red"],
                  ["Steuern", -steuernMo, steuernMo > 0 ? "red" : "green"], ["= Cashflow nach Steuern", cfNetto, cfNetto >= 0 ? "green" : "red"],
                ]} />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">🔮 Cashflow {zJahr}</div></div>
              <div className="card-body">
                <div className="field-row" style={{ marginBottom: 12 }}>
                  {F("Zieljahr", zukunftJahr, setZukunftJahr)}
                  {F("Wertsteigerung (%/J)", wertsteigerung, setWertsteigerung, "0.5")}
                </div>
                <div className="field-row" style={{ marginBottom: 12 }}>
                  {F("Mietsteigerung (%/J)", mietsteigerung, setMietsteigerung, "0.5")}
                  {F("Kostensteigerung (%/J)", kostensteigerung, setKostensteigerung, "0.5")}
                </div>
                <CfRows rows={[
                  ["Warmmiete", zWarmmiete, "green"], ["Bewirtsch. (nicht uml.)", -zBewirt, "red"],
                  ["Zinsen", -zZinsen, "red"], ["Tilgung", -(gesRate - zZinsen), "red"],
                  ["= Cashflow operativ", zCfOp, zCfOp >= 0 ? "green" : "red"],
                  ["Steuern", -zSteuern, zSteuern > 0 ? "red" : "green"], ["= Cashflow nach Steuern", zCfNetto, zCfNetto >= 0 ? "green" : "red"],
                  ["Immobilienwert", zWert, "teal"],
                ]} />
              </div>
            </div>
          </div>

          <div className="grid-4 mb-20">
            {ampeln.map((a, i) => {
              const color = a.val >= a.gruen ? "var(--green)" : a.val >= a.gelb ? "var(--amber)" : "var(--red)";
              const bg = a.val >= a.gruen ? "var(--green-dim)" : a.val >= a.gelb ? "rgba(240,160,48,0.12)" : "var(--red-dim)";
              const label = a.val >= a.gruen ? "🟢 Gut" : a.val >= a.gelb ? "🟡 Mittel" : "🔴 Gering";
              return (
                <div key={i} className="stat-box" style={{ borderColor: color, background: bg }}>
                  <div className="stat-lbl">{a.lbl}</div>
                  <div className="stat-val" style={{ fontSize: 16, color }}>{a.f(a.val)}</div>
                  <div className="stat-note">{label}</div>
                </div>
              );
            })}
          </div>

          <div className="grid-2 mb-20">
            <div className="card">
              <div className="card-header"><div className="card-title">📋 Kennzahlen</div></div>
              <div className="card-body">
                <table className="cmp-table">
                  <thead><tr><th>Kennzahl</th><th>Wert</th><th>Bewertung</th></tr></thead>
                  <tbody>{kennzahlen.map((r, i) => <tr key={i}><td style={{ color: "var(--muted)" }}>{r[0]}</td><td style={{ fontWeight: 600 }}>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">⚡ Zinsänderungsrisiko</div></div>
              <div className="card-body">
                {[3, 4, 5, 6, 7, 8].map((p) => {
                  const rateNeu = (gesDarlehen * (p / 100 + d1T)) / 12;
                  const cf = nettokaltmiete - nichtUmlagefaehig - rateNeu;
                  const c = cf >= 0 ? "var(--green)" : cf >= -200 ? "var(--amber)" : "var(--red)";
                  return (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                      <span style={{ color: "var(--muted)", width: 80 }}>{p}% Zins p.a.</span>
                      <div style={{ flex: 1, height: 14, background: "var(--bg4)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, (cf + 500) / 10))}%`, height: "100%", background: c }} />
                      </div>
                      <span style={{ fontWeight: 600, color: c, width: 80, textAlign: "right" }}>{fmtE(cf)}/Mo</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* VERLAUF */}
      {tab === "verlauf" && (
        <div className="card mb-20">
          <div className="card-header"><div className="card-title">📈 30-Jahres-Verlauf</div></div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="plan-table">
              <thead><tr><th>Jahr</th><th>Kaltmiete/Mo</th><th>Immobilienwert</th><th>Restschuld</th><th>CF operativ</th><th>CF n. Steuern</th></tr></thead>
              <tbody>
                {verlauf.map((r) => (
                  <tr key={r.yr}>
                    <td style={{ color: "var(--muted)" }}>{r.yr}</td>
                    <td>{fmtE(r.m)}</td>
                    <td>{fmtE(r.wert)}</td>
                    <td>{fmtE(r.rs)}</td>
                    <td style={{ color: r.cf >= 0 ? "var(--green)" : "var(--red)" }}>{fmtE(r.cf)}</td>
                    <td style={{ color: r.cfn >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{fmtE(r.cfn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
