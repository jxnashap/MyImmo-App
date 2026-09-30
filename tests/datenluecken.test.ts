import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { sollKaltmiete, laeuftAm } from "@/lib/sollMiete";
import { baueHeuteAufgaben } from "@/lib/heute";
import { berechneAnlageV, nkSollImJahr, AFA_DEFAULT } from "@/lib/anlageV";
import type { Einnahme, Property } from "@/lib/types";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// Datenlücken der echten Konten (30.09.2026) — dieselben Fehler, die in der
// Demo korrigiert wurden, fanden sich bei echten Nutzern wieder: Objekt-Miete
// passt nicht zu den Mietern, Kaufdatum fehlt, Umlagen nicht gebucht.

const HEUTE = "2026-09-30";

describe("Soll-Kaltmiete: Mieter vor Objektfeld", () => {
  const obj = { id: "o", typ: "Eigentumswohnung", miete: 1800 };

  it("ohne Mieter zählt das Objektfeld (wer ohne Mieterverwaltung arbeitet)", () => {
    expect(sollKaltmiete(obj, [], HEUTE)).toEqual({ betrag: 1800, quelle: "objekt", abweichung: null });
  });

  it("laufende Mieter zählen — mit Abweichung, wenn das Objektfeld anders lautet", () => {
    const r = sollKaltmiete(obj, [
      { prop_id: "o", kaltmiete: 1200, mietbeginn: "2024-01-01" },
      { prop_id: "o", kaltmiete: "1400", mietbeginn: "2025-05-01" },
      { prop_id: "anderes", kaltmiete: 999 },
    ], HEUTE);
    expect(r).toEqual({ betrag: 2600, quelle: "mieter", abweichung: { objekt: 1800, mieter: 2600 } });
  });

  it("leeres Objektfeld: Mieter zählen, keine Abweichung (echter Fall: Dashboard zeigte 0 €)", () => {
    expect(sollKaltmiete({ id: "o", miete: null }, [{ prop_id: "o", kaltmiete: 1200 }], HEUTE))
      .toEqual({ betrag: 1200, quelle: "mieter", abweichung: null });
  });

  it("gleiche Zahl (±1 €) ist keine Abweichung", () => {
    expect(sollKaltmiete({ id: "o", miete: 630.5 }, [{ prop_id: "o", kaltmiete: 630 }], HEUTE).abweichung).toBeNull();
  });

  it("nur beendete oder künftige Mieter → 0, nicht die Objekt-Miete (Phantom-Soll)", () => {
    const r = sollKaltmiete(obj, [
      { prop_id: "o", kaltmiete: 1150, mietbeginn: "2018-03-01", mietende: "2025-09-30" },
      { prop_id: "o", kaltmiete: 1250, mietbeginn: "2026-11-01" },
    ], HEUTE);
    expect(r).toEqual({ betrag: 0, quelle: "beendet", abweichung: null });
  });

  it("Garagen zählen die Stellplatzmiete mit, Wohnungen nicht", () => {
    const m = [{ prop_id: "o", kaltmiete: 50, stellplatz_miete: 20 }];
    expect(sollKaltmiete({ id: "o", typ: "Garagenkomplex" }, m, HEUTE).betrag).toBe(70);
    expect(sollKaltmiete({ id: "o", typ: "Eigentumswohnung" }, m, HEUTE).betrag).toBe(50);
  });

  it("Stichtage: Einzug und Auszug am selben Tag zählen", () => {
    expect(laeuftAm({ mietbeginn: HEUTE }, HEUTE)).toBe(true);
    expect(laeuftAm({ mietende: HEUTE }, HEUTE)).toBe(true);
    expect(laeuftAm({ mietbeginn: "2026-10-01" }, HEUTE)).toBe(false);
    expect(laeuftAm({ mietende: "2026-09-29" }, HEUTE)).toBe(false);
  });

  it("Dashboard, Objektseite und Objektliste rechnen alle mit der Regel", () => {
    expect(readFileSync("app/(app)/page.tsx", "utf8")).toMatch(/totalMiete = properties\.reduce\(\(s, p\) => s \+ sollKaltmiete\(p, mieterRows, heuteISO\)\.betrag/);
    expect(readFileSync("app/(app)/properties/[id]/page.tsx", "utf8")).toMatch(/const miete = soll\.betrag;/);
    expect(readFileSync("app/(app)/properties/page.tsx", "utf8")).toMatch(/miete: sollKaltmiete\(p, miet \?\? \[\], heute\)\.betrag/);
  });

  it("die Objektseite zeigt die Abweichung, statt still umzuschalten", () => {
    const q = readFileSync("app/(app)/properties/[id]/page.tsx", "utf8");
    expect(q).toMatch(/\{soll\.abweichung && \(/);
    expect(q).toMatch(/<MieteAngleichen id=\{p\.id\}/);
    expect(q).toMatch(/\{soll\.quelle === "beendet" && \(/);
  });
});

describe("Objekt-Miete angleichen (Server-Action)", () => {
  afterEach(() => {
    for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  });

  async function lade(init = {}) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/properties");
    return { db, mod };
  }

  it("rechnet den Betrag selbst und schreibt nur ins eigene Objekt", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "properties:select": [{ id: "o", typ: "Eigentumswohnung", miete: 1800 }], "properties:update": [{ id: "o" }] },
      antworten: { mieter: [{ prop_id: "o", kaltmiete: 1200 }, { prop_id: "o", kaltmiete: 1400 }] },
    });
    expect(await mod.gleicheObjektMieteAn("o")).toEqual({ ok: true });
    const upd = db.zugriffe.find((z) => z.tabelle === "properties" && z.op === "update")!;
    expect(upd.daten).toEqual({ miete: 2600 });
    expect(upd.filter).toEqual(expect.arrayContaining(["eq:id=o", "eq:user_id=nutzer-1"]));
    const mie = db.zugriffe.find((z) => z.tabelle === "mieter")!;
    expect(mie.filter).toContain("eq:user_id=nutzer-1");
  });

  it("Mieter nicht ladbar → kein Schreiben, und der Grund stimmt", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "properties:select": [{ id: "o", miete: 1800 }] },
      fehlerBei: { mieter: { message: "timeout" } },
    });
    const r = await mod.gleicheObjektMieteAn("o");
    expect(r).toEqual({ ok: false, error: "Objekt oder Mieter konnten nicht geladen werden." });
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });

  it("ohne laufende Mieter wird nichts angeglichen", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "properties:select": [{ id: "o", miete: 1800 }] },
      antworten: { mieter: [{ prop_id: "o", kaltmiete: 900, mietende: "2020-01-31" }] },
    });
    expect((await mod.gleicheObjektMieteAn("o")).ok).toBe(false);
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });

  it("Update ohne Treffer (RLS, Demo) ist ein Fehler, kein „gespeichert“", async () => {
    const { mod } = await lade({
      antwortFolge: { "properties:select": [{ id: "o", miete: 1800 }], "properties:update": [null] },
      antworten: { mieter: [{ prop_id: "o", kaltmiete: 1200 }] },
    });
    expect((await mod.gleicheObjektMieteAn("o")).ok).toBe(false);
  });
});

