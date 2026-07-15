import type { Metadata } from "next";
import { Plane } from "lucide-react";
import LandingShell from "@/components/landing/Shell";
import Reveal from "@/components/landing/Reveal";
import Tilt from "@/components/landing/Tilt";
import { VISION } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Vision — MyImmo",
  description:
    "Die MyImmo-Vision: im Ausland leben und den Immobilienbestand in Deutschland vollständig aus der App steuern — mit Team-Rollen, Banking-Abgleich und Steuerberater-Freigabe.",
};

export default function VisionPage() {
  return (
    <LandingShell aktiv="/vision">
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Die Vision</div>
          <div style={{ textAlign: "center", marginTop: 12 }}><Plane size={30} style={{ color: "var(--gold)" }} /></div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(28px, 4vw, 40px)", marginTop: 4 }}>
            Leben, wo du willst. Verwalten, als wärst du da.
          </h1>
          <p className="lp-section-sub" style={{ maxWidth: 680 }}>
            MyImmo entsteht aus einem konkreten Ziel: im Ausland leben und den Immobilienbestand in
            Deutschland vollständig aus der App steuern. Kein Papierkram, der auf dem Küchentisch wartet.
            Kein Anruf, der dich um 7 Uhr Ortszeit weckt.
          </p>

          <Reveal>
            <div className="lp-cards3">
              <div className="lp-card">
                <span className="lp-vorher" style={{ color: "var(--gold)" }}>Heute schon</span>
                <h3>Das Team arbeitet vor Ort</h3>
                <p>Mieter melden Anliegen digital, der Hausmeister legt Aufträge an, Firmen bekommen Termin-Links — du gibst nur noch frei. Alles läuft über Rollen, nichts über deinen Anrufbeantworter.</p>
              </div>
              <div className="lp-card">
                <span className="lp-vorher" style={{ color: "var(--gold)" }}>Heute schon</span>
                <h3>Papierkram wird zu PDFs</h3>
                <p>Nebenkostenabrechnung, Mahnung, Anlage V, Jahresbericht: fertige Dokumente im eigenen Briefkopf — erzeugt in Sekunden, abgelegt im Archiv, verschickt von überall.</p>
              </div>
              <div className="lp-card">
                <span className="lp-vorher" style={{ color: "var(--gold)" }}>Heute schon</span>
                <h3>Zahlen ohne Zettel</h3>
                <p>Cashflow, Rendite, Restschuld und Fristen leben in der App statt in Excel — mit automatischen Warnungen, bevor etwas anbrennt.</p>
              </div>
            </div>
          </Reveal>

          <h2 className="lp-h2" style={{ marginTop: 64 }}>Die Roadmap</h2>
          <p className="lp-section-sub">Was als Nächstes kommt — ehrlich unterteilt in „in Arbeit" und „geplant".</p>
          <div className="lp-cards3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {VISION.map((v, i) => (
              <Reveal key={v.t} delay={i * 70}>
                <Tilt>
                  <div className="lp-card" style={{ height: "100%" }}>
                    <span className="lp-vorher" style={v.status === "bald" ? { color: "var(--gold)" } : undefined}>
                      {v.status === "bald" ? "In Arbeit" : "Geplant"}
                    </span>
                    <h3>{v.t}</h3>
                    <p>{v.p}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="lp-section-sub" style={{ marginTop: 48, marginBottom: 0, maxWidth: 680 }}>
              Der Maßstab für jede neue Funktion ist derselbe: Lässt sich damit eine Sache mehr aus der
              Ferne erledigen, die heute noch Präsenz, Papier oder ein Telefonat verlangt? Wenn ja,
              wird sie gebaut.
            </p>
          </Reveal>
        </div>
      </section>
    </LandingShell>
  );
}
