import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/positions.ts — die Kostenpositionen einer Nebenkostenabrechnung.
//
// Was hier landet, steht später wörtlich in der Abrechnung, die der Mieter
// bekommt — mit Rechenweg. Ein falscher Umlageschlüssel oder ein Betrag im
// falschen Jahr fällt niemandem auf, bis der Mieter widerspricht.
//
// Ein Fehler steckte hier schon (nur als Kommentar dokumentiert): Der
// OCR-Massenimport legte Positionen im AKTUELLEN Jahr an, während die
// NK-Abrechnung standardmäßig das VORJAHR anzeigt. Die importierten Zeilen
// landeten damit in einem Jahr, das niemand ansah.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init = {}) {
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/positions");
  return { db, mod };
}

function insertZeilen(db: { zugriffe: { op: string; daten?: unknown }[] }) {
  const z = db.zugriffe.find((x) => x.op === "insert");
  if (!z?.daten) return [];
  return Array.isArray(z.daten) ? z.daten : [z.daten];
}

describe("Aufteilungsart: nur bekannte Werte, sonst „voll“", () => {
  it("alle gültigen Arten kommen durch", async () => {
    for (const art of ["voll", "flaeche", "zeit", "verbrauch", "gradtag", "hkvo"]) {
      vi.resetModules();
      const { db, mod } = await lade();
      await mod.addPosition("m1", fd({ bezeichnung: "X", betrag: "10", aufteilung: art }));
      expect(insertZeilen(db)[0]).toMatchObject({ aufteilung: art });
    }
  });

  it("ein unbekannter Wert wird auf „voll“ gezwungen, nicht durchgereicht", async () => {
    // Ein Freitext-Schlüssel würde die NK-Berechnung in einen unbekannten
    // Zweig schicken — hier wird er an der Grenze abgefangen.
    const { db, mod } = await lade();
    await mod.addPosition("m1", fd({ bezeichnung: "X", betrag: "10", aufteilung: "hokuspokus" }));
    expect(insertZeilen(db)[0]).toMatchObject({ aufteilung: "voll" });
  });

  it("auch beim Ändern greift die Weißliste", async () => {
    const { db, mod } = await lade();
    await mod.updatePosition("p1", "m1", {
      bezeichnung: "X",
      betrag: 10,
      jahr: 2025,
      umlageschluessel: null,
      umlagefaehig: true,
      aufteilung: "'; drop table--",
    });
    const upd = db.zugriffe.find((z) => z.op === "update");
    expect(upd?.daten).toMatchObject({ aufteilung: "voll" });
  });
});

describe("Beträge und Zahlen aus dem Formular", () => {
  it("Komma-Beträge werden gelesen", async () => {
    const { db, mod } = await lade();
    await mod.addPosition("m1", fd({ bezeichnung: "Müll", betrag: "123,45" }));
    expect(insertZeilen(db)[0]).toMatchObject({ betrag: 123.45 });
  });

  it("unlesbare Zahlen werden zu null, nicht zu NaN", async () => {
    // NaN in einer numeric-Spalte wäre ein Datenbankfehler mitten im Speichern.
    const { db, mod } = await lade();
    await mod.addPosition("m1", fd({ bezeichnung: "X", betrag: "keine Zahl", jahr: "zwanzig" }));
    const zeile = insertZeilen(db)[0] as Record<string, unknown>;
    expect(zeile.betrag).toBeNull();
    expect(zeile.jahr).toBeNull();
  });

  it("die Umlagefähigkeit hängt am Checkbox-Wert „on“", async () => {
    const { db, mod } = await lade();
    await mod.addPosition("m1", fd({ bezeichnung: "X", betrag: "1", umlagefaehig: "on" }));
    expect(insertZeilen(db)[0]).toMatchObject({ umlagefaehig: true });
    vi.resetModules();
    const zweite = await lade();
    await zweite.mod.addPosition("m1", fd({ bezeichnung: "X", betrag: "1" }));
    expect(insertZeilen(zweite.db)[0]).toMatchObject({ umlagefaehig: false });
  });

  it("die user_id kommt aus der Sitzung", async () => {
    const { db, mod } = await lade();
    await mod.addPosition("m1", fd({ bezeichnung: "X", betrag: "1", user_id: "fremd" }));
    expect(insertZeilen(db)[0]).toMatchObject({ user_id: "nutzer-1", mieter_id: "m1" });
  });
});

