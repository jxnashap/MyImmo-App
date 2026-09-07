import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/zaehler.ts — Zählerstände aus dem Mieterportal.
//
// Der gemeldete Stand ist kein Anzeigewert: Der Vermieter übernimmt ihn, die
// Differenz zur Vormeldung wird als VERBRAUCH gebucht, und der Verbrauch geht
// in die Nebenkostenabrechnung des Mieters. Ein falsch gelesener Zählerstand
// landet also am Ende auf einer Rechnung an einen Dritten.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

const ZUGANG = { vermieter_id: "v-1", mieter_id: "m-1", prop_id: "p-1" };

async function lade(init: Record<string, unknown> = {}) {
  const { db, client } = fakeSupabase({ antworten: { mieter_zugaenge: ZUGANG }, ...init });
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/zaehler");
  return { db, mod };
}

function insert(db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }, tabelle: string) {
  return db.zugriffe.find((z) => z.tabelle === tabelle && z.op === "insert")?.daten as
    | Record<string, unknown>
    | undefined;
}

describe("Der Zählerstand — der Fund vom 07.09.2026", () => {
  async function stand(eingabe: string) {
    vi.resetModules();
    const { db, mod } = await lade();
    const r = await mod.meldeZaehlerstand(fd({ art: "Strom", stand: eingabe }));
    return { wert: insert(db, "zaehlerstand_meldungen")?.stand, fehler: r.error };
  }

  it("mit Komma sind die Punkte Tausendertrennzeichen", async () => {
    // DER FEHLER: `parseFloat(s.replace(",", "."))` ersetzt nur das ERSTE
    // Komma und lässt die Punkte stehen. Aus „14.382,5" wurde 14,382 — das
    // Tausendfache daneben, und der Wert wandert als Verbrauchsdifferenz in
    // die Nebenkostenabrechnung.
    expect((await stand("14.382,5")).wert).toBe(14382.5);
    expect((await stand("1.234.567,8")).wert).toBe(1234567.8);
  });

  it("die normale Schreibweise funktioniert unverändert", async () => {
    expect((await stand("14382,5")).wert).toBe(14382.5);
    expect((await stand("14382")).wert).toBe(14382);
    expect((await stand("0,5")).wert).toBe(0.5);
  });

  it("DREI Nachkommastellen mit Punkt bleiben erhalten — Gas- und Wasserzähler", async () => {
    // Deshalb wird hier bewusst NICHT `zahlDe()` benutzt: Die Euro-Heuristik
    // deutet einen Punkt vor drei Ziffern als Tausenderpunkt und würde aus
    // 5123,456 m³ die Zahl 5.123.456 machen.
    expect((await stand("5123.456")).wert).toBe(5123.456);
    expect((await stand("12.345")).wert).toBe(12.345);
  });

  it("Buchstaben im Feld werden abgewiesen, nicht abgeschnitten", async () => {
    // `parseFloat("123abc")` hätte stillschweigend 123 gemeldet.
    const r = await stand("123abc");
    expect(r.wert).toBeUndefined();
    expect(r.fehler).toContain("gültigen Zählerstand");
  });

  it("leer oder negativ wird abgewiesen", async () => {
    for (const e of ["", "   ", "-5"]) {
      expect((await stand(e)).fehler).toContain("gültigen Zählerstand");
    }
  });
});

