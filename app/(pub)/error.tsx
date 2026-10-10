"use client";

// Fehlerseite der öffentlichen Strecke (Gesamtprüfung C56) — vorher die englische Standardseite.
import FehlerSeite from "@/components/FehlerSeite";

export default function Fehler({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return <FehlerSeite error={error} />;
}
