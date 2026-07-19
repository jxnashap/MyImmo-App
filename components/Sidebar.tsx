"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import CommandPalette from "@/components/ui/CommandPalette";
import { VERWALTUNG, KALKULATOR, PROP_ICONS, type NavItem } from "@/lib/nav";
import { Home, Power, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";

type SidebarProperty = { id: string; bezeichnung: string; typ: string | null };

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
  // Ein-/Ausklapp-Zustand (Icon-Rail, nur Desktop). Persistiert wie das Theme
  // in localStorage + Attribut am <html> (kein Flackern, siehe app/layout.tsx).
  const [rail, setRail] = useState(false);
  useEffect(() => {
    try {
      setRail(localStorage.getItem("rail") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleRail = () => {
    setRail((r) => {
      const next = !r;
      try {
        localStorage.setItem("rail", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      document.documentElement.setAttribute("data-rail", next ? "1" : "0");
      return next;
    });
  };
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

  const navLink = (n: NavItem) => (
    <Link key={n.href} href={n.href} className={`nav-item${isActive(n.href) ? " active" : ""}`} title={n.label}>
      <span className="icon" style={n.paragraph ? { color: "var(--gold)", fontWeight: 700 } : { display: "inline-flex", alignItems: "center" }}>
        {n.paragraph || !n.icon ? "§" : <n.icon size={15} />}
      </span>
      <span className="nav-label">{n.label}</span>
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
        <div className="sidebar-userrow" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {/* Avatar = Button zu den Einstellungen (ersetzt das Zahnrad) */}
          <Link href="/einstellungen" title="Einstellungen" aria-label="Einstellungen" style={{ textDecoration: "none", flexShrink: 0 }}>
            <div className="settings-avatar" style={{ width: 36, height: 36, fontSize: 13, cursor: "pointer" }}>
              {hatProfil ? initialen : "+"}
            </div>
          </Link>
          {/* Vorname + E-Mail */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {vorname && (
              <div className="sidebar-username" style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vorname}</div>
            )}
            <div className="sidebar-useremail" style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={userEmail ?? ""}>
              {userEmail ?? "–"}
            </div>
          </div>
          {/* Theme-Umschalter bleibt */}
          <ThemeToggle variant="icon" />
          {/* Abmelden — rot nur bei Hover */}
          <form action="/auth/signout" method="post" style={{ display: "flex" }}>
            <button type="submit" className="logout-btn" title="Abmelden" aria-label="Abmelden"><Power size={14} /></button>
          </form>
        </div>
        <CommandPalette properties={properties} />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Verwaltung</div>
        {VERWALTUNG.map(navLink)}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Kalkulator</div>
        {KALKULATOR.map(navLink)}
        <Link href="/einstellungen" className={`nav-item${isActive("/einstellungen") ? " active" : ""}`}>
          <span className="icon" style={{ display: "inline-flex", alignItems: "center" }}><Settings size={15} /></span> Einstellungen
        </Link>
      </div>

      <div className="sidebar-props">
        <p>Meine Objekte</p>
        <div>
          {properties.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--faint)", padding: "4px 8px" }}>Noch keine Objekte</div>
          ) : (
            properties.map((p) => (
              <Link key={p.id} href={`/properties/${p.id}`} className="prop-mini" title={p.bezeichnung} style={{ textDecoration: "none" }}>
                <div className="prop-mini-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {(() => { const Icon = (p.typ && PROP_ICONS[p.typ]) || Home; return <Icon size={15} />; })()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="prop-mini-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bezeichnung}</div>
                  <div className="prop-mini-type">{p.typ ?? ""}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={toggleRail}
        aria-label={rail ? "Menü ausklappen" : "Menü einklappen"}
        title={rail ? "Menü ausklappen" : "Menü einklappen"}
      >
        {rail ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        <span>Einklappen</span>
      </button>

      <div
        style={{
          padding: "4px 8px 4px",
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
