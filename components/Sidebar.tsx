"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

type SidebarProperty = { id: string; bezeichnung: string; typ: string | null };

const VERWALTUNG: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/properties", label: "Immobilien", icon: "🏠" },
  { href: "/einnahmen", label: "Einnahmen", icon: "💰" },
  { href: "/tenants", label: "Mieter", icon: "👤" },
  { href: "/kosten", label: "Kosten & Ausgaben", icon: "📋" },
  { href: "/verbrauch", label: "Verbrauch", icon: "⚡" },
  { href: "/kredite", label: "Kredite", icon: "🏦" },
  { href: "/steuer", label: "Steuer", icon: "🧾" },
  { href: "/archiv", label: "Archiv", icon: "🗄" },
  { href: "/jahresbericht", label: "Jahresbericht", icon: "📈" },
];

const KALKULATOR: { href: string; label: string; icon: string }[] = [
  { href: "/roter-faden", label: "Roter Faden", icon: "🧵" },
  { href: "/cockpit", label: "Cockpit", icon: "🧮" },
  { href: "/bankgespraech", label: "Bankgespräch", icon: "🏦" },
];

// Emoji je Objekttyp — exakt wie in der HTML-Vorlage (propIcons).
const PROP_ICONS: Record<string, string> = {
  Eigentumswohnung: "🏢",
  Einfamilienhaus: "🏠",
  Mehrfamilienhaus: "🏘",
  Gewerbeimmobilie: "🏪",
  Ferienimmobilie: "🏖",
  Grundstück: "🌿",
};

export default function Sidebar({
  properties = [],
  userEmail,
}: {
  properties?: SidebarProperty[];
  userEmail?: string | null;
}) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const navLink = (n: { href: string; label: string; icon: string }) => (
    <Link key={n.href} href={n.href} className={`nav-item${isActive(n.href) ? " active" : ""}`}>
      <span className="icon">{n.icon}</span> {n.label}
    </Link>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href="/" style={{ textDecoration: "none" }}>
          <h1>My<span>Immo</span></h1>
        </Link>
        <p>Immobilien-Management</p>
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={userEmail ?? ""}
          >
            {userEmail ?? "–"}
          </div>
          <ThemeToggle variant="icon" />
          <Link
            href="/einstellungen"
            title="Einstellungen"
            style={{ color: "var(--faint)", fontSize: 13, padding: "2px 4px", textDecoration: "none", flexShrink: 0 }}
          >
            ⚙️
          </Link>
          <form action="/auth/signout" method="post" style={{ display: "flex" }}>
            <button
              type="submit"
              title="Abmelden"
              style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}
            >
              ⏻
            </button>
          </form>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Verwaltung</div>
        {VERWALTUNG.map(navLink)}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Kalkulator</div>
        {KALKULATOR.map(navLink)}
      </div>

      <div className="sidebar-props">
        <p>Meine Objekte</p>
        <div>
          {properties.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--faint)", padding: "4px 8px" }}>Noch keine Objekte</div>
          ) : (
            properties.map((p) => (
              <Link key={p.id} href={`/properties/${p.id}`} className="prop-mini" style={{ textDecoration: "none" }}>
                <div className="prop-mini-icon">{(p.typ && PROP_ICONS[p.typ]) || "🏠"}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="prop-mini-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bezeichnung}</div>
                  <div className="prop-mini-type">{p.typ ?? ""}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
