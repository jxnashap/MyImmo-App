import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { steuerWaechter, anlageVVergleich, SPEKULATION_BALD_TAGE } from "@/lib/steuer/waechter";
import { vergleichsmieteFuer } from "@/lib/steuer/verbilligt";
import type { AnlageVObjekt } from "@/lib/anlageV";

// Ausbau-Paket vom 02.10.2026 (Recherche „stärkste Funktionen“, Punkte 1–6).

const HEUTE = new Date("2026-10-02T00:00:00Z");

describe("(1) Steuer-Wächter über alle Objekte", () => {
  const obj = (id: string, x: Record<string, unknown> = {}) => ({ id, bezeichnung: id, typ: "ETW", kaufpreis: 200000, kaufdatum: "2025-01-15", afa_gebaeudeanteil: 80, ...x });
  const kosten = (prop: string, betrag: number, kategorie = "Reparatur", buchungsdatum = "2026-03-01") => ({ prop_id: prop, betrag, kategorie, buchungsdatum });

  it("rechnet je Objekt mit SEINEN Kosten — fremde Kosten zählen nicht", () => {
    // Grenze: 200.000 × 80 % × 15 % = 24.000
    const z = steuerWaechter([obj("A"), obj("B")], [kosten("A", 23000), kosten("B", 100)], HEUTE);
    const a = z.find((x) => x.id === "A")!;
    const b = z.find((x) => x.id === "B")!;
    expect(a.anschaffungsnah).toMatchObject({ status: "warnung", kostenImFenster: 23000, grenze: 24000 });
    expect(b.anschaffungsnah).toMatchObject({ status: "ok", kostenImFenster: 100 });
  });

  it("Achtung (Warnung/Überschreitung/Frist ≤ 1 Jahr) steht oben, sonst Reihenfolge der Objekte", () => {
    const z = steuerWaechter([
      obj("ruhig"),
      obj("bald", { kaufdatum: "2016-11-01" }), // steuerfrei ab 02.11.2026 → < 365 Tage
      obj("drueber"),
    ], [kosten("drueber", 30000)], HEUTE);
    expect(z.map((x) => [x.id, x.achtung])).toEqual([["bald", true], ["drueber", true], ["ruhig", false]]);
    expect(z[0].spekulation.tageVerbleibend).toBeLessThanOrEqual(SPEKULATION_BALD_TAGE);
  });

  it("Grundstück: kein 15 %-Wächter; ohne Kaufdatum: Frist inaktiv, keine Achtung", () => {
    const z = steuerWaechter([obj("G", { typ: "Grundstück" }), obj("X", { kaufdatum: null })], [], HEUTE);
    expect(z.find((x) => x.id === "G")!.anschaffungsnah).toBeNull();
    const x = z.find((y) => y.id === "X")!;
    expect(x.spekulation.aktiv).toBe(false);
    expect(x.achtung).toBe(false);
  });

  it("steht auf /steuer unter dem Seitenkopf und nutzt den Berliner Stichtag", () => {
    const seite = readFileSync("app/(app)/steuer/page.tsx", "utf8");
    expect(seite).toContain("waechter={<SteuerWaechter zeilen={waechter} />}");
    expect(seite).toContain("new Date(`${heuteBerlin()}T00:00:00Z`)");
  });
});

describe("(1) Anlage V im Vergleich zum Vorjahr", () => {
  const o = (miete: number, erhaltung: number, umlagen = 0): AnlageVObjekt => ({
    propId: null, name: "Gesamt", adresse: null,
    einnahmen: { miete, umlagen, umlagenAbrechnung: 0, sonstige: 0, summe: miete + umlagen },
    werbungskosten: { afa: 0, schuldzinsen: 0, erhaltung, verwaltung: 0, grundsteuer: 0, versicherung: 0, betriebskosten: 0, hausgeldSonstige: 0, summe: erhaltung },
    ueberschuss: miete + umlagen - erhaltung, afaBasis: 0, afaSatz: 0, afaMethode: "auto", schuldzinsenGeschaetzt: false, hinweise: [],
  });

  it("Veränderung in € und %, „neu“ (null) ohne Vorjahresbasis; leere Positionen fallen weg", () => {
    const v = anlageVVergleich(o(12000, 3000, 500), o(10000, 0));
    expect(v).toEqual([
      { label: "Mieteinnahmen (kalt)", vorjahr: 10000, jahr: 12000, delta: 2000, prozent: 20 },
      { label: "Umlagen", vorjahr: 0, jahr: 500, delta: 500, prozent: null },
      { label: "Erhaltungsaufwand", vorjahr: 0, jahr: 3000, delta: 3000, prozent: null },
      { label: "Überschuss", vorjahr: 10000, jahr: 9500, delta: -500, prozent: -5 },
    ]);
  });

  it("Verlust im Vorjahr: Prozent bezieht sich auf den Betrag, nicht aufs Vorzeichen", () => {
    const u = anlageVVergleich(o(1000, 0), o(0, 2000)).find((z) => z.label === "Überschuss")!;
    expect(u).toMatchObject({ vorjahr: -2000, jahr: 1000, delta: 3000, prozent: 150 });
  });
});

