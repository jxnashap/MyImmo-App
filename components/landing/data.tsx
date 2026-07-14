// Gemeinsame Inhalte der Landing-Seiten (Home, /funktionen, /preise, /vision).
// Eine Quelle für Features, Rollen, Pläne, Vision und FAQ — die Seiten
// komponieren daraus ihre Abschnitte.
import {
  BarChart3, Banknote, ReceiptText, Landmark, CalendarDays, Folders, Bot,
  MessageSquareText, Users, Wrench, CreditCard, ShieldCheck, FileText, Building2,
  type LucideIcon,
} from "lucide-react";

export type Feature = { ico?: LucideIcon; t: string; p: string; soon?: boolean };

export const FEATURES: Feature[] = [
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

export const ROLLEN: { ico: LucideIcon; t: string; p: string }[] = [
  { ico: Building2, t: "Vermieter", p: "Die volle App: Objekte, Mieter, Buchungen, Abrechnungen, Steuer, Kredite — dein Bestand, dein Cockpit." },
  { ico: Users, t: "Mieter", p: "Eigener Zugang: Schäden melden, Zählerstände durchgeben, Dokumente empfangen — statt Zettel im Hausflur." },
  { ico: Wrench, t: "Hausmeister & Service", p: "Anliegen sehen, Aufträge anlegen, Firmen kontaktieren — du gibst nur noch frei." },
  { ico: Landmark, t: "Hausverwaltung", p: "Verwaltet fremde Bestände mit denselben Werkzeugen wie ein Vermieter — je Mandat sauber getrennt." },
];

export type Plan = {
  name: string; preis: string; jahr: string | null; einheiten: string;
  punkte: string[]; cta: string; highlight: boolean; tag?: string; ctaHref?: string;
};

export const PLAENE: Plan[] = [
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

export const VISION: { t: string; p: string; status: "bald" | "geplant" }[] = [
  { t: "Banking-Abgleich", p: "Mieteingänge landen automatisch am richtigen Mietkonto — du bestätigst nur noch per Klick.", status: "bald" },
  { t: "Steuerberater-Freigabe", p: "Fertige Unterlagen auf Knopfdruck prüfen lassen — Ergebnis in 1–3 Tagen, ohne Termin.", status: "geplant" },
  { t: "News für Vermieter", p: "Mietrecht, Steuer, Förderungen: kuratierte Meldungen aus seriösen Quellen, direkt in der App.", status: "geplant" },
  { t: "Geführtes Onboarding", p: "Durchklickbarer Guide nach der Registrierung: Objekt anlegen → Mieter erfassen → erste Buchung.", status: "geplant" },
];

export const FAQ = [
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

export function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="lp-shot">
      <div className="lp-shot-bar"><i /><i /><i /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

export const SOON_BADGE = (
  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, color: "var(--gold)", border: "1px solid var(--gold-dim)", background: "var(--gold-pale)", borderRadius: 999, padding: "2px 8px", marginLeft: 8, verticalAlign: "2px", whiteSpace: "nowrap" }}>
    BALD
  </span>
);
