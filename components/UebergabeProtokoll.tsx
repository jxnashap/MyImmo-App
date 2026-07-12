"use client";
import { X, Plus, Save, FileText } from "lucide-react";

// Übergabeprotokoll: Eingabe links, daneben die Live-Vorschau (.brief-sheet).
// „Als PDF herunterladen" = POST an /protokoll/pdf (Server-PDF via pdf-lib,
// Content-Disposition attachment) — Download ohne neues Fenster/Druckdialog.

import { useState, useTransition } from "react";
import { speichereProtokoll } from "@/lib/actions/dokumente";
import { useToast } from "@/components/Toast";
import type { Tenant, Property, VermieterProfil } from "@/lib/types";

const ZUSTAENDE = ["einwandfrei", "leichte Gebrauchsspuren", "Mängel (siehe Notiz)"];
const START_RAEUME = ["Wohnzimmer", "Schlafzimmer", "Küche", "Bad", "Flur"];

export default function UebergabeProtokoll({ tenant, property, vermieter }: { tenant: Tenant; property: Property | null; vermieter: VermieterProfil | null }) {
  const heuteIso = new Date().toISOString().split("T")[0];
  const [typ, setTyp] = useState<"einzug" | "auszug">("einzug");
  const [datum, setDatum] = useState(heuteIso);
  const [strom, setStrom] = useState("");
  const [gas, setGas] = useState("");
  const [wasser, setWasser] = useState("");
  const [schluessel, setSchluessel] = useState("");
  const [raeume, setRaeume] = useState(START_RAEUME.map((name) => ({ name, zustand: "einwandfrei", notiz: "" })));

  const setRaum = (i: number, k: "name" | "zustand" | "notiz", v: string) =>
    setRaeume((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addRaum = () => setRaeume((r) => [...r, { name: "", zustand: "einwandfrei", notiz: "" }]);
  const delRaum = (i: number) => setRaeume((r) => r.filter((_, j) => j !== i));

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const objekt = property ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}` : "–";
  const vName = vermieter?.name ?? "";
  const titel = `Wohnungsübergabeprotokoll (${typ === "einzug" ? "Einzug" : "Auszug"})`;
  const d = datum ? new Date(datum).toLocaleDateString("de-DE") : "";
  const gefuellteRaeume = raeume.filter((r) => r.name.trim());
  const [ablegen, startAblegen] = useTransition();
  const toast = useToast();

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ---------- Eingaben (nicht im Druck) ---------- */}
      <div className="form-box no-print" style={{ maxWidth: 460, flex: "1 1 420px" }}>
        <h3>Übergabeprotokoll</h3>
        <p>Zählerstände, Schlüssel und Raumzustände — rechts entsteht das druckfertige Blatt.</p>

        <div className="form-row">
          <div className="form-group"><label>Art</label><select value={typ} onChange={(e) => setTyp(e.target.value as "einzug" | "auszug")}><option value="einzug">Einzug</option><option value="auszug">Auszug</option></select></div>
          <div className="form-group"><label>Datum</label><input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>
        </div>

        <div className="form-section-label">Zählerstände</div>
        <div className="form-row">
          <div className="form-group"><label>Strom</label><input value={strom} onChange={(e) => setStrom(e.target.value)} placeholder="kWh" /></div>
          <div className="form-group"><label>Gas</label><input value={gas} onChange={(e) => setGas(e.target.value)} placeholder="m³" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Wasser</label><input value={wasser} onChange={(e) => setWasser(e.target.value)} placeholder="m³" /></div>
          <div className="form-group"><label>Schlüssel (Anzahl/Art)</label><input value={schluessel} onChange={(e) => setSchluessel(e.target.value)} placeholder="z.B. 2 Haustür, 1 Briefkasten" /></div>
        </div>

        <div className="form-section-label">Räume &amp; Zustand</div>
        {raeume.map((r, i) => (
          <div key={i} className="form-row" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
            <div className="form-group"><label>Raum</label><input value={r.name} onChange={(e) => setRaum(i, "name", e.target.value)} /></div>
            <div className="form-group"><label>Zustand</label><select value={r.zustand} onChange={(e) => setRaum(i, "zustand", e.target.value)}>{ZUSTAENDE.map((z) => <option key={z}>{z}</option>)}</select></div>
            <button type="button" className="delete-btn" onClick={() => delRaum(i)} style={{ marginBottom: 9 }}><X size={14} /></button>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}><label>Anmerkung / Mängel</label><input value={r.notiz} onChange={(e) => setRaum(i, "notiz", e.target.value)} /></div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }} onClick={addRaum}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Raum</button>

        {/* PDF-Download: Route liefert attachment → Download ohne neues Fenster */}
        <form action={`/tenants/${tenant.id}/protokoll/pdf`} method="POST" className="form-actions">
          <input type="hidden" name="typ" value={typ} />
          <input type="hidden" name="datum" value={datum} />
          <input type="hidden" name="strom" value={strom} />
          <input type="hidden" name="gas" value={gas} />
          <input type="hidden" name="wasser" value={wasser} />
          <input type="hidden" name="schluessel" value={schluessel} />
          <input type="hidden" name="raeume" value={JSON.stringify(gefuellteRaeume)} />
          <button
            type="button"
            className="btn btn-outline"
            disabled={ablegen}
            onClick={() =>
              startAblegen(async () => {
                const res = await speichereProtokoll(tenant.id, { typ, datum, strom, gas, wasser, schluessel, raeume: gefuellteRaeume });
                toast(res.ok ? "Beim Mieter & im Archiv gespeichert ✓" : res.error ?? "Speichern fehlgeschlagen.");
              })
            }
            style={{ marginRight: 8 }}
          >
            {ablegen ? "Speichert…" : <><Save size={14} style={{ verticalAlign: "-2px" }} /> Speichern</>}
          </button>
          <button type="submit" className="btn btn-gold"><FileText size={14} style={{ verticalAlign: "-2px" }} /> Als PDF herunterladen</button>
        </form>
      </div>

      {/* ---------- A4-Blatt (Druckvorlage) ---------- */}
      <div style={{ flex: "1 1 480px", minWidth: 320 }}>
        <div className="brief-sheet">
          <div className="brief-kopf">
            <div className="brief-logo">My<span>Immo</span></div>
            <div className="brief-absender">
              {vName && <strong>{vName}</strong>}
            </div>
          </div>
          <div className="brief-goldline" style={{ marginBottom: 18 }} />

          <div className="brief-betreff">
            <h2>{titel}</h2>
            <div className="unter">{objekt}</div>
            <div className="brief-betreff-linie" />
          </div>

          <div style={{ display: "flex", gap: 28, fontSize: 12, margin: "16px 0 4px", flexWrap: "wrap" }}>
            <div><strong>Datum:</strong> {d || "—"}</div>
            <div><strong>Mieter:</strong> {mieterName || "—"}</div>
            <div><strong>Vermieter:</strong> {vName || "—"}</div>
          </div>

          <h3 style={{ fontSize: 12.5, margin: "16px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit" }}>Zählerstände</h3>
          <table>
            <thead><tr><th>Zähler</th><th>Stand</th></tr></thead>
            <tbody>
              {[["Strom", strom], ["Gas", gas], ["Wasser", wasser]].map(([l, v]) => (
                <tr key={l}><td>{l}</td><td>{v || "—"}</td></tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ fontSize: 12.5, margin: "18px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit" }}>Schlüssel</h3>
          <p style={{ margin: 0 }}>Übergebene Schlüssel: <strong>{schluessel || "—"}</strong></p>

          <h3 style={{ fontSize: 12.5, margin: "18px 0 6px", borderBottom: "1px solid var(--gold)", paddingBottom: 3, fontFamily: "inherit" }}>Räume &amp; Zustand</h3>
          <table>
            <thead><tr><th>Raum</th><th>Zustand</th><th>Anmerkung / Mängel</th></tr></thead>
            <tbody>
              {gefuellteRaeume.length === 0 ? (
                <tr><td colSpan={3} className="brief-muted">—</td></tr>
              ) : (
                gefuellteRaeume.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.zustand}</td>
                    <td className="brief-muted">{r.notiz || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="brief-sig">
            <div>Ort, Datum &amp; Unterschrift Mieter</div>
            <div>Ort, Datum &amp; Unterschrift Vermieter</div>
          </div>
        </div>
      </div>
    </div>
  );
}
