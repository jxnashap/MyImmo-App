import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { sollFuerMonat, vertragswerte, type MietkontoZeitraum } from "@/lib/mietkonto";
import { abWannFragen, betraegeGeaendert, mitGeltendenBetraegen, planeMietaenderung, type Betraege, type MietaenderungsPlan, type ZeitraumZeile } from "@/lib/sollAb";

// Verknüpfungs-Audit 06.10.2026, Paket B — eine Soll-Miete statt zwei.
// Details: docs/AUDIT-2026-10-06-verknuepfung.md

const ALT: Betraege = { kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null };
const NEU: Betraege = { kaltmiete: 850, nk_vorauszahlung: 150, stellplatz_miete: null };

/** Wendet einen Plan auf eine Zeitraum-Liste an — so, wie schreibeMietaenderung es in der DB tut. */
function anwenden(zr: ZeitraumZeile[], plan: MietaenderungsPlan): MietkontoZeitraum[] {
  const neu = zr.map((z) => {
    const b = plan.beenden.find((x) => x.id === z.id);
    const e = plan.ersetzen?.id === z.id ? plan.ersetzen.betraege : null;
    return { ...z, ...(b ? { bis: b.bis } : {}), ...(e ?? {}) };
  });
  return [...neu, ...plan.luecken, ...(plan.neu ? [plan.neu] : [])];
}

describe("planeMietaenderung — die Vergangenheit bleibt, ab dem Stichmonat gilt das Neue", () => {
  it("ohne Zeiträume: Lücke seit Mietbeginn mit den alten Werten, neuer Zeitraum ab Stichmonat", () => {
    const plan = planeMietaenderung({ mietbeginn: "2024-03-15", alt: ALT, neu: NEU, zeitraeume: [], abYm: "2026-11" });
    expect(plan.luecken).toEqual([{ ...ALT, von: "2024-03-01", bis: "2026-10-01" }]);
    expect(plan.neu).toEqual({ ...NEU, von: "2026-11-01", bis: null });
    expect(plan.beenden).toEqual([]);
  });

  it("ENTSCHEIDEND: das Mietkonto rechnet vorher alt, danach neu — auch wenn das Mieterfeld schon neu ist", () => {
    const mieterNachher = { ...NEU, mietbeginn: "2024-03-01", mietende: null };
    const plan = planeMietaenderung({ mietbeginn: "2024-03-01", alt: ALT, neu: NEU, zeitraeume: [], abYm: "2026-11" });
    const zr = anwenden([], plan);
    expect(sollFuerMonat(mieterNachher, zr, "2025-06")!.kaltmiete).toBe(800);
    expect(sollFuerMonat(mieterNachher, zr, "2026-10")!.kaltmiete).toBe(800);
    expect(sollFuerMonat(mieterNachher, zr, "2026-11")!.kaltmiete).toBe(850);
    expect(sollFuerMonat(mieterNachher, zr, "2028-01")!.kaltmiete).toBe(850);
  });

  it("ein laufender Zeitraum endet im Vormonat, die Lücke davor bekommt die alten Feldwerte", () => {
    const z: ZeitraumZeile = { id: "z1", von: "2025-06-01", bis: null, kaltmiete: 820, nk_vorauszahlung: 150, stellplatz_miete: null };
    const plan = planeMietaenderung({ mietbeginn: "2024-03-01", alt: ALT, neu: NEU, zeitraeume: [z], abYm: "2026-11" });
    expect(plan.luecken).toEqual([{ ...ALT, von: "2024-03-01", bis: "2025-05-01" }]);
    expect(plan.beenden).toEqual([{ id: "z1", bis: "2026-10-01" }]);
    const zr = anwenden([z], plan);
    const m = { ...NEU, mietbeginn: "2024-03-01", mietende: null };
    expect(sollFuerMonat(m, zr, "2024-05")!.kaltmiete).toBe(800);
    expect(sollFuerMonat(m, zr, "2026-01")!.kaltmiete).toBe(820);
    expect(sollFuerMonat(m, zr, "2026-12")!.kaltmiete).toBe(850);
  });

  it("ein schon geplanter späterer Zeitraum bleibt: der neue endet davor", () => {
    const z: ZeitraumZeile = { id: "z2", von: "2027-05-01", bis: null, kaltmiete: 900, nk_vorauszahlung: 150, stellplatz_miete: null };
    const plan = planeMietaenderung({ mietbeginn: "2024-03-01", alt: ALT, neu: NEU, zeitraeume: [z], abYm: "2026-11" });
    expect(plan.neu).toMatchObject({ von: "2026-11-01", bis: "2027-04-01" });
    expect(plan.beenden).toEqual([]);
  });

  it("beginnt schon ein Zeitraum im Stichmonat, bekommt er die neuen Beträge (kein Duplikat)", () => {
    const z: ZeitraumZeile = { id: "z3", von: "2026-11-01", bis: null, kaltmiete: 830, nk_vorauszahlung: 150, stellplatz_miete: null };
    const plan = planeMietaenderung({ mietbeginn: "2024-03-01", alt: ALT, neu: NEU, zeitraeume: [z], abYm: "2026-11" });
    expect(plan.ersetzen).toEqual({ id: "z3", betraege: NEU });
    expect(plan.neu).toBeNull();
  });

  it("Stichmonat am oder vor dem Mietbeginn = Korrektur: leerer Plan", () => {
    for (const ab of ["2024-03", "2023-01"]) {
      const p = planeMietaenderung({ mietbeginn: "2024-03-01", alt: ALT, neu: NEU, zeitraeume: [], abYm: ab });
      expect(p).toEqual({ luecken: [], neu: null, beenden: [], ersetzen: null });
    }
  });
});

