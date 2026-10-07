// NK Stufe 1 (07.10.2026): Kosten je Objekt, verteilt auf die Mieter. Jede Zahl hier ist von Hand
// nachgerechnet; die Testwerte sind so gewählt, dass verschiedene Wege verschiedene Ergebnisse
// liefern (Leerstand ≠ 0, unterjährige Belegung ≠ volles Jahr).
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  verteileObjektKosten,
  positionenFuerMieter,
  pruefeKostenEingabe,
  mengeDe,
  vorschlaegeAusVorjahr,
  standardSchluessel,
  type NkObjektKosten,
  type NkObjektMieter,
} from "@/lib/nkObjekt";
import { berechneNk } from "@/lib/nk";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

const lies = (p: string) => readFileSync(p, "utf8");
const k = (x: Partial<NkObjektKosten>): NkObjektKosten => ({
  id: x.id ?? "k1", bezeichnung: x.bezeichnung ?? "Grundsteuer", betrag: x.betrag ?? 4000,
  schluessel: x.schluessel ?? "flaeche", umlagefaehig: x.umlagefaehig ?? true, ...x,
});
const m = (id: string, flaeche: number | null, von: string | null = "2020-01-01", bis: string | null = null): NkObjektMieter =>
  ({ id, name: id.toUpperCase(), flaeche, mietbeginn: von, mietende: bis });
const summeOk = (e: ReturnType<typeof verteileObjektKosten>) =>
  e.positionen.forEach((p) => {
    const s = Object.values(p.anteile).reduce((a, b) => a + b.betrag, 0) + p.vermieter;
    expect(Math.round(s * 100), p.kosten.bezeichnung).toBe(Math.round(p.kosten.betrag * 100));
  });

describe("Fläche", () => {
  it("Leerstand bleibt beim Vermieter (Nenner = ganzes Haus, nicht Summe der Mieter)", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: 400, einheiten: 4, mea_gesamt: null }, [k({})],
      [m("a", 80), m("b", 120), m("c", 100)]);
    const p = e.positionen[0];
    expect(p.anteile.a.betrag).toBe(800);
    expect(p.anteile.b.betrag).toBe(1200);
    expect(p.anteile.c.betrag).toBe(1000);
    expect(p.vermieter).toBe(1000);
    expect(p.anteile.a.faktorText).toBe("80/400 m²");
    summeOk(e);
  });
  it("Mieterwechsel in derselben Wohnung: tagesgenau, die Lücke trägt der Vermieter", () => {
    // 2025: 365 Tage. A bis 30.06. = 181 Tage, B ab 01.08. = 153 Tage, Juli (31) leer.
    const e = verteileObjektKosten(2025, { flaeche_gesamt: 80, einheiten: 1, mea_gesamt: null }, [k({ betrag: 3650 })],
      [m("a", 80, "2020-01-01", "2025-06-30"), m("b", 80, "2025-08-01")]);
    const p = e.positionen[0];
    expect(p.anteile.a.betrag).toBe(1810);
    expect(p.anteile.b.betrag).toBe(1530);
    expect(p.vermieter).toBe(310);
    expect(p.anteile.a.faktorText).toBe("80/80 m² × 181/365 Tage");
  });
  it("ohne Gesamtfläche wird nichts verteilt — mit Warnung, nicht still", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: null }, [k({})], [m("a", 80)]);
    expect(e.positionen[0].anteile).toEqual({});
    expect(e.positionen[0].vermieter).toBe(4000);
    expect(e.positionen[0].warnung).toMatch(/Gesamtwohnfläche/);
  });
  it("Mieterflächen größer als das Haus → nicht über 100 % verteilen, warnen", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: 100, einheiten: 2, mea_gesamt: null }, [k({ betrag: 1000 })], [m("a", 80), m("b", 80)]);
    expect(e.positionen[0].anteile.a.betrag + e.positionen[0].anteile.b.betrag).toBe(1000);
    expect(e.positionen[0].warnung).toMatch(/mehr als das ganze Haus/);
  });
  it("cent-genau: Summe der Anteile + Vermieter = Gesamtbetrag", () => {
    const e = verteileObjektKosten(2024, { flaeche_gesamt: 333.3, einheiten: 3, mea_gesamt: null }, [k({ betrag: 1234.57 })],
      [m("a", 71.1, "2024-03-17"), m("b", 99.9), m("c", 112.3, null, "2024-10-09")]);
    summeOk(e);
  });
});

