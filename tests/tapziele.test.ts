import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// WCAG 2.2, 2.5.8 (Zielgroesse Minimum, Level AA): Bedienelemente brauchen
// mindestens 24x24 CSS-Pixel Trefferflaeche.
//
// Im Browser durchgemessen (Treffertest per elementFromPoint, nicht nur die
// Box — sonst uebersieht man vergroesserte Flaechen aus ::after):
//   .icon-btn 32x32 · .btn-icon 42x42 · .delete-btn 48x40 · .subtab 76x40
//   .tab-btn 73x30 · .settings-tab 81x36 · .btn 81x40 · .toast-close 26x26
//   .toast-action 81x28   -> alle bestehen AA
//   .danger-link 70x18    -> als EINZIGES darunter, deshalb korrigiert
//
// Die 44x44 aus 2.5.5 sind Level AAA und ausdruecklich nicht das Ziel: sie
// haetten jede Symbolschaltflaeche der App aufgeblaeht.

const css = readFileSync("app/globals.css", "utf8");

function regel(selektor: string): string {
  const m = css.match(new RegExp(`\\${selektor} \\{[^}]*\\}`));
  if (!m) throw new Error(`Regel ${selektor} nicht gefunden`);
  return m[0];
}

describe("Trefferflaechen (WCAG 2.5.8, 24x24)", () => {
  it(".danger-link hat die Polsterung, die ihn ueber 24 px bringt", () => {
    const r = regel(".danger-link");
    expect(r).toContain("padding: 4px 2px");
    // Der negative margin haelt das Layout an Ort und Stelle — ohne ihn
    // ruecken die Einstellungen-Bloecke auseinander.
    expect(r).toContain("margin: -4px -2px");
  });

  it(".delete-btn behaelt seine vergroesserte Flaeche aus ::after", () => {
    // Sieht mit 28x20 zu klein aus, ist per Pseudoelement aber 48x40. Wer das
    // ::after entfernt, weil es „leer" wirkt, reisst die Schwelle.
    expect(css).toContain('.delete-btn::after { content: ""; position: absolute; inset: -10px; }');
    expect(regel(".delete-btn")).toContain("position: relative");
  });

  it(".icon-btn und .btn-icon bleiben bei mindestens 24 px", () => {
    expect(regel(".icon-btn")).toMatch(/width: (3[2-9]|[4-9]\d)px/);
    expect(regel(".icon-btn")).toMatch(/height: (3[2-9]|[4-9]\d)px/);
    expect(regel(".btn-icon")).toMatch(/width: (3[2-9]|[4-9]\d)px/);
  });
});

describe("Breite Tabellen scrollen im eigenen Bereich", () => {
  // Global gilt `overflow-x: clip` auf html/body. Eine zu breite Tabelle wird
  // dadurch NICHT scrollbar, sondern stumm abgeschnitten — die letzte Spalte
  // ist dann einfach weg. Gemessen: die Vergleichstabelle braucht bei 320 px
  // Viewport 334 px, die letzte Spalte endete bei 346 px.
  const marktwert = readFileSync("components/MarktwertCard.tsx", "utf8");
  const einschaetzungen = readFileSync("components/MarktwertEinschaetzungen.tsx", "utf8");

  it("die fuenfspaltige Vergleichstabelle liegt in .table-scroll", () => {
    const ab = marktwert.indexOf("Vergleichsangebote");
    expect(marktwert.slice(ab).indexOf('className="table-scroll"')).toBeGreaterThan(-1);
  });

  it("die Marktwert-Historie liegt in .table-scroll", () => {
    expect(einschaetzungen).toContain('className="table-scroll"');
  });

  it("html/body clippen weiterhin, statt seitlich zu scrollen", () => {
    expect(css).toContain("html, body { max-width: 100%; overflow-x: clip;");
  });
});
