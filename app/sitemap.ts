import type { MetadataRoute } from "next";
import { RATGEBER } from "@/lib/ratgeber";
import { FUNKTIONSSEITEN } from "@/lib/funktionen";
import { PREISE_SICHTBAR } from "@/lib/preise";

const BASE = "https://www.myimmoapp.de";

// Öffentliche, indexierbare Seiten (keine App-/Auth-Bereiche).
export default function sitemap(): MetadataRoute.Sitemap {
  // /preise nur listen, wenn dort auch Tarife stehen (lib/preise.ts).
  const seiten = ["", "/funktionen", ...(PREISE_SICHTBAR ? ["/preise"] : []), "/ratgeber", "/vorlagen", "/vision", "/agb", "/datenschutz", "/impressum"];
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
    lastModified: a.datum,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));
  return [...statisch, ...funktionen, ...artikel];
}
