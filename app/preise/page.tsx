import type { Metadata } from "next";
import Link from "next/link";
import { PartyPopper, CreditCard } from "lucide-react";
import LandingShell from "@/components/landing/Shell";
import QlxHero from "@/components/landing/QlxHero";
import Reveal from "@/components/landing/Reveal";
import { PLAENE, FAQ } from "@/components/landing/data";
import { PREISE_SICHTBAR } from "@/lib/preise";

// Solange PREISE_SICHTBAR false ist (lib/preise.ts), nennt diese Seite KEINE
// Betraege. Die Route bleibt trotzdem bestehen: sie ist verlinkt worden und
// von Suchmaschinen erfasst — ein 404 waere hier die schlechtere Antwort als
// eine ehrliche Early-Access-Auskunft. Die FAQ bleibt der eigentliche Inhalt.
export const metadata: Metadata = PREISE_SICHTBAR
  ? {
      title: "Preise — MyImmo",
      description:
        "MyImmo-Tarife: Kostenlos, Privat, Plus und Business — fair kalkuliert, während des Early Access komplett kostenlos.",
    }
  : {
      title: "Häufige Fragen — MyImmo",
      description:
        "MyImmo ist im Early Access und aktuell kostenlos. Antworten zu Datenschutz, Banking-Anbindung, Steuer und Nutzung.",
      // Nicht indexieren, solange hier keine Tarife stehen — sonst steht die
      // Seite als „Preise" im Suchergebnis und liefert dann keine.
      robots: { index: false, follow: true },
    };

export default function PreisePage() {
  return (
    <LandingShell aktiv="/preise" mitHero>
      <QlxHero
        slug="preise"
        kompakt
        kicker={PREISE_SICHTBAR ? "Preise" : "Early Access"}
        titel={PREISE_SICHTBAR
          ? <>Fair kalkuliert — <em>und aktuell kostenlos</em></>
          : <>MyImmo ist <em>aktuell kostenlos</em></>}
        sub={PREISE_SICHTBAR
          ? "So sollen die Tarife später aussehen. Jahreszahlung spart rund zwei Monatsbeiträge."
          : "Voller Funktionsumfang im Early Access — Bezahltarife werden rechtzeitig angekündigt, dein Konto wird nie automatisch kostenpflichtig."}
      />
      <section className="lp-section">
        <div className="lp-inner">

          {PREISE_SICHTBAR ? (
            <>
              <div className="lp-early">
                <PartyPopper size={14} style={{ verticalAlign: "-2px" }} /> Early Access: Während der Startphase ist der volle Funktionsumfang kostenlos — Bezahltarife werden rechtzeitig angekündigt.
              </div>
              <div className="lp-pricing">
                {PLAENE.map((p, i) => (
                  <Reveal key={p.name} delay={i * 70} className="lp-reveal-fill">
                    <div className={`lp-plan${p.highlight ? " lp-plan-highlight" : ""}`} style={{ height: "100%" }}>
                      {p.tag && <span className="lp-plan-tag">{p.tag}</span>}
                      <h3>{p.name}</h3>
                      <div className="lp-einheiten">{p.einheiten}</div>
                      <div className="lp-price">{p.preis}{p.preis.endsWith("€") && <small> / Monat</small>}</div>
                      <div className="lp-price-jahr">{p.jahr ?? ""}</div>
                      <ul>
                        {p.punkte.map((pt) => <li key={pt}>{pt}</li>)}
                      </ul>
                      <Link href={p.ctaHref ?? "/anmelden"} className={`btn ${p.highlight ? "btn-gold" : "btn-ghost"}`}>{p.cta}</Link>
                    </div>
                  </Reveal>
                ))}
              </div>
              <p className="lp-section-sub" style={{ marginTop: 18, marginBottom: 0, fontSize: 13 }}>
                <CreditCard size={14} style={{ verticalAlign: "-2px", color: "var(--gold)" }} />{" "}
                <strong>Add-on Banking:</strong> Die Konto-Anbindung verursacht laufende Kosten je Bankverbindung
                und wird deshalb als optionales Add-on zu Privat/Plus/Business angeboten — Preis wird mit dem
                Start bekannt gegeben. Ohne Add-on funktioniert alles andere uneingeschränkt.
              </p>
            </>
          ) : (
            <>
              <p className="lp-section-sub">
                Der volle Funktionsumfang steht ohne Zahlung zur Verfügung — es gibt keine
                Testphase, die abläuft, und es wird keine Zahlungsmethode hinterlegt.
              </p>
              <div className="lp-early">
                <PartyPopper size={14} style={{ verticalAlign: "-2px" }} /> Early Access: Bezahltarife stehen noch nicht fest und werden rechtzeitig angekündigt. Dein Konto wird dabei nicht automatisch kostenpflichtig — du entscheidest selbst, ob und welchen Tarif du dann buchst, und behältst in jedem Fall Zugriff auf deine Daten und den vollständigen Datenexport.
              </div>
              <div className="lp-cta-row" style={{ marginTop: 26 }}>
                <Link href="/anmelden" className="btn btn-gold lp-btn-big">Kostenlos starten</Link>
                <Link href="/funktionen" className="btn btn-ghost lp-btn-big">Funktionen ansehen</Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="lp-section lp-section-alt" id="faq" style={{ borderBottom: "none" }}>
        <div className="lp-inner">
          <div className="lp-kicker">FAQ</div>
          <h2 className="lp-h2">Häufige Fragen</h2>
          <p className="lp-section-sub">Kurz beantwortet — Details stehen in AGB und Datenschutzerklärung.</p>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="lp-faq-body">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
