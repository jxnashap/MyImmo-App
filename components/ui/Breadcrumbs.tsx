import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

// Schlanke Brotkrumen-Navigation. Serverkompatibel (kein "use client" nötig).
// Letztes Segment ist immer die aktuelle Seite (nicht verlinkt, gedämpft).
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav className="breadcrumb" aria-label="Brotkrumen">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {!isLast && c.href ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span className="current" aria-current={isLast ? "page" : undefined}>{c.label}</span>
            )}
            {!isLast ? <ChevronRight size={12} className="sep" aria-hidden="true" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
