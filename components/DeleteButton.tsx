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
    // Layout muss mit KURZEN (Tabellenzeile) und LANGEN Bestätigungstexten
    // (Objekt löschen: „… wirklich löschen? Damit werden auch 9 Einnahmen …")
    // klarkommen. Vorher lag alles in EINER inline-flex-Zeile: auf dem Handy
    // quetschte der lange Text die Knöpfe, „Ja, löschen“ brach mitten im Wort
    // auf zwei Zeilen. Jetzt darf der Block umbrechen (flex-wrap), die beiden
    // Knöpfe bleiben als Einheit zusammen und brechen NICHT mehr um (nowrap).
    return (
      <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "8px 6px", maxWidth: "100%" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{confirmText}</span>
        <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "5px 10px", color: "var(--red)", borderColor: "var(--red)", whiteSpace: "nowrap" }}
            onClick={run}
          >
            Ja, löschen
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "5px 10px", whiteSpace: "nowrap" }}
            onClick={() => setConfirming(false)}
          >
            Abbrechen
          </button>
        </span>
      </span>
    );
  }

  // Zugänglicher Name: Viele Aufrufer übergeben als `label` nur ein Icon
  // (`<X size={14} />`). Lucide-SVGs sind `aria-hidden`, der Button hatte damit
  // GAR KEINEN Namen — Screenreader lasen bloß „Schaltfläche", und per Tastatur
  // war nicht erkennbar, was gelöscht wird. Ist kein `title` gesetzt und das
  // Label kein Text, dient der (ohnehin beschreibende) Bestätigungstext als
  // Name, z. B. „Darlehen XY löschen?".
  const zugaenglicherName = title ?? (typeof label === "string" ? undefined : confirmText);

  return (
    <button
      type="button"
      className={className}
      title={zugaenglicherName}
      aria-label={zugaenglicherName}
      onClick={() => setConfirming(true)}
    >
      {label}
    </button>
  );
}
