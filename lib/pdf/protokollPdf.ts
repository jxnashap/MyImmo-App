// Server-seitige PDF-Erzeugung des Wohnungsübergabeprotokolls mit pdf-lib.
// Heller DIN-A4-Bogen im MyImmo-Stil (Kopf/Fuß wie docPdf.ts): Logo links,
// Vermieterblock rechts mit goldenem Trennstrich — OHNE schwarzen Streifen,
// OHNE DIN-Adressfeld (kein Brief, wird vor Ort unterschrieben).

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";

export type ProtokollDaten = {
  typ: "einzug" | "auszug";
  datum: string; // ISO (YYYY-MM-DD)
  objekt: string;
  mieterName: string;
  vermieterName: string;
  strom: string;
  gas: string;
  wasser: string;
  schluessel: string;
  raeume: { name: string; zustand: string; notiz: string }[];
};

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);

const A4 = { w: 595.28, h: 841.89 };
const ML = 56;
const MR = 56;
const RIGHT = A4.w - MR;

function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .split("")
    .map((c) => (c.charCodeAt(0) > 255 && c !== "€" ? "?" : c))
    .join("");
}

const tracked = (s: string) => s.split("").join(" ");

export async function buildProtokollPdf(d: ProtokollDaten): Promise<Uint8Array> {
  const titel = `Wohnungsübergabeprotokoll (${d.typ === "einzug" ? "Einzug" : "Auszug"})`;
  const doc = await PDFDocument.create();
  doc.setTitle(`${titel} – ${d.mieterName}`);
  doc.setCreator("MyImmo");

  let page = doc.addPage([A4.w, A4.h]);
  const seiten = [page];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const text = (x: number, y: number, s: string, size = 10, f: PDFFont = font, color = INK) =>
    page.drawText(sanitize(s), { x, y, size, font: f, color });

  const right = (xRight: number, y: number, s: string, size = 10, f: PDFFont = font, color = INK) => {
    const ss = sanitize(s);
    page.drawText(ss, { x: xRight - f.widthOfTextAtSize(ss, size), y, size, font: f, color });
  };

  const hline = (y: number, x0 = ML, x1 = RIGHT, color = LINE, thickness = 0.8) =>
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness, color });

  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font) => {
    const words = sanitize(s).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) <= maxW) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  // Seitenumbruch: reicht der Platz nicht, neue Seite beginnen (84 = Fußzeile).
  const neueSeiteWennNoetig = (yAktuell: number, benoetigt: number): number => {
    if (yAktuell - benoetigt > 84) return yAktuell;
    page = doc.addPage([A4.w, A4.h]);
    seiten.push(page);
    return A4.h - 64;
  };

  // ---- Kopf (wie docPdf, KEIN schwarzer Streifen) ----
  const yTop = A4.h - 52;
  const logoSize = 22;
  text(ML, yTop, "My", logoSize, serif, INK);
  const wMy = serif.widthOfTextAtSize("My", logoSize);
  text(ML + wMy, yTop, "Immo", logoSize, serifI, GOLD);
  text(ML, yTop - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);

  if (d.vermieterName) right(RIGHT, yTop - 2, d.vermieterName, 10, bold, INK);

  page.drawLine({
    start: { x: 372, y: A4.h - 44 },
    end: { x: 372, y: A4.h - 82 },
    thickness: 1,
    color: GOLD,
  });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // ---- Titel + Untertitel + goldene Unterlinie ----
  let y = A4.h - 130;
  text(ML, y, titel, 13, bold, INK);
  y -= 15;
  text(ML, y, d.objekt, 9, font, MUTED);
  y -= 9;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 22;

  // ---- Meta: Datum · Mieter · Vermieter ----
  const deDatum = d.datum
    ? new Date(d.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const metaTeile: [string, string][] = [
    ["Datum:", deDatum],
    ["Mieter:", d.mieterName || "—"],
    ["Vermieter:", d.vermieterName || "—"],
  ];
  let mx = ML;
  for (const [lbl, val] of metaTeile) {
    text(mx, y, lbl, 9.5, bold, INK);
    mx += bold.widthOfTextAtSize(sanitize(lbl), 9.5) + 4;
    text(mx, y, val, 9.5, font, INK);
    mx += font.widthOfTextAtSize(sanitize(val), 9.5) + 22;
  }
  y -= 28;

  // ---- Abschnittshelfer ----
  const abschnitt = (label: string) => {
    y = neueSeiteWennNoetig(y, 60);
    text(ML, y, label, 11, bold, INK);
    y -= 7;
    hline(y, ML, RIGHT, GOLD, 0.8);
    y -= 16;
  };

  // ---- Zählerstände ----
  abschnitt("Zählerstände");
  const zCol = 220;
  text(ML, y, "ZÄHLER", 8, bold, MUTED);
  text(zCol, y, "STAND", 8, bold, MUTED);
  y -= 5;
  hline(y, ML, RIGHT, INK, 0.7);
  y -= 15;
  for (const [lbl, val] of [["Strom", d.strom], ["Gas", d.gas], ["Wasser", d.wasser]] as const) {
    text(ML, y, lbl, 10, font, INK);
    text(zCol, y, val || "—", 10, font, val ? INK : MUTED);
    y -= 6;
    hline(y, ML, RIGHT, LINE, 0.5);
    y -= 14;
  }
  y -= 8;

  // ---- Schlüssel ----
  abschnitt("Schlüssel");
  text(ML, y, "Übergebene Schlüssel:  ", 10, font, INK);
  const wLbl = font.widthOfTextAtSize(sanitize("Übergebene Schlüssel:  "), 10);
  text(ML + wLbl, y, d.schluessel || "—", 10, bold, d.schluessel ? INK : MUTED);
  y -= 28;

  // ---- Räume & Zustand ----
  abschnitt("Räume & Zustand");
  const rCol1 = ML;
  const rCol2 = 200;
  const rCol3 = 330;
  text(rCol1, y, "RAUM", 8, bold, MUTED);
  text(rCol2, y, "ZUSTAND", 8, bold, MUTED);
  text(rCol3, y, "ANMERKUNG / MÄNGEL", 8, bold, MUTED);
  y -= 5;
  hline(y, ML, RIGHT, INK, 0.7);
  y -= 15;
  const raeume = d.raeume.filter((r) => r.name.trim());
  if (raeume.length === 0) {
    text(ML, y, "—", 10, font, MUTED);
    y -= 20;
  } else {
    for (const r of raeume) {
      const notizZeilen = wrap(r.notiz || "—", 9.5, RIGHT - rCol3);
      const benoetigt = notizZeilen.length * 13 + 8;
      y = neueSeiteWennNoetig(y, benoetigt);
      text(rCol1, y, r.name, 10, bold, INK);
      text(rCol2, y, r.zustand, 9.5, font, INK);
      let ny = y;
      for (const ln of notizZeilen) {
        text(rCol3, ny, ln, 9.5, font, r.notiz ? INK : MUTED);
        ny -= 13;
      }
      y = Math.min(y - 13, ny) - 1;
      hline(y + 8, ML, RIGHT, LINE, 0.5);
      y -= 8;
    }
  }

  // ---- Unterschriftszeilen ----
  y = neueSeiteWennNoetig(y, 110);
  y -= 52; // Platz für Unterschriften
  const halb = (RIGHT - ML - 40) / 2;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + halb, y }, thickness: 0.8, color: MUTED });
  page.drawLine({ start: { x: RIGHT - halb, y }, end: { x: RIGHT, y }, thickness: 0.8, color: MUTED });
  y -= 12;
  text(ML, y, "Ort, Datum & Unterschrift Mieter", 8.5, font, MUTED);
  right(RIGHT, y, "Ort, Datum & Unterschrift Vermieter", 8.5, font, MUTED);

  // ---- Fußzeile (auf jeder Seite) ----
  const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  seiten.forEach((pg, i) => {
    pg.drawLine({ start: { x: ML, y: 64 }, end: { x: RIGHT, y: 64 }, thickness: 0.6, color: LINE });
    pg.drawText("MyImmo", { x: ML, y: 52, size: 7.5, font, color: MUTED });
    const mid = `Seite ${i + 1} von ${seiten.length}`;
    pg.drawText(mid, { x: A4.w / 2 - font.widthOfTextAtSize(mid, 7.5) / 2, y: 52, size: 7.5, font, color: MUTED });
    pg.drawText(heute, { x: RIGHT - font.widthOfTextAtSize(heute, 7.5), y: 52, size: 7.5, font, color: MUTED });
  });

  return doc.save();
}
