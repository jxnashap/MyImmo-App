// Server-seitige PDF-Erzeugung der NK-Abrechnung mit pdf-lib.
// Layout: heller DIN-A4-Geschäftsbrief im MyImmo-Stil (schwarzer Top-Streifen,
// Logo links, Vermieterblock rechts mit goldenem Trennstrich, Empfänger oben links).
// WinAnsi-Standardfonts (Helvetica/Times) decken Umlaute, €, § zuverlässig ab.

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { NkAbrechnung } from "@/lib/nk";
import { deDatum } from "@/lib/nk";
import { adressfeldZeilen, zeichneAdressfeld, ADRESSFELD } from "@/lib/pdf/adressfeld";

export type Vermieter = {
  name: string;
  strasse?: string | null;
  ort?: string | null;
  email?: string | null;
  kontoname?: string | null;
  kontoinhaber?: string | null;
  iban?: string | null;
};

const GOLD = rgb(0.722, 0.565, 0.169); // #b8902b
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);
const LINE = rgb(0.82, 0.8, 0.76);
const GREEN = rgb(0.16, 0.5, 0.34);
const RED = rgb(0.74, 0.26, 0.19);

const A4 = { w: 595.28, h: 841.89 };
const ML = 56; // linker Rand (~2 cm)
const MR = 56; // rechter Rand
const RIGHT = A4.w - MR;

function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .split("")
    .map((c) => (c.charCodeAt(0) > 255 && c !== "€" ? "?" : c))
    .join("");
}

