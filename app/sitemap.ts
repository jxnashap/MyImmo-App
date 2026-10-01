import type { MetadataRoute } from "next";
import { RATGEBER } from "@/lib/ratgeber";
import { FUNKTIONSSEITEN } from "@/lib/funktionen";
import { PREISE_SICHTBAR } from "@/lib/preise";

const BASE = "https://www.myimmoapp.de";

// Öffentliche, indexierbare Seiten (keine App-/Auth-Bereiche).
export default function sitemap(): MetadataRoute.Sitemap {
  // /preise nur listen, wenn dort auch Tarife stehen (lib/preise.ts).
  // /agb und /datenschutz tragen `noindex` — in der Sitemap waeren sie ein
  // Widerspruch ("eingereichte URL mit noindex"). Kein lastModified fuer die
  // statischen Seiten: `new Date()` behauptete bei jedem Deploy eine Aenderung,
  // und ein springendes lastmod ignoriert Google. Artikel haben ein echtes Datum.
  const seiten = ["", "/funktionen", ...(PREISE_SICHTBAR ? ["/preise"] : []), "/ratgeber", "/vorlagen", "/vision", "/impressum"];
  const statisch = seiten.map(
    (p) => ({ url: `${BASE}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 }),
  );
  // Funktions-Landingpages: höhere Priorität als die Ratgeber-Artikel, weil
  // sie die Kaufabsicht bedienen und nicht nur die Informationssuche.
  const funktionen = FUNKTIONSSEITEN.map((f) => ({
    url: `${BASE}/funktionen/${f.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  const artikel = RATGEBER.map((a) => ({
    url: `${BASE}/ratgeber/${a.slug}`,
    // Ueberarbeitungsdatum, falls es eins gibt — sonst behauptet die Sitemap
    // etwas anderes als das dateModified im Article-Markup der Seite.
    lastModified: a.aktualisiert ?? a.datum,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));
  return [...statisch, ...funktionen, ...artikel];
}
