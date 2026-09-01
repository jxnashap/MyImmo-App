import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { demoDarfRoute, istDemoKonto, DEMO_EMAIL } from "@/lib/demo";

// Die Demo teilt sich EIN Konto. Was ein Besucher kaputtmacht, sieht der
// naechste — und was er aufruft, zahlt der Betreiber. Diese Tests halten die
// Auswahl fest, weil ein zu weit gefasster Praefix hier still Geld kostet.

describe("istDemoKonto", () => {
  it("erkennt nur die exakte Adresse", () => {
    expect(istDemoKonto(DEMO_EMAIL)).toBe(true);
    expect(istDemoKonto("demo.vermieter@myimmo.test.angreifer.de")).toBe(false);
    expect(istDemoKonto("DEMO.VERMIETER@myimmo.test")).toBe(false);
    expect(istDemoKonto(null)).toBe(false);
    expect(istDemoKonto(undefined)).toBe(false);
    expect(istDemoKonto("")).toBe(false);
  });
});

describe("demoDarfRoute — was sichtbar bleibt", () => {
  it.each([
    "/",
    "/properties",
    "/properties/abc",
    "/tenants",
    "/tenants/abc",
    "/cashflow",
    "/kauf",
    "/verkauf",
    "/einstellungen",
    "/hilfe",
  ])("erlaubt %s", (pfad) => {
    expect(demoDarfRoute(pfad)).toBe(true);
  });

  it("erlaubt das Mieterhoehungs-Dokument samt PDF — die eine Ausnahme", () => {
    expect(demoDarfRoute("/tenants/abc/dokument")).toBe(true);
    expect(demoDarfRoute("/tenants/abc/dokument/pdf")).toBe(true);
  });
});

describe("demoDarfRoute — was gesperrt ist", () => {
  it("sperrt den NK-Rechner, obwohl /tenants erlaubt ist", () => {
    // Der Fall, der die Ausnahmeliste ueberhaupt noetig macht: ohne sie waere
    // der Rechner ueber den erlaubten /tenants-Praefix mitfreigegeben.
    expect(demoDarfRoute("/tenants/abc/nk")).toBe(false);
    expect(demoDarfRoute("/tenants/abc/nk/pdf")).toBe(false);
  });

  it.each([
    "/tenants/abc/protokoll",
    "/tenants/abc/edit",
    "/tenants/new",
    "/properties/abc/edit",
    "/properties/new",
  ])("sperrt %s", (pfad) => {
    expect(demoDarfRoute(pfad)).toBe(false);
  });

  it.each(["/steuer", "/archiv", "/mietkonto", "/termine", "/bewertung", "/afa-assistent", "/anliegen"])(
    "sperrt den Bereich %s",
    (pfad) => {
      expect(demoDarfRoute(pfad)).toBe(false);
    },
  );

  // Der teuerste Fehler waere hier: `/api/` stand frueher pauschal auf der
  // Immer-erlaubt-Liste. `/api/nk-ocr` und `/api/import-url` rufen Anthropic
  // auf und kosten pro Aufruf Geld.
  it("gibt NICHT pauschal alle API-Routen frei", () => {
    expect(demoDarfRoute("/api/demo")).toBe(true);
    expect(demoDarfRoute("/api/nk-ocr")).toBe(false);
    expect(demoDarfRoute("/api/import-url")).toBe(false);
    expect(demoDarfRoute("/api/import")).toBe(false);
    expect(demoDarfRoute("/api/export/alles")).toBe(false);
    expect(demoDarfRoute("/api/kauf/kreditantrag")).toBe(false);
    expect(demoDarfRoute("/api/encrypt-bankdaten")).toBe(false);
  });

  it("laesst sich nicht mit einem aehnlich beginnenden Pfad austricksen", () => {
    expect(demoDarfRoute("/api/demoX")).toBe(false);
    expect(demoDarfRoute("/tenantsfremd")).toBe(false);
    expect(demoDarfRoute("/kauffremd")).toBe(false);
  });
});

describe("Die drei Sperr-Ebenen sind alle vorhanden", () => {
  // Jede allein waere lueckenhaft: die Datenbank blockiert UPDATE/DELETE STUMM
  // (kein Fehler, null Zeilen), die Oberflaeche allein waere reine Optik, und
  // die Routensperre schuetzt keine Server-Action auf einer erlaubten Seite.
  it("Datenbank: restriktive RLS-Policies gegen Schreiben", () => {
    const sql = readFileSync("supabase/migrations/20260830150000_demo_nur_lesen.sql", "utf8");
    expect(sql).toContain("as restrictive for insert");
    expect(sql).toContain("as restrictive for update");
    expect(sql).toContain("as restrictive for delete");
    // SELECT darf NICHT eingeschraenkt werden — sonst ist die Demo blind.
    expect(sql).not.toMatch(/restrictive for select/);
    expect(sql).not.toMatch(/restrictive for all/);
  });

  it("Middleware: die Sperre gilt fuer jede Methode, nicht nur GET", () => {
    const mw = readFileSync("middleware.ts", "utf8");
    const block = mw.slice(mw.indexOf("istDemoKonto(user.email)"));
    expect(block).toContain('request.method !== "GET"');
    expect(block).toContain("status: 403");
    // `/api/` darf fuer die Demo-Pruefung nicht als oeffentlich durchgehen.
    expect(mw).toContain('istOeffentlich && !pathname.startsWith("/api/")');
  });

  it("Oberflaeche: nur absendende Knoepfe werden gesperrt", () => {
    const komp = readFileSync("components/DemoNurLesen.tsx", "utf8");
    expect(komp).toContain("button[type=submit]");
    // Alle Knoepfe zu sperren wuerde Tabs und Navigation mit lahmlegen.
    expect(komp).not.toMatch(/querySelectorAll<HTMLButtonElement>\(\s*"button"/);
    expect(komp).toContain("data-demo-erlaubt");
  });

  it("Der Brief-Generator traegt die Ausnahme", () => {
    expect(readFileSync("components/DocGenerator.tsx", "utf8")).toContain("data-demo-erlaubt");
  });
});
