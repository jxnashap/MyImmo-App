import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LandingShell from "@/components/landing/Shell";
import { RATGEBER, ratgeberBySlug, ratgeberDatum } from "@/lib/ratgeber";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";

export function generateStaticParams() {
  return RATGEBER.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = ratgeberBySlug(params.slug);
  if (!a) return { title: "Ratgeber — MyImmo" };
  return {
    title: `${a.titel} — MyImmo`,
    description: a.beschreibung,
    alternates: { canonical: `/ratgeber/${a.slug}` },
    openGraph: { title: a.titel, description: a.beschreibung, type: "article" },
  };
}

export default function RatgeberArtikelSeite({ params }: { params: { slug: string } }) {
  const a = ratgeberBySlug(params.slug);
  if (!a) notFound();

  const weitere = RATGEBER.filter((x) => x.slug !== a.slug).slice(0, 2);

  // JSON-LD (Article) für SEO/Rich Results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titel,
    description: a.beschreibung,
    datePublished: a.datum,
    author: { "@type": "Organization", name: "MyImmo" },
    publisher: { "@type": "Organization", name: "MyImmo" },
  };

  return (
    <LandingShell aktiv="/ratgeber">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="lp-section">
        <div className="lp-inner" style={{ maxWidth: 760 }}>
          <Link href="/ratgeber" style={{ fontSize: 13, color: "var(--l-muted)", textDecoration: "none" }}>
            <ArrowLeft size={13} style={{ verticalAlign: "-2px" }} /> Alle Ratgeber
          </Link>
          <div className="lp-kicker" style={{ marginTop: 18 }}>{a.kategorie}</div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(26px, 3.6vw, 36px)", textAlign: "left" }}>{a.titel}</h1>
          <div style={{ fontSize: 12.5, color: "var(--l-faint)", marginBottom: 24 }}>
            <Clock size={12} style={{ verticalAlign: "-2px" }} /> {a.lesezeit} Min Lesezeit · {ratgeberDatum(a.datum)}
          </div>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--l-ink)", marginBottom: 28, fontWeight: 500 }}>{a.intro}</p>

          {a.sektionen.map((s, i) => (
            <section key={i} style={{ marginBottom: 24 }}>
              {s.h && <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>{s.h}</h2>}
              {s.p?.map((para, k) => (
                <p key={k} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--l-muted)", margin: "0 0 12px" }}>{para}</p>
              ))}
              {s.liste && (
                <ul style={{ paddingLeft: 20, margin: "4px 0 12px" }}>
                  {s.liste.map((li, k) => (
                    <li key={k} style={{ fontSize: 15, lineHeight: 1.7, color: "var(--l-muted)", marginBottom: 6 }}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {a.feature && (
            <div style={{ background: "var(--l-bg3)", border: "1px solid var(--l-gold)", borderRadius: 12, padding: "22px 24px", margin: "32px 0" }}>
              <h3 style={{ fontSize: 17, margin: "0 0 8px", color: "var(--l-gold-dark)" }}>{a.feature.titel}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--l-muted)", margin: "0 0 16px" }}>{a.feature.text}</p>
              <Link href={a.feature.href} className="btn btn-gold">{a.feature.cta} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} /></Link>
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--l-faint)", borderTop: "1px solid var(--l-line)", paddingTop: 16, marginTop: 8 }}>
            Rechtsstand Juli 2026. Alle Angaben sind Anhaltspunkte ohne Gewähr und ersetzen keine Steuer- oder Rechtsberatung.
          </p>

          <div style={{ marginTop: 40 }}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Weitere Ratgeber</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {weitere.map((w) => (
                <Link key={w.slug} href={`/ratgeber/${w.slug}`} className="lp-card" style={{ textDecoration: "none", padding: "16px 18px" }}>
                  <span className="lp-vorher" style={{ color: "var(--l-gold-dark)" }}>{w.kategorie}</span>
                  <h3 style={{ fontSize: 15, margin: "2px 0 0" }}>{w.titel}</h3>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </article>
    </LandingShell>
  );
}
