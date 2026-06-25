"use client";

import { useState, useTransition } from "react";

// Generischer Lösch-Button mit Inline-Bestätigung und Lade-Feedback.
// Erster Klick → Button verwandelt sich in „Wirklich? · Ja / Nein"; während
// die Server-Action läuft, zeigt er einen Spinner und sperrt sich gegen
// Doppelklick. Kein blockierender confirm()-Dialog mehr (mobilfreundlich).
export default function DeleteButton({
  action,
  label = "Löschen",
  confirmText = "Wirklich löschen?",
  className = "btn btn-ghost",
  title,
}: {
  action: () => void | Promise<void>;
  label?: React.ReactNode;
  confirmText?: string;
  className?: string;
  title?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (pending) {
    return (
      <button type="button" className={className} disabled aria-busy>
        <span className="spinner" aria-hidden /> Löscht…
      </button>
    );
  }

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{confirmText}</span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: "5px 10px", color: "var(--red)", borderColor: "var(--red)" }}
          onClick={() => startTransition(() => Promise.resolve(action()))}
        >
          Ja, löschen
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: "5px 10px" }}
          onClick={() => setConfirming(false)}
        >
          Abbrechen
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={className} title={title} onClick={() => setConfirming(true)}>
      {label}
    </button>
  );
}
