import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { naechsteFaelligkeit } from "@/lib/termine";

// lib/actions/termine.ts + die Terminrechnung in lib/termine.ts.
//
// Termine sind Fristen: Wartung, Prüfpflichten, Kündigungsfenster. Zwei Dinge
// dürfen hier nicht passieren — eine Frist, die stillschweigend NICHT angelegt
// wird, und ein Folgetermin, der auf dem falschen Tag landet.
//
// ZWEI FUNDE BEIM SCHREIBEN DIESER TESTS (08.09.2026):
//
// 1. `updateTermin` hatte ein kommentarloses `return`, wenn Titel oder Datum
//    fehlten. `createTermin` beschreibt ein paar Zeilen darüber ausdrücklich,
//    warum genau das ein Fehler ist („der Nutzer klickte ein zweites Mal") —
//    beim Bearbeiten stand es trotzdem noch drin.
//
// 2. `naechsteFaelligkeit` rechnete zeitzonenabhängig. Gemessen:
//    TZ=Europe/Berlin schob den 15.03. um einen Monat auf den **14.04.**
//    (Sommerzeitumstellung), TZ=America/New_York den 31.01. auf den **01.03.**
//    Auf Vercel läuft alles in UTC, produktiv war das Ergebnis also richtig —
//    aber es hing an einer Umgebungseinstellung, die niemand hier verwaltet.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  // WICHTIG: Ohne `resetModules()` liefert `await import` beim zweiten Aufruf
  // innerhalb desselben Tests das GECACHTE Modul — es hängt dann noch an der
  // ersten Attrappe, und der frische `db` bleibt leer. Tests mit einer Schleife
  // über mehrere Eingaben prüfen sonst nur den ersten Durchlauf.
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/termine");
  return { db, spuren, mod };
}

const schrieb = (db: { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown> }[] }, op: string) =>
  [...db.zugriffe].reverse().find((x) => x.tabelle === "termine" && x.op === op)?.daten;

describe("Termin anlegen", () => {
  it("ohne Titel oder Datum wird nichts angelegt — und das wird gesagt", async () => {
    for (const eingabe of [{ datum: "2026-10-01" }, { titel: "Wartung" }, {}]) {
      const { db, mod } = await lade();
      const ziel = await fangeRedirect(() => mod.createTermin(fd(eingabe)));
      expect(decodeURIComponent(ziel)).toMatch(/Titel und Datum/);
      expect(db.zugriffe.some((x) => x.op === "insert")).toBe(false);
    }
  });

  it("Kategorie und Wiederkehrung müssen aus der Weißliste kommen", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() =>
      mod.createTermin(
        fd({ titel: "X", datum: "2026-10-01", kategorie: "Erfunden", wiederkehrung: "täglich" }),
      ),
    );
    const daten = schrieb(db, "insert")!;
    expect(daten.kategorie).toBeNull();
    expect(daten.wiederkehrung).toBeNull();
  });

  it("gültige Werte werden übernommen", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() =>
      mod.createTermin(fd({ titel: "Heizungswartung", datum: "2026-10-01", kategorie: "Wartung", wiederkehrung: "jaehrlich" })),
    );
    const daten = schrieb(db, "insert")!;
    expect(daten).toMatchObject({ titel: "Heizungswartung", kategorie: "Wartung", wiederkehrung: "jaehrlich", user_id: "nutzer-1" });
  });

  it("der Vorlauf wird auf 1…365 Tage begrenzt", async () => {
    // Ein Vorlauf von 100.000 Tagen würde die Frist dauerhaft in der Liste
    // halten; 0 oder negativ ergibt keine Vorwarnung.
    for (const [ein, erwartet] of [["30", 30], ["0", null], ["-5", null], ["99999", 365], ["abc", null]] as const) {
      const { db, mod } = await lade();
      await fangeRedirect(() => mod.createTermin(fd({ titel: "X", datum: "2026-10-01", vorlauf_tage: ein })));
      expect(schrieb(db, "insert")!.vorlauf_tage, ein).toBe(erwartet);
    }
  });

  it("die Bestätigung nennt das Datum in deutscher Schreibweise", async () => {
    const { mod } = await lade();
    const ziel = await fangeRedirect(() => mod.createTermin(fd({ titel: "Prüfung", datum: "2026-10-01" })));
    expect(decodeURIComponent(ziel)).toContain("01.10.2026");
  });
});

