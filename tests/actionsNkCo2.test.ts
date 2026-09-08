import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/nkco2.ts — CO₂-Kostenaufteilung nach CO2KostAufG.
//
// Zwei Wege in echte Zahlen: Der Mieteranteil landet in der NK-Abrechnung des
// Mieters, der Vermieteranteil als Kosten-Buchung in den Werbungskosten und
// damit in der Anlage V.
//
// FUND BEIM SCHREIBEN DIESER TESTS (08.09.2026): Die Dublettenprüfung vor der
// Kosten-Buchung wertete den Abfragefehler nicht aus. Eine fehlgeschlagene
// Abfrage kommt LEER zurück — das sieht aus wie „für dieses Jahr noch nicht
// gebucht", und der Vermieteranteil wäre ein zweites Mal in der Anlage V
// gelandet. Derselbe Fehler wie in `mietkonto.ts`, dritte Fundstelle.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/nkco2");
  return { db, spuren, mod };
}

const schrieb = (
  db: { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown> }[] },
  tabelle: string,
) => [...db.zugriffe].reverse().find((x) => x.tabelle === tabelle && x.daten)?.daten;

describe("CO₂-Eingaben speichern", () => {
  it("das Abrechnungsjahr muss plausibel sein", async () => {
    for (const jahr of [1999, 2101, 2026.5, Number.NaN]) {
      const { db, mod } = await lade();
      const r = await mod.speichereNkCo2("m1", jahr, fd({ co2_kg: "1200" }));
      expect(r.ok, String(jahr)).toBe(false);
      expect(db.zugriffe.some((x) => x.op === "upsert"), String(jahr)).toBe(false);
    }
  });

  it("Zahlen werden gelesen, Leerfelder bleiben null", async () => {
    const { db, mod } = await lade();
    await mod.speichereNkCo2("m1", 2026, fd({ co2_kg: "1234,5", co2_kosten: "", flaeche: "72" }));
    expect(schrieb(db, "nk_co2")).toMatchObject({
      user_id: "nutzer-1", mieter_id: "m1", jahr: 2026,
      co2_kg: 1234.5, co2_kosten: null, flaeche: 72, gewerbe: false,
    });
  });

  it("negative Werte werden verworfen statt gespeichert", async () => {
    // Eine negative CO₂-Menge würde eine negative Kostenaufteilung ergeben.
    const { db, mod } = await lade();
    await mod.speichereNkCo2("m1", 2026, fd({ co2_kg: "-5", flaeche: "-1" }));
    expect(schrieb(db, "nk_co2")).toMatchObject({ co2_kg: null, flaeche: null });
  });

  it("der Gewerbe-Haken wird übernommen (50/50 nach § 8 CO2KostAufG)", async () => {
    const { db, mod } = await lade();
    await mod.speichereNkCo2("m1", 2026, fd({ co2_kg: "1000", flaeche: "50", gewerbe: "on" }));
    expect(schrieb(db, "nk_co2")!.gewerbe).toBe(true);
  });

  it("ein Speicherfehler wird gemeldet, nicht verschluckt", async () => {
    const { mod } = await lade({ fehlerBei: { nk_co2: { message: "boom" } } });
    const r = await mod.speichereNkCo2("m1", 2026, fd({ co2_kg: "1000" }));
    expect(r).toEqual({ ok: false, error: "Speichern fehlgeschlagen." });
  });
});

