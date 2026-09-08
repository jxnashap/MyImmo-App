// Geteilte Navigationsziele — von Sidebar.tsx UND CommandPalette.tsx genutzt,
// damit beide garantiert dieselben Bereiche/Icons zeigen (keine Duplikate).
import {
  BarChart3, Home, User, Banknote, ReceiptText, Zap, Landmark, Archive,
  TrendingUp, MessageSquareText,
  Building2, Building, Store, TreePalm, Sprout, Percent, Compass, Handshake, Scale,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon?: LucideIcon; paragraph?: boolean };

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

export const PLANEN: NavItem[] = [
  { href: "/kauf", label: "Kauf-Assistent", icon: Compass },
  { href: "/verkauf", label: "Verkauf-Assistent", icon: Handshake },
  { href: "/bewertung", label: "Marktwert-Schätzer", icon: TrendingUp },
  { href: "/afa-assistent", label: "AfA-Assistent", icon: Percent },
];

/** Alle Ziele in einer Liste — die Command-Palette sucht über alles. */
export const ALLE_ZIELE: NavItem[] = [...VERWALTEN, ...ABRECHNEN, ...PLANEN];

/** @deprecated Übergangsnamen, damit ältere Importe nicht brechen. */
export const VERWALTUNG = VERWALTEN;
/** @deprecated */
export const KALKULATOR = PLANEN;

// Icon je Objekttyp — exakt wie in der HTML-Vorlage (propIcons).
export const PROP_ICONS: Record<string, LucideIcon> = {
  Eigentumswohnung: Building2,
  Einfamilienhaus: Home,
  Mehrfamilienhaus: Building,
  Gewerbeimmobilie: Store,
  Ferienimmobilie: TreePalm,
  Grundstück: Sprout,
};
