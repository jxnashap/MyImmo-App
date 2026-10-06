// Verknüpfungs-Audit 06.10.2026, Paket D — Wege und Links.
// Jede Stelle, an der eine Aufgabe, ein Hinweis oder eine Tour-Station in eine Sackgasse führte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fristZiel, baueHeuteAufgaben, type FristZeile } from "@/lib/heute";
import { objektCheck } from "@/lib/objektCheck";

const lies = (p: string) => readFileSync(p, "utf8");
const HEUTE = "2026-10-06";
const leer = { offeneMieten: [], anliegen: [], meldungen: [], fristen: [] as FristZeile[] };

describe("fristZiel() — eine Frist führt zu ihrem Gegenstand", () => {
  it("NK-Abrechnung → NK-Seite des Mieters mit dem richtigen Jahr", () => {
    expect(fristZiel("mieter", "m1", "NK-Abrechnung 2025 zustellen")).toBe("/tenants/m1/nk?jahr=2025");
    // Dashboard setzt den Mieternamen davor — das Jahr muss trotzdem gefunden werden.
    expect(fristZiel("mieter", "m1", "Anna: NK-Abrechnung 2024 zustellen")).toBe("/tenants/m1/nk?jahr=2024");
  });
  it("andere Mieterfrist → Mieterseite; Objekt → Objektseite; Kredit, Steuer, Vertreter", () => {
    expect(fristZiel("mieter", "m1", "Mietende")).toBe("/tenants/m1");
    expect(fristZiel("objekt", "p1", "Energieausweis erneuern")).toBe("/properties/p1");
    expect(fristZiel("kredit", "k1", "Zinsbindung endet")).toBe("/kredite");
    expect(fristZiel("steuer", null, "Grundsteuer fällig")).toBe("/steuer");
    expect(fristZiel("vertreter", "v1", "Vollmacht endet")).toBe("/einstellungen?tab=vertreter");
  });
  it("ohne ID oder unbekannte Quelle → /termine (nie ein kaputter Link)", () => {
    expect(fristZiel("mieter", null, "Mietende")).toBe("/termine");
    expect(fristZiel("objekt", undefined, "x")).toBe("/termine");
    expect(fristZiel("eigen", "t1", "x")).toBe("/termine");
  });
});

describe("baueHeuteAufgaben() — Ziele der Dashboard-Zeilen", () => {
  it("Anliegen öffnet den Vorgang selbst, nicht die Liste", () => {
    const a = baueHeuteAufgaben({ ...leer, anliegen: [{ id: "a 1", titel: "Heizung", mieter: "B", erstellt: "2026-10-05T10:00:00Z" }] }, HEUTE);
    expect(a[0].href).toBe("/anliegen?vorgang=a%201");
  });
  it("Frist mit Ziel → Ziel + „Öffnen“; ohne Ziel → /termine + „Termin öffnen“", () => {
    const a = baueHeuteAufgaben(
      {
        ...leer,
        fristen: [
          { datum: "2026-10-20", label: "NK-Abrechnung 2025 zustellen", sub: "x", warn: false, href: "/tenants/m1/nk?jahr=2025" },
          { datum: "2026-10-21", label: "Eigener Termin", sub: "y", warn: false },
        ],
      },
      HEUTE,
      Infinity,
    );
    const nk = a.find((x) => x.label.startsWith("NK"))!;
    const eigen = a.find((x) => x.label === "Eigener Termin")!;
    expect(nk.href).toBe("/tenants/m1/nk?jahr=2025");
    expect(nk.aktion).toBe("Öffnen");
    expect(eigen.href).toBe("/termine");
    expect(eigen.aktion).toBe("Termin öffnen");
  });
});

describe("Dashboard und /termine benutzen dieselbe Regel", () => {
  it("beide Seiten rufen fristZiel für jede abgeleitete Quelle", () => {
    const dash = lies("app/(app)/page.tsx");
    for (const q of ["mieter", "kredit", "objekt", "steuer"]) expect(dash).toMatch(new RegExp(`fristZiel\\("${q}"`));
    const term = lies("app/(app)/termine/page.tsx");
    for (const q of ["mieter", "kredit", "objekt", "steuer", "vertreter"]) expect(term).toMatch(new RegExp(`fristZiel\\("${q}"`));
  });
  it("/termine verlinkt das Ziel und kennt den Vollmacht-Ablauf", () => {
    const term = lies("app/(app)/termine/page.tsx");
    expect(term).toMatch(/e\.ziel\s*\?/);
    expect(term).toMatch(/from\("vertreter"\)/);
    expect(term).toMatch(/status === "widerrufen"\) continue/);
  });
});

