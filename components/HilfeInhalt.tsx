import { Mail, Clock, ListChecks, ArrowRight } from "lucide-react";

// Support-Inhalt an EINER Stelle. Genutzt vom Einstellungen-Tab „Support" und
// von der Route /hilfe (Direktlink, z. B. aus einer E-Mail).
//
// Die zugesagte Frist ist eine Zusage an den Nutzer: wird sie geaendert,
// gehoert sie hier UND in die AGB angeglichen.
//
// Aufbau bewusst wie ueberall sonst in der App: `.section` mit
// `.section-header` (h3 + Icon 14px) und `.section-body`. Vorher standen die
// Ueberschriften roh in der Karte — ohne Kopfzeile, ohne Innenabstand und mit
// eigenen Schriftgroessen. Das war die einzige Stelle, die aus dem Raster fiel.

export const SUPPORT_MAIL = "info@myimmoapp.de";

const BETREFF = encodeURIComponent("MyImmo — Rückmeldung");

export default function HilfeInhalt() {
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="section">
        <div className="section-header">
          {/* section-sub ist GESCHWISTER von h3, nicht Kind: `.section-header h3`
              ist ein Flex-Container — darin gesetzt landete der Untertitel
              neben der Überschrift statt darunter. */}
          <div>
            <h3>
              <Mail size={14} /> So erreichst du uns
            </h3>
            <div className="section-sub">Eine E-Mail genügt — kein Formular, kein Ticketsystem.</div>
          </div>
        </div>
        <div className="section-body">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--muted)" }}>
            MyImmo ist im Early Access. Wenn etwas nicht funktioniert, unklar ist oder fehlt:
            bitte melden — Rückmeldungen aus dieser Phase fließen direkt in die nächste Version.
          </p>
          <a
            href={`mailto:${SUPPORT_MAIL}?subject=${BETREFF}`}
            className="btn btn-gold"
            style={{ marginTop: 14 }}
          >
            {SUPPORT_MAIL} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
          </a>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3>
            <Clock size={14} /> Wie schnell wir antworten
          </h3>
        </div>
        <div className="section-body">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--muted)" }}>
            Werktags <strong style={{ color: "var(--text)" }}>innerhalb von 24 Stunden</strong>. An
            Wochenenden und Feiertagen kann es länger dauern. Geht etwas gar nicht mehr — du kommst
            nicht in dein Konto oder Daten fehlen — schreib{" "}
            <strong style={{ color: "var(--text)" }}>„dringend"</strong> in den Betreff.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3>
            <ListChecks size={14} /> Was uns hilft, schnell zu antworten
          </h3>
        </div>
        <div className="section-body">
          <ul
            style={{
              listStyle: "disc",
              paddingLeft: 20,
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.8,
              color: "var(--muted)",
            }}
          >
            <li>Auf welcher Seite ist es passiert?</li>
            <li>Was hast du gemacht, und was ist stattdessen passiert?</li>
            <li>Ein Screenshot, wenn möglich.</li>
            <li>Handy oder Computer, und welcher Browser?</li>
          </ul>
          <p className="hint" style={{ marginTop: 14 }}>
            Bitte keine Passwörter mitschicken — wir fragen nie danach.
          </p>
        </div>
      </div>
    </div>
  );
}
