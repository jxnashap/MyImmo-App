"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

// Submit-Button mit automatischem Pending-State: zeigt beim Abschicken einer
// Server-Action sofort „Speichert…" + Spinner und sperrt sich gegen Doppelklick.
// Muss als Kind eines <form action={...}> stehen.
//
// Optional `erfolgLabel`: zeigt nach dem Absenden kurz eine Bestätigung im Knopf.
//
// Bewusst OPT-IN und nicht automatisch. Zwei Gründe:
//
// 1. Die meisten Actions dieser App enden mit `redirect(flashUrl(...))`. Dort
//    verschwindet der Knopf mit der Seite, und die Bestätigung kommt als Toast
//    auf der Zielseite — ein Erfolgs-Zustand im Knopf wäre nie zu sehen.
//    Sinnvoll ist er nur, wo die Action an derselben Stelle bleibt und nur
//    revalidiert (Wert aktualisieren, Inline-Zeilen in Listen).
//
// 2. Automatisch wäre es sogar falsch: Erkennen ließe sich nur der Übergang
//    „pending true → false". Den macht eine FEHLGESCHLAGENE Action genauso.
//    Der Knopf würde dann „Gespeichert" behaupten, obwohl nichts gespeichert
//    wurde — schlechter als gar keine Rückmeldung. Nur der aufrufende Code
//    weiß, ob seine Action bei Fehlern wirft (Error-Boundary) oder still
//    zurückkehrt; deshalb entscheidet er.
export default function SubmitButton({
  children,
  className = "btn btn-gold",
  pendingLabel,
  erfolgLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  /** z. B. "Gespeichert" — nur setzen, wenn die Action auf der Seite bleibt. */
  erfolgLabel?: string;
}) {
  const { pending } = useFormStatus();
  const [erfolg, setErfolg] = useState(false);
  const warPending = useRef(false);

  useEffect(() => {
    if (!erfolgLabel) return;
    // Flanke true → false: das Absenden ist durch, und diese Komponente lebt
    // noch (bei einem Redirect wäre sie längst unmounted).
    const flanke = warPending.current && !pending;
    warPending.current = pending;
    if (flanke) {
      setErfolg(true);
      const t = setTimeout(() => setErfolg(false), 1800);
      return () => clearTimeout(t);
    }
  }, [pending, erfolgLabel]);

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      // Der Wechsel auf „Gespeichert" muss auch ohne Blick auf den Knopf
      // ankommen — sonst bekommt ihn niemand mit, der einen Screenreader nutzt.
      aria-live="polite"
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden /> {pendingLabel ?? "Speichert…"}
        </>
      ) : erfolg ? (
        <>
          <Check size={14} aria-hidden /> {erfolgLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
