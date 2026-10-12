import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";

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
  vi.resetModules();
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
    const { mod } = await lade();
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

// Übernahme gegen `speicherDb` (B07/B11, 11.10.2026): Die Attrappe filtert wirklich — welche
// Vormeldung zum SELBEN Zähler gehört, entscheidet die Action über `zaehlerVerbrauch()`, nicht eine
// feste Antwort. `verbrauch.meldung_id` ist eindeutig wie in der Migration.
const VM = "nutzer-1";
const meldung = (over: Record<string, unknown> = {}) => ({
  id: "z-2", vermieter_id: VM, mieter_id: "m-1", prop_id: "p-1", art: "Strom", einheit: "kWh",
  zaehlernummer: null, stand: 14500, ablesedatum: "2026-09-01", uebernommen_am: null, ...over,
});
const frueher = (over: Record<string, unknown> = {}) =>
  meldung({ id: "z-1", stand: 14000, ablesedatum: "2026-06-01", uebernommen_am: "2026-06-02T08:00:00Z", ...over });

async function ladeUebernahme(meldungen: Record<string, unknown>[], extra: { verbrauch?: Record<string, unknown>[]; fehlerBei?: Record<string, string>; fehlerAbSeite?: Record<string, number> } = {}) {
  vi.resetModules();
  const db = speicherDb({
    tabellen: { zaehlerstand_meldungen: meldungen, verbrauch: extra.verbrauch ?? [] },
    eindeutig: { verbrauch: [["meldung_id"]] },
    fehlerBei: extra.fehlerBei,
    fehlerAbSeite: extra.fehlerAbSeite,
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/zaehler");
  const status = (id = "z-2") => db.tabellen.zaehlerstand_meldungen.find((r) => r.id === id)?.uebernommen_am ?? null;
  return { db, mod, verbrauch: () => db.tabellen.verbrauch, status };
}

describe("Übernahme durch den Vermieter", () => {
  it("die Differenz zur Vormeldung desselben Zählers wird als Verbrauch gebucht", async () => {
    const { mod, verbrauch, status } = await ladeUebernahme([frueher(), meldung()]);
    expect(await mod.uebernehmeZaehlerstand("z-2")).toEqual({ ok: true, verbrauchGebucht: true });
    expect(verbrauch()).toEqual([expect.objectContaining({
      menge: 500, art: "Strom", einheit: "kWh", user_id: VM, prop_id: "p-1", buchungsdatum: "2026-09-01", meldung_id: "z-2",
    })]);
    expect(status()).not.toBeNull();
  });

  it("ohne Vormeldung wird nur übernommen, nichts gebucht", async () => {
    const { mod, verbrauch, status } = await ladeUebernahme([meldung()]);
    expect(await mod.uebernehmeZaehlerstand("z-2")).toEqual({ ok: true, verbrauchGebucht: false });
    expect(verbrauch()).toHaveLength(0);
    expect(status()).not.toBeNull();
  });

  it("ein RÜCKWÄRTS laufender Zähler bucht nichts — und sagt warum", async () => {
    const { mod, verbrauch } = await ladeUebernahme([frueher(), meldung({ stand: 13000 })]);
    const r = await mod.uebernehmeZaehlerstand("z-2");
    expect(r).toMatchObject({ ok: true, verbrauchGebucht: false, hinweis: expect.stringMatching(/kleiner als bei der letzten Meldung/) });
    expect(verbrauch()).toHaveLength(0);
  });

  it("ein unveränderter Stand bucht nichts (und ist keine Rückfrage)", async () => {
    const { mod, verbrauch } = await ladeUebernahme([frueher(), meldung({ stand: 14000 })]);
    expect(await mod.uebernehmeZaehlerstand("z-2")).toEqual({ ok: true, verbrauchGebucht: false });
    expect(verbrauch()).toHaveLength(0);
  });

  it("eine bereits übernommene Meldung wird nicht ein zweites Mal gebucht", async () => {
    const { mod, verbrauch } = await ladeUebernahme([frueher(), meldung({ uebernommen_am: "2026-09-02T10:00:00Z" })]);
    expect((await mod.uebernehmeZaehlerstand("z-2")).error).toContain("Bereits übernommen");
    expect(verbrauch()).toHaveLength(0);
  });

  it("eine fremde Meldung wird nicht gefunden und nicht angefasst", async () => {
    const { mod, verbrauch, status } = await ladeUebernahme([frueher({ vermieter_id: "anderer" }), meldung({ vermieter_id: "anderer" })]);
    expect((await mod.uebernehmeZaehlerstand("z-2")).error).toContain("nicht gefunden");
    expect(status()).toBeNull();
    expect(verbrauch()).toHaveLength(0);
  });

  it("Doppelklick: zwei GLEICHZEITIGE Übernahmen buchen EINEN Verbrauch", async () => {
    const { mod, verbrauch } = await ladeUebernahme([frueher(), meldung()]);
    const [a, b] = await Promise.all([mod.uebernehmeZaehlerstand("z-2"), mod.uebernehmeZaehlerstand("z-2")]);
    expect(verbrauch()).toHaveLength(1);
    expect([a, b].filter((r) => "ok" in r && r.ok)).toHaveLength(1);
    expect([a, b].map((r) => ("error" in r ? r.error : null)).filter(Boolean)).toEqual(["Bereits übernommen."]);
  });

  it("scheitert die Verbrauchsbuchung, steht die Meldung wieder als NICHT übernommen", async () => {
    // Sonst gälte sie als erledigt, ohne dass ein Verbrauch existiert — die nächste Differenz zählte
    // von einem Stand aus, der nie gebucht wurde.
    const { mod, verbrauch, status } = await ladeUebernahme([frueher(), meldung()], { fehlerBei: { "verbrauch:insert": "abgelehnt" } });
    expect((await mod.uebernehmeZaehlerstand("z-2")).error).toContain("Verbrauch konnte nicht gebucht werden");
    expect(status()).toBeNull();
    expect(verbrauch()).toHaveLength(0);
  });

  it("gibt es zur Meldung schon einen Verbrauch (früherer Versuch), entsteht kein zweiter", async () => {
    const { mod, verbrauch, status } = await ladeUebernahme([frueher(), meldung()], { verbrauch: [{ id: "v-alt", meldung_id: "z-2", menge: 500 }] });
    expect(await mod.uebernehmeZaehlerstand("z-2")).toEqual({ ok: true, verbrauchGebucht: false });
    expect(verbrauch()).toHaveLength(1);
    expect(status()).not.toBeNull();
  });
});

describe("B11: derselbe Zähler — oder eine Rückfrage", () => {
  it("zwei Stromzähler eines Mieters (Haushalt + Wärmepumpe) werden nicht gegeneinander gerechnet", async () => {
    const { mod, verbrauch } = await ladeUebernahme([
      frueher({ id: "z-a", zaehlernummer: "1ESY-4711", stand: 14000 }),
      frueher({ id: "z-w", zaehlernummer: "WP 0815", stand: 3000, ablesedatum: "2026-07-01" }),
      meldung({ id: "z-a2", zaehlernummer: "1esy4711", stand: 14500 }),
      meldung({ id: "z-w2", zaehlernummer: "WP0815", stand: 3200 }),
    ]);
    await mod.uebernehmeZaehlerstand("z-a2");
    await mod.uebernehmeZaehlerstand("z-w2");
    expect(verbrauch().map((v) => [v.meldung_id, v.menge])).toEqual([["z-a2", 500], ["z-w2", 200]]);
  });

  it("Zählertausch (andere Nummer am selben Mietverhältnis) → Rückfrage, kein Verbrauch", async () => {
    const { mod, verbrauch } = await ladeUebernahme([frueher({ zaehlernummer: "A1" }), meldung({ zaehlernummer: "B7", stand: 120 })]);
    expect(await mod.uebernehmeZaehlerstand("z-2")).toMatchObject({ ok: true, verbrauchGebucht: false, hinweis: expect.stringMatching(/Zählertausch/) });
    expect(verbrauch()).toHaveLength(0);
  });

  it("andere Einheit (Gas in m³, dann in kWh) → Rückfrage, kein Verbrauch", async () => {
    const { mod, verbrauch } = await ladeUebernahme([
      frueher({ art: "Gas", einheit: "m³", stand: 5123.456 }), meldung({ art: "Gas", einheit: "kWh", stand: 5200 }),
    ]);
    expect(await mod.uebernehmeZaehlerstand("z-2")).toMatchObject({ verbrauchGebucht: false, hinweis: expect.stringMatching(/Andere Einheit/) });
    expect(verbrauch()).toHaveLength(0);
  });

  it("„m3“ und „m³“ sind dieselbe Einheit; drei Nachkommastellen bleiben exakt", async () => {
    const { mod, verbrauch } = await ladeUebernahme([
      frueher({ art: "Wasser", einheit: "m³", stand: 512.345 }), meldung({ art: "Wasser", einheit: "m3", stand: 530.1 }),
    ]);
    await mod.uebernehmeZaehlerstand("z-2");
    expect(verbrauch()[0]).toMatchObject({ menge: 17.755 });
  });

  it("Meldungen ohne Nummer zählen nur im SELBEN Mietverhältnis und Objekt", async () => {
    const { mod, verbrauch } = await ladeUebernahme([frueher({ mieter_id: "m-vormieter" }), meldung()]);
    expect(await mod.uebernehmeZaehlerstand("z-2")).toEqual({ ok: true, verbrauchGebucht: false });
    expect(verbrauch()).toHaveLength(0);
  });

  it("eine SPÄTERE oder noch nicht übernommene Meldung ist keine Vormeldung", async () => {
    const { mod, verbrauch } = await ladeUebernahme([
      frueher({ id: "z-spaeter", stand: 14100, ablesedatum: "2026-10-01" }),
      frueher({ id: "z-offen", stand: 14200, ablesedatum: "2026-08-01", uebernommen_am: null }),
      frueher({ id: "z-1", stand: 14000, ablesedatum: "2026-06-01" }),
      meldung(),
    ]);
    await mod.uebernehmeZaehlerstand("z-2");
    expect(verbrauch()[0]).toMatchObject({ menge: 500 });
  });

  it("die Vormeldungen werden nur im eigenen Konto und nach Zählerart gesucht", async () => {
    const { db, mod } = await ladeUebernahme([frueher(), meldung()]);
    await mod.uebernehmeZaehlerstand("z-2");
    const suche = db.protokoll.filter((z) => z.tabelle === "zaehlerstand_meldungen" && z.op === "select")[0];
    expect(suche.filter).toEqual(expect.arrayContaining([`eq:vermieter_id=${VM}`, "eq:art=Strom", "neq:id=z-2"]));
  });

  it("über 1.000 frühere Meldungen: die richtige Vormeldung wird trotzdem gefunden", async () => {
    const alt = Array.from({ length: 1100 }, (_, i) => frueher({ id: `a${String(i).padStart(5, "0")}`, zaehlernummer: `X${i}`, mieter_id: `m-x${i}`, ablesedatum: "2020-01-01" }));
    const { mod, verbrauch } = await ladeUebernahme([...alt, frueher({ id: "zz-1" }), meldung()]);
    await mod.uebernehmeZaehlerstand("z-2");
    expect(verbrauch()[0]).toMatchObject({ menge: 500 });
  });
});

describe("Vormeldung lesen", () => {
  it("scheitert die Abfrage — auch erst auf einer späteren Seite —, wird NICHTS übernommen", async () => {
    // Fund vom 08.09.2026: Leer hieß „keine Vormeldung, kein Verbrauch". Die Meldung wurde trotzdem als
    // übernommen markiert — der Verbrauch dieses Zeitraums fehlte damit dauerhaft.
    const { mod, verbrauch, status } = await ladeUebernahme([frueher(), meldung()], { fehlerAbSeite: { zaehlerstand_meldungen: 0 } });
    const r = await mod.uebernehmeZaehlerstand("z-2");
    expect(String(r.error)).toMatch(/vorherige.*nichts übernommen/i);
    expect(verbrauch()).toHaveLength(0);
    expect(status()).toBeNull();
  });
});
