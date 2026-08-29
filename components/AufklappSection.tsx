"use client";

// Einklappbarer Inhalts-Abschnitt im .section-Stil: Kopfzeile klickbar,
// Body per display:none versteckt (bleibt gemountet, damit laufende
// Server-Actions im Inneren nicht abbrechen). Für Bereiche, die man selten
// braucht (z. B. wiederkehrende Buchungen verwalten).

import { useState, type ReactNode } from "react";
import { tastaturAktion } from "@/lib/a11y";

export default function AufklappSection({
  titel,
  untertitel,
  children,
  standardOffen = false,
}: {
  titel: ReactNode;
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
        tabIndex={0}
        aria-expanded={offen}
        onKeyDown={tastaturAktion(() => setOffen((o) => !o))}
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
