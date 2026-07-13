// PDF-Berichte im MyImmo-Briefstil (wie beleihungPdf/docPdf): Anlage-V-
// Aufstellung und Jahresbericht. Tabellen nach den Regeln professioneller
// Finanzberichte: Zahlen rechtsbündig mit festen zwei Dezimalen, Labels
// links, nur dünne horizontale Linien (unter dem Kopf, über Summen),
// Summenzeilen fett, Endergebnis mit Doppellinie (Buchhaltungs-Konvention).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ANLAGE_V_POSITIONEN, wertVon, type AnlageVErgebnis, type AnlageVObjekt } from "@/lib/anlageV";

const GOLD = rgb(0.722, 0.565, 0.169);
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const ROW_BG = rgb(0.972, 0.965, 0.947); // dezentes Zebra
const GREEN = rgb(0.16, 0.5, 0.34);
const RED = rgb(0.72, 0.21, 0.18);

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

// Feste zwei Dezimalen, Tausenderpunkt — € nur in Kopf-/Summenzeilen,
// damit die Ziffern in der Spalte exakt untereinander stehen.
const zahl = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const eur = (n: number) => `${zahl(n)} €`;

const tracked = (s: string) => s.split("").join(" ");

function fit(f: PDFFont, s: string, size: number, maxW: number): string {
  let str = sanitize(s);
  if (f.widthOfTextAtSize(str, size) <= maxW) return str;
  while (str.length > 1 && f.widthOfTextAtSize(str + "...", size) > maxW) str = str.slice(0, -1);
  return str + "...";
}

function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

export type BerichtAbsender = { name: string; adresse?: string | null; email?: string | null };

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  text: (x: number, y: number, s: string, size?: number, f?: PDFFont, color?: ReturnType<typeof rgb>) => void;
  right: (xR: number, y: number, s: string, size?: number, f?: PDFFont, color?: ReturnType<typeof rgb>) => void;
  hline: (y: number, x0?: number, x1?: number, color?: ReturnType<typeof rgb>, t?: number) => void;
  rect: (x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) => void;
};

async function neueSeite(doc: PDFDocument, absender: BerichtAbsender, titelZeile: string): Promise<Ctx & { y: number }> {
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
  const rect: Ctx["rect"] = (x, y, w, h, color) =>
    page.drawRectangle({ x, y, width: w, height: h, color });

  // Briefkopf (identisch zu den übrigen MyImmo-Dokumenten)
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
  page.drawLine({ start: { x: 372, y: A4.h - 44 }, end: { x: 372, y: A4.h - 82 }, thickness: 1, color: GOLD });
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // Titel + Datum
  let y = A4.h - 128;
  text(ML, y, titelZeile, 14, bold, INK);
  right(RIGHT, y + 1, deDate(new Date()), 9.5, font, MUTED);
  y -= 10;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 26;
  return { page, font, bold, text, right, hline, rect, y };
}

function fusszeile(c: Ctx, seite: number, gesamt: number, hinweis?: string) {
  c.hline(64, ML, RIGHT, LINE, 0.6);
  // Hinweis auf die verfügbare Breite kürzen, damit er die Seitenzahl nie überlappt.
  c.text(ML, 52, fit(c.font, hinweis ?? "MyImmo", 7.5, RIGHT - ML - 80), 7.5, c.font, MUTED);
  c.right(RIGHT, 52, `Seite ${seite} von ${gesamt}`, 7.5, c.font, MUTED);
}

// ================================================================ Anlage V ===

// Doppellinie unter dem Endergebnis (Buchhaltungs-Stil).
function doppellinie(c: Ctx, y: number, x0: number, x1: number) {
  c.hline(y, x0, x1, INK, 0.9);
  c.hline(y - 2.2, x0, x1, INK, 0.9);
}

/**
 * Eine Objekt-Aufstellung als zweispaltige Kontenblatt-Tabelle:
 * Position links, Betrag rechts. Gruppen (Einnahmen/Werbungskosten) mit
 * Zwischensummen, Endergebnis mit Doppellinie.
 */
