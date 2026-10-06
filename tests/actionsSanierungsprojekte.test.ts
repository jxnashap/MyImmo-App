import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { leererEntwurf } from "@/lib/sanierung/eingabe";
import { MITGELIEFERTE_VORLAGEN } from "@/lib/sanierung/projekte";

// lib/actions/sanierungsprojekte.ts — Projekte und Vorlagen des Sanierungs-Guides (Stufe C).
//
// Worum es geht: (1) Was gespeichert wird, ist geprüft — ein Aufruf am Formular vorbei speichert
// nichts Fremdes. (2) Jeder Zugriff hängt am eigenen Konto. (3) Zwei Geräte überschreiben sich nicht
// still (Stand-Vergleich über updated_at). (4) Fehler kommen als Rückgabe und sagen, was los ist —
// auch „Tabelle fehlt noch“ (SQL nicht ausgeführt) und „Grenze erreicht“.

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const STAND = "2026-10-06T08:00:00.123456+00:00";
const NEU = "2026-10-06T09:30:00.654321+00:00";

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/demo", "@/lib/sanierung/projekte"]) vi.doUnmock(m);
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}, opt: { demo?: boolean; groesse?: number } = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  // Mehrere lade() in EINEM Test: Attrappen vom vorigen Aufruf zuerst entfernen.
  vi.doUnmock("@/lib/demo");
  vi.doUnmock("@/lib/sanierung/projekte");
  if (opt.demo) vi.doMock("@/lib/demo", () => ({ istDemoKonto: () => true }));
  if (opt.groesse != null) {
    const echt = await vi.importActual<typeof import("@/lib/sanierung/projekte")>("@/lib/sanierung/projekte");
    vi.doMock("@/lib/sanierung/projekte", () => ({ ...echt, datenGroesse: () => opt.groesse }));
  }
  const mod = await import("@/lib/actions/sanierungsprojekte");
  return { db, mod };
}

const zugriffe = (db: { zugriffe: { tabelle: string; op: string; filter: string[] }[] }, op?: string) =>
  db.zugriffe.filter((z) => z.tabelle === "sanierungsprojekte" && (!op || z.op === op));

const entwurf = () => ({ ...leererEntwurf("x"), projekt: { ...leererEntwurf("x").projekt, name: "Altbau" } });

