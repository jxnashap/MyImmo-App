// PDFs für den Beleihungsordner: Objekt-Kennblatt, Mietaufstellung und
// Deckblatt/Übersicht fürs Bankpaket — im hellen MyImmo-Briefstil (wie
// docPdf.ts: Logo links, Absender rechts, goldener Trennstrich).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { pdfText } from "@/lib/pdf/zeichen";

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const BOX_BG = rgb(0.97, 0.96, 0.94);
const GREEN = rgb(0.16, 0.5, 0.34);

const A4 = { w: 595.28, h: 841.89 };
const ML = 56;
const MR = 56;
const RIGHT = A4.w - MR;

function euro(n: number): string {
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)} €`;
}

const tracked = (s: string) => s.split("").join(" ");

// Text auf maxW kürzen ("…"), damit Spalten nie ineinanderlaufen.
function fit(f: PDFFont, s: string, size: number, maxW: number): string {
  let str = pdfText(s);
  if (f.widthOfTextAtSize(str, size) <= maxW) return str;
  while (str.length > 1 && f.widthOfTextAtSize(str + "...", size) > maxW) str = str.slice(0, -1);
  return str + "...";
}

// Fläche deutsch („65,5 m²“), höchstens zwei Nachkommastellen — die Summe ist eine
// Gleitkommasumme und kann sonst Reste wie 68.89999999999999 tragen.
function qm(n: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n)} m²`;
}

// Mietbeginn aus den Ziffern des ISO-Datums (TT.MM.JJJJ) — nie über new Date() (Zeitzone).
function datumDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

export type BelAbsender = { name: string; adresse?: string | null; email?: string | null };

export type BelObjektDaten = {
  bezeichnung: string;
  adresse?: string | null;
  typ?: string | null;
  baujahr?: number | null;
  flaeche?: number | null;
  zimmer?: number | null;
  energieklasse?: string | null;
  kaufpreis?: number | null;
  wert?: number | null;
  mieteMo: number; // Summe Ist-Kaltmieten/Monat
  restschuld: number; // Summe Restschulden
  hausgeld?: number | null;
};

export type BelMieterZeile = {
  einheit?: string | null;
  name: string;
  flaeche?: number | null;
  kaltmiete?: number | null;
  nkVz?: number | null;
  mietbeginn?: string | null;
};

export type BelAngaben = {
  darlehen?: string;
  zweck?: string;
  zinsbindung?: string;
  tilgung?: string;
  wunschrate?: string;
  eigenkapital?: string;
  sondertilgung?: string;
};

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  text: (x: number, y: number, s: string, size?: number, f?: PDFFont, color?: ReturnType<typeof rgb>) => void;
  right: (xR: number, y: number, s: string, size?: number, f?: PDFFont, color?: ReturnType<typeof rgb>) => void;
  hline: (y: number, x0?: number, x1?: number, color?: ReturnType<typeof rgb>, t?: number) => void;
};

async function neueSeite(doc: PDFDocument, absender: BelAbsender, titelZeile: string): Promise<Ctx & { y: number }> {
  const page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const text: Ctx["text"] = (x, y, s, size = 10, f = font, color = INK) =>
    page.drawText(pdfText(s), { x, y, size, font: f, color });
  const right: Ctx["right"] = (xR, y, s, size = 10, f = font, color = INK) => {
    const ss = pdfText(s);
    page.drawText(ss, { x: xR - f.widthOfTextAtSize(ss, size), y, size, font: f, color });
  };
  const hline: Ctx["hline"] = (y, x0 = ML, x1 = RIGHT, color = LINE, t = 0.8) =>
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: t, color });

  // Briefkopf
  const yTop = A4.h - 52;
  page.drawText("My", { x: ML, y: yTop, size: 22, font: serif, color: INK });
  page.drawText("Immo", { x: ML + serif.widthOfTextAtSize("My", 22), y: yTop, size: 22, font: serifI, color: GOLD });
  text(ML, yTop - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);
  right(RIGHT, yTop - 2, absender.name || "MyImmo", 10, bold, INK);
  let ry = yTop - 16;
  if (absender.adresse) {
    right(RIGHT, ry, absender.adresse.split(/,\s*/).join(" · "), 8.5, font, MUTED);
    ry -= 13;
  }
  if (absender.email) right(RIGHT, ry, absender.email, 8.5, font, MUTED);
  page.drawLine({ start: { x: A4.w / 2, y: A4.h - 44 }, end: { x: A4.w / 2, y: A4.h - 82 }, thickness: 1, color: GOLD });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // Titel + Datum
  let y = A4.h - 128;
  const datum = deDate(new Date());
  // Titel nie über das rechtsbündige Datum laufen lassen.
  text(ML, y, fit(bold, titelZeile, 14, RIGHT - ML - font.widthOfTextAtSize(pdfText(datum), 9.5) - 16), 14, bold, INK);
  right(RIGHT, y + 1, datum, 9.5, font, MUTED);
  y -= 10;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 26;
  return { page, font, bold, text, right, hline, y };
}

