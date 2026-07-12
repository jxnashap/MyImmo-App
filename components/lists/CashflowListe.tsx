"use client";
import { FileText, Image as ImageIcon, Banknote } from "lucide-react";

// Chronologische Merge-Tabelle für die „Alle"-Ansicht auf /cashflow:
// Einnahmen + Ausgaben in EINER Liste (neueste zuerst), Zeilenklick öffnet
// den Bearbeiten-Dialog (RowDialog + BuchungForm, kein neues Edit-Markup).

import { useState } from "react";
import { euro, datum } from "@/lib/format";
import ExpandableRows from "@/components/ExpandableRows";
import RowDialog from "@/components/RowDialog";
import BuchungForm, { type BuchungRow } from "@/components/BuchungForm";
import BelegFreigabeToggle from "@/components/BelegFreigabeToggle";
import type { Einnahme, Kosten, Property, Tenant } from "@/lib/types";

type Row = BuchungRow & { typ: "einnahme" | "ausgabe" };

export default function CashflowListe({
  einnahmen,
  kosten,
  properties,
  tenants,
}: {
  einnahmen: Einnahme[];
  kosten: Kosten[];
  properties: Pick<Property, "id" | "bezeichnung">[];
  tenants: Pick<Tenant, "id" | "vorname" | "nachname">[];
}) {
  const [open, setOpen] = useState<Row | null>(null);
  const nameOf = new Map(properties.map((p) => [p.id, p.bezeichnung] as const));

  const rows: Row[] = [
    ...einnahmen.map((e): Row => ({ typ: "einnahme", ...e })),
    ...kosten.map((k): Row => ({ typ: "ausgabe", ...k })),
  ].sort((a, b) => (b.buchungsdatum || "").localeCompare(a.buchungsdatum || ""));

  return (
    <table className="list-table">
      <thead>
        <tr><th>Datum</th><th>Typ</th><th>Immobilie</th><th>Kategorie</th><th>Beschreibung</th><th>Beleg</th><th>Betrag</th></tr>
      </thead>
      <ExpandableRows cols={7} limit={12} label="weitere Buchungen">
        {rows.map((r) => {
          const istEin = r.typ === "einnahme";
          return (
            <tr
              key={`${r.typ}-${r.id}`}
              className="row-click"
              tabIndex={0}
              role="button"
              aria-label={istEin ? "Einnahme bearbeiten" : "Ausgabe bearbeiten"}
              onClick={() => setOpen(r)}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpen(r); } }}
            >
              <td>{datum(r.buchungsdatum)}</td>
              <td><span className={`badge ${istEin ? "badge-green" : "badge-red"}`}>{istEin ? "Einnahme" : "Ausgabe"}</span></td>
              <td style={{ color: "var(--muted)" }}>{r.prop_id ? nameOf.get(r.prop_id) ?? "–" : "–"}</td>
              <td>{r.kategorie ? <span className={`badge ${istEin ? "badge-green" : "badge-red"}`}>{r.kategorie}</span> : "–"}</td>
              <td style={{ color: "var(--muted)" }}>{r.beschreibung ?? ""}</td>
              <td>
                {!istEin && r.rechnung_name ? (
                  <span onClick={(ev) => ev.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <a
                      href={`/kosten/${r.id}/rechnung`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--gold)", fontSize: 12, textDecoration: "none" }}
                      title={r.rechnung_name}
                    >
                      {r.rechnung_name.toLowerCase().endsWith(".pdf") ? <FileText size={13} style={{ verticalAlign: "-2px" }} /> : <ImageIcon size={13} style={{ verticalAlign: "-2px" }} />} ansehen
                    </a>
                    <BelegFreigabeToggle kostenId={r.id} freigegeben={(r as unknown as Kosten).mieter_freigabe === true} />
                  </span>
                ) : (
                  <span style={{ color: "var(--faint)" }}>–</span>
                )}
              </td>
              <td style={{ fontWeight: 600, color: istEin ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }}>
                {istEin ? "+ " : "− "}{euro(r.betrag)}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr><td colSpan={7}><div className="empty"><Banknote className="empty-icon" size={36} color="var(--faint)" /><h4>Noch keine Buchungen</h4><p>Erfasse Einnahmen und Ausgaben über „＋ Buchung".</p></div></td></tr>
        )}
      </ExpandableRows>

      {open && (
        <RowDialog title={open.typ === "einnahme" ? "Einnahme bearbeiten" : "Ausgabe bearbeiten"} onClose={() => setOpen(null)}>
          <BuchungForm
            typInitial={open.typ}
            row={open}
            properties={properties}
            tenants={tenants}
            back="/cashflow"
            imDialog
          />
        </RowDialog>
      )}
    </table>
  );
}
