import { Mail, Clock, ListChecks } from "lucide-react";

// Support-Inhalt an EINER Stelle. Genutzt vom Einstellungen-Tab „Hilfe" und
// von der Route /hilfe (Direktlink, z. B. aus einer E-Mail).
//
// Die zugesagte Frist ist eine Zusage an den Nutzer: wird sie geaendert,
// gehoert sie hier UND in die AGB angeglichen.

export const SUPPORT_MAIL = "info@myimmoapp.de";

export default function HilfeInhalt() {
  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        MyImmo ist im Early Access. Wenn etwas nicht funktioniert, unklar ist oder
        fehlt: bitte melden — Rückmeldungen aus dieser Phase fließen direkt in die
        nächste Version.
      </p>

      <div className="section" style={{ marginTop: 20 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
          <Mail size={16} /> So erreichst du uns
        </h2>
        <p style={{ marginTop: 8 }}>
          Schreib eine E-Mail an{" "}
          <a href={`mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent("MyImmo — Rückmeldung")}`} style={{ color: "var(--gold)" }}>
            {SUPPORT_MAIL}
          </a>
          .
        </p>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
          <Clock size={16} /> Wie schnell wir antworten
        </h2>
        <p style={{ marginTop: 8 }}>
          Werktags <strong>innerhalb von 24 Stunden</strong>. An Wochenenden und
          Feiertagen kann es länger dauern. Geht etwas gar nicht mehr — du kommst
          nicht in dein Konto oder Daten fehlen — schreib{" "}
          <strong>„dringend"</strong> in den Betreff.
        </p>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
          <ListChecks size={16} /> Was uns hilft, schnell zu antworten
        </h2>
        <ul style={{ listStyle: "disc", paddingLeft: 20, marginTop: 8, lineHeight: 1.7 }}>
          <li>Auf welcher Seite ist es passiert?</li>
          <li>Was hast du gemacht, und was ist stattdessen passiert?</li>
          <li>Ein Screenshot, wenn möglich.</li>
          <li>Handy oder Computer, und welcher Browser?</li>
        </ul>
        <p className="hint" style={{ marginTop: 12 }}>
          Bitte keine Passwörter mitschicken — wir fragen nie danach.
        </p>
      </div>
    </div>
  );
}
