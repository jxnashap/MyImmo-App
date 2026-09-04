import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";

// lib/actions/properties.ts — Objekte anlegen, ändern, löschen.
//
// Zwei Dinge machen diese Datei besonders: Hier hängt die Tarif-Schranke
// (Einheiten-Limit, A5), und hier stecken zwei Regeln, die schon einmal
// stillschweigend Daten zerstört bzw. verfälscht haben:
//   * `notiz_import` wurde bei jedem Speichern geleert, weil das Formular das
//     Feld nicht mitschickt und `parse()` dafür null liefert.
//   * Eine geänderte Adresse muss die gecachten Koordinaten verwerfen, sonst
//     zeigt die Portfolio-Karte das Objekt dauerhaft am alten Ort.

const ENV = process.env.BILLING_ENFORCED;
beforeEach(() => {
  delete process.env.BILLING_ENFORCED;
  vi.resetModules();
});
afterEach(() => {
  if (ENV === undefined) delete process.env.BILLING_ENFORCED;
  else process.env.BILLING_ENFORCED = ENV;
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init = {}) {
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/properties");
  return { db, spuren, mod };
}

function schrieb(db: { zugriffe: { tabelle: string; daten?: Record<string, unknown> }[] }, tabelle: string) {
  return [...db.zugriffe].reverse().find((x) => x.tabelle === tabelle && x.daten)?.daten;
}

describe("Objekt anlegen", () => {
  it("die user_id kommt aus der Sitzung, nicht aus dem Formular", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p1" } } });
    await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "Haus", user_id: "fremd" })));
    expect(schrieb(db, "properties")?.user_id).toBe("nutzer-1");
  });

  it("springt direkt ins neue Objekt, nicht in die Liste", async () => {
    const { mod } = await lade({ antworten: { properties: { id: "p1" } } });
    const ziel = await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "Haus" })));
    expect(ziel).toContain("/properties/p1");
  });

  it("Komma-Zahlen aus dem Formular werden korrekt gelesen", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p1" } } });
    await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "H", flaeche: "82,5", kaufpreis: "250000" })));
    expect(schrieb(db, "properties")?.flaeche).toBe(82.5);
    expect(schrieb(db, "properties")?.kaufpreis).toBe(250000);
  });
});

describe("Die Tarif-Schranke am Einheiten-Limit", () => {
  it("Early Access: kein Limit, keine Abfrage der abos-Tabelle", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p1" } } });
    await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "H", einheiten_anzahl: "99" })));
    expect(db.zugriffe.some((z) => z.tabelle === "abos")).toBe(false);
    expect(schrieb(db, "properties")).toBeTruthy();
  });

  it("scharf geschaltet und über dem Limit: kein Insert, Meldung statt Anlage", async () => {
    process.env.BILLING_ENFORCED = "true";
    vi.resetModules();
    // Kein Abo -> "kostenlos" -> 1 Einheit. Ein bestehendes Objekt belegt sie.
    const { db, client } = fakeSupabase({
      antworten: { abos: null, properties: [{ einheiten_anzahl: 1 }] },
    });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/properties");

    const ziel = await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "Zweites Haus" })));
    expect(ziel).toContain("/properties?flash=");
    expect(decodeURIComponent(ziel)).toContain("Einheit");
    // Der eigentliche Punkt: nichts wurde angelegt.
    expect(db.zugriffe.some((z) => z.tabelle === "properties" && z.op === "insert")).toBe(false);
  });

  it("gezählt werden EINHEITEN, nicht Objekte", async () => {
    // Privat = 5 Einheiten. Ein Objekt mit 4 Einheiten belegt 4 — ein zweites
    // mit 2 wäre 6 und damit gesperrt, obwohl es erst das zweite OBJEKT ist.
    process.env.BILLING_ENFORCED = "true";
    vi.resetModules();
    const { db, client } = fakeSupabase({
      antworten: { abos: { plan: "privat", status: "aktiv" }, properties: [{ einheiten_anzahl: 4 }] },
    });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/properties");
    await fangeRedirect(() => mod.createProperty(fd({ bezeichnung: "H", einheiten_anzahl: "2" })));
    expect(db.zugriffe.some((z) => z.tabelle === "properties" && z.op === "insert")).toBe(false);
  });
});

