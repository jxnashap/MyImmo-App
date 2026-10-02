import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { baueMieterAufgaben } from "@/lib/mieterAufgaben";
import { ladePortalDaten } from "@/lib/portalDaten";

// Mitteilungen an ein Haus / alle Mieter und Gebäude-Infos (02.10.2026, Schritt 6).
// Die Datenbank-Schranken (nur verknüpfte Konten eigener Mieter, Infos nur für eigene
// Objekte, Mieter liest aber ändert nicht, Rückzug nur eigener Gruppen) wurden in einer
// zurückgerollten Transaktion bewiesen. Hier: Actions, Laden, Aufgaben, Migration.

beforeEach(() => vi.resetModules());
afterEach(() => { for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/benachrichtigung"]) vi.doUnmock(m); });

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const mails: [string, string, string][] = [];
  vi.doMock("@/lib/benachrichtigung", () => ({ benachrichtige: async (u: string, a: string, b: string) => { mails.push([u, a, b]); return "gesendet"; } }));
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  return { db, mails, mod: await import("@/lib/actions/mitteilungen") };
}

const Z = (user_id: string, mietende: string | null = null, prop_id = "o1") => ({ user_id, mieter_id: `m-${user_id}`, prop_id, email: `${user_id}@x.de`, mieter: { mietende } });
const gueltig = (extra: Record<string, string> = {}) => fd({ titel: "Wasser aus", nachricht: "Montag 9–12 Uhr", ziel: "o1", ...extra });
const einfuegen = (db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }) =>
  db.zugriffe.find((z) => z.tabelle === "zustellungen" && z.op === "insert")?.daten as Record<string, unknown>[] | undefined;

describe("Mitteilung senden", () => {
  it("geht an jedes aktive Konto des Objekts, als EINE Gruppe, und benachrichtigt jedes", async () => {
    const { db, mails, mod } = await lade({ antworten: { mieter_zugaenge: [Z("k1"), Z("k2")], zustellungen: [{ id: "1" }, { id: "2" }] } });
    expect(await mod.sendeMitteilung(gueltig())).toEqual({ ok: true, anzahl: 2 });
    const zeilen = einfuegen(db)!;
    expect(zeilen.map((z) => z.empfaenger_user_id)).toEqual(["k1", "k2"]);
    expect(new Set(zeilen.map((z) => z.gruppe)).size).toBe(1);
    expect(zeilen[0]).toMatchObject({ art: "mitteilung", titel: "Wasser aus", nachricht: "Montag 9–12 Uhr", vermieter_id: "nutzer-1", zugestellt_von: "nutzer-1", bestaetigung_noetig: false });
    expect(mails.map((m) => [m[0], m[1]])).toEqual([["k1", "mitteilung"], ["k2", "mitteilung"]]);
    const q = db.zugriffe.find((z) => z.tabelle === "mieter_zugaenge")!;
    expect(q.filter).toEqual(expect.arrayContaining(["eq:vermieter_id=nutzer-1", "eq:prop_id=o1"]));
  });
  it("„alle“: kein Objekt-Filter, aber weiter nur eigene Mieter", async () => {
    const { db, mod } = await lade({ antworten: { mieter_zugaenge: [Z("k1")], zustellungen: [{ id: "1" }] } });
    await mod.sendeMitteilung(gueltig({ ziel: "alle" }));
    const q = db.zugriffe.find((z) => z.tabelle === "mieter_zugaenge")!;
    expect(q.filter).toContain("eq:vermieter_id=nutzer-1");
    expect(q.filter.some((f) => f.startsWith("eq:prop_id"))).toBe(false);
  });
  it("abgelaufene Zugänge fallen heraus; bleibt niemand, wird nichts gesendet", async () => {
    const { db, mod } = await lade({ antworten: { mieter_zugaenge: [Z("k1", "2020-06-30"), Z("k2")], zustellungen: [{ id: "1" }] } });
    await mod.sendeMitteilung(gueltig());
    expect(einfuegen(db)!.map((z) => z.empfaenger_user_id)).toEqual(["k2"]);
    const b = await lade({ antworten: { mieter_zugaenge: [Z("k1", "2020-06-30")] } });
    expect((await b.mod.sendeMitteilung(gueltig())).error).toContain("Niemand würde");
    expect(einfuegen(b.db)).toBeUndefined();
  });
  it("Bestätigung angefordert wird mitgeschrieben", async () => {
    const { db, mod } = await lade({ antworten: { mieter_zugaenge: [Z("k1")], zustellungen: [{ id: "1" }] } });
    await mod.sendeMitteilung(gueltig({ bestaetigung: "on" }));
    expect(einfuegen(db)![0].bestaetigung_noetig).toBe(true);
  });
  it("Eingaben: leer, zu lang, ohne Ziel — abgelehnt ohne Schreiben", async () => {
    for (const f of [gueltig({ titel: " " }), gueltig({ nachricht: "" }), gueltig({ titel: "x".repeat(121) }), gueltig({ nachricht: "x".repeat(4001) }), gueltig({ ziel: "" })]) {
      const { db, mod } = await lade({ antworten: { mieter_zugaenge: [Z("k1")] } });
      expect((await mod.sendeMitteilung(f)).error).toBeTruthy();
      expect(einfuegen(db)).toBeUndefined();
    }
  });
  it("Empfänger-Abfrage scheitert: nichts gesendet (fail-closed)", async () => {
    const { db, mails, mod } = await lade({ antworten: { mieter_zugaenge: [Z("k1")] }, fehlerBei: { "mieter_zugaenge:select": { message: "x" } } });
    expect((await mod.sendeMitteilung(gueltig())).error).toContain("nichts gesendet");
    expect(einfuegen(db)).toBeUndefined();
    expect(mails).toEqual([]);
  });
  it("Einfügen scheitert oder liefert weniger Zeilen: Fehler, keine Mails", async () => {
    const a = await lade({ antworten: { mieter_zugaenge: [Z("k1"), Z("k2")], zustellungen: [{ id: "1" }] } });
    expect((await a.mod.sendeMitteilung(gueltig())).error).toContain("niemand sieht sie");
    expect(a.mails).toEqual([]);
    const b = await lade({ antworten: { mieter_zugaenge: [Z("k1")] }, fehlerBei: { "zustellungen:insert": { message: "rls" } } });
    expect((await b.mod.sendeMitteilung(gueltig())).error).toBeTruthy();
    expect(b.mails).toEqual([]);
  });
});