describe("Meldung anlegen", () => {
  it("Empfänger und Wohnung kommen aus dem Zugang, nicht aus dem Formular", async () => {
    const { db, mod } = await lade();
    await mod.meldeZaehlerstand(
      fd({ art: "Strom", stand: "100", vermieter_id: "fremd", prop_id: "fremd" }),
    );
    expect(insert(db, "zaehlerstand_meldungen")).toMatchObject({
      vermieter_id: "v-1",
      mieter_id: "m-1",
      prop_id: "p-1",
      mieter_user_id: "nutzer-1",
    });
  });

  it("ohne verknüpfte Wohnung passiert nichts", async () => {
    const { db, mod } = await lade({ antworten: { mieter_zugaenge: null } });
    expect((await mod.meldeZaehlerstand(fd({ art: "Strom", stand: "100" }))).error).toContain(
      "keiner Wohnung verknüpft",
    );
    expect(insert(db, "zaehlerstand_meldungen")).toBeUndefined();
  });

  it("nur bekannte Zählerarten", async () => {
    const { db, mod } = await lade();
    for (const art of ["Strom", "Gas", "Wasser", "Warmwasser", "Fernwärme", "Öl", "Sonstiges"]) {
      expect((await mod.meldeZaehlerstand(fd({ art, stand: "100" }))).ok).toBe(true);
    }
    for (const art of ["Atomstrom", "'; drop--", ""]) {
      expect((await mod.meldeZaehlerstand(fd({ art, stand: "100" }))).error).toContain("Zählerart");
    }
  });

  it("ohne Ablesedatum wird heute gesetzt", async () => {
    const { db, mod } = await lade();
    await mod.meldeZaehlerstand(fd({ art: "Strom", stand: "100" }));
    expect(insert(db, "zaehlerstand_meldungen")?.ablesedatum).toBe(new Date().toISOString().slice(0, 10));
  });

  it("Foto: nur Bilder bis 4 MB", async () => {
    const { db, mod } = await lade();
    const gross = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "z.jpg", { type: "image/jpeg" });
    expect((await mod.meldeZaehlerstand(fd({ art: "Strom", stand: "1", foto: gross }))).error).toContain("4 MB");
    const pdf = new File([new Uint8Array(10)], "z.pdf", { type: "application/pdf" });
    expect((await mod.meldeZaehlerstand(fd({ art: "Strom", stand: "1", foto: pdf }))).error).toContain("Nur Fotos");
    expect(insert(db, "zaehlerstand_meldungen")).toBeUndefined();
  });

  it("ein gültiges Foto wird mitgespeichert", async () => {
    const { db, mod } = await lade();
    const foto = new File([new Uint8Array(50)], "zaehler.jpg", { type: "image/jpeg" });
    await mod.meldeZaehlerstand(fd({ art: "Strom", stand: "1", foto }));
    expect(insert(db, "zaehlerstand_meldungen")).toMatchObject({
      foto_name: "zaehler.jpg",
      foto_type: "image/jpeg",
    });
  });
});

