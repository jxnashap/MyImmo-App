"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Home, Building2, Save, Scale, Crown, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/components/Toast";
import { saveKalkulation, deleteKalkulation } from "@/lib/actions/kalkulation";
import { bestesObjekt, KAUF_AUSWAHL_KEY, type KaufAuswahl, type VglMetrik } from "@/lib/kauf/auswahl";
import { BUNDESLAENDER } from "@/lib/kalk";
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

type Tile = { label: string; wert: string; gold?: boolean; farbe?: string; note?: string };

export default function ObjektRechner({ gespeichert = [] }: { gespeichert?: Kalkulation[] }) {
  const toast = useToast();
  const [liste, setListe] = useState<Kalkulation[]>(gespeichert);

  // Grundwerte
  const [adresse, setAdresse] = useState("");
  const [kaufpreis, setKaufpreis] = useState("");
  const [flaeche, setFlaeche] = useState("");
  const [bundesland, setBundesland] = useState("0.05");
  const [makler, setMakler] = useState("3.57");
  // Nutzung
  const [nutzung, setNutzung] = useState<"vermietung" | "eigennutzung">("vermietung");
  const [kaltmiete, setKaltmiete] = useState("");
  const [bewirt, setBewirt] = useState("20"); // % der Miete (Rundwert)
  const [hausgeld, setHausgeld] = useState(""); // €/Mo (Eigennutzung: laufende Kosten)

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

  const tiles: Tile[] = vermietung
    ? [
        { label: "Gesamtinvestition", wert: kp > 0 ? eur(gesamtInvest) : "–", gold: true, note: `inkl. ${eur(nebenkosten)} Nebenkosten` },
        { label: "Preis / m²", wert: preisM2 > 0 ? eur(preisM2) : "–" },
        { label: "Bruttorendite", wert: brutto > 0 ? pct(brutto) : "–", farbe: urteil?.farbe, note: urteil?.text },
        { label: "Nettorendite", wert: nettomiet > 0 ? pct(nettomiet) : "–", note: `nach ${num(bewirt)} % Bewirtschaftung` },
        { label: "Kaufpreisfaktor", wert: faktor > 0 ? fmt1(faktor) + "×" : "–", note: "Jahresmieten bis zur Amortisation" },
      ]
    : [
        { label: "Gesamtinvestition", wert: kp > 0 ? eur(gesamtInvest) : "–", gold: true, note: `inkl. ${eur(nebenkosten)} Nebenkosten` },
        { label: "Preis / m²", wert: preisM2 > 0 ? eur(preisM2) : "–" },
        { label: "Laufende Kosten", wert: num(hausgeld) > 0 ? eur(num(hausgeld)) + "/Mo" : "–", note: "Hausgeld / Bewirtschaftung" },
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

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Eingaben */}
        <div style={{ flex: "1 1 340px", display: "grid", gap: 16, minWidth: 280 }}>
          <div style={{ display: "grid", gap: 11 }}>
            {F("Adresse / Bezeichnung", adresse, setAdresse, "Musterstr. 1, Musterstadt", "text")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              {F("Kaufpreis (€)", kaufpreis, setKaufpreis, "250000")}
              {F("Wohnfläche (m²)", flaeche, setFlaeche, "75")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>Bundesland (Grunderwerbst.)</span>
                <select value={bundesland} onChange={(e) => setBundesland(e.target.value)}
                  style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--bg2)", fontSize: 13 }}>
                  {BUNDESLAENDER.map((b, i) => <option key={i} value={b.v}>{b.l}</option>)}
                </select>
              </label>
              {F("Makler (%)", makler, setMakler, "3.57")}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginTop: 12 }}>
                {F("Kaltmiete (€/Monat)", kaltmiete, setKaltmiete, "900")}
                {F("Bewirtschaftung (% der Miete)", bewirt, setBewirt, "20")}
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
        </div>

        {/* Ergebnis-Kacheln */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {tiles.map((t) => (
              <div key={t.label} style={{ padding: "14px 15px", borderRadius: 14, background: "var(--bg2)", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 3, color: t.farbe ?? (t.gold ? "var(--gold)" : "var(--text)") }}>{t.wert}</div>
                {t.note && <div style={{ fontSize: 10.5, color: t.farbe ?? "var(--faint)", marginTop: 3 }}>{t.note}</div>}
              </div>
            ))}
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
