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

// Eine Jahreszahl im Slug altert mit — sie liest sich fuer Leser wie fuer
// Suchmaschinen als „nicht gepflegt", und Umbenennen kostet spaeter eine
// Weiterleitung. `grundsteuer-2025-…` stand ein Jahr zu lange so da.
describe("Slugs altern nicht", () => {
  it("kein Ratgeber-Slug traegt eine Jahreszahl", () => {
    const mitJahr = RATGEBER.map((a) => a.slug).filter((s) => /(^|-)(19|20)\d\d(-|$)/.test(s));
    expect(mitJahr).toEqual([]);
  });

  it("kein Funktions-Slug traegt eine Jahreszahl", () => {
    const mitJahr = FUNKTIONSSEITEN.map((f) => f.slug).filter((s) => /(^|-)(19|20)\d\d(-|$)/.test(s));
    expect(mitJahr).toEqual([]);
  });
});

// Gefunden am 01.09.2026: Google zeigte MyImmo unter `myimmoapp.store` statt
// `myimmoapp.de`. Beide Domains lieferten dieselbe App aus (200 von Vercel) —
// und das, obwohl `.store` bereits ein korrektes Canonical auf `.de` sendete.
// Canonical ist eben nur ein Hinweis. Verlaesslich hilft nur, dass es unter
// den Nebendomains nichts mehr zu indexieren gibt.
//
// Nachtrag vom selben Tag: Beim Blick in die Vercel-Domainliste kam eine
// DRITTE Domain zum Vorschein — `www.myimmoapp.com`, ebenfalls „Production",
// ebenfalls 200. Die erste Fassung dieser Regel kannte nur `.store`. Deshalb
// steht die Liste jetzt an einer Stelle und wird hier vollstaendig geprueft.
describe("Nur eine Domain liefert Inhalt aus", () => {
  const config = readFileSync("next.config.mjs", "utf8");
  const NEBEN = ["myimmoapp\\\\.store", "myimmoapp\\\\.com"];

  it("jede Nebendomain wird dauerhaft auf myimmoapp.de umgeleitet", () => {
    for (const host of NEBEN) {
      expect(config).toContain(`"(www\\\\.)?${host}"`);
    }
    expect(config).toContain('const HAUPTDOMAIN = "https://www.myimmoapp.de"');
    expect(config).toContain("destination: `${HAUPTDOMAIN}/:pfad*`");
    expect(config).toContain("permanent: true");
  });

  it("der Pfad bleibt erhalten — verlinkte Unterseiten landen nicht auf der Startseite", () => {
    const ab = config.indexOf("NEBENDOMAINS.map");
    expect(ab).toBeGreaterThan(-1);
    expect(config.slice(ab, ab + 300)).toContain('source: "/:pfad*"');
  });

  it("alle Absolut-URLs im Code zeigen auf .de, nie auf eine Nebendomain", () => {
    expect(BASIS_URL).toBe("https://www.myimmoapp.de");
    for (const datei of ["app/sitemap.ts", "app/robots.ts"]) {
      expect(readFileSync(datei, "utf8")).not.toMatch(/myimmoapp\.(store|com)/);
    }
  });
});
