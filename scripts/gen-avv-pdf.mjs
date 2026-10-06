import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import { pdfText } from "../lib/pdf/zeichen.ts";

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const BOX = rgb(0.97, 0.96, 0.94);
const A4 = { w: 595.28, h: 841.89 };
const ML = 56, MR = 56, RIGHT = A4.w - MR;

// Zeichen-Bereinigung über die EINE Stelle lib/pdf/zeichen.ts. Typografische Anführungszeichen,
// Gedankenstriche und Auslassungspunkte kann WinAnsi (Helvetica) darstellen — die bleiben stehen;
// vorher wurden daraus „ - “ und gerade "…" (Design-Scan 06.10.2026).
const WINANSI_TYPO = new Set(["„", "“", "”", "‚", "‘", "’", "–", "—", "…"]);
function sanitize(s) {
  return Array.from(s ?? "", (c) => (WINANSI_TYPO.has(c) ? c : pdfText(c))).join("");
}
const tracked = (s) => s.split("").join(" ");

// Inhalt aus lib/avvInhalt.ts — EINE Quelle mit der Seite /avv. Aufruf:
//   node --experimental-strip-types scripts/gen-avv-pdf.mjs
import { AVV_BLOECKE, AVV_STAND, AVV_STAND_KURZ, AVV_STAND_ISO } from "../lib/avvInhalt.ts";
const ohneFett = (s) => s.replace(/\*\*(.+?)\*\*/g, "$1");
const AVV = AVV_BLOECKE.map((b) =>
  b.p ? { p: ohneFett(b.p) } : b.note ? { note: ohneFett(b.note) } : b.ul ? { ul: b.ul.map(ohneFett) } : b);

const doc = await PDFDocument.create();
doc.setTitle("Auftragsverarbeitungsvertrag (AVV) - MyImmo");
doc.setCreator("MyImmo");
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);
const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

const pages = [];
let page, y;

const MID = A4.w / 2; // horizontaler Blattmittelpunkt — goldener Trennstrich sitzt mittig

function briefkopf(first) {
  const yTop = A4.h - 52;
  page.drawText("My", { x: ML, y: yTop, size: first ? 22 : 14, font: serif, color: INK });
  const wMy = serif.widthOfTextAtSize("My", first ? 22 : 14);
  page.drawText("Immo", { x: ML + wMy, y: yTop, size: first ? 22 : 14, font: serifI, color: GOLD });
  if (first) {
    page.drawText(sanitize(tracked("PRIVATES IMMOBILIEN-MANAGEMENT")), { x: ML, y: yTop - 16, size: 6.5, font, color: MUTED });
    const nm = "Jonas Scharp (MyImmo)";
    page.drawText(nm, { x: RIGHT - bold.widthOfTextAtSize(nm, 10), y: yTop - 2, size: 10, font: bold, color: INK });
    const ad = "Ludwig-Jahn-Straße 42 · 23611 Bad Schwartau";
    page.drawText(sanitize(ad), { x: RIGHT - font.widthOfTextAtSize(sanitize(ad), 8.5), y: yTop - 16, size: 8.5, font, color: MUTED });
    const em = "info@myimmoapp.de";
    page.drawText(em, { x: RIGHT - font.widthOfTextAtSize(em, 8.5), y: yTop - 29, size: 8.5, font, color: MUTED });
  } else {
    const rt = "Auftragsverarbeitungsvertrag (AVV)";
    page.drawText(rt, { x: RIGHT - font.widthOfTextAtSize(rt, 8.5), y: yTop - 2, size: 8.5, font, color: MUTED });
  }
  // Goldener vertikaler Trennstrich – mittig auf dem Blatt
  page.drawLine({ start: { x: MID, y: A4.h - 44 }, end: { x: MID, y: A4.h - 82 }, thickness: 1, color: GOLD });
  page.drawLine({ start: { x: ML, y: A4.h - 96 }, end: { x: RIGHT, y: A4.h - 96 }, thickness: 0.8, color: GOLD });
}

