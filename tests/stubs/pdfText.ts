// Text aus einem mit pdf-lib erzeugten PDF lesen — für Tests, die das ECHTE PDF prüfen statt den
// abgefangenen Builder-Aufruf (P3, P4). pdf-lib packt Inhaltsströme mit Flate; Text steht als Hex
// in `<…> Tj`, davor die Position `1 0 0 1 x y Tm`.
import { inflateSync } from "node:zlib";

/** Textzeilen eines erzeugten PDFs (pdf-lib: Inhaltsströme sind Flate-gepackt, Text als Hex in `<…> Tj`). */
export function pdfZeilen(pdf: Uint8Array): string[] {
  return pdfTexte(pdf).map((t) => t.text);
}

/** Wie pdfZeilen, mit Grundlinie (y) — für Abstände. */
export function pdfTexte(pdf: Uint8Array): { text: string; y: number }[] {
  const b = Buffer.from(pdf);
  const s = b.toString("latin1");
  const zeilen: { text: string; y: number }[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    let inhalt = "";
    try {
      inhalt = inflateSync(b.subarray(start, s.indexOf("endstream", start))).toString("latin1");
    } catch {
      continue;
    }
    for (const t of inhalt.matchAll(/1 0 0 1 [\d.-]+ ([\d.-]+) Tm\s+<([0-9A-Fa-f]+)> Tj/g)) {
      zeilen.push({ text: Buffer.from(t[2], "hex").toString("latin1"), y: Number(t[1]) });
    }
  }
  return zeilen;
}