describe("Speichern — neu", () => {
  it("legt ein Projekt am eigenen Konto an und liefert Kennung und Stand", async () => {
    const { db, mod } = await lade({ antworten: { sanierungsprojekte: { id: ID, updated_at: STAND } } });
    const erg = await mod.speichereSanierungsprojekt({ art: "projekt", name: "  Altbau  ", daten: entwurf() });
    expect(erg).toEqual({ ok: true, id: ID, stand: STAND });
    const z = zugriffe(db, "insert")[0] as { daten?: Record<string, unknown> };
    expect(z.daten).toMatchObject({ user_id: "nutzer-1", art: "projekt", name: "Altbau" });
  });

  it("speichert den GEPRÜFTEN Entwurf — fremde Felder fallen weg", async () => {
    const { db, mod } = await lade({ antworten: { sanierungsprojekte: { id: ID, updated_at: STAND } } });
    await mod.speichereSanierungsprojekt({ art: "projekt", name: "A", daten: { ...entwurf(), boese: "<script>", preise: { gold: "1" } } });
    const daten = (zugriffe(db, "insert")[0] as { daten?: { daten: Record<string, unknown> } }).daten!.daten;
    expect(daten).not.toHaveProperty("boese");
    expect(daten.preise).toEqual({});
  });

  it("eine Vorlage wird als Vorlage geprüft — ein Projekt unter „vorlage“ wird abgelehnt", async () => {
    const { db, mod } = await lade();
    const erg = await mod.speichereSanierungsprojekt({ art: "vorlage", name: "V", daten: entwurf() });
    expect(erg).toEqual({ error: "Das ist keine Vorlage." });
    expect(zugriffe(db)).toEqual([]);
    const { db: db2, mod: mod2 } = await lade({ antworten: { sanierungsprojekte: { id: ID, updated_at: STAND } } });
    expect(await mod2.speichereSanierungsprojekt({ art: "vorlage", name: "V", daten: MITGELIEFERTE_VORLAGEN[0].vorlage })).toMatchObject({ ok: true });
    expect((zugriffe(db2, "insert")[0] as { daten?: Record<string, unknown> }).daten).toMatchObject({ art: "vorlage" });
  });

  it("kein Entwurf, kein Name, unbekannte Art → Fehler, kein Zugriff", async () => {
    const { db, mod } = await lade();
    expect(await mod.speichereSanierungsprojekt({ art: "projekt", name: "A", daten: { raeume: "x" } })).toEqual({ error: "Das ist kein Sanierungsprojekt." });
    expect(await mod.speichereSanierungsprojekt({ art: "projekt", name: "   ", daten: entwurf() })).toMatchObject({ error: expect.stringContaining("Namen") });
    expect(await mod.speichereSanierungsprojekt({ art: "x" as "projekt", name: "A", daten: entwurf() })).toEqual({ error: "Unbekannte Art." });
    expect(zugriffe(db)).toEqual([]);
  });

  it("zu groß → Fehler, kein Zugriff", async () => {
    const { db, mod } = await lade({}, { groesse: 200_001 });
    expect(await mod.speichereSanierungsprojekt({ art: "projekt", name: "A", daten: entwurf() })).toMatchObject({ error: expect.stringContaining("zu groß") });
    expect(zugriffe(db)).toEqual([]);
  });

  it("Demo-Konto: nichts wird gespeichert", async () => {
    const { db, mod } = await lade({}, { demo: true });
    expect(await mod.speichereSanierungsprojekt({ art: "projekt", name: "A", daten: entwurf() })).toMatchObject({ error: expect.stringContaining("Demo") });
    expect(zugriffe(db)).toEqual([]);
  });

  it("Fehler der Datenbank werden übersetzt: Grenze, Tabelle fehlt, Demo-Sperre, sonst allgemein", async () => {
    const faelle: [string, RegExp][] = [
      ["54000", /Höchstens 200/],
      ["PGRST205", /noch nicht eingerichtet/],
      ["42P01", /noch nicht eingerichtet/],
      ["42501", /Demo/],
      ["XX000", /nicht geklappt/],
    ];
    for (const [code, text] of faelle) {
      const { mod } = await lade({ fehlerBei: { "sanierungsprojekte:insert": { message: "x", code } } });
      const erg = await mod.speichereSanierungsprojekt({ art: "projekt", name: "A", daten: entwurf() });
      expect((erg as { error: string }).error, code).toMatch(text);
    }
  });
});

