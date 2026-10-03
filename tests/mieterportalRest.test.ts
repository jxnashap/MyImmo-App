// Mieterportal, Rest von Paket S (03.10.2026): Vorschau nach Zugangsende, Reichweite einer
// Beleg-Freigabe (S7) und Mieterwechsel in derselben Zeile (S4).
import { describe, it, expect } from "vitest";
import { ladePortalDaten } from "@/lib/portalDaten";
import { heuteBerlin } from "@/lib/zeitraum";

function fakeDb(antworten: Record<string, unknown>) {
  const from = (tabelle: string) => {
    const k: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit", "is"]) k[m] = () => k;
    const antwort = () => ({ data: antworten[tabelle] ?? null, error: null });
    k.maybeSingle = async () => antwort();
    k.then = (f: (w: unknown) => unknown) => Promise.resolve(antwort()).then(f);
    return k;
  };
  return { from };
}

const jahr = Number(heuteBerlin().slice(0, 4));
const basis = {
  properties: { id: "obj-1", bezeichnung: "Altbau", adresse: "Lindenstr. 4" },
  mieter_zugaenge: { user_id: "konto-m" },
  einnahmen: [{ id: "z1", buchungsdatum: `${jahr - 3}-03-01`, kategorie: "Miete", betrag: 900, mieter_id: "m1" }],
  kosten: [{ id: "k1", buchungsdatum: `${jahr - 3}-05-01`, kategorie: "Grundsteuer", betrag: 100 }],
};
const zeile = (mietende: string | null) => ({ id: "m1", prop_id: "obj-1", vorname: "Anna", nachname: "Berger", mietbeginn: `${jahr - 5}-01-01`, mietende });

describe("Vorschau nach Zugangsende", () => {
  it("abgelaufen (Auszug vor zwei Jahren): keine Wohnung, keine Zahlungen, keine Belege — und das Enddatum", async () => {
    const d = await ladePortalDaten(fakeDb({ ...basis, mieter: zeile(`${jahr - 3}-06-30`) }), { art: "vermieter", vermieterId: "v", mieterId: "m1" });
    expect(d.zugangBeendet).toBe(`${jahr - 2}-12-31`);
    expect(d.wohnungen).toEqual([]);
    expect(d.zahlungen).toEqual([]);
    expect(d.belege).toEqual([]);
  });

  it("im Nachlauf (Auszug letztes Jahr) sieht der Mieter noch alles", async () => {
    const d = await ladePortalDaten(fakeDb({ ...basis, mieter: zeile(`${jahr - 1}-06-30`) }), { art: "vermieter", vermieterId: "v", mieterId: "m1" });
    expect(d.zugangBeendet).toBeNull();
    expect(d.wohnungen).toHaveLength(1);
    expect(d.zahlungen).toHaveLength(1);
  });

  it("laufender Vertrag: kein Ende", async () => {
    const d = await ladePortalDaten(fakeDb({ ...basis, mieter: zeile(null) }), { art: "vermieter", vermieterId: "v", mieterId: "m1" });
    expect(d.zugangBeendet).toBeNull();
    expect(d.wohnungen).toHaveLength(1);
  });
});

import { belegReichweite } from "@/lib/mieterZugang";

describe("S7: Reichweite einer Beleg-Freigabe", () => {
  const heute = "2026-10-03";
  const mieter = [
    { id: "a", prop_id: "p1", mietbeginn: "2020-01-01", mietende: null },        // läuft
    { id: "b", prop_id: "p1", mietbeginn: "2026-04-01", mietende: null },        // erst seit 2026
    { id: "c", prop_id: "p1", mietbeginn: "2018-01-01", mietende: "2023-06-30" },// Zugang endete 31.12.2024
    { id: "d", prop_id: "p2", mietbeginn: "2020-01-01", mietende: null },        // anderes Objekt
    { id: "e", prop_id: "p1", mietbeginn: "2019-01-01", mietende: "2025-03-31" },// Nachlauf bis 31.12.2026
  ];
  const zug = [
    { mieter_id: "a", user_id: "u-a" }, { mieter_id: "b", user_id: "u-b" }, { mieter_id: "c", user_id: "u-c" },
    { mieter_id: "d", user_id: "u-d" }, { mieter_id: "e", user_id: "u-e" },
  ];

  it("Beleg 2025: a und e (b erst ab 2026, c abgelaufen, d anderes Objekt)", () => {
    expect(belegReichweite({ prop_id: "p1", buchungsdatum: "2025-05-01" }, mieter, zug, heute)).toBe(2);
  });
  it("Beleg 2026: a, b — e ist 2025 ausgezogen", () => {
    expect(belegReichweite({ prop_id: "p1", buchungsdatum: "2026-02-01" }, mieter, zug, heute)).toBe(2);
  });
  it("Beleg 2023: c lag in der Mietzeit, aber sein Zugang ist abgelaufen → nur a und e", () => {
    expect(belegReichweite({ prop_id: "p1", buchungsdatum: "2023-03-01" }, mieter, zug, heute)).toBe(2);
  });
  it("ohne Objekt oder ohne verbundene Konten: 0", () => {
    expect(belegReichweite({ prop_id: null, buchungsdatum: "2025-05-01" }, mieter, zug, heute)).toBe(0);
    expect(belegReichweite({ prop_id: "p1", buchungsdatum: "2025-05-01" }, mieter, [], heute)).toBe(0);
  });
  it("ein Konto mit zwei Wohnungen zählt einmal", () => {
    const m2 = [...mieter, { id: "f", prop_id: "p1", mietbeginn: "2020-01-01", mietende: null }];
    expect(belegReichweite({ prop_id: "p1", buchungsdatum: "2025-05-01" }, m2, [...zug, { mieter_id: "f", user_id: "u-a" }], heute)).toBe(2);
  });
});