function kopf(first) {
  page = doc.addPage([A4.w, A4.h]); pages.push(page);
  briefkopf(first);
  y = A4.h - 118;
}

function centerText(yy, s, size, f, color) {
  const ss = sanitize(s);
  page.drawText(ss, { x: (A4.w - f.widthOfTextAtSize(ss, size)) / 2, y: yy, size, font: f, color });
}

function raum(need) { if (y - need < 84) kopf(false); }

function wrap(s, size, maxW, f) {
  const words = sanitize(s).split(" "); const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
const LH = 15, GAP = 9; // etwas mehr Zeilen- und Absatzabstand
function para(s, { size = 10, f = font, color = INK, x = ML, maxW = RIGHT - ML, lh = LH, gap = GAP } = {}) {
  for (const ln of wrap(s, size, maxW, f)) { raum(lh); page.drawText(ln, { x, y, size, font: f, color }); y -= lh; }
  y -= gap;
}

// ---- Deckblatt (Seite 1, im MyImmo-Dokument-Stil) ----
page = doc.addPage([A4.w, A4.h]); pages.push(page);
briefkopf(true);
let yc = A4.h - 250;
centerText(yc, "Auftragsverarbeitungsvertrag", 26, bold, INK); yc -= 30;
centerText(yc, "(AVV)", 17, font, MUTED); yc -= 34;
page.drawLine({ start: { x: MID - 34, y: yc }, end: { x: MID + 34, y: yc }, thickness: 2, color: GOLD }); yc -= 30;
centerText(yc, sanitize("Vereinbarung nach Art. 28 Abs. 3 DSGVO"), 11, font, INK); yc -= 18;
centerText(yc, `Stand: ${AVV_STAND}`, 10, font, MUTED);
// Parteien-Block (mittig)
yc = 300;
centerText(yc, "zwischen", 10, serifI, MUTED); yc -= 22;
centerText(yc, "der Nutzerin / dem Nutzer des jeweiligen MyImmo-Kontos (Vermieter)", 10.5, bold, INK); yc -= 14;
centerText(yc, "als Verantwortlichem", 9.5, font, MUTED); yc -= 26;
centerText(yc, "und", 10, serifI, MUTED); yc -= 22;
centerText(yc, "Jonas Scharp (MyImmo), Bad Schwartau", 10.5, bold, INK); yc -= 14;
centerText(yc, "als Auftragsverarbeiter", 9.5, font, MUTED);
// Entwurfs-Hinweis (unten, Creme-Kasten)
{
  const t = "Entwurf zur anwaltlichen Prüfung. Dieses Dokument dient der rechtlichen Durchsicht und ist noch nicht final freigegeben. Keine Rechtsberatung.";
  const lines = wrap(t, 9, A4.w - 2 * ML - 28, font);
  const h = lines.length * 12 + 18;
  const by = 150;
  page.drawRectangle({ x: ML, y: by - h, width: A4.w - 2 * ML, height: h, color: BOX });
  page.drawRectangle({ x: ML, y: by - h, width: 3, height: h, color: GOLD });
  let yy = by - 15;
  for (const ln of lines) { page.drawText(ln, { x: ML + 16, y: yy, size: 9, font, color: MUTED }); yy -= 12; }
}

// ---- Inhalt ab Seite 2 (kompakter Briefkopf) ----
kopf(false);

for (const blk of AVV) {
  if (blk.h) {
    // Überschrift nie allein am Seitenende: mindestens drei Zeilen Text müssen noch passen.
    raum(34 + 3 * LH);
    y -= 10;
    page.drawText(sanitize(blk.h), { x: ML, y, size: 11.5, font: bold, color: INK }); y -= 5;
    page.drawLine({ start: { x: ML, y }, end: { x: RIGHT, y }, thickness: 1.2, color: GOLD }); y -= 17;
  } else if (blk.b) {
    raum(18); page.drawText(sanitize(blk.b), { x: ML, y, size: 10, font: bold, color: INK }); y -= 17;
  } else if (blk.p) {
    para(blk.p);
  } else if (blk.kv) {
    for (const [k, v] of blk.kv) {
      raum(LH);
      const lines = wrap(v, 10, RIGHT - ML - 118, font);
      page.drawText(sanitize(k), { x: ML, y, size: 10, font: bold, color: INK });
      lines.forEach((ln, i) => { page.drawText(ln, { x: ML + 118, y: y - i * LH, size: 10, font, color: INK }); });
      y -= lines.length * LH + 6;
    }
    y -= 4;
  } else if (blk.ul) {
    for (const it of blk.ul) {
      const lines = wrap(it, 10, RIGHT - ML - 16, font);
      raum(lines.length * LH);
      page.drawText("•", { x: ML + 2, y, size: 10, font, color: GOLD });
      lines.forEach((ln, i) => page.drawText(ln, { x: ML + 16, y: y - i * LH, size: 10, font, color: INK }));
      y -= lines.length * LH + 5;
    }
    y -= 5;
  } else if (blk.note) {
    const lines = wrap(blk.note, 9.5, RIGHT - ML - 26, font);
    const h = lines.length * 12 + 14;
    raum(h + 6);
    page.drawRectangle({ x: ML, y: y - h + 9, width: RIGHT - ML, height: h, color: BOX });
    page.drawRectangle({ x: ML, y: y - h + 9, width: 3, height: h, color: GOLD });
    let yy = y - 4;
    for (const ln of lines) { page.drawText(ln, { x: ML + 14, y: yy, size: 9.5, font, color: MUTED }); yy -= 12; }
    y = y - h - 2;
  } else if (blk.sign) {
    raum(150);
    y -= 8;
    page.drawText("Unterzeichnung", { x: ML, y, size: 11.5, font: bold, color: INK }); y -= 16;
    para("In der App wird dieser Vertrag mit der Registrierung bzw. der weiteren Nutzung wirksam. Für die schriftliche Vorlage:", { size: 9.5, color: MUTED });
    y -= 18;
    const colW = (RIGHT - ML - 30) / 2;
    const cols = [{ x: ML, label: "Verantwortlicher (Vermieter)", who: "Name / Unterschrift" },
                  { x: ML + colW + 30, label: "Auftragsverarbeiter (MyImmo)", who: "Jonas Scharp" }];
    for (const c of cols) {
      page.drawText(c.label, { x: c.x, y, size: 9, font: bold, color: MUTED });
    }
    y -= 34;
    for (const c of cols) { page.drawLine({ start: { x: c.x, y }, end: { x: c.x + colW, y }, thickness: 0.8, color: rgb(0.72,0.7,0.64) }); page.drawText("Ort, Datum", { x: c.x, y: y - 11, size: 8, font, color: MUTED }); }
    y -= 46;
    for (const c of cols) { page.drawLine({ start: { x: c.x, y }, end: { x: c.x + colW, y }, thickness: 0.8, color: rgb(0.72,0.7,0.64) }); page.drawText(c.who, { x: c.x, y: y - 11, size: 8, font, color: MUTED }); }
  }
}

// Fußzeilen
pages.forEach((pg, i) => {
  pg.drawLine({ start: { x: ML, y: 64 }, end: { x: RIGHT, y: 64 }, thickness: 0.6, color: LINE });
  pg.drawText("MyImmo", { x: ML, y: 52, size: 7.5, font, color: MUTED });
  const mid = `Seite ${i + 1} von ${pages.length}`;
  pg.drawText(mid, { x: (A4.w - font.widthOfTextAtSize(mid, 7.5)) / 2, y: 52, size: 7.5, font, color: MUTED });
  const r = sanitize(`AVV · Art. 28 DSGVO · Stand ${AVV_STAND_KURZ}`);
  pg.drawText(r, { x: RIGHT - font.widthOfTextAtSize(r, 7.5), y: 52, size: 7.5, font, color: MUTED });
});

fs.writeFileSync(`docs/compliance/avv-nutzer-vertrag-${AVV_STAND_ISO}.pdf`, await doc.save());
console.log("fertig:", pages.length, "Seiten");
