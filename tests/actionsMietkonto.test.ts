import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockeNextUndSupabase } from "./stubs/actionHarness";
import { speicherDb, type SpeicherDbInit } from "./stubs/speicherDb";

// lib/actions/mietkonto.ts — Mieteingänge bestätigen, nacherfassen, aus dem Kontoauszug buchen.
//
// Hier entsteht Geld in der Buchhaltung. Jede Dublette landet unmittelbar im Cashflow und in der
// Anlage V. Seit dem Prüfstand 11.10.2026 (B07/B09/B10) läuft der Schutz NICHT mehr über „erst lesen,
// dann schreiben“ — das ließ zwei gleichzeitige Aufrufe beide buchen —, sondern über eine
// Zahlungskennung, die die Datenbank nur einmal zulässt (`einnahmen_zahlung_ref_eindeutig`).
//
// Die Tests laufen gegen `speicherDb`: eine Attrappe, die wirklich filtert, blättert (PostgREST-Grenze
// 1.000 Zeilen) und die UNIQUE-Regel durchsetzt. Gleichzeitige Aufrufe (`Promise.all`) verzahnen sich
// an jedem `await` wie zwei Anfragen am Server.
//
// Früher hier gefundene Fehler, gegen die die Tests weiter laufen:
//   1. Schlüssel war Mieter + Zahlungsdatum → Juni- und Julimiete am selben Tag: Juli verworfen.
//   2. Altzeilen ohne `soll_monat` schützten nicht.
//   3. Die Batch-Abfrage lud ohne Eingrenzung; jenseits von `db-max-rows` fehlten Buchungen im Schutz.
//   4. Obergrenze `${monat}-31` → 22008 im Februar → Abfrage leer → Doppelbuchung. Die Abfrage hat
//      heute gar keine Datumsgrenze mehr (alle Mietbuchungen des Mieters, vollständig geblättert).

const U = "nutzer-1";

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

const mieter = (over: Record<string, unknown> = {}) => ({
  id: "m1", user_id: U, prop_id: "p1", kaltmiete: 700, nk_vorauszahlung: 150, stellplatz_miete: null,
  mietbeginn: "2024-01-01", mietende: null, minderungen: null, ...over,
});
const miete = (over: Record<string, unknown> = {}) => ({
  user_id: U, mieter_id: "m1", kategorie: "Miete", buchungsdatum: "2025-06-03", betrag: 850, nk_anteil: 150,
  soll_monat: "2025-06", zahlung_ref: null, ...over,
});

