"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

type SidebarProperty = { id: string; bezeichnung: string; typ: string | null };

const VERWALTUNG: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/properties", label: "Immobilien", icon: "🏠" },
  { href: "/tenants", label: "Mieter", icon: "👤" },
  { href: "/cashflow", label: "Ein- & Ausgaben", icon: "💶" },
  { href: "/verbrauch", label: "Verbrauch", icon: "⚡" },
  { href: "/kredite", label: "Kredite", icon: "🏦" },
  { href: "/steuer", label: "Steuer", icon: "§" },
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
  profilName,
}: {
  properties?: SidebarProperty[];
  userEmail?: string | null;
  profilName?: string | null;
}) {
  const path = usePathname();
  // Initialen fürs Profil-Avatar (JS = "Jonas Scharp"); ohne Profil "+".
  const name = (profilName ?? "").trim();
  const hatProfil = name.length > 0;
  const teile = name.split(/\s+/).filter(Boolean);
  const initialen =
    ((teile[0]?.[0] ?? "") + (teile[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
  const vorname = teile[0] ?? "";
  const [open, setOpen] = useState(false);
  // Drawer bei jedem Seitenwechsel schließen.
  useEffect(() => {
    setOpen(false);
  }, [path]);
  // Scroll des Hintergrunds sperren, solange der Drawer offen ist.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const navLink = (n: { href: string; label: string; icon: string }) => (
    <Link key={n.href} href={n.href} className={`nav-item${isActive(n.href) ? " active" : ""}`}>
      <span className="icon" style={n.icon === "§" ? { color: "var(--gold)", fontWeight: 700 } : undefined}>{n.icon}</span> {n.label}
    </Link>
  );

  return (
    <>
      {/* Mobile-Kopfleiste mit Hamburger (nur auf schmalen Screens sichtbar) */}
      <div className="mobile-bar">
        <button
          type="button"
          className="hamburger"
          aria-label="Menü öffnen"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link href="/" className="mobile-logo">
          My<span>Immo</span>
        </Link>
        <ThemeToggle variant="icon" />
      </div>

      {open ? (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      <aside className={"sidebar" + (open ? " open" : "")}>
      <div className="sidebar-logo">
        <Link href="/" style={{ textDecoration: "none" }}>
          <h1>My<span>Immo</span></h1>
        </Link>
        <p>Immobilien-Management</p>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Avatar = Button zu den Einstellungen (ersetzt das Zahnrad) */}
          <Link href="/einstellungen" title="Einstellungen" aria-label="Einstellungen" style={{ textDecoration: "none", flexShrink: 0 }}>
            <div className="settings-avatar" style={{ width: 36, height: 36, fontSize: 13, cursor: "pointer" }}>
              {hatProfil ? initialen : "+"}
            </div>
          </Link>
          {/* Vorname + E-Mail */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {vorname && (
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vorname}</div>
            )}
            <div style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={userEmail ?? ""}>
              {userEmail ?? "–"}
            </div>
          </div>
          {/* Theme-Umschalter bleibt */}
          <ThemeToggle variant="icon" />
          {/* Abmelden — rot nur bei Hover */}
          <form action="/auth/signout" method="post" style={{ display: "flex" }}>
            <button type="submit" className="logout-btn" title="Abmelden" aria-label="Abmelden">⏻</button>
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

      <div
        style={{
          marginTop: "auto",
          padding: "12px 8px 4px",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          fontSize: 10,
          color: "var(--faint)",
        }}
      >
        <Link href="/datenschutz" style={{ color: "var(--faint)", textDecoration: "none" }}>Datenschutz</Link>
        <Link href="/avv" style={{ color: "var(--faint)", textDecoration: "none" }}>AVV</Link>
        <Link href="/impressum" style={{ color: "var(--faint)", textDecoration: "none" }}>Impressum</Link>
      </div>
      </aside>
    </>
  );
}
