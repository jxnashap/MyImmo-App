"use client";
import { Bot, ClipboardList, Hourglass, TriangleAlert, CheckCircle2, StickyNote, Upload, Link2 } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";

import { useState } from "react";

// Muss zur Auswahl im PropertyForm passen — "Garage / Stellplatz" und
// "Garagenkomplex" fehlten hier, waren ueber den Import also nicht waehlbar.
const TYPEN = ["Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Ferienimmobilie", "Garage / Stellplatz", "Garagenkomplex", "Grundstück"];
const STATUS = ["Vermietet", "Selbst bewohnt", "Leer", "Feriennutzung"];

type Values = {
  bezeichnung: string; typ: string; adresse: string; kaufpreis: string; wert: string;
  flaeche: string; zimmer: string; baujahr: string; miete: string; energieklasse: string; obj_status: string;
};
const LEER: Values = { bezeichnung: "", typ: "Eigentumswohnung", adresse: "", kaufpreis: "", wert: "", flaeche: "", zimmer: "", baujahr: "", miete: "", energieklasse: "", obj_status: "Vermietet" };

export default function ImportWizard({ action }: { action: (fd: FormData) => void }) {
  const [tab, setTab] = useState<"ki" | "manual">("ki");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [datei, setDatei] = useState<File | null>(null);
  const [loading, setLoading] = useState<null | "pdf" | "url" | "text">(null);
  const [error, setError] = useState<string | null>(null);
  const [konfidenz, setKonfidenz] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  const [v, setV] = useState<Values>(LEER);
  // Im KI-Tab stand das leere Objektformular dauerhaft unter den drei
  // Auslese-Wegen — man sah nicht, ob es das Ergebnis oder eine zweite
  // Eingabemaske ist. Es erscheint jetzt erst, wenn es etwas zu prüfen gibt
  // (oder man es bewusst aufklappt).
  const [manuellOffen, setManuellOffen] = useState(false);
  const etwasErkannt = konfidenz != null || Object.entries(v).some(([k, val]) => val !== LEER[k as keyof Values]);
  const zeigeFormular = tab === "manual" || etwasErkannt || manuellOffen;
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  // Ein Weg für alle drei Quellen: PDF-Upload, Link, Text.
  async function rufeAb(endpoint: string, body: object, modus: "pdf" | "url" | "text") {
    setError(null); setKonfidenz(null); setLoading(modus);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const basis = json.error || "Fehler beim Analysieren.";
        setError(modus === "url" ? `${basis} …oder Exposé-PDF hochladen bzw. Text einfügen.` : basis);
        return;
      }
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
      setLoading(null);
    }
  }

  /** Exposé-PDF einlesen und als base64 an die Auswertung geben. */
  async function pdfAuslesen() {
    if (!datei) return;
    if (datei.size > 20 * 1024 * 1024) { setError("PDF zu groß (max. 20 MB)."); return; }
    setError(null); setLoading("pdf");
    try {
      const buf = await datei.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await rufeAb("/api/import", { pdfBase64: btoa(bin) }, "pdf");
    } catch (e) {
      setError(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
      setLoading(null);
    }
  }

  const konfColor = konfidenz == null ? "" : konfidenz >= 80 ? "var(--green)" : konfidenz >= 50 ? "var(--amber)" : "var(--red)";

  return (
    <div className="form-box" style={{ maxWidth: 680 }}>
      <h3>Immobilien-Anzeige importieren</h3>
      <p>Lade das Exposé als PDF hoch, füge den Link zum Inserat ein oder kopiere den Anzeigentext — die KI liest die Daten aus. Oder fülle das Schnellformular manuell aus.</p>
      <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>KI-Auswertung (Anthropic Claude): Der Text wird zur Auswertung an die API übermittelt (kein Modell-Training). Ergebnisse bitte vor dem Speichern prüfen.</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--line)" }}>
        <button type="button" onClick={() => setTab("ki")} style={{ padding: "8px 16px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === "ki" ? "var(--gold-fill)" : "transparent"}`, color: tab === "ki" ? "var(--gold)" : "var(--muted)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: -1 }}><Bot size={14} style={{ verticalAlign: "-2px" }} /> KI-Import</button>
        <button type="button" onClick={() => setTab("manual")} style={{ padding: "8px 16px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === "manual" ? "var(--gold-fill)" : "transparent"}`, color: tab === "manual" ? "var(--gold)" : "var(--muted)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500, cursor: "pointer", marginBottom: -1 }}><ClipboardList size={14} style={{ verticalAlign: "-2px" }} /> Schnellformular</button>
      </div>

      {tab === "ki" && (
        <div style={{ marginBottom: 16 }}>
          {/* Weg 1: Exposé-PDF hochladen — der übliche Fall beim Makler-Exposé. */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label><Upload size={12} style={{ verticalAlign: "-2px" }} /> Exposé als PDF hochladen</label>
            {/* Der native Datei-Dialog-Knopf war die einzige Stelle der App mit
                englischer Systembeschriftung und eckigem Rahmen — deshalb hier
                dasselbe Pillen-Muster wie im CSV-Import. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label className="btn btn-ghost" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> PDF wählen
                <input type="file" accept="application/pdf,.pdf"
                  onChange={(e) => { setDatei(e.target.files?.[0] ?? null); setError(null); }}
                  style={{ display: "none" }} />
              </label>
              {datei && (
                <span style={{ fontSize: 12.5, color: "var(--muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                  {datei.name}
                </span>
              )}
              <button type="button" className="btn btn-gold" onClick={pdfAuslesen} disabled={loading !== null || !datei}>
                {loading === "pdf" ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> Liest PDF…</> : "PDF auslesen"}
              </button>
            </div>
            <span style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>Max. 20 MB. Auch gescannte Exposés werden gelesen.</span>
          </div>

          {/* Weg 2: Link zum Inserat. */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label><Link2 size={12} style={{ verticalAlign: "-2px" }} /> …oder Link zum Inserat</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://… Exposé, Inserat oder PDF" style={{ flex: "1 1 240px" }} />
              <button type="button" className="btn btn-ghost"
                onClick={() => rufeAb("/api/import-url", { url: url.trim() }, "url")}
                disabled={loading !== null || !/^https?:\/\/.+\..+/.test(url.trim())}>
                {loading === "url" ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> Lädt…</> : "Aus Link laden"}
              </button>
            </div>
          </div>

          {/* Weg 3: Text einfügen (Fallback, wenn Portale blocken). */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>…oder Anzeigentext einfügen</label>
            {/* Kein Inline-Stil: erbt die Standard-Optik aus .form-group — die
                Extra-Rahmenfarbe war die zweite Input-Optik im selben Formular. */}
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text der Immobilienanzeige hier einfügen (Strg+A → Strg+C auf der Anzeige, dann Strg+V hier)." style={{ resize: "vertical", lineHeight: 1.6 }} />
          </div>
          <button type="button" onClick={() => rufeAb("/api/import", { text }, "text")}
            disabled={loading !== null || text.trim().length < 30} className="btn btn-ghost"
            style={{ opacity: loading !== null || text.trim().length < 30 ? 0.6 : 1 }}>
            {loading === "text" ? <><Hourglass size={14} style={{ verticalAlign: "-2px" }} /> KI analysiert…</> : <><Bot size={14} style={{ verticalAlign: "-2px" }} /> Text auslesen</>}
          </button>
          {error && <div role="alert" style={{ marginTop: 10, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--red)" }}><TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> {error}</div>}
          {konfidenz != null && (
            <div style={{ marginTop: 10, fontSize: 12, color: konfColor }}><CheckCircle2 size={12} style={{ verticalAlign: "-2px" }} /> Daten erkannt — Konfidenz {konfidenz}%. Bitte unten prüfen und speichern.</div>
          )}
        </div>
      )}

      {tab === "ki" && !zeigeFormular && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setManuellOffen(true)}
          style={{ marginBottom: 4 }}
        >
          <ClipboardList size={14} style={{ verticalAlign: "-2px" }} /> Lieber selbst eintragen
        </button>
      )}

      {/* Geteiltes (editierbares) Formular */}
      <form action={action} style={{ display: zeigeFormular ? undefined : "none" }}>
        <div className="form-section-label">{tab === "ki" ? "Erkannte Daten (prüfen & speichern)" : "Objektdaten"}</div>
        <div className="form-row">
          <div className="form-group"><label>Name *</label><input name="bezeichnung" required value={v.bezeichnung} onChange={set("bezeichnung")} placeholder="z. B. 3-Zi-Wohnung Hamburg" /></div>
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
        {notiz && (
          <>
            {/* Mitsenden, nicht nur anzeigen (siehe parse() in lib/actions/properties.ts). */}
            <input type="hidden" name="notiz_import" value={notiz} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
              <StickyNote size={11} style={{ verticalAlign: "-1px" }} /> {notiz}
            </div>
          </>
        )}
        <div className="form-actions">
          <SubmitButton><CheckCircle2 size={14} style={{ verticalAlign: "-2px" }} /> Übernehmen &amp; speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
