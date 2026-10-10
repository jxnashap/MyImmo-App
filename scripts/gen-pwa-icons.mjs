// App-Symbole der installierbaren Web-App aus dem Kachel-Logo (10.10.2026).
// Aufruf: node scripts/gen-pwa-icons.mjs  →  public/pwa/*.png
//
// Quelle: public/myimmo_logo_2048.png (dunkle Kachel mit transparenten runden Ecken).
// - icon-192/512: die Kachel wie sie ist (Ecken transparent) — so sieht sie im Dock/Startmenü aus.
// - maskable-512 und apple-touch-icon (180): VOLLFLÄCHIG. Android schneidet maskierbare Symbole
//   selbst zu, iOS rundet selbst und füllt Transparenz schwarz. Dafür wird der Innenbereich
//   (Haus + Wortmarke, ohne Ecken) auf eine Fläche in der Kachelfarbe gesetzt. Das Logo liegt
//   innerhalb der sicheren Zone (Kreis mit 40 % Radius), maskiert wird also nichts abgeschnitten.
import sharp from "sharp";

const QUELLE = "public/myimmo_logo_2048.png";
const KACHEL = { r: 20, g: 20, b: 22 }; // gemessen in der Kachel (20,20,22)
const INNEN = { left: 520, top: 500, width: 940, height: 900 }; // Haus + Wortmarke, weit weg von den Ecken

const innen = await sharp(QUELLE).extract(INNEN).png().toBuffer();
const vollflaechig = await sharp({ create: { width: 2048, height: 2048, channels: 3, background: KACHEL } })
  .composite([{ input: innen, left: INNEN.left, top: INNEN.top }])
  .png()
  .toBuffer();

const aufgaben = [
  [QUELLE, 192, "public/pwa/icon-192.png"],
  [QUELLE, 512, "public/pwa/icon-512.png"],
  [vollflaechig, 512, "public/pwa/maskable-512.png"],
  [vollflaechig, 180, "public/pwa/apple-touch-icon.png"],
];
for (const [quelle, groesse, ziel] of aufgaben) {
  await sharp(quelle).resize(groesse, groesse).png({ compressionLevel: 9 }).toFile(ziel);
  console.log(ziel, groesse);
}
