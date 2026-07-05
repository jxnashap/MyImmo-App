"use client";

// Einklappbarer Formularbereich: standardmäßig zu, öffnet per Button.
// Ein Submit innerhalb (Server-Action-Form) klappt den Bereich wieder zu.

import { useState, type ReactNode } from "react";

export default function AufklappForm({ label, children }: { label: string; children: ReactNode }) {
  const [offen, setOffen] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        type="button"
        className={offen ? "btn btn-ghost" : "btn btn-gold"}
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
      >
        {offen ? "✕ Schließen" : label}
      </button>
      {offen && (
        <div className="fade-up" style={{ marginTop: 12 }} onSubmitCapture={() => setOffen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
