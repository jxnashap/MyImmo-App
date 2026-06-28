// Server-seitige PDF-Erzeugung für Mieter-Briefe (Mahnung, Kündigung,
// Mieterhöhung, …) mit pdf-lib. Heller DIN-A4-Geschäftsbrief im MyImmo-Stil:
// Logo links, Absenderblock rechts mit goldenem Trennstrich – OHNE schwarzen
// Top-Streifen. Der Brieftext wird vertikal mittig auf dem Blatt ausbalanciert
// (zwei Layout-Durchläufe: erst messen, dann mittig zeichnen).

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";
import { adressfeldZeilen, zeichneAdressfeld } from "@/lib/pdf/adressfeld";

export type BriefAbsender = {
  name: string;
  adresse?: string | null;
  email?: string | null;
  ort?: string | null;
};
export type BriefKonto = {
  kontoname?: string | null;
  inhaber?: string | null;
  iban?: string | null;
};
export type BriefDaten = {
  titel: string;
  absender: BriefAbsender;
  empfaengerName: string;
  empfaengerAdresse?: string | null;
  objekt: string;
  absaetze: string[];
  konto?: BriefKonto | null;
};

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const KONTO_BG = rgb(0.97, 0.96, 0.94);

const A4 = { w: 595.28, h: 841.89 };
const ML = 56;
const MR = 56;
const RIGHT = A4.w - MR;
const LH = 14; // Zeilenhöhe
const PG = 8; // Absatzabstand

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

const formatIban = (s: string) =>
  s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

const tracked = (s: string) => s.split("").join(" ");

function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

export async function buildDocPdf(d: BriefDaten): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.titel} – ${d.empfaengerName}`);
  doc.setCreator("MyImmo");

  const page = doc.addPage([A4.w, A4.h]);
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

  // ---- Kopf (fix oben, KEIN schwarzer Streifen) ----
  const yTop = A4.h - 52;
  const logoSize = 22;
  text(ML, yTop, "My", logoSize, serif, INK);
  const wMy = serif.widthOfTextAtSize("My", logoSize);
  text(ML + wMy, yTop, "Immo", logoSize, serifI, GOLD);
  text(ML, yTop - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);

  right(RIGHT, yTop - 2, d.absender.name || "MyImmo", 10, bold, INK);
  let ry = yTop - 16;
  if (d.absender.adresse) {
    right(RIGHT, ry, d.absender.adresse.split(/,\s*/).join(" · "), 8.5, font, MUTED);
    ry -= 13;
  }
  if (d.absender.email) right(RIGHT, ry, d.absender.email, 8.5, font, MUTED);

  page.drawLine({
    start: { x: 372, y: A4.h - 44 },
    end: { x: 372, y: A4.h - 82 },
    thickness: 1,
    color: GOLD,
  });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // ---- Vorbereitete Werte ----
  const senderLine = [d.absender.name, d.absender.adresse].filter(Boolean).join(" · ");
  const heute = deDate(new Date());
  const ortClean = (d.absender.ort || "").replace(/^\d{4,5}\s*/, "").trim();
  const ortDatum = ortClean ? `${ortClean}, ${heute}` : heute;

  const kontoLines: { s: string; f: PDFFont; color: typeof INK }[] = [];
  if (d.konto?.iban) {
    kontoLines.push({ s: "Bitte überweisen Sie auf folgendes Konto:", f: bold, color: INK });
    const inhaber = d.konto.inhaber || d.absender.name;
    if (inhaber) kontoLines.push({ s: inhaber, f: font, color: INK });
    kontoLines.push({ s: `IBAN  ${formatIban(d.konto.iban)}`, f: bold, color: INK });
    if (d.konto.kontoname) kontoLines.push({ s: d.konto.kontoname, f: font, color: MUTED });
  }
  const kontoPad = 9;
  const kontoH = kontoLines.length ? kontoPad * 2 + kontoLines.length * LH : 0;

  // ---- Festes DIN-5008-Adressfeld (für Fensterumschlag) ----
  // Zentrale, in jedem Brief-PDF identisch positionierte Empfängeranschrift.
  const feldBottom = zeichneAdressfeld(page, font, {
    ruecksende: senderLine,
    empfaenger: adressfeldZeilen(d.empfaengerName, d.empfaengerAdresse),
  });

  // ---- Brieftext zeichnen/messen ab startY (UNTER dem Adressfeld) ----
  const renderBody = (startY: number, commit: boolean): number => {
    let y = startY;

    // Ort / Datum rechts
    if (commit) right(RIGHT, y, ortDatum, 9.5, font, INK);
    y -= 30;

    // Betreff + Objekt
    if (commit) text(ML, y, d.titel, 12.5, bold, INK);
    y -= 15;
    if (commit) text(ML, y, `Mietobjekt: ${d.objekt}`, 9, font, MUTED);
    y -= 9;
    if (commit) hline(y, ML, ML + 300, GOLD, 1);
    y -= 24;

    // Anrede
    if (commit) text(ML, y, `Sehr geehrte/r ${d.empfaengerName},`, 10.5, font, INK);
    y -= 20;

    // Absätze
    for (const para of d.absaetze) {
      for (const ln of wrap(para, 10.5, RIGHT - ML)) {
        if (commit) text(ML, y, ln, 10.5, font, INK);
        y -= LH;
      }
      y -= PG;
    }

    // Zahlungskonto-Box
    if (kontoLines.length) {
      y -= 4;
      const boxTop = y + 10;
      const boxBottom = boxTop - kontoH;
      if (commit) {
        page.drawRectangle({ x: ML, y: boxBottom, width: RIGHT - ML, height: kontoH, color: KONTO_BG });
        page.drawRectangle({ x: ML, y: boxBottom, width: 2.5, height: kontoH, color: GOLD });
      }
      let ky = boxTop - kontoPad - 9;
      for (const l of kontoLines) {
        if (commit) text(ML + 14, ky, l.s, l.f === bold ? 10 : 9.5, l.f, l.color);
        ky -= LH;
      }
      y = boxBottom - 20;
    }

    // Grußformel + Unterschrift
    y -= 6;
    if (commit) text(ML, y, "Mit freundlichen Grüßen", 10.5, font, INK);
    y -= 32;
    if (commit) text(ML, y, d.absender.name || "", 10.5, font, INK);
    y -= 14;

    return y;
  };

  // ---- Zwei-Pass: messen, dann vertikal mittig platzieren ----
  const topLimit = feldBottom - 28; // unter dem festen Adressfeld (kein Überlapp)
  const bottomLimit = 96; // über der Fußzeile
  const endMeasured = renderBody(topLimit, false);
  const bodyHeight = topLimit - endMeasured;
  const free = topLimit - bottomLimit - bodyHeight;
  const startY = topLimit - (free > 0 ? free * 0.45 : 0);
  renderBody(startY, true);

  // ---- Fußzeile ----
  hline(64, ML, RIGHT, LINE, 0.6);
  text(ML, 52, "MyImmo", 7.5, font, MUTED);
  const mid = "Seite 1 von 1";
  text(A4.w / 2 - font.widthOfTextAtSize(mid, 7.5) / 2, 52, mid, 7.5, font, MUTED);
  right(RIGHT, 52, heute, 7.5, font, MUTED);

  return doc.save();
}
