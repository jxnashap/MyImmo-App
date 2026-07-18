"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, Save, FolderOpen, Scale, Gauge, Home, Percent, Landmark, Target, TrendingUp, Lock, BarChart3, Sparkles, ClipboardList, Zap, Crown, ArrowRight } from "lucide-react";

// Farbiger Status-Punkt (Ersatz für die Ampel-Emojis)
const Dot = ({ c }: { c: string }) => <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: `var(--${c})`, marginRight: 5, verticalAlign: "-1px" }} />;
import KalkImport from "@/components/kalkulator/KalkImport";
import CockpitUeberblick from "@/components/kalkulator/CockpitUeberblick";
import { useToast } from "@/components/Toast";
import { saveKalkulation, deleteKalkulation } from "@/lib/actions/kalkulation";
import { bestesObjekt, KAUF_AUSWAHL_KEY, type KaufAuswahl } from "@/lib/kauf/auswahl";
import { KAUF_BEWERTUNG_KEY, type KaufBewertung } from "@/lib/kauf/bewertung";
import type { Kalkulation } from "@/lib/types";
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

const SUBTABS: { id: string; label: string; Icon: typeof Gauge }[] = [
  { id: "ueberblick", label: "Überblick", Icon: Gauge },
  { id: "invest", label: "Objekt & Investition", Icon: Home },
  { id: "miete", label: "Miete & Steuern", Icon: Percent },
  { id: "fin", label: "Finanzierung", Icon: Landmark },
  { id: "ergebnis", label: "Cockpit-Ergebnis", Icon: Target },
  { id: "verlauf", label: "Verlauf 30J.", Icon: TrendingUp },
];

// Vergleich: höher besser (high) / niedriger besser (low) / neutral
const CMP_METRIKEN: { key: string; label: string; fmt: (v: number) => string; better: "high" | "low" | "none" }[] = [
  { key: "kp", label: "Kaufpreis", fmt: fmtE, better: "low" },
  { key: "gesamtInvest", label: "Gesamtinvestition", fmt: fmtE, better: "low" },
  { key: "eigenkapital", label: "Eigenkapital", fmt: fmtE, better: "none" },
  { key: "cfNetto", label: "Cashflow n.St./Mo", fmt: (v) => fmtE(v) + "/Mo", better: "high" },
  { key: "brutto", label: "Bruttorendite", fmt: (v) => pct(v), better: "high" },
  { key: "nettomiet", label: "Nettorendite", fmt: (v) => pct(v), better: "high" },
  { key: "ekRendite", label: "EK-Rendite", fmt: (v) => pct(v), better: "high" },
  { key: "faktor", label: "Kaufpreisfaktor", fmt: (v) => (v > 0 ? fmt(v, 1) + "x" : "–"), better: "low" },
];

