"use client";

import { Children, useState } from "react";

// Wie ExpandableRows, aber für freie Listen (keine Tabelle): zeigt die ersten
// `limit` Kinder; der Rest lässt sich per Button auf-/zuklappen.
export default function ExpandableList({
  children,
  limit = 10,
  label = "weitere",
}: {
  children: React.ReactNode;
  limit?: number;
  label?: string;
}) {
  const items = Children.toArray(children);
  const [open, setOpen] = useState(false);
  const hidden = items.length - limit;
  const visible = open ? items : items.slice(0, limit);

  return (
    <>
      {visible}
      {hidden > 0 && (
        <div style={{ textAlign: "center", paddingTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "▴ Weniger anzeigen" : `▾ ${hidden} ${label} anzeigen`}
          </button>
        </div>
      )}
    </>
  );
}
