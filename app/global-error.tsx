"use client";

// Äußerster Rahmen: greift, wenn ein Root-Layout selbst scheitert (Gesamtprüfung C56). Ersetzt das
// Layout ganz — deshalb eigenes <html>/<body> und eigenes Stylesheet.
import "./globals.css";
import FehlerSeite from "@/components/FehlerSeite";

export default function GlobalerFehler({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body>
        <FehlerSeite error={error} />
      </body>
    </html>
  );
}