describe("Speichern — überschreiben", () => {
  it("nur am eigenen Konto, nur dieselbe Art, nur gegen den bekannten Stand", async () => {
    const { db, mod } = await lade({ antworten: { sanierungsprojekte: { id: ID, updated_at: NEU } } });
    const erg = await mod.speichereSanierungsprojekt({ id: ID, art: "projekt", name: "A", daten: entwurf(), stand: STAND });
    expect(erg).toEqual({ ok: true, id: ID, stand: NEU });
    const z = zugriffe(db, "update")[0];
    expect(z.filter).toEqual(expect.arrayContaining([`eq:id=${ID}`, "eq:user_id=nutzer-1", "eq:art=projekt", `eq:updated_at=${STAND}`]));
    expect(zugriffe(db, "insert")).toEqual([]);
  });

  it("anderswo neuer gespeichert → Konflikt, nichts überschrieben", async () => {
    const { mod } = await lade({ antwortFolge: { "sanierungsprojekte:update": [null], "sanierungsprojekte:select": [{ id: ID }] } });
    const erg = await mod.speichereSanierungsprojekt({ id: ID, art: "projekt", name: "A", daten: entwurf(), stand: STAND });
    expect(erg).toMatchObject({ konflikt: true, error: expect.stringContaining("anderen Gerät") });
  });

  it("inzwischen gelöscht → eigene Meldung, kein Konflikt", async () => {
    const { mod } = await lade({ antwortFolge: { "sanierungsprojekte:update": [null], "sanierungsprojekte:select": [null] } });
    const erg = await mod.speichereSanierungsprojekt({ id: ID, art: "projekt", name: "A", daten: entwurf(), stand: STAND });
    expect(erg).toEqual({ error: "Das Projekt gibt es nicht mehr — speichere es als neues." });
  });

  it("ohne Stand kein Überschreiben — außer ausdrücklich erzwungen (dann ohne Stand-Filter)", async () => {
    const { db, mod } = await lade({ antworten: { sanierungsprojekte: { id: ID, updated_at: NEU } } });
    expect(await mod.speichereSanierungsprojekt({ id: ID, art: "projekt", name: "A", daten: entwurf() })).toMatchObject({ konflikt: true });
    expect(zugriffe(db)).toEqual([]);
    expect(await mod.speichereSanierungsprojekt({ id: ID, art: "projekt", name: "A", daten: entwurf(), stand: STAND, erzwingen: true })).toMatchObject({ ok: true });
    const z = zugriffe(db, "update")[0];
    expect(z.filter).toContain("eq:user_id=nutzer-1");
    expect(z.filter.some((f) => f.startsWith("eq:updated_at"))).toBe(false);
  });

  it("unsinnige Kennung → Fehler, kein Zugriff", async () => {
    const { db, mod } = await lade();
    expect(await mod.speichereSanierungsprojekt({ id: "1 or 1=1", art: "projekt", name: "A", daten: entwurf(), stand: STAND })).toEqual({ error: "Unbekanntes Projekt." });
    expect(zugriffe(db)).toEqual([]);
  });

  it("Fehler beim Überschreiben → Fehler, kein Erfolg", async () => {
    const { mod } = await lade({ fehlerBei: { "sanierungsprojekte:update": { message: "x", code: "XX000" } } });
    expect(await mod.speichereSanierungsprojekt({ id: ID, art: "projekt", name: "A", daten: entwurf(), stand: STAND })).toEqual({ error: "Speichern hat nicht geklappt." });
  });
});

describe("Liste laden", () => {
  it("eigene Zeilen, neueste zuerst; Unbekanntes fällt weg", async () => {
    const { db, mod } = await lade({
      antworten: {
        sanierungsprojekte: [
          { id: "a", art: "projekt", name: "P", updated_at: NEU },
          { id: "b", art: "vorlage", name: "V", updated_at: STAND },
          { id: "c", art: "fremd", name: "X", updated_at: STAND },
        ],
      },
    });
    const erg = await mod.ladeSanierungsprojekte();
    expect(erg).toEqual({
      ok: true,
      eingerichtet: true,
      liste: [
        { id: "a", art: "projekt", name: "P", aktualisiert: NEU },
        { id: "b", art: "vorlage", name: "V", aktualisiert: STAND },
      ],
    });
    expect(zugriffe(db, "select")[0].filter).toEqual(expect.arrayContaining(["eq:user_id=nutzer-1", "order:updated_at=[object Object]"]));
  });

  it("Tabelle fehlt (SQL noch nicht ausgeführt) → keine Fehlermeldung, aber „nicht eingerichtet“", async () => {
    const { mod } = await lade({ fehlerBei: { sanierungsprojekte: { message: "x", code: "PGRST205" } } });
    expect(await mod.ladeSanierungsprojekte()).toEqual({ ok: true, liste: [], eingerichtet: false });
  });

  it("anderer Fehler → Fehler (nicht still „keine Projekte“)", async () => {
    const { mod } = await lade({ fehlerBei: { sanierungsprojekte: { message: "x", code: "XX000" } } });
    expect(await mod.ladeSanierungsprojekte()).toEqual({ error: "Die gespeicherten Projekte ließen sich nicht laden." });
  });

  it("Demo: leere Liste, keine Abfrage", async () => {
    const { db, mod } = await lade({}, { demo: true });
    expect(await mod.ladeSanierungsprojekte()).toEqual({ ok: true, liste: [], eingerichtet: true });
    expect(zugriffe(db)).toEqual([]);
  });
});

