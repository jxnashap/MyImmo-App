import type { Metadata } from "next";
import Link from "next/link";
import LandingShell from "@/components/landing/Shell";
import Reveal from "@/components/landing/Reveal";
import { RATGEBER, ratgeberDatum } from "@/lib/ratgeber";
import { ArrowRight, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Ratgeber für Vermieter — MyImmo",
  description:
    "Praxiswissen für private Vermieter: Nebenkostenabrechnung, Steuer, Fristen und der Einstieg in die Vermietung — verständlich erklärt.",
  alternates: { canonical: "/ratgeber" },
};

export default function RatgeberIndex() {
  return (
    <LandingShell aktiv="/ratgeber">
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Ratgeber</div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Praxiswissen für Vermieter</h1>
          <p className="lp-section-sub">
            Nebenkosten, Steuer, Fristen und der Einstieg in die Vermietung — verständlich erklärt, mit Bezug auf die passenden MyImmo-Funktionen.
          </p>
          <div className="lp-cards3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", alignItems: "stretch" }}>
            {RATGEBER.map((a, i) => (
              <Reveal key={a.slug} delay={i * 60} className="lp-reveal-fill">
                <Link href={`/ratgeber/${a.slug}`} className="lp-card" style={{ display: "flex", flexDirection: "column", height: "100%", textDecoration: "none" }}>
                  <span className="lp-vorher" style={{ color: "var(--l-gold-dark)" }}>{a.kategorie}</span>
                  <h3 style={{ marginBottom: 8 }}>{a.titel}</h3>
                  <p style={{ flex: 1 }}>{a.beschreibung}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "var(--l-faint)" }}>
                    <span><Clock size={12} style={{ verticalAlign: "-2px" }} /> {a.lesezeit} Min · {ratgeberDatum(a.datum)}</span>
                    <span style={{ color: "var(--l-gold-dark)", fontWeight: 600 }}>Lesen <ArrowRight size={12} style={{ verticalAlign: "-2px" }} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <p className="lp-section-sub" style={{ marginTop: 32, marginBottom: 0, fontSize: 12.5 }}>
            Alle Angaben sind Anhaltspunkte ohne Gewähr und ersetzen keine Steuer- oder Rechtsberatung.
          </p>
        </div>
      </section>
    </LandingShell>
  );
}