async function lade(init: Partial<SpeicherDbInit> & { tabellen?: SpeicherDbInit["tabellen"] } = {}) {
  vi.resetModules();
  const db = speicherDb({
    ...init,
    tabellen: { mieter: [mieter(), mieter({ id: "m-fremd", user_id: "anderer" })], miet_zeitraeume: [], einnahmen: [], ...init.tabellen },
    eindeutig: { einnahmen: [["user_id", "zahlung_ref"]] },
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/mietkonto");
  return { db, mod, einnahmen: () => db.tabellen.einnahmen };
}

const bestaetigung = (over: Record<string, unknown> = {}) => ({
  mieter_id: "m1", buchungsdatum: "2025-07-05", betrag: 850, soll_monat: "2025-07", vorgang: "vorgang-0001", ...over,
});
/** Ergebnis ohne die Liste „offen nach dem Abgleich“ (eigene Tests in tests/ablaufA.test.ts). */
const ohneOffen = async (p: Promise<Record<string, unknown>>) => { const { offen: _offen, ...rest } = await p; return rest; };
const imMonat = (rows: Record<string, unknown>[], ym: string) => rows.filter((r) => r.soll_monat === ym);
const summe = (rows: Record<string, unknown>[], feld = "betrag") => Math.round(rows.reduce((s, r) => s + Number(r[feld] ?? 0), 0) * 100) / 100;

describe("Einzelbuchung: Monat, Soll und Kennung", () => {
  it("zwei Monate am selben Tag nachgezahlt = zwei Buchungen", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [miete({ buchungsdatum: "2025-07-05" })] } });
    const r = await mod.bestaetigeMieteingang(bestaetigung());
    expect(r).toEqual({ ok: true });
    expect(imMonat(einnahmen(), "2025-07")).toEqual([
      expect.objectContaining({ betrag: 850, nk_anteil: 150, prop_id: "p1", user_id: U, kategorie: "Miete", zahlung_ref: "a:m1|2025-07" }),
    ]);
  });

  it("ein bezahlter Monat wird übersprungen — ohne Erfolgsmeldung und ohne Buchung", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [miete({ soll_monat: "2025-07", buchungsdatum: "2025-07-01" })] } });
    const r = await mod.bestaetigeMieteingang(bestaetigung());
    expect(r.ok).toBe(false);
    expect(r.uebersprungen).toBe(true);
    expect(r.error).toMatch(/Juli 2025.*bereits vollständig bezahlt/);
    expect(einnahmen()).toHaveLength(1);
  });

  it("eine Altzeile OHNE soll_monat zählt für den Monat ihres Buchungsdatums", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [miete({ soll_monat: null, buchungsdatum: "2025-07-31" })] } });
    expect((await mod.bestaetigeMieteingang(bestaetigung())).uebersprungen).toBe(true);
    expect(einnahmen()).toHaveLength(1);
  });

  it("B10: eine zweite Teilzahlung im selben Monat wird gebucht; der NK-Anteil ist anteilig und ergibt zusammen die Vorauszahlung", async () => {
    const { mod, einnahmen } = await lade();
    expect(await mod.bestaetigeMieteingang(bestaetigung({ betrag: 400, vorgang: "teil-0001" }))).toEqual({ ok: true });
    expect(await mod.bestaetigeMieteingang(bestaetigung({ betrag: 450, vorgang: "teil-0002" }))).toEqual({ ok: true });
    const juli = imMonat(einnahmen(), "2025-07");
    expect(juli.map((r) => [r.betrag, r.nk_anteil, r.zahlung_ref])).toEqual([
      [400, 70.59, "m:teil-0001"],
      [450, 79.41, "a:m1|2025-07"], // gleicht den Rest aus
    ]);
    expect(summe(juli, "nk_anteil")).toBe(150);
    // Danach ist der Monat bezahlt.
    expect((await mod.bestaetigeMieteingang(bestaetigung({ betrag: 100, vorgang: "teil-0003" }))).uebersprungen).toBe(true);
    expect(imMonat(einnahmen(), "2025-07")).toHaveLength(2);
  });

  it("B10: eine Überzahlung wird gebucht und gesondert ausgewiesen; der NK-Anteil bleibt bei der Vorauszahlung", async () => {
    const { mod, einnahmen } = await lade();
    expect(await mod.bestaetigeMieteingang(bestaetigung({ betrag: 900 }))).toEqual({ ok: true, ueberzahlung: 50 });
    expect(imMonat(einnahmen(), "2025-07")).toEqual([expect.objectContaining({ betrag: 900, nk_anteil: 150 })]);
  });

  it("eine bewusst WEITERE Zahlung auf einen bezahlten Monat geht nur mit „weitere“ — und ist dann ganz Überzahlung", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [miete({ soll_monat: "2025-07" })] } });
    const r = await mod.bestaetigeMieteingang(bestaetigung({ betrag: 200, weitere: true, vorgang: "weitere-0001" }));
    expect(r).toEqual({ ok: true, ueberzahlung: 200 });
    expect(imMonat(einnahmen(), "2025-07").map((x) => [x.betrag, x.nk_anteil, x.zahlung_ref])).toEqual([
      [850, 150, null],
      [200, 0, "m:weitere-0001"], // Vorauszahlung ist schon gedeckt
    ]);
  });

  it("B09: NK-Anteil und Objekt rechnet der SERVER — Werte aus dem Browser zählen nicht", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMieteingang({ ...bestaetigung(), nk_anteil: 999, prop_id: "fremdes-objekt" });
    expect(einnahmen()[0]).toMatchObject({ prop_id: "p1", nk_anteil: 150 });
  });

  it("B09: ändert sich die Vorauszahlung, gilt die des GEBUCHTEN Monats (Miet-Zeitraum)", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { miet_zeitraeume: [
      { id: "z1", user_id: U, mieter_id: "m1", von: "2025-07-01", bis: null, kaltmiete: 700, nk_vorauszahlung: 200, stellplatz_miete: null },
    ] } });
    await mod.bestaetigeMieteingang(bestaetigung({ soll_monat: "2025-06", betrag: 850, vorgang: "juni-0001" }));
    await mod.bestaetigeMieteingang(bestaetigung({ soll_monat: "2025-07", betrag: 900, vorgang: "juli-0001" }));
    expect(einnahmen().map((r) => [r.soll_monat, r.nk_anteil])).toEqual([["2025-06", 150], ["2025-07", 200]]);
  });

  it("ein fremder Mieter wird nicht gebucht", async () => {
    const { db, mod, einnahmen } = await lade();
    const r = await mod.bestaetigeMieteingang(bestaetigung({ mieter_id: "m-fremd" }));
    expect(r).toEqual({ ok: false, error: "Mieter nicht gefunden." });
    expect(einnahmen()).toHaveLength(0);
    expect(db.protokoll.find((p) => p.tabelle === "mieter")?.filter).toContain(`eq:user_id=${U}`);
  });

  it("Betrag ≤ 0 (auch Erstattungen) oder unbrauchbares Datum werden abgewiesen, ohne zu lesen", async () => {
    const { db, mod, einnahmen } = await lade();
    for (const over of [{ betrag: 0 }, { betrag: -5 }, { buchungsdatum: "05.07.2025" }, { buchungsdatum: "2025-7-5" }]) {
      expect((await mod.bestaetigeMieteingang(bestaetigung(over))).ok).toBe(false);
    }
    expect(einnahmen()).toHaveLength(0);
    expect(db.protokoll).toEqual([]);
  });

  it("ein unbrauchbarer soll_monat fällt auf den Monat des Buchungsdatums zurück", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMieteingang(bestaetigung({ soll_monat: "Juli 2025", buchungsdatum: "2025-08-02" }));
    expect(einnahmen()[0]).toMatchObject({ soll_monat: "2025-08" });
  });

  it("scheitert das Lesen der Buchungen, wird nichts gebucht", async () => {
    const { mod, einnahmen } = await lade({ fehlerBei: { "einnahmen:select": "connection reset" } });
    const r = await mod.bestaetigeMieteingang(bestaetigung());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/nicht geprüft werden/);
    expect(einnahmen()).toHaveLength(0);
  });

  it("scheitert das Lesen des Vertrags, wird nichts gebucht — und das steht so da", async () => {
    const { mod, einnahmen } = await lade({ fehlerBei: { "mieter:select": "connection reset" } });
    expect((await mod.bestaetigeMieteingang(bestaetigung())).error).toMatch(/nicht geprüft werden/);
    expect((await mod.bestaetigeMehrere([{ ...bestaetigung(), vorgang: null }])).error).toMatch(/nicht geprüft werden/);
    expect(einnahmen()).toHaveLength(0);
  });

  it("scheitert das Schreiben, gibt es keinen Erfolg", async () => {
    const { mod } = await lade({ fehlerBei: { "einnahmen:upsert": "timeout" } });
    expect(await mod.bestaetigeMieteingang(bestaetigung())).toEqual({ ok: false, error: "Buchen fehlgeschlagen." });
  });

  it("über 1.000 Buchungen: der bezahlte Monat wird trotzdem erkannt (geblättert statt abgeschnitten)", async () => {
    const alt = Array.from({ length: 1100 }, (_, i) => miete({ id: `alt-${String(i).padStart(5, "0")}`, soll_monat: "2001-01", betrag: 1, nk_anteil: 0 }));
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [...alt, miete({ id: "zz-juli", soll_monat: "2025-07" })] } });
    expect((await mod.bestaetigeMieteingang(bestaetigung())).uebersprungen).toBe(true);
    expect(einnahmen()).toHaveLength(1101);
  });
});

