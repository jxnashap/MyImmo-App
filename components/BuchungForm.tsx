"use client";
import { Wallet, ClipboardList } from "lucide-react";

// Gemeinsames Buchungs-Formular für Einnahmen UND Ausgaben (Neu + Bearbeiten).
// Neu: Segmented-Umschalter Einnahme/Ausgabe; Bearbeiten: Typ fix (row gesetzt).
// Nutzt die bestehenden Server-Actions unverändert.

import { useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import {
  createEinnahme,
  createKosten,
  updateEinnahme,
  updateKosten,
  deleteEinnahme,
  deleteKosten,
} from "@/lib/actions/buchungen";
import type { Property, Tenant } from "@/lib/types";

const EIN_KAT = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"];
const AUS_KAT = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

// Vereinigte Zeile (Einnahme ∪ Kosten) fürs Bearbeiten.
export type BuchungRow = {
  id: string;
  prop_id: string | null;
  mieter_id: string | null;
  buchungsdatum: string | null;
  kategorie: string | null;
  betrag: number | null;
  beschreibung: string | null;
  nk_anteil?: number | null;
  rechnung_name?: string | null;
};

export default function BuchungForm({
  properties,
  tenants,
  back = "/cashflow",
  typInitial = "einnahme",
  propInitial = "",
  row,
  imDialog = false,
}: {
  properties: Pick<Property, "id" | "bezeichnung">[];
  tenants: Pick<Tenant, "id" | "vorname" | "nachname">[];
  back?: string;
  typInitial?: "einnahme" | "ausgabe";
  propInitial?: string;
  row?: BuchungRow;
  // Im RowDialog eingebettet: flache Optik, Titel kommt vom Dialog.
  imDialog?: boolean;
}) {
  const [typ, setTyp] = useState<"einnahme" | "ausgabe">(typInitial);
  const isEdit = !!row;

  const action = isEdit
    ? typ === "einnahme"
      ? updateEinnahme.bind(null, row.id)
      : updateKosten.bind(null, row.id)
    : typ === "einnahme"
      ? createEinnahme
      : createKosten;

  const KAT = typ === "einnahme" ? EIN_KAT : AUS_KAT;

  return (
    <form action={action} className="form-box" style={imDialog ? { padding: 0, border: "none", background: "none", maxWidth: "none" } : undefined}>
      {!imDialog && (
        <>
          <h3>{isEdit ? "Buchung bearbeiten" : "Neue Buchung"}</h3>
          <p>{typ === "einnahme" ? "Miete und sonstige Erträge" : "Kosten und Ausgaben"}</p>
        </>
      )}

      {!isEdit && (
        <div className="settings-tabs" style={{ marginBottom: 14, position: "static" }}>
          <button
            type="button"
            className={`settings-tab${typ === "einnahme" ? " active" : ""}`}
            style={typ === "einnahme" ? { color: "var(--green)", background: "var(--green-dim)" } : undefined}
            onClick={() => setTyp("einnahme")}
          >
            <Wallet size={14} style={{ verticalAlign: "-2px" }} /> Einnahme
          </button>
          <button
            type="button"
            className={`settings-tab${typ === "ausgabe" ? " active" : ""}`}
            style={typ === "ausgabe" ? { color: "var(--red)", background: "var(--red-dim)" } : undefined}
            onClick={() => setTyp("ausgabe")}
          >
            <ClipboardList size={14} style={{ verticalAlign: "-2px" }} /> Ausgabe
          </button>
        </div>
      )}

      <input type="hidden" name="back" value={back} />

      <div className="form-row">
        <div className="form-group">
          <label>Datum *</label>
          <input type="date" name="buchungsdatum" required defaultValue={row?.buchungsdatum ?? ""} />
        </div>
        <div className="form-group">
          <label>Immobilie *</label>
          <select name="prop_id" required defaultValue={row?.prop_id ?? propInitial}>
            <option value="">— wählen —</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Kategorie</label>
          {/* key erzwingt frisches defaultValue beim Typwechsel */}
          <select key={typ} name="kategorie" defaultValue={row?.kategorie ?? (typ === "einnahme" ? "Miete" : "Reparatur")}>
            {KAT.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Betrag (€) *</label>
          <input type="number" step="0.01" min="0.01" name="betrag" required defaultValue={row?.betrag ?? ""} placeholder="1200" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Mieter</label>
          <select name="mieter_id" defaultValue={row?.mieter_id ?? ""}>
            <option value="">– Kein Mieter –</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—"}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Beschreibung</label>
          <input type="text" name="beschreibung" defaultValue={row?.beschreibung ?? ""} placeholder={typ === "einnahme" ? "z.B. Miete August" : "z.B. Handwerkerrechnung"} />
        </div>
      </div>

      {typ === "einnahme" && (
        <div className="form-row">
          <div className="form-group">
            <label>davon Nebenkosten-Vorauszahlung (€)</label>
            <input type="number" step="0.01" min="0" name="nk_anteil" defaultValue={row?.nk_anteil ?? ""} placeholder="z.B. 160" />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              In „Miete" enthalten – Anlage V Zeile 13.
            </span>
          </div>
          <div className="form-group" />
        </div>
      )}

      {typ === "ausgabe" && (
        <div className="form-row">
          <div className="form-group">
            <label>Rechnung / Beleg (PDF/Bild · max. 15 MB)</label>
            {isEdit && row?.rechnung_name && (
              <a
                href={`/kosten/${row.id}/rechnung`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "var(--gold)", display: "block", marginBottom: 6 }}
              >
                Aktuell: {row.rechnung_name}
              </a>
            )}
            <input type="file" name="rechnung" accept="application/pdf,image/*" />
          </div>
          <div className="form-group" />
        </div>
      )}

      <div className="form-actions">
        {isEdit && (
          <DeleteButton
            action={typ === "einnahme" ? deleteEinnahme.bind(null, row.id) : deleteKosten.bind(null, row.id)}
            className="btn btn-ghost"
            label="Löschen"
            confirmText="Diese Buchung löschen?"
          />
        )}
        <SubmitButton>Speichern</SubmitButton>
      </div>
    </form>
  );
}
