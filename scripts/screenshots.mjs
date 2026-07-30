#!/usr/bin/env node
// Reproduzierbare App-Screenshots für Marketing (docs/MARKETING.md, V5).
//
// Warum als Skript und nicht von Hand: Das Layout-Redesign steht noch aus.
// Jedes Bild in Ratgeber-Artikeln, auf Landingpages, in Portal-Profilen und
// später im App Store veraltet an dem Tag, an dem das Redesign live geht.
// Von Hand wären das jedes Mal Dutzende Aufnahmen in zwei Themes und zwei
// Geräteklassen — hier ist es ein Aufruf.
//
// ---------------------------------------------------------------------------
// Benutzung
//
//   npm i -D playwright            # einmalig; bewusst KEINE feste devDependency
//   npm run dev                    # oder: BASIS=https://www.myimmoapp.de
//   node scripts/screenshots.mjs
//
// Playwright steht absichtlich nicht in der package.json: Vercel installiert
// devDependencies beim Build mit, und das Paket zieht Browser-Downloads nach.
// Der Build würde ohne jeden Gegenwert länger dauern und größer werden.
//
// Optionen (alle optional):
//   --basis=http://localhost:3000   Ziel-URL (Env BASIS/BASE_URL geht auch)
//   --ziel=docs/marketing/screenshots
//   --nur=start,ratgeber            nur diese Seiten-Schlüssel
//   --geraet=handy|desktop          Default: beide
//   --theme=hell|dunkel             Default: beide
//   --liste                         nur auflisten, nichts aufnehmen
//
// Angemeldete Seiten (Dashboard, Objekte, Steuer …) brauchen Zugangsdaten:
//   SHOT_EMAIL=... SHOT_PASSWORT=... node scripts/screenshots.mjs
// Ohne diese Env werden sie übersprungen; die öffentlichen Seiten laufen
// trotzdem durch.
//
// ⚠️ DATENSCHUTZ: Screenshots eines echten Kontos zeigen echte Mieternamen,
// Adressen und Beträge. Für Veröffentlichungen ein Demo-Konto mit erfundenen
// Daten benutzen — nicht das Produktivkonto. Das Skript kann das nicht
// prüfen, deshalb steht es hier.
// ---------------------------------------------------------------------------

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// --- Seiten ---------------------------------------------------------------
// `auth: true` = nur mit SHOT_EMAIL/SHOT_PASSWORT. `voll: true` = ganze Seite
// statt nur des sichtbaren Ausschnitts (für lange Marketing-Seiten sinnvoll,
// für App-Ansichten nicht — dort will man den Bildschirm zeigen, den der
// Nutzer wirklich sieht).
const SEITEN = [
  // Öffentlich — das, was Interessenten vor der Registrierung sehen.
  { key: "start", pfad: "/", titel: "Startseite", voll: true },
  { key: "funktionen", pfad: "/funktionen", titel: "Funktionen", voll: true },
  { key: "preise", pfad: "/preise", titel: "Preise", voll: true },
  { key: "ratgeber", pfad: "/ratgeber", titel: "Ratgeber-Übersicht", voll: true },
  { key: "vorlagen", pfad: "/vorlagen", titel: "Vorlagen", voll: true },
  { key: "vision", pfad: "/vision", titel: "Vision", voll: true },
  { key: "login", pfad: "/login", titel: "Anmeldung" },

  // Angemeldet — die Produktbilder, die in Artikeln und Portalprofilen zählen.
  { key: "dashboard", pfad: "/", titel: "Übersicht", auth: true },
  { key: "objekte", pfad: "/properties", titel: "Immobilien", auth: true },
  { key: "mieter", pfad: "/tenants", titel: "Mieter", auth: true },
  { key: "mietkonto", pfad: "/mietkonto", titel: "Mietkonto", auth: true },
  { key: "einnahmen", pfad: "/einnahmen", titel: "Einnahmen", auth: true },
  { key: "kosten", pfad: "/kosten", titel: "Kosten", auth: true },
  { key: "steuer", pfad: "/steuer", titel: "Steuer / Anlage V", auth: true },
  { key: "cashflow", pfad: "/cashflow", titel: "Cashflow", auth: true },
  { key: "termine", pfad: "/termine", titel: "Termine & Fristen", auth: true },
  { key: "archiv", pfad: "/archiv", titel: "Dokumente", auth: true },
  { key: "kauf", pfad: "/kauf", titel: "Kauf-Rechner", auth: true },
  { key: "verkauf", pfad: "/verkauf", titel: "Verkaufs-Rechner", auth: true },
];

