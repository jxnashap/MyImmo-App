import Link from "next/link";
import type { ReactNode } from "react";
import { PREISE_SICHTBAR } from "@/lib/preise";

// Rahmen aller Landing-Seiten: Navigation mit echten Unterseiten + Footer.
// `aktiv` markiert den aktuellen Menüpunkt.

// „Preise" erscheint erst, wenn die Tarife oeffentlich gelten sollen
// (lib/preise.ts) — solange das Bezahlsystem inaktiv ist, waeren die Betraege
// unverbindlich und wuerden trotzdem eine Erwartung erzeugen. Die Route bleibt
// aber im Menue: dort steht dann die FAQ, die es sonst nirgends gibt.
const PREIS_LINK = { href: "/preise", label: PREISE_SICHTBAR ? "Preise" : "FAQ" };

const NAV = [
  { href: "/funktionen", label: "Funktionen" },
  PREIS_LINK,
  { href: "/ratgeber", label: "Ratgeber" },
  { href: "/vorlagen", label: "Vorlagen" },
  { href: "/vision", label: "Vision" },
];

export default function LandingShell({
  aktiv,
  children,
}: {
  aktiv?: string;
  children: ReactNode;
}) {
  return (
    <div className="lp lp3">
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
          <Link href="/preise">{PREIS_LINK.label}</Link>
          <Link href="/ratgeber">Ratgeber</Link>
          <Link href="/vorlagen">Vorlagen</Link>
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