function objektBlock(c: Ctx, yStart: number, o: AnlageVObjekt): number {
  const einnahmePos = ANLAGE_V_POSITIONEN.filter((p) => p.bereich === "einnahme");
  const wkPos = ANLAGE_V_POSITIONEN.filter((p) => p.bereich === "wk");
  const ROW = 16.5;
  const xBetrag = RIGHT;
  let y = yStart;

  // Objekt-Kopf
  c.text(ML, y, o.name, 11.5, c.bold, INK);
  const afaInfo =
    o.afaMethode === "degressiv" ? "AfA degressiv 5 % p.a."
      : o.afaMethode === "manuell" ? "AfA manuell"
      : o.afaMethode === "keine" ? "keine AfA (z. B. Grundstück)"
      : `AfA linear ${o.afaSatz.toLocaleString("de-DE")} % p.a.`;
  c.right(RIGHT, y, afaInfo, 8.5, c.font, MUTED);
  y -= 13;
  if (o.adresse) { c.text(ML, y, o.adresse, 8.5, c.font, MUTED); y -= 13; }
  y -= 4;

  // Tabellenkopf: Position | Betrag (EUR) — Linie nur darunter
  c.text(ML, y, tracked("POSITION"), 7, c.font, MUTED);
  c.right(xBetrag, y, tracked("BETRAG IN EUR"), 7, c.font, MUTED);
  y -= 5;
  c.hline(y, ML, RIGHT, LINE, 0.8);
  y -= ROW;

  const zeile = (label: string, betrag: number, opts?: { indent?: boolean; bold?: boolean; color?: ReturnType<typeof rgb>; zebra?: boolean }) => {
    if (opts?.zebra) c.rect(ML - 4, y - 4.5, RIGHT - ML + 8, ROW - 2, ROW_BG);
    c.text(ML + (opts?.indent ? 12 : 0), y, label, 9, opts?.bold ? c.bold : c.font, opts?.color ?? (opts?.bold ? INK : MUTED));
    c.right(xBetrag, y, zahl(betrag), 9.2, opts?.bold ? c.bold : c.font, opts?.color ?? INK);
    y -= ROW;
  };

  // Einnahmen
  c.text(ML, y, "Einnahmen", 9.5, c.bold, GREEN);
  y -= ROW;
  einnahmePos.forEach((p, i) => zeile(p.label, wertVon(o, p.key), { indent: true, zebra: i % 2 === 0 }));
  c.hline(y + ROW - 6, ML, RIGHT, LINE, 0.6);
  zeile("Summe Einnahmen (Zeile 21)", o.einnahmen.summe, { bold: true });
  y -= 6;

  // Werbungskosten
  c.text(ML, y, "Werbungskosten", 9.5, c.bold, RED);
  y -= ROW;
  wkPos.forEach((p, i) => zeile(p.label, wertVon(o, p.key), { indent: true, zebra: i % 2 === 0 }));
  c.hline(y + ROW - 6, ML, RIGHT, LINE, 0.6);
  zeile("Summe Werbungskosten (Zeile 51)", o.werbungskosten.summe, { bold: true });
  y -= 4;

  // Endergebnis mit Doppellinie
  c.hline(y + ROW - 6, ML, RIGHT, INK, 0.9);
  const positiv = o.ueberschuss >= 0;
  c.text(ML, y, positiv ? "Überschuss (Einkünfte, Zeile 23/24)" : "Verlust (Zeile 23/24)", 9.8, c.bold, positiv ? INK : RED);
  c.right(xBetrag, y, eur(o.ueberschuss), 9.8, c.bold, positiv ? GOLD : RED);
  doppellinie(c, y - 5.5, ML, RIGHT);
  y -= ROW + 8;
  return y;
}

