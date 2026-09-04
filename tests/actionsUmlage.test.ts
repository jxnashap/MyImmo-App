import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// lib/actions/umlage.ts — die Nebenkosten-Verteilung.
//
// WARUM DIESE DATEI ZUERST: In ihr stecken drei Fehler, die schon einmal Daten
// beschädigt haben und deren Korrektur nur als Kommentar dokumentiert war:
//
//   1. Die geänderten Wohnflächen wurden VOR der Verteilung geschrieben.
//      Schlug die Verteilung fehl, waren die Stammdaten trotzdem überschrieben.
//   2. Löschen und Einfügen der Positionen waren zwei getrennte Aufrufe. Ging
//      der Insert schief, war die Vorjahresverteilung bereits gelöscht.
//   3. Fehler beim Flächen-Schreiben wurden verschluckt.
//
// Die Rechenlogik selbst (`berechneUmlage`) hat eigene Tests. Hier geht es um
// die Orchestrierung drumherum — genau die Stelle, an der die drei Fehler saßen.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

/** Zwei Mieter im Objekt p1, ganzjährig, je 50 m². */
const DB_MIETER = [
  { id: "m1", vorname: "Anna", nachname: "Meyer", einheit: "WE 1", flaeche: 50, mietbeginn: null, mietende: null },
  { id: "m2", vorname: "Bert", nachname: "Klein", einheit: "WE 2", flaeche: 50, mietbeginn: null, mietende: null },
];

async function lade(init: Record<string, unknown> = {}) {
  const { db, client } = fakeSupabase({
    antworten: { properties: { flaeche: 100 }, mieter: DB_MIETER },
    ...init,
  });
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/umlage");
  return { db, spuren, mod };
}

function eingabe(over: Record<string, unknown> = {}) {
  return {
    propId: "p1",
    jahr: 2025,
    zeitanteilig: false,
    zeilen: [{ bezeichnung: "Grundsteuer", betrag: 600, schluessel: "flaeche" as const }],
    mieter: [
      { id: "m1", flaeche: 50 },
      { id: "m2", flaeche: 50 },
    ],
    ...over,
  } as never;
}

/**
 * Alle Zugriffe in Reihenfolge. Tabellen als "tabelle:op", RPC-Aufrufe stehen
 * in der Attrappe bereits als "rpc:<name>" in `tabelle` — die bekommen kein
 * zweites Suffix.
 */
function ablauf(db: { zugriffe: { tabelle: string; op: string }[] }) {
  return db.zugriffe.map((z) => (z.op === "rpc" ? z.tabelle : `${z.tabelle}:${z.op}`));
}

describe("Die Verteilung läuft in EINER Transaktion", () => {
  it("Löschen und Einfügen gehen über die DB-Funktion, nicht als zwei Aufrufe", async () => {
    // Der Fehler dahinter: Ging der Insert schief, war die alte Verteilung
    // bereits gelöscht — der Nutzer stand ohne Daten da.
    const { db, mod } = await lade();
    const r = await mod.verteileNebenkosten(eingabe());
    expect(r.ok).toBe(true);
    expect(ablauf(db)).toContain("rpc:umlage_positionen_ersetzen");
    // Kein direktes DELETE auf den Positionen.
    expect(db.zugriffe.some((z) => z.tabelle === "mieter_positionen")).toBe(false);
  });

  it("600 € nach Fläche auf zwei gleich große Mieter = 2 Positionen", async () => {
    const { mod } = await lade();
    const r = await mod.verteileNebenkosten(eingabe());
    expect(r.positionen).toBe(2);
    expect(r.mieter).toBe(2);
    expect(r.gesamt).toBe(600);
  });
});

