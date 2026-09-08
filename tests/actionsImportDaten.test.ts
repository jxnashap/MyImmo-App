import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// lib/actions/importDaten.ts — der Batch-Import aus dem Import-Assistenten.
//
// Die Frage, mit der ich hineingegangen bin: Was passiert, wenn das dritte von
// fünf Objekten scheitert — bleiben zwei stehen, und der Import meldet Erfolg?
// ANTWORT: Nein. Alle Zeilen gehen in EINEM `insert(rows)`, und Postgres führt
// eine Anweisung ganz oder gar nicht aus. Die vermutete fünfte Fehlerklasse
// („Teilerfolg als Erfolg gemeldet") gibt es hier nicht. Der Test dazu hält
// fest, dass es EIN Aufruf bleibt — wer ihn in eine Schleife umbaut, wird rot.
//
// FUND (08.09.2026): Die Objektliste für die Mieter-Zuordnung wurde ohne
// Fehlerauswertung gelesen. Käme sie wegen eines Fehlers leer zurück, würden
// ALLE Mieter ohne Objekt angelegt — und „n ohne Objekt" sähe aus wie ein
// Namensproblem der Eingabe. Fail-open, siebte Fundstelle dieser Klasse.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/importDaten");
  return { db, mod };
}

const inserts = (db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }, tabelle: string) =>
  db.zugriffe.filter((z) => z.tabelle === tabelle && z.op === "insert");

describe("Grenzen", () => {
  it("ohne Zeilen oder mit mehr als 500 wird nichts importiert", async () => {
    const { db, mod } = await lade();
    expect((await mod.importiereDaten("objekte", [])).ok).toBe(false);
    expect((await mod.importiereDaten("objekte", null as never)).ok).toBe(false);
    const zuViele = Array.from({ length: 501 }, (_, i) => ({ bezeichnung: `Obj ${i}` }));
    const r = await mod.importiereDaten("objekte", zuViele);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/max\. 500/);
    expect(db.zugriffe).toEqual([]);
  });

  it("Texte werden auf 300 Zeichen gekappt, Zahlen nur als Zahlen genommen", async () => {
    const { db, mod } = await lade();
    await mod.importiereDaten("objekte", [
      { bezeichnung: "x".repeat(400), kaufpreis: "250000" as never, wert: 300000, baujahr: Number.NaN },
    ]);
    const rows = inserts(db, "properties")[0].daten as unknown as Record<string, unknown>[];
    expect(String(rows[0].bezeichnung)).toHaveLength(300);
    // Ein String ist keine Zahl — lieber null als eine geratene Lesart.
    expect(rows[0].kaufpreis).toBeNull();
    expect(rows[0].wert).toBe(300000);
    expect(rows[0].baujahr).toBeNull();
  });

  it("Datumsfelder müssen ISO sein, sonst null", async () => {
    const { db, mod } = await lade();
    await mod.importiereDaten("objekte", [{ bezeichnung: "A", kaufdatum: "01.03.2020" }, { bezeichnung: "B", kaufdatum: "2020-03-01" }]);
    const rows = inserts(db, "properties")[0].daten as unknown as Record<string, unknown>[];
    expect(rows[0].kaufdatum).toBeNull();
    expect(rows[1].kaufdatum).toBe("2020-03-01");
  });
});