function fusszeile(c: Ctx, seite: number, gesamt: number) {
  c.hline(64, ML, RIGHT, LINE, 0.6);
  c.text(ML, 52, "MyImmo", 7.5, c.font, MUTED);
  c.right(RIGHT, 52, `Seite ${seite} von ${gesamt}`, 7.5, c.font, MUTED);
}

// Kennzahlen-Zeile (Label links, Wert rechts fett). Gekürzt wird erst, wenn der Wert die
// echte Labelbreite erreicht — vorher pauschal Spaltenbreite − 70 pt, das schnitt schon die
// Demo-Adresse ab.
function kvZeile(c: Ctx, y: number, label: string, wert: string, x0: number, x1: number): number {
  c.text(x0, y, label, 9, c.font, MUTED);
  const frei = x1 - x0 - c.font.widthOfTextAtSize(pdfText(label), 9) - 12;
  c.right(x1, y, fit(c.bold, wert, 9.5, frei), 9.5, c.bold, INK);
  return y - 17;
}

function objektKennzahlen(c: Ctx, yStart: number, o: BelObjektDaten): number {
  const colW = (RIGHT - ML - 24) / 2;
  const L = { x0: ML, x1: ML + colW };
  const R = { x0: ML + colW + 24, x1: RIGHT };
  const mieteJahr = o.mieteMo * 12;
  const beleihungsauslauf = o.wert && o.wert > 0 ? (o.restschuld / o.wert) * 100 : null;
  const bruttoRendite = o.kaufpreis && o.kaufpreis > 0 ? (mieteJahr / o.kaufpreis) * 100 : null;

  // Objekt und Adresse über die volle Breite — in der halben Spalte fehlte sonst die PLZ/der Ort.
  let y0 = yStart;
  y0 = kvZeile(c, y0, "Objekt", o.bezeichnung, ML, RIGHT);
  y0 = kvZeile(c, y0, "Adresse", o.adresse || "–", ML, RIGHT);
  y0 -= 4;

  let yL = y0;
  yL = kvZeile(c, yL, "Typ", o.typ || "–", L.x0, L.x1);
  yL = kvZeile(c, yL, "Baujahr", o.baujahr ? String(o.baujahr) : "–", L.x0, L.x1);
  yL = kvZeile(c, yL, "Wohnfläche", o.flaeche ? qm(o.flaeche) : "–", L.x0, L.x1);
  yL = kvZeile(c, yL, "Zimmer", o.zimmer ? o.zimmer.toLocaleString("de-DE") : "–", L.x0, L.x1);
  yL = kvZeile(c, yL, "Energieklasse", o.energieklasse || "–", L.x0, L.x1);
  yL = kvZeile(c, yL, "Kaufpreis", o.kaufpreis ? euro(o.kaufpreis) : "–", L.x0, L.x1);

  let yR = y0;
  yR = kvZeile(c, yR, "Aktueller Wert", o.wert ? euro(o.wert) : "–", R.x0, R.x1);
  yR = kvZeile(c, yR, "Kaltmiete / Monat", o.mieteMo > 0 ? euro(o.mieteMo) : "–", R.x0, R.x1);
  yR = kvZeile(c, yR, "Kaltmiete / Jahr", mieteJahr > 0 ? euro(mieteJahr) : "–", R.x0, R.x1);
  yR = kvZeile(c, yR, "Bruttorendite", bruttoRendite != null ? `${bruttoRendite.toFixed(2).replace(".", ",")} %` : "–", R.x0, R.x1);
  yR = kvZeile(c, yR, "Restschuld gesamt", euro(o.restschuld), R.x0, R.x1);
  yR = kvZeile(c, yR, "Beleihungsauslauf", beleihungsauslauf != null ? `${beleihungsauslauf.toFixed(1).replace(".", ",")} %` : "–", R.x0, R.x1);

  return Math.min(yL, yR) - 6;
}

