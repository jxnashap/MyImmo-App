// Käufer-Selbstauskunft / Käufer-Kurzprofil für den Makler-Ordner — im hellen
// MyImmo-Briefstil (wie beleihungPdf.ts). Zeigt bewusst nur AGGREGATE (Haushalts-
// nettoeinkommen, Eigenkapital gesamt), keine rohen Kontostände — Datensparsamkeit
// gegenüber dem Makler. Es ist das eigene Vorstellungs-Dokument des Käufers.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { SelbstauskunftDaten } from "@/lib/kauf/selbstauskunft";
import { eigenkapitalGesamt, haushaltsNetto } from "@/lib/kauf/selbstauskunft";

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const BOX_BG = rgb(0.97, 0.96, 0.94);

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

function euro(n: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n))} €`;
}
const tracked = (s: string) => s.split("").join(" ");
function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

const BESCH_LABEL: Record<string, string> = {
  angestellt: "Angestellt", selbststaendig: "Selbstständig", beamter: "Beamter/Beamtin",
  rentner: "Rentner/in", sonstiges: "Sonstiges",
};
const BEFR_LABEL: Record<string, string> = {
  unbefristet: "unbefristet", befristet: "befristet", probezeit: "in Probezeit",
};

export type KaeuferAbsender = { name: string; adresse?: string | null; email?: string | null };

export async function buildKaeuferSelbstauskunftPdf(
  d: SelbstauskunftDaten,
  absender: KaeuferAbsender,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Käufer-Selbstauskunft");
  doc.setCreator("MyImmo");

  const page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const text = (x: number, y: number, s: string, size = 10, f: PDFFont = font, color = INK) =>
    page.drawText(sanitize(s), { x, y, size, font: f, color });
  const right = (xR: number, y: number, s: string, size = 10, f: PDFFont = font, color = INK) => {
    const ss = sanitize(s);
    page.drawText(ss, { x: xR - f.widthOfTextAtSize(ss, size), y, size, font: f, color });
  };
  const hline = (y: number, x0 = ML, x1 = RIGHT, color = LINE, t = 0.8) =>
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: t, color });

  // Briefkopf
  const yTop = A4.h - 52;
  page.drawText("My", { x: ML, y: yTop, size: 22, font: serif, color: INK });
  page.drawText("Immo", { x: ML + serif.widthOfTextAtSize("My", 22), y: yTop, size: 22, font: serifI, color: GOLD });
  text(ML, yTop - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);
  right(RIGHT, yTop - 2, absender.name || "Käufer/in", 10, bold, INK);
  let ry = yTop - 16;
  if (absender.adresse) { right(RIGHT, ry, absender.adresse.split(/,\s*/).join(" · "), 8.5, font, MUTED); ry -= 13; }
  if (absender.email) right(RIGHT, ry, absender.email, 8.5, font, MUTED);
  page.drawLine({ start: { x: 372, y: A4.h - 44 }, end: { x: 372, y: A4.h - 82 }, thickness: 1, color: GOLD });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  let y = A4.h - 128;
  text(ML, y, "Käufer-Selbstauskunft", 14, bold, INK);
  right(RIGHT, y + 1, deDate(new Date()), 9.5, font, MUTED);
  y -= 10;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 26;

  text(ML, y, "Zur Vorlage bei Makler / Verkäufer als Nachweis ernsthaften Kaufinteresses.", 9, font, MUTED);
  y -= 24;

  // Zwei-Spalten Kennzahlen
  const colW = (RIGHT - ML - 24) / 2;
  const L = { x0: ML, x1: ML + colW };
  const R = { x0: ML + colW + 24, x1: RIGHT };
  const kv = (yy: number, label: string, wert: string, col: { x0: number; x1: number }): number => {
    text(col.x0, yy, label, 9, font, MUTED);
    right(col.x1, yy, wert, 9.5, bold, INK);
    return yy - 17;
  };

  text(ML, y, "1. Person", 11, bold, GOLD);
  y -= 20;
  let yL = y, yR = y;
  yL = kv(yL, "Beschäftigung", BESCH_LABEL[d.beschaeftigung] || "–", L);
  yL = kv(yL, "Beruf", d.beruf || "–", L);
  yL = kv(yL, "Arbeitgeber", d.arbeitgeber || "–", L);
  yL = kv(yL, "Beschäftigt seit", d.beschaeftigtSeit ? `${d.beschaeftigtSeit} (${BEFR_LABEL[d.befristung] || d.befristung})` : "–", L);
  yR = kv(yR, "Familienstand", d.familienstand || "–", R);
  yR = kv(yR, "Kinder", String(d.kinder ?? 0), R);
  yR = kv(yR, "Haushaltsgröße", `${d.anzahlPersonen} Person(en)`, R);
  yR = kv(yR, "Staatsangehörigkeit", d.staatsangehoerigkeit || "–", R);
  y = Math.min(yL, yR) - 10;

  text(ML, y, "2. Finanzieller Rahmen", 11, bold, GOLD);
  y -= 8;
  const netto = haushaltsNetto(d);
  const ek = eigenkapitalGesamt(d);
  const rows: [string, string][] = [
    ["Haushalts-Nettoeinkommen / Monat", netto > 0 ? euro(netto) : "–"],
    ["Verfügbares Eigenkapital (gesamt)", ek > 0 ? euro(ek) : "–"],
    ["Bestehende monatliche Kreditraten", d.ratenKredite > 0 ? euro(d.ratenKredite) : "keine"],
    ["Finanzierung", "in Klärung mit der Bank"],
  ];
  const boxH = rows.length * 18 + 18;
  page.drawRectangle({ x: ML, y: y - boxH, width: RIGHT - ML, height: boxH, color: BOX_BG });
  page.drawRectangle({ x: ML, y: y - boxH, width: 2.5, height: boxH, color: GOLD });
  let ky = y - 20;
  for (const [l, v] of rows) {
    text(ML + 14, ky, l, 9, font, MUTED);
    right(RIGHT - 14, ky, v, 9.5, bold, INK);
    ky -= 18;
  }
  y = y - boxH - 22;

  text(ML, y, "Datensparsamkeit: Dieses Dokument nennt bewusst nur Gesamtsummen — Roh-Nachweise", 8.5, font, MUTED);
  y -= 12;
  text(ML, y, "(Gehaltsabrechnungen, Kontoauszüge) gehören zur Bank, die die Finanzierung prüft.", 8.5, font, MUTED);
  y -= 22;
  text(ML, y, "Angaben des Käufers / der Käuferin, freiwillig und ohne Gewähr. Aus MyImmo erzeugt.", 8, font, MUTED);

  // Fußzeile
  hline(64, ML, RIGHT, LINE, 0.6);
  text(ML, 52, "MyImmo", 7.5, font, MUTED);
  right(RIGHT, 52, "Käufer-Selbstauskunft", 7.5, font, MUTED);

  return doc.save();
}