describe("Aufgabe: Kaufdatum fehlt", () => {
  const leer = { offeneMieten: [], anliegen: [], meldungen: [], fristen: [] };

  it("ein Objekt → Zeile mit Namen, Klick auf das Objekt", () => {
    const [a] = baueHeuteAufgaben({ ...leer, ohneKaufdatum: [{ id: "o1", name: "ETW Süd" }] }, HEUTE);
    expect(a).toMatchObject({ art: "stammdaten", label: "Kaufdatum fehlt: ETW Süd", href: "/properties/o1", dringend: false });
  });

  it("mehrere → EINE Sammelzeile, nicht zwanzig", () => {
    const liste = baueHeuteAufgaben({ ...leer, ohneKaufdatum: Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, name: `O${i}` })) }, HEUTE, 50);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ label: "Kaufdatum fehlt bei 20 Objekten", href: "/properties" });
  });

  it("steht hinter allem anderen — auch hinter Fristen in ferner Zukunft", () => {
    const liste = baueHeuteAufgaben({
      ...leer,
      fristen: [{ datum: "2031-01-01", label: "Zinsbindung", sub: "", warn: false }],
      ohneKaufdatum: [{ id: "o1", name: "X" }],
    }, HEUTE);
    expect(liste.map((a) => a.art)).toEqual(["frist", "stammdaten"]);
  });

  it("das Dashboard reicht die Objekte ohne Kaufdatum herein", () => {
    expect(readFileSync("app/(app)/page.tsx", "utf8")).toMatch(/ohneKaufdatum: properties\.filter\(\(p\) => !p\.kaufdatum\)/);
  });
});

