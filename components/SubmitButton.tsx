"use client";

import { useFormStatus } from "react-dom";

// Submit-Button mit automatischem Pending-State: zeigt beim Abschicken einer
// Server-Action sofort „Speichert…" + Spinner und sperrt sich gegen Doppelklick.
// Muss als Kind eines <form action={...}> stehen.
export default function SubmitButton({
  children,
  className = "btn btn-gold",
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden /> {pendingLabel ?? "Speichert…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
