import type { Metadata } from "next";
import Link from "next/link";
import LandingShell from "@/components/landing/Shell";
import QlxHero from "@/components/landing/QlxHero";
import Reveal from "@/components/landing/Reveal";
import VerteilerForm from "@/components/landing/VerteilerForm";
import {
  FileText, BellRing, AlertTriangle, DoorClosed, Wrench, Receipt,
  BadgeCheck, ClipboardCheck, ScrollText, HandCoins, ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Kostenlose Vorlagen für Vermieter — MyImmo",
  description:
    "Mieterhöhung, Kündigung, Mahnung, Wohnungsgeberbestätigung, Übergabeprotokoll und mehr — rechtssichere Vorlagen, in MyImmo mit einem Klick personalisiert als PDF.",
  alternates: { canonical: "/vorlagen" },
  openGraph: { images: ["/og.png"] },
};

const VORLAGEN = [
  { ico: FileText, t: "Mieterhöhung (§ 558 BGB)", p: "Mieterhöhungsverlangen bis zur ortsüblichen Vergleichsmiete — mit korrekter Begründung und Frist." },
  { ico: BellRing, t: "Zahlungserinnerung", p: "Freundliche Erinnerung bei ausstehender Miete, mit Betrag und Kontodaten vorausgefüllt." },
  { ico: AlertTriangle, t: "Mahnung", p: "Förmliche Mahnung mit Zahlungsfrist — der nächste Schritt nach der Erinnerung." },
  { ico: DoorClosed, t: "Kündigung des Mietverhältnisses", p: "Ordentliche oder außerordentliche Kündigung mit den passenden Fristen." },
  { ico: Wrench, t: "Reparatur-Ankündigung", p: "Ankündigung von Instandhaltungs- oder Modernisierungsarbeiten mit Termin." },
  { ico: Receipt, t: "NK-Abrechnung — Anschreiben", p: "Begleitschreiben zur Nebenkostenabrechnung mit Saldo (Nachzahlung oder Guthaben)." },
  { ico: BadgeCheck, t: "Wohnungsgeberbestätigung (§ 19 BMG)", p: "Pflichtbescheinigung für die Anmeldung des Mieters beim Einwohnermeldeamt." },
  { ico: ClipboardCheck, t: "Mietbescheinigung", p: "Bestätigung des Mietverhältnisses, z. B. für Behörden oder Banken." },
  { ico: HandCoins, t: "Mietquittung (§ 368 BGB)", p: "Quittung über gezahlte Miete — auf Verlangen des Mieters auszustellen." },
  { ico: ScrollText, t: "Übergabeprotokoll", p: "Wohnungsübergabe bei Ein- oder Auszug: Zählerstände, Zustand, Schlüssel — beweissicher." },
];

// Rückmeldungen der Double-Opt-in-Routen (/api/newsletter/*). Sie leiten mit
// ?nl=... hierher zurück, statt eine eigene Seite zu bekommen — der Besucher
// landet dort, wo er hergekommen ist.
const NL_MELDUNG: Record<string, { text: string; gut: boolean }> = {
  ok: { text: "Danke — deine Anmeldung ist bestätigt. Du bekommst Bescheid, sobald es neue Vorlagen gibt.", gut: true },
  abgemeldet: { text: "Du bist abgemeldet. Wir schicken dir keine weiteren E-Mails.", gut: true },
  abgelaufen: { text: "Dieser Bestätigungslink ist abgelaufen. Bitte trag dich unten erneut ein.", gut: false },
  fehler: { text: "Der Link ist ungültig. Bitte trag dich unten erneut ein.", gut: false },
};

export default function VorlagenPage({ searchParams }: { searchParams: { nl?: string } }) {
  const meldung = searchParams.nl ? NL_MELDUNG[searchParams.nl] : undefined;
  return (
    // ohneSchlussCta: Die Seite hat ihren eigenen Gold-CTA — sonst stünden
    // zwei „Kostenlos …"-Bänder direkt übereinander.
    <LandingShell aktiv="/vorlagen" mitHero ohneSchlussCta>
      <QlxHero
        slug="vorlagen"
        kompakt
        kicker="Vorlagen"
        titel={<>Rechtssichere Vorlagen — <em>in Sekunden fertig</em></>}
        sub="Statt Word-Dokumente mühsam auszufüllen: Vorlage wählen, der Rest wird aus deinen Objekt- und Mieterdaten automatisch ergänzt — als sauberes PDF im Geschäftsbriefstil. Kostenlos im Early Access."
      />
      <section className="lp-section">
        <div className="lp-inner">
          {meldung && (
            <div
              role="status"
              style={{
                background: "var(--l-bg3)",
                borderLeft: `3px solid ${meldung.gut ? "var(--l-green)" : "var(--l-red)"}`,
                borderRadius: 8,
                padding: "14px 18px",
                marginBottom: 22,
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--l-ink)",
              }}
            >
              {meldung.text}
            </div>
          )}
          <div className="lp-features" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {VORLAGEN.map((v, i) => {
              const Ico = v.ico;
              return (
                <Reveal key={v.t} delay={i * 45} className="lp-reveal-fill">
                  <div className="lp-feature" style={{ height: "100%" }}>
                    <div className="ico"><Ico size={20} style={{ color: "var(--l-gold-dark)" }} /></div>
                    <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>{v.t}</h3>
                    <p style={{ fontSize: 13, color: "var(--l-muted)", margin: 0, lineHeight: 1.55 }}>{v.p}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <div style={{ maxWidth: 640, margin: "36px auto 0" }}>
            <VerteilerForm quelle="vorlagen" />
          </div>
          <div className="lp-cta-row" style={{ marginTop: 28 }}>
            <Link href="/anmelden" className="btn btn-gold lp-btn-big">Vorlagen kostenlos nutzen <ArrowRight size={15} style={{ verticalAlign: "-2px" }} /></Link>
          </div>
          <p className="lp-section-sub" style={{ marginTop: 24, marginBottom: 0, fontSize: 12.5 }}>
            Alle Vorlagen werden mit deinen Daten personalisiert und lassen sich vor dem Export bearbeiten.
            Anhaltspunkte ohne Gewähr, keine Rechtsberatung.
          </p>
        </div>
      </section>
    </LandingShell>
  );
}