describe("Einzelbuchung: Wiederholung und Gleichzeitigkeit (B07)", () => {
  it("dieselbe Bestätigung zweimal (Wiederholung nach Zeitüberlauf) bucht EINMAL", async () => {
    const { mod, einnahmen } = await lade();
    const teil = bestaetigung({ betrag: 300, vorgang: "wiederholt-1" });
    expect(await mod.bestaetigeMieteingang(teil)).toEqual({ ok: true });
    expect(await mod.bestaetigeMieteingang(teil)).toMatchObject({ ok: true }); // Monat noch offen, Kennung schon da
    expect(einnahmen()).toHaveLength(1);
  });

  it("Doppelklick: zwei GLEICHZEITIGE Aufrufe mit derselben Kennung buchen einmal", async () => {
    const { mod, einnahmen } = await lade();
    const teil = bestaetigung({ betrag: 300, vorgang: "doppelklick-1" });
    const [a, b] = await Promise.all([mod.bestaetigeMieteingang(teil), mod.bestaetigeMieteingang(teil)]);
    expect(a.ok && b.ok).toBe(true);
    expect([a.uebersprungen, b.uebersprungen].filter(Boolean)).toHaveLength(1);
    expect(einnahmen()).toHaveLength(1);
  });

  it("zwei Tabs bestätigen denselben Monat GLEICHZEITIG (verschiedene Kennungen) → eine Buchung", async () => {
    const { mod, einnahmen } = await lade();
    await Promise.all([
      mod.bestaetigeMieteingang(bestaetigung({ vorgang: "tab-a-0001" })),
      mod.bestaetigeMieteingang(bestaetigung({ vorgang: "tab-b-0001" })),
    ]);
    expect(imMonat(einnahmen(), "2025-07")).toHaveLength(1);
    expect(summe(einnahmen())).toBe(850);
  });

  it("zwei gleichzeitige TEILzahlungen sind zwei Zahlungen — beide gebucht", async () => {
    const { mod, einnahmen } = await lade();
    await Promise.all([
      mod.bestaetigeMieteingang(bestaetigung({ betrag: 400, vorgang: "teil-a-001" })),
      mod.bestaetigeMieteingang(bestaetigung({ betrag: 300, vorgang: "teil-b-001" })),
    ]);
    expect(summe(einnahmen())).toBe(700);
  });
});