// ===== 1) Objekt-Kennblatt =====
export async function buildKennblattPdf(o: BelObjektDaten, absender: BelAbsender): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Objekt-Kennblatt – ${o.bezeichnung}`);
  doc.setCreator("MyImmo");
  const c = await neueSeite(doc, absender, "Objekt-Kennblatt");
  let y = objektKennzahlen(c, c.y, o);
  y -= 8;
  c.hline(y, ML, RIGHT, LINE, 0.6);
  y -= 16;
  c.text(ML, y, "Alle Angaben aus der MyImmo-Objektverwaltung; Werte ohne Gewähr.", 8, c.font, MUTED);
  fusszeile(c, 1, 1);
  return doc.save();
}

// ===== 2) Mietaufstellung =====
export async function buildMietaufstellungPdf(
  o: BelObjektDaten,
  mieter: BelMieterZeile[],
  absender: BelAbsender,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Mietaufstellung – ${o.bezeichnung}`);
  doc.setCreator("MyImmo");
  // Titel ohne Objektnamen (lief sonst über das Datum); der Name steht fett darunter.
  const c = await neueSeite(doc, absender, "Mietaufstellung");
  let y = c.y;

  c.text(ML, y, fit(c.bold, o.bezeichnung, 10.5, RIGHT - ML), 10.5, c.bold, INK);
  y -= 14;
  if (o.adresse) {
    c.text(ML, y, fit(c.font, o.adresse, 9, RIGHT - ML), 9, c.font, MUTED);
    y -= 14;
  }
  y -= 8;

  // Tabellenkopf — rechte Kanten der Zahlenspalten (überlappungsfrei)
  const cols = { einheit: ML, name: ML + 100, flaeche: ML + 290, kalt: ML + 360, nk: ML + 420 };
  c.text(cols.einheit, y, "Einheit", 8.5, c.bold, MUTED);
  c.text(cols.name, y, "Mieter", 8.5, c.bold, MUTED);
  c.right(cols.flaeche, y, "Fläche", 8.5, c.bold, MUTED);
  c.right(cols.kalt, y, "Kaltmiete", 8.5, c.bold, MUTED);
  c.right(cols.nk, y, "NK-VZ", 8.5, c.bold, MUTED);
  c.right(RIGHT, y, "Mietbeginn", 8.5, c.bold, MUTED);
  y -= 6;
  c.hline(y);
  y -= 15;

  let sumKalt = 0, sumNk = 0, sumFl = 0;
  for (const m of mieter) {
    sumKalt += m.kaltmiete ?? 0;
    sumNk += m.nkVz ?? 0;
    sumFl += m.flaeche ?? 0;
    c.text(cols.einheit, y, fit(c.font, m.einheit || "–", 9, cols.name - cols.einheit - 8), 9, c.font, INK);
    c.text(cols.name, y, fit(c.font, m.name, 9, cols.flaeche - cols.name - 44), 9, c.font, INK);
    c.right(cols.flaeche, y, m.flaeche ? qm(m.flaeche) : "–", 9, c.font, INK);
    c.right(cols.kalt, y, m.kaltmiete != null ? euro(m.kaltmiete) : "–", 9, c.font, INK);
    c.right(cols.nk, y, m.nkVz != null ? euro(m.nkVz) : "–", 9, c.font, INK);
    c.right(RIGHT, y, m.mietbeginn ? datumDe(m.mietbeginn) : "–", 9, c.font, INK);
    y -= 16;
  }
  y -= 2;
  c.hline(y);
  y -= 15;
  c.text(cols.einheit, y, "Summe", 9.5, c.bold, INK);
  c.right(cols.flaeche, y, sumFl > 0 ? qm(sumFl) : "–", 9.5, c.bold, INK);
  c.right(cols.kalt, y, euro(sumKalt), 9.5, c.bold, INK);
  c.right(cols.nk, y, euro(sumNk), 9.5, c.bold, INK);
  y -= 20;
  c.text(ML, y, `Warmmiete gesamt: ${euro(sumKalt + sumNk)} / Monat · ${euro((sumKalt + sumNk) * 12)} / Jahr`, 9.5, c.bold, GOLD);
  y -= 24;
  c.text(ML, y, "Stand: aktuelle Mietverhältnisse laut MyImmo-Mieterverwaltung.", 8, c.font, MUTED);

  fusszeile(c, 1, 1);
  return doc.save();
}

// ===== 3) Deckblatt / Übersicht fürs Bankpaket =====
const ZWECK_LABEL: Record<string, string> = {
  kauf: "Kauf",
  modernisierung: "Modernisierung",
  umschuldung: "Umschuldung",
  kapital: "Kapitalbeschaffung",
};

