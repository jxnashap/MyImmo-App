"use client";

import { useEffect } from "react";

// Verknüpft Beschriftungen mit ihren Eingabefeldern (label[for] ↔ control[id]).
//
// Ausgangslage: Die App hat rund 330 Felder im Muster
//   <div className="form-group"><label>Kaltmiete</label><input name="…" /></div>
// — KEINES davon hatte htmlFor/id oder ein aria-label. Screenreader sagen dort
// nur „Eingabefeld, leer" an, und ein Klick auf die Beschriftung fokussiert
// nichts (WCAG 1.3.1, 3.3.2, 4.1.2).
//
// Warum zentral und nicht 330-mal von Hand:
// Das Markup ist zu uneinheitlich für einen sicheren Codemod (einzeilig,
// mehrzeilig, Labels mit eigenen Styles, Felder ohne name-Attribut), und
// 330 Einzeländerungen könnten beim nächsten neuen Formular sofort wieder
// auseinanderlaufen. Diese Komponente hängt einmal im Layout, verknüpft alles
// Vorhandene und über einen MutationObserver auch alles, was später dazukommt
// (Dialoge, nachgeladene Formulare) — neue Felder sind damit automatisch
// korrekt beschriftet.
//
// Ehrliche Einordnung: Serverseitig gerendertes htmlFor wäre der sauberere Weg,
// weil die Verknüpfung dann schon im HTML steht. Die eingeloggte App ist aber
// ohnehin auf JavaScript angewiesen, und dieser Weg deckt zuverlässig ALLE
// Felder ab statt nur der gut greifbaren Hälfte.

let zaehler = 0;

function verknuepfe(wurzel: ParentNode) {
  const labels = wurzel.querySelectorAll<HTMLLabelElement>("label:not([for])");
  labels.forEach((label) => {
    // Umschließt das Label sein Feld bereits, ist die Verknüpfung implizit da.
    if (label.querySelector("input, select, textarea")) return;

    const eltern = label.parentElement;
    if (!eltern) return;

    // Das zugehörige Feld ist das erste Bedienelement NACH dem Label im selben
    // Container. Versteckte Felder und solche mit eigenem Label werden
    // übersprungen.
    const kandidaten = Array.from(
      eltern.querySelectorAll<HTMLElement>("input, select, textarea"),
    ).filter((el) => {
      if (el instanceof HTMLInputElement && el.type === "hidden") return false;
      // Nur Felder, die hinter dem Label stehen und keinem anderen Label gehören.
      return label.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
    });

    const feld = kandidaten[0];
    if (!feld) return;
    // Gehört das Feld schon zu einer anderen Beschriftung? Dann Finger weg.
    if (feld.id && wurzel.querySelector(`label[for="${CSS.escape(feld.id)}"]`)) return;

    if (!feld.id) feld.id = `mi-feld-${++zaehler}`;
    label.htmlFor = feld.id;
  });
}

export default function LabelVerknuepfung() {
  useEffect(() => {
    verknuepfe(document);

    // Nachgeladene Formulare (Dialoge, aufgeklappte Bereiche) mitnehmen.
    let geplant = 0;
    const beobachter = new MutationObserver(() => {
      if (geplant) return;
      geplant = requestAnimationFrame(() => {
        geplant = 0;
        verknuepfe(document);
      });
    });
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (geplant) cancelAnimationFrame(geplant);
      beobachter.disconnect();
    };
  }, []);

  return null;
}