describe("Termin bearbeiten", () => {
  it("ohne Titel oder Datum wird nichts gespeichert — und das wird gesagt", async () => {
    // Der Fund: Hier stand ein kommentarloses `return`. Der Nutzer sah kein
    // Ergebnis und konnte Erfolg von Misserfolg nicht unterscheiden.
    const { db, mod } = await lade();
    const ziel = await fangeRedirect(() => mod.updateTermin("t1", fd({ titel: "  ", datum: "2026-10-01" })));
    expect(decodeURIComponent(ziel)).toMatch(/nichts gespeichert/);
    expect(db.zugriffe.some((x) => x.op === "update")).toBe(false);
  });

  it("das Update ist auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.updateTermin("t1", fd({ titel: "Neu", datum: "2026-10-01" })));
    const z = db.zugriffe.find((x) => x.tabelle === "termine" && x.op === "update")!;
    expect(z.filter).toContain("eq:user_id=nutzer-1");
  });

  it("Löschen ebenfalls", async () => {
    const { db, mod } = await lade();
    await mod.deleteTermin("t1");
    const z = db.zugriffe.find((x) => x.tabelle === "termine" && x.op === "delete")!;
    expect(z.filter).toContain("eq:id=t1");
    expect(z.filter).toContain("eq:user_id=nutzer-1");
  });
});

describe("Erledigt-Haken und Folgetermin", () => {
  const termin = {
    id: "t1", titel: "Heizungswartung", datum: "2026-03-31", prop_id: "obj-1", mieter_id: null,
    notiz: null, kategorie: "Wartung", wiederkehrung: "monatlich", vorlauf_tage: 14, erledigt: false,
  };

  it("beim Abhaken entsteht der nächste Termin — mit korrekt gekapptem Monatsende", async () => {
    // 31.03. + 1 Monat: Den 31. April gibt es nicht. Genau diese Sorte Datum
    // hat in `mietkonto.ts` schon einmal zu doppelten Buchungen geführt.
    const { db, mod } = await lade({
      antwortFolge: { "termine:select": [termin, null] },
    });
    await mod.toggleErledigt("t1");
    const neu = schrieb(db, "insert")!;
    expect(neu.datum).toBe("2026-04-30");
    expect(neu).toMatchObject({ titel: "Heizungswartung", wiederkehrung: "monatlich", vorlauf_tage: 14 });
  });

  it("gibt es den Folgetermin schon, wird kein zweiter angelegt", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "termine:select": [termin, { id: "t2" }] },
    });
    await mod.toggleErledigt("t1");
    expect(db.zugriffe.some((x) => x.op === "insert")).toBe(false);
  });

  it("scheitert die Dublettenprüfung, wird KEIN Folgetermin angelegt", async () => {
    // Leer heißt „gibt es noch nicht" — eine fehlgeschlagene Abfrage sieht
    // genauso aus und legte den Folgetermin ein zweites Mal an.
    const { db, mod } = await lade({
      antwortFolge: { "termine:select": [termin, null] },
      fehlerBei: { "termine:select": { message: "connection reset" } },
    });
    await expect(mod.toggleErledigt("t1")).rejects.toThrow();
    expect(db.zugriffe.some((x) => x.op === "insert")).toBe(false);
  });

  it("ohne Wiederkehrung entsteht kein Folgetermin", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "termine:select": [{ ...termin, wiederkehrung: null }] },
    });
    await mod.toggleErledigt("t1");
    expect(db.zugriffe.some((x) => x.op === "insert")).toBe(false);
  });

  it("beim Wieder-Öffnen entsteht ebenfalls keiner", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "termine:select": [{ ...termin, erledigt: true }] },
    });
    await mod.toggleErledigt("t1");
    expect(schrieb(db, "update")).toEqual({ erledigt: false });
    expect(db.zugriffe.some((x) => x.op === "insert")).toBe(false);
  });
});

