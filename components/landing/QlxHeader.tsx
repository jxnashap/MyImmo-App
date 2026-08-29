"use client";

// Fontenay-Header nach Baukasten (baukaesten/quiet-luxury): Kreis-Burger mit
// „Menü"-Label links · Logo-Lockup exakt mittig (Monogramm + Wortmarke +
// Unterzeile) · Pill-CTA rechts. Beim Scrollen wird die Bar schmaler (94 %),
// papierfarben und unten abgerundet. Das Menü ist ein Fullscreen-Overlay in
// Nachtblau mit nummerierten Serif-Links und Bildpanel.
//
// Übersetzung von js/script.js in eine Client-Komponente (CSP verbietet
// Inline-Scripts): Die Zustände liegen als data-Attribute am .qlx-Wrapper,
// das CSS schaltet zentral — wie im Original über body.nav-open/.solid.

import Link from "next/link";
import { useEffect, useState } from "react";

export type QlxNavEintrag = { href: string; label: string };

// Goldenes Haus-Monogramm — exakt die Form des App-Icons
// (public/myimmo_logo_2048.png): Dach + zwei Wände, unten OFFEN,
// keine Tür, kein Boden. Ein durchgehender Gold-Strich.
function Monogramm() {
  return (
    <svg className="qlx-mono" viewBox="0 0 44 44" aria-hidden>
      <path className="m-gold" d="M10 40 V19 L22 8 L34 19 V40" />
    </svg>
  );
}

export default function QlxHeader({
  nav,
  aktiv,
}: {
  nav: QlxNavEintrag[];
  aktiv?: string;
}) {
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    const wrapper = document.querySelector(".qlx");
    if (!wrapper) return;
    const setzen = () => wrapper.setAttribute("data-scrolled", window.scrollY > 24 ? "1" : "0");
    setzen();
    window.addEventListener("scroll", setzen, { passive: true });
    return () => window.removeEventListener("scroll", setzen);
  }, []);

  useEffect(() => {
    const wrapper = document.querySelector(".qlx");
    if (!wrapper) return;
    wrapper.setAttribute("data-menu", offen ? "1" : "0");
    document.documentElement.style.overflow = offen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [offen]);

  const zu = () => setOffen(false);

  return (
    <>
      <header className="qlx-header">
        <div className="qlx-header-bar">
          <button
            type="button"
            className="qlx-burger"
            aria-label={offen ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={offen}
            onClick={() => setOffen((o) => !o)}
          >
            <span className="qlx-burger-kreis"><i /><i /></span>
            <span className="qlx-burger-label">{offen ? "Schließen" : "Menü"}</span>
          </button>

          <Link href="/" className="qlx-brand" onClick={zu}>
            <Monogramm />
            <span className="qlx-brand-word">My<em>Immo</em></span>
            <span className="qlx-brand-sub">Privates Immobilien-Management</span>
          </Link>

          <div className="qlx-header-cta">
            <Link href="/anmelden" className="qlx-btn-linie">Anmelden</Link>
            <Link href="/anmelden" className="qlx-btn-hell">Kostenlos starten</Link>
          </div>
        </div>
      </header>

      <div className="qlx-overlay" aria-hidden={!offen}>
        <div className="qlx-overlay-inner">
          <nav aria-label="Hauptnavigation">
            <ul>
              {[{ href: "/", label: "Start" }, ...nav].map((n, i) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={aktiv === n.href ? "qlx-aktiv" : undefined}
                    onClick={zu}
                    tabIndex={offen ? 0 : -1}
                  >
                    <span className="qlx-nl-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="qlx-nl-label">{n.label}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/anmelden" onClick={zu} tabIndex={offen ? 0 : -1} style={{ fontStyle: "italic", color: "var(--l-gold-hell)" }}>
                  <span className="qlx-nl-num">→</span>
                  <span className="qlx-nl-label">Kostenlos starten</span>
                </Link>
              </li>
            </ul>
            <div className="qlx-overlay-foot">
              <Link href="/agb" onClick={zu} tabIndex={offen ? 0 : -1}>AGB</Link>
              <Link href="/datenschutz" onClick={zu} tabIndex={offen ? 0 : -1}>Datenschutz</Link>
              <Link href="/impressum" onClick={zu} tabIndex={offen ? 0 : -1}>Impressum</Link>
            </div>
          </nav>
          <div className="qlx-overlay-visual" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- dekoratives Panel */}
            <img src="/landing/dashboard.webp" alt="" loading="lazy" />
          </div>
        </div>
      </div>
    </>
  );
}
