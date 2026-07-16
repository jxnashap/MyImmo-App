// Server-seitige PDF-Erzeugung der Wohnungsgeberbestätigung (§ 19 BMG) mit
// pdf-lib. Heller DIN-A4-Bogen im MyImmo-Stil (Kopf/Fuß wie protokollPdf.ts) —
// OHNE schwarzen Streifen, OHNE DIN-Adressfeld (wird vor Ort unterschrieben).
//
// § 19 BMG: Der Wohnungsgeber muss der meldepflichtigen Person den Ein- bzw.
// Auszug schriftlich oder elektronisch binnen zwei Wochen bestätigen. Pflicht-
// angaben (§ 19 Abs. 3): Name und Anschrift des Wohnungsgebers, Einzugs- bzw.
// Auszugsdatum, Anschrift der Wohnung, Namen der meldepflichtigen Personen.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type WohnungsgeberDaten = {
  vorgang: "einzug" | "auszug";
  datum: string; // Einzugs-/Auszugsdatum, ISO (YYYY-MM-DD)
  wohnungsgeberName: string;
  wohnungsgeberAnschrift: string;
  wohnungsanschrift: string;
  personen: string[]; // meldepflichtige Personen
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

export async function buildWohnungsgeberPdf(d: WohnungsgeberDaten): Promise<Uint8Array> {
  const titel = "Wohnungsgeberbestätigung";
  const doc = await PDFDocument.create();
  doc.setTitle(`${titel} – ${d.personen[0] ?? ""}`);
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

  // ---- Kopf (wie protokollPdf, KEIN schwarzer Streifen) ----
  const yTop = A4.h - 52;
  text(ML, yTop, "My", 22, serif, INK);
  const wMy = serif.widthOfTextAtSize("My", 22);
  text(ML + wMy, yTop, "Immo", 22, serifI, GOLD);
  text(ML, yTop - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);
  if (d.wohnungsgeberName) right(RIGHT, yTop - 2, d.wohnungsgeberName, 10, bold, INK);
  page.drawLine({ start: { x: 372, y: A4.h - 44 }, end: { x: 372, y: A4.h - 82 }, thickness: 1, color: GOLD });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // ---- Titel + Rechtsgrundlage + goldene Unterlinie ----
  let y = A4.h - 130;
  text(ML, y, titel, 13, bold, INK);
  y -= 15;
  text(ML, y, "Bestätigung des Wohnungsgebers nach § 19 Bundesmeldegesetz (BMG)", 9, font, MUTED);
  y -= 9;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 26;

  // ---- Abschnittshelfer ----
  const abschnitt = (label: string) => {
    text(ML, y, label, 8, bold, MUTED);
    y -= 5;
    hline(y, ML, RIGHT, INK, 0.7);
    y -= 16;
  };
  const zeilenBlock = (zeilen: string[]) => {
    for (const z of zeilen) {
      const wrapped = wrap(z, 10.5, RIGHT - ML);
      for (const ln of wrapped) {
        text(ML, y, ln, 10.5, font, INK);
        y -= 15;
      }
    }
    y -= 10;
  };

  const deDatum = d.datum
    ? new Date(d.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const einzug = d.vorgang === "einzug";

  // ---- 1. Wohnungsgeber ----
  abschnitt("WOHNUNGSGEBER");
  zeilenBlock([d.wohnungsgeberName || "—", ...(d.wohnungsgeberAnschrift ? [d.wohnungsgeberAnschrift] : [])]);

  // ---- 2. Art und Datum ----
  abschnitt(einzug ? "EINZUG" : "AUSZUG");
  text(ML, y, einzug ? "Einzugsdatum:" : "Auszugsdatum:", 10.5, bold, INK);
  text(ML + bold.widthOfTextAtSize(einzug ? "Einzugsdatum:" : "Auszugsdatum:", 10.5) + 8, y, deDatum, 10.5, font, INK);
  y -= 25;

  // ---- 3. Wohnung ----
  abschnitt("ANSCHRIFT DER WOHNUNG");
  zeilenBlock([d.wohnungsanschrift || "—"]);

  // ---- 4. Meldepflichtige Personen ----
  abschnitt("MELDEPFLICHTIGE PERSON(EN)");
  const personen = d.personen.filter((p) => p.trim());
  if (personen.length === 0) {
    text(ML, y, "—", 10.5, font, MUTED);
    y -= 15;
  } else {
    for (const p of personen) {
      text(ML, y, `•  ${p}`, 10.5, font, INK);
      y -= 15;
    }
  }
  y -= 18;

  // ---- Bestätigungssatz ----
  for (const ln of wrap(
    einzug
      ? "Hiermit wird der Einzug der oben genannten Person(en) in die bezeichnete Wohnung bestätigt (§ 19 BMG)."
      : "Hiermit wird der Auszug der oben genannten Person(en) aus der bezeichneten Wohnung bestätigt (§ 19 BMG).",
    9.5,
    RIGHT - ML,
  )) {
    text(ML, y, ln, 9.5, font, MUTED);
    y -= 13;
  }

  // ---- Unterschrift ----
  y -= 60;
  page.drawLine({ start: { x: ML, y }, end: { x: ML + 250, y }, thickness: 0.8, color: MUTED });
  y -= 12;
  text(ML, y, "Ort, Datum & Unterschrift Wohnungsgeber", 8.5, font, MUTED);

  // ---- Fußzeile ----
  const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  page.drawLine({ start: { x: ML, y: 64 }, end: { x: RIGHT, y: 64 }, thickness: 0.6, color: LINE });
  page.drawText("MyImmo", { x: ML, y: 52, size: 7.5, font, color: MUTED });
  page.drawText(heute, { x: RIGHT - font.widthOfTextAtSize(heute, 7.5), y: 52, size: 7.5, font, color: MUTED });

  return doc.save();
}
