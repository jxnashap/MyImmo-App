import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";
import LandingShell from "@/components/landing/Shell";
import Reveal from "@/components/landing/Reveal";
import Tilt from "@/components/landing/Tilt";
import RollenFlow from "@/components/landing/RollenFlow";
import { FEATURES, PLAENE, SOON_BADGE, Shot } from "@/components/landing/data";

// Kompakte Startseite für ausgeloggte Besucher — helles Vertrauens-Design
// nach den Mustern erfolgreicher Vermieter-SaaS (Problem→Lösung,
// Excel-Vergleich, Prozess-Schritte, ehrlicher Social Proof, klare CTAs).
// Details liegen auf /funktionen, /preise und /vision.

export default function LandingPage() {
  const topFeatures = FEATURES.slice(0, 6);

  return (
    <LandingShell>
      {/* ---------- Hero ---------- */}
      <section className="lp-section" style={{ paddingBottom: 24 }}>
        <div className="lp-inner lp-hero2">
          <div>
            <span className="lp-badge"><span className="dot" />Early Access — aktuell alles kostenlos</span>
            <h1 className="lp-h1">Vermieten ohne Papierkram. <em>Von überall.</em></h1>
            <p className="lp-sub">
              Nebenkostenabrechnung, Anlage V, Mieten und dein ganzes Team — Mieter, Hausmeister,
              Handwerker — in einer aufgeräumten App. Gemacht für private Vermieter mit 1–24
              Einheiten, denen Excel zu fehleranfällig und Profi-Software zu teuer ist.
            </p>
            <div className="lp-cta-row">
              <Link href="/anmelden" className="btn btn-gold lp-btn-big">Kostenlos starten</Link>
              <Link href="/funktionen" className="btn btn-ghost lp-btn-big">Alle Funktionen</Link>
            </div>
            <p className="lp-hero-note">Keine Kreditkarte nötig · Daten in der EU · jederzeit kündbar</p>
          </div>
          <Reveal>
            <Shot src="/landing/dashboard.webp" alt="MyImmo-Dashboard mit Portfolio-Wert, Cashflow und Verlaufs-Chart" />
          </Reveal>
        </div>
        <div className="lp-inner">
          <Reveal>
            <div className="lp-stats">
              <div className="lp-stat"><div className="z">14+</div><div className="t">Funktionen — vom Mietvertrag bis ELSTER</div></div>
              <div className="lp-stat"><div className="z">4</div><div className="t">Rollen: Vermieter, Mieter, Hausmeister, Verwaltung</div></div>
              <div className="lp-stat"><div className="z">100 %</div><div className="t">Daten in der EU, Bankdaten AES-256-verschlüsselt</div></div>
              <div className="lp-stat"><div className="z">0 €</div><div className="t">im Early Access — voller Funktionsumfang</div></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Rollen-Flow-Animation ---------- */}
      <section className="lp-section lp-section-alt">
        <div className="lp-inner">
          <div className="lp-kicker">So arbeitet dein Team</div>
          <h2 className="lp-h2">Vom Tropfen unterm Waschbecken zum Termin — in Sekunden</h2>
          <p className="lp-section-sub">
            Schau zu, wie eine Schadensmeldung durch die vier Rollen läuft. Kein Anrufbeantworter,
            keine Zettel, keine Telefonkette.
          </p>
          <Reveal><RollenFlow /></Reveal>
        </div>
      </section>

      {/* ---------- Excel-Vergleich ---------- */}
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Vorher / Nachher</div>
          <h2 className="lp-h2">Excel war gestern</h2>
          <p className="lp-section-sub">Die ehrliche Gegenüberstellung — Aufgabe für Aufgabe.</p>
          <Reveal>
            <div className="xl-scroll">
              <table className="xl-tab">
                <thead>
                  <tr><th>Aufgabe</th><th>Mit Excel & Ordnern</th><th>Mit MyImmo</th></tr>
                </thead>
                <tbody>
                  <tr><td>Nebenkostenabrechnung</td><td className="schlecht">Ein Wochenende rechnen, Formel-Fehler inklusive</td><td className="gut">Positionen erfasst → fertiges PDF, Anteil automatisch gerechnet</td></tr>
                  <tr><td>Anlage V</td><td className="schlecht">Belege suchen, Zeilen raten</td><td className="gut">Buchungen sind den ELSTER-Zeilen schon zugeordnet</td></tr>
                  <tr><td>Mieteingang prüfen</td><td className="schlecht">Kontoauszüge durchgehen</td><td className="gut">Mietkonto zeigt offene Monate — Banking-Abgleich kommt</td></tr>
                  <tr><td>Schadensmeldung</td><td className="schlecht">Anruf, Rückruf, Zettel, nochmal Anruf</td><td className="gut">Mieter meldet mit Foto, Hausmeister übernimmt, du gibst frei</td></tr>
                  <tr><td>Fristen</td><td className="schlecht">Im Hinterkopf oder im Papierkalender</td><td className="gut">Werden automatisch aus deinen Daten abgeleitet</td></tr>
                  <tr><td>Unterlagen fürs Bankgespräch</td><td className="schlecht">Aktenordner zusammensuchen</td><td className="gut">Beleihungsordner mit Deckblatt auf Knopfdruck</td></tr>
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Prozess in 4 Schritten ---------- */}
      <section className="lp-section lp-section-alt">
        <div className="lp-inner">
          <div className="lp-kicker">So startest du</div>
          <h2 className="lp-h2">In vier Schritten zur entspannten Verwaltung</h2>
          <p className="lp-section-sub">Kein Handbuch nötig — die App führt dich durch.</p>
          <Reveal>
            <div className="proz" style={{ marginTop: 26 }}>
              <div className="p"><h3>Objekt anlegen</h3><p>Adresse, Kaufpreis, Wohnfläche — oder Exposé einfügen und die KI liest die Eckdaten aus.</p></div>
              <div className="p"><h3>Mieter erfassen</h3><p>Mietverhältnis, Kaltmiete, Kaution. Auf Wunsch bekommt der Mieter direkt seinen Portal-Zugang.</p></div>
              <div className="p"><h3>Buchungen laufen lassen</h3><p>Wiederkehrende Mieten und Kosten einmal anlegen — MyImmo bucht im Zyklus, rückwirkend bis 10 Jahre.</p></div>
              <div className="p"><h3>Abrechnen & exportieren</h3><p>NK-Abrechnung, Anlage V und Jahresbericht als fertige PDFs — für Mieter, ELSTER und Steuerberater.</p></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Funktionen (Teaser) ---------- */}
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Funktionen</div>
          <h2 className="lp-h2">Alles, was Vermieten verlangt</h2>
          <p className="lp-section-sub">Ein Auszug — die komplette Übersicht mit Screenshots findest du auf der Funktionsseite.</p>
          <div className="lp-features" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {topFeatures.map((f, i) => (
              <Reveal key={f.t} delay={i * 60}>
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
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Link href="/funktionen" className="lp-mehr">Alle 14 Funktionen ansehen <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      {/* ---------- Vision (Teaser) ---------- */}
      <section className="lp-section lp-section-alt">
        <div className="lp-inner">
          <div className="lp-kicker">Die Vision</div>
          <div style={{ textAlign: "center", marginTop: 12 }}><Plane size={28} style={{ color: "var(--l-gold-dark)" }} /></div>
          <h2 className="lp-h2" style={{ marginTop: 4 }}>Leben, wo du willst.</h2>
          <p className="lp-section-sub">
            MyImmo entsteht aus einem konkreten Ziel: im Ausland leben und den Bestand in Deutschland
            vollständig aus der App steuern. Was vor Ort passieren muss, erledigt dein Team —
            was Entscheidung ist, entscheidest du. Von überall.
          </p>
          <div style={{ textAlign: "center" }}>
            <Link href="/vision" className="lp-mehr">Die ganze Vision & Roadmap <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      {/* ---------- Preise (Teaser) ---------- */}
      <section className="lp-section" style={{ borderBottom: "none" }}>
        <div className="lp-inner">
          <div className="lp-kicker">Preise</div>
          <h2 className="lp-h2">Fair kalkuliert — und aktuell kostenlos</h2>
          <p className="lp-section-sub">Vier Tarife von 0 € bis Business — während des Early Access ist alles kostenlos.</p>
          <div className="lp-stats" style={{ marginTop: 0 }}>
            {PLAENE.map((p) => (
              <Link key={p.name} href="/preise" className="lp-stat" style={{ textDecoration: "none" }}>
                <div className="z" style={{ fontSize: 20 }}>{p.preis}</div>
                <div className="t">{p.name} · {p.einheiten}</div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Link href="/preise" className="lp-mehr">Tarife im Detail vergleichen <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
