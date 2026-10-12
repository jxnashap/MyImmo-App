import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";

// lib/actions/wiederkehr.ts — Vorlagen für wiederkehrende Buchungen und das
// Erzeugen der einzelnen Buchungen daraus (rückwirkend bis 10 Jahre).
//
// Die Datei ist bewusst NICHT vollautomatisch — der Nutzer stößt das Erzeugen
// an. Genau deshalb ist der Dedup entscheidend: Wer zweimal auf den Knopf
// drückt, darf nicht zehn Jahre Buchungen doppelt bekommen. Und der Betrag
// landet unmittelbar in Cashflow und Steuerauswertung.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/wiederkehr");
  return { db, mod };
}

function insertZeilen(db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }, tabelle?: string) {
  const z = db.zugriffe.find((x) => x.op === "insert" && (!tabelle || x.tabelle === tabelle));
  if (!z?.daten) return [];
  return (Array.isArray(z.daten) ? z.daten : [z.daten]) as Record<string, unknown>[];
}

function vorlage(over: Record<string, unknown> = {}) {
  return {
    id: "v1",
    art: "kosten",
    prop_id: "p1",
    mieter_id: null,
    kategorie: "Hausgeld",
    betrag: 250,
    beschreibung: null,
    zyklus: "monatlich",
    start_datum: "2025-01-01",
    ende_datum: "2025-04-30",
    aktiv: true,
    ...over,
  };
}

