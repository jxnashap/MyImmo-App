import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";
import LandingShell from "@/components/landing/Shell";
import Reveal from "@/components/landing/Reveal";
import Tilt from "@/components/landing/Tilt";
import Hero3D from "@/components/landing/Hero3D";
import { FEATURES, ROLLEN, PLAENE, SOON_BADGE, Shot } from "@/components/landing/data";

// Kompakte Startseite für ausgeloggte Besucher — Details liegen auf den
// Unterseiten /funktionen, /preise und /vision (echte Mehrseiten-Navigation).

export default function LandingPage() {
  const topFeatures = FEATURES.slice(0, 6);

  return (
    <LandingShell>
      {/* ---------- Hero: Text + 3D-Szene ---------- */}
      <section className="lp-section" style={{ paddingBottom: 0 }}>
        <div className="lp-inner lp-hero2">
          <div>
            <span className="lp-badge"><span className="dot" />Early Access — aktuell alles kostenlos</span>
            <h1 className="lp-h1">Deine Immobilien. <em>Verwaltet von überall.</em></h1>
            <p className="lp-sub">
              Mieten, Kosten, Nebenkosten, Steuer und dein ganzes Team — Mieter, Hausmeister,
              Handwerker — in einer aufgeräumten App. Gemacht für private Vermieter, die ihren
              Bestand im Griff haben wollen, egal wo sie gerade sind.
            </p>
            <div className="lp-cta-row">
              <Link href="/anmelden" className="btn btn-gold lp-btn-big">Kostenlos starten</Link>
              <Link href="/funktionen" className="btn btn-ghost lp-btn-big">Alle Funktionen</Link>
            </div>
            <p className="lp-hero-note">Keine Kreditkarte nötig · Daten in der EU · jederzeit kündbar</p>
          </div>
          <Reveal><Hero3D /></Reveal>
        </div>
        <div className="lp-inner">
          <Reveal>
            <div className="lp-stats">
              <div className="lp-stat"><div className="z">14+</div><div className="t">Funktionen — vom Mietvertrag bis ELSTER</div></div>
              <div className="lp-stat"><div className="z">4</div><div className="t">Rollen: Vermieter, Mieter, Hausmeister, Verwaltung</div></div>
              <div className="lp-stat"><div className="z">100 %</div><div className="t">Daten in der EU, Bankdaten AES-256-verschlüsselt</div></div>
              <div className="lp-stat"><div className="z">0 €</div><div className="t">im Early Access — voller Funktionsumfang</div></div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="lp-hero-shot" style={{ marginTop: 36 }}>
              <Shot src="/landing/dashboard.webp" alt="MyImmo-Dashboard mit Portfolio-Wert, Cashflow und Verlaufs-Chart" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Funktionen (Teaser) ---------- */}
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Funktionen</div>
          <h2 className="lp-h2">Alles, was Vermieten verlangt</h2>
          <p className="lp-section-sub">Ein Auszug — die komplette Übersicht mit Screenshots findest du auf der Funktionsseite.</p>
          <div className="lp-features" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {topFeatures.map((f, i) => (
              <Reveal key={f.t} delay={i * 60}>
                <Tilt>
                  <div className="lp-feature" style={{ height: "100%" }}>
                    <div className="ico">{f.ico ? <f.ico size={20} /> : "§"}</div>
                    <h3>{f.t}{f.soon ? SOON_BADGE : null}</h3>
                    <p>{f.p}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Link href="/funktionen" className="lp-mehr">Alle 14 Funktionen ansehen <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      {/* ---------- Rollen (Teaser) ---------- */}
      <section className="lp-section lp-section-alt">
        <div className="lp-inner">
          <div className="lp-kicker">Rollen</div>
          <h2 className="lp-h2">Eine Plattform. Vier Perspektiven.</h2>
          <p className="lp-section-sub">
            Vermieten ist Teamarbeit. Jeder Beteiligte bekommt einen eigenen Zugang —
            per Einladungscode, sauber getrennt, jeder sieht nur seins.
          </p>
          <div className="lp-cards3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {ROLLEN.map((r, i) => (
              <Reveal key={r.t} delay={i * 70}>
                <Tilt>
                  <div className="lp-card" style={{ height: "100%" }}>
                    <div className="lp-card-icon"><r.ico size={22} /></div>
                    <h3>{r.t}</h3>
                    <p>{r.p}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Vision (Teaser) ---------- */}
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-kicker">Die Vision</div>
          <div style={{ textAlign: "center", marginTop: 12 }}><Plane size={28} style={{ color: "var(--gold)" }} /></div>
          <h2 className="lp-h2" style={{ marginTop: 4 }}>Leben, wo du willst.</h2>
          <p className="lp-section-sub">
            MyImmo entsteht aus einem konkreten Ziel: im Ausland leben und den Bestand in Deutschland
            vollständig aus der App steuern. Was vor Ort passieren muss, erledigt dein Team —
            was Entscheidung ist, entscheidest du. Von überall.
          </p>
          <div style={{ textAlign: "center" }}>
            <Link href="/vision" className="lp-mehr">Die ganze Vision & Roadmap <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      {/* ---------- Preise (Teaser) ---------- */}
      <section className="lp-section lp-section-alt" style={{ borderBottom: "none" }}>
        <div className="lp-inner">
          <div className="lp-kicker">Preise</div>
          <h2 className="lp-h2">Fair kalkuliert — und aktuell kostenlos</h2>
          <p className="lp-section-sub">Vier Tarife von 0 € bis Business — während des Early Access ist alles kostenlos.</p>
          <div className="lp-stats" style={{ marginTop: 0 }}>
            {PLAENE.map((p) => (
              <Link key={p.name} href="/preise" className="lp-stat" style={{ textDecoration: "none" }}>
                <div className="z" style={{ fontSize: 20 }}>{p.preis}</div>
                <div className="t">{p.name} · {p.einheiten}</div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Link href="/preise" className="lp-mehr">Tarife im Detail vergleichen <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