describe("OCR-Massenimport: das Jahr ist der Knackpunkt", () => {
  const POS = JSON.stringify([{ name: "Grundsteuer", betrag: 300 }]);

  it("das übergebene Abrechnungsjahr wird übernommen", async () => {
    const { db, mod } = await lade();
    await mod.addPositionsBulk("m1", POS, 2023);
    expect(insertZeilen(db)[0]).toMatchObject({ jahr: 2023 });
  });

  it("ohne Jahr wird das VORJAHR gesetzt, nicht das laufende", async () => {
    // Der dokumentierte Fehler: `new Date().getFullYear()` als Default. Die
    // NK-Abrechnung zeigt standardmäßig das Vorjahr — die importierten Zeilen
    // waren dadurch unsichtbar.
    const { db, mod } = await lade();
    await mod.addPositionsBulk("m1", POS);
    expect(insertZeilen(db)[0]).toMatchObject({ jahr: new Date().getFullYear() - 1 });
  });

  it("unsinnige Jahre fallen auf das Vorjahr zurück", async () => {
    for (const j of [1999, 2101, 20255, Number.NaN]) {
      vi.resetModules();
      const { db, mod } = await lade();
      await mod.addPositionsBulk("m1", POS, j);
      expect(insertZeilen(db)[0]).toMatchObject({ jahr: new Date().getFullYear() - 1 });
    }
  });

  it("kaputtes JSON legt nichts an und wirft nicht", async () => {
    const { db, mod } = await lade();
    await expect(mod.addPositionsBulk("m1", "{kein json")).resolves.toBeUndefined();
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("Positionen ohne Namen oder ohne Betrag werden übersprungen", async () => {
    const { db, mod } = await lade();
    await mod.addPositionsBulk(
      "m1",
      JSON.stringify([
        { name: "Gut", betrag: 100 },
        { betrag: 50 }, // kein Name
        { name: "Ohne Betrag" },
        { name: "Negativ", betrag: -5 },
        { name: "Null", betrag: 0 },
      ]),
      2025,
    );
    const zeilen = insertZeilen(db);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({ bezeichnung: "Gut", betrag: 100 });
  });
});

describe("Gesamtkosten + Gesamtfläche = Flächen-Aufteilung", () => {
  it("beides vorhanden: Betrag ist die GEBÄUDE-Summe, App rechnet den Anteil", async () => {
    const { db, mod } = await lade();
    await mod.addPositionsBulk(
      "m1",
      JSON.stringify([{ name: "Heizung", betrag: 200, gesamt: 4000, flaecheGesamt: 500 }]),
      2025,
    );
    expect(insertZeilen(db)[0]).toMatchObject({
      betrag: 4000, // NICHT 200 — sonst würde der Wohnungsanteil ein zweites Mal geteilt
      aufteilung: "flaeche",
      flaeche_gesamt: 500,
      umlageschluessel: "Fläche",
    });
  });

  it("ohne Gesamtfläche bleibt der Betrag der Wohnungsanteil", async () => {
    const { db, mod } = await lade();
    await mod.addPositionsBulk("m1", JSON.stringify([{ name: "Heizung", betrag: 200, gesamt: 4000 }]), 2025);
    expect(insertZeilen(db)[0]).toMatchObject({ betrag: 200, aufteilung: null, flaeche_gesamt: null });
  });

  it("nur Gesamtsumme ohne Einzelbetrag: die Gesamtsumme wird genommen", async () => {
    const { db, mod } = await lade();
    await mod.addPositionsBulk("m1", JSON.stringify([{ name: "X", gesamt: 900 }]), 2025);
    expect(insertZeilen(db)[0]).toMatchObject({ betrag: 900 });
  });
});

describe("Abgleich-Übernahme aus der ausgelesenen Abrechnung", () => {
  it("Updates sind auf den eigenen Mieter eingeschränkt", async () => {
    // Ohne den zweiten Filter liesse sich über eine fremde Positions-ID eine
    // Position ausserhalb dieses Mietverhältnisses ändern.
    const { db, mod } = await lade();
    await mod.uebernehmeNkOcr("m1", 2025, JSON.stringify({ updates: [{ id: "pos-9", betrag: 120 }] }));
    const upd = db.zugriffe.find((z) => z.op === "update");
    expect(upd?.filter).toContain("eq:id=pos-9");
    expect(upd?.filter).toContain("eq:mieter_id=m1");
  });

  it("ein Update ohne ID oder ohne Betrag wird übersprungen", async () => {
    const { db, mod } = await lade();
    await mod.uebernehmeNkOcr(
      "m1",
      2025,
      JSON.stringify({ updates: [{ betrag: 120 }, { id: "p1" }, { id: "p2", betrag: 0 }] }),
    );
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });

  it("ein Fehler beim Update bricht ab — Rest wird nicht geschrieben", async () => {
    const { db, mod } = await lade({ fehler: { message: "gesperrt" } });
    const r = await mod.uebernehmeNkOcr(
      "m1",
      2025,
      JSON.stringify({ updates: [{ id: "p1", betrag: 10 }], neue: [{ name: "Neu", betrag: 20 }] }),
    );
    expect(r.ok).toBe(false);
    expect(r.fehler).toBe("gesperrt");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("kaputtes JSON gibt eine Meldung statt eines Absturzes", async () => {
    const { db, mod } = await lade();
    expect(await mod.uebernehmeNkOcr("m1", 2025, "<html>")).toEqual({ ok: false, fehler: "Ungültige Daten." });
    expect(db.zugriffe).toEqual([]);
  });

  it("das Flächen-Upgrade setzt alle drei Felder gemeinsam", async () => {
    // Halbe Wahrheit wäre schlimmer als keine: `aufteilung: flaeche` ohne
    // `flaeche_gesamt` würde durch null teilen.
    const { db, mod } = await lade();
    await mod.uebernehmeNkOcr(
      "m1",
      2025,
      JSON.stringify({ updates: [{ id: "p1", betrag: 4000, alsFlaeche: true, flaecheGesamt: 500 }] }),
    );
    expect(db.zugriffe.find((z) => z.op === "update")?.daten).toMatchObject({
      betrag: 4000,
      aufteilung: "flaeche",
      flaeche_gesamt: 500,
      umlageschluessel: "Fläche",
    });
  });

  it("„alsFlaeche“ ohne Gesamtfläche schaltet NICHT um", async () => {
    const { db, mod } = await lade();
    await mod.uebernehmeNkOcr(
      "m1",
      2025,
      JSON.stringify({ updates: [{ id: "p1", betrag: 4000, alsFlaeche: true }] }),
    );
    const daten = db.zugriffe.find((z) => z.op === "update")?.daten as Record<string, unknown>;
    expect("aufteilung" in daten).toBe(false);
  });

  it("neue Positionen bekommen das Zieljahr und die eigene user_id", async () => {
    const { db, mod } = await lade();
    await mod.uebernehmeNkOcr("m1", 2023, JSON.stringify({ neue: [{ name: "Neu", betrag: 50 }] }));
    expect(insertZeilen(db)[0]).toMatchObject({ jahr: 2023, user_id: "nutzer-1", mieter_id: "m1" });
  });
});
