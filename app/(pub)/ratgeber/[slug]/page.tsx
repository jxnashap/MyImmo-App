import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LandingShell from "@/components/landing/Shell";
import { RATGEBER, RECHTSSTAND, ratgeberBySlug, ratgeberDatum } from "@/lib/ratgeber";
import Brotkrumen from "@/components/landing/Brotkrumen";
import { BASIS_URL, ORGANISATION } from "@/lib/seo/jsonLd";
import { ArrowRight, Clock } from "lucide-react";

// Kein `dynamicParams = false` noetig: seit die oeffentliche Strecke ein
// eigenes, statisches Root-Layout hat (app/(pub)/layout.tsx), wird nicht mehr
// gestreamt, bevor der Status feststeht — `notFound()` liefert echte 404 samt
// gebrandeter Seite. Bekannte Slugs bleiben vorgerendert.

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
    openGraph: { title: a.titel, description: a.beschreibung, type: "article", images: ["/og.png"] },
  };
}

export default function RatgeberArtikelSeite({ params }: { params: { slug: string } }) {
  const a = ratgeberBySlug(params.slug);
  if (!a) notFound();

  const weitere = RATGEBER.filter((x) => x.slug !== a.slug).slice(0, 2);

  const url = `${BASIS_URL}/ratgeber/${a.slug}`;
  const stufen = [
    { name: "Start", pfad: "" },
    { name: "Ratgeber", pfad: "/ratgeber" },
    { name: a.titel, pfad: `/ratgeber/${a.slug}` },
  ];
  // Article-Markup. Die BreadcrumbList kommt aus <Brotkrumen>, damit sie nicht
  // zweimal im Dokument steht — widerspruechliche strukturierte Daten sind
  // schlechter als gar keine. Bewusst nur diese beiden Typen: FAQPage ist seit
  // 07.05.2026 abgeschaltet, HowTo seit 2023 (siehe docs/SEO.md).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: a.titel,
    description: a.beschreibung,
    datePublished: a.datum,
    // dateModified weicht nur ab, wenn der Artikel wirklich ueberarbeitet
    // wurde (Feld `aktualisiert`). Es pauschal auf „heute" zu setzen waere das
    // billigste Frische-Signal — und eine Luege gegenueber Google wie
    // gegenueber dem Leser, der den Text fuer neu geprueft haelt.
    dateModified: a.aktualisiert ?? a.datum,
    inLanguage: "de-DE",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: `${BASIS_URL}/og.png`,
    author: ORGANISATION,
    publisher: ORGANISATION,
  };

  return (
    <LandingShell aktiv="/ratgeber">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="lp-section">
        <div className="lp-inner" style={{ maxWidth: 760 }}>
          <Brotkrumen stufen={stufen} />
          <div className="lp-kicker" style={{ marginTop: 18, textAlign: "left" }}>{a.kategorie}</div>
          <h1 className="lp-h2" style={{ fontSize: "clamp(27px, 3.8vw, 38px)", textAlign: "left" }}>{a.titel}</h1>
          {/* Rechtsstand sichtbar: Bei Steuer- und Mietrechtsthemen entscheidet
              der Leser daran, ob er sich auf den Text noch verlassen kann.
              Steht bewusst gleichberechtigt neben Datum und Lesezeit und nicht
              versteckt im Fussbereich. */}
          <div style={{ fontSize: 12.5, color: "var(--l-muted)", marginBottom: 24, lineHeight: 1.7 }}>
            <Clock size={12} style={{ verticalAlign: "-2px" }} /> {a.lesezeit} Min Lesezeit · {ratgeberDatum(a.datum)}
            {a.aktualisiert && <> · aktualisiert {ratgeberDatum(a.aktualisiert)}</>}
            <br />
            Rechtsstand: {a.rechtsstand ?? RECHTSSTAND}
          </div>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--l-ink)", marginBottom: 28, fontWeight: 500 }}>{a.intro}</p>

          {/* Kurzcheck vor dem Text: konkreter Beispielfall statt abstrakter
              Zielgruppenansage. Wer sich nicht wiedererkennt, spart sich die
              Lesezeit — das ist beabsichtigt und kein verlorener Leser. */}
          {a.kurzcheck && (
            <aside
              aria-label="Kurzcheck"
              style={{
                background: "var(--l-bg3)",
                borderLeft: "3px solid var(--l-gold)",
                borderRadius: 8,
                padding: "18px 20px",
                margin: "0 0 30px",
              }}
            >
              <div className="lp-vorher" style={{ color: "var(--l-gold-ink)", marginBottom: 8 }}>
                Kurzcheck — ist das dein Fall?
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--l-ink)", margin: "0 0 12px" }}>
                {a.kurzcheck.fall}
              </p>
              <ul style={{ paddingLeft: 20, margin: "0 0 4px", listStyle: "disc" }}>
                {a.kurzcheck.passt.map((li, k) => (
                  <li key={k} style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--l-muted)", marginBottom: 4 }}>
                    {li}
                  </li>
                ))}
              </ul>
              {a.kurzcheck.nichtNoetig && (
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--l-muted)", margin: "10px 0 0" }}>
                  {a.kurzcheck.nichtNoetig}
                </p>
              )}
            </aside>
          )}

          {a.sektionen.map((s, i) => (
            <section key={i} style={{ marginBottom: 24 }}>
              {s.h && <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>{s.h}</h2>}
              {s.p?.map((para, k) => (
                <p key={k} style={{ fontSize: 15, lineHeight: 1.75, color: "var(--l-muted)", margin: "0 0 12px" }}>{para}</p>
              ))}
              {s.liste && (
                <ul style={{ paddingLeft: 20, margin: "4px 0 12px", listStyle: "disc" }}>
                  {s.liste.map((li, k) => (
                    <li key={k} style={{ fontSize: 15, lineHeight: 1.7, color: "var(--l-muted)", marginBottom: 6 }}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {a.feature && (
            <div style={{ background: "var(--l-bg3)", border: "1px solid var(--l-gold)", borderRadius: 12, padding: "22px 24px", margin: "32px 0" }}>
              <h3 style={{ fontSize: 17, margin: "0 0 8px", color: "var(--l-gold-ink)" }}>{a.feature.titel}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--l-muted)", margin: "0 0 16px" }}>{a.feature.text}</p>
              <Link href={a.feature.href} className="btn btn-gold">{a.feature.cta} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} /></Link>
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--l-muted)", borderTop: "1px solid var(--l-line)", paddingTop: 16, marginTop: 8 }}>
            Rechtsstand {a.rechtsstand ?? RECHTSSTAND}. Alle Angaben sind Anhaltspunkte ohne Gewähr und ersetzen
            keine Steuer- oder Rechtsberatung.
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
