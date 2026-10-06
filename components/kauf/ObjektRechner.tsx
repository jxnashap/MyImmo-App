"use client";

import { useEffect, useState } from "react";
import { Home, Building2, Save, Scale, Landmark, Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { zahlDe0 } from "@/lib/zahl";
import KalkImport from "@/components/kalkulator/KalkImport";
import { saveKalkulation, deleteKalkulation, updateKalkulation } from "@/lib/actions/kalkulation";
import { auswahlAus, KAUF_AUSWAHL_KEY, type KaufAuswahl } from "@/lib/kauf/auswahl";
import { sanierungBeimLaden } from "@/lib/sanierung/uebergabe";
import { BUNDESLAENDER, MAKLER_STANDARD_PROZENT } from "@/lib/kalk";
import { kennzahlenSummary, objektKennzahlen } from "@/lib/kauf/objektKennzahlen";
import { HAUS_DISCLAIMER } from "@/lib/kauf/hausbewertung";
import { anschaffungsnahVorKauf } from "@/lib/steuer/anschaffungsnah";
import { preisUrteil } from "@/lib/kauf/marktwert";
import { belastbarkeit } from "@/lib/kauf/belastbarkeit";
import { NHK_TYPEN } from "@/lib/bewertung/immowertv";
import { useCountUp } from "@/lib/hooks/useCountUp";
import type { Kalkulation } from "@/lib/types";
import ObjektVergleich, { VERGLEICH_MAX } from "@/components/kauf/ObjektVergleich";

const eur = (n: number) => "€ " + Math.round(n || 0).toLocaleString("de-DE");
const pct = (n: number, d = 1) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
const fmt1 = (n: number) => (n || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });
const num = zahlDe0;

// Positive, nicht abschreckende Bewertung der Bruttorendite (kein Rot).
function renditeUrteil(brutto: number): { text: string; farbe: string } {
  if (brutto >= 5) return { text: "Starke Rendite", farbe: "var(--green)" };
  if (brutto >= 4) return { text: "Solide Rendite", farbe: "var(--green)" };
  if (brutto >= 3) return { text: "Ordentlich — genau rechnen", farbe: "var(--teal, #2c9c8f)" };
  return { text: "Auf Lage & Wertsteigerung setzen", farbe: "var(--amber)" };
}

type Tile = { label: string; wert: string; gold?: boolean; farbe?: string; note?: string; braucht?: string };

// Belastbarkeits-Ring: misst NUR die Eingabe-Vollständigkeit (§ 34i: keine
// Objekt-/Deal-Bewertung, keine Wertermittlung). Neutrale Farbe, klar getrennt.
function BelastbarkeitsRing({ prozent, stufe, offen }: { prozent: number; stufe: string; offen: { label: string }[] }) {
  const r = 20, C = 2 * Math.PI * r;
  const anim = useCountUp(prozent, 650);
  return (
    <div title="Misst nur, wie vollständig deine Eingaben sind — keine Wertermittlung und keine Bewertung des Objekts."
      aria-label={`Eingabe-Vollständigkeit ${Math.round(prozent)} Prozent`}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 11, background: "var(--bg3)", border: "1px solid var(--line)", marginBottom: 12 }}>
      <div style={{ position: "relative", width: 50, height: 50, flexShrink: 0 }}>
        <svg width="50" height="50" viewBox="0 0 50 50" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx="25" cy="25" r={r} fill="none" stroke="var(--bg4, #2a2722)" strokeWidth="5" />
          <circle className="no-motion-transition" cx="25" cy="25" r={r} fill="none" stroke="var(--muted)" strokeWidth="5"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - anim / 100)}
            style={{ transition: "stroke-dashoffset .65s var(--ease)" }} />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{Math.round(anim)}%</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Eingabe-Vollständigkeit · {stufe}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          {offen.length > 0 ? <>fehlt noch: {offen.map((o) => o.label).join(", ")}</> : "alle relevanten Felder befüllt"}
        </div>
      </div>
    </div>
  );
}

