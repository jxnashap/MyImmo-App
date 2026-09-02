import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { brotkrumenListe, type Brotkrume } from "@/lib/seo/jsonLd";

/**
 * Sichtbare Brotkrumen-Navigation PLUS das dazugehörige BreadcrumbList-Markup.
 *
 * Beides aus einer Liste: Google wertet BreadcrumbList nur, wenn der Pfad auch
 * auf der Seite steht — und straft Markup ab, das etwas anderes behauptet als
 * die Seite zeigt. Getrennt gepflegt driftet das unweigerlich auseinander.
 *
 * Ersetzt den früheren „← Alle Ratgeber"-Einzellink: derselbe Rückweg, aber
 * mit sichtbarer Hierarchie.
 */
export default function Brotkrumen({ stufen }: { stufen: Brotkrume[] }) {
  const letzte = stufen.length - 1;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", ...brotkrumenListe(stufen) }),
        }}
      />
      <nav aria-label="Brotkrumen" style={{ fontSize: 13, color: "var(--l-muted)" }}>
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
          }}
        >
          {stufen.map((s, i) => (
            <li key={s.pfad} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <ChevronRight size={12} aria-hidden style={{ opacity: 0.55 }} />}
              {i === letzte ? (
                // Die aktuelle Seite ist kein Link — sonst klickt man ins Leere.
                <span aria-current="page" style={{ color: "var(--l-ink)" }}>
                  {s.name}
                </span>
              ) : (
                <Link href={s.pfad || "/"} style={{ color: "inherit", textDecoration: "none" }}>
                  {s.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