describe("Wohnflächen werden erst NACH der Verteilung geschrieben", () => {
  it("die Reihenfolge stimmt: erst rpc, dann mieter-Update", async () => {
    const { db, mod } = await lade();
    // m1 bekommt eine geänderte Fläche mitgegeben.
    await mod.verteileNebenkosten(eingabe({ mieter: [{ id: "m1", flaeche: 60 }, { id: "m2", flaeche: 50 }] }));
    const schritte = ablauf(db);
    const rpc = schritte.indexOf("rpc:umlage_positionen_ersetzen");
    const update = schritte.indexOf("mieter:update");
    expect(rpc).toBeGreaterThan(-1);
    expect(update).toBeGreaterThan(-1);
    // DAS ist der Fehler von damals: update stand vor rpc.
    expect(update).toBeGreaterThan(rpc);
  });

  it("scheitert die Verteilung, bleiben die Stammdaten unangetastet", async () => {
    const { db, mod } = await lade({ fehler: { message: "Transaktion abgebrochen" } });
    const r = await mod.verteileNebenkosten(
      eingabe({ mieter: [{ id: "m1", flaeche: 60 }, { id: "m2", flaeche: 50 }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain("Transaktion abgebrochen");
    expect(db.zugriffe.some((z) => z.tabelle === "mieter" && z.op === "update")).toBe(false);
  });

  it("unveränderte Flächen lösen kein Update aus", async () => {
    const { db, mod } = await lade();
    await mod.verteileNebenkosten(eingabe()); // 50/50 wie in der DB
    expect(db.zugriffe.some((z) => z.tabelle === "mieter" && z.op === "update")).toBe(false);
  });

  it("eine gepflegte Fläche wird NIE mit 0 überschrieben", async () => {
    // Leeres Feld im Assistenten darf keinen Datenverlust auslösen.
    const { db, mod } = await lade();
    await mod.verteileNebenkosten(eingabe({ mieter: [{ id: "m1", flaeche: 0 }, { id: "m2", flaeche: 50 }] }));
    expect(db.zugriffe.some((z) => z.tabelle === "mieter" && z.op === "update")).toBe(false);
  });

  it("nur der geänderte Mieter wird geschrieben, nicht alle", async () => {
    const { db, mod } = await lade();
    await mod.verteileNebenkosten(eingabe({ mieter: [{ id: "m1", flaeche: 60 }, { id: "m2", flaeche: 50 }] }));
    const updates = db.zugriffe.filter((z) => z.tabelle === "mieter" && z.op === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].daten).toEqual({ flaeche: 60 });
    expect(updates[0].filter).toContain("eq:id=m1");
  });
});

describe("Ein Fehler beim Flächen-Schreiben wird gemeldet, nicht verschluckt", () => {
  it("Verteilung gilt als erfolgreich, der Hinweis nennt das Problem", async () => {
    // Sonst zeigt der Assistent beim nächsten Öffnen wieder die alten m²,
    // obwohl mit den neuen gerechnet wurde.
    const { client, db } = fakeSupabase({
      antworten: { properties: { flaeche: 100 }, mieter: DB_MIETER },
    });
    // Der rpc soll gelingen, das anschliessende Update fehlschlagen.
    const echt = client.rpc;
    client.rpc = async (n: string, a?: unknown) => {
      const r = await echt(n, a);
      db.fehler = { message: "Spalte gesperrt" }; // erst danach scharf schalten
      return r;
    };
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/umlage");
    const r = await mod.verteileNebenkosten(
      eingabe({ mieter: [{ id: "m1", flaeche: 60 }, { id: "m2", flaeche: 50 }] }),
    );
    expect(r.ok).toBe(true);
    expect(r.hinweis).toContain("Spalte gesperrt");
    expect(r.hinweis).toContain("m²");
  });

  it("ohne Problem gibt es keinen Hinweis", async () => {
    const { mod } = await lade();
    expect((await mod.verteileNebenkosten(eingabe())).hinweis).toBeUndefined();
  });
});

describe("Was gar nicht erst verteilt wird", () => {
  it("Zeilen ohne Bezeichnung oder mit Betrag 0 fallen raus", async () => {
    const { mod } = await lade();
    const r = await mod.verteileNebenkosten(
      eingabe({
        zeilen: [
          { bezeichnung: "Grundsteuer", betrag: 600, schluessel: "flaeche" },
          { bezeichnung: "   ", betrag: 400, schluessel: "flaeche" },
          { bezeichnung: "Leerzeile", betrag: 0, schluessel: "flaeche" },
          { bezeichnung: "Negativ", betrag: -100, schluessel: "flaeche" },
        ],
      }),
    );
    // Nur die Grundsteuer zählt.
    expect(r.gesamt).toBe(600);
  });

  it("ohne Mieter im Objekt: Fehler, kein Schreibzugriff", async () => {
    const { db, mod } = await lade({ antworten: { properties: { flaeche: 100 }, mieter: [] } });
    const r = await mod.verteileNebenkosten(eingabe());
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain("Keine Mieter");
    expect(db.zugriffe.some((z) => z.op === "rpc" || z.op === "update")).toBe(false);
  });

  it("ein Mieter, der nicht zum Objekt gehört, kann nicht eingeschleust werden", async () => {
    // Die Liste kommt aus der DATENBANK und wird nur mit der Eingabe
    // gefiltert — nicht umgekehrt. Eine fremde ID im Formular läuft ins Leere.
    const { db, mod } = await lade();
    const r = await mod.verteileNebenkosten(
      eingabe({ mieter: [{ id: "m1", flaeche: 50 }, { id: "fremd-999", flaeche: 50 }] }),
    );
    expect(r.mieter).toBe(1);
    expect(db.zugriffe.some((z) => z.filter.includes("eq:id=fremd-999"))).toBe(false);
  });

  it("Positionen mit Betrag 0 werden nicht gespeichert", async () => {
    // Ein Mieter mit 0 m² bekäme bei Flächenverteilung 0 € — eine Zeile
    // „0,00 €" in der Abrechnung wäre nur Verwirrung.
    const { mod } = await lade({
      antworten: {
        properties: { flaeche: 100 },
        mieter: [...DB_MIETER, { id: "m3", vorname: "Cem", nachname: "Yildiz", einheit: "WE 3", flaeche: 0, mietbeginn: null, mietende: null }],
      },
    });
    const r = await mod.verteileNebenkosten(
      eingabe({ mieter: [{ id: "m1", flaeche: 50 }, { id: "m2", flaeche: 50 }, { id: "m3", flaeche: 0 }] }),
    );
    expect(r.positionen).toBe(2);
    expect(r.mieter).toBe(2);
  });
});

describe("Die Mieter-Abfrage ist auf das Objekt eingeschränkt", () => {
  it("gelesen wird mit prop_id-Filter", async () => {
    const { db, mod } = await lade();
    await mod.verteileNebenkosten(eingabe());
    const abfrage = db.zugriffe.find((z) => z.tabelle === "mieter" && z.op === "select");
    expect(abfrage?.filter).toContain("eq:prop_id=p1");
  });
});