describe("zurückziehen und Gebäude-Infos", () => {
  it("Rückzug zählt nur, wenn mindestens eine Zeile betroffen war", async () => {
    expect(await (await lade({ rpc: { mitteilung_zurueckziehen: 3 } })).mod.zieheMitteilungZurueck("g")).toEqual({ ok: true });
    expect(await (await lade({ rpc: { mitteilung_zurueckziehen: 0 } })).mod.zieheMitteilungZurueck("g")).toHaveProperty("error");
  });
  it("Infos: Upsert je Objekt, leere Felder als null, auf das eigene Konto", async () => {
    const { db, mod } = await lade({ antworten: { gebaeude_infos: { prop_id: "o1" } } });
    expect(await mod.speichereGebaeudeInfos(fd({ prop_id: "o1", notdienst: " Heizung: Firma X ", muell: "" }))).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "gebaeude_infos")!;
    expect(z.op).toBe("upsert");
    expect(z.daten).toMatchObject({ prop_id: "o1", vermieter_id: "nutzer-1", notdienst: "Heizung: Firma X", muell: null });
  });
  it("Infos: zu lang, ohne Objekt oder 0 Zeilen (fremdes Objekt) — Fehler", async () => {
    expect((await (await lade()).mod.speichereGebaeudeInfos(fd({ prop_id: "o1", hausordnung: "x".repeat(4001) }))).error).toBeTruthy();
    expect((await (await lade()).mod.speichereGebaeudeInfos(fd({ prop_id: "" }))).error).toBeTruthy();
    expect((await (await lade({ antworten: { gebaeude_infos: null } })).mod.speichereGebaeudeInfos(fd({ prop_id: "fremd" }))).error).toBeTruthy();
  });
});