describe("abWannFragen", () => {
  it("nur bei laufendem Mietverhältnis UND geänderten Beträgen", () => {
    expect(abWannFragen("2024-03-01", ALT, NEU, "2026-10")).toBe(true);
    expect(abWannFragen("2024-03-01", ALT, { ...ALT }, "2026-10")).toBe(false);
    expect(abWannFragen("2026-10-01", ALT, NEU, "2026-10")).toBe(false); // beginnt diesen Monat
    expect(abWannFragen("2027-01-01", ALT, NEU, "2026-10")).toBe(false); // künftig
    expect(abWannFragen(null, ALT, NEU, "2026-10")).toBe(false);
  });
  it("leer und 0 sind gleich, Cent-Rundung zählt nicht als Änderung", () => {
    expect(betraegeGeaendert({ ...ALT, stellplatz_miete: null }, { ...ALT, stellplatz_miete: 0 })).toBe(false);
    expect(betraegeGeaendert(ALT, { ...ALT, kaltmiete: 800.001 })).toBe(false);
    expect(betraegeGeaendert(ALT, { ...ALT, nk_vorauszahlung: 160 })).toBe(true);
  });
});

describe("eine Miete für Dashboard, Objektseite und Briefe", () => {
  it("mitGeltendenBetraegen nimmt den Zeitraum des Monats, sonst das Feld", () => {
    const mieter = [
      { id: "a", kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null },
      { id: "b", kaltmiete: 500, nk_vorauszahlung: 80, stellplatz_miete: null },
    ];
    const zr = [{ mieter_id: "a", von: "2026-01-01", bis: null, kaltmiete: 870, nk_vorauszahlung: 160, stellplatz_miete: 0 }];
    const r = mitGeltendenBetraegen(mieter, zr, "2026-10");
    expect(r[0]).toMatchObject({ kaltmiete: 870, nk_vorauszahlung: 160 });
    expect(r[1]).toBe(mieter[1]);
    expect(mitGeltendenBetraegen(mieter, zr, "2025-12")[0]).toMatchObject({ kaltmiete: 800 });
  });

  it("vertragswerte ist die Regel, die auch sollFuerMonat benutzt", () => {
    const m = { kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: 0, mietbeginn: "2024-01-01", mietende: null };
    const zr = [{ von: "2026-01-01", bis: null, kaltmiete: 870, nk_vorauszahlung: 160, stellplatz_miete: 0 }];
    expect(sollFuerMonat(m, zr, "2026-10")!.kaltmiete).toBe(vertragswerte(m, zr, "2026-10").kaltmiete);
  });

  it("Dashboard, Objektseite, Objektliste, Briefe und „Objekt-Miete angleichen“ benutzen sie", () => {
    for (const p of [
      "app/(app)/page.tsx",
      "app/(app)/properties/[id]/page.tsx",
      "app/(app)/properties/page.tsx",
      "app/(app)/tenants/[id]/dokument/page.tsx",
      "lib/actions/properties.ts",
    ]) expect(readFileSync(p, "utf8"), p).toMatch(/mitGeltendenBetraegen\(/);
    // … und rechnen auch WEITER damit (nicht nur geladen und liegen gelassen).
    const dash = readFileSync("app/(app)/page.tsx", "utf8");
    expect(dash).toMatch(/sollKaltmiete\(p, mieterJetzt,/);
    expect(dash).toMatch(/nkVorauszahlungenMonat\(mieterJetzt\./);
    const obj = readFileSync("app/(app)/properties/[id]/page.tsx", "utf8");
    expect(obj).toMatch(/sollKaltmiete\(p, tenantsJetzt,/);
    expect(obj).toMatch(/nkVorauszahlungenMonat\(tenantsJetzt,/);
    expect(readFileSync("app/(app)/properties/page.tsx", "utf8")).toMatch(/sollKaltmiete\(p, mietJetzt,/);
  });
});

// --------------------------------------------------------------- Actions ----

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, spuren, mod };
}
type Db = { zugriffe: { tabelle: string; op: string; daten?: unknown }[] };
const ops = (db: Db, tabelle: string, op: string) => db.zugriffe.filter((z) => z.tabelle === tabelle && z.op === op);

const ALT_MIETER = { vorname: "A", nachname: "B", mietbeginn: "2024-03-01", kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null, prop_id: "obj-1" };
const FORM = { vorname: "A", nachname: "B", mietbeginn: "2024-03-01", kaltmiete: "850", nk_vorauszahlung: "150", prop_id: "obj-1" };

describe("updateTenant — Miete geändert", () => {
  it("ohne Angabe „ab wann“ wird NICHTS gespeichert", async () => {
    const { db, spuren, mod } = await lade("@/lib/actions/tenants", { antworten: { mieter: ALT_MIETER, mieter_zugaenge: [], miet_zeitraeume: [] } });
    await fangeRedirect(() => mod.updateTenant("m1", fd(FORM)));
    expect(ops(db, "mieter", "update")).toHaveLength(0);
    expect(ops(db, "miet_zeitraeume", "insert")).toHaveLength(0);
    expect(decodeURIComponent(spuren.redirects.at(-1)!)).toMatch(/ab welchem Monat/);
  });

  it("mit Monat: erst die Zeiträume (alt bis Vormonat, neu ab Monat), dann der Mieter", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants", { antworten: { mieter: ALT_MIETER, mieter_zugaenge: [], miet_zeitraeume: [] } });
    await fangeRedirect(() => mod.updateTenant("m1", fd({ ...FORM, miete_ab: "2026-11" })));
    const ins = ops(db, "miet_zeitraeume", "insert").flatMap((z) => (Array.isArray(z.daten) ? z.daten : [z.daten])) as Record<string, unknown>[];
    expect(ins).toEqual([
      expect.objectContaining({ von: "2024-03-01", bis: "2026-10-01", kaltmiete: 800, mieter_id: "m1", user_id: "nutzer-1", prop_id: "obj-1" }),
      expect.objectContaining({ von: "2026-11-01", bis: null, kaltmiete: 850 }),
    ]);
    const reihenfolge = db.zugriffe.filter((z) => z.op !== "select").map((z) => z.tabelle);
    expect(reihenfolge.indexOf("miet_zeitraeume")).toBeLessThan(reihenfolge.indexOf("mieter"));
    expect(ops(db, "mieter", "update")[0].daten).toMatchObject({ kaltmiete: 850 });
  });

  it("„korrektur“: keine Zeiträume, nur der Mieter", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants", { antworten: { mieter: ALT_MIETER, mieter_zugaenge: [], miet_zeitraeume: [] } });
    await fangeRedirect(() => mod.updateTenant("m1", fd({ ...FORM, miete_ab: "korrektur" })));
    expect(ops(db, "miet_zeitraeume", "insert")).toHaveLength(0);
    expect(ops(db, "mieter", "update")).toHaveLength(1);
  });

  it("scheitert das Lesen der Zeiträume, wird nichts gespeichert (fail-closed)", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants", {
      antworten: { mieter: ALT_MIETER, mieter_zugaenge: [] },
      fehlerBei: { "miet_zeitraeume:select": { message: "x" } },
    });
    await expect(mod.updateTenant("m1", fd({ ...FORM, miete_ab: "2026-11" }))).rejects.toThrow();
    expect(ops(db, "mieter", "update")).toHaveLength(0);
  });

  it("scheitert ein Zeitraum, bleibt der Mieter unverändert", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants", {
      antworten: { mieter: ALT_MIETER, mieter_zugaenge: [], miet_zeitraeume: [] },
      fehlerBei: { "miet_zeitraeume:insert": { message: "x" } },
    });
    await fangeRedirect(() => mod.updateTenant("m1", fd({ ...FORM, miete_ab: "2026-11" })));
    expect(ops(db, "mieter", "update")).toHaveLength(0);
  });
});