describe("(6) Vergleichsmiete: Mieter vor Objekt", () => {
  it("Mieterwert gewinnt; ohne ihn der Objektwert; ohne beide keine Ampel", () => {
    expect(vergleichsmieteFuer(9.5, 8)).toEqual({ wert: 9.5, quelle: "mieter" });
    expect(vergleichsmieteFuer(null, 8)).toEqual({ wert: 8, quelle: "objekt" });
    expect(vergleichsmieteFuer(0, 8)).toEqual({ wert: 8, quelle: "objekt" });
    expect(vergleichsmieteFuer(null, null)).toBeNull();
    expect(vergleichsmieteFuer(0, 0)).toBeNull();
  });
  it("die Mieterseite lädt den Objektwert und sagt, woher die Zahl kommt", () => {
    const seite = readFileSync("app/(app)/tenants/[id]/page.tsx", "utf8");
    expect(seite).toContain('select("bezeichnung,vergleichsmiete_m2")');
    expect(seite).toContain("vergleichsmieteFuer(m.mietspiegel, objektVergleich)");
    expect(seite).toContain("quelle={vergleich.quelle}");
  });
});

describe("(5) Beleihungsauslauf je Objekt", async () => {
  const { beleihungsauslauf } = await import("@/lib/beleihungsauslauf");
  const o = (id: string, x: Record<string, unknown> = {}) => ({ id, bezeichnung: id, wert: null, kaufpreis: 200000, indexwert: null, ...x });

  it("summiert die Darlehen je Objekt; Wert: gepflegt vor Index vor Kaufpreis", () => {
    const z = beleihungsauslauf(
      [o("A", { wert: 300000, indexwert: 250000 }), o("B", { indexwert: 250000 }), o("C")],
      [
        { prop_id: "A", restschuld: 100000, grundschuld: 150000 },
        { prop_id: "A", restschuld: 50000, grundschuld: null },
        { prop_id: "B", restschuld: 175000, grundschuld: 0 },
        { prop_id: "C", restschuld: 180000, grundschuld: 160000 },
      ],
    );
    expect(z.map((x) => [x.propId, x.restschuld, x.wert, x.wertQuelle, x.auslaufProzent, x.stufe, x.freieGrundschuld, x.kredite])).toEqual([
      ["A", 150000, 300000, "gepflegt", 50, "niedrig", 0, 2],     // Grundschuld 150.000 < Restschuld 150.000 → 0, nie negativ
      ["B", 175000, 250000, "index", 70, "mittel", null, 1],     // Grundschuld 0 = nicht eingetragen
      ["C", 180000, 200000, "kaufpreis", 90, "hoch", 0, 1],
    ]);
  });

  it("freie Grundschuld = Grundschuld − Restschuld; Grenzen 60 % / 80 % gehören zur unteren Stufe", () => {
    const z = beleihungsauslauf([o("A", { wert: 100000 }), o("B", { wert: 100000 })], [
      { prop_id: "A", restschuld: 60000, grundschuld: 90000 },
      { prop_id: "B", restschuld: 80000, grundschuld: null },
    ]);
    expect(z.map((x) => [x.stufe, x.freieGrundschuld])).toEqual([["niedrig", 30000], ["mittel", null]]);
  });

  it("Objekte ohne Darlehen erscheinen nicht; ohne jeden Wert: unbekannt", () => {
    const z = beleihungsauslauf([o("ohne"), o("X", { kaufpreis: null })], [{ prop_id: "X", restschuld: 1000, grundschuld: null }]);
    expect(z.map((x) => [x.propId, x.stufe, x.auslaufProzent])).toEqual([["X", "unbekannt", null]]);
  });

  it("die Kreditseite sagt, dass es eine Schätzung ist", () => {
    const s = readFileSync("app/(app)/kredite/page.tsx", "utf8");
    expect(s).toContain("Richtwert, keine Bankbewertung");
    expect(s).toContain("fortschreibeKaufpreis(p.kaufpreis, p.kaufdatum ?? null, hpi.reihe)");
  });
});