describe("im Portal", () => {
  const mt = (x: Record<string, unknown> = {}) => ({ id: "z1", titel: "Wasser aus", nachricht: "Mo", zugestellt_am: "2026-09-30T10:00:00Z", bestaetigung_noetig: false, bestaetigt_am: null, ...x });
  const leer = { freigegebeneDocs: [], anliegen: [], verlauf: {}, vermieterAnfragen: [] };
  it("Aufgaben: zu bestätigen = dringend; neu (7 Tage) = Hinweis; älter = nichts", () => {
    expect(baueMieterAufgaben({ ...leer, mitteilungen: [mt({ bestaetigung_noetig: true })] }, "2026-10-02")[0]).toMatchObject({ dringend: true, tab: "wohnung" });
    expect(baueMieterAufgaben({ ...leer, mitteilungen: [mt()] }, "2026-10-02")[0]).toMatchObject({ dringend: false, id: "mitteilung:z1" });
    expect(baueMieterAufgaben({ ...leer, mitteilungen: [mt({ zugestellt_am: "2026-09-20T10:00:00Z" })] }, "2026-10-02")).toEqual([]);
  });

  function fakeDb(antworten: Record<string, unknown>) {
    const abfragen: { tabelle: string; filter: string[] }[] = [];
    const from = (tabelle: string) => {
      const a = { tabelle, filter: [] as string[] };
      abfragen.push(a);
      const k: Record<string, unknown> = {};
      k.select = () => k;
      for (const m of ["eq", "in", "order", "limit", "is"]) k[m] = (x: unknown, y?: unknown) => { a.filter.push(`${m}:${String(x)}=${JSON.stringify(y)}`); return k; };
      const antwort = () => ({ data: antworten[tabelle] ?? null, error: null });
      k.maybeSingle = async () => antwort();
      k.then = (f: (w: unknown) => unknown) => Promise.resolve(antwort()).then(f);
      return k;
    };
    return { db: { from }, abfragen };
  }
  it("Vorschau: Mitteilungen nur an DIESES Konto, nicht zurückgezogen; Infos auf den Vermieter gefiltert", async () => {
    const { db, abfragen } = fakeDb({
      mieter: { id: "m1", prop_id: "o1", mietbeginn: "2025-01-01", mietende: null, kaltmiete: 800, nk_vorauszahlung: 150 },
      properties: { id: "o1", bezeichnung: "A", adresse: "X" },
      mieter_zugaenge: { user_id: "konto-m" },
      gebaeude_infos: [{ prop_id: "o1", notdienst: "Firma X", updated_at: "2026-10-01" }],
    });
    const d = await ladePortalDaten(db, { art: "vermieter", vermieterId: "v-1", mieterId: "m1" });
    const z = abfragen.filter((a) => a.tabelle === "zustellungen").find((a) => a.filter.includes(`eq:art="mitteilung"`))!;
    expect(z.filter).toEqual(expect.arrayContaining([`eq:empfaenger_user_id="konto-m"`, "is:zurueckgezogen_am=null", `eq:vermieter_id="v-1"`]));
    expect(abfragen.find((a) => a.tabelle === "gebaeude_infos")!.filter).toContain(`eq:vermieter_id="v-1"`);
    expect(d.hausInfos.o1?.notdienst).toBe("Firma X");
  });
});

describe("Migration und Oberfläche", () => {
  const sql = readFileSync("supabase/migrations/20261002190000_mitteilungen_haus.sql", "utf8").split("\n").filter((z) => !z.startsWith("--")).join("\n");
  it("ohne Schlüsselwort für den Bestätigungsdialog; keine Lösch-Regel", () => {
    expect(sql).not.toMatch(/\b(delete|drop)\b/i);
  });
  it("Mieter lesen Infos nur mit aktivem Zugang zu DIESEM Objekt dieses Vermieters", () => {
    expect(sql).toMatch(/gebaeude_select_mieter[\s\S]*z\.prop_id = gebaeude_infos\.prop_id[\s\S]*z\.vermieter_id = gebaeude_infos\.vermieter_id[\s\S]*mieter_zugang_aktiv/);
  });
  it("die Notdienste des Vermieters stehen im Notfall-Kasten als SEINE Angabe", () => {
    expect(readFileSync("components/NotfallHinweis.tsx", "utf8")).toContain("Notdienste laut deinem Vermieter");
  });
});