export async function buildAnlageVPdf(
  erg: AnlageVErgebnis,
  absender: BerichtAbsender,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const titel = `Anlage V — Aufstellung ${erg.jahr}`;
  const seiten: Ctx[] = [];

  // Seite 1: Übersicht aller Objekte (eine Zeile je Objekt + Gesamt)
  let c = await neueSeite(doc, absender, titel);
  seiten.push(c);
  let y = c.y;
  c.text(ML, y, "Übersicht je Objekt", 11, c.bold, INK);
  y -= 20;

  // Spalten: Objekt | Einnahmen | Werbungskosten | Überschuss/Verlust
  const col2 = ML + 250, col3 = ML + 355, col4 = RIGHT;
  c.text(ML, y, tracked("OBJEKT"), 7, c.font, MUTED);
  c.right(col2, y, tracked("EINNAHMEN"), 7, c.font, MUTED);
  c.right(col3, y, tracked("WERBUNGSKOSTEN"), 7, c.font, MUTED);
  c.right(col4, y, tracked("ÜBERSCHUSS/VERLUST"), 7, c.font, MUTED);
  y -= 5;
  c.hline(y, ML, RIGHT, LINE, 0.8);
  y -= 16;
  erg.objekte.forEach((o, i) => {
    if (i % 2 === 0) c.rect(ML - 4, y - 4.5, RIGHT - ML + 8, 14, ROW_BG);
    c.text(ML, y, fit(c.font, o.name, 9, 180), 9, c.font, INK);
    c.right(col2, y, zahl(o.einnahmen.summe), 9.2, c.font, INK);
    c.right(col3, y, zahl(o.werbungskosten.summe), 9.2, c.font, INK);
    c.right(col4, y, zahl(o.ueberschuss), 9.2, c.font, o.ueberschuss >= 0 ? INK : RED);
    y -= 16.5;
  });
  c.hline(y + 16.5 - 6, ML, RIGHT, LINE, 0.6);
  c.text(ML, y, "Gesamt (alle Objekte)", 9.5, c.bold, INK);
  c.right(col2, y, eur(erg.gesamt.einnahmen.summe), 9.5, c.bold, GREEN);
  c.right(col3, y, eur(erg.gesamt.werbungskosten.summe), 9.5, c.bold, RED);
  c.right(col4, y, eur(erg.gesamt.ueberschuss), 9.5, c.bold, erg.gesamt.ueberschuss >= 0 ? GOLD : RED);
  doppellinie(c, y - 5.5, ML, RIGHT);
  y -= 34;

  c.text(ML, y, "Auf den Folgeseiten steht je Objekt die vollständige Aufstellung mit den Zeilen der Anlage V —", 8.5, c.font, MUTED);
  y -= 12;
  c.text(ML, y, "in ELSTER ist je Objekt eine eigene Anlage V auszufüllen.", 8.5, c.font, MUTED);
  y -= 20;
  c.text(ML, y, "Hinweise: Schuldzinsen sind aus aktueller Restschuld × Zinssatz geschätzt. Kautionen gelten als", 8.5, c.font, MUTED);
  y -= 12;
  c.text(ML, y, "durchlaufende Posten und sind nicht enthalten. Hilfestellung zur Anlage V — keine Steuerberatung.", 8.5, c.font, MUTED);

  // Folgeseiten: je Objekt ein Kontenblatt (2 Objekte je Seite, wenn Platz)
  const BLOCK_H = 330; // konservative Blockhöhe eines Objekt-Kontenblatts
  let yCur = 0;
  let offen = false;
  for (const o of erg.objekte) {
    if (!offen || yCur < 64 + BLOCK_H) {
      c = await neueSeite(doc, absender, titel);
      seiten.push(c);
      yCur = c.y;
      offen = true;
    }
    yCur = objektBlock(c, yCur, o) - 10;
  }

  const hinweis = "Anlage-V-Aufstellung - erstellt mit MyImmo. Keine Steuerberatung.";
  seiten.forEach((s, i) => fusszeile(s, i + 1, seiten.length, hinweis));
  return doc.save();
}

// ============================================================ Jahresbericht ===

export type JahresberichtZeile = {
  name: string;
  einnahmen: number;
  bewirtschaftung: number;
  zins: number;
  tilgung: number;
  cashflow: number;
};