describe("Objekt ändern: die zwei Regeln, die Daten schützen", () => {
  it("`notiz_import` wird NICHT geleert, wenn das Formular es nicht mitschickt", async () => {
    // Der Fehler, den diese Regel abstellt: Das Objekt-Formular hat kein Feld
    // `notiz_import`; `parse()` liefert dann null, und jedes Speichern löschte
    // die vom KI-Import erkannte Notiz.
    const { db, mod } = await lade({ antworten: { properties: { adresse: "Hauptstr. 1" } } });
    await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "H", adresse: "Hauptstr. 1" })));
    const daten = schrieb(db, "properties")!;
    expect("notiz_import" in daten).toBe(false);
  });

  it("wird `notiz_import` mitgeschickt, wird es geschrieben — auch leer", async () => {
    const { db, mod } = await lade({ antworten: { properties: { adresse: "A" } } });
    await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "H", adresse: "A", notiz_import: "" })));
    const daten = schrieb(db, "properties")!;
    expect("notiz_import" in daten).toBe(true);
    expect(daten.notiz_import).toBeNull();
  });

  it("geänderte Adresse verwirft die gecachten Koordinaten", async () => {
    const { db, mod } = await lade({ antworten: { properties: { adresse: "Alt 1" } } });
    await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "H", adresse: "Neu 2" })));
    const daten = schrieb(db, "properties")!;
    expect(daten.lat).toBeNull();
    expect(daten.lng).toBeNull();
  });

  it("unveränderte Adresse lässt die Koordinaten stehen", async () => {
    // Sonst würde jedes Speichern eine neue Geocodierung auslösen.
    const { db, mod } = await lade({ antworten: { properties: { adresse: "Gleich 1" } } });
    await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "H", adresse: "Gleich 1" })));
    const daten = schrieb(db, "properties")!;
    expect("lat" in daten).toBe(false);
  });

  it("landet nach dem Speichern auf dem Objekt, nicht in der Liste", async () => {
    const { mod } = await lade({ antworten: { properties: { adresse: "A" } } });
    const ziel = await fangeRedirect(() => mod.updateProperty("p1", fd({ bezeichnung: "H", adresse: "A" })));
    expect(ziel.startsWith("/properties/p1?")).toBe(true);
  });
});

describe("Wert-Übernahmen prüfen ihre Eingaben", () => {
  it("ein Indexwert ≤ 0 oder NaN wird abgelehnt", async () => {
    const { mod } = await lade();
    for (const wert of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(mod.uebernehmeIndexwert("p1", wert, "Q1/2026")).rejects.toThrow("Ungültiger Wert.");
    }
  });

  it("ein gültiger Indexwert wird gerundet gespeichert", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.uebernehmeIndexwert("p1", 312345.67, "Q1/2026"));
    const daten = schrieb(db, "properties")!;
    expect(daten.wert).toBe(312346);
    expect(daten.marktwert_aktuell).toBe(312346);
  });

  it("der AfA-Gebäudeanteil muss zwischen 0 und 100 liegen", async () => {
    const { mod } = await lade();
    for (const p of [0, -5, 100.1, Number.NaN]) {
      expect((await mod.uebernehmeAfaGebaeudeanteil("p1", p)).ok).toBe(false);
    }
    expect((await mod.uebernehmeAfaGebaeudeanteil("p1", 100)).ok).toBe(true);
  });

  it("der Gebäudeanteil wird auf eine Nachkommastelle gerundet", async () => {
    const { db, mod } = await lade();
    await mod.uebernehmeAfaGebaeudeanteil("p1", 78.4567);
    expect(schrieb(db, "properties")?.afa_gebaeudeanteil).toBe(78.5);
  });
});