describe("Einheiten, MEA, Personen", () => {
  it("Einheiten: je Partei 1/n, leere Einheit beim Vermieter", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 3, mea_gesamt: null }, [k({ schluessel: "einheiten", betrag: 900 })],
      [m("a", null), m("b", null)]);
    expect(e.positionen[0].anteile.a.betrag).toBe(300);
    expect(e.positionen[0].vermieter).toBe(300);
  });
  it("MEA aus den Grundlagen je Mieter", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: 1000, mieter: { a: { mea: 250 }, b: { mea: 500 } } },
      [k({ schluessel: "mea", betrag: 2000 })], [m("a", null), m("b", null)]);
    expect(e.positionen[0].anteile.a.betrag).toBe(500);
    expect(e.positionen[0].anteile.b.betrag).toBe(1000);
    expect(e.positionen[0].vermieter).toBe(500);
  });
  it("Personen: Personentage, leere Wohnungstage zählen mit einer Person (Vermieter)", () => {
    // 2 Einheiten. A: 2 Pers. ganzes Jahr = 730; B: 1 Pers. ab 01.07. = 184 Tage; leer = 730 − 365 − 184 = 181.
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: null, mieter: { a: { personen: 2 }, b: { personen: 1 } } },
      [k({ schluessel: "personen", betrag: 1095 })], [m("a", null), m("b", null, "2025-07-01")]);
    const p = e.positionen[0];
    expect(p.anteile.a.betrag).toBe(730);
    expect(p.anteile.b.betrag).toBe(184);
    expect(p.vermieter).toBe(181);
  });
  it("Personen ohne Einheitenzahl: nicht verteilen (Leerstand unbekannt)", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: null, mea_gesamt: null, mieter: { a: { personen: 2 } } },
      [k({ schluessel: "personen", betrag: 100 })], [m("a", null)]);
    expect(e.positionen[0].anteile).toEqual({});
    expect(e.positionen[0].warnung).toMatch(/Wohneinheiten/);
  });
});

describe("Verbrauch und Betrag je Wohnung", () => {
  it("Verbrauch gegen den Hauptzähler — der Rest (Leerstand, Gemeinschaft) beim Vermieter", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 3, mea_gesamt: null },
      [k({ schluessel: "verbrauch", betrag: 1000, nenner: 100, werte: { a: 30, b: 50 } })], [m("a", null), m("b", null, "2025-06-01")]);
    expect(e.positionen[0].anteile.a.betrag).toBe(300);
    expect(e.positionen[0].anteile.b.betrag).toBe(500); // gemessen — kein Tage-Faktor
    expect(e.positionen[0].vermieter).toBe(200);
  });
  it("Betrag je Wohnung: genau der eingetragene Betrag, Rest beim Vermieter", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: null },
      [k({ schluessel: "direkt", betrag: 2000, werte: { a: 812.4, b: 990 } })], [m("a", null), m("b", null)]);
    expect(e.positionen[0].anteile.a.betrag).toBe(812.4);
    expect(e.positionen[0].vermieter).toBe(197.6);
  });
  it("Betrag je Wohnung über dem Gesamtbetrag → nicht verteilt", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: null },
      [k({ schluessel: "direkt", betrag: 100, werte: { a: 80, b: 80 } })], [m("a", null), m("b", null)]);
    expect(e.positionen[0].anteile).toEqual({});
    expect(e.positionen[0].warnung).toMatch(/höher als der Gesamtbetrag/);
  });
});

describe("Übergabe an die Abrechnung des Mieters (lib/nk.ts)", () => {
  const e = verteileObjektKosten(2025, { flaeche_gesamt: 400, einheiten: 4, mea_gesamt: null }, [
    k({ id: "g", bezeichnung: "Grundsteuer", betrag: 4000 }),
    k({ id: "h", bezeichnung: "Hausmeister", betrag: 2000, lohnanteil: 1000, art_35a: "haushaltsnah" }),
    k({ id: "v", bezeichnung: "Verwaltung", betrag: 600, umlagefaehig: false }),
  ], [m("a", 100)]);
  const t = { vorname: "A", nachname: null, mieter_adresse: null, einheit: null, flaeche: 100, mietbeginn: "2020-01-01", mietende: null, nk_vorauszahlung: 100 };
  const a = berechneNk(2025, t, null, positionenFuerMieter(e, "a"));

  it("Gesamtkosten des Hauses UND Anteil stehen in der Abrechnung (BGH-Pflichtangaben)", () => {
    expect(a.positionen.map((p) => [p.bezeichnung, p.basis, p.betrag])).toEqual([["Grundsteuer", 4000, 1000], ["Hausmeister", 2000, 500]]);
    expect(a.positionen[0].umlageschluessel).toBe("Wohnfläche");
    expect(a.positionen[0].faktorText).toBe("100/400 m²");
    expect(a.umlageGesamt).toBe(1500);
  });
  it("nicht umlagefähig: nur genannt, nicht berechnet", () => {
    expect(a.ausgenommen.map((p) => p.bezeichnung)).toEqual(["Verwaltung"]);
  });
  it("§ 35a: Lohnanteil im Verhältnis des Anteils (1.000 × 500/2.000)", () => {
    expect(a.paragraf35a?.haushaltsnah).toBe(250);
  });
  it("eine Warnung der Verteilung erscheint in der Abrechnung", () => {
    const e2 = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 1, mea_gesamt: null }, [k({})], [m("a", 80)]);
    expect(berechneNk(2025, t, null, positionenFuerMieter(e2, "a")).warnungen.join(" ")).toMatch(/Gesamtwohnfläche/);
  });
  it("ein Mieter ohne Belegung im Jahr bekommt keine Anteile", () => {
    const e3 = verteileObjektKosten(2025, { flaeche_gesamt: 200, einheiten: 2, mea_gesamt: null }, [k({})], [m("a", 100), m("alt", 100, "2019-01-01", "2024-12-31")]);
    expect(e3.mieter.map((x) => x.id)).toEqual(["a"]);
    expect(e3.positionen[0].vermieter).toBe(2000);
    expect(positionenFuerMieter(e3, "alt")).toEqual([]);
  });
});

