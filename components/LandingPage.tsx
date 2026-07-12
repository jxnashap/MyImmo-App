import Link from "next/link";
import { BarChart3, Banknote, ReceiptText, Landmark, CalendarDays, Folders, Bot, Archive, AlarmClock, PartyPopper, type LucideIcon } from "lucide-react";

// Landingpage für ausgeloggte Besucher auf "/" — Server Component, indexierbar.
// Preise aus dem Businessplan; solange Billing nicht live ist, weist der
// Early-Access-Hinweis darauf hin, dass aktuell alles kostenlos nutzbar ist.

const FEATURES: { ico?: LucideIcon; t: string; p: string }[] = [
  { ico: BarChart3, t: "Portfolio-Dashboard", p: "Wert, Cashflow, Rendite und Leerstand deines Bestands auf einen Blick — mit Verlaufs-Chart." },
  { ico: Banknote, t: "Ein- & Ausgaben", p: "Mieten und Kosten je Objekt erfassen, Belege anhängen, Netto-Cashflow automatisch berechnet." },
  { ico: ReceiptText, t: "Nebenkostenabrechnung", p: "Umlage nach Fläche, Einheiten oder Verbrauch — cent-genau verteilt, als fertiges PDF für den Mieter." },
  { t: "Steuer & Anlage V", p: "Einkünfte aus V+V je Objekt mit AfA und Schuldzinsen, den Anlage-V-Zeilen zugeordnet, CSV-Export." },
  { ico: Landmark, t: "Kredite & Zinsbindung", p: "Restschuld, Raten und Zinsbindungen im Blick — mit Warnung, bevor die Anschlussfinanzierung ansteht." },
  { ico: CalendarDays, t: "Termine & Fristen", p: "Automatische Fristen aus Mietern, Krediten und Steuer plus Wartungen — als Kalender und iCal-Export." },
  { ico: Folders, t: "Dokumente & Archiv", p: "Mietverträge, Bescheide und Belege zentral abgelegt — plus Freigabe-Ordner für dein Bankgespräch." },
  { ico: Bot, t: "KI-Import & Kalkulatoren", p: "Exposé einfügen, Eckdaten werden ausgelesen. Kauf-Check mit Cashflow-, Rendite- und Vermögensrechnung." },
];

type Plan = {
  name: string; preis: string; jahr: string | null; einheiten: string;
  punkte: string[]; cta: string; highlight: boolean; tag?: string; ctaHref?: string;
};

const PLAENE: Plan[] = [
  {
    name: "Kostenlos", preis: "0 €", jahr: null, einheiten: "1 Einheit",
    punkte: ["Objekt, Mieter & Buchungen", "Dashboard & Cashflow", "Termine & Fristen"],
    cta: "Kostenlos starten", highlight: false,
  },
  {
    name: "MyImmo Privat", preis: "7,99 €", jahr: "oder 79 € im Jahr", einheiten: "bis 5 Einheiten",
    punkte: ["Alles aus Kostenlos", "Nebenkostenabrechnung als PDF", "Steuer / Anlage V mit Export", "Dokumente & Bank-Freigabe"],
    cta: "Kostenlos starten", highlight: true, tag: "Beliebt",
  },
  {
    name: "MyImmo Plus", preis: "12,99 €", jahr: "oder 129 € im Jahr", einheiten: "bis 24 Einheiten",
    punkte: ["Alles aus Privat", "Mehr Einheiten für wachsende Bestände", "KI-Import & alle Kalkulatoren"],
    cta: "Kostenlos starten", highlight: false,
  },
  {
    name: "MyImmo Business", preis: "auf Anfrage", jahr: null, einheiten: "ab 25 Einheiten · Firmen",
    punkte: ["Portfolio-Listen statt Einzelkarten", "Team-Zugänge (geplant)", "Sammel-Funktionen (geplant)"],
    cta: "Kontakt aufnehmen", highlight: false, ctaHref: "/impressum",
  },
];