export async function buildJahresberichtPdf(
  jahr: number,
  zeilen: JahresberichtZeile[],
  absender: BerichtAbsender,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const c = await neueSeite(doc, absender, `Jahresbericht ${jahr}`);
  let y = c.y;

  c.text(ML, y, "Cashflow-Auswertung je Objekt", 11, c.bold, INK);
  c.right(RIGHT, y, "Beträge in EUR", 8.5, c.font, MUTED);
  y -= 20;

  // Spaltenraster: Objekt breit links, 5 Zahlenspalten rechtsbündig
  const cols = [ML + 168, ML + 240, ML + 306, ML + 372, RIGHT] as const;
  const heads = ["EINNAHMEN", "BEWIRTSCH.", "ZINS", "TILGUNG", "CASHFLOW"] as const;
  c.text(ML, y, tracked("IMMOBILIE"), 7, c.font, MUTED);
  heads.forEach((h, i) => c.right(cols[i], y, tracked(h), 7, c.font, MUTED));
  y -= 5;
  c.hline(y, ML, RIGHT, LINE, 0.8);
  y -= 16;

  const ROW = 16.5;
  zeilen.forEach((r, i) => {
    if (i % 2 === 0) c.rect(ML - 4, y - 4.5, RIGHT - ML + 8, 14, ROW_BG);
    c.text(ML, y, fit(c.font, r.name, 9, 128), 9, c.font, INK);
    c.right(cols[0], y, zahl(r.einnahmen), 9.2, c.font, INK);
    c.right(cols[1], y, zahl(r.bewirtschaftung), 9.2, c.font, INK);
    c.right(cols[2], y, zahl(r.zins), 9.2, c.font, INK);
    c.right(cols[3], y, zahl(r.tilgung), 9.2, c.font, MUTED);
    c.right(cols[4], y, zahl(r.cashflow), 9.2, c.font, r.cashflow >= 0 ? INK : RED);
    y -= ROW;
  });

  const sum = zeilen.reduce(
    (a, r) => ({
      einnahmen: a.einnahmen + r.einnahmen,
      bewirtschaftung: a.bewirtschaftung + r.bewirtschaftung,
      zins: a.zins + r.zins,
      tilgung: a.tilgung + r.tilgung,
      cashflow: a.cashflow + r.cashflow,
    }),
    { einnahmen: 0, bewirtschaftung: 0, zins: 0, tilgung: 0, cashflow: 0 },
  );

  c.hline(y + ROW - 6, ML, RIGHT, LINE, 0.6);
  c.text(ML, y, "Summe", 9.5, c.bold, INK);
  c.right(cols[0], y, zahl(sum.einnahmen), 9.5, c.bold, GREEN);
  c.right(cols[1], y, zahl(sum.bewirtschaftung), 9.5, c.bold, RED);
  c.right(cols[2], y, zahl(sum.zins), 9.5, c.bold, RED);
  c.right(cols[3], y, zahl(sum.tilgung), 9.5, c.bold, MUTED);
  c.right(cols[4], y, eur(sum.cashflow), 9.5, c.bold, sum.cashflow >= 0 ? GOLD : RED);
  doppellinie(c, y - 5.5, ML, RIGHT);
  y -= 40;

  // Kennzahlen-Kasten: die drei Größen, die die Bank/der Steuerberater zuerst sucht
  const boxH = 64;
  c.rect(ML, y - boxH + 14, RIGHT - ML, boxH, ROW_BG);
  c.hline(y + 14, ML, RIGHT, GOLD, 1);
  const dritteln = (i: number) => ML + 16 + ((RIGHT - ML - 32) / 3) * i;
  const kpi = (i: number, label: string, wert: string, color: ReturnType<typeof rgb>) => {
    c.text(dritteln(i), y - 6, tracked(label), 6.5, c.font, MUTED);
    c.text(dritteln(i), y - 24, wert, 13, c.bold, color);
  };
  kpi(0, "EINNAHMEN GESAMT", eur(sum.einnahmen), GREEN);
  kpi(1, "AUSGABEN GESAMT", eur(sum.bewirtschaftung + sum.zins + sum.tilgung), RED);
  kpi(2, "CASHFLOW", eur(sum.cashflow), sum.cashflow >= 0 ? GOLD : RED);
  y -= boxH + 18;

  c.text(ML, y, "Hinweis: Die Tilgung baut Vermögen auf und ist kein Aufwand — steuerlich zählt nur der Zinsanteil.", 8.5, c.font, MUTED);
  y -= 12;
  c.text(ML, y, "Zins/Tilgung sind aus aktueller Restschuld × Zinssatz geschätzt (Näherung wie in der Steuer-Ansicht).", 8.5, c.font, MUTED);

  fusszeile(c, 1, 1, "Cashflow-Auswertung - erstellt mit MyImmo");
  return doc.save();
}