describe("Vermieteranteil buchen", () => {
  const daten = { co2_kg: 2400, co2_kosten: 300, flaeche: 80, gewerbe: false };
  const mieter = { vorname: "Anna", nachname: "Muster", prop_id: "obj-1" };

  function aufbau(extra: Parameters<typeof fakeSupabase>[0] = {}) {
    return lade({
      antworten: { nk_co2: daten, mieter },
      antwortFolge: { "kosten:select": [null] },
      ...extra,
    });
  }

  it("ohne CO₂-Menge oder Fläche wird nicht gebucht", async () => {
    for (const row of [{ ...daten, co2_kg: 0 }, { ...daten, flaeche: 0 }]) {
      const { db, mod } = await lade({ antworten: { nk_co2: row, mieter } });
      const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
      expect(r.ok).toBe(false);
      expect(db.zugriffe.some((x) => x.tabelle === "kosten" && x.op === "insert")).toBe(false);
    }
  });

  it("bucht den Vermieteranteil der richtigen Stufe", async () => {
    // 2400 kg / 80 m² = 30 kg/m² → Stufe 27–32 → Vermieter 40 % → 120,00 €.
    const { db, mod } = await aufbau();
    const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
    expect(r).toMatchObject({ ok: true, betrag: 120 });
    const k = schrieb(db, "kosten")!;
    expect(k).toMatchObject({
      user_id: "nutzer-1", prop_id: "obj-1", mieter_id: "m1",
      buchungsdatum: "2026-12-31", betrag: 120,
    });
    expect(String(k.beschreibung)).toContain("Anna Muster");
    expect(String(k.beschreibung)).toContain("40 %");
  });

  it("ein Gewerbemieter teilt 50/50, unabhängig vom Ausstoß", async () => {
    const { mod } = await lade({
      antworten: { nk_co2: { ...daten, gewerbe: true }, mieter },
      antwortFolge: { "kosten:select": [null] },
    });
    const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
    expect(r.betrag).toBe(150);
  });

  it("ist für das Jahr schon gebucht, passiert nichts", async () => {
    const { db, mod } = await lade({
      antworten: { nk_co2: daten, mieter },
      antwortFolge: { "kosten:select": [[{ id: "k1" }]] },
    });
    const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
    expect(r.ok).toBe(false);
    expect(String(r.error)).toMatch(/bereits gebucht/);
    expect(db.zugriffe.some((x) => x.tabelle === "kosten" && x.op === "insert")).toBe(false);
  });

  it("scheitert die Dublettenprüfung, wird NICHT gebucht", async () => {
    // DER FUND. Vorher kam die fehlgeschlagene Abfrage leer zurück, das galt
    // als „noch nicht gebucht" — und der Betrag landete ein zweites Mal in den
    // Werbungskosten.
    const { db, mod } = await lade({
      antworten: { nk_co2: daten, mieter },
      fehlerBei: { "kosten:select": { message: "connection reset" } },
    });
    const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
    expect(r.ok).toBe(false);
    expect(String(r.error)).toMatch(/geprüft|nichts gebucht/i);
    expect(db.zugriffe.some((x) => x.tabelle === "kosten" && x.op === "insert")).toBe(false);
  });

  it("ein Vermieteranteil von 0 € wird nicht gebucht", async () => {
    // Unter 12 kg/m² trägt der Mieter alles — eine 0-€-Buchung wäre nur Müll
    // in den Werbungskosten.
    const { db, mod } = await lade({
      antworten: { nk_co2: { co2_kg: 800, co2_kosten: 100, flaeche: 80, gewerbe: false }, mieter },
    });
    const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
    expect(r.ok).toBe(false);
    expect(String(r.error)).toMatch(/0 €/);
    expect(db.zugriffe.some((x) => x.tabelle === "kosten" && x.op === "insert")).toBe(false);
  });

  it("ohne gespeicherte Daten oder ohne Mieter wird abgebrochen", async () => {
    for (const antworten of [{ mieter }, { nk_co2: daten }]) {
      const { db, mod } = await lade({ antworten });
      const r = await mod.bucheCo2Vermieteranteil("m1", 2026);
      expect(r.ok).toBe(false);
      expect(db.zugriffe.some((x) => x.tabelle === "kosten" && x.op === "insert")).toBe(false);
    }
  });
});

describe("CO₂-Eingaben löschen", () => {
  it("löscht genau Mieter und Jahr", async () => {
    const { db, mod } = await lade();
    const r = await mod.loescheNkCo2("m1", 2026);
    expect(r).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "nk_co2" && x.op === "delete")!;
    expect(z.filter).toContain("eq:mieter_id=m1");
    expect(z.filter).toContain("eq:jahr=2026");
  });

  it("ein Fehler wird gemeldet", async () => {
    const { mod } = await lade({ fehlerBei: { nk_co2: { message: "boom" } } });
    expect(await mod.loescheNkCo2("m1", 2026)).toEqual({ ok: false, error: "Löschen fehlgeschlagen." });
  });
});
