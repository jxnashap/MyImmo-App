"use client";

import { useEffect } from "react";

// Deutsche Fehlerseite für die öffentliche Strecke und den äußersten Rahmen (Gesamtprüfung C56).
// Vorher zeigte ein Ladefehler auf /preise die englische Standardseite von Next („This page couldn’t
// load“). Häufigste Ursache auf öffentlichen Seiten: ein neues Deployment, während die Seite offen
// war — die alten Skriptteile gibt es dann nicht mehr. Dagegen hilft nur ein echtes Neuladen, kein
// `reset()`; deshalb ist „Neu laden“ der erste Knopf, und der Rückweg ist ein einfacher Link (kein
// <Link>, der selbst Skriptteile nachladen müsste).
export const FEHLER_TITEL = "Diese Seite ließ sich nicht laden";

export default function FehlerSeite({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ marginBottom: 22 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 30 }}>
            My<em style={{ color: "var(--gold)" }}>Immo</em>
          </span>
        </div>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: "var(--r-lg, 24px)", padding: "32px 28px" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{FEHLER_TITEL}</h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            Meist hilft es, die Seite neu zu laden — zum Beispiel, wenn MyImmo gerade aktualisiert wurde.
            Tritt der Fehler wieder auf, geht es über die Startseite weiter.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-gold" onClick={() => window.location.reload()}>
              Neu laden
            </button>
            {/* Bewusst kein <Link>: Nach einem neuen Deployment fehlen genau die Skriptteile, die er nachladen müsste. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- harte Navigation gewollt, siehe oben */}
            <a href="/" className="btn btn-ghost">Zur Startseite</a>
          </div>
          {error.digest && <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)" }}>Fehler-ID: {error.digest}</div>}
        </div>
      </div>
    </div>
  );
}