describe("schreibeMietaenderung — bricht beim ersten Fehler ab", () => {
  it("scheitert die Lücke, wird nichts weiter geschrieben", async () => {
    const { db, client } = fakeSupabase({ fehlerBei: { "miet_zeitraeume:insert": { message: "x" } } });
    const { schreibeMietaenderung } = await import("@/lib/mietaenderung");
    const plan = planeMietaenderung({ mietbeginn: "2024-03-01", alt: ALT, neu: NEU, zeitraeume: [], abYm: "2026-11" });
    const r = await schreibeMietaenderung(client as never, { userId: "u", mieterId: "m1", propId: null, plan });
    expect("error" in r).toBe(true);
    expect(db.zugriffe.filter((z) => z.op !== "select")).toHaveLength(1);
  });
});

describe("setzeMieteAb — NK-Anpassung ins Mietkonto", () => {
  it("nur die Vorauszahlung ändert sich, die Kaltmiete bleibt die des Monats", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: ALT_MIETER, miet_zeitraeume: [] } });
    expect(await mod.setzeMieteAb("m1", "2026-12", { nk_vorauszahlung: 175 })).toEqual({ ok: true });
    const ins = ops(db, "miet_zeitraeume", "insert").flatMap((z) => (Array.isArray(z.daten) ? z.daten : [z.daten])) as Record<string, unknown>[];
    expect(ins.at(-1)).toMatchObject({ von: "2026-12-01", bis: null, kaltmiete: 800, nk_vorauszahlung: 175 });
    expect(ins[0]).toMatchObject({ von: "2024-03-01", bis: "2026-11-01", nk_vorauszahlung: 150 });
    // Die Felder am Mieter bleiben der Grundwert (Staffelplan rechnet darauf) — nur Zeiträume.
    expect(ops(db, "mieter", "update")).toHaveLength(0);
  });

  it("ungültiger Monat oder negativer Betrag: nichts geschrieben", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: ALT_MIETER, miet_zeitraeume: [] } });
    expect((await mod.setzeMieteAb("m1", "12/2026", { nk_vorauszahlung: 175 })).ok).toBe(false);
    expect((await mod.setzeMieteAb("m1", "2026-12", { nk_vorauszahlung: -5 })).ok).toBe(false);
    expect(db.zugriffe.filter((z) => z.op !== "select")).toHaveLength(0);
  });
});