const FAQ = [
  {
    q: "Ist MyImmo wirklich kostenlos?",
    a: "Ja — während des Early Access ist der komplette Funktionsumfang kostenlos. Die Preistabelle zeigt, was die Tarife später kosten sollen. Bestehende Nutzer werden rechtzeitig informiert, bevor Bezahltarife eingeführt werden, und behalten Zugriff auf ihre Daten.",
  },
  {
    q: "Wo liegen meine Daten?",
    a: "In der EU (Frankfurt, eu-central-1) bei Supabase; gehostet wird die App bei Vercel. Bankdaten wie IBANs werden zusätzlich anwendungsseitig verschlüsselt (AES-256-GCM). Details stehen in der Datenschutzerklärung und im AVV.",
  },
  {
    q: "Ersetzt MyImmo meinen Steuerberater?",
    a: "Nein. Nebenkostenabrechnung, Anlage V und Kalkulatoren sind Rechen- und Organisationshilfen ohne Gewähr — sie bereiten deine Zahlen sauber auf, ersetzen aber keine Steuer- oder Rechtsberatung.",
  },
  {
    q: "Für wen ist MyImmo gedacht?",
    a: "Für private Vermieter mit etwa 1–24 Einheiten, denen Profi-Hausverwaltungssoftware zu teuer und zu komplex ist — und Excel zu fehleranfällig. Für größere Bestände und Firmen ist ein Business-Tarif geplant.",
  },
  {
    q: "Kann ich meine Daten wieder mitnehmen?",
    a: "Ja. Auswertungen lassen sich als CSV bzw. PDF exportieren, und du kannst dein Konto jederzeit selbst in den Einstellungen löschen.",
  },
  {
    q: "Gibt es eine Mieter-Begrenzung oder Werbung?",
    a: "Nein — keine Werbung, keine Weitergabe deiner Daten für Werbezwecke. Das Geschäftsmodell ist ein faires Software-Abo, kein Datenhandel.",
  },
];

