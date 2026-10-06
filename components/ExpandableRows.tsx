"use client";

import { Children, useState } from "react";

// Zeigt in einer Tabelle nur die ersten `limit` Zeilen; der Rest lässt sich
// per Button auf-/zuklappen. Erwartet die <tr>-Zeilen als children und rendert
// selbst das <tbody>. `cols` = Spaltenzahl für die Button-Zeile.
export default function ExpandableRows({
  children,
  cols,
  limit = 25,
  label = "weitere",
}: {
  children: React.ReactNode;
  cols: number;
  limit?: number;
  label?: string;
}) {
  const rows = Children.toArray(children);
  const [open, setOpen] = useState(false);
  const hidden = rows.length - limit;
  const visible = open ? rows : rows.slice(0, limit);

  return (
    <tbody>
      {visible}
      {hidden > 0 && (
        <tr className="no-hover">
          <td colSpan={cols} style={{ textAlign: "center", paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            {/* Am Handy ist die Tabelle breiter als der Bildschirm (min-width 560 px) — der Knopf
                bleibt angeheftet und in der SICHTBAREN Breite zentriert, statt rechts abgeschnitten
                zu werden. Auf dem Desktop ist die Zelle schmaler als der Bildschirm: unverändert. */}
            <div style={{ position: "sticky", left: 0, width: "min(100%, calc(100vw - 72px))" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>
                {open ? "▴ Weniger anzeigen" : `▾ ${hidden} ${label} anzeigen`}
              </button>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}
