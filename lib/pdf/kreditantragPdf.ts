// Kreditantrag / Selbstauskunft als PDF im hellen MyImmo-Briefstil.
// Fasst Selbstauskunft (Person, Einnahmen, Ausgaben, Vermögen), gewähltes
// Objekt und Finanzierungswunsch zu einem Dokument zusammen, das der Nutzer
// SELBST an seine Bank(en) gibt. Keine Vermittlung, keine Beratung.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  eigenkapitalGesamt, haushaltsNetto, type SelbstauskunftDaten,
} from "@/lib/kauf/selbstauskunft";

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const BOX_BG = rgb(0.97, 0.96, 0.94);

const A4 = { w: 595.28, h: 841.89 };
const ML = 56, MR = 56, RIGHT = A4.w - MR;

function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—]/g, "-")
    .replace(/…/g, "...").replace(/ /g, " ")
    .split("").map((c) => (c.charCodeAt(0) > 255 && c !== "€" ? "?" : c)).join("");
}
const euro = (n: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n || 0))} €`;
const tracked = (s: string) => s.split("").join(" ");
const deDate = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

export type KreditAbsender = { name: string; adresse?: string | null; email?: string | null };
export type KreditObjekt = {
  name: string; adresse: string; kaufpreis: number; gesamtInvest: number;
  eigenkapital: number; darlehen: number; kaltmiete: number;
};
export type KreditWunsch = {
  darlehen: number; zinsbindung: number; anfangstilgung: number;
  sollzins: number; monatsrate: number; sondertilgung: boolean; prioritaet: string;
};

const PRIO_LABEL: Record<string, string> = {
  gleiche_rate: "Planbare, gleiche Rate",
  niedrige_rate: "Möglichst niedrige Rate",
  schnell_schuldenfrei: "Schnell schuldenfrei",
  zinssicherheit: "Maximale Zinssicherheit",
};
const BESCH_LABEL: Record<string, string> = {
  angestellt: "Angestellt", selbststaendig: "Selbstständig", beamter: "Beamt:in",
  rentner: "Rentner:in", sonstiges: "Sonstiges",
};

type Ctx = {
  page: PDFPage; font: PDFFont; bold: PDFFont;
  text: (x: number, y: number, s: string, size?: number, f?: PDFFont, color?: ReturnType<typeof rgb>) => void;
  right: (xR: number, y: number, s: string, size?: number, f?: PDFFont, color?: ReturnType<typeof rgb>) => void;
  hline: (y: number, x0?: number, x1?: number, color?: ReturnType<typeof rgb>, t?: number) => void;
};

async function neueSeite(doc: PDFDocument, absender: KreditAbsender, titel: string): Promise<Ctx & { y: number }> {
  const page = doc.addPage([A4.w, A4.h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const text: Ctx["text"] = (x, y, s, size = 10, f = font, color = INK) =>
    page.drawText(sanitize(s), { x, y, size, font: f, color });
  const right: Ctx["right"] = (xR, y, s, size = 10, f = font, color = INK) => {
    const ss = sanitize(s);
    page.drawText(ss, { x: xR - f.widthOfTextAtSize(ss, size), y, size, font: f, color });
  };
  const hline: Ctx["hline"] = (y, x0 = ML, x1 = RIGHT, color = LINE, t = 0.8) =>
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: t, color });

  const yTop = A4.h - 52;
  page.drawText("My", { x: ML, y: yTop, size: 22, font: serif, color: INK });
  page.drawText("Immo", { x: ML + serif.widthOfTextAtSize("My", 22), y: yTop, size: 22, font: serifI, color: GOLD });
  text(ML, yTop - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);
  right(RIGHT, yTop - 2, absender.name || "MyImmo", 10, bold, INK);
  let ry = yTop - 16;
  if (absender.adresse) { right(RIGHT, ry, absender.adresse.split(/,\s*/).join(" · "), 8.5, font, MUTED); ry -= 13; }
  if (absender.email) right(RIGHT, ry, absender.email, 8.5, font, MUTED);
  page.drawLine({ start: { x: 372, y: A4.h - 44 }, end: { x: 372, y: A4.h - 82 }, thickness: 1, color: GOLD });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  let y = A4.h - 128;
  text(ML, y, titel, 14, bold, INK);
  right(RIGHT, y + 1, deDate(new Date()), 9.5, font, MUTED);
  y -= 10;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 26;
  return { page, font, bold, text, right, hline, y };
}

function fuss(c: Ctx, seite: number, gesamt: number) {
  c.hline(64, ML, RIGHT, LINE, 0.6);
  c.text(ML, 52, "MyImmo · Selbstauskunft zur eigenen Weitergabe an die Bank", 7.5, c.font, MUTED);
  c.right(RIGHT, 52, `Seite ${seite} von ${gesamt}`, 7.5, c.font, MUTED);
}

// Abschnittsüberschrift
function abschnitt(c: Ctx, y: number, s: string): number {
  c.text(ML, y, s, 11, c.bold, GOLD);
  return y - 20;
}

// zweispaltige Label/Wert-Box
function kvBox(c: Ctx, y: number, rows: [string, string][]): number {
  const boxH = rows.length * 17 + 16;
  c.page.drawRectangle({ x: ML, y: y - boxH, width: RIGHT - ML, height: boxH, color: BOX_BG });
  c.page.drawRectangle({ x: ML, y: y - boxH, width: 2.5, height: boxH, color: GOLD });
  let ky = y - 19;
  for (const [l, v] of rows) {
    c.text(ML + 14, ky, l, 9, c.font, MUTED);
    c.right(RIGHT - 14, ky, v, 9.5, c.bold, INK);
    ky -= 17;
  }
  return y - boxH - 16;
}

export async function buildKreditantragPdf(
  absender: KreditAbsender,
  sa: SelbstauskunftDaten,
  objekt: KreditObjekt | null,
  wunsch: KreditWunsch | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Selbstauskunft & Finanzierungsanfrage");
  doc.setCreator("MyImmo");

  // ===== Seite 1: Selbstauskunft =====
  const c1 = await neueSeite(doc, absender, "Selbstauskunft & Finanzierungsanfrage");
  let y = c1.y;

  y = abschnitt(c1, y, "1. Person & Beschäftigung");
  y = kvBox(c1, y, [
    ["Name", absender.name || "–"],
    ["Familienstand", sa.familienstand || "–"],
    ["Kinder / Personen im Haushalt", `${sa.kinder} / ${sa.anzahlPersonen}`],
    ["Staatsangehörigkeit", sa.staatsangehoerigkeit || "–"],
    ["Beschäftigung", BESCH_LABEL[sa.beschaeftigung] || sa.beschaeftigung],
    ["Beruf / Arbeitgeber", [sa.beruf, sa.arbeitgeber].filter(Boolean).join(" · ") || "–"],
    ["Beschäftigt seit / Anstellung", [sa.beschaeftigtSeit, sa.befristung].filter(Boolean).join(" · ") || "–"],
  ]);

  const netto = haushaltsNetto(sa);
  y = abschnitt(c1, y, "2. Einnahmen (monatlich, netto)");
  y = kvBox(c1, y, [
    ["Nettoeinkommen", euro(sa.einkommen)],
    ["Netto Partner:in", euro(sa.einkommenPartner)],
    ["Mieteinnahmen (bestehend)", euro(sa.mieteinnahmen)],
    ["Kindergeld", euro(sa.kindergeld)],
    ["Sonstige Einnahmen", euro(sa.sonstigeEinnahmen)],
    ["Haushalts-Netto (ohne Miete)", euro(netto)],
  ]);

  const ausgaben = sa.wohnkostenAktuell + sa.ratenKredite + sa.versicherungen + sa.unterhalt + sa.sonstigeAusgaben;
  y = abschnitt(c1, y, "3. Ausgaben (monatlich)");
  y = kvBox(c1, y, [
    ["Aktuelle Wohnkosten/Miete", euro(sa.wohnkostenAktuell)],
    ["Laufende Kreditraten", euro(sa.ratenKredite)],
    ["Versicherungen", euro(sa.versicherungen)],
    ["Unterhalt / Sonstige", euro(sa.unterhalt + sa.sonstigeAusgaben)],
    ["Summe Ausgaben", euro(ausgaben)],
  ]);
  fuss(c1, 1, 2);

  // ===== Seite 2: Vermögen, Objekt, Finanzierungswunsch =====
  const c2 = await neueSeite(doc, absender, "Vermögen, Objekt & Finanzierungswunsch");
  y = c2.y;

  const ek = eigenkapitalGesamt(sa);
  y = abschnitt(c2, y, "4. Vermögen & Verbindlichkeiten");
  y = kvBox(c2, y, [
    ["Bank-/Tagesgeld", euro(sa.bankguthaben)],
    ["Wertpapiere / Depot", euro(sa.wertpapiere)],
    ["Bausparen", euro(sa.bausparen)],
    ["Sonstiges Vermögen", euro(sa.sonstigesVermoegen)],
    ["Eigenkapital gesamt", euro(ek)],
    ["Offene Verbindlichkeiten (Restschuld)", euro(sa.summeVerbindlichkeiten)],
  ]);

  if (objekt) {
    y = abschnitt(c2, y, "5. Objekt");
    y = kvBox(c2, y, [
      ["Objekt", objekt.name || "–"],
      ["Adresse", objekt.adresse || "–"],
      ["Kaufpreis", euro(objekt.kaufpreis)],
      ["Gesamtinvestition (inkl. NK)", euro(objekt.gesamtInvest)],
      ["Eingesetztes Eigenkapital", euro(objekt.eigenkapital)],
      ["Nettokaltmiete (bei Vermietung)", objekt.kaltmiete > 0 ? euro(objekt.kaltmiete) + " / Monat" : "–"],
    ]);
  }

  if (wunsch) {
    y = abschnitt(c2, y, `${objekt ? "6" : "5"}. Finanzierungswunsch`);
    y = kvBox(c2, y, [
      ["Darlehensbedarf", euro(wunsch.darlehen)],
      ["Priorität", PRIO_LABEL[wunsch.prioritaet] || wunsch.prioritaet],
      ["Gewünschte Zinsbindung", `${wunsch.zinsbindung} Jahre`],
      ["Anfängliche Tilgung", `${wunsch.anfangstilgung.toLocaleString("de-DE")} %`],
      ["Kalkulierte Monatsrate", `${euro(wunsch.monatsrate)} / Monat (Beispielzins ${wunsch.sollzins.toLocaleString("de-DE")} %)`],
      ["Sondertilgungsrecht gewünscht", wunsch.sondertilgung ? "ja" : "nein"],
    ]);
  }

  // Unterschriftsblock + Hinweis
  y -= 6;
  c2.text(ML, y, "Ich versichere die Richtigkeit und Vollständigkeit der Angaben und willige in die", 8.5, c2.font, MUTED);
  y -= 12;
  c2.text(ML, y, "Bonitätsprüfung (SCHUFA) durch die finanzierende Bank ein.", 8.5, c2.font, MUTED);
  y -= 34;
  c2.hline(y, ML, ML + 200, LINE, 0.8);
  c2.hline(y, RIGHT - 200, RIGHT, LINE, 0.8);
  c2.text(ML, y - 12, "Ort, Datum", 8, c2.font, MUTED);
  c2.text(RIGHT - 200, y - 12, "Unterschrift", 8, c2.font, MUTED);

  fuss(c2, 2, 2);
  return doc.save();
}
