/** @type {import('next').NextConfig} */

// Oeffentliche, statisch ausgelieferte Strecke (app/(pub)/…). Diese Pfade sind
// im Middleware-Matcher AUSGENOMMEN — sonst liefe pro Aufruf eine Supabase-
// Session-Pruefung und die Seiten koennten nicht am Edge gecacht werden.
// Weil damit auch die Nonce-CSP der Middleware entfaellt, setzen wir die
// Security-Header fuer sie hier. Beide Listen zusammen pflegen (middleware.ts).
const OEFFENTLICH = [
  "funktionen",
  "ratgeber",
  "vision",
  "preise",
  "vorlagen",
  "agb",
  "avv",
  "datenschutz",
  "impressum",
];

// Statische Seiten koennen keine Nonce tragen (die entsteht erst pro Request).
// Next.js gibt seine Flight-Daten aber als Inline-<script> aus — ohne
// 'unsafe-inline' wuerden die Seiten nicht hydrieren. Der Rest der CSP bleibt
// so streng wie in der App; insbesondere laedt hier kein fremder Origin und es
// gibt kein Formular ausser dem Vorlagen-Verteiler (form-action 'self').
const CSP_STATISCH = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SICHERHEITS_HEADER = [
  { key: "Content-Security-Policy", value: CSP_STATISCH },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig = {
  experimental: {
    serverActions: {
      // Anliegen-Anhänge (bis 3 Dateien à 4 MB, plus Formular-Overhead)
      bodySizeLimit: "18mb",
    },
  },
  // Dauerhafte Weiterleitungen fuer umbenannte Inhalte. Ohne sie laeuft jeder
  // bereits indexierte oder verlinkte Aufruf der alten Adresse in eine 404 —
  // und die aufgebaute Sichtbarkeit ist weg statt uebertragen.
  async redirects() {
    return [
      {
        // Jahreszahl aus dem Slug genommen (30.08.2026): Der Artikel gilt
        // nicht nur fuer 2025, und eine veraltete Jahreszahl in der Adresse
        // liest sich fuer Leser wie fuer Suchmaschinen als "nicht gepflegt".
        source: "/ratgeber/grundsteuer-2025-auf-mieter-umlegen",
        destination: "/ratgeber/grundsteuer-auf-mieter-umlegen",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      ...OEFFENTLICH.flatMap((p) => [
        { source: `/${p}`, headers: SICHERHEITS_HEADER },
        { source: `/${p}/:pfad*`, headers: SICHERHEITS_HEADER },
      ]),
      // Ebenfalls ohne Middleware (sonst liefe die Login-Weiche darauf und
      // ausgeloggte Besucher bekaemen statt des Skripts eine Weiterleitung).
      { source: "/theme.js", headers: SICHERHEITS_HEADER },
    ];
  },
};
export default nextConfig;
