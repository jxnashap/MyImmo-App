import type { MetadataRoute } from "next";
import { APP_FARBE_HELL } from "@/lib/pwa";

// Web-App-Manifest (10.10.2026, Stufe 1 — docs/zukunft/WEBAPP-INSTALLIERBAR.md). Ausgeliefert
// unter /manifest.webmanifest, OHNE Proxy (Matcher in proxy.ts): Der Browser holt es ohne
// Anmelde-Cookies — liefe es über die Login-Weiche, käme eine Weiterleitung statt JSON zurück und
// die Installation scheiterte still. Symbole: public/pwa/ (scripts/gen-pwa-icons.mjs).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MyImmo — Immobilien-Management",
    short_name: "MyImmo",
    description: "Portfolio, Mieter und Dokumente für Privatvermieter",
    lang: "de",
    dir: "ltr",
    // Angemeldet: Dashboard bzw. Mieter-/Service-Portal (Weiche im Layout); sonst die Startseite.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_FARBE_HELL,
    theme_color: APP_FARBE_HELL,
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
