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
import { pdfText } from "@/lib/pdf/zeichen";
import { brichUm } from "@/lib/pdf/zeilenumbruch";
import { protokollDatum } from "@/lib/protokollDatum";

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

// WinAnsi-sichere Bereinigung: EINE Regel für alle PDF-Builder (lib/pdf/zeichen.ts).
const sanitize = pdfText;

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

  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font) => brichUm(s, size, maxW, f);

  const fit = (s: string, size: number, maxW: number, f: PDFFont = font) => {
    let str = sanitize(s);
    if (f.widthOfTextAtSize(str, size) <= maxW) return str;
    while (str.length > 1 && f.widthOfTextAtSize(str + "...", size) > maxW) str = str.slice(0, -1);
    return str + "...";
  };

  // Seitenumbruch: reicht der Platz nicht, neue Seite beginnen (84 = Fußzeile).
  // `unten`: tiefste erlaubte Grundlinie (84 = Fußzeilen-Zone). Der Unterschriftsblock darf bis 74
  // (Fußlinie bei 64) — ein paar Punkte entscheiden sonst über ein zweites Blatt.
  const neueSeiteWennNoetig = (yAktuell: number, benoetigt: number, unten = 84): number => {
    if (yAktuell - benoetigt > unten) return yAktuell;
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
    start: { x: A4.w / 2, y: A4.h - 44 },
    end: { x: A4.w / 2, y: A4.h - 82 },
    thickness: 1,
    color: GOLD,
  });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // ---- Titel + Untertitel + goldene Unterlinie ----
  let y = A4.h - 130;
  text(ML, y, titel, 13, bold, INK);
  y -= 15;
  // Objekt umbrechen statt über den rechten Rand laufen (höchstens zwei Zeilen).
  const objektZeilen = wrap(d.objekt, 9, RIGHT - ML).slice(0, 2);
  objektZeilen.forEach((ln, i) => {
    text(ML, y, ln, 9, font, MUTED);
    if (i < objektZeilen.length - 1) y -= 12;
  });
  y -= 9;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 22;

  // ---- Meta: Datum · Mieter · Vermieter ----
  // Datum aus den Zahlen des ISO-Textes (kein new Date + Ortszeit), gleich wie die Vorschau.
  const deDatum = protokollDatum(d.datum);
  const metaTeile: [string, string][] = [
    ["Datum:", deDatum],
    ["Mieter:", d.mieterName || "—"],
    ["Vermieter:", d.vermieterName || "—"],
  ];
  // Reicht die Zeile nicht, beginnt der nächste Teil in einer neuen Zeile; ein einzelner
  // überlanger Wert wird auf die Restbreite gekürzt — nie über den Blattrand.
  let mx = ML;
  for (const [lbl, val] of metaTeile) {
    const wl = bold.widthOfTextAtSize(sanitize(lbl), 9.5) + 4;
    const wv = font.widthOfTextAtSize(sanitize(val), 9.5);
    if (mx > ML && mx + wl + wv > RIGHT) {
      y -= 14;
      mx = ML;
    }
    text(mx, y, lbl, 9.5, bold, INK);
    mx += wl;
    const v = fit(val, 9.5, RIGHT - mx);
    text(mx, y, v, 9.5, font, INK);
    mx += font.widthOfTextAtSize(v, 9.5) + 22;
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
    // Freitext umbrechen statt am rechten Rand abschneiden.
    const zeilen = wrap(val || "—", 10, RIGHT - zCol);
    y = neueSeiteWennNoetig(y, zeilen.length * 13 + 8);
    text(ML, y, lbl, 10, font, INK);
    zeilen.forEach((ln, i) => {
      text(zCol, y, ln, 10, font, val ? INK : MUTED);
      if (i < zeilen.length - 1) y -= 13;
    });
    y -= 6;
    hline(y, ML, RIGHT, LINE, 0.5);
    y -= 14;
  }
  y -= 8;

  // ---- Schlüssel ----
  abschnitt("Schlüssel");
  text(ML, y, "Übergebene Schlüssel:  ", 10, font, INK);
  const wLbl = font.widthOfTextAtSize(sanitize("Übergebene Schlüssel:  "), 10);
  const schluesselZeilen = wrap(d.schluessel || "—", 10, RIGHT - ML - wLbl, bold);
  schluesselZeilen.forEach((ln, i) => {
    text(ML + wLbl, y, ln, 10, bold, d.schluessel ? INK : MUTED);
    if (i < schluesselZeilen.length - 1) y -= 13;
  });
  y -= 28;

  // ---- Räume & Zustand ----
  abschnitt("Räume & Zustand");
  const rCol1 = ML;
  const rCol2 = 200;
  const rCol3 = 330;
  const raumKopf = () => {
    text(rCol1, y, "RAUM", 8, bold, MUTED);
    text(rCol2, y, "ZUSTAND", 8, bold, MUTED);
    text(rCol3, y, "ANMERKUNG / MÄNGEL", 8, bold, MUTED);
    y -= 5;
    hline(y, ML, RIGHT, INK, 0.7);
    y -= 15;
  };
  // Folgeseite: Kurzkopf mit Zuordnung, damit das Blatt allein lesbar bleibt.
  const folgeKopf = () => {
    text(ML, y, fit(`${titel} · ${d.mieterName || "—"} · ${d.objekt}`, 9, RIGHT - ML, bold), 9, bold, MUTED);
    y -= 7;
    hline(y, ML, RIGHT, GOLD, 0.8);
    y -= 18;
  };
  raumKopf();

  // Bedarf des Unterschriftsblocks: 52 Platz + 12 bis zur Beschriftung (+ deren Schrift).
  const UNTERSCHRIFT_HOEHE = 66;
  const raeume = d.raeume.filter((r) => r.name.trim());
  if (raeume.length === 0) {
    text(ML, y, "—", 10, font, MUTED);
    y -= 20;
  } else {
    raeume.forEach((r, idx) => {
      const namenZeilen = wrap(r.name, 10, rCol2 - rCol1 - 8, bold);
      const zustandZeilen = wrap(r.zustand, 9.5, rCol3 - rCol2 - 8);
      const notizZeilen = wrap(r.notiz || "—", 9.5, RIGHT - rCol3);
      const zeilen = Math.max(namenZeilen.length, zustandZeilen.length, notizZeilen.length);
      const benoetigt = zeilen * 13 + 8;
      // Der letzte Raum geht MIT den Unterschriften auf eine neue Seite — eine Unterschrift
      // auf einem sonst leeren Blatt lässt sich keinem Protokoll zuordnen.
      const letzter = idx === raeume.length - 1;
      const vorher = y;
      // + 1: die Zeile verbraucht zeilen × 13 + 9 (siehe unten) — sonst bliebe ein 1-pt-Fenster,
      // in dem der Raum passt, die Unterschriften aber allein auf die Folgeseite rutschen.
      y = letzter
        ? neueSeiteWennNoetig(y, benoetigt + 1 + UNTERSCHRIFT_HOEHE, 74)
        : neueSeiteWennNoetig(y, benoetigt);
      if (y > vorher) {
        folgeKopf();
        raumKopf();
      }
      namenZeilen.forEach((ln, i) => text(rCol1, y - i * 13, ln, 10, bold, INK));
      zustandZeilen.forEach((ln, i) => text(rCol2, y - i * 13, ln, 9.5, font, INK));
      notizZeilen.forEach((ln, i) => text(rCol3, y - i * 13, ln, 9.5, font, r.notiz ? INK : MUTED));
      y = y - zeilen * 13 - 1;
      hline(y + 8, ML, RIGHT, LINE, 0.5);
      y -= 8;
    });
  }

  // ---- Unterschriftszeilen ----
  {
    const vorher = y;
    y = neueSeiteWennNoetig(y, UNTERSCHRIFT_HOEHE, 74);
    if (y > vorher) folgeKopf();
  }
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