describe("Vorlage anlegen: was abgewiesen wird", () => {
  const gut = { kategorie: "Hausgeld", betrag: "250", zyklus: "monatlich", start_datum: "2025-01-01" };

  it("eine gültige Vorlage wird angelegt", async () => {
    const { db, mod } = await lade();
    expect((await mod.createVorlage(fd(gut))).ok).toBe(true);
    expect(insertZeilen(db)[0]).toMatchObject({
      kategorie: "Hausgeld",
      betrag: 250,
      art: "kosten",
      aktiv: true,
      user_id: "nutzer-1",
    });
  });

  it("ohne Kategorie, ohne Betrag oder mit Betrag ≤ 0: nichts wird gespeichert", async () => {
    for (const kaputt of [
      { ...gut, kategorie: "" },
      { ...gut, kategorie: "   " },
      { ...gut, betrag: "0" },
      { ...gut, betrag: "-10" },
      { ...gut, betrag: "" },
    ]) {
      vi.resetModules();
      const { db, mod } = await lade();
      expect((await mod.createVorlage(fd(kaputt))).ok).toBe(false);
      expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
    }
  });

  it("ein unbekannter Zyklus wird abgewiesen, nicht stillschweigend ersetzt", async () => {
    // Ein Freitext-Zyklus liefe in `faelligeDaten` in einen unbekannten Zweig —
    // im schlimmsten Fall in eine Endlosreihe von Terminen.
    const { db, mod } = await lade();
    const r = await mod.createVorlage(fd({ ...gut, zyklus: "alle-3-tage" }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Zyklus");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("ein unbrauchbares Startdatum wird abgewiesen", async () => {
    for (const s of ["01.01.2025", "2025-1-1", "morgen", ""]) {
      vi.resetModules();
      const { db, mod } = await lade();
      expect((await mod.createVorlage(fd({ ...gut, start_datum: s }))).ok).toBe(false);
      expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
    }
  });

  it("ein Ende VOR dem Start wird abgewiesen", async () => {
    const { mod } = await lade();
    const r = await mod.createVorlage(fd({ ...gut, ende_datum: "2024-12-31" }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("vor dem Start");
  });

  it("Ende gleich Start ist erlaubt (eine einzelne Buchung)", async () => {
    const { mod } = await lade();
    expect((await mod.createVorlage(fd({ ...gut, ende_datum: "2025-01-01" }))).ok).toBe(true);
  });

  it("die Art ist auf einnahme/kosten begrenzt", async () => {
    const { db, mod } = await lade();
    await mod.createVorlage(fd({ ...gut, art: "spende" }));
    expect(insertZeilen(db)[0]).toMatchObject({ art: "kosten" }); // Rückfall, kein Freitext
  });
});

describe("Vorlagen ändern und löschen bleiben beim eigenen Konto", () => {
  it("Aktiv-Schalter filtert auf id UND user_id", async () => {
    const { db, mod } = await lade();
    await mod.setVorlageAktiv("v1", false);
    const upd = db.zugriffe.find((z) => z.op === "update");
    expect(upd?.daten).toEqual({ aktiv: false });
    expect(upd?.filter).toContain("eq:id=v1");
    expect(upd?.filter).toContain("eq:user_id=nutzer-1");
  });

  it("Löschen filtert ebenfalls auf beides", async () => {
    const { db, mod } = await lade();
    await mod.deleteVorlage("v1");
    const del = db.zugriffe.find((z) => z.op === "delete");
    expect(del?.filter).toContain("eq:id=v1");
    expect(del?.filter).toContain("eq:user_id=nutzer-1");
  });
});

// Ab hier gegen `speicherDb` (B07, 11.10.2026): Der Schutz ist die UNIQUE-Regel
// (wiederkehr_id, buchungsdatum) — die Attrappe setzt sie wie Postgres durch, und gleichzeitige
// Aufrufe verzahnen sich an jedem `await`.
async function ladeSpeicher(init: { vorlagen?: Record<string, unknown>[]; kosten?: Record<string, unknown>[]; einnahmen?: Record<string, unknown>[]; fehlerBei?: Record<string, string>; fehlerAbSeite?: Record<string, number> } = {}) {
  vi.resetModules();
  const db = speicherDb({
    tabellen: {
      wiederkehrende_buchungen: init.vorlagen ?? [{ ...vorlage(), user_id: "nutzer-1" }],
      kosten: init.kosten ?? [],
      einnahmen: init.einnahmen ?? [],
    },
    eindeutig: { kosten: [["wiederkehr_id", "buchungsdatum"]], einnahmen: [["wiederkehr_id", "buchungsdatum"]] },
    fehlerBei: init.fehlerBei,
    fehlerAbSeite: init.fehlerAbSeite,
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/wiederkehr");
  return { db, mod };
}
const erzeugt = (n: number) => ({ user_id: "nutzer-1", wiederkehr_id: "v1", buchungsdatum: `2025-0${n}-01`, betrag: 250 });

describe("Buchungen erzeugen: der Dedup ist die Kernfunktion", () => {
  it("vier Monate ergeben vier Buchungen — in der richtigen Tabelle", async () => {
    const { db, mod } = await ladeSpeicher();
    expect(await mod.erzeugeBuchungen("v1")).toEqual({ ok: true, anzahl: 4 }); // Januar bis April
    expect(db.tabellen.kosten.map((r) => r.buchungsdatum)).toEqual(["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01"]);
    expect(db.tabellen.kosten[0]).toMatchObject({ wiederkehr_id: "v1", betrag: 250, user_id: "nutzer-1", prop_id: "p1" });
  });

  it("ein zweiter Klick erzeugt NICHTS mehr", async () => {
    const { db, mod } = await ladeSpeicher();
    await mod.erzeugeBuchungen("v1");
    expect(await mod.erzeugeBuchungen("v1")).toEqual({ ok: true, anzahl: 0 });
    expect(db.tabellen.kosten).toHaveLength(4);
  });

  it("zwei GLEICHZEITIGE Klicks (zwei Tabs) erzeugen jede Buchung genau einmal", async () => {
    const { db, mod } = await ladeSpeicher();
    const [a, b] = await Promise.all([mod.erzeugeBuchungen("v1"), mod.erzeugeBuchungen("v1")]);
    expect(db.tabellen.kosten).toHaveLength(4);
    // Gemeldet wird, was wirklich neu ist — zusammen vier, nicht acht. Und keiner meldet einen Fehler.
    expect(a.anzahl + b.anzahl).toBe(4);
    expect(a.ok && b.ok).toBe(true);
  });

  it("teilweise erzeugt: nur die Lücken werden gefüllt — auch eine gelöschte Buchung in der Mitte", async () => {
    // Die alte Zählregel legte hier den LETZTEN Termin doppelt an und ließ den Februar leer.
    const { db, mod } = await ladeSpeicher({ kosten: [erzeugt(1), erzeugt(3)] });
    expect((await mod.erzeugeBuchungen("v1")).anzahl).toBe(2);
    expect(db.tabellen.kosten.map((r) => r.buchungsdatum).sort()).toEqual(["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01"]);
  });

  it("eine auf den Zufluss UMDATIERTE Buchung deckt ihren Termin — kein zweiter Januar", async () => {
    const { db, mod } = await ladeSpeicher({ kosten: [{ ...erzeugt(1), buchungsdatum: "2025-01-04" }] });
    expect((await mod.erzeugeBuchungen("v1")).anzahl).toBe(3);
    expect(db.tabellen.kosten.map((r) => r.buchungsdatum).sort()).toEqual(["2025-01-04", "2025-02-01", "2025-03-01", "2025-04-01"]);
  });

  it("der Dedup fragt gezielt nach dieser Vorlage — und nur im eigenen Konto", async () => {
    const { db, mod } = await ladeSpeicher();
    await mod.erzeugeBuchungen("v1");
    const abfrage = db.protokoll.find((z) => z.tabelle === "kosten" && z.op === "select");
    expect(abfrage?.filter).toEqual(expect.arrayContaining(["eq:wiederkehr_id=v1", "eq:user_id=nutzer-1"]));
  });

  it("über 1.000 vorhandene Buchungen werden vollständig gelesen (geblättert)", async () => {
    // Eine wöchentliche Vorlage über zehn Jahre hat > 500 Termine; ohne Blättern fehlten ältere im Dedup.
    const viele = Array.from({ length: 1200 }, (_, i) => ({ id: `k${String(i).padStart(5, "0")}`, user_id: "nutzer-1", wiederkehr_id: "v1", buchungsdatum: `1990-01-${String((i % 28) + 1).padStart(2, "0")}` }));
    const { db, mod } = await ladeSpeicher({ kosten: [...viele, { ...erzeugt(1), id: "zz1" }, { ...erzeugt(2), id: "zz2" }, { ...erzeugt(3), id: "zz3" }, { ...erzeugt(4), id: "zz4" }] });
    expect(await mod.erzeugeBuchungen("v1")).toEqual({ ok: true, anzahl: 0 });
    expect(db.protokoll.filter((z) => z.tabelle === "kosten" && z.op === "select").length).toBeGreaterThan(1);
  });

  it("eine fremde Vorlage wird nicht gefunden", async () => {
    const { db, mod } = await ladeSpeicher({ vorlagen: [{ ...vorlage({ id: "fremd" }), user_id: "anderer" }] });
    const r = await mod.erzeugeBuchungen("fremd");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("nicht gefunden");
    expect(db.tabellen.kosten).toHaveLength(0);
  });

  it("Einnahmen-Vorlagen schreiben in die Einnahmen-Tabelle", async () => {
    const { db, mod } = await ladeSpeicher({ vorlagen: [{ ...vorlage({ art: "einnahme", kategorie: "Miete" }), user_id: "nutzer-1" }] });
    await mod.erzeugeBuchungen("v1");
    expect(db.tabellen.einnahmen).toHaveLength(4);
    expect(db.protokoll.some((z) => z.tabelle === "kosten")).toBe(false);
  });

  it("ohne eigene Beschreibung entsteht eine sprechende", async () => {
    const { db, mod } = await ladeSpeicher();
    await mod.erzeugeBuchungen("v1");
    expect(db.tabellen.kosten[0]).toMatchObject({ beschreibung: "Hausgeld (wiederkehrend)" });
  });

  it("scheitert das Schreiben, gibt es keinen Erfolg", async () => {
    const { mod } = await ladeSpeicher({ fehlerBei: { "kosten:upsert": "timeout" } });
    expect(await mod.erzeugeBuchungen("v1")).toEqual({ ok: false, anzahl: 0, error: "Erzeugen fehlgeschlagen." });
  });

  it("scheitert das Lesen der Vorlage, wird nichts angelegt", async () => {
    const { db, mod } = await ladeSpeicher({ fehlerBei: { "wiederkehrende_buchungen:select": "reset" } });
    expect((await mod.erzeugeBuchungen("v1")).ok).toBe(false);
    expect(db.tabellen.kosten).toHaveLength(0);
  });
});

describe("Dedup-Abfrage der Vorlage", () => {
  it("scheitert sie — auch erst auf einer späteren Seite —, wird KEINE Buchung erzeugt", async () => {
    // Käme die Abfrage wegen eines Fehlers leer zurück, gälte jeder fällige
    // Termin als offen — die Vorlage legte ihre gesamten Buchungen ein zweites Mal an.
    const { db, mod } = await ladeSpeicher({
      vorlagen: [{ ...vorlage({ art: "einnahme", kategorie: "Miete", mieter_id: "m1" }), user_id: "nutzer-1" }],
      fehlerAbSeite: { einnahmen: 0 },
    });
    const r = await mod.erzeugeBuchungen("v1");
    expect(r.ok).toBe(false);
    expect(String(r.error)).toMatch(/geprüft/);
    expect(db.tabellen.einnahmen).toHaveLength(0);
  });
});

describe("offeneDaten: genau, dann der nächste Termin", () => {
  const faellig = ["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01"];
  it("gleiche Daten decken genau ihren Termin", async () => {
    const { offeneDaten } = await import("@/lib/wiederkehr");
    expect(offeneDaten(faellig, ["2025-01-01", "2025-03-01"])).toEqual(["2025-02-01", "2025-04-01"]);
  });
  it("umdatierte Buchungen decken den zeitlich nächsten offenen Termin (auch vor dem Termin)", async () => {
    const { offeneDaten } = await import("@/lib/wiederkehr");
    expect(offeneDaten(faellig, ["2025-02-05", "2025-02-27"])).toEqual(["2025-01-01", "2025-04-01"]);
  });
  it("n Buchungen decken höchstens n Termine — auch doppelte Altbuchungen", async () => {
    const { offeneDaten } = await import("@/lib/wiederkehr");
    expect(offeneDaten(faellig, ["2025-01-01", "2025-01-01"])).toEqual(["2025-03-01", "2025-04-01"]);
    expect(offeneDaten(faellig, [null, "kaputt"])).toEqual(faellig);
  });
});
