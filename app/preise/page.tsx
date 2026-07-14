import type { Metadata } from "next";
import Link from "next/link";
import { PartyPopper, CreditCard } from "lucide-react";
import LandingShell from "@/components/landing/Shell";
import Reveal from "@/components/landing/Reveal";
import { PLAENE, FAQ } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Preise — MyImmo",
  description:
    "MyImmo-Tarife: Kostenlos, Privat, Plus und Business — fair kalkuliert, während des Early Access komplett kostenlos.",
};

export default function PreisePage() {
  return (
    <LandingShell aktiv="/preise">
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Preise</div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Fair kalkuliert — und aktuell kostenlos</h1>
          <p className="lp-section-sub">So sollen die Tarife später aussehen. Jahreszahlung spart rund zwei Monatsbeiträge.</p>
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