describe("Vorlagen-Termin aus dem Prüfpflichten-Katalog", () => {
  it("ein unbekanntes Intervall bricht ab, statt still nichts zu tun", async () => {
    const { db, mod } = await lade();
    await expect(mod.createVorlageTermin("X", "täglich", "Wartung", "", null)).rejects.toThrow(/Intervall/);
    expect(db.zugriffe.some((x) => x.op === "insert")).toBe(false);
  });

  it("eine unbekannte Kategorie fällt auf Wartung zurück", async () => {
    const { db, mod } = await lade();
    await mod.createVorlageTermin("Rauchmelder", "jaehrlich", "Erfunden", "Notiz", "obj-1");
    expect(schrieb(db, "insert")).toMatchObject({ kategorie: "Wartung", prop_id: "obj-1" });
  });

  it("das Objekt darf auch aus dem Formular kommen", async () => {
    const { db, mod } = await lade();
    await mod.createVorlageTermin("X", "jaehrlich", "Wartung", "", null, fd({ prop_id: "obj-9" }));
    expect(schrieb(db, "insert")!.prop_id).toBe("obj-9");
  });
});

describe("Abgeleitete Fristen aus- und einblenden", () => {
  it("Ausblenden merkt sich Nutzer und Schlüssel", async () => {
    const { db, mod } = await lade();
    await mod.blendeFristAus("miete:obj-1:2026-10");
    const z = db.zugriffe.find((x) => x.tabelle === "frist_ausgeblendet")!;
    expect(z.op).toBe("upsert");
    expect(z.daten).toEqual({ user_id: "nutzer-1", schluessel: "miete:obj-1:2026-10" });
  });

  it("Einblenden löscht nur den eigenen Eintrag", async () => {
    const { db, mod } = await lade();
    await mod.zeigeFristWieder("miete:obj-1:2026-10");
    const z = db.zugriffe.find((x) => x.tabelle === "frist_ausgeblendet")!;
    expect(z.op).toBe("delete");
    expect(z.filter).toContain("eq:user_id=nutzer-1");
    expect(z.filter).toContain("eq:schluessel=miete:obj-1:2026-10");
  });
});

describe("naechsteFaelligkeit(): Kalenderrechnung ohne Zeitzone", () => {
  it("kappt auf den letzten Tag des Zielmonats", () => {
    expect(naechsteFaelligkeit("2026-01-31", "monatlich")).toBe("2026-02-28");
    expect(naechsteFaelligkeit("2028-01-31", "monatlich")).toBe("2028-02-29"); // Schaltjahr
    expect(naechsteFaelligkeit("2026-03-31", "monatlich")).toBe("2026-04-30");
  });

  it("rechnet über den Jahreswechsel", () => {
    expect(naechsteFaelligkeit("2026-12-31", "monatlich")).toBe("2027-01-31");
    expect(naechsteFaelligkeit("2026-11-15", "quartalsweise")).toBe("2027-02-15");
    expect(naechsteFaelligkeit("2026-06-01", "alle_4_jahre")).toBe("2030-06-01");
  });

  it("das Ergebnis hängt NICHT von der Zeitzone ab", () => {
    // Der Fund. Vorher: Europe/Berlin schob den 15.03. auf den 14.04.,
    // America/New_York den 31.01. auf den 01.03.
    const alt = process.env.TZ;
    const ergebnisse = new Set<string>();
    try {
      for (const tz of ["UTC", "Europe/Berlin", "America/New_York", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        ergebnisse.add(
          [
            naechsteFaelligkeit("2026-03-15", "monatlich"),
            naechsteFaelligkeit("2026-01-31", "monatlich"),
            naechsteFaelligkeit("2026-10-25", "monatlich"),
          ].join("|"),
        );
      }
    } finally {
      if (alt === undefined) delete process.env.TZ;
      else process.env.TZ = alt;
    }
    expect([...ergebnisse]).toEqual(["2026-04-15|2026-02-28|2026-11-25"]);
  });

  it("unbekanntes Intervall und unbrauchbares Datum ergeben null", () => {
    expect(naechsteFaelligkeit("2026-01-31", "täglich")).toBeNull();
    expect(naechsteFaelligkeit("31.01.2026", "monatlich")).toBeNull();
    expect(naechsteFaelligkeit("", "monatlich")).toBeNull();
    expect(naechsteFaelligkeit("2026-13-01", "monatlich")).toBeNull();
  });
});
