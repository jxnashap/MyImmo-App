// Kleine Satzhelfer für die Selbstauskunft-PDFs (Kreditantrag, Käufer-Selbstauskunft).

import type { PDFFont } from "pdf-lib";
import { pdfText } from "@/lib/pdf/zeichen";

/** „2019-03“ → „03/2019“ (das Formular speichert JJJJ-MM). */
export function monatDe(s: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(s ?? "");
  return m ? `${m[2]}/${m[1]}` : (s ?? "");
}

// Wert auf höchstens `maxZeilen` Zeilen der Breite maxW umbrechen; was dann noch übrig ist,
// endet mit „...“. Vorher stand der Wert ungekürzt rechtsbündig und überschrieb das Label.
export function umbrechen(f: PDFFont, s: string, size: number, maxW: number, maxZeilen = 2): string[] {
  const passt = (t: string) => f.widthOfTextAtSize(t, size) <= maxW;
  const kuerze = (t: string) => {
    if (passt(t)) return t;
    while (t.length > 1 && !passt(t + "...")) t = t.slice(0, -1);
    return t + "...";
  };
  const zeilen: string[] = [];
  let zeile = "";
  const woerter = pdfText(s).split(/\s+/).filter(Boolean);
  for (let i = 0; i < woerter.length; i++) {
    const probe = zeile ? `${zeile} ${woerter[i]}` : woerter[i];
    if (!zeile || passt(probe)) { zeile = probe; continue; }
    if (zeilen.length === maxZeilen - 1) { zeile = probe; continue; } // Rest in die letzte Zeile, gekürzt
    zeilen.push(zeile);
    zeile = woerter[i];
  }
  if (zeile || zeilen.length === 0) zeilen.push(zeile);
  return zeilen.map(kuerze);
}
