import type { Metadata, Viewport } from "next";
import "../globals.css";

// Eigenes Root-Layout fuer die oeffentliche Strecke (Marketing, Ratgeber,
// Rechtstexte). Es liest bewusst KEINE headers() und keine Supabase-Session —
// nur so kann Next diese Seiten zur Bauzeit prerendern und Vercel sie am Edge
// cachen (statt ~0,5 s Server-Rendern pro Aufruf). Die App-Strecke behaelt ihr
// eigenes Root-Layout unter app/(app)/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.myimmoapp.de"),
  title: "MyImmo — Immobilien-Management",
  description: "Portfolio, Mieter und Dokumente für Privatvermieter",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function OeffentlichesLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Als Datei statt inline — siehe public/theme.js (Nonce-frei). */}
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
