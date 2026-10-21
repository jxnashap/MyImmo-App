"use client";
import Link from "next/link";

// Globaler Error-Boundary: fängt geworfene Fehler in allen Seiten/Server-Actions
// ab und zeigt eine lesbare Karte statt des schwarzen "Application error"-Screens.
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Für die Server-Logs / spätere Fehlersuche
    console.error(error);
  }, [error]);

  return (
    <div className="fade-up" style={{ display: "flex", justifyContent: "center", padding: "48px 16px" }}>
      <div className="form-box" style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ marginBottom: 8 }}><TriangleAlert size={40} color="var(--amber)" /></div>
        <h3 style={{ marginBottom: 8 }}>Etwas ist schiefgelaufen</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
          Die Seite konnte nicht vollständig geladen oder die Aktion nicht abgeschlossen werden —
          unvollständige Zahlen zeigen wir bewusst nicht an. Meist hilft „Erneut versuchen“. Wurde
          MyImmo gerade aktualisiert, hilft nur „Neu laden“.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-gold" onClick={() => reset()}>
            Erneut versuchen
          </button>
          {/* Nach einem neuen Deployment fehlen die alten Skriptteile — dagegen hilft nur ein echtes Neuladen. */}
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
            Neu laden
          </button>
          <Link href="/" className="btn btn-ghost">Zur Startseite</Link>
        </div>
        {error.digest && (
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)" }}>Fehler-ID: {error.digest}</div>
        )}
      </div>
    </div>
  );
}
