"use client";

// Einklappbarer Formularbereich: standardmäßig zu, öffnet per Button.
// Ein Submit innerhalb (Server-Action-Form) klappt den Bereich wieder zu.

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

export default function AufklappForm({ label, children }: { label: ReactNode; children: ReactNode }) {
  const [offen, setOffen] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        type="button"
        className={offen ? "btn btn-ghost" : "btn btn-gold"}
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
      >
        {offen ? <><X size={14} style={{ verticalAlign: "-2px" }} /> Schließen</> : label}
      </button>
      {/* Immer gemountet, nur versteckt: Ein Unmount beim Submit würde die
          laufende Server-Action des Formulars abbrechen. */}
      <div
        className={offen ? "fade-up" : undefined}
        style={{ marginTop: 12, display: offen ? "block" : "none" }}
        onSubmitCapture={() => setOffen(false)}
      >
        {children}
      </div>
    </div>
  );
}
