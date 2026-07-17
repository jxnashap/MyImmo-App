"use client";
import { useState } from "react";
import { X, TriangleAlert } from "lucide-react";
import { euro, datum } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import { updateKredit, deleteKredit } from "@/lib/actions/buchungen";
import RowDialog from "@/components/RowDialog";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import type { Kredit, Property } from "@/lib/types";

const SONDER = ["", "5% p.a.", "10% p.a.", "Nein", "Ja, unbegrenzt"];

// Kredit-Liste: Karten wie gehabt, aber per Klick öffnet sich der Kredit in
// einer Bubble (RowDialog) und wird dort inline bearbeitet — wie bei
// Ausgaben/Einnahmen. Keine separate Bearbeiten-Seite mehr nötig.
export default function KrediteListe({
  rows,
  properties,
}: {
  rows: Kredit[];
  properties: Pick<Property, "id" | "bezeichnung">[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const offen = rows.find((r) => r.id === openId) ?? null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {rows.map((k) => {
        const pct = k.betrag && k.betrag > 0 ? Math.max(0, Math.min(100, Math.round(((k.restschuld ?? 0) / k.betrag) * 100))) : 100;
        const tilgtPct = 100 - pct;
        const moZins = k.restschuld ? (k.restschuld * (k.zinssatz ?? 0) / 100) / 12 : 0;
        const moTilg = (k.monatsrate ?? 0) - moZins;
        const warn = getRefinanzWarning(k.zinsbindung);
        return (
          <div
            key={k.id}
            className="section row-click"
            style={{ marginBottom: 14 }}
            tabIndex={0}
            role="button"
            aria-label={`${k.bezeichnung || "Darlehen"} bearbeiten`}
            onClick={() => setOpenId(k.id)}
            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(k.id); } }}
          >
            {warn && (
              <div style={{ background: warn.bg, borderLeft: `3px solid ${warn.color}`, padding: "8px 14px", fontSize: 12, color: warn.color, fontWeight: 500 }}>
                <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> Zinsbindung läuft ab: <strong>{datum(k.zinsbindung)}</strong>
              </div>
            )}
            <div className="section-header">
              <div>
                <h3>{k.bezeichnung || k.bank || "Darlehen"}</h3>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{(k.prop_id && nameOf.get(k.prop_id)) || "–"}{k.bank ? ` · ${k.bank}` : ""}{k.darlnr ? ` · Nr. ${k.darlnr}` : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {k.zinssatz != null && <span className="badge badge-gold">{k.zinssatz}% Zins</span>}
                <span onClick={stop} style={{ display: "inline-flex" }}>
                  <DeleteButton action={deleteKredit.bind(null, k.id)} className="delete-btn" label={<X size={14} />} confirmText={`„${k.bezeichnung || "Darlehen"}" löschen?`} />
                </span>
              </div>
            </div>
            <div className="section-body">
              <div className="kredit-grid" style={{ marginBottom: 14 }}>
                <div><div className="kredit-field-lbl">Urspr. Darlehen</div><div className="kredit-field-val">{euro(k.betrag)}</div></div>
                <div><div className="kredit-field-lbl">Restschuld</div><div className="kredit-field-val" style={{ color: "var(--red)" }}>{euro(k.restschuld)}</div></div>
                <div><div className="kredit-field-lbl">Rate / Monat</div><div className="kredit-field-val">{euro(k.monatsrate)}</div></div>
                <div><div className="kredit-field-lbl">Laufzeit bis</div><div className="kredit-field-val">{k.laufzeit ?? "–"}</div></div>
              </div>
              <div className="kredit-grid" style={{ marginBottom: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <div><div className="kredit-field-lbl">Zinsen / Mo.</div><div className="kredit-field-val" style={{ color: "var(--muted)" }}>{euro(moZins)}</div></div>
                <div><div className="kredit-field-lbl">Tilgung / Mo.</div><div className="kredit-field-val" style={{ color: "var(--green)" }}>{euro(Math.max(0, moTilg))}</div></div>
                <div><div className="kredit-field-lbl">Tilgungssatz</div><div className="kredit-field-val">{k.tilgungssatz ? `${k.tilgungssatz}% p.a.` : "–"}</div></div>
                <div><div className="kredit-field-lbl">Zinsbindung</div><div className="kredit-field-val" style={{ color: warn ? warn.color : "inherit" }}>{k.zinsbindung ? datum(k.zinsbindung) : "–"}</div></div>
              </div>
              {(k.grundschuld || k.beleihung || k.sonder) && (
                <div className="kredit-grid" style={{ marginBottom: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <div><div className="kredit-field-lbl">Grundschuld</div><div className="kredit-field-val">{k.grundschuld ? euro(k.grundschuld) : "–"}</div></div>
                  <div><div className="kredit-field-lbl">Beleihungsauslauf</div><div className="kredit-field-val">{k.beleihung ? `${k.beleihung}%` : "–"}</div></div>
                  <div><div className="kredit-field-lbl">Darlehensnr.</div><div className="kredit-field-val" style={{ fontSize: 11 }}>{k.darlnr || "–"}</div></div>
                  <div><div className="kredit-field-lbl">Sondertilgung</div><div className="kredit-field-val">{k.sonder || "–"}</div></div>
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>Getilgt: <strong style={{ color: "var(--text)" }}>{tilgtPct}%</strong></div>
              <div className="progress-bar" style={{ height: 8 }}><div className="progress-fill" style={{ width: `${tilgtPct}%`, background: "var(--teal)" }} /></div>
            </div>
          </div>
        );
      })}

      {offen && (
        <RowDialog title="Darlehen bearbeiten" onClose={() => setOpenId(null)}>
          <form action={updateKredit.bind(null, offen.id)} className="form-box" style={{ padding: 0, border: "none", background: "none", maxWidth: "none" }}>
            <input type="hidden" name="back" value="/kredite" />

            <div className="form-section-label">Grunddaten</div>
            <div className="form-row">
              <div className="form-group"><label>Bezeichnung *</label><input type="text" name="bezeichnung" defaultValue={offen.bezeichnung ?? ""} required /></div>
              <div className="form-group"><label>Immobilie</label>
                <select name="prop_id" defaultValue={offen.prop_id ?? ""}>
                  <option value="">– wählen –</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Bank / Gläubiger</label><input type="text" name="bank" defaultValue={offen.bank ?? ""} /></div>
              <div className="form-group"><label>Darlehensnummer</label><input type="text" name="darlnr" defaultValue={offen.darlnr ?? ""} /></div>
            </div>

            <div className="form-section-label">Beträge</div>
            <div className="form-row">
              <div className="form-group"><label>Urspr. Darlehenssumme (€) *</label><input type="number" step="0.01" name="betrag" defaultValue={offen.betrag ?? ""} required /></div>
              <div className="form-group"><label>Aktuelle Restschuld (€)</label><input type="number" step="0.01" name="restschuld" defaultValue={offen.restschuld ?? ""} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Grundschuld (€)</label><input type="number" step="0.01" name="grundschuld" defaultValue={offen.grundschuld ?? ""} /></div>
              <div className="form-group"><label>Beleihungsauslauf (%)</label><input type="number" step="0.1" name="beleihung" defaultValue={offen.beleihung ?? ""} /></div>
            </div>

            <div className="form-section-label">Konditionen</div>
            <div className="form-row">
              <div className="form-group"><label>Zinssatz (% p.a.)</label><input type="number" step="0.01" name="zinssatz" defaultValue={offen.zinssatz ?? ""} /></div>
              <div className="form-group"><label>Tilgungssatz (% p.a.)</label><input type="number" step="0.01" name="tilgungssatz" defaultValue={offen.tilgungssatz ?? ""} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Monatliche Rate (€)</label><input type="number" step="0.01" name="monatsrate" defaultValue={offen.monatsrate ?? ""} /></div>
              <div className="form-group"><label>Sondertilgung möglich</label>
                <select name="sonder" defaultValue={offen.sonder ?? ""}>
                  {SONDER.map((s) => <option key={s} value={s}>{s || "Nicht bekannt"}</option>)}
                </select>
              </div>
            </div>

            <div className="form-section-label">Laufzeit &amp; Zinsbindung</div>
            <div className="form-row">
              <div className="form-group">
                <label>Vollständige Auszahlung am</label>
                <input type="date" name="auszahlung_datum" defaultValue={offen.auszahlung_datum ?? ""} />
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
                  Start für das Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB).</span>
              </div>
              <div className="form-group"><label>Zinsbindung bis</label><input type="date" name="zinsbindung" defaultValue={offen.zinsbindung ?? ""} /></div>
              <div className="form-group"><label>Gesamtlaufzeit bis (Jahr)</label><input type="number" name="laufzeit" defaultValue={offen.laufzeit ?? ""} /></div>
            </div>

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <DeleteButton action={deleteKredit.bind(null, offen.id)} className="btn btn-ghost" label="Löschen" confirmText={`„${offen.bezeichnung || "Darlehen"}" löschen?`} />
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </form>
        </RowDialog>
      )}
    </>
  );
}
