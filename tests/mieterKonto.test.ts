import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mieterKonto, KONTO_STATUS_TEXT } from "@/lib/mieterKonto";
import { ladePortalDaten } from "@/lib/portalDaten";

// Mietkonto für den Mieter (02.10.2026, Schritt 6). Grundlage: Buchungen des Vermieters —
// deshalb „bestätigt / noch nicht bestätigt“, nie „Rückstand“.

const M = { kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null, mietbeginn: "2025-01-01", mietende: null };
const HEUTE = "2026-10-02"; // 3. Werktag im Oktober 2026 = 05.10.

describe("Soll und Ist je Monat", () => {
  it("12 Monate, neuester zuerst; Soll = Kalt + NK", () => {
    const r = mieterKonto(M, [], [], HEUTE);
    expect(r).toHaveLength(12);
    expect(r[0].jahrMonat).toBe("2026-10");
    expect(r[11].jahrMonat).toBe("2025-11");
    expect(r.every((m) => m.soll === 950)).toBe(true);
  });
  it("bestätigt / teilweise / offen / noch nicht fällig", () => {
    const r = mieterKonto(M, [], [
      { buchungsdatum: "2026-09-01", kategorie: "Miete", betrag: 950 },
      { buchungsdatum: "2026-08-03", kategorie: "Miete", betrag: 500 },
    ], HEUTE);
    const s = Object.fromEntries(r.map((m) => [m.jahrMonat, m.status]));
    expect(s["2026-10"]).toBe("noch_nicht_faellig");
    expect(s["2026-09"]).toBe("bestaetigt");
    expect(s["2026-08"]).toBe("teilweise");
    expect(s["2026-07"]).toBe("offen");
  });
  it("Zahlung zählt im MIETmonat (soll_monat), nicht im Buchungsmonat", () => {
    const r = mieterKonto(M, [], [{ buchungsdatum: "2026-09-02", kategorie: "Miete", betrag: 950, soll_monat: "2026-08" }], HEUTE);
    const s = Object.fromEntries(r.map((m) => [m.jahrMonat, m.status]));
    expect(s["2026-08"]).toBe("bestaetigt");
    expect(s["2026-09"]).toBe("offen");
  });
  it("Miete und Nebenkosten zählen, andere Kategorien nicht", () => {
    const r = mieterKonto(M, [], [
      { buchungsdatum: "2026-09-01", kategorie: "Miete", betrag: 800 },
      { buchungsdatum: "2026-09-01", kategorie: "Nebenkosten", betrag: 150 },
      { buchungsdatum: "2026-08-01", kategorie: "Kaution", betrag: 2000 },
    ], HEUTE);
    const s = Object.fromEntries(r.map((m) => [m.jahrMonat, m.status]));
    expect(s["2026-09"]).toBe("bestaetigt");
    expect(s["2026-08"]).toBe("offen");
  });
  it("Mieterhöhung über einen Miet-Zeitraum ändert das Soll ab dem Monat", () => {
    const r = mieterKonto(M, [{ von: "2026-07-01", bis: null, kaltmiete: 900, nk_vorauszahlung: 150, stellplatz_miete: null }], [], HEUTE);
    const soll = Object.fromEntries(r.map((m) => [m.jahrMonat, m.soll]));
    expect(soll["2026-07"]).toBe(1050);
    expect(soll["2026-06"]).toBe(950);
  });
  it("vor dem Mietbeginn: keine Zeilen", () => {
    expect(mieterKonto({ ...M, mietbeginn: "2026-09-01" }, [], [], HEUTE).map((m) => m.jahrMonat)).toEqual(["2026-10", "2026-09"]);
    expect(mieterKonto({ ...M, mietbeginn: null }, [], [], HEUTE)).toEqual([]);
  });
});

describe("Wortlaut", () => {
  it("kein „Rückstand“, keine Schuld — weder in den Status-Texten noch in der Tabelle", () => {
    const tabelle = readFileSync("components/MieterKontoTabelle.tsx", "utf8").split("\n").filter((z) => !z.trim().startsWith("//")).join("\n");
    for (const t of [...Object.values(KONTO_STATUS_TEXT), tabelle]) {
      expect(t).not.toMatch(/Rückstand|schuldest|Schulden|säumig|Mahnung/i);
    }
  });
});

describe("Laden", () => {
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
  const MZ = { id: "m1", prop_id: "o1", vorname: "S", nachname: "B", kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null, mietbeginn: "2025-01-01", mietende: null };

  it("der Mieter liest die Zeiträume über die SICHT, nie über die Tabelle", async () => {
    const { db, abfragen } = fakeDb({ mieter_portal: [MZ], mieter_zugaenge: [{ mieter_id: "m1", prop_id: "o1" }] });
    const d = await ladePortalDaten(db, { art: "mieter", mieterUserId: "konto-m" });
    expect(abfragen.some((a) => a.tabelle === "miet_zeitraeume")).toBe(false);
    expect(abfragen.some((a) => a.tabelle === "miet_zeitraeume_portal")).toBe(true);
    expect(d.konto.m1?.length).toBeGreaterThan(0);
  });
  it("die Vorschau des Vermieters liest die eigene Tabelle, auf ihn gefiltert", async () => {
    const { db, abfragen } = fakeDb({ mieter: MZ, properties: { id: "o1", bezeichnung: "A", adresse: "X" }, mieter_zugaenge: { user_id: "konto-m" } });
    await ladePortalDaten(db, { art: "vermieter", vermieterId: "v-1", mieterId: "m1" });
    const z = abfragen.find((a) => a.tabelle === "miet_zeitraeume")!;
    expect(z.filter).toContain(`eq:user_id="v-1"`);
    expect(abfragen.some((a) => a.tabelle === "miet_zeitraeume_portal")).toBe(false);
  });
});