describe("Objekt-Check führt dorthin, wo die Lücke geschlossen wird", () => {
  const p = { id: "p1", typ: "Wohnung", obj_status: "Vermietet" };
  const c = objektCheck(p, [], [], HEUTE);
  it("Gebäudeanteil → AfA-Assistent mit vorgewähltem Objekt", () => {
    expect(c.punkte.find((x) => x.schluessel === "gebaeudeanteil")?.href).toBe("/afa-assistent?objekt=p1");
  });
  it("Mieter anlegen → Objekt vorgewählt, zurück zum Objekt", () => {
    expect(c.punkte.find((x) => x.schluessel === "mieter")?.href).toBe("/tenants/new?prop=p1&back=/properties/p1");
  });
});

describe("Formulare übernehmen, was schon bekannt ist", () => {
  it("AfA-Assistent nimmt ?objekt= an und belegt die Felder vor", () => {
    expect(lies("app/(app)/afa-assistent/page.tsx")).toMatch(/startObjekt=/);
    const k = lies("components/kalkulator/AfaAssistent.tsx");
    expect(k).toMatch(/objekte\.find\(\(x\) => x\.id === startObjekt\)/);
    expect(k).toMatch(/useState\(o0\?\.id \?\? ""\)/);
    expect(k).toMatch(/useState\(o0\?\.kaufpreis != null/);
  });
  it("Neuer Mieter: Fläche/Miete nur bei EINER Wohneinheit aus dem Objekt", () => {
    const s = lies("app/(app)/tenants/new/page.tsx");
    expect(s).toMatch(/o && !zeigeVerteiler\(/);
    expect(s).toMatch(/vorbelegung=\{vorbelegung\}/);
    const f = lies("components/TenantForm.tsx");
    // Beim Bearbeiten gewinnt immer der gespeicherte Mieterwert.
    expect(f).toMatch(/defaultValue=\{tenant \? v\("flaeche"\) : \(vorbelegung\?\.flaeche/);
    expect(f).toMatch(/defaultValue=\{tenant \? v\("kaltmiete"\) : \(vorbelegung\?\.kaltmiete/);
  });
});

describe("Mahnung per Mail hinterlässt eine Archiv-Kopie", () => {
  const s = lies("components/BriefVersand.tsx");
  const mail = s.slice(s.indexOf("briefMailLink("));
  it("speichert den Brief vor dem Öffnen der Mail — einmal je Briefstand", () => {
    expect(mail).toMatch(/if \(archiviertFuer !== schluessel\)/);
    expect(mail).toMatch(/speichereBrief\(mieterId, felder\)/);
    expect(mail).toMatch(/setArchiviertFuer\(schluessel\)/);
  });
  it("ein Archivfehler hält die Mail nicht auf (nur ein Hinweis)", () => {
    expect(mail).toMatch(/Mail geht trotzdem/);
    expect(mail.slice(0, mail.indexOf("Mail geht trotzdem"))).not.toMatch(/return;/);
  });
});

describe("Tour und Anlegen", () => {
  it("die Tour hat eine Darlehen-Station, fortlaufend nummeriert", () => {
    const t = lies("components/OnboardingTour.tsx");
    expect(t).toMatch(/href: "\/kredite\/new"/);
    const nummern = [...t.matchAll(/titel: "(\d) · /g)].map((m) => Number(m[1]));
    expect(nummern).toEqual(nummern.map((_, i) => nummern[0] + i));
  });
  it("die Start-Checkliste des leeren Kontos hat einen Darlehen-Schritt", () => {
    const d = lies("app/(app)/page.tsx");
    expect(d).toMatch(/href: "\/kredite\/new", cta: "Darlehen eintragen", erledigt: kredite\.length > 0/);
  });
  it("„Neues Objekt“ verlinkt den Exposé-Import", () => {
    expect(lies("app/(app)/properties/new/page.tsx")).toMatch(/href="\/properties\/import"/);
  });
  it("Beleihungsauslauf-Feld sagt, dass es der Wert der Bank ist", () => {
    expect(lies("app/(app)/kredite/new/page.tsx")).toMatch(/Beleihungsauslauf laut Bank/);
    expect(lies("app/(app)/kredite/[id]/edit/page.tsx")).toMatch(/Beleihungsauslauf laut Bank/);
  });
});