describe("(2) Objekt-Check", async () => {
  const { objektCheck } = await import("@/lib/objektCheck");
  const H = "2026-10-02";
  const voll = { id: "o1", typ: "ETW", adresse: "Weg 1", kaufpreis: 200000, kaufdatum: "2020-01-01", flaeche: 70, baujahr: 1990, afa_gebaeudeanteil: 80, vergleichsmiete_m2: 9, obj_status: "Vermietet" };
  const mieter = [{ id: "m1", prop_id: "o1", mietbeginn: "2021-01-01", mietende: null }];
  const kredit = [{ id: "k1", prop_id: "o1", auszahlung_datum: "2020-01-10" }];

  it("gepflegtes, vermietetes, finanziertes Objekt: 10 von 10 (der Normalfall)", () => {
    const c = objektCheck(voll, mieter, kredit, H);
    expect([c.erfuellt, c.gesamt, c.fehlend]).toEqual([10, 10, []]);
  });

  it("was nicht gilt, zählt nicht: Leerstand ohne Mieter, ohne Kredit, Grundstück ohne Gebäudeanteil", () => {
    expect(objektCheck({ ...voll, obj_status: "Leer" }, [], [], H).gesamt).toBe(6);
    // Grundstück: ohne Gebäudeanteil, und seit P8 (C16) auch ohne Wohnfläche und Baujahr.
    expect(objektCheck({ ...voll, obj_status: "Leer", typ: "Grundstück" }, [], [], H).gesamt).toBe(3);
    // Ausgezogener Mieter zählt nicht als laufend
    expect(objektCheck({ ...voll, obj_status: "Leer" }, [{ ...mieter[0], mietende: "2026-01-31" }], [], H).gesamt).toBe(6);
  });

  it("fehlende Angaben mit Ziel: ein Mieter/Kredit → dessen Bearbeiten-Seite, mehrere → Liste", () => {
    const c = objektCheck({ ...voll, kaufdatum: null }, [{ ...mieter[0], mietbeginn: null }], [{ ...kredit[0], auszahlung_datum: null }], H);
    expect(c.fehlend.map((f) => [f.schluessel, f.href])).toEqual([
      ["kaufdatum", "/properties/o1/edit"],
      ["mietbeginn", "/tenants/m1/edit"],
      ["auszahlung", "/kredite/k1/edit"],
    ]);
    const zwei = objektCheck(voll, [{ ...mieter[0], mietbeginn: null }, { ...mieter[0], id: "m2", mietbeginn: null }], [], H);
    expect(zwei.fehlend.find((f) => f.schluessel === "mietbeginn")!.href).toBe("/tenants");
  });

  it("„Vermietet“ ohne angelegten Mieter fordert einen Mieter (kein Mietbeginn-Punkt)", () => {
    const c = objektCheck(voll, [], [], H);
    expect(c.fehlend.map((f) => f.schluessel)).toEqual(["mieter"]);
    expect(c.punkte.some((p) => p.schluessel === "mietbeginn")).toBe(false);
  });

  it("Objektseite zeigt die Karte, die Liste das Kürzel; der alte Kaufdatum-Hinweis ist nicht doppelt da", () => {
    const seite = readFileSync("app/(app)/properties/[id]/page.tsx", "utf8");
    expect(seite).toContain("<ObjektCheckKarte check={objektCheck(");
    expect(seite).not.toContain("<strong>Kaufdatum fehlt.</strong>");
    expect(readFileSync("app/(app)/properties/page.tsx", "utf8")).toContain("{c.erfuellt}/{c.gesamt} Angaben");
  });
});

