import type { Metadata, Viewport } from "next";
import "../globals.css";
import { APP_FARBE_DUNKEL, APP_FARBE_HELL } from "@/lib/pwa";

// Eigenes Root-Layout fuer die oeffentliche Strecke (Marketing, Ratgeber,
// Rechtstexte). Es liest bewusst KEINE headers() und keine Supabase-Session —
// nur so kann Next diese Seiten zur Bauzeit prerendern und Vercel sie am Edge
// cachen (statt ~0,5 s Server-Rendern pro Aufruf). Die App-Strecke behaelt ihr
// eigenes Root-Layout unter app/(app)/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.myimmoapp.de"),
  title: "MyImmo — Immobilien-Management",
  description: "Portfolio, Mieter und Dokumente für Privatvermieter",
  // Wie in app/(app)/layout.tsx — wer MyImmo von hier aus auf den Home-Bildschirm legt, bekommt
  // dasselbe Symbol. Einen Service Worker gibt es auf dieser Strecke NICHT (lib/pwa.ts).
  appleWebApp: { capable: true, title: "MyImmo", statusBarStyle: "default" },
  // `icon` ausdrücklich: Sobald `icons` hier steht, lässt Next das Datei-Favicon (app/icon.svg)
  // weg — im Build gesehen, die Seiten hatten danach kein Favicon mehr (tests/pwa.test.ts).
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/pwa/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_FARBE_HELL },
    { media: "(prefers-color-scheme: dark)", color: APP_FARBE_DUNKEL },
  ],
};

export default function OeffentlichesLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Als Datei statt inline — siehe public/theme.js (Nonce-frei). Bewusst synchron:
            Es setzt das Farbschema VOR dem ersten Zeichnen, sonst flackert die Seite. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme.js" />
      </head>
      <body>
        {children}
        {/* Vercel Speed Insights wurde am 08.09.2026 entfernt: Die Datenschutz-
            erklärung sagt „keine Analyse-Tools", und das soll auch stimmen.
            Speed Insights ist cookielos, misst aber Route, Gerät, Land und
            Ladezeiten — das ist eine Messung, keine Null-Analyse. */}
      </body>
    </html>
  );
}
