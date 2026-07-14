import Link from "next/link";
import type { ReactNode } from "react";

// Rahmen aller Landing-Seiten: Navigation mit echten Unterseiten + Footer.
// `aktiv` markiert den aktuellen Menüpunkt.

const NAV = [
  { href: "/funktionen", label: "Funktionen" },
  { href: "/preise", label: "Preise" },
  { href: "/vision", label: "Vision" },
] as const;

export default function LandingShell({
  aktiv,
  children,
}: {
  aktiv?: string;
  children: ReactNode;
}) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-inner lp-nav-row">
          <Link href="/" className="lp-logo" style={{ textDecoration: "none" }}>My<span>Immo</span></Link>
          <nav className="lp-nav-links">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={aktiv === n.href ? "lp-nav-aktiv" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="lp-nav-cta">
            <Link href="/anmelden" className="btn btn-ghost">Anmelden</Link>
            <Link href="/anmelden" className="btn btn-gold">Kostenlos starten</Link>
          </div>
        </div>
      </header>

      {children}

      <section className="lp-final lp-section-alt">
        <div className="lp-inner">
          <h2 className="lp-h2">In 2 Minuten startklar</h2>
          <p className="lp-section-sub">Konto anlegen, erstes Objekt erfassen — den Rest übernimmt MyImmo.</p>
          <div className="lp-cta-row">
            <Link href="/anmelden" className="btn btn-gold lp-btn-big">Kostenlos starten</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-inner lp-footer-row">
          <span className="lp-logo" style={{ fontSize: 15 }}>My<span>Immo</span></span>
          <Link href="/funktionen">Funktionen</Link>
          <Link href="/preise">Preise</Link>
          <Link href="/vision">Vision</Link>
          <Link href="/agb">AGB</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/avv">AVV</Link>
          <Link href="/impressum">Impressum</Link>
          <span className="spacer" />
          <span>© {new Date().getFullYear()} MyImmo</span>
        </div>
      </footer>
    </div>
  );
}
