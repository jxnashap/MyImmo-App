import Link from "next/link";
import { REGISTRIERUNG_OFFEN } from "@/lib/preise";
import StartCta from "@/components/StartCta";
import StartBenachrichtigung from "@/components/landing/StartBenachrichtigung";
import { brevoBereit } from "@/lib/mail/brevo";
import type { ReactNode } from "react";
import { PREISE_SICHTBAR } from "@/lib/preise";
import QlxHeader from "@/components/landing/QlxHeader";

// Rahmen aller Landing-Seiten — Quiet-Luxury-Bauweise (QLX): fixierter
// Fontenay-Header mit Overlay-Menü, Abschluss-CTA und Footer auf der
// Nachtblau-Bühne. `aktiv` markiert den aktuellen Menüpunkt.
//
// `mitHero`: Die sechs Reiter-Seiten bringen einen eigenen Cinematic-Hero mit
// (QlxHero) — dort steht der Header transparent auf dem Video. Alle übrigen
// Seiten (Ratgeber-Artikel, Funktions-Detailseiten) bekommen stattdessen ein
// schmales Nachtblau-Band, damit der Header nie auf hellem Grund hängt.

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
  mitHero = false,
  ohneSchlussCta = false,
  children,
}: {
  aktiv?: string;
  mitHero?: boolean;
  /** Für Seiten, die ein EIGENES Abschluss-CTA mitbringen (Startseite) —
      sonst stünden zwei Start-CTA-Bänder direkt untereinander. */
  ohneSchlussCta?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="lp qlx" data-scrolled="0" data-menu="0">
      <QlxHeader nav={NAV} aktiv={aktiv} />
      {!mitHero && <div className="qlx-band" aria-hidden />}

      {children}

      {!ohneSchlussCta && (
        <section className="lp-final">
          <div className="lp-inner">
            {REGISTRIERUNG_OFFEN ? (
              <>
                <h2 className="lp-h2">In 2 Minuten <em>startklar</em></h2>
                <p className="lp-section-sub">Konto anlegen, erstes Objekt erfassen — den Rest übernimmt MyImmo.</p>
              </>
            ) : (
              <>
                <h2 className="lp-h2">Bald <em>für alle</em></h2>
                <p className="lp-section-sub">MyImmo öffnet bald für alle Vermieter. Bis dahin zeigt die Demo jede Funktion mit Beispieldaten.</p>
              </>
            )}
            <div className="lp-cta-row">
              <StartCta className="qlx-btn-hell lp-btn-big" />
              {!REGISTRIERUNG_OFFEN && <a href="/api/demo" className="qlx-btn-linie lp-btn-big">Demo ansehen</a>}
            </div>
            {!REGISTRIERUNG_OFFEN && brevoBereit() && <StartBenachrichtigung />}
          </div>
        </section>
      )}

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
