import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// WCAG 2.2, 1.4.11 (Kontrast ohne Text): Die Grenze eines Bedienelements muss
// sich mit mindestens 3:1 von den angrenzenden Farben abheben. Eingabefelder
// hatten vorher `border: 1px solid transparent` und lebten allein von ihrer
// Fuellung — auf weisser Karte 1,09:1, auf dem Canvas sogar 1,0:1 (dieselbe
// Farbe, das Feld war schlicht nicht da). Diese Tests halten die Korrektur
// fest, damit sie niemand versehentlich wieder auf eine Haarlinie zurueckdreht.

const css = readFileSync("app/globals.css", "utf8");

function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function helligkeit([r, g, b]: number[]): number {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}
function hex(h: string): number[] {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
/** Halbtransparente Farbe ueber ihrem Untergrund verrechnen. */
function ueber(weissAnteil: number, untergrund: number[]): number[] {
  return untergrund.map((u) => Math.round(255 * weissAnteil + u * (1 - weissAnteil)));
}
function kontrast(a: number[], b: number[]): number {
  const la = helligkeit(a);
  const lb = helligkeit(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function token(name: string, ab: number): string {
  const teil = css.slice(ab);
  const treffer = teil.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!treffer) throw new Error(`Token --${name} nicht gefunden`);
  return treffer[1].trim();
}

describe("Feldrand haelt WCAG 1.4.11 (3:1)", () => {
  it("hell: gegen die Feldfuellung UND gegen die weisse Karte", () => {
    const rand = hex(token("feld-rand", 0));
    const fuellung = hex(token("bg3", 0));
    const karte = hex(token("bg2", 0));
    expect(kontrast(rand, fuellung)).toBeGreaterThanOrEqual(3);
    expect(kontrast(rand, karte)).toBeGreaterThanOrEqual(3);
  });

  it("dunkel: gegen die Feldfuellung UND gegen die Karte", () => {
    const ab = css.indexOf('[data-theme="dark"] {');
    expect(ab).toBeGreaterThan(0);
    const roh = token("feld-rand", ab);
    const anteil = Number(roh.match(/rgba\(255,255,255,([\d.]+)\)/)?.[1]);
    expect(Number.isFinite(anteil)).toBe(true);
    const fuellung = hex(token("bg3", ab));
    const karte = hex(token("bg2", ab));
    expect(kontrast(ueber(anteil, fuellung), fuellung)).toBeGreaterThanOrEqual(3);
    expect(kontrast(ueber(anteil, karte), karte)).toBeGreaterThanOrEqual(3);
  });

  it("die Haarlinie --line wuerde die Schwelle NICHT halten (Beleg, warum es ein eigenes Token braucht)", () => {
    expect(kontrast(hex(token("line", 0)), hex(token("bg2", 0)))).toBeLessThan(3);
  });
});

describe("kein Bedienelement faellt zurueck auf einen unsichtbaren Rand", () => {
  it("keine Feldregel in globals.css nutzt mehr 'border: 1px solid transparent'", () => {
    const feldregeln = css
      .split("\n")
      .filter((z) => /(\.form-group|\.field|^\.input|\.set-input|\.cmdk-trigger)/.test(z))
      .filter((z) => z.includes("border: 1px solid transparent"));
    expect(feldregeln).toEqual([]);
  });

  it("kein Feld traegt inline noch die Haarlinie --line/--line2 als Rand", () => {
    function dateien(ordner: string): string[] {
      return readdirSync(ordner).flatMap((n) => {
        const pfad = join(ordner, n);
        if (statSync(pfad).isDirectory()) return dateien(pfad);
        return pfad.endsWith(".tsx") ? [pfad] : [];
      });
    }
    const treffer: string[] = [];
    for (const pfad of [...dateien("components"), ...dateien("app")]) {
      const zeilen = readFileSync(pfad, "utf8").split("\n");
      let fenster = 0;
      zeilen.forEach((z, i) => {
        // Ein neues Element beendet das Fenster — sonst schlaegt der Test auch
        // bei einem <div> an, das zufaellig hinter einem Feld steht (etwa der
        // Segment-Umschalter in AnlageVExport, der kein Eingabefeld ist).
        if (/<[a-zA-Z]/.test(z)) fenster = 0;
        if (/<(input|select|textarea)[\s>]/.test(z)) fenster = 6;
        if (fenster > 0 && /border:\s*"1px solid var\(--line2?\)"/.test(z)) {
          treffer.push(`${pfad}:${i + 1}`);
        }
        fenster = Math.max(0, fenster - 1);
      });
    }
    expect(treffer).toEqual([]);
  });
});
