import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { gezahltImMonat, offeneMieten, TEILZAHLUNG_TOLERANZ } from "@/lib/mietkonto";

// Verknüpfungs-Audit 06.10.2026, Paket B (Rest): Teilzahlung (B5), Mietmonat bei manueller
// Einnahme (B6), Staffel → Mietkonto (B2), Hinweis bei Wiederkehr-Miete (B7).

const M = { kaltmiete: 750, nk_vorauszahlung: 150, stellplatz_miete: 0, mietbeginn: "2025-01-01", mietende: null };
const miete = (ym: string, betrag: number | null) => ({ kategorie: "Miete", buchungsdatum: `${ym}-02`, soll_monat: ym, betrag });

describe("B5 — Teilzahlung", () => {
  it("gezahltImMonat summiert Miet-Buchungen des Monats (soll_monat vor Buchungsdatum)", () => {
    const e = [miete("2026-09", 400), miete("2026-09", 100), { kategorie: "Miete", buchungsdatum: "2026-10-02", soll_monat: "2026-09", betrag: 50 }, miete("2026-08", 900)];
    expect(gezahltImMonat(e, "2026-09")).toBe(550);
    expect(gezahltImMonat([{ kategorie: "Kaution", buchungsdatum: "2026-09-01", betrag: 2000 }], "2026-09")).toBe(0);
  });
  it("Buchung ohne Betrag (alter Aufrufer) zählt als bezahlt — keine Fehlalarme", () => {
    expect(gezahltImMonat([miete("2026-09", null)], "2026-09")).toBeNull();
  });
  it("400 von 900 € ist offen, mit Rest 500 €; 899,50 € gilt als bezahlt", () => {
    const heute = new Date(Date.UTC(2026, 9, 20));
    const o = offeneMieten(M, [], [miete("2026-09", 400), miete("2026-10", 900), miete("2026-08", 900 - TEILZAHLUNG_TOLERANZ + 0.5)], heute);
    const sep = o.find((x) => x.jahrMonat === "2026-09");
    expect(sep).toMatchObject({ gezahlt: 400, rest: 500, gesamt: 900 });
    expect(o.find((x) => x.jahrMonat === "2026-10")).toBeUndefined();
    expect(o.find((x) => x.jahrMonat === "2026-08")).toBeUndefined();
  });
  it("Wächter, Dashboard und Mietkonto laden den Betrag und rechnen mit dem Rest", () => {
    const w = readFileSync("components/RueckstandWaechter.tsx", "utf8");
    expect(w).toMatch(/select\("mieter_id,buchungsdatum,kategorie,soll_monat,betrag"\)/);
    expect(w).toMatch(/betrag: o\.rest/);
    const d = readFileSync("app/(app)/page.tsx", "utf8");
    expect(d).toMatch(/gezahlt < soll\.gesamt - TEILZAHLUNG_TOLERANZ/);
    expect(readFileSync("lib/mietkontoDaten.ts", "utf8")).toMatch(/gezahlt: gezahltImMonat\(/);
  });
});

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});
async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, mod };
}
type Db = { zugriffe: { tabelle: string; op: string; daten?: unknown }[] };
const ops = (db: Db, t: string, op: string) => db.zugriffe.filter((z) => z.tabelle === t && z.op === op);

