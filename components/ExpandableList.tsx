"use client";

import { Children, isValidElement, useState } from "react";

// Wie ExpandableRows, aber für freie Listen (keine Tabelle): zeigt die ersten
// `limit` Einträge; der Rest lässt sich per Button auf-/zuklappen.
//
// Überschriften zwischen den Einträgen (Monat, „Überfällig“) tragen `data-kopf` und zählen
// NICHT mit (Gesamtprüfung C5): Vorher zeigte /termine 9 statt 12 Termine und meldete
// „21 weitere“, obwohl 16 verborgen waren. Eine Überschrift ohne sichtbaren Eintrag darunter
// bleibt verborgen, bis aufgeklappt wird.
export function istKopf(el: React.ReactNode): boolean {
  return isValidElement<{ "data-kopf"?: unknown }>(el) && Boolean(el.props["data-kopf"]);
}

/** Wie viele Kinder zu sehen sind und wie viele EINTRÄGE verborgen bleiben. Rein, für den Test. */
export function aufteilen(items: React.ReactNode[], limit: number): { ende: number; verborgen: number } {
  let gezeigt = 0;
  let ende = items.length;
  for (let i = 0; i < items.length; i++) {
    if (istKopf(items[i])) continue;
    if (gezeigt === limit) {
      ende = i;
      break;
    }
    gezeigt++;
  }
  while (ende > 0 && ende < items.length && istKopf(items[ende - 1])) ende--;
  const eintraege = items.filter((x) => !istKopf(x)).length;
  return { ende, verborgen: eintraege - gezeigt };
}

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
  const { ende, verborgen } = aufteilen(items, limit);
  const visible = open ? items : items.slice(0, ende);

  return (
    <>
      {visible}
      {verborgen > 0 && (
        <div style={{ textAlign: "center", paddingTop: 14 }}>
          <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "▴ Weniger anzeigen" : `▾ ${verborgen} ${label} anzeigen`}
          </button>
        </div>
      )}
    </>
  );
}