// Vorbelegung fuer die oeffentliche Demo. Ohne sie stuende dort ein leerer,
// gesperrter Rechner — sichtbar, aber ohne Aussage. Die Zahlen sind bewusst
// unspektakulaer und plausibel: eine vermietete 3-Zimmer-Altbauwohnung, wie sie
// die Zielgruppe tatsaechlich kauft.
const DEMO_START = {
  adresse: "Karl-Liebknecht-Str. 42, 04275 Leipzig",
  kaufpreis: "245000",
  flaeche: "72",
  kaltmiete: "720",
  baujahr: "1911",
};

export default function ObjektRechner({
  gespeichert = [], demo = false, sanierungStart = null, startObjektId = null,
}: {
  gespeichert?: Kalkulation[]; demo?: boolean;
  /** Aus dem Sanierungs-Guide übergeben (`/vergleich?sanierung=…`, lib/sanierung/uebergabe.ts). */
  sanierungStart?: number | null;
  /** Kaufprüfung, für die die Besichtigung lief (`&objekt=…`) — wird zum Bearbeiten geöffnet. */
  startObjektId?: string | null;
}) {
  const toast = useToast();
  const [liste, setListe] = useState<Kalkulation[]>(gespeichert);

  // Grundwerte
  const [adresse, setAdresse] = useState(demo ? DEMO_START.adresse : "");
  const [kaufpreis, setKaufpreis] = useState(demo ? DEMO_START.kaufpreis : "");
  const [flaeche, setFlaeche] = useState(demo ? DEMO_START.flaeche : "");
  const [bundesland, setBundesland] = useState("0.05");
  // EIN Standardwert mit dem Fahrplan-Rechner (lib/kalk.ts), nicht hier fest.
  const MAKLER_STANDARD = String(MAKLER_STANDARD_PROZENT);
  const [makler, setMakler] = useState(MAKLER_STANDARD);
  const [maklerBeruehrt, setMaklerBeruehrt] = useState(false); // für Belastbarkeits-Score
  // Sanierung / Renovierung (BuyImmo, 05.10.2026): von Hand oder aus dem Sanierungsrechner.
  const [sanierung, setSanierung] = useState(sanierungStart ? String(sanierungStart) : "");
  // Ein aus dem Sanierungsrechner übergebener Betrag gilt, bis er verbraucht ist — auch wenn der
  // Nutzer danach eine gespeicherte Kaufprüfung zum Bearbeiten lädt (Review 05.10.2026: sonst ging
  // der Betrag beim „Bearbeiten“ still verloren).
  const [uebergabeOffen, setUebergabeOffen] = useState(sanierungStart != null && sanierungStart > 0);
  // Nutzung
  const [nutzung, setNutzung] = useState<"vermietung" | "eigennutzung">("vermietung");
  const [kaltmiete, setKaltmiete] = useState(demo ? DEMO_START.kaltmiete : "");
  const [bewirt, setBewirt] = useState("20"); // % der Miete (Rundwert)
  const [hausgeld, setHausgeld] = useState(""); // €/Mo (Eigennutzung: laufende Kosten)

  // Objekttyp + Haus-Substanzwert (Sachwert, ausklappbar). Reine Plausibilisierung
  // neben der Rendite; nutzt die ImmoWertV-Engine (lib/kauf/hausbewertung.ts).
  const [objektTyp, setObjektTyp] = useState<"wohnung" | "haus">("wohnung");
  const [grundFlaeche, setGrundFlaeche] = useState("");
  const [bodenrichtwert, setBodenrichtwert] = useState("");
  const [baujahr, setBaujahr] = useState(demo ? DEMO_START.baujahr : "");
  const [gebTyp, setGebTyp] = useState("efh");
  const [ausstattung, setAusstattung] = useState("3");
  const [bpiFaktor, setBpiFaktor] = useState("1.9");
  const [regionalFaktor, setRegionalFaktor] = useState("1.0");
  // Marktwert-Verfahren: Ertragswert braucht Liegenschaftszins + Anzahl WE,
  // Sachwert den Sachwertfaktor (zuvor nur im Reiter „Marktwert-Schätzer").
  const [lz, setLz] = useState("3.5");
  const [anzahlWhg, setAnzahlWhg] = useState("1");
  const [swFaktor, setSwFaktor] = useState("1.0");
  // Wiedervorlage: gesetzt = ein gespeichertes Objekt wird bearbeitet.
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);

  // Speichern / Vergleich (Kaufweg Schritt 1): die neuesten Kandidaten stehen von Anfang an nebeneinander.
  const [saving, setSaving] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(() => gespeichert.slice(0, VERGLEICH_MAX).map((k) => k.id));
  // Für die Finanzierung gewähltes Objekt — liegt im Browser (lib/kauf/auswahl.ts), erst nach dem Mount lesbar.
  const [gewaehltId, setGewaehltId] = useState<string | null>(null);

  // EINE Rechnung mit den Beispiel-Kandidaten der Demo (lib/kauf/objektKennzahlen.ts) — hier nur Anzeige.
  const kz = objektKennzahlen({
    kaufpreis, flaeche, bundesland, makler, sanierung, nutzung, kaltmiete, bewirt,
    objektTyp, grundFlaeche, bodenrichtwert, baujahr, gebTyp, ausstattung, bpiFaktor, regionalFaktor, lz, anzahlWhg, swFaktor,
  });
  const { kp, fl, nebenkosten, gesamtInvest, preisM2, vermietung, brutto, faktor, nettomiet, mw } = kz;
  const sanierungBetrag = kz.sanierung;
  const investNotiz = `inkl. ${eur(nebenkosten)} Nebenkosten${sanierungBetrag > 0 ? ` + ${eur(sanierungBetrag)} Sanierung` : ""}`;
  const fuenfzehn = vermietung ? anschaffungsnahVorKauf(kp, sanierungBetrag) : null;

  const urteil = vermietung && brutto > 0 ? renditeUrteil(brutto) : null;
  const mwWert = kz.marktwert;
  // Unvollstaendige Schaetzung → kein belastbares Preisurteil (siehe preisUrteil).
  const mwUrteil = preisUrteil(mwWert, kp, mw.unsicher.length > 0);

  const bel = belastbarkeit({
    nutzung, kp, fl, kaltmiete: num(kaltmiete), hausgeld: num(hausgeld),
    adresseGesetzt: adresse.trim().length > 0,
    maklerEntschieden: maklerBeruehrt,
    bewirtGesetzt: bewirt.trim() !== "",
  });

  const tiles: Tile[] = vermietung
    ? [
        { label: "Gesamtinvestition", wert: kp > 0 ? eur(gesamtInvest) : "", gold: true, note: investNotiz, braucht: "Kaufpreis eintragen" },
        { label: "Preis / m²", wert: preisM2 > 0 ? eur(preisM2) : "", braucht: "Kaufpreis + Wohnfläche" },
        { label: "Bruttorendite", wert: brutto > 0 ? pct(brutto) : "", farbe: urteil?.farbe, note: urteil?.text, braucht: "Kaltmiete eintragen" },
        { label: "Nettorendite", wert: nettomiet > 0 ? pct(nettomiet) : "", note: `nach ${num(bewirt)} % Bewirtschaftung`, braucht: "Kaltmiete eintragen" },
        { label: "Kaufpreisfaktor", wert: faktor > 0 ? fmt1(faktor) + "×" : "", note: "Jahresmieten bis zur Amortisation", braucht: "Kaufpreis + Kaltmiete" },
        { label: "Marktwert (geschätzt)", wert: mwWert > 0 ? eur(mwWert) : "", farbe: mwUrteil?.farbe, note: mwUrteil?.text ?? mw.verfahrenLabel, braucht: mw.fehlend.length ? mw.fehlend.join(" + ") + " eintragen" : "Angaben ergänzen" },
      ]
    : [
        { label: "Gesamtinvestition", wert: kp > 0 ? eur(gesamtInvest) : "", gold: true, note: investNotiz, braucht: "Kaufpreis eintragen" },
        { label: "Preis / m²", wert: preisM2 > 0 ? eur(preisM2) : "", braucht: "Kaufpreis + Wohnfläche" },
        { label: "Laufende Kosten", wert: num(hausgeld) > 0 ? eur(num(hausgeld)) + "/Mo" : "", note: "Hausgeld / Bewirtschaftung", braucht: "Laufende Kosten eintragen" },
        { label: "Marktwert (geschätzt)", wert: mwWert > 0 ? eur(mwWert) : "", farbe: mwUrteil?.farbe, note: mwUrteil?.text ?? mw.verfahrenLabel, braucht: mw.fehlend.length ? mw.fehlend.join(" + ") + " eintragen" : "Angaben ergänzen" },
      ];

  // Alle Eingaben sichern — auch die Bewertungsfelder. Vorher gingen sie beim
  // Speichern verloren, die Wiedervorlage hätte sie nicht zurückholen können.
  function eingabenSnapshot(): Record<string, string> {
    return {
      adresse, kaufpreis, flaeche, bundesland, makler, sanierung, nutzung, kaltmiete, bewirt, hausgeld,
      objektTyp, grundFlaeche, bodenrichtwert, baujahr, gebTyp, ausstattung,
      bpiFaktor, regionalFaktor, lz, anzahlWhg, swFaktor,
    };
  }
  function summarySnapshot(): Record<string, number> {
    return kennzahlenSummary(kz);
  }

  // Wiedervorlage: gespeichertes Objekt zurück in die Maske holen.
  function bearbeiten(k: Kalkulation) {
    const d = k.data ?? {};
    const g = (key: string, fallback = "") => d[key] ?? fallback;
    setAdresse(g("adresse")); setKaufpreis(g("kaufpreis")); setFlaeche(g("flaeche"));
    setBundesland(g("bundesland", "0.05")); setMakler(g("makler", MAKLER_STANDARD)); setMaklerBeruehrt(true);
    // Ältere Kaufprüfungen haben das Feld nicht → leer. Ein offener Betrag aus dem Rechner gewinnt.
    const s = sanierungBeimLaden(g("sanierung"), uebergabeOffen ? sanierungStart : null);
    setSanierung(s.wert);
    if (s.verbraucht) {
      setUebergabeOffen(false);
      toast(`Sanierung ${eur(Number(s.wert))} aus dem Sanierungsrechner übernommen${g("sanierung") ? ` (gespeichert war ${eur(Number(g("sanierung")) || 0)})` : ""}.`);
    }
    setNutzung(g("nutzung") === "eigennutzung" ? "eigennutzung" : "vermietung");
    setKaltmiete(g("kaltmiete")); setBewirt(g("bewirt", "20")); setHausgeld(g("hausgeld"));
    setObjektTyp(g("objektTyp") === "haus" ? "haus" : "wohnung");
    setGrundFlaeche(g("grundFlaeche")); setBodenrichtwert(g("bodenrichtwert")); setBaujahr(g("baujahr"));
    setGebTyp(g("gebTyp", "efh")); setAusstattung(g("ausstattung", "3"));
    setBpiFaktor(g("bpiFaktor", "1.9")); setRegionalFaktor(g("regionalFaktor", "1.0"));
    setLz(g("lz", "3.5")); setAnzahlWhg(g("anzahlWhg", "1")); setSwFaktor(g("swFaktor", "1.0"));
    setBearbeiteId(k.id);
    toast(`„${k.name}" zum Bearbeiten geladen.`);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function neuesObjekt() {
    setBearbeiteId(null);
    setAdresse(""); setKaufpreis(""); setFlaeche(""); setKaltmiete(""); setHausgeld(""); setSanierung(""); setUebergabeOffen(false);
    setGrundFlaeche(""); setBodenrichtwert(""); setBaujahr("");
    toast("Maske geleert — neues Objekt erfassen.");
  }

  async function speichern() {
    if (kp <= 0) { toast("Bitte zuerst einen Kaufpreis eingeben."); return; }
    setSaving(true);
    try {
      if (bearbeiteId) {
        const akt = await updateKalkulation(bearbeiteId, adresse || "Objekt", eingabenSnapshot(), summarySnapshot());
        setListe((p) => p.map((k) => (k.id === akt.id ? akt : k)));
        toast("Objekt aktualisiert.");
      } else {
        const neu = await saveKalkulation(adresse || "Objekt", eingabenSnapshot(), summarySnapshot());
        setListe((p) => [neu, ...p]);
        setBearbeiteId(neu.id);
        // Neue Kandidaten kommen in den Vergleich, solange Platz ist.
        setCompareIds((c) => (c.length < VERGLEICH_MAX ? [...c, neu.id] : c));
        toast("Objekt im Ordner gespeichert — du kannst es jederzeit wieder öffnen.");
      }
    } catch {
      toast("Speichern fehlgeschlagen.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function loeschen(id: string) {
    try {
      await deleteKalkulation(id);
      setListe((p) => p.filter((k) => k.id !== id));
      setCompareIds((c) => c.filter((x) => x !== id));
      setBearbeiteId((b) => (b === id ? null : b));
    } catch { toast("Löschen fehlgeschlagen.", "error"); }
  }

  function uebernehmen(k: Kalkulation) {
    const a = auswahlAus(k, new Date().toISOString().slice(0, 10));
    try { localStorage.setItem(KAUF_AUSWAHL_KEY, JSON.stringify(a)); } catch { /* ignore */ }
    setGewaehltId(k.id);
    toast(`„${k.name}“ für die Finanzierung gewählt — weiter mit der Besichtigung oder in Schritt 3.`);
  }

  // Nach dem Mount: gewähltes Objekt aus dem Browser lesen und ggf. die Kaufprüfung öffnen, für die
  // die Besichtigung lief (Sanierungs-Guide → „in den Vergleich“). Nur einmal.
  useEffect(() => {
    try {
      const roh = localStorage.getItem(KAUF_AUSWAHL_KEY);
      const a = roh ? (JSON.parse(roh) as KaufAuswahl) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesen (Hydration)
      if (a?.kalkId) setGewaehltId(a.kalkId);
    } catch { /* ignore */ }
    const start = startObjektId ? liste.find((k) => k.id === startObjektId) : null;
    if (start) bearbeiten(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const F = (label: string, value: string, set: (v: string) => void, ph?: string, mode: "decimal" | "text" | "numeric" = "decimal") => (
    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} placeholder={ph} inputMode={mode === "text" ? undefined : mode}
        style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--feld-rand)", background: "var(--bg2)", fontSize: 14, width: "100%", minWidth: 0, boxSizing: "border-box" }} />
    </label>
  );

  return (
    // minmax(0, 1fr): Seit der Rechner auf der Seite steht (nicht mehr im Fenster), darf keine Mindestbreite
    // eines Felds die Spalte über den Handy-Bildschirm drücken — sonst schneidet die Seite rechts ab.
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: bearbeiteId ? "var(--gold)" : "var(--faint)" }}>
          {bearbeiteId ? `Du bearbeitest „${liste.find((k) => k.id === bearbeiteId)?.name ?? "Objekt"}"` : "Neues Objekt"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {bearbeiteId && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={neuesObjekt}>
              <Plus size={14} /> Neues Objekt
            </button>
          )}
          <a href="#vergleich" className="btn btn-ghost" style={{ fontSize: 12.5 }}>
            <Scale size={14} /> Zum Vergleich ({liste.length})
          </a>
          <button type="button" className="btn btn-gold" style={{ fontSize: 12.5 }} onClick={speichern} disabled={saving}>
            <Save size={14} /> {saving ? "Speichert…" : bearbeiteId ? "Änderungen speichern" : "Im Ordner speichern"}
          </button>
        </div>
      </div>

      {/* KI-Import: Exposé-Link oder -Text → Felder werden vorbefüllt */}
      <KalkImport
        beobachten={[kaufpreis, flaeche, kaltmiete, adresse]}
        onResult={(d) => {
          if (d.kaufpreis != null) setKaufpreis(String(d.kaufpreis));
          if (d.flaeche != null) setFlaeche(String(d.flaeche));
          if (d.adresse) setAdresse(d.adresse);
          else if (d.name) setAdresse(d.name);
          if (d.miete != null && d.miete > 0) {
            setKaltmiete(String(d.miete));
            setNutzung("vermietung");
          }
        }}
      />

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Eingaben */}
        <div style={{ flex: "1 1 340px", display: "grid", gap: 16, minWidth: 280 }}>
          {/* Kernwerte — immer sichtbar; reichen für die vollständige Grundrechnung */}
          <div style={{ display: "grid", gap: 11 }}>
            {F("Adresse / Bezeichnung", adresse, setAdresse, "Musterstr. 1, Musterstadt", "text")}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 11 }}>
              {F("Kaufpreis (€)", kaufpreis, setKaufpreis, "250000")}
              {F("Wohnfläche (m²)", flaeche, setFlaeche, "75")}
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Bundesland (Grunderwerbst.)</span>
              <select value={bundesland} onChange={(e) => setBundesland(e.target.value)}
                style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--feld-rand)", background: "var(--bg2)", fontSize: 13, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                {BUNDESLAENDER.map((b, i) => <option key={i} value={b.v}>{b.l}</option>)}
              </select>
            </label>
            {/* Provisionsfrei-Schnellschalter: bei ImmoScout häufig. Setzt die Maklercourtage
                auf 0 (bzw. zurück auf den Default 3,57 %), damit die Nebenkosten nicht still
                zu hoch gerechnet werden. Feineinstellung weiter unten im Aufklapp-Menü. */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={num(makler) === 0}
                onChange={(e) => { setMakler(e.target.checked ? "0" : MAKLER_STANDARD); setMaklerBeruehrt(true); }}
                style={{ width: 15, height: 15, accentColor: "var(--gold)", cursor: "pointer" }}
              />
              Provisionsfrei (keine Maklercourtage)
            </label>
            {/* Sanierung (BuyImmo, 05.10.2026) — fließt in die Gesamtinvestition. */}
            <div style={{ display: "grid", gap: 4 }}>
              {F("Sanierung / Renovierung (€)", sanierung, setSanierung, "0")}
              {/* Neuer Tab: Die Maske hier ist nicht gespeichert — ein Seitenwechsel verlöre alle Eingaben.
                  Für einen gespeicherten Kandidaten führt „Besichtigen“ im Vergleich unten direkt hin. */}
              <a href="/sanierung" target="_blank" rel="noopener" style={{ fontSize: 11.5, color: "var(--gold)", textDecoration: "none" }}>
                Mit dem Sanierungs-Guide ermitteln (neuer Tab) →
              </a>
            </div>
            {/* Objekttyp: Haus schaltet den Substanzwert-Block (Bodenwert + Gebäude) frei. */}
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--line)" }}>
              {([["wohnung", "Wohnung", Building2], ["haus", "Haus", Home]] as const).map(([id, label, Icon]) => {
                const aktiv = objektTyp === id;
                return (
                  <button key={id} type="button" onClick={() => setObjektTyp(id)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer",
                      padding: "7px 10px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
                      background: aktiv ? "var(--gold-fill)" : "transparent", color: aktiv ? "var(--btn-gold-text)" : "var(--muted)",
                      transition: "background .2s, color .2s",
                    }}>
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nutzungs-Umschalter */}
          <div>
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--line)" }}>
              {([["vermietung", "Vermieten", Building2], ["eigennutzung", "Eigennutzung", Home]] as const).map(([id, label, Icon]) => {
                const aktiv = nutzung === id;
                return (
                  <button key={id} type="button" onClick={() => setNutzung(id)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer",
                      padding: "9px 10px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 600,
                      background: aktiv ? "var(--gold-fill)" : "transparent", color: aktiv ? "var(--btn-gold-text)" : "var(--muted)",
                      transition: "background .2s, color .2s",
                    }}>
                    <Icon size={15} /> {label}
                  </button>
                );
              })}
            </div>

            {vermietung ? (
              <div style={{ marginTop: 12 }}>
                {F("Kaltmiete (€/Monat)", kaltmiete, setKaltmiete, "900")}
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {F("Laufende Kosten / Hausgeld (€/Monat)", hausgeld, setHausgeld, "250")}
                <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 8 }}>
                  Bei Eigennutzung entfällt die Mietrendite — verglichen wird nach Preis/m² und Gesamtkosten.
                </p>
              </div>
            )}
          </div>

          {/* Optional: Ergebnis verfeinern — bleibt gemountet (nur per <details> versteckt),
              Werte bleiben also beim Zuklappen erhalten. Reine UI-Gruppierung: keine neue
              Rechenlogik. Defaults (Makler 3,57 %, Bewirtschaftung 20 %) sind gesetzt, damit
              die Grundrechnung auch ohne Aufklappen stimmt. */}
          <details style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg3)" }}>
            <summary style={{ cursor: "pointer", userSelect: "none", padding: "11px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
              Optional: Ergebnis verfeinern
              <span style={{ fontWeight: 400, color: "var(--faint)" }}> — Makler & Bewirtschaftung (Defaults sind gesetzt)</span>
            </summary>
            <div style={{ padding: "2px 14px 14px", display: "grid", gap: 11 }}>
              {F("Maklercourtage (%) · provisionsfrei = 0", makler, (v) => { setMakler(v); setMaklerBeruehrt(true); }, MAKLER_STANDARD)}
              {vermietung && F("Bewirtschaftung (% der Miete)", bewirt, setBewirt, "20")}
              <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                Lässt du das zu, rechnet MyImmo mit konservativen Defaults weiter — Bewirtschaftung
                (20 %) schmälert die Nettorendite realistisch. Ohne Aufklappen bleibt die Grundrechnung korrekt.
              </p>
            </div>
          </details>

          {/* Marktwert-Einschätzung — Verfahren richtet sich nach der Nutzung.
              Ersetzt den früheren, nur für Häuser sichtbaren Substanzwert-Block
              und den separaten Schritt „Objekt bewerten". */}
          {true && (
            <details style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg3)" }}>
              <summary style={{ cursor: "pointer", userSelect: "none", padding: "11px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 }}>
                <Landmark size={14} color="var(--gold)" /> Marktwert-Einschätzung — {mw.verfahrenLabel}
                <span style={{ fontWeight: 400, color: "var(--faint)" }}> — überschlägig, kein Gutachten</span>
              </summary>
              <div style={{ padding: "2px 14px 14px", display: "grid", gap: 11 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 11 }}>
                  {F("Grundstücksfläche (m²)", grundFlaeche, setGrundFlaeche, "500")}
                  {F("Bodenrichtwert (€/m², BORIS)", bodenrichtwert, setBodenrichtwert, "300")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 11 }}>
                  {F("Baujahr", baujahr, setBaujahr, "1998")}
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)" }}>Gebäudetyp</span>
                    <select value={gebTyp} onChange={(e) => setGebTyp(e.target.value)}
                      style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--feld-rand)", background: "var(--bg2)", fontSize: 13, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      {NHK_TYPEN.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </label>
                </div>
                {nutzung === "eigennutzung" && (
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)" }}>Ausstattung / Standard: {ausstattung} von 5</span>
                    <input type="range" min={1} max={5} step={1} value={ausstattung}
                      onChange={(e) => setAusstattung(e.target.value)} style={{ accentColor: "var(--gold)" }} />
                  </label>
                )}
                {nutzung === "vermietung" && (
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 11 }}>
                    {F("Liegenschaftszins (% p. a.)", lz, setLz, "3.5")}
                    {F("Anzahl Wohneinheiten", anzahlWhg, setAnzahlWhg, "1", "numeric")}
                  </div>
                )}
                {nutzung === "eigennutzung" && (
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 11 }}>
                    {F("Sachwertfaktor", swFaktor, setSwFaktor, "1.0")}
                    {F("Baupreisindex", bpiFaktor, setBpiFaktor, "1.9")}
                  </div>
                )}

                {/* Ergebnis: Bodenwert + Gebäudesachwert + vorläufiger Sachwert */}
                {mw.bereit && mw.ergebnis ? (
                  <div style={{ display: "grid", gap: 6, padding: "11px 13px", borderRadius: 10, background: "var(--bg2)", border: "1px solid var(--gold-dim, var(--line))" }}>
                    {Object.entries(mw.ergebnis.details).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--muted)" }}>{k}</span>
                        <strong style={{ color: "var(--text)" }}>{v.toLocaleString("de-DE")}</strong>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>Geschätzter Marktwert</span>
                      <strong style={{ color: "var(--gold)" }}>{eur(mw.ergebnis.wert)}</strong>
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
                      Spanne {eur(mw.ergebnis.min)} – {eur(mw.ergebnis.max)} · Restnutzungsdauer {mw.restnutzungsdauer} J.
                    </div>
                    {mwUrteil && (
                      <div style={{ fontSize: 11.5, color: mwUrteil.farbe, fontWeight: mwUrteil.vorlaeufig ? 400 : 500 }}>
                        Kaufpreis {mwUrteil.text}
                      </div>
                    )}
                    {mw.ergebnis.warnungen.map((h, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--amber)" }}>⚠ {h}</div>
                    ))}
                    {mw.unsicher.map((h) => (
                      <div key={h} style={{ fontSize: 10.5, color: "var(--amber)" }}>⚠ Fehlt: {h}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: "var(--faint)", padding: "9px 12px", borderRadius: 9, background: "var(--bg2)", border: "1px dashed var(--line2)" }}>
                    Für die Marktwert-Einschätzung fehlt noch: <strong>{mw.fehlend.join(", ")}</strong>.
                    {" "}Den Bodenrichtwert findest du amtlich bei <span style={{ color: "var(--muted)" }}>bodenrichtwerte-boris.de</span>.
                  </div>
                )}
                <p style={{ fontSize: 10, color: "var(--faint)", margin: 0 }}>{HAUS_DISCLAIMER}</p>
              </div>
            </details>
          )}
        </div>

        {/* Ergebnis-Kacheln */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <BelastbarkeitsRing prozent={bel.prozent} stufe={bel.stufe} offen={bel.offen} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {tiles.map((t) => {
              const leer = !t.wert;
              return (
                <div key={t.label} className={leer ? "" : "tile-reveal tile-hover"}
                  style={{ padding: "14px 15px", borderRadius: 14,
                    background: leer ? "var(--bg3)" : "var(--bg2)",
                    border: `1px solid ${leer ? "var(--line)" : (t.gold ? "var(--gold-dim, var(--line))" : "var(--line)")}`,
                    opacity: leer ? 0.72 : 1 }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.label}</div>
                  {leer ? (
                    <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>+</span> {t.braucht ?? "noch offen"}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 3, color: t.farbe ?? (t.gold ? "var(--gold)" : "var(--text)") }}>{t.wert}</div>
                      {t.note && <div style={{ fontSize: 10.5, color: t.farbe ?? "var(--faint)", marginTop: 3 }}>{t.note}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {/* 15-%-Grenze vor dem Kauf (§ 6 Abs. 1 Nr. 1a EStG) — dieselbe Basis wie der Steuer-Wächter. */}
          {fuenfzehn && (
            <p style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0, color: fuenfzehn.ueber ? "var(--amber)" : "var(--faint)" }}>
              {fuenfzehn.ueber
                ? `Die Sanierung liegt über 15 % des Gebäudeanteils (Grenze ${eur(fuenfzehn.grenze)} bei 80 % Gebäudeanteil). Fällt sie in die ersten drei Jahre nach dem Kauf, ist sie steuerlich nur über die AfA absetzbar, nicht sofort (§ 6 Abs. 1 Nr. 1a EStG, Grenze netto). Mit dem Steuerberater klären.`
                : `Unter der 15-%-Grenze für die ersten drei Jahre nach dem Kauf (${eur(fuenfzehn.grenze)} bei 80 % Gebäudeanteil, § 6 Abs. 1 Nr. 1a EStG).`}
            </p>
          )}
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>
            Speichere jedes Objekt und vergleiche bis zu fünf Kandidaten — die Krone zählt nur Bestwerte. Die Finanzierung
            rechnest du im Schritt „Finanzierung&quot; aus.
          </p>
        </div>
      </div>

      <ObjektVergleich
        liste={liste}
        auswahl={compareIds}
        setAuswahl={setCompareIds}
        bearbeiteId={bearbeiteId}
        gewaehltId={gewaehltId}
        onBearbeiten={bearbeiten}
        onLoeschen={loeschen}
        onWaehlen={uebernehmen}
      />
    </div>
  );
}
