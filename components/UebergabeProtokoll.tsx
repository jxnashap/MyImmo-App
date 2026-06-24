"use client";

import { useState } from "react";
import type { Tenant, Property, VermieterProfil } from "@/lib/types";

const esc = (s: string) => (s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
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

  function erstellen() {
    const m = tenant;
    const mieterName = `${m.vorname ?? ""} ${m.nachname ?? ""}`.trim();
    const objekt = property ? `${property.bezeichnung}${m.einheit ? ", " + m.einheit : ""}${property.adresse ? ", " + property.adresse : ""}` : "–";
    const vName = vermieter?.name ?? "";
    const titel = `Wohnungsübergabeprotokoll (${typ === "einzug" ? "Einzug" : "Auszug"})`;
    const d = datum ? new Date(datum).toLocaleDateString("de-DE") : "";

    const zaehlerRows = [["Strom", strom], ["Gas", gas], ["Wasser", wasser]]
      .map(([l, v]) => `<tr><td>${l}</td><td>${esc(v) || "—"}</td></tr>`).join("");
    const raumRows = raeume.filter((r) => r.name.trim()).map((r) =>
      `<tr><td><strong>${esc(r.name)}</strong></td><td>${esc(r.zustand)}</td><td>${esc(r.notiz) || "—"}</td></tr>`).join("");

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${titel}</title>
<style>
@page{size:A4;margin:0;}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#222;width:210mm;min-height:297mm;margin:0 auto;padding:22mm;box-sizing:border-box;line-height:1.55;}
h1{font-size:18px;color:#1A1814;margin-bottom:4px;}
.sub{font-size:12px;color:#666;margin-bottom:18px;}
h2{font-size:13px;margin:20px 0 8px;color:#1A1814;border-bottom:1px solid #C4A862;padding-bottom:3px;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top;}
th{color:#888;font-size:11px;text-transform:uppercase;}
.meta{display:flex;gap:30px;font-size:12px;margin-bottom:8px;}
.sig{display:flex;gap:40px;margin-top:50px;}
.sig div{flex:1;border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;}
.toolbar{background:#1a1a1a;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;font-size:13px;}
.toolbar button{background:#D4A847;border:none;color:#1a1a1a;padding:8px 16px;border-radius:6px;font-weight:bold;cursor:pointer;}
@media print{.toolbar{display:none!important;}}
</style></head><body>
<div class="toolbar" contenteditable="false"><span style="font-weight:bold;">✏️ ${titel}</span><span style="color:#999;font-size:11px;flex:1;">Bearbeitbar — dann drucken.</span><button onclick="window.print()">🖨 Drucken / PDF</button></div>
<div contenteditable="true" spellcheck="false" style="outline:none;">
<h1>${titel}</h1>
<div class="sub">${esc(objekt)}</div>
<div class="meta"><div><strong>Datum:</strong> ${d}</div><div><strong>Mieter:</strong> ${esc(mieterName)}</div><div><strong>Vermieter:</strong> ${esc(vName) || "—"}</div></div>
<h2>Zählerstände</h2>
<table><thead><tr><th>Zähler</th><th>Stand</th></tr></thead><tbody>${zaehlerRows}</tbody></table>
<h2>Schlüssel</h2>
<p>Übergebene Schlüssel: <strong>${esc(schluessel) || "—"}</strong></p>
<h2>Räume &amp; Zustand</h2>
<table><thead><tr><th>Raum</th><th>Zustand</th><th>Anmerkung / Mängel</th></tr></thead><tbody>${raumRows || `<tr><td colspan="3">—</td></tr>`}</tbody></table>
<div class="sig"><div>Ort, Datum &amp; Unterschrift Mieter</div><div>Ort, Datum &amp; Unterschrift Vermieter</div></div>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Bitte Pop-ups für diese Seite erlauben."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  return (
    <div className="form-box" style={{ maxWidth: 640 }}>
      <h3>🔑 Übergabeprotokoll</h3>
      <p>Zählerstände, Schlüssel und Raumzustände — öffnet eine druckfertige Ansicht.</p>

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
          <button type="button" className="delete-btn" onClick={() => delRaum(i)} style={{ marginBottom: 9 }}>✕</button>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label>Anmerkung / Mängel</label><input value={r.notiz} onChange={(e) => setRaum(i, "notiz", e.target.value)} /></div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }} onClick={addRaum}>＋ Raum</button>

      <div className="form-actions">
        <button type="button" className="btn btn-gold" onClick={erstellen}>🔑 Protokoll erstellen</button>
      </div>
    </div>
  );
}
