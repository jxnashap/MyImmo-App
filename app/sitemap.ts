import type { MetadataRoute } from "next";
import { RATGEBER } from "@/lib/ratgeber";
import { PREISE_SICHTBAR } from "@/lib/preise";

const BASE = "https://www.myimmoapp.de";

// Öffentliche, indexierbare Seiten (keine App-/Auth-Bereiche).
export default function sitemap(): MetadataRoute.Sitemap {
  // /preise nur listen, wenn dort auch Tarife stehen (lib/preise.ts).
  const seiten = ["", "/funktionen", ...(PREISE_SICHTBAR ? ["/preise"] : []), "/ratgeber", "/vorlagen", "/vision", "/agb", "/datenschutz", "/impressum"];
  const statisch = seiten.map(
    (p) => ({ url: `${BASE}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 }),
  );
  const artikel = RATGEBER.map((a) => ({
    url: `${BASE}/ratgeber/${a.slug}`,
    lastModified: a.datum,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));
  return [...statisch, ...artikel];
}