describe("Nacherfassung", () => {
  const nach = (over: Record<string, unknown> = {}) => ({ mieter_id: "m1", buchungsdatum: "2025-07-01", betrag: 850, soll_monat: "2025-07", ...over });

  it("bucht leere Monate mit dem Soll; Kennung = Ausgleich des Monats", async () => {
    const { mod, einnahmen } = await lade();
    const r = await mod.bestaetigeMehrere([nach(), nach({ soll_monat: "2025-08", buchungsdatum: "2025-08-01" })]);
    expect(r).toEqual({ ok: true, anzahl: 2 });
    expect(einnahmen().map((x) => [x.soll_monat, x.nk_anteil, x.zahlung_ref])).toEqual([
      ["2025-07", 150, "a:m1|2025-07"], ["2025-08", 150, "a:m1|2025-08"],
    ]);
  });

  it("ein Betrag unter dem Soll bekommt eine eigene Kennung (der Monat bleibt offen)", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([nach({ betrag: 425 })]);
    expect(einnahmen()[0]).toMatchObject({ zahlung_ref: "n:m1|2025-07", nk_anteil: 75 });
  });

  it("ein Monat mit IRGENDEINER Buchung wird nicht nacherfasst", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [miete({ soll_monat: "2025-07", betrag: 100, nk_anteil: 0 })] } });
    expect(await mod.bestaetigeMehrere([nach()])).toEqual({ ok: true, anzahl: 0, uebersprungen: 1 });
    expect(einnahmen()).toHaveLength(1);
  });

  it("Dubletten INNERHALB der Auswahl werden nur einmal gebucht", async () => {
    const { mod, einnahmen } = await lade();
    const r = await mod.bestaetigeMehrere([nach(), nach(), nach()]);
    expect(r).toEqual({ ok: true, anzahl: 1, uebersprungen: 2 });
    expect(einnahmen()).toHaveLength(1);
  });

  it("ungültige und fremde Zeilen werden aussortiert, gültige gebucht", async () => {
    const { mod, einnahmen } = await lade();
    const r = await mod.bestaetigeMehrere([
      nach(),
      nach({ betrag: 0, soll_monat: "2025-08" }),
      nach({ mieter_id: "", soll_monat: "2025-09" }),
      nach({ buchungsdatum: "kaputt", soll_monat: "2025-10" }),
      nach({ mieter_id: "m-fremd", soll_monat: "2025-11" }),
    ]);
    expect(r.anzahl).toBe(1);
    expect(einnahmen().map((x) => x.mieter_id)).toEqual(["m1"]);
  });

  it("gar nichts Gültiges: Fehler statt leerem Erfolg — und nicht einmal gelesen", async () => {
    const { db, mod } = await lade();
    expect((await mod.bestaetigeMehrere([nach({ betrag: -1 })])).ok).toBe(false);
    expect(db.protokoll).toEqual([]);
  });

  it("über 600 Zeilen werden abgelehnt", async () => {
    const { mod } = await lade();
    expect((await mod.bestaetigeMehrere(Array.from({ length: 601 }, (_, i) => nach({ mieter_id: `m${i}` })))).ok).toBe(false);
  });

  it("scheitert die Prüfung der Buchungen, wird NICHTS gebucht", async () => {
    const { mod, einnahmen } = await lade({ fehlerAbSeite: { einnahmen: 0 } });
    const r = await mod.bestaetigeMehrere([nach()]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("nichts angelegt");
    expect(einnahmen()).toHaveLength(0);
  });

  it("gelesen wird nur für die betroffenen EIGENEN Mieter", async () => {
    const { db, mod } = await lade();
    await mod.bestaetigeMehrere([nach(), nach({ mieter_id: "m2", soll_monat: "2025-08" })]);
    const m = db.protokoll.find((p) => p.tabelle === "mieter");
    expect(m?.filter).toEqual(expect.arrayContaining([`eq:user_id=${U}`, "in:id=2"]));
  });

  it("Nacherfassung und Bestätigung desselben Monats GLEICHZEITIG → eine Buchung", async () => {
    const { mod, einnahmen } = await lade();
    await Promise.all([mod.bestaetigeMehrere([nach()]), mod.bestaetigeMieteingang(bestaetigung())]);
    expect(imMonat(einnahmen(), "2025-07")).toHaveLength(1);
  });
});

