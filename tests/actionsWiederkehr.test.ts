import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

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

describe("Buchungen erzeugen: der Dedup ist die Kernfunktion", () => {
  it("vier Monate ergeben vier Buchungen — in der richtigen Tabelle", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "wiederkehrende_buchungen:select": [vorlage()], "kosten:select": [[]] },
    });
    const r = await mod.erzeugeBuchungen("v1");
    expect(r.ok).toBe(true);
    expect(r.anzahl).toBe(4); // Januar bis April
    const zeilen = insertZeilen(db, "kosten");
    expect(zeilen).toHaveLength(4);
    expect(zeilen[0]).toMatchObject({ wiederkehr_id: "v1", betrag: 250, user_id: "nutzer-1" });
  });

  it("ein zweiter Klick erzeugt NICHTS mehr", async () => {
    // Der eigentliche Schutz: Wer zweimal drückt, bekommt keine zehn Jahre
    // doppelter Buchungen.
    const { db, mod } = await lade({
      antwortFolge: {
        "wiederkehrende_buchungen:select": [vorlage()],
        "kosten:select": [
          [
            { buchungsdatum: "2025-01-01" },
            { buchungsdatum: "2025-02-01" },
            { buchungsdatum: "2025-03-01" },
            { buchungsdatum: "2025-04-01" },
          ],
        ],
      },
    });
    const r = await mod.erzeugeBuchungen("v1");
    expect(r).toEqual({ ok: true, anzahl: 0 });
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("teilweise erzeugt: nur die Lücken werden gefüllt", async () => {
    const { mod } = await lade({
      antwortFolge: {
        "wiederkehrende_buchungen:select": [vorlage()],
        "kosten:select": [[{ buchungsdatum: "2025-01-01" }, { buchungsdatum: "2025-03-01" }]],
      },
    });
    expect((await mod.erzeugeBuchungen("v1")).anzahl).toBe(2);
  });

  it("der Dedup fragt gezielt nach dieser Vorlage", async () => {
    // Ohne `wiederkehr_id`-Filter würden fremde Buchungen mitgezählt oder
    // umgekehrt gar keine gefunden.
    const { db, mod } = await lade({
      antwortFolge: { "wiederkehrende_buchungen:select": [vorlage()], "kosten:select": [[]] },
    });
    await mod.erzeugeBuchungen("v1");
    const abfrage = db.zugriffe.find((z) => z.tabelle === "kosten" && z.op === "select");
    expect(abfrage?.filter).toContain("eq:wiederkehr_id=v1");
  });

  it("eine fremde Vorlage wird nicht gefunden", async () => {
    const { db, mod } = await lade({ antworten: { wiederkehrende_buchungen: null } });
    const r = await mod.erzeugeBuchungen("fremd");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("nicht gefunden");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
    // Und die Vorlagen-Abfrage war auf das eigene Konto eingeschränkt.
    expect(db.zugriffe[0]?.filter).toContain("eq:user_id=nutzer-1");
  });

  it("Einnahmen-Vorlagen schreiben in die Einnahmen-Tabelle", async () => {
    const { db, mod } = await lade({
      antwortFolge: {
        "wiederkehrende_buchungen:select": [vorlage({ art: "einnahme", kategorie: "Miete" })],
        "einnahmen:select": [[]],
      },
    });
    await mod.erzeugeBuchungen("v1");
    expect(insertZeilen(db, "einnahmen")).toHaveLength(4);
    expect(db.zugriffe.some((z) => z.tabelle === "kosten")).toBe(false);
  });

  it("ohne eigene Beschreibung entsteht eine sprechende", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "wiederkehrende_buchungen:select": [vorlage()], "kosten:select": [[]] },
    });
    await mod.erzeugeBuchungen("v1");
    expect(insertZeilen(db, "kosten")[0]).toMatchObject({ beschreibung: "Hausgeld (wiederkehrend)" });
  });
});
