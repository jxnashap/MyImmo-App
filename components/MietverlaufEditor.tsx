"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { saveMietverlauf } from "@/lib/actions/mietverlauf";
import { validierePerioden, type Periode } from "@/lib/wiederkehr";

type Zeile = { von: string; bis: string; betrag: string };

// Editor für Miet-Zeiträume mit jeweils eigenem (gebuchtem) Betrag.
// Lückenlos & überschneidungsfrei; der letzte Zeitraum darf offen (ohne „bis").
export default function MietverlaufEditor({ mieterId, initial }: { mieterId: string; initial: Periode[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Zeile[]>(
    initial.length ? initial.map((p) => ({ von: p.von, bis: p.bis ?? "", betrag: String(p.betrag) })) : [],
  );
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const perioden: Periode[] = rows.map((r) => ({ von: r.von, bis: r.bis || null, betrag: Number(r.betrag.replace(",", ".")) || 0 }));
  const vollstaendig = rows.every((r) => r.von && r.betrag);
  const check = validierePerioden(perioden);
  const fehler = !vollstaendig ? 'Bitte „von"-Datum und Betrag in jeder Zeile ausfüllen.' : check.ok ? null : check.error;

  const setRow = (i: number, k: keyof Zeile, val: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: val } : r)));
  const add = () => setRows((rs) => [...rs, { von: "", bis: "", betrag: "" }]);
  const remove = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  async function speichern() {
    setServerError(null);
    setSaving(true);
    try {
      const res = await saveMietverlauf(mieterId, perioden);
      if (!res.ok) { setServerError(res.error ?? "Speichern fehlgeschlagen."); return; }
      toast("Mietverlauf gespeichert ✓");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-box" style={{ maxWidth: 640, marginTop: 20 }}>
      <h3>Mietverlauf (verschiedene Beträge je Zeitraum)</h3>
      <p>Optional. Lege Zeiträume mit eigener (gebuchter) Warmmiete an, z. B. 2020–2024 = 600 €, ab 2024 = 680 €. Ohne Eintrag gilt die Warmmiete aus den Stammdaten.</p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "10px 0" }}>Noch keine Zeiträume.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <label className="set-field"><span>Von</span><input className="set-input" type="date" value={r.von} onChange={(e) => setRow(i, "von", e.target.value)} /></label>
              <label className="set-field"><span>Bis (leer = offen)</span><input className="set-input" type="date" value={r.bis} onChange={(e) => setRow(i, "bis", e.target.value)} /></label>
              <label className="set-field"><span>Betrag (€)</span><input className="set-input" type="number" step="0.01" value={r.betrag} onChange={(e) => setRow(i, "betrag", e.target.value)} /></label>
              <button type="button" className="icon-btn danger" title="Zeitraum entfernen" onClick={() => remove(i)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {(fehler || serverError) && (
        <div role="alert" style={{ background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", color: "var(--red)", borderRadius: 10, padding: "9px 12px", fontSize: 13, margin: "8px 0" }}>
          ⚠️ {serverError ?? fehler}
        </div>
      )}

      <div className="form-actions" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn btn-ghost" onClick={add} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Zeitraum</button>
        <button type="button" className="btn btn-gold" disabled={saving || !!fehler} onClick={speichern}>{saving ? "Speichern…" : "Mietverlauf speichern"}</button>
      </div>
    </div>
  );
}
