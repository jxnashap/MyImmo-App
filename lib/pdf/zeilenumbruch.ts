// Zeilenumbruch für Brief, NK-Abrechnung und Übergabeprotokoll mit geschützten Leerzeichen
// (Design-Scan 06.10.2026).
//
// Vorher trennte jeder Builder an JEDEM Leerzeichen: „§“ stand allein am Zeilenende, die Nummer
// in der nächsten Zeile, Datumsangaben zerfielen („zum 13.“ | „Oktober 2026.“). Hier werden
// zusammengehörige Teile vor dem Umbruch verbunden. Als Bindezeichen dient ein Steuerzeichen,
// das in keinem Text vorkommt — ein echtes U+00A0 würde pdfText() in ein normales Leerzeichen
// verwandeln. Gezeichnet und gemessen wird immer mit normalem Leerzeichen.

import type { PDFFont } from "pdf-lib";
import { pdfText } from "@/lib/pdf/zeichen";

const BINDE = "\u0001";

const MONATE =
  "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
const GESETZE =
  "BGB|BMG|EStG|EStDV|BetrKV|HeizkostenV|HeizKV|CO2KostAufG|ZPO|WoFlV|GBO|GEG|GModG|GewO|StBerG|UStG";

/** Verbindet Teile, die nicht über ein Zeilenende getrennt werden sollen (auf bereinigtem Text). */
export function bindeLeerzeichen(s: string): string {
  return (
    s
      // „§ 556b“, „§§ 556, 560“
      .replace(/(§§?) (?=\d)/g, `$1${BINDE}`)
      // „Abs. 3“, „Nr. 2“, „S. 1“, „Satz 2“, „Art. 6“
      .replace(/(^|[\s(])(Abs\.|Nr\.|S\.|Satz|Art\.|Ziffer) (?=\d)/g, `$1$2${BINDE}`)
      // „556b BGB“, „Abs. 6 BMG“
      .replace(new RegExp(`(\\d[a-z]?) (?=(?:${GESETZE})(?![\\p{L}]))`, "gu"), `$1${BINDE}`)
      // „13. Oktober 2026“
      .replace(new RegExp(`(\\d{1,2}\\.) (${MONATE}) (?=\\d{4})`, "g"), `$1${BINDE}$2${BINDE}`)
      .replace(new RegExp(`(\\d{1,2}\\.) (?=(?:${MONATE})(?![\\p{L}]))`, "gu"), `$1${BINDE}`)
      // Zahl und Einheit: „1.234,50 €“, „20 %“, „80 m²“
      .replace(/(\d) (?=(?:€|%|m²|Euro|Tage|Monate?)(?![\p{L}]))/gu, `$1${BINDE}`)
  );
}

/** Bricht Text auf maxW um (bereinigt, mit geschützten Leerzeichen). Liefert mindestens eine Zeile. */
export function brichUm(s: string, size: number, maxW: number, font: PDFFont): string[] {
  const woerter = bindeLeerzeichen(pdfText(s)).split(" ");
  const zeilen: string[] = [];
  const ohne = (t: string) => t.split(BINDE).join(" ");
  const breite = (t: string) => font.widthOfTextAtSize(ohne(t), size);
  let cur = "";
  for (const w of woerter) {
    const t = cur ? `${cur} ${w}` : w;
    if (breite(t) <= maxW) cur = t;
    else {
      if (cur) zeilen.push(cur);
      cur = w;
    }
  }
  if (cur) zeilen.push(cur);
  const fertig = zeilen.map(ohne);
  return fertig.length ? fertig : [""];
}