describe("Kontoauszug (B07/B09/B10)", () => {
  const bank = (over: Record<string, unknown> = {}) => ({ mieter_id: "m1", buchungsdatum: "2025-07-04", betrag: 850, soll_monat: "2025-07", vorgang: "bankzeile0001", ...over });

  it("ohne Prüfsumme der Bankzeile wird nichts gebucht", async () => {
    const { mod, einnahmen } = await lade();
    expect((await mod.bestaetigeMehrere([bank({ vorgang: null })], "kontoauszug")).ok).toBe(false);
    expect(einnahmen()).toHaveLength(0);
  });

  it("derselbe Auszug zweimal eingelesen → keine zweite Buchung", async () => {
    const { mod, einnahmen } = await lade();
    expect(await ohneOffen(mod.bestaetigeMehrere([bank()], "kontoauszug"))).toEqual({ ok: true, anzahl: 1 });
    expect(await ohneOffen(mod.bestaetigeMehrere([bank()], "kontoauszug"))).toEqual({ ok: true, anzahl: 0, uebersprungen: 1 });
    expect(einnahmen()).toEqual([expect.objectContaining({ zahlung_ref: "ka:bankzeile0001", nk_anteil: 150 })]);
  });

  it("eine verteilte Sammelzahlung zweimal eingelesen → keine zweite Buchung (auch nicht als Überzahlung)", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([bank({ betrag: 1700 })], "kontoauszug");
    expect(await ohneOffen(mod.bestaetigeMehrere([bank({ betrag: 1700 })], "kontoauszug"))).toEqual({ ok: true, anzahl: 0, uebersprungen: 1 });
    expect(einnahmen()).toHaveLength(2);
  });

  it("derselbe Auszug GLEICHZEITIG in zwei Tabs → keine zweite Buchung", async () => {
    const { mod, einnahmen } = await lade();
    await Promise.all([mod.bestaetigeMehrere([bank()], "kontoauszug"), mod.bestaetigeMehrere([bank()], "kontoauszug")]);
    expect(einnahmen()).toHaveLength(1);
  });

  it("B09: der NK-Anteil folgt dem GEWÄHLTEN Monat, nicht dem zuerst erkannten", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { miet_zeitraeume: [
      { id: "z1", user_id: U, mieter_id: "m1", von: "2025-08-01", bis: null, kaltmiete: 700, nk_vorauszahlung: 200, stellplatz_miete: null },
    ] } });
    // Der Browser hatte für Juli 150 vorgeschlagen; der Vermieter wählt August.
    await mod.bestaetigeMehrere([{ ...bank({ soll_monat: "2025-08", betrag: 900 }), nk_anteil: 150 }], "kontoauszug");
    expect(einnahmen()[0]).toMatchObject({ soll_monat: "2025-08", nk_anteil: 200, betrag: 900 });
  });

  it("B10: Sammelzahlung für zwei Monate wird auf beide offenen Monate verteilt", async () => {
    const { mod, einnahmen } = await lade();
    expect(await ohneOffen(mod.bestaetigeMehrere([bank({ betrag: 1700 })], "kontoauszug"))).toEqual({ ok: true, anzahl: 2 });
    expect(einnahmen().map((r) => [r.soll_monat, r.betrag, r.nk_anteil, r.zahlung_ref])).toEqual([
      ["2025-07", 850, 150, "ka:bankzeile0001#2025-07"],
      ["2025-08", 850, 150, "ka:bankzeile0001#2025-08"],
    ]);
  });

  it("B10: Teilzahlung schließt an eine vorhandene Teilzahlung an, der Rest geht in den Folgemonat", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { einnahmen: [miete({ soll_monat: "2025-07", betrag: 400, nk_anteil: 70.59 })] } });
    await mod.bestaetigeMehrere([bank({ betrag: 650 })], "kontoauszug");
    const neu = einnahmen().slice(1).map((r) => [r.soll_monat, r.betrag, r.nk_anteil]);
    expect(neu).toEqual([["2025-07", 450, 79.41], ["2025-08", 200, 35.29]]);
    expect(summe(imMonat(einnahmen(), "2025-07"), "nk_anteil")).toBe(150);
  });

  it("B10: nach dem Auszug gibt es kein Soll mehr → der Überschuss ist Überzahlung", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { mieter: [mieter({ mietende: "2025-07-31" })] } });
    expect(await ohneOffen(mod.bestaetigeMehrere([bank({ betrag: 1000 })], "kontoauszug"))).toEqual({ ok: true, anzahl: 1, ueberzahlung: 150 });
    expect(einnahmen()[0]).toMatchObject({ soll_monat: "2025-07", betrag: 1000, nk_anteil: 150 });
  });

  it("zwei Teilzahlungen im SELBEN Auszug für denselben Monat zählen nacheinander", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([bank({ betrag: 400, vorgang: "bankzeileA01" }), bank({ betrag: 450, vorgang: "bankzeileB01" })], "kontoauszug");
    expect(einnahmen().map((r) => [r.soll_monat, r.betrag, r.nk_anteil])).toEqual([["2025-07", 400, 70.59], ["2025-07", 450, 79.41]]);
  });

  it("zwei VOLLE Zahlungen im selben Auszug für denselben Monat → die zweite gleicht den Folgemonat aus", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([bank({ vorgang: "bankzeileA02" }), bank({ vorgang: "bankzeileB02", buchungsdatum: "2025-07-30" })], "kontoauszug");
    expect(einnahmen().map((r) => [r.soll_monat, r.betrag])).toEqual([["2025-07", 850], ["2025-08", 850]]);
  });

  it("mehrere Mietverhältnisse: jede Zeile rechnet mit IHREM Vertrag", async () => {
    const { mod, einnahmen } = await lade({ tabellen: { mieter: [mieter(), mieter({ id: "m2", kaltmiete: 500, nk_vorauszahlung: 100 })] } });
    await mod.bestaetigeMehrere([bank(), bank({ mieter_id: "m2", betrag: 600, vorgang: "bankzeileM2" })], "kontoauszug");
    expect(einnahmen().map((r) => [r.mieter_id, r.nk_anteil])).toEqual([["m1", 150], ["m2", 100]]);
  });
});
