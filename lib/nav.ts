// Geteilte Navigationsziele — von Sidebar.tsx UND CommandPalette.tsx genutzt,
// damit beide garantiert dieselben Bereiche/Icons zeigen (keine Duplikate).
import {
  BarChart3, Home, User, Banknote, ReceiptText, Zap, Landmark, Archive,
  TrendingUp, MessageSquareText, CreditCard, Map as MapIcon,
  Building2, Building, Store, TreePalm, Sprout, Percent, Compass, Handshake,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon?: LucideIcon; paragraph?: boolean };

export const VERWALTUNG: NavItem[] = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/properties", label: "Immobilien", icon: Home },
  { href: "/karte", label: "Karte", icon: MapIcon },
  { href: "/tenants", label: "Mieter", icon: User },
  { href: "/cashflow", label: "Ein- & Ausgaben", icon: Banknote },
  { href: "/mietkonto", label: "Mietkonto", icon: ReceiptText },
  { href: "/anliegen", label: "Anliegen & Bewerber", icon: MessageSquareText },
  { href: "/verbrauch", label: "Verbrauch", icon: Zap },
  { href: "/kredite", label: "Kredite", icon: Landmark },
  { href: "/banking", label: "Banking", icon: CreditCard },
  { href: "/steuer", label: "Steuer", paragraph: true },
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