describe("Anlage V: fehlende Umlagen fallen auf", () => {
  const obj = { id: "o", bezeichnung: "ETW", kaufpreis: 200000, kaufdatum: "2020-01-01", baujahr: 1990 } as unknown as Property;
  const kaltBuchungen = Array.from({ length: 12 }, (_, i) => ({
    id: `e${i}`, prop_id: "o", kategorie: "Miete", betrag: 800, nk_anteil: null,
    buchungsdatum: `2025-${String(i + 1).padStart(2, "0")}-01`,
  })) as unknown as Einnahme[];
  const vertrag = [{ prop_id: "o", nk_vorauszahlung: 200, mietbeginn: "2021-01-01", mietende: null }];
  const hinweis = (h: string[]) => h.find((x) => x.includes("Nebenkosten-Vorauszahlungen fällig"));

  it("NK-Soll zählt nur Monate mit laufendem Vertrag", () => {
    expect(nkSollImJahr(vertrag, "o", 2025)).toBe(2400);
    expect(nkSollImJahr([{ prop_id: "o", nk_vorauszahlung: 100, mietbeginn: "2025-11-15", mietende: null }], "o", 2025)).toBe(200);
    expect(nkSollImJahr([{ prop_id: "o", nk_vorauszahlung: 100, mietbeginn: "2020-01-01", mietende: "2025-03-01" }], "o", 2025)).toBe(300);
    expect(nkSollImJahr([{ prop_id: "o", nk_vorauszahlung: 100, mietbeginn: "2026-01-01", mietende: null }], "o", 2025)).toBe(0);
    expect(nkSollImJahr(vertrag, "anderes", 2025)).toBe(0);
  });

  it("nur kalt gebucht, Vertrag mit NK → Hinweis mit beiden Zahlen", () => {
    const erg = berechneAnlageV(2025, [obj], kaltBuchungen, [], [], AFA_DEFAULT, vertrag);
    expect(hinweis(erg.objekte[0].hinweise)).toMatch(/rund 2\.400 € .* gebucht sind 0 €/);
  });

  it("mit NK-Anteil gebucht → kein Hinweis", () => {
    const warm = kaltBuchungen.map((e) => ({ ...e, betrag: 1000, nk_anteil: 200 }));
    const erg = berechneAnlageV(2025, [obj], warm, [], [], AFA_DEFAULT, vertrag);
    expect(hinweis(erg.objekte[0].hinweise)).toBeUndefined();
  });

  it("ohne Verträge (alte Aufrufer) → kein Hinweis, keine Änderung", () => {
    const erg = berechneAnlageV(2025, [obj], kaltBuchungen, [], [], AFA_DEFAULT);
    expect(hinweis(erg.objekte[0].hinweise)).toBeUndefined();
  });

  it("Steuerseite und PDF übergeben die Verträge", () => {
    expect(readFileSync("app/(app)/steuer/page.tsx", "utf8")).toMatch(/mieter=\{\(mie \?\? \[\]\) as MieterNkVertrag\[\]\}/);
    expect(readFileSync("components/AnlageVExport.tsx", "utf8")).toMatch(/\}, mieter\),/);
    const pdf = readFileSync("app/api/berichte/anlage-v/route.ts", "utf8");
    expect(pdf).toMatch(/\(mie \?\? \[\]\) as MieterNkVertrag\[\],/);
    expect(pdf).toMatch(/from\("mieter"\)\.select\("prop_id,nk_vorauszahlung,mietbeginn,mietende"\)\.eq\("user_id", user\.id\)/);
  });
});
