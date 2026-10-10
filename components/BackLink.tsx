"use client";

import { useRouter } from "next/navigation";

// Echter "Zurück"-Button: führt dorthin zurück, wo der Nutzer herkam
// (Einstellungen für Eingeloggte, Login für Ausgeloggte). Fällt auf /login
// zurück, wenn keine Historie vorhanden ist (z. B. Direktaufruf der Seite).
export default function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      className="zurueck-link"
    >
      ← Zurück
    </button>
  );
}