describe("Ein Projekt laden", () => {
  it("Projekt: geprüft wie ein Entwurf aus dem Browser, am eigenen Konto", async () => {
    const { db, mod } = await lade({ antworten: { sanierungsprojekte: { id: ID, art: "projekt", name: "P", updated_at: STAND, daten: { ...entwurf(), boese: 1 } } } });
    const erg = await mod.ladeSanierungsprojekt(ID);
    expect(erg).toMatchObject({ ok: true, art: "projekt", id: ID, name: "P", stand: STAND });
    expect((erg as { entwurf: Record<string, unknown> }).entwurf).not.toHaveProperty("boese");
    expect(zugriffe(db, "select")[0].filter).toEqual(expect.arrayContaining([`eq:id=${ID}`, "eq:user_id=nutzer-1"]));
  });

  it("Vorlage: als Vorlage zurück", async () => {
    const { mod } = await lade({ antworten: { sanierungsprojekte: { id: ID, art: "vorlage", name: "V", updated_at: STAND, daten: MITGELIEFERTE_VORLAGEN[1].vorlage } } });
    expect(await mod.ladeSanierungsprojekt(ID)).toMatchObject({ ok: true, art: "vorlage", vorlage: MITGELIEFERTE_VORLAGEN[1].vorlage });
  });

  it("beschädigt, nicht gefunden, Fehler, unsinnige Kennung → Fehler", async () => {
    const kaputt = await lade({ antworten: { sanierungsprojekte: { id: ID, art: "projekt", name: "P", updated_at: STAND, daten: { vorlage: 1 } } } });
    expect(await kaputt.mod.ladeSanierungsprojekt(ID)).toEqual({ error: "Das gespeicherte Projekt ist beschädigt." });
    const leer = await lade();
    expect(await leer.mod.ladeSanierungsprojekt(ID)).toEqual({ error: "Das Projekt gibt es nicht mehr." });
    const fehler = await lade({ fehlerBei: { sanierungsprojekte: { message: "x", code: "XX000" } } });
    expect(await fehler.mod.ladeSanierungsprojekt(ID)).toEqual({ error: "Das Projekt ließ sich nicht laden." });
    const ungueltig = await lade();
    expect(await ungueltig.mod.ladeSanierungsprojekt("abc")).toEqual({ error: "Unbekanntes Projekt." });
    expect(zugriffe(ungueltig.db)).toEqual([]);
  });
});

describe("Löschen", () => {
  it("nur am eigenen Konto; Erfolg nur, wenn eine Zeile weg ist", async () => {
    const { db, mod } = await lade({ antworten: { sanierungsprojekte: { id: ID } } });
    expect(await mod.loescheSanierungsprojekt(ID)).toEqual({ ok: true });
    expect(zugriffe(db, "delete")[0].filter).toEqual(expect.arrayContaining([`eq:id=${ID}`, "eq:user_id=nutzer-1"]));
    const leer = await lade();
    expect(await leer.mod.loescheSanierungsprojekt(ID)).toEqual({ error: "Das Projekt gibt es nicht mehr." });
  });

  it("Fehler → Fehler; Demo → nichts; unsinnige Kennung → nichts", async () => {
    const fehler = await lade({ fehlerBei: { "sanierungsprojekte:delete": { message: "x", code: "XX000" } } });
    expect(await fehler.mod.loescheSanierungsprojekt(ID)).toEqual({ error: "Löschen hat nicht geklappt." });
    const demo = await lade({}, { demo: true });
    expect(await demo.mod.loescheSanierungsprojekt(ID)).toMatchObject({ error: expect.stringContaining("Demo") });
    expect(zugriffe(demo.db)).toEqual([]);
    const ungueltig = await lade();
    expect(await ungueltig.mod.loescheSanierungsprojekt("x")).toEqual({ error: "Unbekanntes Projekt." });
    expect(zugriffe(ungueltig.db)).toEqual([]);
  });
});
