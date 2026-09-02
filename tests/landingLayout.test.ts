import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Zwei Layoutfehler der oeffentlichen Strecke, am 02.09.2026 im Browser
// gefunden und ausgemessen (Playwright, Viewport 390/768/1440 px). Beide waren
// auf grossen Schirmen unsichtbar und deshalb lange unbemerkt — genau deshalb
// stehen sie hier fest.
//
// FEHLER 1 — Hero-Text klebte am Bildschirmrand.
//   `.qlx-hero-inhalt` traegt im Markup zusaetzlich `.lp-inner`, das die
//   seitlichen 24px liefert. Die Kurzform `padding: 140px 0 64px` hat den
//   seitlichen Wert mitgeloescht. Auf 1440px faellt das nicht auf (max-width
//   1080px zentriert von allein), unterhalb von ~1128px begann die Ueberschrift
//   bei x=0 — gemessen an der echten Textkante per Range, nicht an der
//   Elementbox. Betroffen war JEDE Seite mit Hero: /, /funktionen, /ratgeber,
//   /vision, /vorlagen, /preise.
//
// FEHLER 2 — zwei von sechs Funktionskarten waren auf dem Handy unerreichbar.
//   Die Startseite setzte `style={{ gridTemplateColumns: "repeat(3, 1fr)" }}`
//   direkt am Element. Ein Inline-Style schlaegt jede Media Query, damit waren
//   die Umbruchpunkte fuer dieses Raster tot: bei 390px wurden drei Spalten in
//   342px gepresst (gemessen: 112.9 / 124.0 / 208.7 px), zwei Karten lagen
//   ausserhalb des Viewports — und die Seite scrollt nicht quer, sie waren also
//   schlicht weg.

const css = readFileSync("app/globals.css", "utf8");

function regel(selektor: string): string {
  const m = css.match(new RegExp(`\\${selektor} \\{[^}]*\\}`));
  if (!m) throw new Error(`Regel ${selektor} nicht gefunden`);
  return m[0];
}

describe("Hero-Inhalt behaelt seinen seitlichen Abstand", () => {
  it("die Grundregel setzt einen seitlichen Wert, keine Null", () => {
    const r = regel(".qlx-hero-inhalt");
    // Dreier-Kurzform mit 0 in der Mitte ist genau der Fehler.
    expect(r).not.toMatch(/padding:\s*[\d.]+px\s+0\s+[\d.]+px/);
    expect(r).toMatch(/padding:\s*[\d.]+px\s+[1-9][\d.]*px\s+[\d.]+px/);
  });

  it("auch die Handy-Variante in der Media Query", () => {
    // Zweites Vorkommen: im @media-Block. Beide muessen den Wert tragen.
    const alle = [...css.matchAll(/\.qlx-hero-inhalt \{[^}]*\}/g)].map((m) => m[0]);
    expect(alle.length).toBeGreaterThanOrEqual(2);
    for (const r of alle) {
      expect(r).not.toMatch(/padding:\s*[\d.]+px\s+0\s+[\d.]+px/);
    }
  });
});

describe("Raster bleiben umbruchfaehig", () => {
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((n) => {
      const pfad = join(ordner, n);
      if (statSync(pfad).isDirectory()) return dateien(pfad);
      return pfad.endsWith(".tsx") ? [pfad] : [];
    });
  }

  // Kommentare raus, bevor gesucht wird: Die Erklaerung des Fehlers enthaelt den
  // fehlerhaften Code als Zitat — ohne das hier meldet der Test seinen eigenen
  // Kommentar als Fund.
  function ohneKommentare(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  // Der eigentliche Fehler war nicht „drei Spalten", sondern „per Inline-Style".
  // Feste Spaltenzahlen gehoeren in eine Klasse, damit die Umbruchpunkte greifen.
  //
  // Geprueft wird die OEFFENTLICHE Strecke — sie ist am 02.09.2026 im Browser
  // durchgemessen worden. Im App-Bereich (hinter dem Login) stehen weitere feste
  // Inline-Raster; die sind hier bewusst NICHT eingeschlossen, weil sie nicht
  // nachgemessen wurden. Wer sie anfasst, misst vorher.
  it("kein Element der oeffentlichen Strecke setzt eine FESTE Spaltenzahl per Inline-Style", () => {
    const treffer: string[] = [];
    for (const p of [...dateien("app/(pub)"), ...dateien("components/landing"), "components/LandingPage.tsx"]) {
      const text = ohneKommentare(readFileSync(p, "utf8"));
      for (const m of text.matchAll(/gridTemplateColumns:\s*["'`]([^"'`]+)["'`]/g)) {
        const wert = m[1];
        // `auto-fill`/`auto-fit` mit minmax() bricht von allein um — erlaubt.
        if (/auto-fill|auto-fit/.test(wert)) continue;
        treffer.push(`${p.replace(/\\/g, "/")}: ${wert}`);
      }
    }
    expect(treffer).toEqual([]);
  });

  it("die Drei-Spalten-Variante existiert als Klasse", () => {
    expect(css).toContain(".lp-features--drei");
    expect(regel(".lp-features--drei")).toContain("repeat(3, 1fr)");
  });

  // Gleiche Spezifitaet (je eine Klasse) — es entscheidet die Reihenfolge in der
  // Datei. Steht die Variante spaeter, gewinnt sie gegen die Umbruchpunkte und
  // der Fehler waere zurueck, nur eine Ebene tiefer.
  it("und die Umbruchpunkte stehen SPAETER in der Datei, gewinnen also", () => {
    const variante = css.indexOf(".lp-features--drei {");
    const einSpaltig = css.lastIndexOf(".lp-features { grid-template-columns: 1fr");
    expect(variante).toBeGreaterThan(-1);
    expect(einSpaltig).toBeGreaterThan(variante);
  });
});

describe("Trefferflaechen der Fusszeile (WCAG 2.5.8)", () => {
  // Gemessen: 15px hoch, ohne unsichtbare Vergroesserung — und es sind die
  // Rechtslinks, die auf jeder Seite stehen muessen.
  it("Fusszeilen-Links tragen die Polsterung auf 24 px Hoehe", () => {
    const r = regel(".lp-footer-row a");
    expect(r).toContain("padding: 5px 3px");
    // Negativer Aussenabstand haelt die Zeilenabstaende der Fusszeile gleich.
    expect(r).toContain("margin: -5px -3px");
    expect(r).toContain("display: inline-block");
  });

  it("Brotkrumen-Links ebenfalls", () => {
    const b = readFileSync("components/landing/Brotkrumen.tsx", "utf8");
    expect(b).toContain('padding: "3px 2px"');
    expect(b).toContain('margin: "-3px -2px"');
  });
});
