import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
//
// Gerechnet wird mit `demoSperrZiel` — derselben Funktion, die der Klick-
// Abfang zur Laufzeit benutzt. Die erste Fassung fragte `demoDarfRoute`
// direkt und übersah damit, dass öffentliche Seiten (Datenschutz, Impressum)
// frei sind: Der Abfang hielt sie für gesperrt, der Test auch — beide gleich
// falsch, also grün.

const HERKUNFT = "https://www.myimmoapp.de/";
const ERSATZ = demoBereich("/gibt-es-nicht").titel;

/** Gesperrt UND ohne eigenen Text im Dialog — genau das darf es nicht geben. */
function unerklaert(href: string): boolean {
  const ziel = demoSperrZiel(href, HERKUNFT);
  return ziel !== null && demoBereich(ziel).titel === ERSATZ;
}

describe("Demo: jeder angebotene Weg führt irgendwohin", () => {
  it("der Erkenner ist nicht blind: gesperrt, frei und unbekannt werden unterschieden", () => {
    expect(ERSATZ).toBe("In der Demo gesperrt");
    expect(unerklaert("/gibt-es-nicht")).toBe(true);
    expect(unerklaert("/makler")).toBe(false); // gesperrt, aber erklärt
    expect(unerklaert("/properties")).toBe(false); // frei
    expect(unerklaert("/datenschutz")).toBe(false); // öffentlich
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
        vollmachten: [{ id: "v1", name: "V", gueltigBis: "2026-10-15", abgelaufen: false }],
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
    expect(fest).toContain("/properties/new"); // „+ Immobilie" — war eine Sackgasse
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

  it("die Weißliste hat Einträge und die Startseite verlinkt jeden davon", () => {
    expect(Object.keys(DEMO_ZIELE).length).toBeGreaterThanOrEqual(4);
    const landing = readFileSync("components/LandingPage.tsx", "utf8");
    for (const weg of Object.keys(DEMO_ZIELE)) expect(landing).toContain(`/api/demo?weg=${weg}`);
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
    expect(demoSperrZiel("/makler?objekt=1", HERKUNFT)).toBe("/makler");
    expect(demoSperrZiel("https://www.myimmoapp.de/makler/datei/x", HERKUNFT)).toBe("/makler/datei/x");
    expect(demoSperrZiel("/properties/new", HERKUNFT)).toBe("/properties/new");
  });

  it("freie Pfade, öffentliche Seiten, fremde Seiten und Unsinn bleiben unberührt", () => {
    for (const frei of ["/properties", "/", "/mietkonto?monat=2026-09", "/steuer", "/tenants/abc/nk", "/anliegen", "/archiv"]) {
      expect(demoSperrZiel(frei, HERKUNFT), frei).toBeNull();
    }
    // Öffentlich: Die Middleware lässt sie auch der Demo durch. Bis 30.09.
    // öffnete „Datenschutz" in der Seitenleiste den Sperr-Dialog.
    for (const oeff of ["/datenschutz", "/impressum", "/avv", "/agb", "/ratgeber/x"]) {
      expect(demoSperrZiel(oeff, HERKUNFT), oeff).toBeNull();
    }
    expect(demoSperrZiel("#inhalt", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("https://example.com/archiv", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("mailto:info@myimmoapp.de", HERKUNFT)).toBeNull();
    expect(demoSperrZiel("http://[", HERKUNFT)).toBeNull();
  });

  it("gesperrte Bereiche und Formulare bekommen ihren eigenen Text", () => {
    expect(demoBereich("/makler").titel).toBe("Makler-Ordner");
    expect(demoBereich("/tenants/abc/edit").titel).toBe("Anlegen und bearbeiten");
    // Präfix-Grenze: /maklerin ist nicht /makler.
    expect(demoBereich("/maklerin").titel).toBe(ERSATZ);
  });
});

describe("Demo: KEIN Link irgendwo in der App läuft unerklärt ins Leere", () => {
  // Die Lehre aus Phase 1: Der Wächter prüfte nur Dashboard, Navigation und
  // Aufgabenliste — die Rechtslinks in der Fußzeile der Seitenleiste und der
  // CSV-Export auf /cashflow rutschten durch. Jetzt wird JEDE Datei gelesen,
  // die im App-Rahmen gerendert werden kann.
  // Dateien, die NIE im Demo-Konto (einem Vermieter) rendern: Mieter-Portal
  // und Handwerker-Bereich. Der Test unten prüft die Behauptung selbst — die
  // Komponenten dürfen nur von diesen Seiten importiert werden.
  // Seit der Mieterportal-Vorschau (01.10.2026) rendern AnfragenVomVermieter,
  // AnliegenPortal und ZaehlerPortal AUCH beim Vermieter (über PortalAnsicht
  // in /anliegen?tab=vorschau) — sie stehen deshalb NICHT mehr hier, ihre
  // Links werden geprüft wie alle anderen.
  const ANDERE_ROLLE = [
    join("app", "(app)", "portal", "page.tsx"),
    join("app", "(app)", "service", "page.tsx"),
  ];
  const dateien = [...alleDateien("app/(app)"), ...alleDateien("components")].filter(
    // Die Startseite rendert nur für Abgemeldete — dort gibt es keine Demo.
    (p) => !p.startsWith(join("components", "landing")) && !p.endsWith("LandingPage.tsx") && !ANDERE_ROLLE.includes(p),
  );

  it("die Ausnahmen gehören wirklich nur zu Mieter- und Handwerker-Seiten", () => {
    const seiten = ANDERE_ROLLE.filter((p) => p.startsWith("app"));
    for (const komp of ANDERE_ROLLE.filter((p) => p.startsWith("components"))) {
      const name = komp.replace(/^components[\\/]/, "").replace(/\.tsx$/, "");
      const nutzer = [...alleDateien("app"), ...alleDateien("components")].filter(
        // `import type` rendert nichts und zählt nicht als Verwendung.
        (p) => p !== komp && new RegExp(`^import (?!type )[^;]*from "@/components/${name}"`, "m").test(readFileSync(p, "utf8")),
      );
      expect(nutzer.length, name).toBeGreaterThan(0);
      for (const n of nutzer) expect(seiten, `${name} wird von ${n} benutzt`).toContain(n);
    }
  });

  function links(quelle: string): string[] {
    const fest = [...quelle.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    const vorlagen = [...quelle.matchAll(/href=\{`(\/[^`]*)`\}/g)].flatMap((m) => {
      const zweige = /\$\{\w+ \? "([^"]+)" : "([^"]+)"\}/.exec(m[1]);
      const varianten = zweige ? [m[1].replace(zweige[0], zweige[1]), m[1].replace(zweige[0], zweige[2])] : [m[1]];
      return varianten.map((v) => v.replace(/\$\{[^}]*\}/g, "x"));
    });
    return [...fest, ...vorlagen];
  }

  it("der Erkenner hat gesucht: genug Dateien und Links", () => {
    expect(dateien.length).toBeGreaterThan(150);
    const alle = dateien.flatMap((p) => links(readFileSync(p, "utf8")));
    expect(alle.length).toBeGreaterThan(100);
    expect(alle).toContain("/datenschutz");
  });

  it("jeder Link ist frei, öffentlich oder im Dialog erklärt", () => {
    const offen = dateien.flatMap((p) =>
      links(readFileSync(p, "utf8")).filter(unerklaert).map((l) => `${p}: ${l}`),
    );
    expect(offen).toEqual([]);
  });
});

describe("Demo: Oberfläche sagt die Wahrheit und hat einen Ausgang", () => {
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  const leiste = readFileSync("components/DemoLeiste.tsx", "utf8");
  const sidebar = readFileSync("components/Sidebar.tsx", "utf8");

  it("kein Versprechen „alle Funktionen“ bei gesperrten Bereichen", () => {
    for (const q of [layout, leiste]) expect(q).not.toMatch(/alle Funktionen erkunden/);
  });

  it("die Leiste hat „Demo beenden“ (und bei offener Registrierung den Start-Knopf), beide melden ab", () => {
    expect(leiste).toContain("{START_CTA}");
    expect(leiste).toMatch(/\{REGISTRIERUNG_OFFEN && \(/);
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
  const mw = readFileSync("proxy.ts", "utf8");

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

describe("Keine Karte (01.10.2026, Entscheidung des Betreibers)", () => {
  // Erst vom Dashboard genommen, am selben Tag auch die Kartenseite: Sie zeigte
  // nur einen Teil der Objekte und passte optisch nicht. Kein toter Link darf
  // bleiben, und keine Werbeaussage darf sie noch versprechen.
  it("weder Dashboard noch Objektliste verweisen auf eine Karte", () => {
    const quelle = readFileSync("app/(app)/page.tsx", "utf8");
    expect(quelle).not.toContain("PortfolioKarte");
    expect(quelle).not.toContain("Karte aktivieren");
    expect(readFileSync("app/(app)/properties/page.tsx", "utf8")).not.toContain('href="/karte"');
    expect(demoDarfRoute("/karte")).toBe(false);
  });
  it("die Startseite verspricht keine Karte mehr", () => {
    expect(readFileSync("components/LandingPage.tsx", "utf8")).not.toContain("Karte mit allen Standorten");
  });
  it("Kartenseite, Verortungs-Route und Leaflet-Bausteine sind weg", () => {
    for (const p of ["app/(app)/karte/page.tsx", "app/api/karte/verorten/route.ts", "components/PortfolioKarte.tsx", "components/KarteVerortung.tsx"]) {
      expect(existsSync(p), p).toBe(false);
    }
    expect(readFileSync("app/globals.css", "utf8")).not.toContain(".leaflet-");
  });
});
