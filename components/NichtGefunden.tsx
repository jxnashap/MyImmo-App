import Link from "next/link";

// Gemeinsame 404-Darstellung fuer beide Root-Layouts (App und oeffentliche
// Strecke). Selbsttragend, ohne Sidebar-Annahmen — fuer ein- wie ausgeloggte
// Besucher gleich.
export default function NichtGefunden() {
  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ marginBottom: 22 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 30 }}>
            My<em style={{ color: "var(--gold)" }}>Immo</em>
          </span>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)", marginTop: 2 }}>
            PRIVATES IMMOBILIEN-MANAGEMENT
          </div>
        </div>

        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg, 24px)",
            padding: "32px 28px",
          }}
        >
          <div style={{ fontSize: 46, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>404</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "14px 0 8px" }}>Seite nicht gefunden</h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            Diese Seite gibt es nicht (mehr) oder der Link ist unvollständig. Prüfe die Adresse
            oder geh zurück zur Übersicht.
          </p>
          <Link href="/" className="btn btn-gold" style={{ fontSize: 13 }}>
            Zur Startseite
          </Link>
        </div>

        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 16 }}>
          Kam der Link aus einer E-Mail (Bewerbung, Bank-Freigabe, Auftrag)? Dann ist er
          eventuell abgelaufen — bitte beim Absender einen neuen anfordern.
        </p>
      </div>
    </div>
  );
}