describe("B6 — Mietmonat bei manueller Einnahme", () => {
  it("wird gespeichert, wenn das Formular ihn schickt", async () => {
    const { db, mod } = await lade("@/lib/actions/buchungen");
    await fangeRedirect(() => mod.createEinnahme(fd({ prop_id: "p", kategorie: "Miete", betrag: "900", buchungsdatum: "2026-02-02", soll_monat: "2026-01" })));
    expect(ops(db, "einnahmen", "insert")[0].daten).toMatchObject({ soll_monat: "2026-01" });
  });
  it("leer = null; fehlt das Feld ganz (Listen-Dialog), wird nichts überschrieben", async () => {
    const { db, mod } = await lade("@/lib/actions/buchungen");
    await fangeRedirect(() => mod.updateEinnahme("e1", fd({ prop_id: "p", kategorie: "Miete", betrag: "900", buchungsdatum: "2026-02-02", soll_monat: "" })));
    expect(ops(db, "einnahmen", "update")[0].daten).toMatchObject({ soll_monat: null });
    const { db: db2, mod: mod2 } = await lade("@/lib/actions/buchungen");
    await fangeRedirect(() => mod2.updateEinnahme("e1", fd({ prop_id: "p", kategorie: "Miete", betrag: "900", buchungsdatum: "2026-02-02" })));
    expect(ops(db2, "einnahmen", "update")[0].daten).not.toHaveProperty("soll_monat");
  });
  it("ein ungültiger Monat wird abgelehnt", async () => {
    const { db, mod } = await lade("@/lib/actions/buchungen");
    await expect(mod.createEinnahme(fd({ prop_id: "p", kategorie: "Miete", betrag: "900", buchungsdatum: "2026-02-02", soll_monat: "2026-13" }))).rejects.toThrow(/Mietmonat/);
    expect(ops(db, "einnahmen", "insert")).toHaveLength(0);
  });
  it("das Formular hat das Feld und belegt das Objekt aus dem Mieter vor", () => {
    const f = readFileSync("components/BuchungForm.tsx", "utf8");
    expect(f).toMatch(/name="soll_monat"/);
    expect(f).toMatch(/if \(t\?\.prop_id && !propId\) setPropId\(t\.prop_id\)/);
  });
});

describe("B2 — Staffel ins Mietkonto", () => {
  const STAFFEL = {
    mietart: "staffel", kaltmiete: 800, staffel_datum: "2026-01-01", staffel_intervall: "12",
    staffel_typ: "betrag", staffel_betrag: 30, staffel_prozent: null, staffel_stufen: 2,
    prop_id: "obj-1", mietbeginn: "2024-01-01", nk_vorauszahlung: 150, stellplatz_miete: null,
  };
  it("legt jede Stufe als Zeitraum an, die Felder am Mieter bleiben", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: STAFFEL, miet_zeitraeume: [] } });
    const r = await mod.uebernehmeStaffel("m1");
    expect(r).toMatchObject({ ok: true, stufen: 2 });
    const ins = ops(db, "miet_zeitraeume", "insert").flatMap((z) => (Array.isArray(z.daten) ? z.daten : [z.daten])) as Record<string, unknown>[];
    expect(ins).toEqual(expect.arrayContaining([
      expect.objectContaining({ von: "2026-01-01", kaltmiete: 830 }),
      expect.objectContaining({ von: "2027-01-01", kaltmiete: 860 }),
    ]));
    expect(ops(db, "mieter", "update")).toHaveLength(0);
  });
  it("schon übernommene Stufen werden übersprungen (zweiter Klick ändert nichts)", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", {
      antworten: { mieter: STAFFEL, miet_zeitraeume: [{ von: "2026-01-01", kaltmiete: 830 }, { von: "2027-01-01", kaltmiete: 860 }] },
    });
    expect(await mod.uebernehmeStaffel("m1")).toMatchObject({ ok: true, stufen: 0 });
    expect(db.zugriffe.filter((z) => z.op !== "select")).toHaveLength(0);
  });
  it("ohne Staffelmiete: nichts", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: { ...STAFFEL, mietart: "standard" }, miet_zeitraeume: [] } });
    expect((await mod.uebernehmeStaffel("m1")).ok).toBe(false);
    expect(db.zugriffe.filter((z) => z.op !== "select")).toHaveLength(0);
  });
});

describe("B7 — Miet-Vorlage verweist aufs Mietkonto", () => {
  it("der Hinweis erscheint bei Einnahme + Miete", () => {
    expect(readFileSync("components/WiederkehrManager.tsx", "utf8")).toMatch(/art === "einnahme" && kategorie === "Miete" && \(/);
  });
});
