// WEG-Erhaltungsrücklage (10.10.2026). BFH, Urteil vom 14.01.2025, IX R 19/24 (BStBl 2025 II S. 291):
// Die Zuführung zur Erhaltungsrücklage ist keine Werbungskosten; abziehbar ist erst die Entnahme für eine
// Erhaltung. Der Vordruck Anlage V 2025: „Nicht umgelegte Kosten (… – ohne Erhaltungsrücklage –)“,
// Erhaltungsaufwendungen „einschließlich Entnahmen aus der Erhaltungsrücklage“.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { berechneAnlageV, elsterZeilen, AFA_DEFAULT } from "@/lib/anlageV";
import {
  ruecklageImJahr, ruecklageListe, ruecklageEintragAus, mitRuecklageJahr, ohneRuecklageJahr, hatWeg, RUECKLAGE_FEHLT_HINWEIS,
} from "@/lib/wegRuecklage";
import type { Kosten, Property } from "@/lib/types";

const etw = (x: Partial<Property> = {}): Property => ({
  id: "p1", bezeichnung: "ETW Zentrum", adresse: null, typ: "Eigentumswohnung", kaufpreis: 200000, kaufdatum: "2020-01-15",
  baujahr: 1995, obj_status: "Vermietet", afa_gebaeudeanteil: 80, afa_methode: "keine", afa_start_jahr: null, afa_betrag: null, hausgeld: 300, ...x,
} as unknown as Property);
const hausgeld = (jahr: number, monate = 12, betrag = 300): Kosten[] =>
  Array.from({ length: monate }, (_, i) => ({
    id: `hg-${jahr}-${i}`, prop_id: "p1", buchungsdatum: `${jahr}-${String(i + 1).padStart(2, "0")}-01`, kategorie: "Hausgeld / WEG", betrag,
  }) as unknown as Kosten);
const av = (p: Property, kosten: Kosten[], jahr = 2025) => berechneAnlageV(jahr, [p], [], kosten, [], AFA_DEFAULT);

