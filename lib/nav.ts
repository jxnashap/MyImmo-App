// Geteilte Navigationsziele — von Sidebar.tsx UND CommandPalette.tsx genutzt,
// damit beide garantiert dieselben Bereiche/Icons zeigen (keine Duplikate).
import {
  BarChart3, Home, User, Banknote, ReceiptText, Zap, Landmark, Archive,
  TrendingUp, MessageSquareText, CreditCard,
  Building2, Building, Store, TreePalm, Sprout, Percent, Compass, Handshake, Scale,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon?: LucideIcon; paragraph?: boolean };

export const VERWALTUNG: NavItem[] = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/properties", label: "Immobilien", icon: Home },
  { href: "/tenants", label: "Mieter", icon: User },
  { href: "/cashflow", label: "Ein- & Ausgaben", icon: Banknote },
  { href: "/mietkonto", label: "Mietkonto", icon: ReceiptText },
  // Nicht "Mieterportal": So heisst die Mieter-Oberflaeche unter /portal.
  // Diese Seite ist die Vermieter-Sicht und enthaelt neben Mieter-Anliegen
  // auch Bewerbungen und die Handwerker-Verwaltung.
  { href: "/anliegen", label: "Anliegen & Kontakte", icon: MessageSquareText },
  { href: "/verbrauch", label: "Verbrauch", icon: Zap },
  { href: "/kredite", label: "Kredite", icon: Landmark },
  { href: "/banking", label: "Banking", icon: CreditCard },
  { href: "/steuer", label: "Steuer", icon: Scale, paragraph: true }, // Icon nur fuer die Command-Palette; die Sidebar zeigt bewusst "§"
  { href: "/archiv", label: "Archiv", icon: Archive },
  { href: "/jahresbericht", label: "Jahresbericht", icon: TrendingUp },
];

export const KALKULATOR: NavItem[] = [
  { href: "/kauf", label: "Kauf-Assistent", icon: Compass },
  { href: "/verkauf", label: "Verkauf-Assistent", icon: Handshake },
  { href: "/bewertung", label: "Marktwert-Schätzer", icon: TrendingUp },
  { href: "/afa-assistent", label: "AfA-Assistent", icon: Percent },
];

// Icon je Objekttyp — exakt wie in der HTML-Vorlage (propIcons).
export const PROP_ICONS: Record<string, LucideIcon> = {
  Eigentumswohnung: Building2,
  Einfamilienhaus: Home,
  Mehrfamilienhaus: Building,
  Gewerbeimmobilie: Store,
  Ferienimmobilie: TreePalm,
  Grundstück: Sprout,
};