export async function buildDeckblattPdf(
  o: BelObjektDaten,
  angaben: BelAngaben,
  checkliste: { label: string; gruppe: string; erledigt: boolean }[],
  absender: BelAbsender,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Finanzierungsunterlagen – ${o.bezeichnung}`);
  doc.setCreator("MyImmo");

  // Seite 1: Kennblatt + Wunsch-Konditionen
  const c1 = await neueSeite(doc, absender, "Finanzierungsunterlagen – Übersicht");
  let y = c1.y;
  c1.text(ML, y, "1. Objekt", 11, c1.bold, GOLD);
  y -= 20;
  y = objektKennzahlen(c1, y, o);
  y -= 14;

  c1.text(ML, y, "2. Finanzierungswunsch", 11, c1.bold, GOLD);
  y -= 8;

  const rows: [string, string][] = [
    ["Darlehenshöhe", angaben.darlehen ? euro(Number(angaben.darlehen) || 0) : "–"],
    ["Verwendungszweck", ZWECK_LABEL[angaben.zweck || ""] || angaben.zweck || "–"],
    ["Zinsbindung", angaben.zinsbindung ? `${angaben.zinsbindung} Jahre` : "–"],
    ["Anfängliche Tilgung", angaben.tilgung ? `${angaben.tilgung} %` : "–"],
    ["Wunschrate", angaben.wunschrate ? `${euro(Number(angaben.wunschrate) || 0)} / Monat` : "–"],
    ["Eigenkapital", angaben.eigenkapital ? euro(Number(angaben.eigenkapital) || 0) : "–"],
    ["Sondertilgung gewünscht", angaben.sondertilgung || "–"],
  ];
  const boxH = rows.length * 17 + 18;
  c1.page.drawRectangle({ x: ML, y: y - boxH, width: RIGHT - ML, height: boxH, color: BOX_BG });
  c1.page.drawRectangle({ x: ML, y: y - boxH, width: 2.5, height: boxH, color: GOLD });
  let ky = y - 20;
  for (const [l, v] of rows) {
    c1.text(ML + 14, ky, l, 9, c1.font, MUTED);
    const frei = RIGHT - ML - 28 - c1.font.widthOfTextAtSize(pdfText(l), 9) - 12;
    c1.right(RIGHT - 14, ky, fit(c1.bold, v, 9.5, frei), 9.5, c1.bold, INK);
    ky -= 17;
  }
  y = y - boxH - 20;

  const auslauf = o.wert && o.wert > 0 ? (((Number(angaben.darlehen) || 0) + 0) / o.wert) * 100 : null;
  if (auslauf != null && (Number(angaben.darlehen) || 0) > 0) {
    c1.text(ML, y, `Beleihungsauslauf (Wunschdarlehen ÷ Objektwert): ca. ${auslauf.toFixed(1).replace(".", ",")} %`, 9.5, c1.bold, INK);
    y -= 16;
  }
  fusszeile(c1, 1, 2);

  // Seite 2: Anlagenverzeichnis (Checkliste mit Status)
  const c2 = await neueSeite(doc, absender, "Anlagenverzeichnis");
  y = c2.y;
  let gruppe = "";
  let nr = 0;
  for (const item of checkliste) {
    if (y < 90) break; // Sicherheitsgrenze — Checkliste passt regulär auf eine Seite
    if (item.gruppe !== gruppe) {
      gruppe = item.gruppe;
      y -= 6;
      c2.text(ML, y, gruppe, 10, c2.bold, GOLD);
      y -= 18;
    }
    nr += 1;
    // Status-Symbol als Vektor (✓/○ sind nicht WinAnsi-kodierbar)
    if (item.erledigt) {
      c2.page.drawLine({ start: { x: ML + 4, y: y + 3 }, end: { x: ML + 7, y: y }, thickness: 1.4, color: GREEN });
      c2.page.drawLine({ start: { x: ML + 7, y: y }, end: { x: ML + 13, y: y + 8 }, thickness: 1.4, color: GREEN });
    } else {
      c2.page.drawEllipse({ x: ML + 8, y: y + 3.5, xScale: 4, yScale: 4, borderColor: MUTED, borderWidth: 1 });
    }
    c2.text(ML + 22, y, `Anlage ${nr}: ${item.label}`, 9.5, c2.font, item.erledigt ? INK : MUTED);
    c2.right(RIGHT, y, item.erledigt ? "liegt bei" : "folgt", 8.5, c2.font, item.erledigt ? GREEN : MUTED);
    y -= 16;
  }
  fusszeile(c2, 2, 2);

  return doc.save();
}
