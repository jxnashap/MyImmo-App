import Link from "next/link";
import {
  BarChart3, Banknote, ReceiptText, Landmark, CalendarDays, Folders, Bot, Archive,
  AlarmClock, PartyPopper, MessageSquareText, Users, Wrench, CreditCard, ShieldCheck,
  FileText, Building2, Plane, type LucideIcon,
} from "lucide-react";

// Landingpage für ausgeloggte Besucher auf "/" — Server Component, indexierbar.
// Preise aus dem Businessplan; solange Billing nicht live ist, weist der
// Early-Access-Hinweis darauf hin, dass aktuell alles kostenlos nutzbar ist.

const FEATURES: { ico?: LucideIcon; t: string; p: string; soon?: boolean }[] = [
  { ico: BarChart3, t: "Portfolio-Dashboard", p: "Wert, Cashflow, Rendite und Leerstand deines Bestands auf einen Blick — mit Verlaufs-Chart." },
  { ico: Banknote, t: "Ein- & Ausgaben", p: "Mieten und Kosten je Objekt erfassen, Belege anhängen, Netto-Cashflow automatisch berechnet." },
  { ico: ReceiptText, t: "Nebenkostenabrechnung", p: "Im klassischen Layout mit Gesamtkosten, Basis und Wohnungsanteil — die App rechnet den Mieteranteil selbst und erzeugt das fertige PDF." },
  { t: "Steuer, Anlage V & ELSTER", p: "Einkünfte aus V+V je Objekt mit AfA und Schuldzinsen — als ELSTER-Ausfüllhilfe Zeile für Zeile, PDF-Aufstellung und CSV." },
  { ico: MessageSquareText, t: "Mieterportal", p: "Mieter melden Schäden, Zählerstände und Anliegen direkt in der App — inklusive Bewerber-Verwaltung für freie Wohnungen." },
  { ico: Wrench, t: "Service & Aufträge", p: "Hausmeister erstellt den Auftrag, du gibst per Klick frei — mit Firmenverzeichnis und Termin-Link für Handwerker." },
  { ico: Users, t: "Rollen & Team", p: "Vermieter, Mieter, Hausmeister und Hausverwaltung — jeder sieht genau das, was er braucht. Zugang per Einladungscode." },
  { ico: CreditCard, t: "Banking-Anbindung", p: "Konten per PSD2 verbinden (nur Lesezugriff): Mieteingänge automatisch abgleichen, Ausgaben als Kostenvorschläge.", soon: true },
  { ico: Landmark, t: "Kredite & Zinsbindung", p: "Restschuld, Raten und Zinsbindungen im Blick — mit Warnung, bevor die Anschlussfinanzierung ansteht." },
  { ico: CalendarDays, t: "Termine & Fristen", p: "Automatische Fristen aus Mietern, Krediten und Steuer plus Wartungen — als Kalender und iCal-Export." },
  { ico: FileText, t: "Dokument-Generator", p: "Mahnung, Mietbescheinigung, Übergabeprotokoll & Co. als fertige Brief-PDFs im eigenen Briefkopf — auf Wunsch e-signiert." },
  { ico: Folders, t: "Archiv & Bankpaket", p: "Verträge, Bescheide und Belege zentral abgelegt — plus Beleihungsordner mit Deckblatt fürs Bankgespräch." },
  { ico: Bot, t: "KI-Import & Kalkulatoren", p: "Exposé einfügen, Eckdaten werden ausgelesen. Kauf-Check mit Cashflow-, Rendite- und Vermögensrechnung." },
  { ico: ShieldCheck, t: "Sicherheit & Datenschutz", p: "Daten in der EU, Bankdaten zusätzlich anwendungsseitig verschlüsselt (AES-256-GCM), voller Datenexport jederzeit." },
];

const ROLLEN: { ico: LucideIcon; t: string; p: string }[] = [
  { ico: Building2, t: "Vermieter", p: "Die volle App: Objekte, Mieter, Buchungen, Abrechnungen, Steuer, Kredite — dein Bestand, dein Cockpit." },
  { ico: Users, t: "Mieter", p: "Eigener Zugang: Schäden melden, Zählerstände durchgeben, Dokumente empfangen — statt Zettel im Hausflur." },
  { ico: Wrench, t: "Hausmeister & Service", p: "Anliegen sehen, Aufträge anlegen, Firmen kontaktieren — du gibst nur noch frei." },
  { ico: Landmark, t: "Hausverwaltung", p: "Verwaltet fremde Bestände mit denselben Werkzeugen wie ein Vermieter — je Mandat sauber getrennt." },
];

type Plan = {
  name: string; preis: string; jahr: string | null; einheiten: string;
  punkte: string[]; cta: string; highlight: boolean; tag?: string; ctaHref?: string;
};

