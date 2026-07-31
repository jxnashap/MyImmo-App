import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LandingShell from "@/components/landing/Shell";
import { FUNKTIONSSEITEN, funktionsseiteBySlug } from "@/lib/funktionen";
import { ratgeberBySlug } from "@/lib/ratgeber";
import { ArrowRight, ArrowLeft } from "lucide-react";

export function generateStaticParams() {
  return FUNKTIONSSEITEN.map((f) => ({ slug: f.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const f = funktionsseiteBySlug(params.slug);
  if (!f) return { title: "Funktionen — MyImmo" };
  return {
    title: `${f.metaTitel} — MyImmo`,
    description: f.beschreibung,
    alternates: { canonical: `/funktionen/${f.slug}` },
    openGraph: { title: f.titel, description: f.beschreibung, type: "website" },
  };
}

export default function FunktionsSeite({ params }: { params: { slug: string } }) {
  const f = funktionsseiteBySlug(params.slug);
  if (!f) notFound();

  // Nur Artikel verlinken, die es wirklich gibt — ein toter Link im Ratgeber
  // kostet mehr Vertrauen, als der Verweis einbringt.
  const artikel = f.ratgeber.map((s) => ratgeberBySlug(s)).filter(Boolean);

  return (
    <LandingShell aktiv="/funktionen">
      <section className="lp-section">
        <div className="lp-inner" style={{ maxWidth: 820 }}>
          <Link href="/funktionen" style={{ fontSize: 13, color: "var(--l-muted)", textDecoration: "none" }}>
            <ArrowLeft size={13} style={{ verticalAlign: "-2px" }} /> Alle Funktionen
          </Link>
          <div className="lp-kicker" style={{ marginTop: 18 }}>{f.kicker}</div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(27px, 3.8vw, 38px)", textAlign: "left" }}>{f.titel}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--l-ink)", margin: "0 0 30px", fontWeight: 500 }}>{f.sub}</p>

          <section style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>{f.problem.h}</h2>
            {f.problem.p.map((p, i) => (
              <p key={i} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--l-muted)", margin: "0 0 12px" }}>{p}</p>
            ))}
          </section>

          {f.abschnitte.map((a, i) => (
            <section key={i} style={{ marginBottom: 26 }}>
              <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>{a.h}</h2>
              {a.p?.map((p, k) => (
                <p key={k} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--l-muted)", margin: "0 0 12px" }}>{p}</p>
              ))}
              {a.liste && (
                <ul style={{ paddingLeft: 20, margin: "4px 0 12px", listStyle: "disc" }}>
                  {a.liste.map((li, k) => (
                    <li key={k} style={{ fontSize: 15, lineHeight: 1.7, color: "var(--l-muted)", marginBottom: 6 }}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div
            style={{
              background: "var(--l-bg3)",
              border: "1px solid var(--l-gold)",
              borderRadius: 12,
              padding: "22px 24px",
              margin: "32px 0",
            }}
          >
            <h3 style={{ fontSize: 17, margin: "0 0 8px", color: "var(--l-gold-ink)" }}>{f.cta.titel}</h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--l-muted)", margin: "0 0 16px" }}>{f.cta.text}</p>
            <Link href="/anmelden" className="btn btn-gold">
              Kostenlos starten <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
            </Link>
          </div>

          {artikel.length > 0 && (
            <div style={{ marginTop: 36 }}>
              <h2 style={{ fontSize: 16, marginBottom: 14 }}>Zum Weiterlesen</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {artikel.map((r) => (
                  <Link
                    key={r!.slug}
                    href={`/ratgeber/${r!.slug}`}
                    className="lp-card"
                    style={{ textDecoration: "none", padding: "16px 18px" }}
                  >
                    <span className="lp-vorher" style={{ color: "var(--l-gold-ink)" }}>{r!.kategorie}</span>
                    <h3 style={{ fontSize: 15, margin: "2px 0 4px" }}>{r!.titel}</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--l-muted)", margin: 0 }}>{r!.beschreibung}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </LandingShell>
  );
}