describe("Übernahme durch den Vermieter", () => {
  const MELDUNG = {
    id: "z-2",
    mieter_id: "m-1",
    prop_id: "p-1",
    art: "Strom",
    stand: 14500,
    einheit: "kWh",
    ablesedatum: "2026-09-01",
    uebernommen_am: null,
  };

  function laden(meldung: Record<string, unknown> = {}, vorher: unknown = null) {
    return {
      antwortFolge: {
        "zaehlerstand_meldungen:select": [{ ...MELDUNG, ...meldung }, vorher],
      },
    };
  }

  it("die Differenz zur Vormeldung wird als Verbrauch gebucht", async () => {
    const { db, mod } = await lade(laden({}, { stand: 14000, ablesedatum: "2026-06-01" }));
    const r = await mod.uebernehmeZaehlerstand("z-2");
    expect(r).toMatchObject({ ok: true, verbrauchGebucht: true });
    expect(insert(db, "verbrauch")).toMatchObject({
      menge: 500,
      art: "Strom",
      einheit: "kWh",
      user_id: "nutzer-1",
      buchungsdatum: "2026-09-01",
    });
  });

  it("ohne Vormeldung wird nur übernommen, nichts gebucht", async () => {
    const { db, mod } = await lade(laden());
    expect(await mod.uebernehmeZaehlerstand("z-2")).toMatchObject({ verbrauchGebucht: false });
    expect(insert(db, "verbrauch")).toBeUndefined();
  });

  it("ein RÜCKWÄRTS laufender Zähler bucht nichts", async () => {
    // Sonst entstünde eine negative Menge in der NK-Abrechnung.
    //
    // ANMERKUNG ZUR ABDECKUNG (07.09.2026): Die Aktion hat hier ZWEI Wächter,
    // `m.stand >= vorher.stand` und `menge > 0`. Der erste ist vom zweiten
    // vollständig impliziert — bei einem Rückwärtsstand ist die Differenz
    // negativ und scheitert ohnehin an `menge > 0`. Entfernt man nur den
    // ersten, bleibt dieser Test grün; das ist kein Testfehler, sondern
    // redundanter Code. Wirksam ist `menge > 0`, und dessen Wegfall fängt der
    // Test „ein unveränderter Stand bucht nichts". Beides absichtlich stehen
    // gelassen: doppelt geprüft schadet hier nicht.
    const { db, mod } = await lade(laden({ stand: 13000 }, { stand: 14000, ablesedatum: "2026-06-01" }));
    expect(await mod.uebernehmeZaehlerstand("z-2")).toMatchObject({ verbrauchGebucht: false });
    expect(insert(db, "verbrauch")).toBeUndefined();
  });

  it("ein unveränderter Stand bucht nichts", async () => {
    const { db, mod } = await lade(laden({ stand: 14000 }, { stand: 14000, ablesedatum: "2026-06-01" }));
    expect(await mod.uebernehmeZaehlerstand("z-2")).toMatchObject({ verbrauchGebucht: false });
    expect(insert(db, "verbrauch")).toBeUndefined();
  });

  it("eine bereits übernommene Meldung wird nicht ein zweites Mal gebucht", async () => {
    // Sonst entstünde bei jedem Klick eine weitere Verbrauchsbuchung.
    const { db, mod } = await lade(laden({ uebernommen_am: "2026-09-02T10:00:00Z" }));
    expect((await mod.uebernehmeZaehlerstand("z-2")).error).toContain("Bereits übernommen");
    expect(insert(db, "verbrauch")).toBeUndefined();
  });

  it("eine fremde Meldung wird nicht gefunden", async () => {
    const { db, mod } = await lade({ antworten: { zaehlerstand_meldungen: null } });
    expect((await mod.uebernehmeZaehlerstand("fremd")).error).toContain("nicht gefunden");
    expect(db.zugriffe[0].filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("die Vormeldung wird nach Zähler, Mieter und Datum gesucht", async () => {
    // Ohne die Einschränkung auf `art` käme die Wasser-Vormeldung in die
    // Strom-Differenz; ohne `lt:ablesedatum` eine spätere Meldung.
    const { db, mod } = await lade(laden({}, { stand: 14000, ablesedatum: "2026-06-01" }));
    await mod.uebernehmeZaehlerstand("z-2");
    const suche = db.zugriffe.filter((z) => z.tabelle === "zaehlerstand_meldungen" && z.op === "select")[1];
    expect(suche.filter).toContain("eq:art=Strom");
    expect(suche.filter).toContain("eq:mieter_id=m-1");
    expect(suche.filter).toContain("lt:ablesedatum=2026-09-01");
    expect(suche.filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("scheitert die Verbrauchsbuchung, wird die Meldung NICHT als übernommen markiert", async () => {
    // Sonst gälte sie als erledigt, ohne dass ein Verbrauch existiert — und
    // die nächste Differenz würde von einem Stand aus gerechnet, der nie
    // gebucht wurde.
    const { db, mod } = await lade({
      ...laden({}, { stand: 14000, ablesedatum: "2026-06-01" }),
      fehler: { message: "abgelehnt" },
    });
    const r = await mod.uebernehmeZaehlerstand("z-2");
    expect(r.error).toContain("Verbrauch konnte nicht gebucht werden");
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });
});