describe("(3) NK aus dem Vorjahr + Vorauszahlungsvorschlag", async () => {
  const { vorjahrUebernahme, vorauszahlungsVorschlag, gleicheBetraegeWieVorjahr } = await import("@/lib/nkVorjahr");
  const pos = (jahr: number | null, x: Record<string, unknown> = {}) => ({
    bezeichnung: "Grundsteuer", betrag: 300, umlageschluessel: "Fläche", umlagefaehig: true, jahr, aufteilung: "flaeche",
    verbrauch_mieter: 12, verbrauch_gesamt: 100, grundkosten_prozent: 30, flaeche_gesamt: 400, lohnanteil: 80, art_35a: "dienstleistung", ...x,
  });

  it("übernimmt Struktur und Beträge — Verbrauch und Lohnanteil bleiben leer", () => {
    const u = vorjahrUebernahme([pos(2024), pos(2025)], 2026);
    expect(u.moeglich).toBe(true);
    expect(u.anzahl).toBe(1);
    expect(u.zeilen[0]).toEqual({
      bezeichnung: "Grundsteuer", betrag: 300, jahr: 2026, umlageschluessel: "Fläche", umlagefaehig: true, aufteilung: "flaeche",
      grundkosten_prozent: 30, flaeche_gesamt: 400, art_35a: "dienstleistung", verbrauch_mieter: null, verbrauch_gesamt: null, lohnanteil: null,
    });
  });

  it("nicht, wenn das Jahr schon Positionen hat oder das Vorjahr keine; jahrlose zählen nicht", () => {
    expect(vorjahrUebernahme([pos(2025), pos(2026)], 2026).moeglich).toBe(false);
    expect(vorjahrUebernahme([pos(null)], 2026)).toMatchObject({ moeglich: false, anzahl: 0 });
  });

  it("Vorschlag: Monatsanteil aufgerundet, erst ab 5 € Unterschied", () => {
    expect(vorauszahlungsVorschlag(2401, 12, 150)).toEqual({ vorschlag: 201, differenz: 51 });
    expect(vorauszahlungsVorschlag(1800, 12, 154)).toBeNull(); // 150 vs 154: < 5 €
    expect(vorauszahlungsVorschlag(1200, 6, 250)).toEqual({ vorschlag: 200, differenz: -50 }); // Teiljahr
    expect(vorauszahlungsVorschlag(1200, 0, 100)).toBeNull();
  });

  it("Hinweis „noch Vorjahresbeträge“ nur bei exakt gleicher Liste", () => {
    expect(gleicheBetraegeWieVorjahr([pos(2025), pos(2026)], 2026)).toBe(true);
    expect(gleicheBetraegeWieVorjahr([pos(2025), pos(2026, { betrag: 310 })], 2026)).toBe(false);
    expect(gleicheBetraegeWieVorjahr([pos(2025)], 2026)).toBe(false);
  });
});

describe("(3) Aktion uebernehmeVorjahresPositionen", async () => {
  const { fakeSupabase, mockeNextUndSupabase } = await import("./stubs/actionHarness");
  const { vi } = await import("vitest");
  async function lade(init = {}) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    return { db, mod: await import("@/lib/actions/positions") };
  }
  const zeile = (jahr: number) => ({ bezeichnung: "Müll", betrag: 120, umlageschluessel: null, umlagefaehig: true, jahr, aufteilung: null, grundkosten_prozent: null, flaeche_gesamt: null, art_35a: null });

  it("liest nur eigene Positionen dieses Mieters und fügt Kopien mit Konto/Mieter ein", async () => {
    const { db, mod } = await lade({ antworten: { mieter_positionen: [zeile(2025)] } });
    expect(await mod.uebernehmeVorjahresPositionen("m1", 2026)).toEqual({ ok: true, anzahl: 1 });
    const sel = db.zugriffe.find((z) => z.tabelle === "mieter_positionen" && z.op === "select")!;
    expect(sel.filter).toEqual(expect.arrayContaining(["eq:mieter_id=m1", "eq:user_id=nutzer-1", "in:jahr=2026,2025"]));
    const ins = db.zugriffe.find((z) => z.op === "insert")!.daten as unknown as Record<string, unknown>[];
    expect(ins[0]).toMatchObject({ user_id: "nutzer-1", mieter_id: "m1", jahr: 2026, verbrauch_mieter: null });
  });
  it("Lesefehler bricht ab (sonst entstünde eine zweite Liste); vorhandenes Jahr wird nicht überschrieben", async () => {
    // Mit Daten UND Fehler: ohne die Fehlerprüfung würde trotzdem eingefügt.
    const { db, mod } = await lade({ antworten: { mieter_positionen: [zeile(2025)] }, fehlerBei: { "mieter_positionen:select": { message: "x" } } });
    expect(await mod.uebernehmeVorjahresPositionen("m1", 2026)).toEqual({ error: "Positionen konnten nicht gelesen werden." });
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
    const { db: d2, mod: m2 } = await lade({ antworten: { mieter_positionen: [zeile(2025), zeile(2026)] } });
    expect(await m2.uebernehmeVorjahresPositionen("m1", 2026)).toEqual({ error: "Für 2026 gibt es schon Positionen." });
    expect(d2.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });
});
