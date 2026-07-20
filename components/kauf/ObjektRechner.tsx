"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Home, Building2, Save, Scale, Crown, Trash2, ArrowRight, Landmark, Check } from "lucide-react";
import { useToast } from "@/components/Toast";
import KalkImport from "@/components/kalkulator/KalkImport";
import { saveKalkulation, deleteKalkulation } from "@/lib/actions/kalkulation";
import { bestesObjekt, KAUF_AUSWAHL_KEY, type KaufAuswahl, type VglMetrik } from "@/lib/kauf/auswahl";
import { BUNDESLAENDER } from "@/lib/kalk";
import { hausSachwert, HAUS_DISCLAIMER } from "@/lib/kauf/hausbewertung";
import { belastbarkeit } from "@/lib/kauf/belastbarkeit";
import { NHK_TYPEN } from "@/lib/bewertung/immowertv";
import { useCountUp } from "@/lib/hooks/useCountUp";
import type { Kalkulation } from "@/lib/types";

const eur = (n: number) => "€ " + Math.round(n || 0).toLocaleString("de-DE");
const pct = (n: number, d = 1) => (n || 0).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
const fmt1 = (n: number) => (n || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });
const num = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;

// Vergleichs-Kennzahlen (ohne Finanzierung — die kommt erst in Schritt 4).
const CMP: { key: string; label: string; fmt: (v: number) => string; better: "high" | "low" | "none" }[] = [
  { key: "kp", label: "Kaufpreis", fmt: eur, better: "low" },
  { key: "preisM2", label: "Preis / m²", fmt: (v) => (v > 0 ? eur(v) + "/m²" : "–"), better: "low" },
  { key: "brutto", label: "Bruttorendite", fmt: (v) => (v > 0 ? pct(v) : "–"), better: "high" },
  { key: "nettomiet", label: "Nettorendite", fmt: (v) => (v > 0 ? pct(v) : "–"), better: "high" },
  { key: "faktor", label: "Kaufpreisfaktor", fmt: (v) => (v > 0 ? fmt1(v) + "×" : "–"), better: "low" },
];
const CMP_METRIK: VglMetrik[] = CMP.map((m) => ({ key: m.key, better: m.better }));

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