import { vi, afterEach } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { mieterwechselVerdacht } from "@/lib/mieterZugang";

describe("S4: Mieterwechsel in derselben Zeile", () => {
  afterEach(() => { for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m); });

  const alt = { vorname: "Anna", nachname: "Berger", mietbeginn: "2021-03-01" };
  it("erkennt neuen Namen oder neuen Mietbeginn — aber keine Korrektur der Schreibweise", () => {
    expect(mieterwechselVerdacht(alt, { ...alt, nachname: "Krüger" })).toBe(true);
    expect(mieterwechselVerdacht(alt, { ...alt, vorname: "Tom" })).toBe(true);
    expect(mieterwechselVerdacht(alt, { ...alt, mietbeginn: "2026-11-01" })).toBe(true);
    expect(mieterwechselVerdacht(alt, { ...alt, nachname: " berger " })).toBe(false);
    expect(mieterwechselVerdacht({ ...alt, mietbeginn: null }, { ...alt, mietbeginn: "2021-03-01" })).toBe(false);
    expect(mieterwechselVerdacht(alt, alt)).toBe(false);
  });

  async function lade(zugang: boolean) {
    vi.resetModules();
    const { db, client } = fakeSupabase({
      antworten: { mieter: alt },
      antwortFolge: { "mieter_zugaenge:select": [zugang ? [{ user_id: "konto-a" }] : [], []] },
    });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/tenants");
    return { db, mod };
  }
  const geaendert = (extra: Record<string, string> = {}) => fd({ vorname: "Tom", nachname: "Krüger", mietbeginn: "2026-11-01", ...extra });
  const update = (db: ReturnType<typeof fakeSupabase>["db"]) => db.zugriffe.find((z) => z.tabelle === "mieter" && z.op === "update");

  it("verbundenes Konto + Wechsel ohne Entscheidung: nichts gespeichert, zurück ins Formular", async () => {
    const { db, mod } = await lade(true);
    const ziel = await fangeRedirect(() => mod.updateTenant("m1", geaendert()));
    expect(ziel).toContain("/tenants/m1/edit");
    expect(ziel).toContain("flashTyp=error");
    expect(update(db)).toBeUndefined();
  });

  it("„neuer Mieter“: Zugang wird getrennt, dann gespeichert", async () => {
    const { db, mod } = await lade(true);
    await fangeRedirect(() => mod.updateTenant("m1", geaendert({ mieterwechsel: "trennen" })));
    const loeschen = db.zugriffe.find((z) => z.tabelle === "mieter_zugaenge" && z.op === "delete");
    expect(loeschen).toBeDefined();
    expect(update(db)).toBeDefined();
    expect(db.zugriffe.indexOf(loeschen!)).toBeLessThan(db.zugriffe.indexOf(update(db)!));
  });

  it("„Korrektur“: gespeichert, Zugang bleibt", async () => {
    const { db, mod } = await lade(true);
    await fangeRedirect(() => mod.updateTenant("m1", geaendert({ mieterwechsel: "korrektur" })));
    expect(db.zugriffe.find((z) => z.tabelle === "mieter_zugaenge" && z.op === "delete")).toBeUndefined();
    expect(update(db)).toBeDefined();
  });

  it("ohne verbundenes Konto: keine Rückfrage", async () => {
    const { db, mod } = await lade(false);
    await fangeRedirect(() => mod.updateTenant("m1", geaendert()));
    expect(update(db)).toBeDefined();
  });

  it("kann der Zugang nicht gelesen werden, wird nicht gespeichert (fail-closed)", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({ antworten: { mieter: alt }, fehlerBei: { "mieter_zugaenge:select": { message: "boom" } } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/tenants");
    await expect(mod.updateTenant("m1", geaendert())).rejects.toThrow();
    expect(update(db)).toBeUndefined();
  });
});
