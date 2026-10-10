"use client";
import { Zap, Flame, Droplet, Fuel, Heater, Package, type LucideIcon } from "lucide-react";

import { useState } from "react";
import { euro, datum } from "@/lib/format";
import { updateVerbrauch, deleteVerbrauch } from "@/lib/actions/buchungen";
import ExpandableRows from "@/components/ExpandableRows";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import RowDialog from "@/components/RowDialog";
import type { Verbrauch, Property } from "@/lib/types";
import Leer from "@/components/Leer";

const ARTEN = ["Strom", "Gas", "Wasser", "Heizöl", "Fernwärme", "Sonstiges"];
const EINHEITEN = ["kWh", "m³", "Liter", "Pauschal"];
const ART_ICONS: Record<string, LucideIcon> = { Strom: Zap, Gas: Flame, Wasser: Droplet, Heizöl: Fuel, Fernwärme: Heater, Heizung: Heater, Sonstiges: Package };

export default function VerbrauchListe({
  rows,
  properties,
  gefiltert = false,
}: {
  rows: Verbrauch[];
  properties: Pick<Property, "id" | "bezeichnung">[];
  /** Es GIBT Einträge, nur passt keiner zu Jahr/Objekt/Art (Gesamtprüfung B58, Regel B27). */
  gefiltert?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = new Map(properties.map((p) => [p.id, p.bezeichnung] as const));
  const offen = rows.find((r) => r.id === openId) ?? null;

  // Leer: OHNE Tabelle. In der 560 px breiten Scroll-Tabelle wurde der Leerzustand auf 560 px
  // zentriert und war am Handy rechts abgeschnitten (Design-Scan 06.10.2026).
  if (rows.length === 0 && gefiltert) {
    return (
      <Leer
        art="filter"
        icon={Zap}
        titel="Keine Einträge für diese Auswahl"
        text="Es gibt Verbrauchseinträge — nur nicht für dieses Jahr, Objekt oder diese Art. Filter oben anpassen, z. B. „Alle Jahre“."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <Leer
        icon={Zap}
        titel="Noch kein Verbrauch erfasst"
        text="Zählerstände für Strom, Gas, Wasser und Heizung. Die NK-Abrechnung zeigt sie je Zähler zum Übertragen an — den Verbrauch je Mietpartei trägst du dort ein."
        aktion={{ href: "/verbrauch/new", label: "Verbrauch erfassen" }}
      />
    );
  }

  return (
    <div className="table-scroll"><table className="list-table">
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
            <td>{(() => { const Icon = v.art ? ART_ICONS[v.art] : undefined; return Icon ? <Icon size={13} style={{ verticalAlign: "-2px" }} /> : null; })()} {v.art ?? "–"}</td>
            {/* "1400" ohne Tausenderpunkt war nicht ueberschlagbar — de-DE-Format, bis zu 2 Dezimalstellen nur wenn erfasst. */}
            <td style={{ fontVariantNumeric: "tabular-nums" }}>{v.menge == null ? "–" : v.menge.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td>
            <td style={{ color: "var(--muted)" }}>{v.einheit ?? ""}</td>
            <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{euro(v.verbrauchkosten)}</td>
          </tr>
        ))}
      </ExpandableRows>

      {offen && (
        <RowDialog title="Verbrauch bearbeiten" onClose={() => setOpenId(null)}>
          <form action={updateVerbrauch.bind(null, offen.id)} className="form-box" style={{ padding: 0, border: "none", background: "none", boxShadow: "none", maxWidth: "none" }}>
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
    </table></div>
  );
}
