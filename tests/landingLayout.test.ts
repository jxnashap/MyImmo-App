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

// Geprueft gegen die Regeln aus `emilkowalski/skills` (Skill `animate`,
// Abschnitt „Never Ship"), am 02.09.2026 installiert.
describe("Bewegungsregeln", () => {
  it("kein `transition: all` — Eigenschaften werden benannt", () => {
    // `all` animiert auch Layout-Eigenschaften und laesst jede spaetere
    // Ergaenzung ungewollt mitlaufen. Kommentare zaehlen nicht mit.
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(ohneKommentare).not.toMatch(/transition:\s*all\b/);
  });

  it("kein scale(0) als Eingangsanimation", () => {
    // Nichts in der echten Welt erscheint aus dem Nichts — scale(.9-.97).
    expect(css).not.toMatch(/transform:\s*scale\(0\)/);
  });

  it("kein ease-in auf UI-Elementen", () => {
    // ease-in startet langsam — genau in dem Moment, den der Nutzer ansieht.
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(ohneKommentare).not.toMatch(/(transition|animation)[^;]*\bease-in\b(?!-out)/);
  });

  // Am 02.09.2026 auf einem emulierten Pixel 7 nachgemessen: Nach dem Antippen
  // einer Funktionskarte blieb ihr transform dauerhaft auf translateY(-3px)
  // stehen — der Schein-Hover von Touch-Geraeten.
  it("Hover-BEWEGUNG ist auf Zeigegeraete beschraenkt", () => {
    expect(css).toContain("@media (hover: none), (pointer: coarse)");
    const ab = css.indexOf("@media (hover: none), (pointer: coarse)");
    const block = css.slice(ab, css.indexOf("transform: none;", ab));
    for (const sel of [".lp-feature:hover", ".qlx .lp-feature:hover", ".kpi-card:hover", ".btn-ghost:hover"]) {
      expect(block).toContain(sel);
    }
  });

  // Chrome setzt bei Touch :hover UND :active gleichzeitig. Ein Gate ohne
  // `:not(:active)` wuerde das Druck-Feedback auf Touch erwuergen — genau so
  // gebaut und im Browser erwischt (transform waehrend des Drucks: none).
  it("das Touch-Gate laesst den Druck (:active) durch", () => {
    const ab = css.indexOf("@media (hover: none), (pointer: coarse)");
    // Kommentar im Block erwaehnt ":hover UND :active" — vorher rausnehmen.
    const block = css.slice(ab, css.indexOf("transform: none;", ab)).replace(/\/\*[\s\S]*?\*\//g, "");
    const hovers = block.match(/:hover(?::not\(:active\))?/g) ?? [];
    expect(hovers.length).toBeGreaterThanOrEqual(10);
    for (const h of hovers) expect(h).toBe(":hover:not(:active)");
  });

  // Gleiche Spezifitaet — es entscheidet die Reihenfolge. Stuende das Gate vor
  // `.qlx .lp-feature:hover` (Zeile ~2140), waere es wirkungslos. Genau das ist
  // beim Bauen passiert und fiel erst im Browser auf.
  it("das Gate steht NACH allen Hover-Regeln, gewinnt also", () => {
    const gate = css.indexOf("@media (hover: none), (pointer: coarse)");
    const letzterHover = css.lastIndexOf(":hover { transform: translate");
    expect(gate).toBeGreaterThan(letzterHover);
  });
});

// Runde 2 (02.09.2026): scroll-getriebene Einblendung, Druck-Feedback,
// Seitenuebergaenge. Gemessen im Browser: Startseite 16 -> 1 Intersection-
// Observer; tief liegende Abschnitte opacity 0 vor / 0.98 nach dem Scrollen.
describe("Bewegung Runde 2", () => {
  const reveal = readFileSync("components/landing/Reveal.tsx", "utf8");

  it("die starken Kurven sind NEUE Tokens — die alten bleiben unangetastet", () => {
    expect(css).toContain("--ease-out-stark: cubic-bezier(0.23, 1, 0.32, 1)");
    expect(css).toContain("--ease-in-out-stark: cubic-bezier(0.77, 0, 0.175, 1)");
    // Die bestehenden Tokens duerfen nicht still umgebogen worden sein.
    expect(css).toContain("--ease-out: cubic-bezier(0,0,.2,1)");
  });

  it("Einblendung laeuft scroll-getrieben in CSS, hinter @supports und Reduced-Motion", () => {
    const ab = css.indexOf("@supports (animation-timeline: view())");
    expect(ab).toBeGreaterThan(-1);
    const block = css.slice(ab, ab + 1200);
    expect(block).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(block).toContain("animation-timeline: view()");
    expect(block).toContain("animation-range: entry 8% cover 26%");
    // `both`: Elemente, die beim Laden schon im Bild sind, stehen im Endzustand.
    expect(block).toMatch(/animation:\s*lpReveal both/);
  });

  it("Reveal.tsx legt KEINEN Beobachter an, wenn CSS es kann", () => {
    // Sonst haette die CSS-Loesung nur Arbeit hinzugefuegt statt weggenommen.
    expect(reveal).toContain('CSS.supports?.("animation-timeline: view()")');
    expect(reveal.indexOf("CSS.supports")).toBeLessThan(reveal.indexOf("new IntersectionObserver"));
  });

  it("die Marketing-Knoepfe haben Druck-Feedback (scale .97, <=160 ms)", () => {
    expect(regel(".qlx-btn-hell:active")).toContain("scale(.97)");
    expect(regel(".qlx-btn-linie:active")).toContain("scale(.97)");
    expect(regel(".qlx-btn-hell")).toMatch(/transform \.16s var\(--ease-out-stark\)/);
    expect(regel(".qlx-btn-linie")).toMatch(/transform \.16s var\(--ease-out-stark\)/);
  });

  it("Seitenuebergaenge: an, unter 300 ms, bei Reduced-Motion aus", () => {
    expect(css).toContain("@view-transition { navigation: auto; }");
    expect(css).toMatch(/::view-transition-new\(root\)\s*\{[^}]*animation-duration:\s*\.22s/);
    const rm = css.indexOf("@media (prefers-reduced-motion: reduce) {\n  @view-transition { navigation: none; }");
    expect(rm).toBeGreaterThan(-1);
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

// ===== Redesign Runde 3 (02.09.2026) =====
// Auftrag: „bessere Layouts und Animationen, modern, innovativ, mit Detail".
// Zwei Eingriffe, beide im Browser nachgemessen.
describe("Buehne fuers Produktbild", () => {
  // Das Dashboard-Bild blendete wie jeder andere Abschnitt ein. Bei einer
  // Software IST das Produkt das Argument — es richtet sich jetzt beim
  // Hereinscrollen aus einer Neigung auf. Gemessen bei 1440px: vor dem
  // Scrollen opacity 0.83 mit matrix3d (geneigt), ab ~700px opacity 1.00 und
  // identity matrix (gerade).
  it("die Perspektive sitzt am Elternrahmen, nicht in der Transform-Kette", () => {
    // Sonst wird der Fluchtpunkt mitanimiert und wandert waehrend der Bewegung.
    expect(regel(".lp-buehne")).toContain("perspective: 1600px");
    expect(css).toMatch(/@keyframes lpBuehneAuf \{[^}]*rotateX\(9deg\)/);
  });

  it("scroll-getrieben und nur ohne Reduced-Motion", () => {
    const ab = css.indexOf(".lp-buehne > .lp-shot");
    const block = css.slice(Math.max(0, ab - 240), ab + 420);
    expect(block).toContain("@supports (animation-timeline: view())");
    expect(block).toContain("prefers-reduced-motion: no-preference");
    expect(block).toContain("animation-timeline: view()");
  });

  it("ohne scroll-getriebene Animationen steht das Bild gerade da", () => {
    // Das Bild liegt bewusst NICHT mehr in <Reveal> — ohne diesen Rueckfall
    // waere es in aelteren Browsern dauerhaft geneigt und halb durchsichtig.
    expect(css).toContain("@supports not (animation-timeline: view())");
    const ab = css.indexOf("@supports not (animation-timeline: view())");
    expect(css.slice(ab, ab + 200)).toContain("opacity: 1");
  });

  it("das Bild steckt nicht mehr zusaetzlich in <Reveal>", () => {
    // Beides uebereinander liesse es zweimal erscheinen.
    const lp = readFileSync("components/LandingPage.tsx", "utf8");
    expect(lp).toMatch(/<Shot buehne/);
    expect(lp).not.toMatch(/<Reveal>\s*<Shot/);
  });
});

describe("Redaktioneller Abschnittskopf", () => {
  // Neun Abschnitte im identischen Rhythmus (Kicker, zentrierte H2, Unterzeile)
  // lesen sich wie eine Vorlage. Inhaltsschwere Abschnitte bekommen jetzt einen
  // linksbuendigen Kopf mit der Unterzeile in einer zweiten Spalte.
  // Absichtlich KEINE feste Anzahl: Der erste Versuch nagelte „genau drei" fest
  // und schlug prompt beim naechsten Abschnitt fehl. Geprueft wird die Absicht —
  // ein GEMISCHTER Rhythmus. Waeren alle Koepfe redaktionell, waere die
  // Monotonie nur um 90 Grad gedreht.
  it("mehrere Abschnitte nutzen die Variante — aber nicht alle", () => {
    const lp = readFileSync("components/LandingPage.tsx", "utf8");
    const redaktionell = (lp.match(/className="lp-kopf-editorial"/g) ?? []).length;
    const kicker = (lp.match(/className="lp-kicker"/g) ?? []).length;
    expect(redaktionell).toBeGreaterThanOrEqual(3);
    // Es muss weiterhin zentrierte Koepfe geben (Kicker ausserhalb der Variante).
    expect(kicker).toBeGreaterThan(redaktionell);
  });

  it("linksbuendig, und die Unterzeile sitzt in der zweiten Spalte", () => {
    expect(css).toContain(".lp-kopf-editorial .lp-section-sub");
    const ab = css.indexOf(".lp-kopf-editorial {");
    const block = css.slice(ab, ab + 900);
    expect(block).toContain("text-align: left");
    expect(block).toContain("grid-column: 2");
  });

  it("auf dem Handy einspaltig — die zweite Spalte gilt erst ab 861px", () => {
    // Gemessen bei 390px: gridTemplateColumns = "none", kein Querlauf.
    const ab = css.indexOf(".lp-kopf-editorial {");
    const block = css.slice(ab, ab + 900);
    expect(block).toContain("@media (min-width: 861px)");
    expect(block.indexOf("@media (min-width: 861px)")).toBeLessThan(block.indexOf("grid-column: 2"));
  });
});
