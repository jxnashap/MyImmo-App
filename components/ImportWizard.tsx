"use client";
import { Bot, ClipboardList, Hourglass, TriangleAlert, CheckCircle2, StickyNote } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";

import { useState } from "react";

const TYPEN = ["Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Ferienimmobilie", "Grundstück"];
const STATUS = ["Vermietet", "Selbst bewohnt", "Leer", "Feriennutzung"];

type Values = {
  bezeichnung: string; typ: string; adresse: string; kaufpreis: string; wert: string;
  flaeche: string; zimmer: string; baujahr: string; miete: string; energieklasse: string; obj_status: string;
};
const LEER: Values = { bezeichnung: "", typ: "Eigentumswohnung", adresse: "", kaufpreis: "", wert: "", flaeche: "", zimmer: "", baujahr: "", miete: "", energieklasse: "", obj_status: "Vermietet" };

export default function ImportWizard({ action }: { action: (fd: FormData) => void }) {
  const [tab, setTab] = useState<"ki" | "manual">("ki");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [konfidenz, setKonfidenz] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  const [v, setV] = useState<Values>(LEER);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function auslesen() {
    setError(null); setKonfidenz(null); setLoading(true);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Fehler beim Analysieren."); return; }
      const p = json.data ?? {};
      const str = (x: unknown) => (x == null ? "" : String(x));
      setV({
        bezeichnung: str(p.name), typ: TYPEN.includes(p.typ) ? p.typ : "Eigentumswohnung",
        adresse: str(p.adresse), kaufpreis: str(p.kaufpreis), wert: str(p.wert ?? p.kaufpreis),
        flaeche: str(p.flaeche), zimmer: str(p.zimmer), baujahr: str(p.baujahr), miete: str(p.miete),
        energieklasse: str(p.energieklasse), obj_status: STATUS.includes(p.status) ? p.status : "Vermietet",
      });
      setNotiz(str(p.notiz));
      setKonfidenz(typeof p.konfidenz === "number" ? p.konfidenz : null);
    } catch (e) {
      setError(`Netzwerkfehler: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  const konfColor = konfidenz == null ? "" : konfidenz >= 80 ? "var(--green)" : konfidenz >= 50 ? "var(--amber)" : "var(--red)";

  return (
    <div className="form-box" style={{ maxWidth: 680 }}>
      <h3>Immobilien-Anzeige importieren</h3>
      <p>Kopiere den Anzeigentext von ImmoScout24, Immowelt o.ä. — die KI liest die Daten aus. Oder fülle das Schnellformular manuell aus.</p>
      <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>KI-Auswertung (Anthropic Claude): Der Text wird zur Auswertung an die API übermittelt (kein Modell-Training). Ergebnisse bitte vor dem Speichern prüfen.</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--line)" }}>
        <button type="button" onClick={() => setTab("ki")} style={{ padding: "8px 16px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === "ki" ? "var(--gold)" : "transparent"}`, color: tab === "ki" ? "var(--gold)" : "var(--muted)", fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: -1 }}><Bot size={14} style={{ verticalAlign: "-2px" }} /> KI-Import</button>
        <button type="button" onClick={() => setTab("manual")} style={{ padding: "8px 16px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === "manual" ? "var(--gold)" : "transparent"}`, color: tab === "manual" ? "var(--gold)" : "var(--muted)", fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: -1 }}><ClipboardList size={14} style={{ verticalAlign: "-2px" }} /> Schnellformular</button>
      </div>

      {tab === "ki" && (
        <div style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Anzeigentext einfügen</label>
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text der Immobilienanzeige hier einfügen (Strg+A → Strg+C auf der Anzeige, dann Strg+V hier)." style={{ resize: "vertical", padding: "9px 11px", borderRadius: 7, border: "1px solid var(--line2)", background: "var(--bg3)", color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: 13, outline: "none", lineHeight: 1.6 }} />
          </div>
          <button type="button" onClick={auslesen} disabled={loading || text.trim().length < 30} className="btn btn-gold" style={{ opacity: loading || text.trim().length < 30 ? 0.6 : 1 }}>
            {loading ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> KI analysiert…</> : <><Bot size={14} style={{ verticalAlign: "-2px" }} /> Anzeige auslesen</>}
          </button>
          {error && <div style={{ marginTop: 10, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--red)" }}><TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> {error}</div>}
          {konfidenz != null && (
            <div style={{ marginTop: 10, fontSize: 12, color: konfColor }}><CheckCircle2 size={12} style={{ verticalAlign: "-2px" }} /> Daten erkannt — Konfidenz {konfidenz}%. Bitte unten prüfen und speichern.</div>
          )}
        </div>
      )}

      {/* Geteiltes (editierbares) Formular */}
      <form action={action}>
        <div className="form-section-label">{tab === "ki" ? "Erkannte Daten (prüfen & speichern)" : "Objektdaten"}</div>
        <div className="form-row">
          <div className="form-group"><label>Name *</label><input name="bezeichnung" required value={v.bezeichnung} onChange={set("bezeichnung")} placeholder="z.B. 3-Zi-Wohnung Hamburg" /></div>
          <div className="form-group"><label>Typ</label><select name="typ" value={v.typ} onChange={set("typ")}>{TYPEN.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Adresse</label><input name="adresse" value={v.adresse} onChange={set("adresse")} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Kaufpreis (€)</label><input type="number" name="kaufpreis" value={v.kaufpreis} onChange={set("kaufpreis")} /></div>
          <div className="form-group"><label>Aktueller Wert (€)</label><input type="number" name="wert" value={v.wert} onChange={set("wert")} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Wohnfläche (m²)</label><input type="number" name="flaeche" value={v.flaeche} onChange={set("flaeche")} /></div>
          <div className="form-group"><label>Zimmer</label><input type="number" step="0.5" name="zimmer" value={v.zimmer} onChange={set("zimmer")} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Baujahr</label><input type="number" name="baujahr" value={v.baujahr} onChange={set("baujahr")} /></div>
          <div className="form-group"><label>Kaltmiete / Mo. (€)</label><input type="number" name="miete" value={v.miete} onChange={set("miete")} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Energieklasse</label><input name="energieklasse" value={v.energieklasse} onChange={set("energieklasse")} /></div>
          <div className="form-group"><label>Status</label><select name="obj_status" value={v.obj_status} onChange={set("obj_status")}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        {notiz && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}><StickyNote size={11} style={{ verticalAlign: "-1px" }} /> {notiz}</div>}
        <div className="form-actions">
          <SubmitButton><CheckCircle2 size={14} style={{ verticalAlign: "-2px" }} /> Übernehmen &amp; speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
