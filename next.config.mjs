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

// Das Vercel-Projekt beantwortet mehrere Domains. Maßgeblich ist genau EINE:
// www.myimmoapp.de. Alle anderen liefern denselben Inhalt aus — fuer Google
// sind das konkurrierende Adressen derselben Seite, und es entscheidet selbst,
// welche es zeigt (am 01.09.2026 war das `.store`).
//
// Wert in Regex-Schreibweise, wie `has: { type: "host" }` es erwartet.
// Neue Domain im Vercel-Projekt? Hier eintragen.
const NEBENDOMAINS = ["(www\\.)?myimmoapp\\.store", "(www\\.)?myimmoapp\\.com"];

const HAUPTDOMAIN = "https://www.myimmoapp.de";

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
      // Die Seite war unter MEHREREN Domains erreichbar: myimmoapp.de,
      // myimmoapp.store und myimmoapp.com — alle auf demselben Vercel-Projekt,
      // alle mit 200 und identischem Inhalt. Google hat sich daraufhin fuer
      // `.store` als maßgebliche Adresse entschieden und zeigte sie in den
      // Ergebnissen, obwohl `.store` bereits ein korrektes
      // `<link rel="canonical">` auf `.de` ausliefert. Canonical ist eben nur
      // ein Hinweis, keine Anweisung.
      //
      // Deshalb werden alle Nebendomains dauerhaft auf `.de` umgeleitet, damit
      // es dort schlicht nichts mehr zu indexieren gibt. `:pfad*` erhaelt den
      // Pfad, damit bereits verlinkte Unterseiten nicht auf der Startseite
      // landen.
      //
      // Sauberer waere dieselbe Weiterleitung direkt in Vercel
      // (Settings -> Domains -> Redirect) — dann wird die App gar nicht erst
      // aufgerufen. Diese Regeln wirken sofort mit dem naechsten Deploy und
      // sind versioniert; sind die Vercel-Einstellungen gesetzt, koennen sie weg.
      ...NEBENDOMAINS.map((host) => ({
        source: "/:pfad*",
        has: [{ type: "host", value: host }],
        destination: `${HAUPTDOMAIN}/:pfad*`,
        permanent: true,
      })),
      {
        // Der Bereich heisst seit 01.09.2026 „Support"; der Pfad bleibt
        // /hilfe, weil er in verschickten E-Mails steht. Diese Weiterleitung
        // sorgt dafuer, dass auch der neue Name ankommt.
        source: "/support",
        destination: "/hilfe",
        permanent: true,
      },
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