function euro(n: number): string {
  const v = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${v} €`;
}

const tracked = (s: string) => s.split("").join(" ");

const formatIban = (s: string) =>
  s.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

/** Baut den Vermieterblock aus dem Profil (Fallback: ibans.inhaber → MyImmo). */
export function vermieterAus(
  profil:
    | {
        name?: string | null;
        strasse?: string | null;
        plz?: string | null;
        ort?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  iban?: { kontoname?: string | null; inhaber?: string | null; iban?: string | null } | null,
): Vermieter {
  const ort = [profil?.plz, profil?.ort].filter(Boolean).join(" ") || null;
  return {
    name: profil?.name || iban?.inhaber || "MyImmo",
    strasse: profil?.strasse ?? null,
    ort,
    email: profil?.email ?? null,
    kontoname: iban?.kontoname ?? null,
    kontoinhaber: iban?.inhaber ?? null,
    iban: iban?.iban ?? null,
  };
}

export async function buildNkPdf(
  a: NkAbrechnung,
  vermieter: Vermieter = { name: "MyImmo" },
  opts?: { mieterIban?: string | null },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Nebenkostenabrechnung ${a.jahr} – ${a.mieterName}`);
  doc.setCreator("MyImmo");

  let page = doc.addPage([A4.w, A4.h]);
  const seiten: PDFPage[] = [page];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const text = (
    x: number,
    y: number,
    s: string,
    size = 10,
    f: PDFFont = font,
    color = INK,
  ) => page.drawText(sanitize(s), { x, y, size, font: f, color });

  const right = (
    xRight: number,
    y: number,
    s: string,
    size = 10,
    f: PDFFont = font,
    color = INK,
  ) => {
    const ss = sanitize(s);
    page.drawText(ss, {
      x: xRight - f.widthOfTextAtSize(ss, size),
      y,
      size,
      font: f,
      color,
    });
  };

  const hline = (y: number, x0 = ML, x1 = RIGHT, color = LINE, thickness = 0.8) =>
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness, color });

  const fit = (s: string, size: number, maxW: number, f: PDFFont = font) => {
    let str = sanitize(s);
    if (f.widthOfTextAtSize(str, size) <= maxW) return str;
    while (str.length > 1 && f.widthOfTextAtSize(str + "...", size) > maxW)
      str = str.slice(0, -1);
    return str + "...";
  };

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
    return lines;
  };

  // Seitenumbruch: reicht der Platz nicht mehr, neue Seite beginnen.
  // (y ist im Aufrufkontext deklariert; Helfer arbeitet über Rückgabewert.)
  const neueSeiteWennNoetig = (yAktuell: number, benoetigt: number): number => {
    if (yAktuell - benoetigt > 84) return yAktuell; // 84 = Fußzeilen-Zone
    page = doc.addPage([A4.w, A4.h]);
    seiten.push(page);
    return A4.h - 64;
  };

  // ---- Kopf: Logo links ----
  let y = A4.h - 52;
  const logoSize = 22;
  text(ML, y, "My", logoSize, serif, INK);
  const wMy = serif.widthOfTextAtSize("My", logoSize);
  text(ML + wMy, y, "Immo", logoSize, serifI, GOLD);
  text(ML, y - 16, tracked("PRIVATES IMMOBILIEN-MANAGEMENT"), 6.5, font, MUTED);

  // ---- Kopf: Vermieterblock rechts ----
  right(RIGHT, y - 2, vermieter.name, 10, bold, INK);
  let ry = y - 16;
  if (vermieter.strasse || vermieter.ort) {
    right(RIGHT, ry, [vermieter.strasse, vermieter.ort].filter(Boolean).join(" · "), 8.5, font, MUTED);
    ry -= 13;
  }
  if (vermieter.email) right(RIGHT, ry, vermieter.email, 8.5, font, MUTED);

  // ---- Goldener vertikaler Trennstrich ----
  page.drawLine({
    start: { x: 372, y: A4.h - 44 },
    end: { x: 372, y: A4.h - 82 },
    thickness: 1,
    color: GOLD,
  });

  // ---- Volle Trennlinie unter dem Kopf ----
  hline(A4.h - 96, ML, RIGHT, GOLD, 0.8);

  // ---- Festes DIN-5008-Adressfeld (Empfänger, für Fensterumschlag) ----
  // Zentrale, in jedem Brief-PDF identisch positionierte Empfängeranschrift.
  const feldBottom = zeichneAdressfeld(page, font, {
    vermerk: ["Vertrauliches Dokument"],
    empfaenger: adressfeldZeilen(a.mieterName, a.mieterAdresse),
  });

  // ---- Ort/Datum + Referenz rechts (neben dem Adressfeld) ----
  const heute = deDatum(new Date().toISOString());
  const ortDatum = vermieter.ort ? `${vermieter.ort.replace(/^\d{4,5}\s*/, "")}, ${heute}` : heute;
  right(RIGHT, ADRESSFELD.anschriftTopY - 10, ortDatum, 9.5, font, INK);
  right(RIGHT, ADRESSFELD.anschriftTopY - 24, `Abrechnung Nr. NK-${a.jahr}`, 9, font, MUTED);

  // ---- Betreff (UNTER dem Adressfeld) ----
  y = feldBottom - 26;
  text(ML, y, `Nebenkostenabrechnung ${a.jahr}`, 13, bold, INK);
  y -= 15;
  text(
    ML,
    y,
    `Mietobjekt: ${[a.objekt, a.objektAdresse].filter(Boolean).join(" · ")}` +
      (a.einheit ? ` · Einheit ${a.einheit}` : ""),
    9,
    font,
    MUTED,
  );
  y -= 8;
  hline(y, ML, ML + 320, GOLD, 1);
  y -= 24;

  // ---- Anrede + Einleitung ----
  text(ML, y, `Sehr geehrte/r ${a.mieterName},`, 10, font, INK);
  y -= 18;
  const intro =
    `nachfolgend erhalten Sie die Abrechnung der Betriebs- und Nebenkosten für den ` +
    `Abrechnungszeitraum ${deDatum(a.zeitraumVon)} bis ${deDatum(a.zeitraumBis)} ` +
    `(${a.monate} ${a.monate === 1 ? "Monat" : "Monate"}).`;
  for (const ln of wrap(intro, 10, RIGHT - ML)) {
    text(ML, y, ln, 10, font, INK);
    y -= 15;
  }
  y -= 12;

  // ---- Tabelle im Layout der klassischen Betriebskostenabrechnung ----
  // Position | Betriebskostenabrechnung (Gesamt) | Basis | Anteil Wohnung | Zeitraum
  const colGesamt = ML + 226; // rechte Kante Spalte „Betriebskostenabrechnung"
  const colBasis = ML + 300; // Mitte Spalte „Basis"
  const colAnteil = ML + 380; // Mitte Spalte „Anteil"
  const center = (cx: number, yy: number, s: string, size = 10, f: PDFFont = font, color = INK) => {
    const ss = sanitize(s);
    page.drawText(ss, { x: cx - f.widthOfTextAtSize(ss, size) / 2, y: yy, size, font: f, color });
  };

  const zeitraumKopf = `${deDatum(a.zeitraumVon).slice(0, 6)}-${deDatum(a.zeitraumBis)}`;
  text(ML, y + 10, "Position", 9, bold, MUTED);
  // zweizeilige Köpfe wie in der Vorlage — verhindert Kollisionen der Spalten
  right(colGesamt, y + 10, "Betriebskosten-", 9, bold, MUTED);
  right(colGesamt, y, "abrechnung", 9, bold, MUTED);
  center(colBasis, y + 5, "Basis", 9, bold, MUTED);
  center(colAnteil, y + 10, "Anteil", 9, bold, MUTED);
  center(colAnteil, y, fit(a.einheit || "Wohnung", 9, 70), 9, bold, MUTED);
  right(RIGHT, y + 5, zeitraumKopf, 9, bold, MUTED);
  y -= 6;
  hline(y, ML, RIGHT, INK, 0.8);
  y -= 16;

  if (a.positionen.length === 0) {
    text(ML, y, "Keine umlagefähigen Positionen hinterlegt.", 10, font, MUTED);
    y -= 16;
  } else {
    for (const p of a.positionen) {
      const zeit = !!p.faktorText;
      y = neueSeiteWennNoetig(y, zeit ? 27 : 15);
      text(ML, y, fit(p.bezeichnung, 9.5, colGesamt - ML - 92), 9.5, font, INK);
      // Gesamtkosten des Hauses: eigene Spalte, sonst Jahreskosten der Aufteilung
      const gesamt = p.gesamtBetrag ?? (zeit ? p.basis ?? null : null);
      if (gesamt != null) right(colGesamt, y, euro(gesamt), 9.5, font, INK);
      // Basis: eigener Text, sonst Umlageschlüssel („manuell" bei direkter Eingabe)
      const basisText = p.basisText || p.umlageschluessel || (gesamt != null ? "manuell" : "");
      if (basisText) center(colBasis, y, fit(basisText, 9, 88), 9, font, MUTED);
      if (p.anteilText) center(colAnteil, y, fit(p.anteilText, 9, 78), 9, font, MUTED);
      right(RIGHT, y, euro(p.betrag), 9.5, font, INK);
      y -= 15;
      if (zeit) {
        // Aufteilungsfaktor: Jahreskosten × Belegungstage, z. B. "1.200,00 € × 181/365 Tage"
        right(RIGHT, y + 3, `${euro(p.basis ?? 0)} × ${p.faktorText}`, 8, font, MUTED);
        y -= 12;
      }
    }
  }
  y -= 3;
  hline(y);
  y -= 18;
  y = neueSeiteWennNoetig(y, 90);

  // ---- Summen ----
  const sumLabel = 330;
  const sumLine = (label: string, value: string, f: PDFFont = font, color = INK) => {
    text(sumLabel, y, label, 10, f, color);
    right(RIGHT, y, value, 10, f, color);
    y -= 16;
  };
  sumLine("Summe umlagefähige Kosten", euro(a.umlageGesamt));
  if (a.co2) {
    // kleinere Schrift: langes Label + Betrag dürfen sich nicht überlagern
    text(sumLabel, y, "CO2-Gutschrift Vermieteranteil", 9, font, GREEN);
    right(RIGHT, y, `- ${euro(a.co2.vermieterAnteil)}`, 10, font, GREEN);
    y -= 16;
    sumLine("Von Ihnen zu tragende Kosten", euro(a.kostenNachCo2));
  }
  sumLine(
    `Vorauszahlung (${a.monate} × ${euro(a.nkVorauszahlungMonat)})`,
    euro(a.vorauszahlungGeleistet),
  );
  y -= 3;
  hline(y, sumLabel, RIGHT, INK, 0.8);
  y -= 20;

  const guthaben = a.saldo >= 0;
  const saldoColor = guthaben ? GREEN : RED;
  text(sumLabel, y, guthaben ? "Ihr Guthaben (Erstattung)" : "Nachzahlung", 12, bold, saldoColor);
  right(RIGHT, y, euro(Math.abs(a.saldo)), 12, bold, saldoColor);
  y -= 26;

  // ---- CO₂-Kostenaufteilung (CO2KostAufG) ----
  if (a.co2) {
    y = neueSeiteWennNoetig(y, 70);
    text(ML, y, "CO2-Kostenaufteilung nach CO2KostAufG", 9.5, bold, INK);
    y -= 13;
    const co2Text =
      `Spezifischer CO2-Ausstoß: ${String(a.co2.spez).replace(".", ",")} kg/m² und Jahr` +
      (a.co2.gewerbe
        ? " · Gewerbe/Nichtwohngebäude: pauschale Aufteilung 50/50"
        : ` · Stufe ${a.co2.stufeLabel} kg/m²·a`) +
      `, damit Mieter ${a.co2.mieterProzent} %, Vermieter ${a.co2.vermieterProzent} %. ` +
      `CO2-Kosten gesamt: ${euro(a.co2.kostenGesamt)}` +
      (a.co2.geschaetzt ? " (geschätzt über BEHG-Referenzpreis)" : "") +
      ` — davon Mieteranteil ${euro(a.co2.mieterAnteil)} (in den Heizkosten enthalten), ` +
      `Vermieteranteil ${euro(a.co2.vermieterAnteil)} (oben gutgeschrieben). ` +
      `Rechtsgrundlage: Kohlendioxidkostenaufteilungsgesetz (CO2KostAufG). Die Einstufung ` +
      `beruht auf den Angaben der Brennstoff-/Wärmelieferrechnung, ohne Gewähr.`;
    for (const ln of wrap(co2Text, 8, RIGHT - ML)) {
      y = neueSeiteWennNoetig(y, 12);
      text(ML, y, ln, 8, font, MUTED);
      y -= 11;
    }
    y -= 7;
  }

  if (a.ausgenommen.length > 0) {
    text(
      ML,
      y,
      fit(
        `Nicht umlagefähig (nicht berechnet): ${a.ausgenommen.map((p) => p.bezeichnung).join(", ")}`,
        8,
        RIGHT - ML,
      ),
      8,
      font,
      MUTED,
    );
    y -= 18;
  }

  // ---- Schlusstext ----
  y = neueSeiteWennNoetig(y, 160);
  const hatKonto = !guthaben && !!vermieter.iban;
  const schluss = guthaben
    ? opts?.mieterIban
      ? `Das Guthaben wird Ihnen innerhalb von 14 Tagen auf Ihr Konto IBAN ${formatIban(opts.mieterIban)} erstattet. Bitte prüfen Sie, ob diese Bankverbindung noch aktuell ist.`
      : "Das Guthaben wird Ihnen innerhalb von 14 Tagen auf das uns bekannte Konto erstattet."
    : hatKonto
      ? "Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 14 Tagen auf folgendes Konto:"
      : "Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 14 Tagen auf das Ihnen bekannte Konto.";
  for (const ln of wrap(schluss, 10, RIGHT - ML)) {
    text(ML, y, ln, 10, font, INK);
    y -= 15;
  }
  if (hatKonto) {
    y -= 4;
    const inhaber = vermieter.kontoinhaber || vermieter.name;
    if (inhaber) { text(ML, y, inhaber, 10, bold, INK); y -= 14; }
    text(ML, y, `IBAN  ${formatIban(vermieter.iban!)}`, 10, bold, INK);
    y -= 15;
    if (vermieter.kontoname) { text(ML, y, vermieter.kontoname, 9, font, MUTED); y -= 14; }
  }
  y -= 16;
  text(ML, y, "Mit freundlichen Grüßen", 10, font, INK);
  y -= 48; // extra Zeile Platz für die Unterschrift
  text(ML, y, vermieter.name, 10, font, INK);

  // ---- Fußzeile (auf jeder Seite) ----
  seiten.forEach((pg, i) => {
    pg.drawLine({ start: { x: ML, y: 64 }, end: { x: RIGHT, y: 64 }, thickness: 0.6, color: LINE });
    pg.drawText("MyImmo", { x: ML, y: 52, size: 7.5, font, color: MUTED });
    const mid = `Seite ${i + 1} von ${seiten.length}`;
    pg.drawText(mid, { x: A4.w / 2 - font.widthOfTextAtSize(mid, 7.5) / 2, y: 52, size: 7.5, font, color: MUTED });
    const h = sanitize(heute);
    pg.drawText(h, { x: RIGHT - font.widthOfTextAtSize(h, 7.5), y: 52, size: 7.5, font, color: MUTED });
  });

  return doc.save();
}
