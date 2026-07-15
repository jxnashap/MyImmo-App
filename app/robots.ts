import type { MetadataRoute } from "next";

// Öffentliche Marketing-/Ratgeberseiten dürfen indexiert werden; die
// eingeloggte App und API bleiben ausgeschlossen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/portal", "/einstellungen", "/mietkonto", "/banking", "/archiv"],
    },
    sitemap: "https://my-immo-app.vercel.app/sitemap.xml",
  };
}