const GERAETE = {
  // 390×844 = iPhone-Klasse. Genau die Breite, gegen die auch die
  // Mobil-Prüfungen der App laufen.
  handy: { name: "handy", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true },
  desktop: { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false },
};

const THEMES = { dunkel: "dark", hell: "light" };

// --- Argumente ------------------------------------------------------------
function arg(name, fallback) {
  const treffer = process.argv.find((a) => a.startsWith(`--${name}=`));
  return treffer ? treffer.slice(name.length + 3) : fallback;
}
const hatFlag = (name) => process.argv.includes(`--${name}`);

const BASIS = (arg("basis", process.env.BASIS || process.env.BASE_URL || "http://localhost:3000")).replace(/\/$/, "");
const ZIEL = path.resolve(arg("ziel", "docs/marketing/screenshots"));
const NUR = (arg("nur", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const GERAETE_WAHL = arg("geraet") ? [arg("geraet")] : Object.keys(GERAETE);
const THEME_WAHL = arg("theme") ? [arg("theme")] : Object.keys(THEMES);

const EMAIL = process.env.SHOT_EMAIL || "";
const PASSWORT = process.env.SHOT_PASSWORT || "";

for (const g of GERAETE_WAHL) if (!GERAETE[g]) abbruch(`Unbekanntes Gerät: ${g} (erlaubt: ${Object.keys(GERAETE).join(", ")})`);
for (const t of THEME_WAHL) if (!THEMES[t]) abbruch(`Unbekanntes Theme: ${t} (erlaubt: ${Object.keys(THEMES).join(", ")})`);

function abbruch(nachricht) {
  console.error(`\n✖ ${nachricht}\n`);
  process.exit(1);
}

const auswahl = SEITEN.filter((s) => !NUR.length || NUR.includes(s.key));
if (!auswahl.length) abbruch(`Keine Seite passt zu --nur=${NUR.join(",")}`);

if (hatFlag("liste")) {
  for (const s of SEITEN) console.log(`${s.key.padEnd(12)} ${s.pfad.padEnd(14)} ${s.auth ? "(Login nötig)" : ""}`);
  process.exit(0);
}

// --- Playwright laden -----------------------------------------------------
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  abbruch(
    "Playwright fehlt. Einmalig installieren:\n\n    npm i -D playwright\n\n" +
      "Der Browser selbst ist in dieser Umgebung schon da (PLAYWRIGHT_BROWSERS_PATH),\n" +
      "ein `playwright install` ist nicht nötig."
  );
}

// Deterministische Bilder: Animationen aus (die App respektiert
// prefers-reduced-motion, aber Übergänge von Drittkomponenten und das
// Aufblenden aus `template.tsx` würden sonst je nach Timing anders treffen).
const RUHE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

async function anmelden(page) {
  await page.goto(`${BASIS}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORT);
  await page.click('button[type="submit"]');
  // Erfolg = die Login-Seite ist weg. Kein fester Zielpfad, weil die App je
  // nach Rolle und Freischaltung unterschiedlich weiterleitet.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function aufnehmen(context, seite, geraet, theme) {
  const page = await context.newPage();
  await page.addInitScript(
    ([wert]) => {
      try {
        localStorage.setItem("theme", wert);
      } catch {}
    },
    [THEMES[theme]]
  );
  await page.goto(`${BASIS}${seite.pfad}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.addStyleTag({ content: RUHE_CSS });
  // Schriften müssen geladen sein, sonst zeigt das Bild den Fallback-Font.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  const datei = path.join(ZIEL, `${seite.key}__${geraet}__${theme}.png`);
  await page.screenshot({ path: datei, fullPage: Boolean(seite.voll) });
  await page.close();
  return datei;
}

// --- Lauf -----------------------------------------------------------------
await mkdir(ZIEL, { recursive: true });

// Wenn die installierte Playwright-Version und der vorhandene Browser nicht
// zusammenpassen (Playwright erwartet exakt „seinen" Build), lässt sich mit
// CHROME_PATH bzw. --chrome= ein vorhandenes Chromium direkt benennen, statt
// einen zweiten Browser herunterzuladen.
const chromePfad = arg("chrome", process.env.CHROME_PATH || "");
// Umgebungen hinter einem Proxy (CI, abgeschottete Container) reichen ihn per
// HTTPS_PROXY durch; localhost muss dabei außen vor bleiben.
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "";
const browser = await chromium.launch({
  ...(chromePfad ? { executablePath: chromePfad } : {}),
  ...(proxyUrl ? { proxy: { server: proxyUrl, bypass: "localhost,127.0.0.1,::1" } } : {}),
});
const erzeugt = [];
const uebersprungen = [];

const brauchtAuth = auswahl.some((s) => s.auth);
if (brauchtAuth && !(EMAIL && PASSWORT)) {
  console.log("ℹ Ohne SHOT_EMAIL/SHOT_PASSWORT: angemeldete Seiten werden übersprungen.");
}

console.log(`→ Basis: ${BASIS}`);
console.log(`→ Ziel:  ${ZIEL}\n`);

try {
  for (const geraet of GERAETE_WAHL) {
    for (const theme of THEME_WAHL) {
      const context = await browser.newContext({
        ...GERAETE[geraet],
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        colorScheme: THEMES[theme],
        reducedMotion: "reduce",
      });

      let angemeldet = false;
      if (brauchtAuth && EMAIL && PASSWORT) {
        try {
          const page = await context.newPage();
          await anmelden(page);
          await page.close();
          angemeldet = true;
        } catch (e) {
          console.error(`  ✖ Login fehlgeschlagen (${geraet}/${theme}): ${e.message}`);
        }
      }

      for (const seite of auswahl) {
        if (seite.auth && !angemeldet) {
          uebersprungen.push(`${seite.key} (${geraet}/${theme}) — kein Login`);
          continue;
        }
        try {
          const datei = await aufnehmen(context, seite, geraet, theme);
          erzeugt.push(datei);
          console.log(`  ✓ ${path.basename(datei)}`);
        } catch (e) {
          uebersprungen.push(`${seite.key} (${geraet}/${theme}) — ${e.message}`);
          console.error(`  ✖ ${seite.key} (${geraet}/${theme}): ${e.message}`);
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

// Kleine Übersicht als Markdown — damit im Vault sichtbar ist, welches Bild
// wann aus welcher Quelle stammt.
if (erzeugt.length) {
  const zeilen = [
    "# App-Screenshots (automatisch erzeugt)",
    "",
    `Quelle: ${BASIS}`,
    "",
    "Erzeugt mit `node scripts/screenshots.mjs`. Nicht von Hand bearbeiten —",
    "nach jeder Layout-Änderung neu laufen lassen.",
    "",
    ...erzeugt.map((d) => `- \`${path.basename(d)}\``),
    "",
  ];
  await writeFile(path.join(ZIEL, "README.md"), zeilen.join("\n"), "utf8");
}

console.log(`\nFertig: ${erzeugt.length} Bilder.`);
if (uebersprungen.length) {
  console.log(`Übersprungen (${uebersprungen.length}):`);
  for (const u of uebersprungen) console.log(`  - ${u}`);
}
// Fehlende Bilder sind ein Fehler, sobald überhaupt keins entstand — sonst
// würde ein kaputter Lauf als Erfolg durchgehen.
if (!erzeugt.length) process.exit(1);
