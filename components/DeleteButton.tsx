"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";

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
  const toast = useToast();

  const run = () =>
    startTransition(async () => {
      try {
        await action();
        toast("Gelöscht.", "success");
      } catch (e) {
        // Framework-Navigation (redirect/notFound) durchreichen, nicht als Fehler zeigen.
        const digest = (e as { digest?: string })?.digest ?? "";
        if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
        toast(`Löschen fehlgeschlagen: ${(e as Error)?.message ?? "Fehler"}`, "error");
        setConfirming(false);
      }
    });

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
          onClick={run}
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