describe("Objekte importieren", () => {
  it("Zeilen ohne Bezeichnung fallen weg — bleibt nichts, gibt es eine Meldung", async () => {
    const { db, mod } = await lade();
    const r = await mod.importiereDaten("objekte", [{ bezeichnung: "  " }, { adresse: "Weg 1" }]);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/Bezeichnung/);
    expect(db.zugriffe).toEqual([]);
  });

  it("alle Zeilen gehen in EINEM Insert — ganz oder gar nicht", async () => {
    const { db, mod } = await lade();
    const r = await mod.importiereDaten("objekte", [{ bezeichnung: "A" }, { bezeichnung: "B" }, { bezeichnung: "C" }]);
    expect(r).toEqual({ ok: true, angelegt: 3, ohneObjekt: 0 });
    const ins = inserts(db, "properties");
    expect(ins).toHaveLength(1);
    expect(ins[0].daten as unknown as unknown[]).toHaveLength(3);
    for (const row of ins[0].daten as unknown as Record<string, unknown>[]) expect(row.user_id).toBe("nutzer-1");
  });

  it("Freitext-Typen werden auf die Objekttypen abgebildet", async () => {
    const { db, mod } = await lade();
    await mod.importiereDaten("objekte", [
      { bezeichnung: "1", typ: "ETW" }, { bezeichnung: "2", typ: "Reihenhaus" }, { bezeichnung: "3", typ: "MFH" },
      { bezeichnung: "4", typ: "Büro" }, { bezeichnung: "5", typ: "Stellplatz" }, { bezeichnung: "6", typ: "Grundstück" },
      { bezeichnung: "7", typ: "keine Ahnung" }, { bezeichnung: "8", typ: "Garagenkomplex" },
    ]);
    const typen = (inserts(db, "properties")[0].daten as unknown as { typ: string }[]).map((r) => r.typ);
    expect(typen).toEqual([
      "Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie",
      "Garage / Stellplatz", "Grundstück", "Eigentumswohnung", "Garagenkomplex",
    ]);
  });

  it("ein Datenbankfehler wird gemeldet — ohne Interna", async () => {
    const { mod } = await lade({ fehler: { message: 'duplicate key value violates unique constraint "properties_pkey"' } });
    const r = await mod.importiereDaten("objekte", [{ bezeichnung: "A" }]);
    expect(r).toEqual({ ok: false, angelegt: 0, ohneObjekt: 0, fehler: "Import fehlgeschlagen." });
  });
});

describe("Mieter importieren", () => {
  const objekte = [{ id: "p-1", bezeichnung: "Haus Am Markt" }, { id: "p-2", bezeichnung: " ETW Nord " }];

  it("die Objekt-Zuordnung läuft über den Namen, ohne Ansehen von Groß-/Kleinschreibung und Leerraum", async () => {
    const { db, mod } = await lade({ antworten: { properties: objekte } });
    const r = await mod.importiereDaten("mieter", [
      { nachname: "Meier", objekt: "haus am markt" },
      { nachname: "Schulz", objekt: "ETW NORD" },
      { nachname: "Krause", objekt: "gibt es nicht" },
      { nachname: "Ohne" },
    ]);
    expect(r).toEqual({ ok: true, angelegt: 4, ohneObjekt: 2 });
    const rows = inserts(db, "mieter")[0].daten as unknown as { prop_id: string | null }[];
    expect(rows.map((x) => x.prop_id)).toEqual(["p-1", "p-2", null, null]);
  });

  it("die Objektliste wird nur aus dem eigenen Konto gelesen", async () => {
    const { db, mod } = await lade({ antworten: { properties: objekte } });
    await mod.importiereDaten("mieter", [{ nachname: "Meier" }]);
    const lese = db.zugriffe.find((z) => z.tabelle === "properties" && z.op === "select")!;
    expect(lese.filter).toContain("eq:user_id=nutzer-1");
  });

  it("scheitert das Laden der Objekte, wird NICHTS importiert", async () => {
    // DER FUND: Vorher galt eine fehlgeschlagene Abfrage als „keine Objekte",
    // und alle Mieter landeten ohne Zuordnung in der Datenbank.
    const { db, mod } = await lade({ fehlerBei: { "properties:select": { message: "connection reset" } } });
    const r = await mod.importiereDaten("mieter", [{ nachname: "Meier", objekt: "Haus Am Markt" }]);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/nichts importiert/);
    expect(inserts(db, "mieter")).toEqual([]);
  });

  it("Zeilen ohne Nachname fallen weg", async () => {
    const { db, mod } = await lade({ antworten: { properties: [] } });
    const r = await mod.importiereDaten("mieter", [{ vorname: "Anna" }]);
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/Nachname/);
    expect(inserts(db, "mieter")).toEqual([]);
  });

  it("die Zahlenfelder eines Mieters werden übernommen, Unsinn wird null", async () => {
    const { db, mod } = await lade({ antworten: { properties: [] } });
    await mod.importiereDaten("mieter", [{ nachname: "M", kaltmiete: 850, kaution: "2550" as never, mietbeginn: "2024-01-01", mietende: "bald" }]);
    const row = (inserts(db, "mieter")[0].daten as unknown as Record<string, unknown>[])[0];
    expect(row).toMatchObject({ kaltmiete: 850, kaution: null, mietbeginn: "2024-01-01", mietende: null, user_id: "nutzer-1" });
  });
});
