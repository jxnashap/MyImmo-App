import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockeNextUndSupabase } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";
import { objektZuordnung, nameNorm } from "@/lib/importCsv";

// B15 (Prüfstand 11.10.2026): Mieter-Import ordnet nur EINDEUTIGE Objektnamen zu, ein mehrdeutiger
// Name stoppt den Import, und ein wiederholter Import legt nichts doppelt an.

const U = "nutzer-1";
beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

async function lade(tabellen: Record<string, Record<string, unknown>[]>) {
  vi.resetModules();
  const db = speicherDb({ tabellen: { properties: [], mieter: [], ...tabellen } });
  mockeNextUndSupabase(db.client);
  return { db, mod: await import("@/lib/actions/importDaten") };
}

describe("objektZuordnung (EINE Regel für Vorschau und Server)", () => {
  const objekte = [{ id: "a", bezeichnung: "Haus  Am Markt" }, { id: "b", bezeichnung: "ETW" }, { id: "c", bezeichnung: "etw " }];
  it("eindeutig über Groß-/Kleinschreibung und Leerraum hinweg", () => {
    expect(objektZuordnung(objekte, " haus am markt")).toEqual({ art: "eindeutig", id: "a" });
    expect(nameNorm("  A   b ")).toBe("a b");
  });
  it("zwei Objekte gleichen Namens → mehrdeutig, NIE ein Treffer", () => {
    expect(objektZuordnung(objekte, "ETW")).toEqual({ art: "mehrdeutig", anzahl: 2 });
  });
  it("leer oder unbekannt → fehlt", () => {
    expect(objektZuordnung(objekte, "")).toEqual({ art: "fehlt" });
    expect(objektZuordnung(objekte, "Garage")).toEqual({ art: "fehlt" });
  });
});

describe("Mieter-Import", () => {
  const props = [
    { id: "p1", user_id: U, bezeichnung: "Haus Am Markt" },
    { id: "p2", user_id: U, bezeichnung: "ETW" },
    { id: "p3", user_id: U, bezeichnung: "etw" },
    { id: "fremd", user_id: "anderer", bezeichnung: "Villa" },
  ];

  it("ein mehrdeutiger Objektname stoppt den GANZEN Import — kein Mieter am falschen Haus", async () => {
    const { db, mod } = await lade({ properties: props });
    const r = await mod.importiereDaten("mieter", [{ nachname: "Meier", objekt: "Haus am Markt" }, { nachname: "Schulz", objekt: "ETW" }]);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/„ETW“ passt auf mehrere Objekte.*nichts importiert/);
    expect(db.tabellen.mieter).toHaveLength(0);
  });

  it("eindeutige Namen werden zugeordnet; ein FREMDES Objekt gleichen Namens zählt nicht", async () => {
    const { db, mod } = await lade({ properties: props });
    const r = await mod.importiereDaten("mieter", [{ nachname: "Meier", objekt: "haus am markt" }, { nachname: "Vogel", objekt: "Villa" }]);
    expect(r).toEqual({ ok: true, angelegt: 2, ohneObjekt: 1 });
    expect(db.tabellen.mieter.map((m) => [m.nachname, m.prop_id])).toEqual([["Meier", "p1"], ["Vogel", null]]);
  });

  it("dieselbe Datei zweimal: beim zweiten Mal nichts doppelt", async () => {
    const { db, mod } = await lade({ properties: props });
    const datei = [{ vorname: "Eva", nachname: "Meier", objekt: "Haus am Markt", mietbeginn: "2024-01-01" }];
    await mod.importiereDaten("mieter", datei);
    expect(await mod.importiereDaten("mieter", datei)).toEqual({ ok: true, angelegt: 0, ohneObjekt: 0, uebersprungen: 1 });
    expect(db.tabellen.mieter).toHaveLength(1);
  });

  it("doppelte Zeilen IN der Datei werden einmal angelegt; gleicher Name mit anderem Mietbeginn ist ein anderer Mieter", async () => {
    const { db, mod } = await lade({ properties: props });
    const z = { vorname: "Eva", nachname: "Meier", objekt: "Haus am Markt", mietbeginn: "2024-01-01" };
    const r = await mod.importiereDaten("mieter", [z, { ...z }, { ...z, mietbeginn: "2025-03-01" }]);
    expect(r).toEqual({ ok: true, angelegt: 2, ohneObjekt: 0, uebersprungen: 1 });
    expect(db.tabellen.mieter).toHaveLength(2);
  });

  it("scheitert die Bestandsprüfung, wird nichts importiert", async () => {
    vi.resetModules();
    const db = speicherDb({ tabellen: { properties: props, mieter: [] }, fehlerBei: { "mieter:select": "reset" } });
    mockeNextUndSupabase(db.client);
    const mod = await import("@/lib/actions/importDaten");
    expect((await mod.importiereDaten("mieter", [{ nachname: "Meier", objekt: "Haus am Markt" }])).ok).toBe(false);
    expect(db.tabellen.mieter).toHaveLength(0);
  });
});

describe("Objekt-Import", () => {
  it("ein schon vorhandenes Objekt (gleicher Name) wird nicht noch einmal angelegt", async () => {
    const { db, mod } = await lade({ properties: [{ id: "p1", user_id: U, bezeichnung: "Haus Am Markt" }] });
    const r = await mod.importiereDaten("objekte", [{ bezeichnung: "haus am markt" }, { bezeichnung: "Neu" }, { bezeichnung: "neu " }]);
    expect(r).toEqual({ ok: true, angelegt: 1, ohneObjekt: 0, uebersprungen: 2 });
    expect(db.tabellen.properties.map((p) => p.bezeichnung)).toEqual(["Haus Am Markt", "Neu"]);
  });

  it("alles schon da: Erfolg mit 0 angelegt — kein Fehler", async () => {
    const { mod } = await lade({ properties: [{ id: "p1", user_id: U, bezeichnung: "A" }] });
    expect(await mod.importiereDaten("objekte", [{ bezeichnung: "A" }])).toEqual({ ok: true, angelegt: 0, ohneObjekt: 0, uebersprungen: 1 });
  });
});
