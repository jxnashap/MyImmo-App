"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import CommandPalette from "@/components/ui/CommandPalette";
import { PROP_ICONS, type NavItem } from "@/lib/nav";
import { BEREICHE, eigenerBereich, type Bereich } from "@/lib/bereich";
import BereichWechsel from "@/components/BereichWechsel";
import { istDemoKonto, demoDarfRoute } from "@/lib/demo";
import { Home, Power, PanelLeftClose, PanelLeftOpen, Settings, Lock } from "lucide-react";

type SidebarProperty = { id: string; bezeichnung: string; typ: string | null };
type SidebarTenant = { id: string; name: string };

export default function Sidebar({
  properties = [],
  tenants = [],
  userEmail,
  profilName,
  badges = {},
}: {
  properties?: SidebarProperty[];
  tenants?: SidebarTenant[];
  userEmail?: string | null;
  profilName?: string | null;
  /** Zähler je Route ("/anliegen": 3) — 0/undefined blendet aus. */
  badges?: Record<string, number>;
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
  // MyImmo oder BuyImmo — folgt der Adresse (lib/bereich.ts). Gemeinsame Seiten
  // (Einstellungen, Objekt-Detail) behalten den Bereich, aus dem man kam. Nachgezogen
  // WÄHREND des Renderns (React-Muster „Zustand an Props anpassen“), nicht im Effekt —
  // sonst stünde nach jedem Wechsel einen Augenblick lang die falsche Navigation da.
  const eigener = eigenerBereich(path);
  const [letzter, setLetzter] = useState<Bereich>(eigener ?? "verwaltung");
  if (eigener && eigener !== letzter) setLetzter(eigener);
  const bereich = eigener ?? letzter;
  // Ein-/Ausklapp-Zustand (Icon-Rail, nur Desktop). Persistiert wie das Theme
  // in localStorage + Attribut am <html> (kein Flackern, siehe app/layout.tsx).
  const [rail, setRail] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesen — beim Server-Rendern gibt es ihn nicht (Hydration)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Drawer bei jedem Seitenwechsel schließen
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

  const demo = istDemoKonto(userEmail);

  // Kaufweg (BuyImmo, 06.10.2026): Schritte zeigen ihre Nummer statt eines Symbols — die
  // Reihenfolge links ist der Weg. Im eingeklappten Rail bleibt die Zahl als Kreis stehen.
  const navSymbol = (n: NavItem) =>
    n.schritt ? (
      <span className="icon nav-schritt" aria-hidden>{n.schritt}</span>
    ) : (
      <span className="icon" style={n.paragraph ? { color: "var(--gold)", fontWeight: 700 } : { display: "inline-flex", alignItems: "center" }}>
        {n.paragraph || !n.icon ? "§" : <n.icon size={15} />}
      </span>
    );

  const navLink = (n: NavItem) => {
    const anzahl = badges[n.href] ?? 0;

    // Demo-Konto: gesperrte Bereiche bleiben SICHTBAR — ein Interessent soll
    // den Umfang sehen. Die Sperre selbst steht in der Middleware.
    //
    // Ein echter Link, kein `<span>` (Review 30.09.2026): Der `<span>` mit
    // `title` reagierte auf einen Klick gar nicht, und auf dem Handy gibt es
    // kein Hovern — die Navigation wirkte kaputt. Den Klick fängt jetzt
    // `components/DemoSperre.tsx` ab und erklärt den Bereich. Bewusst `<a>`
    // statt `<Link>`: `<Link>` würde das gesperrte Ziel vorab laden.
    if (demo && !demoDarfRoute(n.href)) {
      return (
        <a key={n.href} href={n.href} className="nav-item nav-gesperrt">
          {navSymbol(n)}
          <span className="nav-label">{n.label}</span>
          <span className="sr-only"> (in der Demo gesperrt)</span>
          <Lock size={12} style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden />
        </a>
      );
    }

    return (
      <Link
        key={n.href}
        href={n.href}
        className={`nav-item${isActive(n.href) ? " active" : ""}`}
        // Aktiver Punkt war nur farblich markiert — Screenreader erfuhren ihn nicht.
        aria-current={isActive(n.href) ? "page" : undefined}
        // "neu" war falsch: Gezaehlt werden OFFENE Vorgaenge und im laufenden
        // Monat unbestaetigte Mieten — die heissen auch nach Wochen noch so.
        title={anzahl > 0 ? `${n.label} — ${anzahl} offen` : n.label}
      >
        {navSymbol(n)}
        <span className="nav-label">{n.label}</span>
        {anzahl > 0 && (
          <span className="nav-badge" aria-label={`${anzahl} offen`}>{anzahl > 99 ? "99+" : anzahl}</span>
        )}
      </Link>
    );
  };

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
        <Link href={BEREICHE[bereich].start} className="mobile-logo">
          {BEREICHE[bereich].marke}<span>Immo</span>
        </Link>
        <ThemeToggle variant="icon" />
      </div>

      {open ? (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      <aside className={"sidebar" + (open ? " open" : "")}>
      <div className="sidebar-logo">
        {/* Logo = Umschalter MyImmo ↔ BuyImmo (05.10.2026). */}
        <BereichWechsel bereich={bereich} />
        <div className="sidebar-userrow" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {/* Avatar = Button zu den Einstellungen (ersetzt das Zahnrad).
              Im Rail bleibt NUR dieser Kreis stehen (Name/Mail/Theme/Logout aus). */}
          <Link href="/einstellungen" className="avatar-link" title="Einstellungen" aria-label="Einstellungen" style={{ textDecoration: "none", flexShrink: 0 }}>
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
          {/* Abmelden — rot nur bei Hover. display kommt aus dem CSS, NICHT
              inline: Das Inline-Style hat die Rail-Regel überstimmt, die im
              eingeklappten Zustand alles außer dem Initialen-Kreis ausblendet. */}
          <form action="/auth/signout" method="post" className="sidebar-logout-form">
            <button type="submit" className="logout-btn" title="Abmelden" aria-label="Abmelden"><Power size={14} /></button>
          </form>
        </div>
        <CommandPalette properties={properties} tenants={tenants} />
      </div>

      {/* <aside> allein meldet "complementary" — die Links brauchen ein
          echtes navigation-Landmark, damit Screenreader sie anspringen können. */}
      <nav aria-label="Hauptnavigation">
      {/* Die Gruppen des offenen Bereichs. Seit der Teilung (05.10.2026) hat jeder Bereich
          höchstens sechs Punkte je Gruppe — das frühere eingeklappte „Planen“ ist nach
          BuyImmo gezogen und braucht kein <details> mehr. */}
      {BEREICHE[bereich].gruppen.map((g) => (
        <div key={g.titel} className="sidebar-section">
          <div className="sidebar-section-label">{g.titel}</div>
          {g.ziele.map(navLink)}
        </div>
      ))}

      <div className="sidebar-section">
        <Link href="/einstellungen" className={`nav-item${isActive("/einstellungen") ? " active" : ""}`} title="Einstellungen">
          {/* Label in .nav-label, sonst bleibt der Text im eingeklappten Rail
              stehen und quetscht sich neben das Icon. Auch in der Demo offen:
              dort liegen Profil und Support. */}
          <span className="icon" style={{ display: "inline-flex", alignItems: "center" }}><Settings size={15} /></span>
          <span className="nav-label">Einstellungen</span>
        </Link>
      </div>
      </nav>

      <div className="sidebar-props">
        <p>Meine Objekte</p>
        <div>
          {properties.length === 0 ? (
            <div className="props-leer" style={{ fontSize: 12, color: "var(--muted)", padding: "4px 8px" }}>Noch keine Objekte</div>
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

      {/* Klasse statt reiner Inline-Styles, damit der Rail-Block die Zeile
          ausblenden kann — im 68px-Rail stapelten sich die drei Links sonst. */}
      <div className="sidebar-rechtslinks">
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/avv">AVV</Link>
        <Link href="/impressum">Impressum</Link>
      </div>
      </aside>
    </>
  );
}
