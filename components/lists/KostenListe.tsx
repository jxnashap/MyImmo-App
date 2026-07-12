"use client";
import { FileText, Image as ImageIcon, Paperclip, X, ClipboardList } from "lucide-react";

import { useState } from "react";
import { euro, datum, istUmlagefaehig } from "@/lib/format";
import { updateKosten, deleteKosten, deleteRechnung } from "@/lib/actions/buchungen";
import ExpandableRows from "@/components/ExpandableRows";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import RowDialog from "@/components/RowDialog";
import BelegFreigabeToggle from "@/components/BelegFreigabeToggle";
import type { Kosten, Property, Tenant } from "@/lib/types";

const KATEGORIEN = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

export default function KostenListe({
  rows,
  properties,
  tenants,
}: {
  rows: Kosten[];
  properties: Pick<Property, "id" | "bezeichnung">[];
  tenants: Pick<Tenant, "id" | "vorname" | "nachname">[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const propName = new Map(properties.map((p) => [p.id, p.bezeichnung] as const));
  const mietName = new Map(tenants.map((t) => [t.id, `${t.vorname ?? ""} ${t.nachname ?? ""}`.trim()] as const));
  const offen = rows.find((r) => r.id === openId) ?? null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <table className="list-table">
      <thead><tr><th>Datum</th><th>Immobilie</th><th>Mieter</th><th>Kategorie</th><th>Umlage</th><th>Beleg</th><th>Betrag</th></tr></thead>
      <ExpandableRows cols={7} limit={10} label="weitere Buchungen">
        {rows.map((k) => {
          const u = istUmlagefaehig(k.kategorie);
          return (
            <tr
              key={k.id}
              className="row-click"
              tabIndex={0}
              role="button"
              aria-label="Ausgabe bearbeiten"
              onClick={() => setOpenId(k.id)}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(k.id); } }}
            >
              <td>{datum(k.buchungsdatum)}</td>
              <td style={{ color: "var(--muted)" }}>{k.prop_id ? propName.get(k.prop_id) ?? "–" : "–"}</td>
              <td style={{ color: "var(--muted)" }}>{k.mieter_id ? mietName.get(k.mieter_id) ?? "–" : "–"}</td>
              <td>{k.kategorie ? <span className="badge badge-red">{k.kategorie}</span> : "–"}</td>
              <td><span className={`badge ${u === "ja" ? "badge-green" : u === "nein" ? "badge-red" : "badge-teal"}`}>{u === "ja" ? "umlagefähig" : u === "nein" ? "nicht" : "prüfen"}</span></td>
              <td onClick={stop}>
                {k.rechnung_name ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <a href={`/kosten/${k.id}/rechnung`} target="_blank" rel="noopener noreferrer" title={k.rechnung_name} style={{ color: "var(--gold)" }}>
                      {k.rechnung_type === "application/pdf" ? <FileText size={13} style={{ verticalAlign: "-2px" }} /> : k.rechnung_type?.startsWith("image/") ? <ImageIcon size={13} style={{ verticalAlign: "-2px" }} /> : <Paperclip size={13} style={{ verticalAlign: "-2px" }} />} ansehen
                    </a>
                    <BelegFreigabeToggle kostenId={k.id} freigegeben={k.mieter_freigabe === true} />
                    <DeleteButton action={deleteRechnung.bind(null, k.id)} className="delete-btn" label={<X size={14} />} confirmText="Beleg entfernen?" />
                  </span>
                ) : (
                  <span style={{ color: "var(--faint)", fontSize: 12 }}>–</span>
                )}
              </td>
              <td style={{ fontWeight: 600, color: "var(--red)" }}>{euro(k.betrag)}</td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr><td colSpan={7}><div className="empty"><ClipboardList className="empty-icon" size={36} color="var(--faint)" /><h4>Noch keine Ausgaben</h4><p>Erfasse Betriebskosten, Reparaturen oder Verwaltungskosten.</p></div></td></tr>
        )}
      </ExpandableRows>

      {offen && (
        <RowDialog title="Ausgabe bearbeiten" onClose={() => setOpenId(null)}>
          <form action={updateKosten.bind(null, offen.id)} className="form-box" style={{ padding: 0, border: "none", background: "none", maxWidth: "none" }}>
            <input type="hidden" name="back" value="/kosten" />
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
                <select name="kategorie" defaultValue={offen.kategorie ?? "Reparatur"}>{KATEGORIEN.map((c) => <option key={c}>{c}</option>)}</select>
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
            <div className="form-row single">
              <div className="form-group">
                <label>Rechnung / Beleg {offen.rechnung_name ? "ersetzen" : "(optional · PDF/Bild · max. 15 MB)"}</label>
                {offen.rechnung_name && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    Aktuell: <a href={`/kosten/${offen.id}/rechnung`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>{offen.rechnung_name}</a> — neue Datei wählen zum Ersetzen.
                  </div>
                )}
                <input type="file" name="rechnung" accept="application/pdf,image/*" />
              </div>
            </div>
            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <DeleteButton action={deleteKosten.bind(null, offen.id)} className="btn btn-ghost" label="Löschen" confirmText="Diese Ausgabe löschen?" />
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </form>
        </RowDialog>
      )}
    </table>
  );
}
