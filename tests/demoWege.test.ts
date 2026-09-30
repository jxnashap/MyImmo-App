import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  DEMO_BEREICHE,
  DEMO_ZIELE,
  demoBereich,
  demoDarfRoute,
  demoSperrZiel,
} from "@/lib/demo";
import { ALLE_ZIELE } from "@/lib/nav";
import { baueHeuteAufgaben } from "@/lib/heute";

// Führt jeder Weg, den die Demo anbietet, irgendwohin?
//
// ANLASS (Review 30.09.2026): Die Demo war an genau den Stellen kaputt, die
// der Rezensent gelobt hat. Die Aufgabenliste des Dashboards verlinkte
// AUSSCHLIESSLICH auf gesperrte Bereiche, zwei der drei geführten Demo-Wege
// der Startseite auch, und „Karte aktivieren" ebenso. Jeder dieser Klicks
// landete kommentarlos wieder auf dem Dashboard.
//
// Durchgerutscht ist das, weil der alte Test (heute.test.ts) nur prüfte, OB
// die Links auf der Startseite stehen — nicht, ob sie in der Demo aufgehen.
// Hier wird deshalb gegen `demoDarfRoute` selbst gerechnet.
//
// DIE REGEL: Ein Link in der Demo führt entweder in einen freien Bereich oder
// in einen gesperrten, der im Sperr-Dialog ERKLÄRT wird (`DEMO_BEREICHE`).
// Der allgemeine Ersatzsatz zählt nicht als Erklärung.

const HERKUNFT = "https://www.myimmoapp.de/";
const ERSATZ = demoBereich("/gibt-es-nicht").titel;

/** Gesperrt UND ohne eigenen Text im Dialog — genau das darf es nicht geben. */
function unerklaert(href: string): boolean {
  const pfad = new URL(href, HERKUNFT).pathname;
  return !demoDarfRoute(pfad) && demoBereich(pfad).titel === ERSATZ;
}

