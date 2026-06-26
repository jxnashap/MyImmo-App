import { Building2, User, Tag, Percent, CalendarDays, Zap, Layers, type LucideIcon } from "lucide-react";

// String→Icon-Registry: erlaubt es, Filter-Configs aus Server-Komponenten
// (nur serialisierbare Strings) an die Client-FilterBar zu übergeben.
export const FILTER_ICONS = {
  home: Building2,
  user: User,
  tag: Tag,
  umlage: Percent,
  jahr: CalendarDays,
  art: Zap,
  quelle: Layers,
} satisfies Record<string, LucideIcon>;

export type FilterIcon = keyof typeof FILTER_ICONS;
