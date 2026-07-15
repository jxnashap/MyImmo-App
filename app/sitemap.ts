import type { MetadataRoute } from "next";
import { RATGEBER } from "@/lib/ratgeber";

const BASE = "https://my-immo-app.vercel.app";

// Öffentliche, indexierbare Seiten (keine App-/Auth-Bereiche).
export default function sitemap(): MetadataRoute.Sitemap {
  const statisch = ["", "/funktionen", "/preise", "/ratgeber", "/vorlagen", "/vision", "/agb", "/datenschutz", "/impressum"].map(
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