describe("Demo: jeder angebotene Weg führt irgendwohin", () => {
  it("der Erkenner ist nicht blind: gesperrt, frei und unbekannt werden unterschieden", () => {
    expect(ERSATZ).toBe("In der Demo gesperrt");
    expect(unerklaert("/gibt-es-nicht")).toBe(true);
    expect(unerklaert("/mietkonto")).toBe(false); // gesperrt, aber erklärt
    expect(unerklaert("/properties")).toBe(false); // frei
  });

  it("jedes Navigationsziel ist frei oder wird im Dialog erklärt", () => {
    expect(ALLE_ZIELE.length).toBeGreaterThan(10);
    const offen = ALLE_ZIELE.map((n) => n.href).filter(unerklaert);
    expect(offen).toEqual([]);
  });

  it("jede Zeile der Aufgabenliste ist frei oder wird erklärt", () => {
    const aufgaben = baueHeuteAufgaben(
      {
        offeneMieten: [{ mieterId: "m1", name: "A", objekt: "O", monat: "2026-09" }],
        anliegen: [{ id: "a1", titel: "Heizung", mieter: "B", erstellt: "2026-09-01T00:00:00Z" }],
        meldungen: [{ id: "z1", art: "Wasser", mieter: "C", datum: "2026-09-01" }],
        fristen: [{ datum: "2026-10-01", label: "Frist", sub: "", warn: false }],
      },
      "2026-09-30",
      10,
    );
    // Alle vier Quellen müssen vorkommen — sonst prüft der Test weniger, als er behauptet.
    expect(new Set(aufgaben.map((a) => a.art)).size).toBe(4);
    const offen = aufgaben.map((a) => a.href).filter(unerklaert);
    expect(offen).toEqual([]);
  });

  it("jeder Link auf dem Dashboard ist frei oder wird erklärt", () => {
    const quelle = readFileSync("app/(app)/page.tsx", "utf8");
    // Feste Links UND Template-Literale: Die Zeilen unter „Letzte Buchungen"
    // bauen ihr Ziel als `/${…}/${id}/edit` — die erste Fassung dieses Tests
    // las nur `href="…"` und sah sie nicht. Platzhalter werden durch ein
    // Segment ersetzt; `${isEin ? … : …}` am Pfadanfang in beide Zweige.
    const fest = [...quelle.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    const vorlagen = [...quelle.matchAll(/href=\{`(\/[^`]*)`\}/g)].flatMap((m) => {
      const zweige = /\$\{\w+ \? "([^"]+)" : "([^"]+)"\}/.exec(m[1]);
      const varianten = zweige ? [m[1].replace(zweige[0], zweige[1]), m[1].replace(zweige[0], zweige[2])] : [m[1]];
      return varianten.map((v) => v.replace(/\$\{[^}]*\}/g, "x"));
    });
    expect(fest.length).toBeGreaterThan(5);
    expect(fest).toContain("/karte"); // „Karte aktivieren" — war eine Sackgasse
    expect(vorlagen).toContain("/einnahmen/x/edit"); // der Erkenner muss sie sehen
    expect([...fest, ...vorlagen].filter(unerklaert)).toEqual([]);
  });

  it("jeder geführte Demo-Einstieg landet in einem FREIEN Bereich", () => {
    // Hier genügt „erklärt" nicht: Ein Einstieg, der mit einem Sperr-Dialog
    // beginnt, ist ein schlechterer erster Eindruck als gar keiner.
    for (const [weg, ziel] of Object.entries(DEMO_ZIELE)) {
      expect(demoDarfRoute(new URL(ziel, HERKUNFT).pathname), `weg=${weg} → ${ziel}`).toBe(true);
    }
  });

  it("die Startseite verlinkt nur Demo-Einstiege, die es in der Weißliste gibt", () => {
    const dateien = ["components/LandingPage.tsx", ...alleDateien("components/landing")];
    for (const p of dateien) {
      for (const m of readFileSync(p, "utf8").matchAll(/\/api\/demo\?weg=([a-z]+)/g)) {
        expect(Object.hasOwn(DEMO_ZIELE, m[1]), `${p}: weg=${m[1]}`).toBe(true);
      }
    }
  });

  it("jeder hinterlegte Bereich ist tatsächlich gesperrt (sonst veralteter Text)", () => {
    for (const pfad of Object.keys(DEMO_BEREICHE)) {
      expect(demoDarfRoute(pfad), pfad).toBe(false);
    }
  });
});

describe("demoSperrZiel: welche Links der Klick-Abfang übernimmt", () => {
  it("gesperrte eigene Pfade, auch mit Suchparametern und absolut", () => {
    expect(demoSperrZiel("/mietkonto?monat=2026-09", HERKUNFT)).toBe("/mietkonto");
    expect(demoSperrZiel("https://www.myimmoapp.de/steuer", HERKUNFT)).toBe("/steuer");
    expect(demoSperrZiel("/tenants/abc/nk", HERKUNFT)).toBe("/tenants/abc/nk");
  });

  it("freie Pfade, fremde Seiten und Unsinn bleiben unberührt", () => {
    expect(demoSperrZiel("/properties", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("/", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("#inhalt", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("https://example.com/steuer", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("mailto:info@myimmoapp.de", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("http://[", HERKUNFT)).toBeNull();
  });

  it("Unterseiten bekommen ihren eigenen Text", () => {
    expect(demoBereich("/tenants/abc/nk").titel).toBe("Nebenkostenabrechnung");
    expect(demoBereich("/mietkonto").titel).toBe("Mietkonto");
    // Präfix-Grenze: /steuerbar ist nicht /steuer.
    expect(demoBereich("/steuerbar").titel).toBe(ERSATZ);
  });
});

describe("Demo: Oberfläche sagt die Wahrheit und hat einen Ausgang", () => {
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  const leiste = readFileSync("components/DemoLeiste.tsx", "utf8");
  const sidebar = readFileSync("components/Sidebar.tsx", "utf8");

  it("kein Versprechen „alle Funktionen“ bei gesperrten Bereichen", () => {
    for (const q of [layout, leiste]) expect(q).not.toMatch(/alle Funktionen erkunden/);
  });

  it("die Leiste hat Early-Access-Knopf und „Demo beenden“, beide melden ab", () => {
    expect(leiste).toContain("{START_CTA}");
    expect(leiste).toContain("Demo beenden");
    expect(leiste).toMatch(/demoVerlassen\(/);
    const sperre = readFileSync("components/DemoSperre.tsx", "utf8");
    expect(sperre).toMatch(/signOut\(\)[\s\S]{0,200}location\.assign/);
  });

  it("Sperr-Dialog und Leiste sind im Layout eingebunden", () => {
    expect(layout).toContain("<DemoSperre />");
    expect(layout).toContain("<DemoLeiste />");
  });

  it("gesperrte Einträge der Seitenleiste sind anklickbar (kein stummer <span>)", () => {
    expect(sidebar).not.toMatch(/aria-disabled="true"/);
    expect(sidebar).toMatch(/className="nav-item nav-gesperrt"/);
  });

  it("der Sperr-Dialog liegt über der aufgeklappten Seitenleiste", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const z = (sel: string) => Number(new RegExp(`${sel}\\s*\\{[^}]*z-index:\\s*(\\d+)`).exec(css)?.[1]);
    expect(z("\\.sidebar")).toBeGreaterThan(0);
    expect(z("\\.demo-sperre-overlay")).toBeGreaterThan(z("\\.sidebar"));
  });
});

describe("Middleware: gesperrte Aufrufe erklären sich", () => {
  const mw = readFileSync("middleware.ts", "utf8");

  it("403 liefert `error` — den Schlüssel, den die KI-Formulare lesen", () => {
    expect(mw).toMatch(/NextResponse\.json\(\{ error: text/);
    for (const p of [
      "components/ImportWizard.tsx",
      "components/kalkulator/KalkImport.tsx",
      "components/NkOcrUpload.tsx",
      "components/UmlageAssistent.tsx",
    ]) {
      expect(readFileSync(p, "utf8"), p).toMatch(/json\.error/);
    }
  });

  it("die Weiterleitung nennt den gesperrten Bereich", () => {
    expect(mw).toMatch(/searchParams\.set\("bereich", pathname\)/);
  });
});

function alleDateien(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? alleDateien(p) : p.endsWith(".tsx") ? [p] : [];
  });
}