function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="lp-shot">
      <div className="lp-shot-bar"><i /><i /><i /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      {/* ---------- Navigation ---------- */}
      <header className="lp-nav">
        <div className="lp-inner lp-nav-row">
          <div className="lp-logo">My<span>Immo</span></div>
          <nav className="lp-nav-links">
            <a href="#funktionen">Funktionen</a>
            <a href="#preise">Preise</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-nav-cta">
            <Link href="/anmelden" className="btn btn-ghost">Anmelden</Link>
            <Link href="/anmelden" className="btn btn-gold">Kostenlos starten</Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="lp-inner">
          <span className="lp-badge"><span className="dot" />Early Access — aktuell alles kostenlos</span>
          <h1 className="lp-h1">Deine Immobilien. <em>Endlich</em> ohne Zettelwirtschaft.</h1>
          <p className="lp-sub">
            MyImmo bündelt Mieten, Kosten, Kredite, Nebenkostenabrechnung und Anlage V
            in einer aufgeräumten App — gemacht für private Vermieter, nicht für Hausverwaltungen.
          </p>
          <div className="lp-cta-row">
            <Link href="/anmelden" className="btn btn-gold lp-btn-big">Kostenlos starten</Link>
            <a href="#funktionen" className="btn btn-ghost lp-btn-big">Funktionen ansehen</a>
          </div>
          <p className="lp-hero-note">Keine Kreditkarte nötig · Daten in der EU · jederzeit kündbar</p>
          <div className="lp-hero-shot">
            <Shot src="/landing/dashboard.webp" alt="MyImmo-Dashboard mit Portfolio-Wert, Cashflow und Verlaufs-Chart" />
          </div>
        </div>
      </section>

      {/* ---------- Problem → Lösung ---------- */}
      <section className="lp-section lp-section-alt">
        <div className="lp-inner">
          <div className="lp-kicker">Vorher / Nachher</div>
          <h2 className="lp-h2">Schluss mit Excel, Ordnern und Kopfrechnen</h2>
          <p className="lp-section-sub">
            Die meisten privaten Vermieter verwalten mit Tabellen und Aktenordnern —
            fehleranfällig, verstreut, jedes Jahr derselbe Stress.
          </p>
          <div className="lp-cards3">
            <div className="lp-card">
              <div className="lp-card-icon"><Archive size={22} /></div>
              <span className="lp-vorher">Vorher: alles verstreut</span>
              <h3>Ein Ort für alles</h3>
              <p>Objekte, Mieter, Buchungen, Kredite und Dokumente in einer App — statt in fünf Excel-Dateien und drei Ordnern.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><ReceiptText size={22} /></div>
              <span className="lp-vorher">Vorher: NK-Abrechnung = Wochenende weg</span>
              <h3>Abrechnung auf Knopfdruck</h3>
              <p>Kosten übers Jahr erfassen, Umlageschlüssel wählen — MyImmo verteilt cent-genau und erzeugt das fertige PDF für deine Mieter.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><AlarmClock size={22} /></div>
              <span className="lp-vorher">Vorher: Fristen im Hinterkopf</span>
              <h3>Nichts mehr verpassen</h3>
              <p>Abrechnungsfristen, Zinsbindungen, Wartungen: MyImmo leitet Termine automatisch aus deinen Daten ab und warnt rechtzeitig.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Funktions-Grid ---------- */}
      <section className="lp-section" id="funktionen">
        <div className="lp-inner">
          <div className="lp-kicker">Funktionen</div>
          <h2 className="lp-h2">Alles, was Vermieten verlangt</h2>
          <p className="lp-section-sub">Vom ersten Mietvertrag bis zur Anlage V — ohne Schnickschnack, den nur Hausverwaltungen brauchen.</p>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.t} className="lp-feature">
                <div className="ico">{f.ico ? <f.ico size={20} /> : "§"}</div>
                <h3>{f.t}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>

          <div className="lp-split">
            <div>
              <h3>Steuer ohne Suchen</h3>
              <p>Deine Buchungen werden automatisch den Zeilen der Anlage V zugeordnet — je Objekt, mit AfA und Schuldzinsen.</p>
              <ul>
                <li>AfA automatisch nach Baujahr oder eigener Satz je Objekt</li>
                <li>Werbungskosten nach Anlage-V-Zeilen gegliedert</li>
                <li>CSV-Export für Steuerberater oder ELSTER-Übertrag</li>
              </ul>
            </div>
            <Shot src="/landing/steuer.webp" alt="Steuer-Ansicht mit Anlage-V-Aufstellung je Objekt" />
          </div>

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
        </div>
      </section>

      {/* ---------- Preise ---------- */}
      <section className="lp-section lp-section-alt" id="preise">
        <div className="lp-inner">
          <div className="lp-kicker">Preise</div>
          <h2 className="lp-h2">Fair kalkuliert — und aktuell kostenlos</h2>
          <p className="lp-section-sub">So sollen die Tarife später aussehen. Jahreszahlung spart rund zwei Monatsbeiträge.</p>
          <div className="lp-early">
            <PartyPopper size={14} style={{ verticalAlign: "-2px" }} /> Early Access: Während der Startphase ist der volle Funktionsumfang kostenlos — Bezahltarife werden rechtzeitig angekündigt.
          </div>
          <div className="lp-pricing">
            {PLAENE.map((p) => (
              <div key={p.name} className={`lp-plan${p.highlight ? " lp-plan-highlight" : ""}`}>
                {p.tag && <span className="lp-plan-tag">{p.tag}</span>}
                <h3>{p.name}</h3>
                <div className="lp-einheiten">{p.einheiten}</div>
                <div className="lp-price">{p.preis}{p.preis.endsWith("€") && <small> / Monat</small>}</div>
                <div className="lp-price-jahr">{p.jahr ?? ""}</div>
                <ul>
                  {p.punkte.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
                <Link href={p.ctaHref ?? "/anmelden"} className={`btn ${p.highlight ? "btn-gold" : "btn-ghost"}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="lp-section" id="faq">
        <div className="lp-inner">
          <div className="lp-kicker">FAQ</div>
          <h2 className="lp-h2">Häufige Fragen</h2>
          <p className="lp-section-sub">Kurz beantwortet — Details stehen in AGB und Datenschutzerklärung.</p>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="lp-faq-body">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Abschluss-CTA ---------- */}
      <section className="lp-final lp-section-alt">
        <div className="lp-inner">
          <h2 className="lp-h2">In 2 Minuten startklar</h2>
          <p className="lp-section-sub">Konto anlegen, erstes Objekt erfassen — den Rest übernimmt MyImmo.</p>
          <div className="lp-cta-row">
            <Link href="/anmelden" className="btn btn-gold lp-btn-big">Kostenlos starten</Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer">
        <div className="lp-inner lp-footer-row">
          <span className="lp-logo" style={{ fontSize: 15 }}>My<span>Immo</span></span>
          <Link href="/agb">AGB</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/avv">AVV</Link>
          <Link href="/impressum">Impressum</Link>
          <span className="spacer" />
          <span>© {new Date().getFullYear()} MyImmo</span>
        </div>
      </footer>
    </div>
  );
}
