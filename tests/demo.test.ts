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
    // Die Kaufgründe — frei seit 30.09.2026 (Phase 2 nach dem externen Review).
    "/mietkonto",
    "/verbrauch",
    "/kredite",
    "/steuer",
    "/jahresbericht",
    "/termine",
    "/karte",
    "/bewertung",
    "/afa-assistent",
    "/tenants/abc/nk",
    "/tenants/abc/nk/pdf",
    "/tenants/abc/protokoll",
    // Seit Phase 3 mit Beispieldaten.
    "/anliegen",
    "/archiv",
  ])("erlaubt %s", (pfad) => {
    expect(demoDarfRoute(pfad)).toBe(true);
  });

  it("erlaubt das Mieterhoehungs-Dokument samt PDF — die eine Ausnahme", () => {
    expect(demoDarfRoute("/tenants/abc/dokument")).toBe(true);
    expect(demoDarfRoute("/tenants/abc/dokument/pdf")).toBe(true);
  });
});

describe("demoDarfRoute — was gesperrt ist", () => {
  it.each([
    "/tenants/abc/edit",
    "/tenants/new",
    "/properties/abc/edit",
    "/properties/new",
  ])("sperrt %s", (pfad) => {
    expect(demoDarfRoute(pfad)).toBe(false);
  });

  // Nur noch Bereiche OHNE Beispieldaten.
  it.each(["/makler"])(
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
    expect(demoDarfRoute("/api/encrypt-bankdaten")).toBe(false);
    expect(demoDarfRoute("/api/cron/wert-refresh")).toBe(false);
  });

  it("gibt die LESENDEN Export-Routen der freien Bereiche frei", () => {
    for (const p of [
      "/api/berichte/anlage-v",
      "/api/berichte/jahresbericht",
      "/api/export/datev",
      "/api/export/buchungen",
      "/api/kauf/kreditantrag",
    ]) expect(demoDarfRoute(p), p).toBe(true);
    // Präfix-Grenze: kein Unterpfad-Trick an „alles" vorbei.
    expect(demoDarfRoute("/api/export/buchungenX")).toBe(false);
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
  it("Datenbank: Schreibversuche scheitern LAUT (Trigger), nicht still", () => {
    const sql = readFileSync("supabase/migrations/20260930150643_demo_schreibsperre_laut.sql", "utf8");
    // Anweisungs-Ebene: Ein Zeilen-Trigger feuerte nie, weil die restriktive
    // Policy für das Demo-Konto keine Zeile durchlässt.
    expect(sql).toContain("for each statement");
    expect(sql).not.toContain("for each row");
    expect(sql).toMatch(/before insert or update or delete/);
    // Ohne SECURITY DEFINER scheitert die Service-Role an ist_demo_nutzer().
    expect(sql).toMatch(/demo_schreibsperre\(\)\s*returns trigger\s*language plpgsql\s*security definer/);
    expect(sql).toContain("raise exception");
  });

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
    const mw = readFileSync("proxy.ts", "utf8");
    const block = mw.slice(mw.indexOf("istDemoKonto(user.email)"));
    expect(block).toContain('request.method !== "GET"');
    expect(block).toContain("status: 403");
    // `/api/` darf fuer die Demo-Pruefung nicht als oeffentlich durchgehen.
    expect(mw).toContain("const oeffentlichFuerDemo = istOeffentlicheSeite(pathname);");
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
