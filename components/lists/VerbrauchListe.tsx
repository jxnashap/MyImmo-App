"use client";

import { useState } from "react";
import { euro, datum } from "@/lib/format";
import { updateVerbrauch, deleteVerbrauch } from "@/lib/actions/buchungen";
import ExpandableRows from "@/components/ExpandableRows";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import RowDialog from "@/components/RowDialog";
import type { Verbrauch, Property } from "@/lib/types";

const ARTEN = ["Strom", "Gas", "Wasser", "Heizöl", "Fernwärme", "Sonstiges"];
const EINHEITEN = ["kWh", "m³", "Liter", "Pauschal"];
const ART_ICONS: Record<string, string> = { Strom: "⚡", Gas: "🔥", Wasser: "💧", Heizöl: "🛢", Fernwärme: "♨", Heizung: "♨", Sonstiges: "📦" };

export default function VerbrauchListe({
  rows,
  properties,
}: {
  rows: Verbrauch[];
  properties: Pick<Property, "id" | "bezeichnung">[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = new Map(properties.map((p) => [p.id, p.bezeichnung] as const));
  const offen = rows.find((r) => r.id === openId) ?? null;

  return (
    <table className="list-table">
      <thead><tr><th>Datum</th><th>Immobilie</th><th>Art</th><th>Menge</th><th>Einheit</th><th>Kosten</th></tr></thead>
      <ExpandableRows cols={6} limit={10} label="weitere Einträge">
        {rows.map((v) => (
          <tr
            key={v.id}
            className="row-click"
            tabIndex={0}
            role="button"
            aria-label="Verbrauch bearbeiten"
            onClick={() => setOpenId(v.id)}
            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(v.id); } }}
          >
            <td>{datum(v.buchungsdatum)}</td>
            <td style={{ color: "var(--muted)" }}>{v.prop_id ? nameOf.get(v.prop_id) ?? "–" : "–"}</td>
            <td>{(v.art && ART_ICONS[v.art]) || ""} {v.art ?? "–"}</td>
            <td>{v.menge ?? "–"}</td>
            <td style={{ color: "var(--muted)" }}>{v.einheit ?? ""}</td>
            <td style={{ fontWeight: 600 }}>{euro(v.verbrauchkosten)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6}><div className="empty"><div className="empty-icon">⚡</div>Noch kein Verbrauch</div></td></tr>
        )}
      </ExpandableRows>

      {offen && (
        <RowDialog title="Verbrauch bearbeiten" onClose={() => setOpenId(null)}>
          <form action={updateVerbrauch.bind(null, offen.id)} className="form-box" style={{ padding: 0, border: "none", background: "none", maxWidth: "none" }}>
            <input type="hidden" name="back" value="/verbrauch" />
            <div className="form-row">
              <div className="form-group"><label>Datum *</label><input type="date" name="buchungsdatum" defaultValue={offen.buchungsdatum ?? ""} required /></div>
              <div className="form-group"><label>Immobilie *</label>
                <select name="prop_id" defaultValue={offen.prop_id ?? ""} required>
                  <option value="">– wählen –</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Art</label><select name="art" defaultValue={offen.art ?? "Strom"}>{ARTEN.map((a) => <option key={a}>{a}</option>)}</select></div>
              <div className="form-group"><label>Menge</label><input type="number" step="0.01" name="menge" defaultValue={offen.menge ?? ""} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Einheit</label><select name="einheit" defaultValue={offen.einheit ?? "kWh"}>{EINHEITEN.map((u) => <option key={u}>{u}</option>)}</select></div>
              <div className="form-group"><label>Kosten (€) *</label><input type="number" step="0.01" name="verbrauchkosten" defaultValue={offen.verbrauchkosten ?? ""} required /></div>
            </div>
            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <DeleteButton action={deleteVerbrauch.bind(null, offen.id)} className="btn btn-ghost" label="Löschen" confirmText="Diesen Eintrag löschen?" />
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </form>
        </RowDialog>
      )}
    </table>
  );
}
