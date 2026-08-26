// Baut aus dem Workshop-Material einen fertig deploybaren Ordner.
//
//   node scripts/build-workshop-deploy.mjs
//
// Ergebnis: docs/workshop/deploy/ mit index.html, aufgabenblatt.html,
// aufgabenblatt.pdf. Der Ordner laesst sich unveraendert auf Netlify,
// Vercel, GitHub Pages oder eigenen Webspace legen — kein Build noetig.
//
// Warum ein Skript und keine zweite Datei im Repo: die Online-Fassung ist
// fuer den Artifact-Wrapper geschrieben und beginnt ohne <!doctype>. Fuer
// ein Deployment braucht sie den vollen Dokumentrahmen, sonst laeuft der
// Browser im Quirks-Modus. Eine handgepflegte Kopie wuerde frueher oder
// spaeter von der Quelle abweichen — dieses Skript kann das nicht.
//
// Die MUSTERLOESUNG wird bewusst NICHT mitkopiert. Sie gehoert nicht ins
// oeffentliche Netz.

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const QUELLE = "docs/workshop";
const ZIEL = join(QUELLE, "deploy");

const FAVICON =
  "data:image/svg+xml," +
  "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E" +
  "%3Crect width='32' height='32' rx='7' fill='%230F0F0E'/%3E" +
  "%3Cpath d='M16 6.5 27 15.2h-3.2V25h-5.3v-6.4h-5V25H8.2v-9.8H5Z' fill='%23D4A847'/%3E" +
  "%3C/svg%3E";

const BESCHREIBUNG =
  "Interaktive Fallstudie für den Unterricht: drei Immobilien durchrechnen, " +
  "die beste Mietrendite und die beste Eigennutzung selbst bestimmen.";

rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(ZIEL, { recursive: true });

/* ---------- index.html ---------- */
const online = readFileSync(join(QUELLE, "immobilien-workshop-online.html"), "utf8");
const schnitt = online.indexOf('<div class="huelle">');
if (schnitt < 0) throw new Error('Ankerpunkt <div class="huelle"> nicht gefunden — Quelle geaendert?');

const kopf = online.slice(0, schnitt).trimEnd();
let koerper = online.slice(schnitt);

// Fussleiste um den Link auf die Druckfassung erweitern
const fussAlt = "<span>MyImmo · Immobilien-Workshop</span>";
if (!koerper.includes(fussAlt)) throw new Error("Fusszeile nicht gefunden — Quelle geaendert?");
koerper = koerper.replace(
  fussAlt,
  '<span>MyImmo · Immobilien-Workshop · <a href="aufgabenblatt.html">Fassung zum Ausdrucken</a></span>'
);

writeFileSync(join(ZIEL, "index.html"), `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${BESCHREIBUNG}">
<meta name="author" content="MyImmo">
<!-- Unterrichtsmaterial, gehoert nicht in Suchmaschinen. -->
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F4F3EF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F0F0E" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:title" content="Rendite oder Zuhause? — Immobilien-Workshop">
<meta property="og:description" content="${BESCHREIBUNG}">
<meta property="og:locale" content="de_DE">
<link rel="icon" href="${FAVICON}">
<link rel="apple-touch-icon" href="${FAVICON}">
${kopf}
</head>
<body>
${koerper}
</body>
</html>
`);

/* ---------- aufgabenblatt.html ---------- */
const blattQuelle = readFileSync(join(QUELLE, "immobilien-workshop.html"), "utf8");
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1">';
if (!blattQuelle.includes(viewport)) throw new Error("Viewport-Zeile nicht gefunden — Quelle geaendert?");
writeFileSync(
  join(ZIEL, "aufgabenblatt.html"),
  blattQuelle.replace(
    viewport,
    `${viewport}\n<meta name="robots" content="noindex, nofollow">\n<link rel="icon" href="${FAVICON}">`
  )
);

/* ---------- PDF (falls vorhanden) ---------- */
const pdf = join(QUELLE, "immobilien-workshop.pdf");
if (existsSync(pdf)) {
  copyFileSync(pdf, join(ZIEL, "aufgabenblatt.pdf"));
} else {
  console.log("Hinweis: aufgabenblatt.pdf fehlt. Erzeugen mit einem Browser-Druck");
  console.log("         von docs/workshop/immobilien-workshop.html nach");
  console.log("         docs/workshop/immobilien-workshop.pdf, dann erneut ausfuehren.");
}

console.log(`Fertig: ${ZIEL}/ — Ordner unveraendert auf einen Static-Host legen.`);
console.log("Die Musterloesung wurde absichtlich nicht mitkopiert.");