describe("Eingaben", () => {
  it("Geld deutsch (zahlDe), Mengen mit Punkt als Dezimalzeichen (mengeDe)", () => {
    const r = pruefeKostenEingabe({ bezeichnung: "Wasser", betrag: "1.234,50", schluessel: "verbrauch", umlagefaehig: true, nenner: "5123.456", werte: { a: "12,5", fremd: "99" } }, new Set(["a"]));
    expect("zeile" in r && r.zeile).toMatchObject({ betrag: 1234.5, nenner: 5123.456, werte: { a: 12.5 } });
    expect(mengeDe("1.234,5")).toBe(1234.5);
    expect(mengeDe("-3")).toBe(null);
  });
  it("Werte fremder Mieter fallen weg; Lohnanteil über dem Betrag wird abgelehnt", () => {
    const r = pruefeKostenEingabe({ bezeichnung: "X", betrag: "100", schluessel: "direkt", umlagefaehig: true, werte: { fremd: "50" } }, new Set(["a"]));
    expect("zeile" in r && r.zeile.werte).toEqual({});
    expect(pruefeKostenEingabe({ bezeichnung: "X", betrag: "100", schluessel: "flaeche", umlagefaehig: true, lohnanteil: "150" }, new Set())).toHaveProperty("error");
    expect(pruefeKostenEingabe({ bezeichnung: "X", betrag: "100", schluessel: "quatsch", umlagefaehig: true }, new Set())).toHaveProperty("error");
  });
  it("Vorjahr: Schlüssel und Betrag gehen mit, Werte je Wohnung und Lohnanteil nicht; Vorhandenes bleibt", () => {
    const v = vorschlaegeAusVorjahr([k({ bezeichnung: "Heizung", schluessel: "direkt", werte: { a: 500 }, lohnanteil: 100 }), k({ bezeichnung: "Grundsteuer" })], ["grundsteuer "]);
    expect(v).toEqual([{ bezeichnung: "Heizung", betrag: 4000, schluessel: "direkt", umlagefaehig: true, art_35a: null, quelle: "vorjahr" }]);
  });
  it("Standardschlüssel: Fläche, Heizung/Warmwasser je Wohnung", () => {
    expect(standardSchluessel("Grundsteuer")).toBe("flaeche");
    expect(standardSchluessel("Heizkosten lt. Messdienst")).toBe("direkt");
  });
});