export default function ObjektRechner({ gespeichert = [] }: { gespeichert?: Kalkulation[] }) {
  const toast = useToast();
  const [liste, setListe] = useState<Kalkulation[]>(gespeichert);

  // Grundwerte
  const [adresse, setAdresse] = useState("");
  const [kaufpreis, setKaufpreis] = useState("");
  const [flaeche, setFlaeche] = useState("");
  const [bundesland, setBundesland] = useState("0.05");
  const [makler, setMakler] = useState("3.57");
  const [maklerBeruehrt, setMaklerBeruehrt] = useState(false); // für Belastbarkeits-Score
  // Nutzung
  const [nutzung, setNutzung] = useState<"vermietung" | "eigennutzung">("vermietung");
  const [kaltmiete, setKaltmiete] = useState("");
  const [bewirt, setBewirt] = useState("20"); // % der Miete (Rundwert)
  const [hausgeld, setHausgeld] = useState(""); // €/Mo (Eigennutzung: laufende Kosten)

  // Objekttyp + Haus-Substanzwert (Sachwert, ausklappbar). Reine Plausibilisierung
  // neben der Rendite; nutzt die ImmoWertV-Engine (lib/kauf/hausbewertung.ts).
  const [objektTyp, setObjektTyp] = useState<"wohnung" | "haus">("wohnung");
  const [grundFlaeche, setGrundFlaeche] = useState("");
  const [bodenrichtwert, setBodenrichtwert] = useState("");
  const [baujahr, setBaujahr] = useState("");
  const [gebTyp, setGebTyp] = useState("efh");
  const [ausstattung, setAusstattung] = useState("3");
  const [bpiFaktor, setBpiFaktor] = useState("1.9");
  const [regionalFaktor, setRegionalFaktor] = useState("1.0");

  // Speichern / Vergleich
  const [saving, setSaving] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const kp = num(kaufpreis), fl = num(flaeche);
  const nkSatz = num(bundesland) + num(makler) / 100 + 0.02; // + Notar/Grundbuch ~2 %
  const nebenkosten = kp * nkSatz;
  const gesamtInvest = kp + nebenkosten;
  const preisM2 = kp > 0 && fl > 0 ? kp / fl : 0;

  const vermietung = nutzung === "vermietung";
  const jahresmiete = vermietung ? num(kaltmiete) * 12 : 0;
  const brutto = vermietung && kp > 0 && jahresmiete > 0 ? (jahresmiete / kp) * 100 : 0;
  const faktor = vermietung && jahresmiete > 0 ? kp / jahresmiete : 0;
  const bewirtJahr = jahresmiete * (num(bewirt) / 100);
  const nettomiet = vermietung && gesamtInvest > 0 && jahresmiete > 0 ? ((jahresmiete - bewirtJahr) / gesamtInvest) * 100 : 0;

  const urteil = vermietung && brutto > 0 ? renditeUrteil(brutto) : null;

  const haus = objektTyp === "haus"
    ? hausSachwert({
        wohnflaeche: fl, grundFlaeche: num(grundFlaeche), bodenrichtwert: num(bodenrichtwert),
        baujahr: Math.round(num(baujahr)), gebTyp, ausstattung: Math.round(num(ausstattung)),
        bpiFaktor: num(bpiFaktor) || 1.9, regionalFaktor: num(regionalFaktor) || 1,
      })
    : null;

  const bel = belastbarkeit({
    nutzung, kp, fl, kaltmiete: num(kaltmiete), hausgeld: num(hausgeld),
    adresseGesetzt: adresse.trim().length > 0,
    maklerEntschieden: maklerBeruehrt,
    bewirtGesetzt: bewirt.trim() !== "",
  });

  const tiles: Tile[] = vermietung
    ? [
        { label: "Gesamtinvestition", wert: kp > 0 ? eur(gesamtInvest) : "", gold: true, note: `inkl. ${eur(nebenkosten)} Nebenkosten`, braucht: "Kaufpreis eintragen" },
        { label: "Preis / m²", wert: preisM2 > 0 ? eur(preisM2) : "", braucht: "Kaufpreis + Wohnfläche" },
        { label: "Bruttorendite", wert: brutto > 0 ? pct(brutto) : "", farbe: urteil?.farbe, note: urteil?.text, braucht: "Kaltmiete eintragen" },
        { label: "Nettorendite", wert: nettomiet > 0 ? pct(nettomiet) : "", note: `nach ${num(bewirt)} % Bewirtschaftung`, braucht: "Kaltmiete eintragen" },
        { label: "Kaufpreisfaktor", wert: faktor > 0 ? fmt1(faktor) + "×" : "", note: "Jahresmieten bis zur Amortisation", braucht: "Kaufpreis + Kaltmiete" },
      ]
    : [
        { label: "Gesamtinvestition", wert: kp > 0 ? eur(gesamtInvest) : "", gold: true, note: `inkl. ${eur(nebenkosten)} Nebenkosten`, braucht: "Kaufpreis eintragen" },
        { label: "Preis / m²", wert: preisM2 > 0 ? eur(preisM2) : "", braucht: "Kaufpreis + Wohnfläche" },
        { label: "Laufende Kosten", wert: num(hausgeld) > 0 ? eur(num(hausgeld)) + "/Mo" : "", note: "Hausgeld / Bewirtschaftung", braucht: "Laufende Kosten eintragen" },
      ];

  function eingabenSnapshot(): Record<string, string> {
    return { adresse, kaufpreis, flaeche, bundesland, makler, nutzung, kaltmiete, bewirt, hausgeld };
  }
  function summarySnapshot(): Record<string, number> {
    return { kp, gesamtInvest, preisM2, brutto, nettomiet, faktor, kaltmiete: num(kaltmiete), nutzung: vermietung ? 1 : 0 };
  }

  async function speichern() {
    if (kp <= 0) { toast("Bitte zuerst einen Kaufpreis eingeben."); return; }
    setSaving(true);
    try {
      const neu = await saveKalkulation(adresse || "Objekt", eingabenSnapshot(), summarySnapshot());
      setListe((p) => [neu, ...p]);
      toast("Objekt gespeichert. Du kannst jetzt weitere Objekte rechnen und vergleichen.");
    } catch {
      toast("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function loeschen(id: string) {
    try {
      await deleteKalkulation(id);
      setListe((p) => p.filter((k) => k.id !== id));
      setCompareIds((c) => c.filter((x) => x !== id));
    } catch { toast("Löschen fehlgeschlagen."); }
  }

  function toggleCompare(id: string) {
    setCompareIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 5 ? c : [...c, id]));
  }

  const cmpSel = compareIds.map((id) => liste.find((k) => k.id === id)).filter(Boolean) as Kalkulation[];
  const vergleich = bestesObjekt(cmpSel.map((k) => ({ id: k.id, summary: k.summary })), CMP_METRIK);

  function bestWert(key: string, better: "high" | "low" | "none"): number | null {
    if (better === "none" || cmpSel.length < 2) return null;
    const vals = cmpSel.map((k) => k.summary?.[key]).filter((v): v is number => typeof v === "number" && v > 0);
    if (vals.length < 2) return null;
    const best = better === "high" ? Math.max(...vals) : Math.min(...vals);
    return vals.every((v) => v === best) ? null : best;
  }

  function uebernehmen(k: Kalkulation) {
    const s = k.summary ?? {};
    const a: KaufAuswahl = {
      kalkId: k.id, name: k.name, adresse: k.data?.adresse ?? "",
      kp: s.kp ?? 0, gesamtInvest: s.gesamtInvest ?? 0, eigenkapital: 0,
      darlehen: 0, rate: 0, kaltmiete: s.kaltmiete ?? 0, cfNetto: 0,
      // summarySnapshot: nutzung = vermietung ? 1 : 0
      nutzung: s.nutzung === 1 ? "vermieten" : "eigennutzen",
      gewaehltAm: new Date().toISOString().slice(0, 10),
    };
    try { localStorage.setItem(KAUF_AUSWAHL_KEY, JSON.stringify(a)); } catch { /* ignore */ }
    toast(`„${k.name}“ für die Finanzierung übernommen.`);
    setShowCompare(false);
  }

  const F = (label: string, value: string, set: (v: string) => void, ph?: string, mode: "decimal" | "text" | "numeric" = "decimal") => (
    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} placeholder={ph} inputMode={mode === "text" ? undefined : mode}
        style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 14 }} />
    </label>
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { setCompareIds([]); setShowCompare(true); }}>
          <Scale size={14} /> Vergleich ({liste.length})
        </button>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12.5 }} onClick={speichern} disabled={saving}>
          <Save size={14} /> {saving ? "Speichert…" : "Objekt speichern"}
        </button>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              {F("Kaufpreis (€)", kaufpreis, setKaufpreis, "250000")}
              {F("Wohnfläche (m²)", flaeche, setFlaeche, "75")}
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Bundesland (Grunderwerbst.)</span>
              <select value={bundesland} onChange={(e) => setBundesland(e.target.value)}
                style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13 }}>
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
                onChange={(e) => { setMakler(e.target.checked ? "0" : "3.57"); setMaklerBeruehrt(true); }}
                style={{ width: 15, height: 15, accentColor: "var(--gold)", cursor: "pointer" }}
              />
              Provisionsfrei (keine Maklercourtage)
            </label>
            {/* Objekttyp: Haus schaltet den Substanzwert-Block (Bodenwert + Gebäude) frei. */}
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg3)", border: "1px solid var(--line)" }}>
              {([["wohnung", "Wohnung", Building2], ["haus", "Haus", Home]] as const).map(([id, label, Icon]) => {
                const aktiv = objektTyp === id;
                return (
                  <button key={id} type="button" onClick={() => setObjektTyp(id)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer",
                      padding: "7px 10px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
                      background: aktiv ? "var(--gold)" : "transparent", color: aktiv ? "#1a1814" : "var(--muted)",
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
                      background: aktiv ? "var(--gold)" : "transparent", color: aktiv ? "#1a1814" : "var(--muted)",
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
              {F("Maklercourtage (%) · provisionsfrei = 0", makler, (v) => { setMakler(v); setMaklerBeruehrt(true); }, "3.57")}
              {vermietung && F("Bewirtschaftung (% der Miete)", bewirt, setBewirt, "20")}
              <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                Lässt du das zu, rechnet MyImmo mit konservativen Defaults weiter — Bewirtschaftung
                (20 %) schmälert die Nettorendite realistisch. Ohne Aufklappen bleibt die Grundrechnung korrekt.
              </p>
            </div>
          </details>

          {/* Haus-Substanzwert (Bodenwert + Gebäudesachwert) — nur bei Objekttyp Haus. */}
          {objektTyp === "haus" && haus && (
            <details style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg3)" }}>
              <summary style={{ cursor: "pointer", userSelect: "none", padding: "11px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 }}>
                <Landmark size={14} color="var(--gold)" /> Haus-Substanzwert (Bodenwert + Gebäude)
                <span style={{ fontWeight: 400, color: "var(--faint)" }}> — überschlägig, kein Gutachten</span>
              </summary>
              <div style={{ padding: "2px 14px 14px", display: "grid", gap: 11 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                  {F("Grundstücksfläche (m²)", grundFlaeche, setGrundFlaeche, "500")}
                  {F("Bodenrichtwert (€/m², BORIS)", bodenrichtwert, setBodenrichtwert, "300")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                  {F("Baujahr", baujahr, setBaujahr, "1998")}
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)" }}>Gebäudetyp</span>
                    <select value={gebTyp} onChange={(e) => setGebTyp(e.target.value)}
                      style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13 }}>
                      {NHK_TYPEN.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </label>
                </div>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--muted)" }}>Ausstattung / Standard: {ausstattung} von 5</span>
                  <input type="range" min={1} max={5} step={1} value={ausstattung}
                    onChange={(e) => setAusstattung(e.target.value)} style={{ accentColor: "var(--gold)" }} />
                </label>

                {/* Ergebnis: Bodenwert + Gebäudesachwert + vorläufiger Sachwert */}
                {haus.bereit ? (
                  <div style={{ display: "grid", gap: 6, padding: "11px 13px", borderRadius: 10, background: "var(--bg2)", border: "1px solid var(--gold-dim, var(--line))" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>Bodenwert ({eur(num(bodenrichtwert))}/m² × {num(grundFlaeche).toLocaleString("de-DE")} m²)</span>
                      <strong style={{ color: "var(--text)" }}>{eur(haus.bodenwert)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>Gebäudesachwert (RND {haus.restnutzungsdauer} J.)</span>
                      <strong style={{ color: "var(--text)" }}>{eur(haus.gebaeudesachwert)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>Vorläufiger Sachwert</span>
                      <strong style={{ color: "var(--gold)" }}>{eur(haus.vorlaeufigerSachwert)}</strong>
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Spanne {eur(haus.spanneMin)} – {eur(haus.spanneMax)}</div>
                    {haus.hinweise.map((h, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: "var(--amber)" }}>⚠ {h}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: "var(--faint)", padding: "9px 12px", borderRadius: 9, background: "var(--bg2)", border: "1px dashed var(--line2)" }}>
                    Für den Substanzwert brauchst du <strong>Wohnfläche</strong> (oben) und den <strong>Bodenrichtwert</strong>
                    {" "}(amtlich bei <span style={{ color: "var(--muted)" }}>bodenrichtwerte-boris.de</span>).
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
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>
            Speichere jedes Objekt und vergleiche 3–5 Kandidaten — das beste bekommt eine Krone. Die Finanzierung
            rechnest du im Schritt „Finanzierung" aus.
          </p>
        </div>
      </div>

      {/* Vergleich-Modal */}
      {showCompare && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setShowCompare(false)}>
          <div className="modal-sheet wide" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 6 }}>Objekte vergleichen</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              Bis zu 5 gespeicherte Objekte wählen. Das Objekt mit den meisten besten Kennzahlen bekommt die Krone —
              übernimm es für die Finanzierung.
            </p>
            {liste.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Noch nichts gespeichert. Objekt eingeben und „Objekt speichern".</p>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {liste.map((k) => {
                    const sel = compareIds.includes(k.id);
                    const disabled = !sel && compareIds.length >= 5;
                    return (
                      <span key={k.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <button onClick={() => toggleCompare(k.id)} disabled={disabled}
                          style={{ padding: "6px 10px", borderRadius: 8, cursor: disabled ? "default" : "pointer", fontSize: 12.5,
                            border: `1px solid ${sel ? "var(--gold)" : "var(--line2)"}`, background: sel ? "var(--gold-pale, rgba(212,175,90,0.12))" : "var(--bg3)",
                            color: sel ? "var(--gold)" : "var(--muted)", opacity: disabled ? 0.4 : 1 }}>
                          {sel ? "✓ " : ""}{k.name}
                        </button>
                        <button onClick={() => loeschen(k.id)} title="Löschen" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--faint)", padding: 2 }}>
                          <Trash2 size={13} />
                        </button>
                      </span>
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
                        {CMP.map((m) => {
                          const best = bestWert(m.key, m.better);
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
                                <button type="button" className={`btn ${sieger ? "btn-gold" : "btn-ghost"}`} style={{ fontSize: 11.5 }} onClick={() => uebernehmen(k)}>
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
    </div>
  );
}
