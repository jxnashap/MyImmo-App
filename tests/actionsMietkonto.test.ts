import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// lib/actions/mietkonto.ts — Mieteingänge bestätigen und nacherfassen.
//
// Hier entsteht Geld in der Buchhaltung. Jede Dublette landet unmittelbar im
// Cashflow und in der Anlage V — also in einem Dokument fürs Finanzamt. Der
// Dublettenschutz ist deshalb keine Bequemlichkeit, sondern die Kernfunktion.
//
// Drei Fehler steckten hier bereits (nur als Kommentar dokumentiert):
//   1. Schlüssel war Mieter + Zahlungsdatum. Wer am 05.07. Juni- UND Julimiete
//      nachzahlt, verlor die zweite Buchung — mit Erfolgsmeldung.
//   2. Altzeilen ohne `soll_monat` bekamen einen `d:<datum>`-Schlüssel und
//      kollidierten deshalb nie — der Schutz lief für sie ins Leere.
//   3. Die Batch-Abfrage lud ohne Eingrenzung; jenseits von `db-max-rows`
//      fehlten ältere Buchungen im Schutz.
//
// Beim Schreiben dieser Tests kam ein VIERTER Fehler dazu (04.09.2026):
// Die Obergrenze der Batch-Abfrage wurde als `${monat}-31` gebaut. Den 31.
// gibt es im Februar, April, Juni, September und November nicht — Postgres
// antwortet mit 22008 und die Abfrage liefert nichts. Behoben, siehe unten.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init: Record<string, unknown> = {}) {
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/mietkonto");
  return { db, mod };
}

function zeile(over: Record<string, unknown> = {}) {
  return {
    mieter_id: "m1",
    prop_id: "p1",
    buchungsdatum: "2025-07-05",
    betrag: 850,
    nk_anteil: 150,
    soll_monat: "2025-07",
    ...over,
  };
}

function geschrieben(db: { zugriffe: { op: string; daten?: unknown }[] }) {
  const z = db.zugriffe.find((x) => x.op === "insert");
  return z?.daten as Record<string, unknown> | Record<string, unknown>[] | undefined;
}

