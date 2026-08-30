import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BASIS_URL, ORGANISATION, brotkrumenListe } from "@/lib/seo/jsonLd";
import { RATGEBER, RECHTSSTAND } from "@/lib/ratgeber";
import { FUNKTIONSSEITEN } from "@/lib/funktionen";

describe("Organisation als eine Entitaet", () => {
  it("traegt ein festes @id, damit alle Seiten auf dieselbe Organisation zeigen", () => {
    expect(ORGANISATION["@id"]).toBe(`${BASIS_URL}/#org`);
  });

  it("nutzt ueberall absolute URLs — relative Pfade wertet Google nicht", () => {
    expect(ORGANISATION.url.startsWith("https://")).toBe(true);
    expect(ORGANISATION.logo.startsWith("https://")).toBe(true);
  });
});

describe("brotkrumenListe", () => {
  const stufen = [
    { name: "Start", pfad: "" },
    { name: "Ratgeber", pfad: "/ratgeber" },
    { name: "Artikel", pfad: "/ratgeber/x" },
  ];

  it("zaehlt ab 1 durch — position 0 ist laut Google ungueltig", () => {
    expect(brotkrumenListe(stufen).itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("macht absolute URLs, auch aus dem leeren Wurzelpfad", () => {
    const items = brotkrumenListe(stufen).itemListElement;
    expect(items[0].item).toBe(BASIS_URL);
    expect(items[2].item).toBe(`${BASIS_URL}/ratgeber/x`);
  });
});

describe("dateModified bleibt ehrlich", () => {
  it("faellt ohne echte Ueberarbeitung auf das Veroeffentlichungsdatum zurueck", () => {
    for (const a of RATGEBER) {
      const dateModified = a.aktualisiert ?? a.datum;
      expect(dateModified >= a.datum).toBe(true);
    }
  });

  it("kennt keinen Artikel, dessen Aktualisierung vor der Veroeffentlichung liegt", () => {
    const kaputt = RATGEBER.filter((a) => a.aktualisiert && a.aktualisiert < a.datum);
    expect(kaputt.map((a) => a.slug)).toEqual([]);
  });

  it("weist fuer jeden Artikel einen sichtbaren Rechtsstand aus", () => {
    for (const a of RATGEBER) {
      expect((a.rechtsstand ?? RECHTSSTAND).length).toBeGreaterThan(0);
    }
  });

  // Der Rechtsstand stand vorher zusaetzlich als „Stand Juli 2026." im
  // Fliesstext von 12 Artikeln. Beim naechsten Update haette jemand die
  // Konstante hochgesetzt und die 12 Stellen vergessen — dann behauptet die
  // Kopfzeile etwas anderes als der Text darunter.
  it("nennt den Rechtsstand nirgends fest im Artikeltext", () => {
    const text = JSON.stringify(RATGEBER);
    expect(text).not.toMatch(/Stand\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+20\d\d/);
  });
});

// Der Fehler, der beim Bauen dieses Features tatsaechlich passiert ist: die
// BreadcrumbList stand einmal in der Seite und einmal in <Brotkrumen>. Zwei
// widersprechende Angaben desselben Typs sind schlechter als gar keine —
// deshalb hier festgenagelt.
describe("kein Typ doppelt im Markup", () => {
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((n) => {
      const pfad = join(ordner, n);
      if (statSync(pfad).isDirectory()) return dateien(pfad);
      return pfad.endsWith(".tsx") ? [pfad] : [];
    });
  }

  it("keine Seite erzeugt BreadcrumbList selbst — das macht <Brotkrumen>", () => {
    const treffer = dateien("app")
      // Auf das Literal pruefen, nicht auf das Wort — Kommentare, die auf
      // <Brotkrumen> verweisen, sind erwuenscht.
      .filter((p) => /["']@type["']\s*:\s*["']BreadcrumbList["']/.test(readFileSync(p, "utf8")))
      .map((p) => p.replace(/\\/g, "/"));
    expect(treffer).toEqual([]);
  });
});

describe("Brotkrumen bilden die echte Seitenstruktur ab", () => {
  it("jeder Ratgeber-Slug ist eindeutig", () => {
    const slugs = RATGEBER.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("jeder Funktions-Slug ist eindeutig", () => {
    const slugs = FUNKTIONSSEITEN.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