const PLAENE: Plan[] = [
  {
    name: "Kostenlos", preis: "0 €", jahr: null, einheiten: "1 Einheit",
    punkte: ["Objekt, Mieter & Buchungen", "Dashboard & Cashflow", "Termine & Fristen", "Verbrauch & Zähler"],
    cta: "Kostenlos starten", highlight: false,
  },
  {
    name: "MyImmo Privat", preis: "7,99 €", jahr: "oder 79 € im Jahr", einheiten: "bis 5 Einheiten",
    punkte: [
      "Alles aus Kostenlos",
      "Nebenkostenabrechnung als PDF (inkl. Durchrechnung)",
      "Steuer: Anlage V, ELSTER-Hilfe & PDF-Berichte",
      "Dokument-Generator & Archiv",
      "Mieterportal mit Mieter-Zugängen",
    ],
    cta: "Kostenlos starten", highlight: true, tag: "Beliebt",
  },
  {
    name: "MyImmo Plus", preis: "12,99 €", jahr: "oder 129 € im Jahr", einheiten: "bis 24 Einheiten",
    punkte: [
      "Alles aus Privat",
      "Team-Rollen: Hausmeister & Service-Aufträge",
      "Firmenverzeichnis & Auftrags-Freigabe",
      "KI-Import & alle Kalkulatoren",
      "Beleihungsordner & Bankgespräch-Paket",
    ],
    cta: "Kostenlos starten", highlight: false,
  },
  {
    name: "MyImmo Business", preis: "auf Anfrage", jahr: null, einheiten: "ab 25 Einheiten · Hausverwaltungen",
    punkte: [
      "Alles aus Plus",
      "Hausverwaltungs-Zugang (Mandate getrennt)",
      "Team-Zugänge (geplant)",
      "Sammel-Funktionen (geplant)",
    ],
    cta: "Kontakt aufnehmen", highlight: false, ctaHref: "/impressum",
  },
];

const VISION: { t: string; p: string; status: "live" | "bald" | "geplant" }[] = [
  { t: "Banking-Abgleich", p: "Mieteingänge landen automatisch am richtigen Mietkonto — du bestätigst nur noch per Klick.", status: "bald" },
  { t: "Steuerberater-Freigabe", p: "Fertige Unterlagen auf Knopfdruck prüfen lassen — Ergebnis in 1–3 Tagen, ohne Termin.", status: "geplant" },
  { t: "News für Vermieter", p: "Mietrecht, Steuer, Förderungen: kuratierte Meldungen aus seriösen Quellen, direkt in der App.", status: "geplant" },
  { t: "Geführtes Onboarding", p: "Durchklickbarer Guide nach der Registrierung: Objekt anlegen → Mieter erfassen → erste Buchung.", status: "geplant" },
];

const FAQ = [
  {
    q: "Ist MyImmo wirklich kostenlos?",
    a: "Ja — während des Early Access ist der komplette Funktionsumfang kostenlos. Die Preistabelle zeigt, was die Tarife später kosten sollen. Bestehende Nutzer werden rechtzeitig informiert, bevor Bezahltarife eingeführt werden, und behalten Zugriff auf ihre Daten.",
  },
  {
    q: "Kann ich meine Immobilien auch aus dem Ausland verwalten?",
    a: "Ja — genau dafür ist MyImmo gebaut. Die App läuft im Browser auf jedem Gerät, dein Hausmeister kümmert sich vor Ort über den Service-Bereich, Mieter melden Anliegen digital, und du gibst Aufträge von überall frei. Mit der Banking-Anbindung entfällt auch der Kontoauszugs-Abgleich.",
  },
  {
    q: "Wo liegen meine Daten?",
    a: "In der EU (Frankfurt, eu-central-1) bei Supabase; gehostet wird die App bei Vercel. Bankdaten wie IBANs werden zusätzlich anwendungsseitig verschlüsselt (AES-256-GCM). Details stehen in der Datenschutzerklärung und im AVV.",
  },
  {
    q: "Wie funktioniert die Banking-Anbindung?",
    a: "Über einen lizenzierten Kontoinformationsdienst (PSD2) mit reinem Lesezugriff — MyImmo sieht nie dein Bank-Passwort und kann keine Überweisungen auslösen. Die Freigabe läuft nach 90 Tagen automatisch ab und ist jederzeit widerrufbar. Der Start ist in Vorbereitung.",
  },
  {
    q: "Ersetzt MyImmo meinen Steuerberater?",
    a: "Nein. Nebenkostenabrechnung, Anlage V und Kalkulatoren sind Rechen- und Organisationshilfen ohne Gewähr — sie bereiten deine Zahlen sauber auf, ersetzen aber keine Steuer- oder Rechtsberatung.",
  },
  {
    q: "Für wen ist MyImmo gedacht?",
    a: "Für private Vermieter mit etwa 1–24 Einheiten, denen Profi-Hausverwaltungssoftware zu teuer und zu komplex ist — und Excel zu fehleranfällig. Für größere Bestände und Hausverwaltungen gibt es den Business-Tarif.",
  },
  {
    q: "Kann ich meine Daten wieder mitnehmen?",
    a: "Ja. Auswertungen lassen sich als CSV bzw. PDF exportieren, in den Einstellungen gibt es einen Komplett-Export aller Daten als ZIP, und du kannst dein Konto jederzeit selbst löschen.",
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

const SOON_BADGE = (
  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, color: "var(--gold)", border: "1px solid var(--gold-dim)", background: "var(--gold-pale)", borderRadius: 999, padding: "2px 8px", marginLeft: 8, verticalAlign: "2px", whiteSpace: "nowrap" }}>
    BALD
  </span>
);

