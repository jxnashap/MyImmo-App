import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { nkAusBuchungen } from "@/lib/nkAusBuchungen";
import { zaehlerSpanne } from "@/lib/zaehlerSpanne";
import { mieterFristen, nkErstellteJahre } from "@/lib/fristen";
import { KOSTEN_KATEGORIEN, UEBERNAHME_KATEGORIEN } from "@/lib/kategorien";
import { istUmlagefaehig } from "@/lib/format";

// Verknüpfungs-Audit 06.10.2026, Paket C — Kreislauf der Nebenkostenabrechnung.

const k = (kategorie: string, betrag: number, datum = "2025-03-01", prop = "p1") => ({ prop_id: prop, buchungsdatum: datum, kategorie, betrag });

describe("C1 — gebuchte Kosten → NK-Vorschlag", () => {
  it("summiert je Bezeichnung, nur dieses Objekt und Jahr, nur umlagefähig", () => {
    const r = nkAusBuchungen([
      k("Grundsteuer", 120), k("Grundsteuer", 120, "2025-08-15"), k("Grundsteuer", 999, "2024-12-31"),
      k("Versicherung", 300), k("Müll", 80), k("Reparatur", 500), k("Grundsteuer", 50, "2025-01-01", "p2"),
      k("Hausgeld / WEG", 3000),
    ], "p1", 2025);
    expect(r.vorschlaege).toEqual([
      { bezeichnung: "Gebäudeversicherung", kategorie: "Versicherung", betrag: 300, anzahl: 1 },
      { bezeichnung: "Grundsteuer", kategorie: "Grundsteuer", betrag: 240, anzahl: 2 },
      { bezeichnung: "Müllabfuhr", kategorie: "Müll", betrag: 80, anzahl: 1 },
    ]);
    expect(r.unklar).toEqual([{ kategorie: "Hausgeld / WEG", betrag: 3000 }]);
  });
  it("die Betriebskosten-Kategorien sind buchbar und gelten als umlagefähig", () => {
    for (const kat of ["Müll", "Wasser / Abwasser", "Hausmeister", "Heizung", "Schornsteinfeger"]) {
      expect(KOSTEN_KATEGORIEN as readonly string[], kat).toContain(kat);
      expect(istUmlagefaehig(kat), kat).toBe("ja");
    }
    expect(UEBERNAHME_KATEGORIEN as readonly string[]).toContain("Hausmeister");
  });
  it("Verteiler und NK-Seite bieten die Übernahme an", () => {
    expect(readFileSync("components/UmlageAssistent.tsx", "utf8")).toMatch(/nkAusBuchungen\(gebuchteKosten, propId, jahr\)/);
    expect(readFileSync("app/(app)/properties/[id]/umlage/page.tsx", "utf8")).toMatch(/gebuchteKosten=\{kosten \?\? \[\]\}/);
    // Stufe 1: beim Mehrfamilienhaus bietet die Objektseite die Übernahme an, nicht der Mieter.
    expect(readFileSync("app/(app)/tenants/[id]/nk/page.tsx", "utf8")).toMatch(/ausBuchungen=\{!amObjekt && offeneVorschlaege\.length > 0/);
    expect(readFileSync("app/(app)/properties/[id]/nebenkosten/page.tsx", "utf8")).toMatch(/nkAusBuchungen\(buchungen \?\? \[\], id, jahr\)/);
  });
});

describe("C2 — Zählerstände je Zähler", () => {
  it("erster bis letzter Stand, je Zählernummer getrennt", () => {
    const r = zaehlerSpanne([
      { art: "Wasser", zaehlernummer: "A", stand: 100, einheit: "m³", ablesedatum: "2025-01-02" },
      { art: "Wasser", zaehlernummer: "A", stand: 145.5, einheit: "m³", ablesedatum: "2025-12-30" },
      { art: "Wasser", zaehlernummer: "B", stand: 10, einheit: "m³", ablesedatum: "2025-06-01" },
      { art: "Wasser", zaehlernummer: "B", stand: 12, einheit: "m³", ablesedatum: "2025-09-01" },
    ], 2025);
    expect(r.find((z) => z.zaehlernummer === "A")).toMatchObject({ verbrauch: 45.5, ganzesJahr: true });
    expect(r.find((z) => z.zaehlernummer === "B")).toMatchObject({ verbrauch: 2, ganzesJahr: false });
  });
  it("ein Stand allein oder ein fallender Zähler (Tausch) ergibt nichts", () => {
    expect(zaehlerSpanne([{ art: "Strom", stand: 5, einheit: "kWh", ablesedatum: "2025-03-01" }], 2025)).toEqual([]);
    expect(zaehlerSpanne([
      { art: "Strom", stand: 900, einheit: "kWh", ablesedatum: "2025-01-01" },
      { art: "Strom", stand: 10, einheit: "kWh", ablesedatum: "2025-12-31" },
    ], 2025)).toEqual([]);
  });
});

describe("C3 — Frist „NK zustellen“", () => {
  const j = new Date().getFullYear();
  const basis = { mietbeginn: "2020-01-01", kuendigung: 3, letzte_erhoehung: null };
  const nkFrist = (f: { label: string }[]) => f.find((x) => x.label === `NK-Abrechnung ${j - 1} zustellen`);
  it("gilt auch für einen Mieter, der im Vorjahr ausgezogen ist", () => {
    expect(nkFrist(mieterFristen({ ...basis, mietende: `${j - 1}-06-30` }))).toBeTruthy();
  });
  it("nicht für einen, der schon VOR dem Vorjahr ausgezogen ist", () => {
    expect(nkFrist(mieterFristen({ ...basis, mietende: `${j - 2}-12-31` }))).toBeUndefined();
  });
  it("entfällt, sobald die Abrechnung des Vorjahres im Archiv liegt", () => {
    expect(nkFrist(mieterFristen({ ...basis, mietende: null }))).toBeTruthy();
    expect(nkFrist(mieterFristen({ ...basis, mietende: null }, { nkErstellt: [j - 1] }))).toBeUndefined();
    expect(nkFrist(mieterFristen({ ...basis, mietende: null }, { nkErstellt: [j - 2] }))).toBeTruthy();
  });
  it("nkErstellteJahre liest das Jahr aus dem Archiv-Titel", () => {
    const m = nkErstellteJahre([
      { mieter_id: "a", titel: "Nebenkostenabrechnung 2025" },
      { mieter_id: "a", titel: "Mahnung" },
      { mieter_id: null, titel: "Nebenkostenabrechnung 2024" },
    ]);
    expect(m.get("a")).toEqual([2025]);
  });
  it("Dashboard, /termine, iCal und Mieterseite reichen die Jahre durch", () => {
    for (const p of ["app/(app)/page.tsx", "app/(app)/termine/page.tsx", "app/(app)/termine/ical/route.ts", "app/(app)/tenants/[id]/page.tsx"]) {
      expect(readFileSync(p, "utf8"), p).toMatch(/mieterFristen\(m, \{ nkErstellt: /);
    }
  });
  it("Nachzahlung buchen: Link vorausgefüllt, Ziel prüft Kategorie, Betrag und Mieter", () => {
    expect(readFileSync("app/(app)/tenants/[id]/nk/page.tsx", "utf8")).toMatch(/kategorie: "Nebenkostenabrechnung"/);
    const neu = readFileSync("app/(app)/cashflow/neu/page.tsx", "utf8");
    expect(neu).toMatch(/\.includes\(searchParams\.kategorie/);
    expect(neu).toMatch(/\(miet \?\? \[\]\)\.some\(\(m\) => m\.id === searchParams\.mieter\)/);
  });
});

// --------------------------------------------------------------- Actions ----

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
const zeilen = (db: Db, t: string) => ops(db, t, "insert").flatMap((z) => (Array.isArray(z.daten) ? z.daten : [z.daten])) as Record<string, unknown>[];

describe("C1 — uebernehmeGebuchteKosten (eine Mietpartei)", () => {
  const MIETER = { prop_id: "p1", mietbeginn: "2020-01-01", mietende: null };
  const init = (extra: Record<string, unknown> = {}) => ({
    antworten: {
      mieter: MIETER,
      properties: { typ: "Eigentumswohnung", einheiten_anzahl: 1 },
      kosten: [k("Grundsteuer", 240), k("Müll", 80), k("Reparatur", 500)],
      mieter_positionen: [],
      ...extra,
    },
    zaehler: { mieter: 1 },
  });
  it("legt die umlagefähigen als Positionen an (ganzes Jahr = voll)", async () => {
    const { db, mod } = await lade("@/lib/actions/positions", init());
    expect(await mod.uebernehmeGebuchteKosten("m1", 2025)).toEqual({ ok: true, anzahl: 2 });
    const z = zeilen(db, "mieter_positionen");
    expect(z.map((x) => x.bezeichnung).sort()).toEqual(["Grundsteuer", "Müllabfuhr"]);
    expect(z[0]).toMatchObject({ jahr: 2025, umlagefaehig: true, aufteilung: "voll", mieter_id: "m1", user_id: "nutzer-1" });
  });
  it("unterjährig eingezogen → Aufteilung nach Belegungstagen", async () => {
    const { db, mod } = await lade("@/lib/actions/positions", init({ mieter: { ...MIETER, mietbeginn: "2025-07-01" } }));
    await mod.uebernehmeGebuchteKosten("m1", 2025);
    expect(zeilen(db, "mieter_positionen")[0]).toMatchObject({ aufteilung: "zeit" });
  });
  it("vorhandene Positionen gleichen Namens bleiben, keine Duplikate", async () => {
    const { db, mod } = await lade("@/lib/actions/positions", init({ mieter_positionen: [{ bezeichnung: "grundsteuer" }] }));
    expect(await mod.uebernehmeGebuchteKosten("m1", 2025)).toEqual({ ok: true, anzahl: 1 });
    expect(zeilen(db, "mieter_positionen").map((x) => x.bezeichnung)).toEqual(["Müllabfuhr"]);
  });
  it("mehrere Mietparteien → Verweis auf den Verteiler, nichts geschrieben", async () => {
    const { db, mod } = await lade("@/lib/actions/positions", { ...init(), zaehler: { mieter: 3 } });
    expect("error" in (await mod.uebernehmeGebuchteKosten("m1", 2025))).toBe(true);
    expect(ops(db, "mieter_positionen", "insert")).toHaveLength(0);
  });
  it("Lesefehler der Positionen → nichts übernommen (sonst Duplikate)", async () => {
    const { db, mod } = await lade("@/lib/actions/positions", { ...init(), fehlerBei: { "mieter_positionen:select": { message: "x" } } });
    expect("error" in (await mod.uebernehmeGebuchteKosten("m1", 2025))).toBe(true);
    expect(ops(db, "mieter_positionen", "insert")).toHaveLength(0);
  });
});

describe("C4 — Auftrag → Kosten: Rechnungsdatum und Betriebskosten-Kategorie", () => {
  const ERLEDIGT = { titel: "Gartenpflege", objekt_name: "Haus", prop_id: "p1", betrag: 300, lohnanteil: 200, rechnung_name: null, rechnung_type: null, rechnung_data: null, kosten_id: null, status: "erledigt", service_user_id: "s1" };
  // Als Funktion: `antwortFolge` wird beim Lesen abgeräumt — ein geteiltes Objekt wäre im zweiten Test leer.
  const init = () => ({ antwortFolge: { auftraege: [ERLEDIGT], service_zugaenge: [{ firma: "Grün GmbH", email: null }], kosten: [{ id: "k1" }] } });
  it("bucht zum angegebenen Rechnungsdatum in die gewählte Betriebskosten-Kategorie", async () => {
    const { db, mod } = await lade("@/lib/actions/service", init());
    await mod.uebernimmAuftragAlsKosten(fd({ id: "a1", kategorie: "Gartenpflege", buchungsdatum: "2025-12-18" }));
    expect(zeilen(db, "kosten")[0]).toMatchObject({ buchungsdatum: "2025-12-18", kategorie: "Gartenpflege" });
  });
  it("ungültiges Datum → heute; fremde Kategorie → Reparatur", async () => {
    const { db, mod } = await lade("@/lib/actions/service", init());
    await mod.uebernimmAuftragAlsKosten(fd({ id: "a1", kategorie: "Erfunden", buchungsdatum: "18.12.2025" }));
    expect(zeilen(db, "kosten")[0]).toMatchObject({ buchungsdatum: new Date().toISOString().slice(0, 10), kategorie: "Reparatur" });
  });
});
