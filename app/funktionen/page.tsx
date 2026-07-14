import type { Metadata } from "next";
import LandingShell from "@/components/landing/Shell";
import Reveal from "@/components/landing/Reveal";
import Tilt from "@/components/landing/Tilt";
import { FEATURES, ROLLEN, SOON_BADGE, Shot } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Funktionen — MyImmo",
  description:
    "Alle MyImmo-Funktionen: Nebenkostenabrechnung, Anlage V & ELSTER, Mieterportal, Service-Aufträge, Banking-Anbindung, Kredite, Dokumente und mehr.",
};

export default function FunktionenPage() {
  return (
    <LandingShell aktiv="/funktionen">
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Funktionen</div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Alles, was Vermieten verlangt</h1>
          <p className="lp-section-sub">Vom ersten Mietvertrag bis zur Anlage V — inklusive Mieterportal, Team-Rollen und Banking-Anbindung.</p>
          <div className="lp-features">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 4) * 60}>
                <Tilt>
                  <div className="lp-feature" style={{ height: "100%" }}>
                    <div className="ico">{f.ico ? <f.ico size={20} /> : "§"}</div>
                    <h3>{f.t}{f.soon ? SOON_BADGE : null}</h3>
                    <p>{f.p}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="lp-split">
              <div>
                <h3>Mieterportal: dein Posteingang statt Anrufe</h3>
                <p>Mieter bekommen einen eigenen Zugang und melden alles digital — du behältst den Überblick, dein Hausmeister übernimmt vor Ort.</p>
                <ul>
                  <li>Schadensmeldungen mit Foto, Anliegen & Dokument-Anfragen</li>
                  <li>Zählerstände direkt vom Mieter — landen im Verbrauchs-Tab</li>
                  <li>Bewerbungen auf freie Wohnungen an einem Ort</li>
                </ul>
              </div>
              <Shot src="/landing/mieterportal.webp" alt="Mieterportal mit Anliegen, Anfragen und Meldungen der Mieter" />
            </div>
          </Reveal>

          <Reveal>
            <div className="lp-split lp-split-rev">
              <div>
                <h3>Steuer ohne Suchen</h3>
                <p>Deine Buchungen werden automatisch den Zeilen der Anlage V zugeordnet — je Objekt, mit AfA und Schuldzinsen.</p>
                <ul>
                  <li>ELSTER-Ausfüllhilfe: Zeile für Zeile zum Abtippen</li>
                  <li>PDF-Aufstellung & Jahresbericht im Briefkopf-Design</li>
                  <li>AfA automatisch nach Baujahr oder eigener Satz je Objekt</li>
                </ul>
              </div>
              <Shot src="/landing/steuer.webp" alt="Steuer-Ansicht mit Anlage-V-Aufstellung je Objekt" />
            </div>
          </Reveal>

          <Reveal>
            <div className="lp-split">
              <div>
                <h3>Banking: Kontoauszüge waren gestern {SOON_BADGE}</h3>
                <p>Verbinde deine Konten mit reinem Lesezugriff (PSD2) — MyImmo gleicht Mieteingänge mit den erwarteten Mieten ab und schlägt Kosten automatisch vor. Du bestätigst per Klick.</p>
                <ul>
                  <li>Nur Lesezugriff über lizenzierten Anbieter — kein Zahlungsverkehr</li>
                  <li>Umsätze verschlüsselt gespeichert, Freigabe jederzeit widerrufbar</li>
                  <li>Mehrere Bankverbindungen je Konto möglich</li>
                </ul>
              </div>
              <Shot src="/landing/banking.webp" alt="Banking-Ansicht: Konto verbinden mit Bankensuche" />
            </div>
          </Reveal>

          <Reveal>
            <div className="lp-split lp-split-rev">
              <div>
                <h3>Fristen, die sich selbst eintragen</h3>
                <p>Aus Mietern, Krediten und Steuerterminen entstehen automatisch Fristen — eigene Wartungstermine legst du mit einem Klick an.</p>
                <ul>
                  <li>NK-Abrechnungsfrist, Zinsbindung, Grundsteuer & Co.</li>
                  <li>Wiederkehrende Wartungen (Heizung, Rauchmelder …)</li>
                  <li>Kalender-Export (.ics) für Apple/Google-Kalender</li>
                </ul>
              </div>
              <Shot src="/landing/termine.webp" alt="Terminkalender mit automatischen Fristen und Monatsansicht" />
            </div>
          </Reveal>

          <Reveal>
            <div className="lp-split">
              <div>
                <h3>Dein Bestand als Cockpit</h3>
                <p>Jedes Objekt mit Wert, Miete, Rendite und Restschuld — und der Cashflow deines Portfolios als Verlauf.</p>
                <ul>
                  <li>Brutto-Rendite und Leerstandsquote automatisch</li>
                  <li>Einnahmen vs. Ausgaben je Monat</li>
                  <li>Kauf-Kalkulatoren für das nächste Objekt</li>
                </ul>
              </div>
              <Shot src="/landing/immobilien.webp" alt="Immobilien-Übersicht mit Wert, Miete und Rendite je Objekt" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-section-alt" style={{ borderBottom: "none" }}>
        <div className="lp-inner">
          <div className="lp-kicker">Rollen</div>
          <h2 className="lp-h2">Eine Plattform. Vier Perspektiven.</h2>
          <p className="lp-section-sub">
            Vermieten ist Teamarbeit. MyImmo gibt jedem Beteiligten einen eigenen Zugang —
            per Einladungscode, sauber getrennt, jeder sieht nur seins.
          </p>
          <div className="lp-cards3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {ROLLEN.map((r, i) => (
              <Reveal key={r.t} delay={i * 70}>
                <Tilt>
                  <div className="lp-card" style={{ height: "100%" }}>
                    <div className="lp-card-icon"><r.ico size={22} /></div>
                    <h3>{r.t}</h3>
                    <p>{r.p}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
          <p className="lp-section-sub" style={{ marginTop: 22, marginBottom: 0 }}>
            So läuft eine Reparatur: Mieter meldet den Schaden mit Foto → Hausmeister erstellt den Auftrag
            und wählt die Firma aus dem Verzeichnis → du gibst von unterwegs frei → die Firma bekommt einen
            Termin-Link mit dem Kontakt des Mieters. Du warst nie am Telefon.
          </p>
        </div>
      </section>
    </LandingShell>
  );
}
