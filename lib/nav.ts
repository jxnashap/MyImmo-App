// Geteilte Navigationsziele — von Sidebar.tsx UND CommandPalette.tsx genutzt,
// damit beide garantiert dieselben Bereiche/Icons zeigen (keine Duplikate).
import {
  BarChart3, Home, User, Banknote, ReceiptText, Zap, Landmark, Archive,
  TrendingUp, MessageSquareText,
  Building2, Building, Store, TreePalm, Sprout, Percent, Compass, Handshake, Scale,
  Gauge, FolderCheck, PaintRoller, Route, Network, Columns3, Stamp, CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { KAUFWEG, type WegSchrittId } from "@/lib/kaufweg";

/** `schritt`: Nummer im Kaufweg — die Seitenleiste zeigt dann die Zahl statt des Symbols. */
export type NavItem = { href: string; label: string; icon?: LucideIcon; paragraph?: boolean; schritt?: number };

// DREI GRUPPEN STATT ZWEI (08.09.2026, Feedback Befund 8). Vorher lagen elf
// gleichrangige Punkte unter „Verwaltung" — für einen Vermieter mit zwei
// Wohnungen sieht das aus wie Buchhaltungssoftware. Die Trennung folgt der
// Frage, WANN man etwas braucht: täglich · zur Abrechnung · beim Planen.
//
// Bewusst NICHT versteckt, nur gruppiert: „Planen" ist eingeklappt, aber mit
// einem Klick da. Funktionen erst nach eingerichteten Grundlagen zu zeigen
// (Vorschlag des Feedbacks) wäre die schlechtere Lösung — wer die App kennt,
// sucht dann.
export const VERWALTEN: NavItem[] = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/properties", label: "Immobilien", icon: Home },
  { href: "/tenants", label: "Mieter", icon: User },
  { href: "/cashflow", label: "Ein- & Ausgaben", icon: Banknote },
  // Termine & Fristen (Gesamtprüfung C47): vorher nur über das Dashboard erreichbar, nicht in der
  // Seitenleiste und nicht in der Befehlspalette („kalender“ fand nichts).
  { href: "/termine", label: "Termine", icon: CalendarDays },
  // Nicht "Mieterportal": So heisst die Mieter-Oberflaeche unter /portal.
  // Diese Seite ist die Vermieter-Sicht und enthaelt neben Mieter-Anliegen
  // auch Bewerbungen und die Handwerker-Verwaltung.
  { href: "/anliegen", label: "Mieterportal", icon: MessageSquareText },
];

export const ABRECHNEN: NavItem[] = [
  { href: "/mietkonto", label: "Mietkonto", icon: ReceiptText },
  { href: "/verbrauch", label: "Verbrauch", icon: Zap },
  { href: "/kredite", label: "Kredite", icon: Landmark },
  { href: "/steuer", label: "Steuer", icon: Scale, paragraph: true }, // Icon nur fuer die Command-Palette; die Sidebar zeigt bewusst "§"
  { href: "/jahresbericht", label: "Jahresbericht", icon: TrendingUp },
  { href: "/archiv", label: "Archiv", icon: Archive },
];

// ZWEI BEREICHE (05.10.2026, Vorgabe des Betreibers): MyImmo ist die automatisierte
// Verwaltung (VERWALTEN + ABRECHNEN), BuyImmo die aktive Kommandozentrale für den
// Bestandsaufbau (AUFBAUEN + RECHNEN). Gewechselt wird oben links am Logo
// (`components/BereichWechsel.tsx`); welcher Bereich offen ist, folgt allein aus der
// Adresse (`lib/bereich.ts`). Die früheren „Planen“-Punkte sind nach BuyImmo gezogen —
// ihre Adressen sind UNVERÄNDERT, damit kein Link, Lesezeichen oder Demo-Weg bricht.
// UMBAU 06.10.2026 (Vorgabe Jonas): BuyImmo führt einen Anfänger Schritt für Schritt zum Kauf —
// „dass es so in der Reihenfolge links auch in den Reitern ist“. Oben Cockpit und Strategie, dann
// der Kaufweg mit Nummern (EINE Quelle: lib/kaufweg.ts), unten die Werkzeuge. Alle früheren
// Adressen (/kauf, /makler, /fahrplan …) bleiben gültig.
export const UEBERBLICK: NavItem[] = [
  { href: "/aufbau", label: "Cockpit", icon: Gauge },
  { href: "/strategie", label: "Strategie", icon: Network },
];

const WEG_ICON: Record<WegSchrittId, LucideIcon> = {
  vergleichen: Columns3,
  besichtigen: PaintRoller,
  finanzieren: Compass,
  unterlagen: FolderCheck,
  abschluss: Stamp,
};

export const WEG: NavItem[] = KAUFWEG.map((s) => ({ href: s.href, label: s.titel, icon: WEG_ICON[s.id], schritt: s.nr }));

export const WERKZEUGE: NavItem[] = [
  { href: "/fahrplan", label: "Fahrplan", icon: Route },
  { href: "/bewertung", label: "Marktwert-Schätzer", icon: TrendingUp },
  { href: "/afa-assistent", label: "AfA-Assistent", icon: Percent },
  { href: "/verkauf", label: "Verkauf-Assistent", icon: Handshake },
];

/** Alle Ziele in einer Liste — die Command-Palette sucht über BEIDE Bereiche. */
export const ALLE_ZIELE: NavItem[] = [...VERWALTEN, ...ABRECHNEN, ...UEBERBLICK, ...WEG, ...WERKZEUGE];

/** @deprecated Übergangsname, damit ältere Importe nicht brechen. */
export const VERWALTUNG = VERWALTEN;

// Icon je Objekttyp — exakt wie in der HTML-Vorlage (propIcons).
export const PROP_ICONS: Record<string, LucideIcon> = {
  Eigentumswohnung: Building2,
  Einfamilienhaus: Home,
  Mehrfamilienhaus: Building,
  Gewerbeimmobilie: Store,
  Ferienimmobilie: TreePalm,
  Grundstück: Sprout,
};