export default function LandingPage() {
  return (
    <div className="lp">
      {/* ---------- Navigation ---------- */}
      <header className="lp-nav">
        <div className="lp-inner lp-nav-row">
          <div className="lp-logo">My<span>Immo</span></div>
          <nav className="lp-nav-links">
            <a href="#funktionen">Funktionen</a>
            <a href="#rollen">Rollen</a>
            <a href="#vision">Vision</a>
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
          <h1 className="lp-h1">Deine Immobilien. <em>Verwaltet von überall.</em></h1>
          <p className="lp-sub">
            MyImmo bündelt Mieten, Kosten, Kredite, Nebenkostenabrechnung, Anlage V und dein
            ganzes Team — Mieter, Hausmeister, Handwerker — in einer aufgeräumten App.
            Gemacht für private Vermieter, die ihren Bestand im Griff haben wollen, egal wo sie gerade sind.
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
              <p>Kosten übers Jahr erfassen, Umlageschlüssel wählen — MyImmo rechnet den Wohnungsanteil selbst durch und erzeugt das fertige PDF im klassischen Abrechnungs-Layout.</p>
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
          <p className="lp-section-sub">Vom ersten Mietvertrag bis zur Anlage V — inklusive Mieterportal, Team-Rollen und Banking-Anbindung.</p>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.t} className="lp-feature">
                <div className="ico">{f.ico ? <f.ico size={20} /> : "§"}</div>
                <h3>{f.t}{f.soon ? SOON_BADGE : null}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>

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

      {/* ---------- Rollen ---------- */}
      <section className="lp-section lp-section-alt" id="rollen">
        <div className="lp-inner">
          <div className="lp-kicker">Rollen</div>
          <h2 className="lp-h2">Eine Plattform. Vier Perspektiven.</h2>
          <p className="lp-section-sub">
            Vermieten ist Teamarbeit. MyImmo gibt jedem Beteiligten einen eigenen Zugang —
            per Einladungscode, sauber getrennt, jeder sieht nur seins.
          </p>
          <div className="lp-cards3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {ROLLEN.map((r) => (
              <div key={r.t} className="lp-card">
                <div className="lp-card-icon"><r.ico size={22} /></div>
                <h3>{r.t}</h3>
                <p>{r.p}</p>
              </div>
            ))}
          </div>
          <p className="lp-section-sub" style={{ marginTop: 22, marginBottom: 0 }}>
            So läuft eine Reparatur: Mieter meldet den Schaden mit Foto → Hausmeister erstellt den Auftrag
            und wählt die Firma aus dem Verzeichnis → du gibst von unterwegs frei → die Firma bekommt einen
            Termin-Link mit dem Kontakt des Mieters. Du warst nie am Telefon.
          </p>
        </div>
      </section>

      {/* ---------- Vision ---------- */}
      <section className="lp-section" id="vision">
        <div className="lp-inner">
          <div className="lp-kicker">Die Vision</div>
          <h2 className="lp-h2"><Plane size={26} style={{ verticalAlign: "-3px", color: "var(--gold)" }} /> Leben, wo du willst. Verwalten, als wärst du da.</h2>
          <p className="lp-section-sub">
            MyImmo entsteht aus einem konkreten Ziel: im Ausland leben und den Immobilienbestand in
            Deutschland vollständig aus der App steuern. Kein Papierkram, der auf dem Küchentisch wartet.
            Kein Anruf, der dich um 7 Uhr Ortszeit weckt. Alles, was vor Ort passieren muss, erledigt dein
            Team über seine Rollen — alles, was Entscheidung ist, entscheidest du. Von überall.
          </p>
          <div className="lp-cards3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {VISION.map((v) => (
              <div key={v.t} className="lp-card">
                <span className="lp-vorher" style={v.status === "bald" ? { color: "var(--gold)" } : undefined}>
                  {v.status === "bald" ? "In Arbeit" : "Geplant"}
                </span>
                <h3>{v.t}</h3>
                <p>{v.p}</p>
              </div>
            ))}
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
          <p className="lp-section-sub" style={{ marginTop: 18, marginBottom: 0, fontSize: 13 }}>
            <CreditCard size={14} style={{ verticalAlign: "-2px", color: "var(--gold)" }} />{" "}
            <strong>Add-on Banking:</strong> Die Konto-Anbindung verursacht laufende Kosten je Bankverbindung
            und wird deshalb als optionales Add-on zu Privat/Plus/Business angeboten — Preis wird mit dem
            Start bekannt gegeben. Ohne Add-on funktioniert alles andere uneingeschränkt.
          </p>
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