describe("Server-Actions", () => {
  afterEach(() => {
    for (const x of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(x);
  });
  async function lade(init = {}) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    return { db, mod: await import("@/lib/actions/nkObjekt") };
  }
  const roh = { bezeichnung: "Müll", betrag: "600", schluessel: "flaeche", umlagefaehig: true };

  it("fremdes Objekt: nichts geschrieben", async () => {
    const { db, mod } = await lade({ antworten: { properties: null } });
    expect(await mod.speichereNkKosten("p1", 2025, roh)).toEqual({ error: "Objekt nicht gefunden." });
    expect(db.zugriffe.some((z) => z.tabelle === "nk_objekt_kosten")).toBe(false);
  });
  it("Anlegen schreibt Konto, Objekt, Jahr und den GEPRÜFTEN Betrag", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p1" }, mieter: [], nk_objekt_kosten: { id: "n1" } } });
    expect(await mod.speichereNkKosten("p1", 2025, { ...roh, betrag: "1.200,00" })).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "nk_objekt_kosten" && x.op === "insert")!;
    expect(z.daten).toMatchObject({ user_id: "nutzer-1", prop_id: "p1", jahr: 2025, betrag: 1200, quelle: "manuell" });
  });
  it("Ändern filtert auf id, Objekt und Konto", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p1" }, mieter: [], nk_objekt_kosten: { id: "n1" } } });
    await mod.speichereNkKosten("p1", 2025, { ...roh, id: "n1" });
    const z = db.zugriffe.find((x) => x.tabelle === "nk_objekt_kosten" && x.op === "update")!;
    expect(z.filter).toEqual(expect.arrayContaining(["eq:id=n1", "eq:prop_id=p1", "eq:user_id=nutzer-1"]));
  });
  it("fehlende Tabelle → verständliche Meldung statt Fehlercode", async () => {
    const { mod } = await lade({ antworten: { properties: { id: "p1" }, mieter: [] }, fehlerBei: { "nk_objekt_kosten:insert": { message: "x", code: "PGRST205" } } });
    expect(await mod.speichereNkKosten("p1", 2025, roh)).toEqual({ error: expect.stringMatching(/eingerichtet/) });
  });
  it("Vorschläge aus Buchungen: Beträge rechnet der Server, Vorhandenes wird nicht doppelt angelegt", async () => {
    const { db, mod } = await lade({
      antworten: {
        properties: { id: "p1" }, mieter: [],
        kosten: [
          { prop_id: "p1", buchungsdatum: "2025-03-01", kategorie: "Grundsteuer", betrag: 300 },
          { prop_id: "p1", buchungsdatum: "2025-06-01", kategorie: "Grundsteuer", betrag: 300 },
          { prop_id: "p1", buchungsdatum: "2025-04-01", kategorie: "Müll", betrag: 200 },
        ],
      },
      antwortFolge: { "nk_objekt_kosten:select": [[{ bezeichnung: "Müllabfuhr" }]], "nk_objekt_kosten:insert": [[{ id: "n1" }]] },
    });
    expect(await mod.uebernehmeNkVorschlaege("p1", 2025, "buchungen")).toEqual({ ok: true, anzahl: 1 });
    const z = db.zugriffe.find((x) => x.tabelle === "nk_objekt_kosten" && x.op === "insert")!;
    const zeilen = Array.isArray(z.daten) ? z.daten : [z.daten];
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({ bezeichnung: "Grundsteuer", betrag: 600, quelle: "buchungen", prop_id: "p1", jahr: 2025 });
  });
  it("KI-Import übernimmt nur Positionen MIT Gesamtbetrag des Hauses", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p1" }, mieter: [] }, antwortFolge: { "nk_objekt_kosten:select": [[]], "nk_objekt_kosten:insert": [[{ id: "n1" }]] } });
    await mod.uebernehmeNkKi("p1", 2025, JSON.stringify([{ name: "Wasser", gesamt: 1800, anteil: 300 }, { name: "Strom", gesamt: null, anteil: 90 }]));
    const z = db.zugriffe.find((x) => x.tabelle === "nk_objekt_kosten" && x.op === "insert")!;
    const zeilen = Array.isArray(z.daten) ? z.daten : [z.daten];
    expect(zeilen.map((r) => (r as { bezeichnung: string; betrag: number }).betrag)).toEqual([1800]);
  });
});

describe("Verdrahtung", () => {
  it("Altbestand und Objekt-Kosten mischen sich nie: Objekt-Kosten schlagen die Mieter-Positionen", () => {
    const s = lies("lib/nkPositionen.ts");
    expect(s).toMatch(/if \(!daten\.bereit \|\| daten\.kosten\.length === 0\) return altbestand\(daten\.bereit\);/);
    expect(s).toMatch(/positionen: positionenFuerMieter\(e, mieter\.id\),\s*quelle: "objekt"/);
  });
  it("der alte Verteiler leitet um, sobald die Kosten am Objekt erfasst werden", () => {
    expect(lies("app/(app)/properties/[id]/umlage/page.tsx")).toMatch(/if \(await nkAmObjekt\(supabase, id\)\) redirect\(`\/properties\/\$\{id\}\/nebenkosten`\)/);
  });
  it("„Mieter bearbeiten“ zeigt beim Mehrfamilienhaus den Weg zum Objekt, Positionen nur als Altbestand", () => {
    const s = lies("app/(app)/tenants/[id]/edit/page.tsx");
    expect(s).toMatch(/nebenkosten\?jahr=\$\{nkJahr\}/);
    expect(s).toMatch(/\{!amObjekt && <div style=\{\{ marginTop: 24 \}\}>/);
  });
  it("Migration: Kaskade auf Konto UND Objekt, Demo darf lesen, nicht schreiben", () => {
    const s = lies("supabase/migrations/20261007090000_nk_objekt.sql");
    expect(s.match(/references auth\.users \(id\) on delete cascade/g)).toHaveLength(2);
    expect(s.match(/references public\.properties \(id\) on delete cascade/g)).toHaveLength(2);
    expect(s).toMatch(/for each statement execute function public\.demo_schreibsperre\(\)/);
    expect(s).not.toMatch(/as restrictive for all/);
  });
});
