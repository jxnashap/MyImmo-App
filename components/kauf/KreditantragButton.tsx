"use client";

import { FileText } from "lucide-react";
import { KAUF_AUSWAHL_KEY } from "@/lib/kauf/auswahl";
import { KAUF_DARLEHEN_KEY } from "@/lib/kauf/darlehen";

// Öffnet den Kreditantrag als PDF in einem neuen Tab.
//
// Bewusst per ECHTEM Formular-POST statt fetch()+window.open(blobURL):
// 1. window.open nach einem await liegt außerhalb der Nutzergeste und wird
//    vom Popup-Blocker verworfen — der Knopf tat scheinbar nichts.
// 2. Ein blob:-Dokument erbt die CSP der App; mit "object-src 'none'" und
//    ohne blob: in default-src blockt sie den PDF-Viewer.
// Die Formular-Navigation ist dagegen von "form-action 'self'" gedeckt und
// entspricht dem Muster der übrigen PDF-Exporte (Jahresbericht, Anlage V).
// Die Objekt-/Darlehensdaten liegen nur im localStorage, deshalb POST statt
// GET — sie werden beim Absenden in ein verstecktes Feld geschrieben.

function lies(key: string): unknown {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}

export default function KreditantragButton() {
  return (
    <form
      action="/api/kauf/kreditantrag"
      method="POST"
      target="_blank"
      rel="noopener"
      onSubmit={(e) => {
        const feld = e.currentTarget.elements.namedItem("daten") as HTMLInputElement | null;
        if (feld) {
          feld.value = JSON.stringify({ auswahl: lies(KAUF_AUSWAHL_KEY), darlehen: lies(KAUF_DARLEHEN_KEY) });
        }
      }}
      style={{ display: "inline-flex" }}
    >
      <input type="hidden" name="daten" defaultValue="" />
      <button type="submit" className="btn btn-gold" style={{ fontSize: 13 }}>
        <FileText size={14} style={{ verticalAlign: "-2px" }} /> Kreditantrag / Selbstauskunft als PDF
      </button>
    </form>
  );
}
