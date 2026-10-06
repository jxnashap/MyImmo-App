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
import { pdfText } from "@/lib/pdf/zeichen";
import { brichUm } from "@/lib/pdf/zeilenumbruch";

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

// WinAnsi-sichere Bereinigung: EINE Regel für alle PDF-Builder (lib/pdf/zeichen.ts).
const sanitize = pdfText;

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

  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font) => brichUm(s, size, maxW, f);

  // Seitenumbruch: reicht der Platz nicht mehr, neue Seite beginnen.
  // (y ist im Aufrufkontext deklariert; Helfer arbeitet über Rückgabewert.)
  // `unten`: tiefste erlaubte Grundlinie. 84 = Fußzeilen-Zone; der Schlussblock darf bis 74
  // (Fußlinie bei 64) — sonst wanderte der Gruß wegen weniger Punkte auf eine Folgeseite.
  const neueSeiteWennNoetig = (yAktuell: number, benoetigt: number, unten = 84): number => {
    if (yAktuell - benoetigt > unten) return yAktuell;
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
    start: { x: A4.w / 2, y: A4.h - 44 },
    end: { x: A4.w / 2, y: A4.h - 82 },
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
  // Umbrechen statt über den rechten Rand laufen (lange Bezeichnung + Adresse + Einheit).
  const objektZeilen = wrap(
    `Mietobjekt: ${[a.objekt, a.objektAdresse].filter(Boolean).join(" · ")}` +
      (a.einheit ? ` · Einheit ${a.einheit}` : ""),
    9,
    RIGHT - ML,
  ).slice(0, 2);
  objektZeilen.forEach((ln, i) => {
    text(ML, y, ln, 9, font, MUTED);
    if (i < objektZeilen.length - 1) y -= 12;
  });
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

  // ---- Tabelle ----
  // Spalten wie in der Web-Ansicht (BGH-Pflichtangaben): Position,
  // Gesamtkosten je Kostenart, Umlageschlüssel, Mieteranteil. Der Rechenweg steht
  // als Fußnote „(n)“ UNTER der Tabelle — gleiche Rechenwege nur einmal. Vorher bekam
  // jede Position eine eigene Unterzeile (27 statt 15 pt), und bei 9–12 Positionen
  // rutschte das Ergebnis auf Seite 2. Ohne Gebäude-Gesamtkosten (direkt erfasster
  // Anteil) steht in der Gesamt-Spalte ein Strich.
  const colGesamt = 300;   // rechte Kante der Gesamtkosten-Spalte
  const colSchluessel = 318;
  const tabellenKopf = () => {
    text(ML, y, "Umlagefähige Position", 9, bold, MUTED);
    right(colGesamt, y, "Gesamtkosten", 9, bold, MUTED);
    text(colSchluessel, y, "Umlageschlüssel", 9, bold, MUTED);
    right(RIGHT, y, "Ihr Anteil", 9, bold, MUTED);
    y -= 6;
    hline(y, ML, RIGHT, INK, 0.8);
    y -= 16;
  };
  tabellenKopf();

  const rechenwege: string[] = [];
  const fussnote = (t: string) => {
    let i = rechenwege.indexOf(t);
    if (i < 0) i = rechenwege.push(t) - 1;
    return i + 1;
  };

  if (a.positionen.length === 0) {
    text(ML, y, "Keine umlagefähigen Positionen hinterlegt.", 10, font, MUTED);
    y -= 16;
  } else {
    for (const p of a.positionen) {
      const gesamtText = p.basis != null ? euro(p.basis) : "—";
      // Name zweizeilig statt mit „…“ gekürzt; endet mit Abstand vor dem Gesamtbetrag.
      const nameW = colGesamt - ML - font.widthOfTextAtSize(sanitize(gesamtText), 10) - 10;
      const alleNamen = wrap(p.bezeichnung, 10, nameW);
      const namen = alleNamen.slice(0, 2);
      if (alleNamen.length > 2) namen[1] = fit(alleNamen.slice(1).join(" "), 10, nameW);
      const hoehe = 15 + (namen.length - 1) * 12;
      const vorher = y;
      y = neueSeiteWennNoetig(y, hoehe);
      if (y > vorher) tabellenKopf(); // Folgeseite: Spaltenkopf wiederholen
      const nr = p.faktorText ? fussnote(p.faktorText) : 0;
      const marke = nr ? ` (${nr})` : "";
      namen.forEach((ln, i) => text(ML, y - i * 12, ln, 10, font, INK));
      right(colGesamt, y, gesamtText, 10, font, MUTED);
      const schluesselW = RIGHT - colSchluessel - 70;
      const markeW = font.widthOfTextAtSize(marke, 10);
      text(colSchluessel, y, fit(p.umlageschluessel || "—", 10, schluesselW - markeW) + marke, 10, font, MUTED);
      right(RIGHT, y, euro(p.betrag), 10, font, INK);
      y -= hoehe;
    }
  }
  y -= 3;
  hline(y);
  y -= 14;

  // ---- Fußnoten: Rechenweg je Anteil (vollständig, umbrochen — nichts gekürzt) ----
  if (rechenwege.length) {
    rechenwege.forEach((t, i) => {
      for (const [j, ln] of wrap(`(${i + 1}) Anteil: ${t}`, 8, RIGHT - ML).entries()) {
        y = neueSeiteWennNoetig(y, 11);
        text(ML + (j ? 12 : 0), y, ln, 8, font, MUTED);
        y -= 10;
      }
    });
    y -= 6;
  }
  y -= 4;

  // ---- Höhe des Rests vorab: Summen, Ergebnis und Schluss sollen zusammenbleiben ----
  const guthaben = a.saldo >= 0;
  const hatKonto = !guthaben && !!vermieter.iban;
  const vorauszahlungZusatz =
    a.vorauszahlung.quelle === "gebucht"
      ? "gebuchte Zahlungen"
      : a.vorauszahlung.quelle === "historie"
        ? "laut Miethistorie"
        : `${a.monate} × ${euro(a.nkVorauszahlungMonat)}`;
  const summenHoehe = 16 + (a.co2 ? 32 : 0) + 16 + 11 + 3 + 20 + 22;
  const co2Text = a.co2
    ? `Spezifischer CO2-Ausstoß: ${String(a.co2.spez).replace(".", ",")} kg/m² und Jahr` +
      (a.co2.gewerbe
        ? " · Gewerbe/Nichtwohngebäude: pauschale Aufteilung 50/50"
        : ` · Stufe ${a.co2.stufeLabel} kg/m²·a`) +
      `, damit Mieter ${a.co2.mieterProzent} %, Vermieter ${a.co2.vermieterProzent} %. ` +
      `CO2-Kosten gesamt: ${euro(a.co2.kostenGesamt)}` +
      (a.co2.geschaetzt ? " (geschätzt über BEHG-Referenzpreis)" : "") +
      ` — davon Mieteranteil ${euro(a.co2.mieterAnteil)} (in den Heizkosten enthalten), ` +
      `Vermieteranteil ${euro(a.co2.vermieterAnteil)} (oben gutgeschrieben). ` +
      `Rechtsgrundlage: Kohlendioxidkostenaufteilungsgesetz (CO2KostAufG). Die Einstufung ` +
      `beruht auf den Angaben der Brennstoff-/Wärmelieferrechnung, ohne Gewähr.`
    : "";
  const hinweis35 =
    "Es handelt sich um die in Ihrem Kostenanteil enthaltenen Arbeits-/Lohnkosten (ohne Material). " +
    "Diese können Sie in Ihrer Einkommensteuererklärung geltend machen: haushaltsnahe Dienstleistungen " +
    "mit 20 % (max. 4.000 €/Jahr), Handwerkerleistungen mit 20 % (max. 1.200 €/Jahr). " +
    "Diese Bescheinigung ersetzt keine Steuerberatung; maßgeblich ist Ihr Steuerbescheid.";
  const co2Hoehe = a.co2 ? 13 + wrap(co2Text, 8, RIGHT - ML).length * 11 + 7 : 0;
  const p35Hoehe = a.paragraf35a
    ? 20 + a.paragraf35a.positionen.length * 13 + 2 +
      (a.paragraf35a.haushaltsnah > 0 ? 14 : 0) + (a.paragraf35a.handwerker > 0 ? 14 : 0) + 2 +
      wrap(hinweis35, 8, RIGHT - ML).length * 11 + 7
    : 0;
  const ausgenommenHoehe = a.ausgenommen.length > 0 ? 18 : 0;
  const schluss = guthaben
    ? opts?.mieterIban
      ? `Das Guthaben wird Ihnen innerhalb von 14 Tagen auf Ihr Konto IBAN ${formatIban(opts.mieterIban)} erstattet. Bitte prüfen Sie, ob diese Bankverbindung noch aktuell ist.`
      : "Das Guthaben wird Ihnen innerhalb von 14 Tagen auf das uns bekannte Konto erstattet."
    : hatKonto
      ? "Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 14 Tagen auf folgendes Konto:"
      : "Bitte überweisen Sie den Nachzahlungsbetrag innerhalb von 14 Tagen auf das Ihnen bekannte Konto.";
  const schlussZeilen = wrap(schluss, 10, RIGHT - ML);
  const inhaber = vermieter.kontoinhaber || vermieter.name;
  const UNTERSCHRIFT = 36; // Platz für die Unterschrift zwischen Gruß und Name
  // Genau gerechnet statt pauschal 160 pt: Bis zur Grundlinie des Namens.
  const schlussHoehe =
    schlussZeilen.length * 15 +
    (hatKonto ? 4 + (inhaber ? 14 : 0) + 15 + (vermieter.kontoname ? 14 : 0) : 0) +
    16 + UNTERSCHRIFT;
  const restHoehe = summenHoehe + co2Hoehe + p35Hoehe + ausgenommenHoehe + schlussHoehe;
  const seitenHoehe = A4.h - 64 - 74;
  // Passt der ganze Rest nicht mehr, wandern Summen, Ergebnis und Gruß GEMEINSAM auf die
  // Folgeseite — nie Schlusssatz und Grußformel allein. Ausnahme: Bei einer Nachzahlung mit
  // Kontoangabe trägt der Schlussblock eine eigene Seite (Zahlungsaufforderung + IBAN); dann
  // bleibt das Ergebnis auf Seite 1 bei der Tabelle. Ist der Rest länger als eine Seite (viele
  // § 35a-Positionen), bleiben wenigstens Summen und Ergebnis beisammen.
  // Stehen zwischen Ergebnis und Schluss noch Erläuterungsblöcke (CO2, § 35a), bleiben Summen
  // und Ergebnis bei der Tabelle und nur Erläuterungen + Schluss + Gruß wandern gemeinsam —
  // sonst stünde auf Seite 1 bei wenigen Positionen fast nichts mehr. (Die einzeilige
  // „Nicht umlagefähig“-Zeile zählt nicht: Seite 2 trüge sonst wieder nur Schluss + Gruß.)
  const zwischenHoehe = co2Hoehe + p35Hoehe;
  const passtGanz = y - restHoehe > 74;
  const nachSummenGemeinsam =
    !passtGanz && !hatKonto && restHoehe <= seitenHoehe && zwischenHoehe > 0 && y - summenHoehe > 84;
  y =
    !passtGanz && (hatKonto || restHoehe > seitenHoehe || nachSummenGemeinsam)
      ? neueSeiteWennNoetig(y, summenHoehe)
      : neueSeiteWennNoetig(y, restHoehe, 74);

  // ---- Summen ----
  const sumLabel = 330;
  const sumLine = (label: string, value: string, f: PDFFont = font, color = INK, zusatz?: string) => {
    const wertW = f.widthOfTextAtSize(sanitize(value), 10);
    // Label nie in den Betrag laufen lassen.
    text(sumLabel, y, fit(label, 10, RIGHT - sumLabel - wertW - 10, f), 10, f, color);
    right(RIGHT, y, value, 10, f, color);
    if (zusatz) {
      y -= 11;
      text(sumLabel, y, fit(zusatz, 8, RIGHT - sumLabel), 8, font, MUTED);
    }
    y -= 16;
  };
  sumLine("Summe umlagefähige Kosten", euro(a.umlageGesamt));
  if (a.co2) {
    sumLine("CO2-Gutschrift Vermieteranteil", `- ${euro(a.co2.vermieterAnteil)}`, font, GREEN);
    sumLine("Von Ihnen zu tragende Kosten", euro(a.kostenNachCo2));
  }
  sumLine(
    a.vorauszahlung.quelle === "gebucht" || a.vorauszahlung.quelle === "historie"
      ? "Geleistete Vorauszahlungen"
      : "Vorauszahlung",
    euro(a.vorauszahlungGeleistet),
    font,
    INK,
    vorauszahlungZusatz,
  );
  y -= 3;
  hline(y, sumLabel, RIGHT, INK, 0.8);
  y -= 20;

  const saldoColor = guthaben ? GREEN : RED;
  text(sumLabel, y, guthaben ? "Ihr Guthaben (Erstattung)" : "Nachzahlung", 12, bold, saldoColor);
  right(RIGHT, y, euro(Math.abs(a.saldo)), 12, bold, saldoColor);
  y -= 22;
  if (nachSummenGemeinsam) y = neueSeiteWennNoetig(y, restHoehe - summenHoehe, 74);

  // ---- CO₂-Kostenaufteilung (CO2KostAufG) ----
  if (a.co2) {
    y = neueSeiteWennNoetig(y, 70);
    text(ML, y, "CO2-Kostenaufteilung nach CO2KostAufG", 9.5, bold, INK);
    y -= 13;
    for (const ln of wrap(co2Text, 8, RIGHT - ML)) {
      y = neueSeiteWennNoetig(y, 12);
      text(ML, y, ln, 8, font, MUTED);
      y -= 11;
    }
    y -= 7;
  }

  // ---- § 35a EStG-Ausweis (haushaltsnahe Dienstleistungen / Handwerker) ----
  if (a.paragraf35a) {
    const p35 = a.paragraf35a;
    y = neueSeiteWennNoetig(y, 90);
    text(ML, y, "Steuerlich absetzbare Arbeitskosten (§ 35a EStG)", 9.5, bold, INK);
    y -= 6;
    hline(y, ML, RIGHT, LINE, 0.6);
    y -= 14;
    const zeile35 = (label: string, value: string, f: PDFFont = font, color = INK, size = 9.5) => {
      text(ML, y, label, size, f, color);
      right(RIGHT, y, value, size, f, color);
      y -= 14;
    };
    for (const pos of p35.positionen) {
      y = neueSeiteWennNoetig(y, 14);
      const artText = pos.art === "haushaltsnah" ? "haushaltsnahe Dienstleistung" : "Handwerkerleistung";
      text(ML, y, fit(`${pos.bezeichnung} (${artText})`, 9, RIGHT - ML - 70), 9, font, MUTED);
      right(RIGHT, y, euro(pos.betrag), 9, font, MUTED);
      y -= 13;
    }
    y -= 2;
    if (p35.haushaltsnah > 0) zeile35("Haushaltsnahe Dienstleistungen (§ 35a Abs. 2)", euro(p35.haushaltsnah), bold);
    if (p35.handwerker > 0) zeile35("Handwerkerleistungen (§ 35a Abs. 3)", euro(p35.handwerker), bold);
    y -= 2;
    for (const ln of wrap(hinweis35, 8, RIGHT - ML)) {
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
  y = neueSeiteWennNoetig(y, schlussHoehe, 74);
  for (const ln of schlussZeilen) {
    text(ML, y, ln, 10, font, INK);
    y -= 15;
  }
  if (hatKonto) {
    y -= 4;
    if (inhaber) { text(ML, y, inhaber, 10, bold, INK); y -= 14; }
    text(ML, y, `IBAN  ${formatIban(vermieter.iban!)}`, 10, bold, INK);
    y -= 15;
    if (vermieter.kontoname) { text(ML, y, vermieter.kontoname, 9, font, MUTED); y -= 14; }
  }
  y -= 16;
  text(ML, y, "Mit freundlichen Grüßen", 10, font, INK);
  y -= UNTERSCHRIFT; // Platz für die Unterschrift
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