export default function Cockpit({ gespeichert = [] }: { gespeichert?: Kalkulation[] }) {
  const [tab, setTab] = useState("ueberblick");
  const toast = useToast();

  // Liste lokal führen (aus Prop initialisiert) — kein router.refresh(), sonst
  // gehen die Eingabe-States beim Speichern verloren.
  const [gespeichertLocal, setGespeichertLocal] = useState<Kalkulation[]>(gespeichert);

  // Headbar-Aktionen
  const [showSave, setShowSave] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

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
  const [baubeginn, setBaubeginn] = useState(""); // "YYYY-MM" — Pflicht für degressive AfA
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

  // Werte aus dem Marktwert-Schätzer (Schritt 1) übernehmen — nur leere Felder
  // füllen, damit eigene Eingaben nicht überschrieben werden.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KAUF_BEWERTUNG_KEY);
      if (!raw) return;
      const b = JSON.parse(raw) as KaufBewertung;
      if (b.kaufpreis > 0) setKaufpreis((v) => v || String(Math.round(b.kaufpreis)));
      if (b.flaeche > 0) setFlaeche((v) => v || String(b.flaeche));
      if (b.jahresmiete > 0) setKaltmiete((v) => v || String(Math.round(b.jahresmiete / 12)));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Degressive AfA (§ 7 Abs. 5a EStG): 5 % p.a. geometrisch-degressiv vom
  // Restbuchwert — nur neue Wohngebäude, Baubeginn/Kauf 10/2023–09/2029.
  // Vereinfachung: reine 5 %-Degression, ohne Wechsel zur linearen AfA.
  // Sperre: degressiv nur, wenn Baubeginn/Kaufvertrag im Fenster 10/2023–09/2029
  // liegt (§ 7 Abs. 5a EStG). Sonst Rückfall auf linear 3 % (Neubau) + Warnung.
  const degressivGewaehlt = afaSatz === "degressiv";
  const degressivErlaubt =
    /^\d{4}-\d{2}$/.test(baubeginn) && baubeginn >= "2023-10" && baubeginn <= "2029-09";
  const istDegressiv = degressivGewaehlt && degressivErlaubt;
  const linSatz = degressivGewaehlt ? 0.03 : num(afaSatz); // Fallback bei Sperre
  const afaMo = (istDegressiv ? afaBasis * 0.05 : afaBasis * linSatz) / 12;
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
  const afaMoZukunft = (istDegressiv ? afaBasis * 0.05 * Math.pow(0.95, jahre - 1) : afaBasis * linSatz) / 12;
  const zZvE = zMiete - num(hgNichtUmlage) - zZinsen - afaMoZukunft;
  const zSteuern = zZvE * grenzsteuer;
  const zCfNetto = zCfOp - zSteuern;
  const zWert = kp * Math.pow(1 + num(wertsteigerung) / 100, jahre);

  // localStorage für Bankgespräch
  useEffect(() => {
    const d: CpData = { kp, qm, flaeche: fl, nk, gesamtInvest, d1Summe: d1S, d2Summe: d2S, eigenkapital, kaltmiete: nettokaltmiete, brutto, faktor, cfOp, cfNetto, gesRate, adresse };
    try { localStorage.setItem(CP_STORAGE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kp, qm, fl, nk, gesamtInvest, d1S, d2S, eigenkapital, nettokaltmiete, brutto, faktor, cfOp, cfNetto, gesRate, adresse]);

  // ===== Speichern / Laden / Löschen =====
  const eingaben: Record<string, string> = {
    adresse, kaufpreis, flaeche, bundesland, makler, notar, grundbuch, sonstigeNk, kueche, sonderumlage, investSonst,
    kaltmiete, mieteStellplatz, hgUmlage, grundsteuer, mietausfall, instandh, hgNichtUmlage, afaSatz, baubeginn, gebaeude, einkommen, veranlagung,
    d1Summe, d1Zins, d1Tilg, d1Bindung, d1ZinsNeu, d1TilgNeu, d2Summe, d2Zins, d2Tilg,
    zukunftJahr, kostensteigerung, mietsteigerung, wertsteigerung,
  };
  const summary: Record<string, number> = {
    kp, gesamtInvest, eigenkapital, gesRate, nettokaltmiete, brutto, nettomiet, ekRendite, faktor, cfOp, cfNetto,
  };
  const SETTER: Record<string, (v: string) => void> = {
    adresse: setAdresse, kaufpreis: setKaufpreis, flaeche: setFlaeche, bundesland: setBundesland, makler: setMakler, notar: setNotar, grundbuch: setGrundbuch, sonstigeNk: setSonstigeNk, kueche: setKueche, sonderumlage: setSonderumlage, investSonst: setInvestSonst,
    kaltmiete: setKaltmiete, mieteStellplatz: setMieteStellplatz, hgUmlage: setHgUmlage, grundsteuer: setGrundsteuer, mietausfall: setMietausfall, instandh: setInstandh, hgNichtUmlage: setHgNichtUmlage, afaSatz: setAfaSatz, baubeginn: setBaubeginn, gebaeude: setGebaeude, einkommen: setEinkommen, veranlagung: setVeranlagung,
    d1Summe: setD1Summe, d1Zins: setD1Zins, d1Tilg: setD1Tilg, d1Bindung: setD1Bindung, d1ZinsNeu: setD1ZinsNeu, d1TilgNeu: setD1TilgNeu, d2Summe: setD2Summe, d2Zins: setD2Zins, d2Tilg: setD2Tilg,
    zukunftJahr: setZukunftJahr, kostensteigerung: setKostensteigerung, mietsteigerung: setMietsteigerung, wertsteigerung: setWertsteigerung,
  };

  async function doSave() {
    setSaving(true);
    try {
      const neu = await saveKalkulation(saveName, eingaben, summary);
      setGespeichertLocal((prev) => [neu, ...prev]);
      setShowSave(false);
      toast("Gespeichert.");
    } catch {
      toast("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  function ladeKalkulation(k: Kalkulation) {
    for (const key of Object.keys(SETTER)) {
      const v = k.data?.[key];
      if (v != null) SETTER[key](String(v));
    }
    setTab("ueberblick");
    setShowList(false);
  }

  async function loeschen(id: string) {
    try {
      await deleteKalkulation(id);
      setGespeichertLocal((prev) => prev.filter((k) => k.id !== id));
      setCompareIds((c) => c.filter((x) => x !== id));
      toast("Gelöscht.");
    } catch {
      toast("Fehler beim Löschen.");
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 5 ? c : [...c, id]));
  }

  // Gewähltes Objekt für den Kauf-Flow (Finanzierung/Kreditantrag) mitnehmen.
  function objektUebernehmen(k: Kalkulation) {
    const s = k.summary ?? {};
    const gesamt = s.gesamtInvest ?? 0;
    const ek = s.eigenkapital ?? 0;
    const auswahl: KaufAuswahl = {
      kalkId: k.id,
      name: k.name,
      adresse: k.data?.adresse ?? "",
      kp: s.kp ?? 0,
      gesamtInvest: gesamt,
      eigenkapital: ek,
      darlehen: Math.max(0, gesamt - ek),
      rate: s.gesRate ?? 0,
      kaltmiete: s.nettokaltmiete ?? 0,
      cfNetto: s.cfNetto ?? 0,
      gewaehltAm: new Date().toISOString().slice(0, 10),
    };
    try { localStorage.setItem(KAUF_AUSWAHL_KEY, JSON.stringify(auswahl)); } catch { /* ignore */ }
    toast(`„${k.name}“ für die Finanzierung übernommen.`);
    setShowCompare(false);
  }

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

  const kennzahlen: [string, string, React.ReactNode][] = [
    ["Kaufpreis", fmtE(kp), ""], ["Gesamtinvestition", fmtE(gesamtInvest), ""],
    ["Preis/m²", qm > 0 ? fmtE(qm) + "/m²" : "–", ""], ["Kaufpreisfaktor", faktor > 0 ? fmt(faktor, 1) + "x" : "–", faktor < 25 ? <Dot c="green" /> : faktor < 30 ? <Dot c="amber" /> : <Dot c="red" />],
    ["Bruttomietrendite", pct(brutto), brutto >= 5 ? <Dot c="green" /> : brutto >= 4 ? <Dot c="amber" /> : <Dot c="red" />],
    ["Nettomietrendite", pct(nettomiet), nettomiet >= 4 ? <Dot c="green" /> : nettomiet >= 3 ? <Dot c="amber" /> : <Dot c="red" />],
    ["Cashflow operativ", fmtE(cfOp) + "/Mo", cfOp >= -1.67 ? <Dot c="green" /> : cfOp >= -3.33 ? <Dot c="amber" /> : <Dot c="red" />],
    ["Cashflow nach Steuern", fmtE(cfNetto) + "/Mo", cfNetto >= -1.67 ? <Dot c="green" /> : cfNetto >= -3.33 ? <Dot c="amber" /> : <Dot c="red" />],
    ["Eigenkapitalrendite", pct(ekRendite), ekRendite >= 20 ? <Dot c="green" /> : ekRendite >= 10 ? <Dot c="amber" /> : <Dot c="red" />],
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
      const afaMoJ = (istDegressiv ? afaBasis * 0.05 * Math.pow(0.95, j - 1) : afaBasis * linSatz) / 12;
      const st = (m - num(hgNichtUmlage) - zinsMo - afaMoJ) * grenzsteuer;
      verlauf.push({ yr: JETZT + j, m, wert, rs: rs1 + rs2, cf, cfn: cf - st });
    }
  }

  // Vergleich: beste Werte je Zeile bestimmen
  const cmpSel = compareIds.map((id) => gespeichertLocal.find((k) => k.id === id)).filter(Boolean) as Kalkulation[];
  const bestValue = (key: string, better: "high" | "low" | "none"): number | null => {
    if (better === "none" || cmpSel.length < 2) return null;
    const vals = cmpSel.map((k) => k.summary?.[key]).filter((v) => typeof v === "number") as number[];
    if (!vals.length) return null;
    const best = better === "high" ? Math.max(...vals) : Math.min(...vals);
    return vals.every((v) => v === best) ? null : best; // kein Highlight, wenn alle gleich
  };
  // Gesamt-Sieger über alle Kennzahlen (Punkte je gewonnener Zeile).
  const vergleich = bestesObjekt(cmpSel.map((k) => ({ id: k.id, summary: k.summary })), CMP_METRIKEN);

  return (
    <>
      {/* KOPF im Einstellungs-Stil */}
      <div className="settings-head">
        <div className="settings-avatar"><Calculator size={22} /></div>
        <div className="who"><h1>Cockpit</h1><p>Vollständige Profi-Kalkulation</p></div>
        <div className="settings-actions">
          <button className="btn btn-ghost" onClick={() => { setSaveName(adresse || "Kalkulation"); setShowSave(true); }}><Save size={15} /> Speichern</button>
          <button className="btn btn-ghost" onClick={() => setShowList(true)}><FolderOpen size={15} /> Gespeichert ({gespeichertLocal.length})</button>
          <button className="btn btn-ghost" onClick={() => { setCompareIds([]); setShowCompare(true); }}><Scale size={15} /> Vergleich</button>
        </div>
      </div>

      <KalkImport
        beobachten={[kaufpreis, flaeche, kaltmiete, adresse]}
        onResult={(d) => {
          if (d.kaufpreis != null) setKaufpreis(String(d.kaufpreis));
          if (d.flaeche != null) setFlaeche(String(d.flaeche));
          if (d.miete != null && d.miete > 0) setKaltmiete(String(d.miete));
          if (d.adresse) setAdresse(d.adresse);
          if (d.name) setSaveName(d.name); // Vorschlag für den Speicher-Namen
        }}
      />

      <div className="settings-tabs" style={{ marginBottom: 20 }}>
        {SUBTABS.map((s) => (
          <button key={s.id} className={`settings-tab${tab === s.id ? " active" : ""}`} onClick={() => setTab(s.id)}>
            <s.Icon size={15} /> {s.label}
          </button>
        ))}
      </div>

      {/* ÜBERBLICK */}
      {tab === "ueberblick" && (
        <CockpitUeberblick
          kp={kp} gesamtInvest={gesamtInvest} eigenkapital={eigenkapital} gesRate={gesRate}
          nettokaltmiete={nettokaltmiete} brutto={brutto} nettomiet={nettomiet} ekRendite={ekRendite}
          faktor={faktor} cfOp={cfOp} cfNetto={cfNetto}
          verlauf={verlauf.map((r) => ({ yr: r.yr, wert: r.wert, rs: r.rs }))}
        />
      )}

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
                <div className="field"><label>AfA-Satz</label><select value={afaSatz} onChange={(e) => setAfaSatz(e.target.value)}><option value="0.02">2% (nach 1924)</option><option value="0.025">2,5% (vor 1925)</option><option value="0.03">3% (Neubau ab 2023)</option><option value="degressiv">Degressiv 5 % (Neubau 10/2023–09/2029)</option></select></div>
                {F("Gebäudeanteil am KP (%)", gebaeude, setGebaeude)}
              </div>
              <div className="field-row">
                {F("Zu verst. Einkommen (€/Jahr)", einkommen, setEinkommen)}
                <div className="field"><label>Veranlagung</label><select value={veranlagung} onChange={(e) => setVeranlagung(e.target.value)}><option value="1">Einzel</option><option value="2">Zusammen (Splitting)</option></select></div>
              </div>
              {degressivGewaehlt && (
                <>
                  <div className="field-row">
                    <div className="field">
                      <label>Baubeginn / Kaufvertrag (Monat) *</label>
                      <input type="month" min="2023-10" max="2029-09" value={baubeginn} onChange={(e) => setBaubeginn(e.target.value)} />
                    </div>
                    <div />
                  </div>
                  {istDegressiv ? (
                    <div style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 2px", lineHeight: 1.5 }}>
                      Degressiv: 5 % vom Restbuchwert (fällt jährlich). Nur Wohngebäude, Baubeginn/Kauf 10/2023–09/2029.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--red)", margin: "6px 0 2px", lineHeight: 1.5, fontWeight: 600 }}>
                      <Lock size={11} style={{ verticalAlign: "-1px" }} /> Degressive AfA gesperrt: {baubeginn ? "Datum liegt außerhalb 10/2023–09/2029." : "Bitte Baubeginn/Kaufvertrag angeben."} Es wird linear 3 % (Neubau) gerechnet.
                    </div>
                  )}
                </>
              )}
              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {stat(istDegressiv ? "AfA / Monat (1. Jahr)" : "AfA / Monat", fmtE(afaMo) + "/Mo")}
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
              <div className="card-header"><div className="card-title"><BarChart3 size={16} style={{ verticalAlign: "-3px" }} /> Cashflow heute</div></div>
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
              <div className="card-header"><div className="card-title"><Sparkles size={16} style={{ verticalAlign: "-3px" }} /> Cashflow {zJahr}</div></div>
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
              const label = a.val >= a.gruen ? <><Dot c="green" />Gut</> : a.val >= a.gelb ? <><Dot c="amber" />Mittel</> : <><Dot c="red" />Gering</>;
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
              <div className="card-header"><div className="card-title"><ClipboardList size={16} style={{ verticalAlign: "-3px" }} /> Kennzahlen</div></div>
              <div className="card-body">
                <table className="cmp-table">
                  <thead><tr><th>Kennzahl</th><th>Wert</th><th>Bewertung</th></tr></thead>
                  <tbody>{kennzahlen.map((r, i) => <tr key={i}><td style={{ color: "var(--muted)" }}>{r[0]}</td><td style={{ fontWeight: 600 }}>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title"><Zap size={16} style={{ verticalAlign: "-3px" }} /> Zinsänderungsrisiko</div></div>
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
          <div className="card-header"><div className="card-title"><TrendingUp size={16} style={{ verticalAlign: "-3px" }} /> 30-Jahres-Verlauf</div></div>
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

      {/* MODAL: SPEICHERN — per Portal an document.body (viewport-fest) */}
      {showSave && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setShowSave(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14 }}>Kalkulation speichern</h3>
            <div className="field"><label>Name</label>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Kalkulation" autoFocus />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setShowSave(false)}>Abbrechen</button>
              <button className="btn btn-gold" onClick={doSave} disabled={saving}>{saving ? "Speichert…" : "Speichern"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: GESPEICHERTE — per Portal an document.body */}
      {showList && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setShowList(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14 }}>Gespeicherte Kalkulationen</h3>
            {gespeichertLocal.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Noch nichts gespeichert. Oben rechts „<Save size={12} style={{ verticalAlign: "-2px" }} /> Speichern".</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
                {gespeichertLocal.map((k) => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line2)", background: "var(--bg3)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {new Date(k.created_at).toLocaleDateString("de-DE")} · CF n.St. {typeof k.summary?.cfNetto === "number" ? fmtE(k.summary.cfNetto) + "/Mo" : "–"}
                      </div>
                    </div>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => ladeKalkulation(k)}>Laden</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--red)" }} onClick={() => loeschen(k.id)}>Löschen</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowList(false)}>Schließen</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: VERGLEICH — per Portal an document.body */}
      {showCompare && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setShowCompare(false)}>
          <div className="modal-sheet wide" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6 }}>Kalkulationen vergleichen</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Bis zu 5 gespeicherte Objekte wählen. Das Objekt mit den meisten besten Kennzahlen wird als Empfehlung markiert — du kannst es für die Finanzierung übernehmen.</p>
            {gespeichertLocal.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Noch nichts gespeichert.</p>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {gespeichertLocal.map((k) => {
                    const sel = compareIds.includes(k.id);
                    const disabled = !sel && compareIds.length >= 3;
                    return (
                      <button key={k.id} onClick={() => toggleCompare(k.id)} disabled={disabled}
                        className="settings-tab"
                        style={{ border: `1px solid ${sel ? "var(--gold)" : "var(--line2)"}`, background: sel ? "var(--gold-pale)" : "var(--bg3)", color: sel ? "var(--gold)" : "var(--muted)", opacity: disabled ? 0.4 : 1 }}>
                        {sel ? "✓ " : ""}{k.name}
                      </button>
                    );
                  })}
                </div>
                {cmpSel.length >= 2 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table className="cmp-table">
                      <thead>
                        <tr>
                          <th>Kennzahl</th>
                          {cmpSel.map((k) => {
                            const sieger = vergleich.eindeutig && vergleich.id === k.id;
                            return (
                              <th key={k.id} style={{ textAlign: "right", color: sieger ? "var(--gold)" : undefined }}>
                                {sieger && <Crown size={13} style={{ verticalAlign: "-2px", marginRight: 3 }} />}{k.name}
                                <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--muted)" }}>{vergleich.punkte[k.id] ?? 0} Bestwerte</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {CMP_METRIKEN.map((m) => {
                          const best = bestValue(m.key, m.better);
                          return (
                            <tr key={m.key}>
                              <td style={{ color: "var(--muted)" }}>{m.label}</td>
                              {cmpSel.map((k) => {
                                const v = k.summary?.[m.key];
                                const isBest = best != null && typeof v === "number" && v === best;
                                return (
                                  <td key={k.id} style={{ textAlign: "right", fontWeight: isBest ? 700 : 500, color: isBest ? "var(--green)" : undefined }}>
                                    {typeof v === "number" ? m.fmt(v) : "–"}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td />
                          {cmpSel.map((k) => {
                            const sieger = vergleich.eindeutig && vergleich.id === k.id;
                            return (
                              <td key={k.id} style={{ textAlign: "right", paddingTop: 10 }}>
                                <button
                                  type="button"
                                  className={`btn ${sieger ? "btn-gold" : "btn-ghost"}`}
                                  style={{ fontSize: 11.5 }}
                                  onClick={() => objektUebernehmen(k)}
                                >
                                  übernehmen <ArrowRight size={12} style={{ verticalAlign: "-2px" }} />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--faint)" }}>Mindestens 2 Objekte wählen, um zu vergleichen.</p>
                )}
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowCompare(false)}>Schließen</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