describe("Eingabe und Speicherform", () => {
  it("deutsche Beträge, leer = 0, Unsinn wird abgelehnt", () => {
    expect(ruecklageEintragAus("2025", "1.250,50", "")).toEqual({ jahr: 2025, wert: { zufuehrung: 1250.5, entnahme: 0 } });
    expect(ruecklageEintragAus("2025", "600", "400")).toEqual({ jahr: 2025, wert: { zufuehrung: 600, entnahme: 400 } });
    expect(ruecklageEintragAus("2025", "abc", "0")).toHaveProperty("fehler");
    expect(ruecklageEintragAus("25", "600", "0")).toHaveProperty("fehler");
    expect(ruecklageEintragAus("2025", "2.000.000", "0")).toHaveProperty("fehler");
    expect(ruecklageEintragAus("2025", "-5", "0")).toHaveProperty("fehler");
  });
  it("ein Jahr je Eintrag, neuestes zuerst; Ungültiges wird ignoriert", () => {
    const j = { "2024": { zufuehrung: 500, entnahme: 0 }, "2025": { zufuehrung: 600, entnahme: 250 }, kaputt: 1, "2023": { zufuehrung: -1, entnahme: 0 } };
    expect(ruecklageImJahr(j, 2025)).toEqual({ zufuehrung: 600, entnahme: 250 });
    expect(ruecklageImJahr(j, 2023)).toBeNull();
    expect(ruecklageImJahr(null, 2025)).toBeNull();
    expect(ruecklageListe(j).map((e) => e.jahr)).toEqual([2025, 2024]);
    expect(mitRuecklageJahr(j, 2024, { zufuehrung: 520, entnahme: 10 })["2024"]).toEqual({ zufuehrung: 520, entnahme: 10 });
    expect(Object.keys(ohneRuecklageJahr(j, 2024))).toEqual(["2025"]);
  });
  it("nur Objekte mit WEG zeigen die Eingabe", () => {
    expect(hatWeg({ typ: "Eigentumswohnung", hausgeld: null })).toBe(true);
    expect(hatWeg({ typ: "Mehrfamilienhaus", hausgeld: 0 })).toBe(false);
    expect(hatWeg({ typ: "Haus", hausgeld: 120 })).toBe(true);
    const seite = readFileSync("app/(app)/properties/[id]/page.tsx", "utf8");
    expect(seite).toMatch(/const wegSichtbar = hatWeg\(p\);/);
    expect(seite).toMatch(/\{wegSichtbar && \(\s*<WegRuecklage/);
  });
});

describe("Anlage V: Zuführung heraus, Entnahme zur Erhaltung", () => {
  it("3.600 € Hausgeld, 600 € Zuführung, 400 € Entnahme → 3.000 € Hausgeld, 400 € Erhaltung", () => {
    const o = av(etw({ weg_ruecklage: { "2025": { zufuehrung: 600, entnahme: 400 } } }), hausgeld(2025)).objekte[0];
    expect(o.werbungskosten.hausgeldSonstige).toBe(3000);
    expect(o.werbungskosten.erhaltung).toBe(400);
    expect(o.werbungskosten.summe).toBe(3400);
    expect(o.ruecklage).toEqual({ zufuehrung: 600, abgezogen: 600, entnahme: 400 });
    expect(o.hinweise).not.toContain(RUECKLAGE_FEHLT_HINWEIS);
  });
  it("nur das Jahr der Abrechnung zählt", () => {
    const o = av(etw({ weg_ruecklage: { "2024": { zufuehrung: 600, entnahme: 400 } } }), hausgeld(2025)).objekte[0];
    expect(o.werbungskosten.hausgeldSonstige).toBe(3600);
    expect(o.werbungskosten.erhaltung).toBe(0);
    expect(o.hinweise).toContain(RUECKLAGE_FEHLT_HINWEIS);
  });
  it("ohne Eintrag: Hinweis nur, wenn Hausgeld gebucht ist", () => {
    expect(av(etw(), hausgeld(2025)).objekte[0].hinweise).toContain(RUECKLAGE_FEHLT_HINWEIS);
    const ohne = av(etw(), [{ id: "x", prop_id: "p1", buchungsdatum: "2025-03-01", kategorie: "Verwaltung", betrag: 100 } as unknown as Kosten]).objekte[0];
    expect(ohne.hinweise).not.toContain(RUECKLAGE_FEHLT_HINWEIS);
  });
  it("Zuführung höher als das gebuchte Hausgeld: höchstens das Gebuchte heraus, mit Hinweis", () => {
    const o = av(etw({ weg_ruecklage: { "2025": { zufuehrung: 600, entnahme: 0 } } }), hausgeld(2025, 1)).objekte[0];
    expect(o.werbungskosten.hausgeldSonstige).toBe(0);
    expect(o.ruecklage?.abgezogen).toBe(300);
    expect(o.hinweise.join(" ")).toMatch(/fehlen Hausgeld-Buchungen/);
  });
  it("Entnahme ohne Hausgeld-Buchung im Jahr zählt trotzdem (die Gemeinschaft hat ausgegeben)", () => {
    const o = av(etw({ weg_ruecklage: { "2025": { zufuehrung: 0, entnahme: 1200 } } }), []).objekte[0];
    expect(o.werbungskosten.erhaltung).toBe(1200);
  });
  it("die Gesamtsumme trägt die Rücklage mit", () => {
    const e = av(etw({ weg_ruecklage: { "2025": { zufuehrung: 600, entnahme: 400 } } }), hausgeld(2025));
    expect(e.gesamt.ruecklage).toEqual({ zufuehrung: 600, abgezogen: 600, entnahme: 400 });
    expect(e.gesamt.werbungskosten.hausgeldSonstige).toBe(3000);
  });
  it("ELSTER-Hilfe sagt, was herausgerechnet bzw. enthalten ist", () => {
    const o = av(etw({ weg_ruecklage: { "2025": { zufuehrung: 600, entnahme: 400 } } }), hausgeld(2025)).objekte[0];
    const z = elsterZeilen(o, 2025);
    expect(z.find((x) => x.bezeichnung.startsWith("Hausgeld"))?.hinweis).toMatch(/600,00 €\) ist schon herausgerechnet/);
    expect(z.find((x) => x.bezeichnung.startsWith("Erhaltung"))?.hinweis).toMatch(/400,00 € Entnahmen aus der Erhaltungsrücklage/);
  });
  it("die Buchungen bleiben unverändert — Cashflow und Buchungssaldo kennen die Rücklage nicht", () => {
    for (const f of ["lib/cashflowKennzahl.ts", "lib/portfolioKennzahlen.ts", "lib/zeitraum.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/weg_ruecklage|wegRuecklage/);
    }
  });
});

describe("Aktion: speichern nur am eigenen Objekt", () => {
  const KEY = process.env.DATA_ENCRYPTION_KEY;
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    if (KEY !== undefined) process.env.DATA_ENCRYPTION_KEY = KEY;
    for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  });
  const lade = async (init: Record<string, unknown> = {}) => {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    return { db, mod: await import("@/lib/actions/properties") };
  };
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

  it("ergänzt das Jahr und lässt andere Jahre stehen", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "properties:select": [{ weg_ruecklage: { "2024": { zufuehrung: 500, entnahme: 0 } } }], "properties:update": [{ id: "p1" }] },
    });
    expect(await mod.setzeWegRuecklage("p1", fd({ jahr: "2025", zufuehrung: "600", entnahme: "400" }))).toEqual({ ok: true });
    const upd = db.zugriffe.find((z) => z.tabelle === "properties" && z.op === "update")!;
    expect(upd.daten).toEqual({ weg_ruecklage: { "2024": { zufuehrung: 500, entnahme: 0 }, "2025": { zufuehrung: 600, entnahme: 400 } } });
    expect(upd.filter).toContain("eq:user_id=nutzer-1");
  });
  it("ungültige Eingabe schreibt nichts", async () => {
    const { db, mod } = await lade();
    const r = await mod.setzeWegRuecklage("p1", fd({ jahr: "2025", zufuehrung: "viel", entnahme: "" }));
    expect(r.ok).toBe(false);
    expect(db.zugriffe.filter((z) => z.op === "update")).toHaveLength(0);
  });
  it("fremdes oder fehlendes Objekt: kein Schreiben", async () => {
    const { db, mod } = await lade({ antwortFolge: { "properties:select": [null] } });
    expect((await mod.setzeWegRuecklage("p9", fd({ jahr: "2025", zufuehrung: "600" }))).ok).toBe(false);
    expect(db.zugriffe.filter((z) => z.op === "update")).toHaveLength(0);
  });
  it("Entfernen nimmt nur das eine Jahr heraus", async () => {
    const { db, mod } = await lade({
      antwortFolge: {
        "properties:select": [{ weg_ruecklage: { "2024": { zufuehrung: 500, entnahme: 0 }, "2025": { zufuehrung: 600, entnahme: 0 } } }],
        "properties:update": [{ id: "p1" }],
      },
    });
    expect(await mod.entferneWegRuecklage("p1", 2024)).toEqual({ ok: true });
    expect(db.zugriffe.find((z) => z.op === "update")!.daten).toEqual({ weg_ruecklage: { "2025": { zufuehrung: 600, entnahme: 0 } } });
  });
});
