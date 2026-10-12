import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";

// B14 (Prüfstand 11.10.2026): Die Einheitengrenze des Tarifs gilt auf JEDEM Schreibweg — Anlegen,
// Bearbeiten, CSV-Import — und an der Datenbank (Trigger, supabase/test/rls/b14_einheiten.sql).
// Vorher prüfte nur „Objekt anlegen“; ein Lesefehler beim Zählen ergab 0 belegte Einheiten → durch.

const U = "nutzer-1";
beforeEach(() => { vi.resetModules(); vi.stubEnv("BILLING_ENFORCED", "true"); });
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  vi.unstubAllEnvs();
});

async function lade(pfad: string, init: Parameters<typeof speicherDb>[0] = {}) {
  vi.resetModules();
  const db = speicherDb({
    ...init,
    tabellen: {
      abos: [{ user_id: U, plan: "privat", status: "aktiv" }], // 5 Einheiten
      properties: [
        { id: "p1", user_id: U, bezeichnung: "Haus", einheiten_anzahl: 2, adresse: null },
        { id: "p2", user_id: U, bezeichnung: "Wohnung", einheiten_anzahl: 2, adresse: null },
      ],
      wiederkehrende_buchungen: [], mieter: [], kalkulationen: [],
      ...init?.tabellen,
    },
  });
  mockeNextUndSupabase(db.client);
  return { db, mod: await import(pfad) };
}
const einheiten = (db: { tabellen: Record<string, Record<string, unknown>[]> }, id: string) => db.tabellen.properties.find((p) => p.id === id)?.einheiten_anzahl;

describe("pruefeEinheiten", () => {
  it("Bearbeiten: belegt − bisher + neu; weniger geht immer, auch über dem Limit", async () => {
    const { pruefeEinheiten } = await import("@/lib/planGate");
    const db = speicherDb({ tabellen: { abos: [{ user_id: U, plan: "privat", status: "aktiv" }], properties: [{ id: "p1", einheiten_anzahl: 4 }, { id: "p2", einheiten_anzahl: 4 }] } });
    expect((await pruefeEinheiten(db.client as never, 2, { statt: 4 })).erlaubt).toBe(true); // weniger
    expect((await pruefeEinheiten(db.client as never, 5, { statt: 4 })).erlaubt).toBe(false); // 8 − 4 + 5 = 9 > 5
  });

  it("ein Lesefehler beim Zählen sperrt (vorher: 0 belegt → durch)", async () => {
    const { pruefeEinheiten } = await import("@/lib/planGate");
    const db = speicherDb({ tabellen: { abos: [{ user_id: U, plan: "privat", status: "aktiv" }], properties: [] }, fehlerBei: { "properties:select": "reset" } });
    const r = await pruefeEinheiten(db.client as never, 1);
    expect(r.erlaubt).toBe(false);
    expect(r.meldung).toMatch(/nicht geprüft/);
  });

  it("ohne BILLING_ENFORCED: frei und ohne Abfrage (Early Access)", async () => {
    vi.stubEnv("BILLING_ENFORCED", "");
    const { pruefeEinheiten } = await import("@/lib/planGate");
    const db = speicherDb({ fehlerBei: { properties: "x", abos: "x" } });
    expect((await pruefeEinheiten(db.client as never, 99)).erlaubt).toBe(true);
    expect(db.protokoll).toEqual([]);
  });
});

describe("Objekt bearbeiten (B14)", () => {
  it("mehr Einheiten über dem Tarif → Hinweis, NICHTS gespeichert", async () => {
    const { db, mod } = await lade("@/lib/actions/properties");
    const ziel = await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "Haus", einheiten_anzahl: "4" })));
    expect(decodeURIComponent(ziel)).toMatch(/umfasst 5 Einheiten; belegt sind 4/);
    expect(einheiten(db, "p1")).toBe(2);
  });

  it("bis zum Limit geht es; weniger geht immer", async () => {
    const { db, mod } = await lade("@/lib/actions/properties");
    expect(decodeURIComponent(await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "Haus", einheiten_anzahl: "3" }))))).toMatch(/gespeichert/);
    expect(einheiten(db, "p1")).toBe(3);
    await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "Haus", einheiten_anzahl: "1" })));
    expect(einheiten(db, "p1")).toBe(1);
  });

  it("lehnt die DATENBANK ab (gleichzeitige Anlage, REST), steht ihre Meldung da", async () => {
    const { mod } = await lade("@/lib/actions/properties", { fehlerBei: { "properties:update": "Der Tarif umfasst 5 Einheit(en); belegt sind 5." }, fehlerHint: { "properties:update": "einheiten_grenze" } });
    const ziel = decodeURIComponent(await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "Haus", einheiten_anzahl: "2" }))));
    expect(ziel).toMatch(/Der Tarif umfasst 5 Einheit\(en\).*Einstellungen → Abo/);
  });

  it("ein fremdes oder unbekanntes Objekt wird nicht bearbeitet", async () => {
    const { db, mod } = await lade("@/lib/actions/properties", { tabellen: { properties: [{ id: "p1", user_id: "anderer", einheiten_anzahl: 1 }] } });
    const ziel = decodeURIComponent(await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "X", einheiten_anzahl: "1" }))));
    expect(ziel).toMatch(/nicht gefunden/);
    expect(db.tabellen.properties[0].bezeichnung).toBeUndefined();
  });
});

describe("Objekt anlegen und CSV-Import (B14)", () => {
  it("Anlegen über dem Limit → Hinweis, nichts angelegt", async () => {
    const { db, mod } = await lade("@/lib/actions/properties");
    await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "Neu", einheiten_anzahl: "2" })));
    expect(db.tabellen.properties).toHaveLength(2);
  });

  it("CSV-Import: zwei Objekte bei einer freien Einheit → nichts importiert", async () => {
    const { db, mod } = await lade("@/lib/actions/importDaten");
    const r = await mod.importiereDaten("objekte", [{ bezeichnung: "A" }, { bezeichnung: "B" }]);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/umfasst 5 Einheiten/);
    expect(db.tabellen.properties).toHaveLength(2);
    const eins = await mod.importiereDaten("objekte", [{ bezeichnung: "A" }]);
    expect(eins.ok).toBe(true);
    expect(db.tabellen.properties).toHaveLength(3);
  });

  it("CSV-Import: Ablehnung der Datenbank → „nichts importiert“", async () => {
    const { mod } = await lade("@/lib/actions/importDaten", { fehlerBei: { "properties:insert": "Der Tarif umfasst 5 Einheit(en); belegt sind 5." }, fehlerHint: { "properties:insert": "einheiten_grenze" } });
    expect((await mod.importiereDaten("objekte", [{ bezeichnung: "A" }])).fehler).toMatch(/Es wurde nichts importiert/);
  });
});

describe("Gleiche Grenzen in App und Datenbank", () => {
  it("die Migration nennt dieselben Limits wie lib/plan.ts", async () => {
    const { EINHEITEN_LIMIT } = await import("@/lib/plan");
    const sql = readFileSync("supabase/migrations/20261011121000_b14_einheiten_grenze.sql", "utf8");
    for (const [plan, limit] of Object.entries(EINHEITEN_LIMIT)) {
      if (Number.isFinite(limit)) expect(sql, plan).toMatch(new RegExp(`when a\\.plan = '${plan}' then ${limit}\\b`));
    }
    expect(sql).toMatch(/a\.status not in \('aktiv', 'testphase', 'ueberfaellig'\)/);
  });
});
