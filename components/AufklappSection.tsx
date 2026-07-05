"use client";

// Einklappbarer Inhalts-Abschnitt im .section-Stil: Kopfzeile klickbar,
// Body per display:none versteckt (bleibt gemountet, damit laufende
// Server-Actions im Inneren nicht abbrechen). Für Bereiche, die man selten
// braucht (z. B. wiederkehrende Buchungen verwalten).

import { useState, type ReactNode } from "react";

export default function AufklappSection({
  titel,
  untertitel,
  children,
  standardOffen = false,
}: {
  titel: string;
  untertitel?: string;
  children: ReactNode;
  standardOffen?: boolean;
}) {
  const [offen, setOffen] = useState(standardOffen);

  return (
    <div className="section mb-20">
      <div
        className="section-header"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setOffen((o) => !o)}
        role="button"
        aria-expanded={offen}
      >
        <div>
          <h3>{titel}</h3>
          {untertitel && (
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{untertitel}</span>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{offen ? "▲" : "▼"}</span>
      </div>
      <div className="section-body" style={{ display: offen ? "block" : "none" }}>
        {children}
      </div>
    </div>
  );
}