describe("Einzelbuchung: der Miet-Monat ist der Schlüssel, nicht das Datum", () => {
  it("zwei Monate am selben Tag nachgezahlt = zwei Buchungen", async () => {
    // Der Fehler von damals: Juni war gebucht, Juli wurde am selben Datum
    // stillschweigend verworfen — und das Geld fehlte in der Anlage V.
    const { db, mod } = await lade({
      antworten: { einnahmen: [{ buchungsdatum: "2025-07-05", soll_monat: "2025-06" }] },
    });
    const r = await mod.bestaetigeMieteingang(zeile() as never);
    expect(r.ok).toBe(true);
    expect(geschrieben(db)).toMatchObject({ soll_monat: "2025-07", betrag: 850 });
  });

  it("derselbe Miet-Monat zweimal wird übersprungen — ohne Erfolgsmeldung", async () => {
    const { db, mod } = await lade({
      antworten: { einnahmen: [{ buchungsdatum: "2025-07-01", soll_monat: "2025-07" }] },
    });
    const r = await mod.bestaetigeMieteingang(zeile() as never);
    expect(r.ok).toBe(false);
    expect(r.uebersprungen).toBe(true);
    expect(r.error).toContain("2025-07");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("eine Altzeile OHNE soll_monat schützt trotzdem", async () => {
    // Fehler 2: Altzeilen bekamen einen `d:<datum>`-Schlüssel und kollidierten
    // deshalb nie. Jetzt wird ihr Monat aus dem Buchungsdatum abgeleitet.
    const { db, mod } = await lade({
      antworten: { einnahmen: [{ buchungsdatum: "2025-07-31", soll_monat: null }] },
    });
    const r = await mod.bestaetigeMieteingang(zeile() as never);
    expect(r.uebersprungen).toBe(true);
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("Betrag ≤ 0 oder unbrauchbares Datum werden abgewiesen", async () => {
    const { db, mod } = await lade();
    expect((await mod.bestaetigeMieteingang(zeile({ betrag: 0 }) as never)).ok).toBe(false);
    expect((await mod.bestaetigeMieteingang(zeile({ betrag: -5 }) as never)).ok).toBe(false);
    expect((await mod.bestaetigeMieteingang(zeile({ buchungsdatum: "05.07.2025" }) as never)).ok).toBe(false);
    expect((await mod.bestaetigeMieteingang(zeile({ buchungsdatum: "2025-7-5" }) as never)).ok).toBe(false);
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("ein unbrauchbarer soll_monat wird zu null, nicht übernommen", async () => {
    const { db, mod } = await lade();
    await mod.bestaetigeMieteingang(zeile({ soll_monat: "Juli 2025" }) as never);
    expect(geschrieben(db)).toMatchObject({ soll_monat: null });
  });

  it("die user_id kommt aus der Sitzung", async () => {
    const { db, mod } = await lade();
    await mod.bestaetigeMieteingang(zeile() as never);
    expect(geschrieben(db)).toMatchObject({ user_id: "nutzer-1", kategorie: "Miete" });
  });
});

describe("Nacherfassung: die Abfragegrenzen müssen echte Daten sein", () => {
  /** Alle Filter aller Zugriffe, flach. */
  function filter(db: { zugriffe: { filter: string[] }[] }) {
    return db.zugriffe.flatMap((z) => z.filter);
  }

  it("die Obergrenze ist ein GÜLTIGES Datum — auch im Februar", async () => {
    // DER FEHLER: `${monat}-31` ergab für Februar den 31.02. PostgREST castet
    // auf `date`, Postgres antwortet 22008, die Abfrage liefert nichts — und
    // der Dublettenschutz fällt aus. Hier gegen die Produktionsdatenbank
    // nachgestellt worden, nicht vermutet.
    const { db, mod } = await lade();
    await mod.bestaetigeMehrere([
      zeile({ buchungsdatum: "2025-02-03", soll_monat: "2025-02" }),
    ] as never);
    for (const f of filter(db)) {
      const datum = f.split("=")[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datum ?? "")) continue;
      // Ein Datum, das JavaScript nicht zurückgibt, akzeptiert Postgres auch nicht.
      expect(new Date(datum).toISOString().slice(0, 10)).toBe(datum);
    }
  });

  it("für JEDEN Monat entsteht eine gültige Grenze", async () => {
    // Betroffen waren Februar, April, Juni, September und November — also
    // fünf von zwölf. Deshalb hier alle zwölf.
    for (let m = 1; m <= 12; m++) {
      vi.resetModules();
      const ym = `2025-${String(m).padStart(2, "0")}`;
      const { db, mod } = await lade();
      await mod.bestaetigeMehrere([
        zeile({ buchungsdatum: `${ym}-02`, soll_monat: ym }),
      ] as never);
      const grenzen = filter(db)
        .filter((f) => f.startsWith("lt:buchungsdatum=") || f.startsWith("gte:buchungsdatum="))
        .map((f) => f.split("=")[1]);
      expect(grenzen.length).toBeGreaterThan(0);
      for (const g of grenzen) expect(new Date(g).toISOString().slice(0, 10)).toBe(g);
    }
  });

  it("die Obergrenze ist exklusiv (erster Tag des Folgemonats)", async () => {
    const { db, mod } = await lade();
    await mod.bestaetigeMehrere([zeile({ buchungsdatum: "2025-07-05", soll_monat: "2025-07" })] as never);
    expect(filter(db)).toContain("lt:buchungsdatum=2025-08-01");
    expect(filter(db)).toContain("gte:buchungsdatum=2025-07-01");
  });

  it("Dezember rollt ins Folgejahr", async () => {
    const { db, mod } = await lade();
    await mod.bestaetigeMehrere([zeile({ buchungsdatum: "2025-12-05", soll_monat: "2025-12" })] as never);
    expect(filter(db)).toContain("lt:buchungsdatum=2026-01-01");
  });
});

describe("Nacherfassung: was gebucht wird und was nicht", () => {
  it("scheitert die Dublettenprüfung, wird NICHTS gebucht", async () => {
    // Lieber ein zweiter Anlauf als doppelte Mieteinnahmen in der Anlage V.
    const { db, mod } = await lade({ fehler: { message: "22008" } });
    const r = await mod.bestaetigeMehrere([zeile()] as never);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("nichts angelegt");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("Dubletten INNERHALB der Auswahl werden nur einmal gebucht", async () => {
    const { db, mod } = await lade();
    const r = await mod.bestaetigeMehrere([zeile(), zeile(), zeile()] as never);
    expect(r.anzahl).toBe(1);
    expect((geschrieben(db) as unknown[]).length).toBe(1);
  });

  it("verschiedene Monate desselben Mieters sind keine Dubletten", async () => {
    const { mod } = await lade();
    const r = await mod.bestaetigeMehrere([
      zeile({ soll_monat: "2025-06", buchungsdatum: "2025-07-05" }),
      zeile({ soll_monat: "2025-07", buchungsdatum: "2025-07-05" }),
    ] as never);
    expect(r.anzahl).toBe(2);
  });

  it("ungültige Zeilen werden aussortiert, gültige gebucht", async () => {
    const { mod } = await lade();
    const r = await mod.bestaetigeMehrere([
      zeile(),
      zeile({ betrag: 0, soll_monat: "2025-08" }),
      zeile({ mieter_id: "", soll_monat: "2025-09" }),
      zeile({ buchungsdatum: "kaputt", soll_monat: "2025-10" }),
    ] as never);
    expect(r.anzahl).toBe(1);
  });

  it("gar nichts Gültiges: Fehler statt leerem Erfolg", async () => {
    const { db, mod } = await lade();
    const r = await mod.bestaetigeMehrere([zeile({ betrag: -1 })] as never);
    expect(r.ok).toBe(false);
    expect(db.zugriffe).toEqual([]); // nicht einmal gelesen
  });

  it("über 600 Zeilen werden abgelehnt", async () => {
    const { mod } = await lade();
    const viele = Array.from({ length: 601 }, (_, i) => zeile({ mieter_id: `m${i}` }));
    expect((await mod.bestaetigeMehrere(viele as never)).ok).toBe(false);
  });

  it("alles schon gebucht: ok mit Anzahl 0, kein Insert", async () => {
    const { db, mod } = await lade({
      antworten: { einnahmen: [{ mieter_id: "m1", buchungsdatum: "2025-07-05", soll_monat: "2025-07" }] },
    });
    const r = await mod.bestaetigeMehrere([zeile()] as never);
    expect(r).toEqual({ ok: true, anzahl: 0 });
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("gelesen wird nur für die betroffenen Mieter", async () => {
    const { db, mod } = await lade();
    await mod.bestaetigeMehrere([zeile(), zeile({ mieter_id: "m2", soll_monat: "2025-08" })] as never);
    expect(db.zugriffe.flatMap((z) => z.filter).some((f) => f.startsWith("in:mieter_id"))).toBe(true);
  });
});
