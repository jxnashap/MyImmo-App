"use client";
import { Wallet } from "lucide-react";

import { useState } from "react";
import { euro, datum } from "@/lib/format";
import { updateEinnahme, deleteEinnahme } from "@/lib/actions/buchungen";
import ExpandableRows from "@/components/ExpandableRows";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import RowDialog from "@/components/RowDialog";
import type { Einnahme, Property, Tenant } from "@/lib/types";

const KATEGORIEN = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"];

export default function EinnahmenListe({
  rows,
  properties,
  tenants,
}: {
  rows: Einnahme[];
  properties: Pick<Property, "id" | "bezeichnung">[];
  tenants: Pick<Tenant, "id" | "vorname" | "nachname">[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = new Map(properties.map((p) => [p.id, p.bezeichnung] as const));
  const offen = rows.find((r) => r.id === openId) ?? null;

  return (
    <table className="list-table">
      <thead><tr><th>Datum</th><th>Immobilie</th><th>Kategorie</th><th>Beschreibung</th><th>Betrag</th></tr></thead>
      <ExpandableRows cols={5} limit={10} label="weitere Buchungen">
        {rows.map((e) => (
          <tr
            key={e.id}
            className="row-click"
            tabIndex={0}
            role="button"
            aria-label="Einnahme bearbeiten"
            onClick={() => setOpenId(e.id)}
            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(e.id); } }}
          >
            <td>{datum(e.buchungsdatum)}</td>
            <td style={{ color: "var(--muted)" }}>{e.prop_id ? nameOf.get(e.prop_id) ?? "–" : "–"}</td>
            <td>{e.kategorie ? <span className="badge badge-green">{e.kategorie}</span> : "–"}</td>
            <td style={{ color: "var(--muted)" }}>{e.beschreibung ?? ""}</td>
            <td style={{ fontWeight: 600, color: "var(--green)" }}>{euro(e.betrag)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={5}><div className="empty"><Wallet className="empty-icon" size={36} color="var(--faint)" /><h4>Noch keine Einnahmen</h4><p>Erfasse Mietzahlungen, Kautionen oder sonstige Erträge.</p></div></td></tr>
        )}
      </ExpandableRows>

      {offen && (
        <RowDialog title="Einnahme bearbeiten" onClose={() => setOpenId(null)}>
              <form action={updateEinnahme.bind(null, offen.id)} className="form-box" style={{ padding: 0, border: "none", background: "none", maxWidth: "none" }}>
                <input type="hidden" name="back" value="/einnahmen" />
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
                  <div className="form-group"><label>Kategorie</label>
                    <select name="kategorie" defaultValue={offen.kategorie ?? "Miete"}>{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select>
                  </div>
                  <div className="form-group"><label>Betrag (€) *</label><input type="number" step="0.01" min="0.01" name="betrag" defaultValue={offen.betrag ?? ""} required /></div>
                </div>
                <div className="form-row single">
                  <div className="form-group"><label>Mieter zuordnen (optional)</label>
                    <select name="mieter_id" defaultValue={offen.mieter_id ?? ""}>
                      <option value="">– Kein Mieter –</option>
                      {tenants.map((t) => <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—"}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row single">
                  <div className="form-group"><label>Beschreibung</label><input type="text" name="beschreibung" defaultValue={offen.beschreibung ?? ""} /></div>
                </div>
                <div className="form-actions" style={{ justifyContent: "space-between" }}>
                  <DeleteButton action={deleteEinnahme.bind(null, offen.id)} className="btn btn-ghost" label="Löschen" confirmText="Diese Einnahme löschen?" />
                  <SubmitButton>Speichern</SubmitButton>
                </div>
              </form>
        </RowDialog>
      )}
    </table>
  );
}
