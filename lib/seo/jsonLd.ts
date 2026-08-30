// Gemeinsame Bausteine für strukturierte Daten (schema.org / JSON-LD).
//
// Warum zentral: Publisher-Angaben und Brotkrumen lagen bisher als Literale in
// einzelnen Seiten. Sobald sie an zwei Stellen stehen, laufen sie auseinander —
// und Google meldet dann „widersprüchliche strukturierte Daten" statt eines
// Rich Results. Hier eine Quelle, überall dieselbe Ausgabe.
//
// Bewusst NUR die Typen, die 2026 noch etwas bewirken: Article, Organization,
// BreadcrumbList. FAQPage ist seit 07.05.2026 abgeschaltet, HowTo seit 2023
// (siehe docs/SEO.md) — die einzubauen wäre reine Beschäftigung.

export const BASIS_URL = "https://www.myimmoapp.de";

/**
 * Die Anbieter-Identität. Das feste `@id` ist der Punkt: Startseite und jeder
 * Ratgeber-Artikel verweisen damit auf DIESELBE Entität, statt Google mehrere
 * gleichnamige Organisationen zu präsentieren. Entitäts-Konsolidierung ist bei
 * YMYL-Themen eines der wenigen E-E-A-T-Signale, die man technisch setzen kann.
 */
export const ORGANISATION = {
  "@type": "Organization",
  "@id": `${BASIS_URL}/#org`,
  name: "MyImmo",
  url: BASIS_URL,
  logo: `${BASIS_URL}/myimmo_logo_2048.png`,
} as const;

export type Brotkrume = {
  name: string;
  /** Pfad ab dem Wurzelverzeichnis, z. B. "/ratgeber". "" = Startseite. */
  pfad: string;
};

/**
 * BreadcrumbList aus den sichtbaren Brotkrumen.
 *
 * Google verlangt, dass das Markup die auf der Seite SICHTBARE Navigation
 * abbildet. Deshalb erzeugt `components/landing/Brotkrumen.tsx` beides aus
 * derselben Liste, statt das Markup getrennt zu pflegen.
 */
export function brotkrumenListe(stufen: Brotkrume[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: stufen.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      item: `${BASIS_URL}${s.pfad}`,
    })),
  };
}
