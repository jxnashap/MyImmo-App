import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// lib/actions/einschaetzung.ts (Marktwert-Einschätzungen im Verkauf-Assistenten)
// und lib/actions/kalkulation.ts (gespeicherte Kalkulationen im Cockpit).
//
// Kein Fund, zwei Nachbesserungen: `user_id`-Filter beim Löschen/Übernehmen,
// und `error.message` geht nicht mehr an den Client (Postgres-Fehlertexte
// nennen Tabellen- und Spaltennamen).

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, spuren, mod };
}

type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const zugriff = (db: Db, tabelle: string, op: string) => db.zugriffe.find((z) => z.tabelle === tabelle && z.op === op);

describe("Einschätzung speichern", () => {
  const gueltig = { immobilieId: "obj-1", marktwert: 312345.67, datum: "2026-09-01", notiz: "Makler X" };

  it("Objekt, Wert > 0 und ISO-Datum sind Pflicht — nichts davon erreicht die Datenbank", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung");
    for (const e of [
      { ...gueltig, immobilieId: "" },
      { ...gueltig, marktwert: 0 },
      { ...gueltig, marktwert: -5 },
      { ...gueltig, marktwert: Number.NaN },
      { ...gueltig, datum: "01.09.2026" },
    ]) {
      expect((await mod.speichereEinschaetzung(e)).ok, JSON.stringify(e)).toBe(false);
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("der Wert wird gerundet, der Tag bleibt in jeder Zeitzone derselbe", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung", { antworten: { bewertung_historie: { id: "h1" } } });
    const r = await mod.speichereEinschaetzung(gueltig);
    expect(r).toEqual({ ok: true, id: "h1" });
    const d = zugriff(db, "bewertung_historie", "insert")!.daten!;
    expect(d.marktwert).toBe(312346);
    // Mittag UTC: Selbst UTC−11 und UTC+13 landen noch am 1. September.
    expect(d.datum).toBe("2026-09-01T12:00:00.000Z");
    expect(d.user_id).toBe("nutzer-1");
  });

  it("die Notiz wird gekappt und an die Quelle gehängt; ohne Notiz nur die Quelle", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung", { antworten: { bewertung_historie: { id: "h1" } } });
    await mod.speichereEinschaetzung({ ...gueltig, notiz: "x".repeat(500) });
    expect(String(zugriff(db, "bewertung_historie", "insert")!.daten!.quelle).length).toBeLessThan(230);
    const { db: db2, mod: mod2 } = await lade("@/lib/actions/einschaetzung", { antworten: { bewertung_historie: { id: "h1" } } });
    await mod2.speichereEinschaetzung({ ...gueltig, notiz: "  " });
    expect(String(zugriff(db2, "bewertung_historie", "insert")!.daten!.quelle)).not.toContain("·");
  });

  it("nur die zwei bekannten Verfahren — alles andere wird zur Handeingabe", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung", { antworten: { bewertung_historie: { id: "h1" } } });
    await mod.speichereEinschaetzung({ ...gueltig, verfahren: "immowertv" });
    expect(zugriff(db, "bewertung_historie", "insert")!.daten!.verfahren).toBe("immowertv");
    const { db: db2, mod: mod2 } = await lade("@/lib/actions/einschaetzung", { antworten: { bewertung_historie: { id: "h1" } } });
    await mod2.speichereEinschaetzung({ ...gueltig, verfahren: "sach" as never });
    expect(zugriff(db2, "bewertung_historie", "insert")!.daten!.verfahren).toBe("einschaetzung");
  });

  it("ein Datenbankfehler wird gemeldet — ohne Postgres-Interna", async () => {
    const { mod } = await lade("@/lib/actions/einschaetzung", { fehlerBei: { bewertung_historie: { message: 'null value in column "immobilie_id"' } } });
    const r = await mod.speichereEinschaetzung(gueltig);
    expect(r.ok).toBe(false);
    expect(String((r as { error: string }).error)).not.toContain("column");
  });
});

describe("Einschätzung löschen und übernehmen", () => {
  it("Löschen hängt am eigenen Konto", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung");
    expect(await mod.loescheEinschaetzung("h1")).toEqual({ ok: true });
    expect(zugriff(db, "bewertung_historie", "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=h1", "eq:user_id=nutzer-1"]));
  });

  it("Übernehmen setzt Wert, Marktwert und Stand — nur am eigenen Objekt", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung");
    expect(await mod.uebernehmeAlsWert("obj-1", 299999.6, "2026-09-01T12:00:00.000Z")).toEqual({ ok: true });
    const z = zugriff(db, "properties", "update")!;
    expect(z.daten).toEqual({ wert: 300000, marktwert_aktuell: 300000, marktwert_stand: "2026-09-01" });
    expect(z.filter).toEqual(expect.arrayContaining(["eq:id=obj-1", "eq:user_id=nutzer-1"]));
  });

  it("ein Wert ≤ 0 oder NaN wird nicht übernommen", async () => {
    const { db, mod } = await lade("@/lib/actions/einschaetzung");
    for (const w of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect((await mod.uebernehmeAlsWert("obj-1", w, "2026-09-01")).ok).toBe(false);
    expect(db.zugriffe).toEqual([]);
  });
});

describe("Kalkulationen", () => {
  const ZEILE = { id: "k1", name: "Test", data: {}, summary: {}, created_at: "2026-09-01" };

  it("ein leerer Name wird zu „Kalkulation“, der Rest landet am Nutzer", async () => {
    const { db, mod } = await lade("@/lib/actions/kalkulation", { antworten: { kalkulationen: ZEILE } });
    const r = await mod.saveKalkulation("   ", { kaufpreis: "250000" }, { rendite: 4.2 });
    expect(r).toEqual(ZEILE);
    expect(zugriff(db, "kalkulationen", "insert")!.daten).toEqual({
      user_id: "nutzer-1", name: "Kalkulation", data: { kaufpreis: "250000" }, summary: { rendite: 4.2 },
    });
  });

  it("Bearbeiten und Löschen hängen am eigenen Konto", async () => {
    const { db, mod } = await lade("@/lib/actions/kalkulation", { antworten: { kalkulationen: ZEILE } });
    await mod.updateKalkulation("k1", "Neu", {}, {});
    expect(zugriff(db, "kalkulationen", "update")!.filter).toEqual(expect.arrayContaining(["eq:id=k1", "eq:user_id=nutzer-1"]));
    await mod.deleteKalkulation("k1");
    expect(zugriff(db, "kalkulationen", "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=k1", "eq:user_id=nutzer-1"]));
  });

  it("ein Datenbankfehler wird geworfen", async () => {
    const { mod } = await lade("@/lib/actions/kalkulation", { fehlerBei: { kalkulationen: { message: "boom" } } });
    await expect(mod.saveKalkulation("X", {}, {})).rejects.toThrow("boom");
    await expect(mod.deleteKalkulation("k1")).rejects.toThrow("boom");
  });
});
