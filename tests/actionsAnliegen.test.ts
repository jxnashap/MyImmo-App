import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/anliegen.ts — Schäden und Anfragen aus dem Mieterportal.
//
// Wie bei `service.ts` schreibt hier ein FREMDER Nutzer in die Daten des
// Vermieters — diesmal der Mieter. Die entscheidende Eigenschaft: An welchen
// Vermieter, welche Wohnung und welchen Mietvertrag ein Anliegen geht,
// bestimmt NICHT das Formular, sondern der hinterlegte Zugang. Käme das aus
// dem Client, könnte ein Mieter ein Anliegen in ein fremdes Portfolio legen.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

const ZUGANG = { vermieter_id: "v-1", mieter_id: "m-1", prop_id: "p-1" };

async function lade(init: Record<string, unknown> = {}) {
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/anliegen");
  return { db, mod };
}

function insert(db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }, tabelle: string) {
  return db.zugriffe.find((z) => z.tabelle === tabelle && z.op === "insert")?.daten as
    | Record<string, unknown>
    | undefined;
}
function update(db: { zugriffe: { tabelle: string; op: string; daten?: unknown; filter: string[] }[] }) {
  return db.zugriffe.find((z) => z.op === "update");
}

function bild(bytes: number, typ = "image/jpeg", name = "schaden.jpg") {
  return new File([new Uint8Array(bytes)], name, { type: typ });
}

/** Zugang vorhanden, Anliegen-Insert liefert eine ID. */
function mitZugang(extra: Record<string, unknown> = {}) {
  return {
    antworten: { mieter_zugaenge: ZUGANG, anliegen: { id: "a-1" } },
    ...extra,
  };
}

describe("Wer der Empfänger ist, entscheidet der Zugang — nicht das Formular", () => {
  it("Vermieter, Mieter und Wohnung kommen aus `mieter_zugaenge`", async () => {
    const { db, mod } = await lade(mitZugang());
    const r = await mod.erstelleAnliegen(
      // Das Formular versucht, einen anderen Vermieter unterzuschieben.
      fd({ typ: "schaden", titel: "Heizung tropft", vermieter_id: "fremd", prop_id: "fremd", mieter_id: "fremd" }),
    );
    expect(r.ok).toBe(true);
    expect(insert(db, "anliegen")).toMatchObject({
      vermieter_id: "v-1",
      mieter_id: "m-1",
      prop_id: "p-1",
      mieter_user_id: "nutzer-1",
    });
  });

  it("ohne verknüpfte Wohnung entsteht kein Anliegen", async () => {
    const { db, mod } = await lade({ antworten: { mieter_zugaenge: null } });
    const r = await mod.erstelleAnliegen(fd({ typ: "frage", titel: "Hallo" }));
    expect(r.error).toContain("keiner Wohnung verknüpft");
    expect(insert(db, "anliegen")).toBeUndefined();
  });

  it("der Zugang wird über die eigene user_id gesucht", async () => {
    const { db, mod } = await lade(mitZugang());
    await mod.erstelleAnliegen(fd({ typ: "frage", titel: "X" }));
    expect(db.zugriffe[0].filter).toContain("eq:user_id=nutzer-1");
  });
});

describe("Typ und Betreff", () => {
  it("nur die drei bekannten Typen", async () => {
    const { db, mod } = await lade(mitZugang());
    for (const typ of ["schaden", "dokument", "frage"]) {
      expect((await mod.erstelleAnliegen(fd({ typ, titel: "X" }))).ok).toBe(true);
    }
    for (const typ of ["kuendigung", "admin", "'; drop--"]) {
      expect((await mod.erstelleAnliegen(fd({ typ, titel: "X" }))).error).toBe("Ungültiger Typ.");
    }
  });

  it("ohne Betreff passiert nichts — und es wird nicht einmal der Zugang gelesen", async () => {
    const { db, mod } = await lade(mitZugang());
    expect((await mod.erstelleAnliegen(fd({ typ: "frage", titel: "   " }))).error).toContain("Betreff");
    expect(db.zugriffe).toEqual([]);
  });
});

describe("Anhänge werden VOR dem Anlegen geprüft", () => {
  it("eine zu große Datei verhindert das Anliegen komplett", async () => {
    // Sonst stünde ein Anliegen ohne den Schadensfoto-Beleg da, und der Mieter
    // hielte die Meldung für vollständig.
    const { db, mod } = await lade(mitZugang());
    const r = await mod.erstelleAnliegen(
      fd({ typ: "schaden", titel: "X", dateien: bild(4 * 1024 * 1024 + 1) }),
    );
    expect(r.error).toContain("größer als 4 MB");
    expect(insert(db, "anliegen")).toBeUndefined();
  });

  it("ein verbotener Dateityp ebenso", async () => {
    const { db, mod } = await lade(mitZugang());
    for (const typ of ["application/x-msdownload", "image/svg+xml", "text/html"]) {
      const r = await mod.erstelleAnliegen(fd({ typ: "schaden", titel: "X", dateien: bild(100, typ) }));
      expect(r.error).toContain("nur Fotos");
    }
    expect(insert(db, "anliegen")).toBeUndefined();
  });

  it("mehr als drei Dateien werden abgelehnt", async () => {
    const { db, mod } = await lade(mitZugang());
    const f = new FormData();
    f.append("typ", "schaden");
    f.append("titel", "X");
    for (let i = 0; i < 4; i++) f.append("dateien", bild(100, "image/jpeg", `f${i}.jpg`));
    expect((await mod.erstelleAnliegen(f)).error).toContain("Maximal 3");
    expect(insert(db, "anliegen")).toBeUndefined();
  });

  it("erlaubte Anhänge werden am Anliegen gespeichert", async () => {
    const { db, mod } = await lade(mitZugang());
    await mod.erstelleAnliegen(fd({ typ: "schaden", titel: "X", dateien: bild(500, "image/png", "riss.png") }));
    expect(insert(db, "anliegen_dateien")).toMatchObject({
      anliegen_id: "a-1",
      name: "riss.png",
      mime: "image/png",
      groesse: 500,
    });
  });

  it("leere Dateifelder zählen nicht mit", async () => {
    // Ein leeres <input type="file"> schickt eine 0-Byte-Datei mit; die darf
    // das 3er-Limit nicht aufbrauchen.
    const { mod } = await lade(mitZugang());
    const f = new FormData();
    f.append("typ", "frage");
    f.append("titel", "X");
    for (let i = 0; i < 5; i++) f.append("dateien", bild(0));
    expect((await mod.erstelleAnliegen(f)).ok).toBe(true);
  });
});

describe("Terminvorschläge", () => {
  it("nur Werte im datetime-local-Format zählen, auf Minuten gekürzt", async () => {
    const { db, mod } = await lade();
    await mod.schlageTermineVor(
      fd({
        id: "a-1",
        slot1: "2026-09-10T14:30",
        slot2: "morgen früh",
        slot3: "2026-09-11T09:00:59.123Z",
      }),
    );
    expect(update(db)?.daten).toMatchObject({
      termin_vorschlaege: ["2026-09-10T14:30", "2026-09-11T09:00"],
    });
  });

  it("ein neuer Vorschlag setzt eine alte Bestätigung zurück", async () => {
    // Sonst stünde eine Bestätigung zu einem Termin, den es nicht mehr gibt.
    const { db, mod } = await lade();
    await mod.schlageTermineVor(fd({ id: "a-1", slot1: "2026-09-10T14:30" }));
    expect(update(db)?.daten).toMatchObject({ termin_bestaetigt: null, status: "in_arbeit" });
  });

  it("ohne brauchbaren Termin wird nichts geschrieben", async () => {
    const { db, mod } = await lade();
    const r = await mod.schlageTermineVor(fd({ id: "a-1", slot1: "irgendwann" }));
    expect(r.error).toContain("mindestens einen Termin");
    expect(db.zugriffe).toEqual([]);
  });

  it("Vorschlagen geht nur am eigenen Anliegen", async () => {
    const { db, mod } = await lade();
    await mod.schlageTermineVor(fd({ id: "a-1", slot1: "2026-09-10T14:30" }));
    expect(update(db)?.filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("bestätigen geht nur als der zugehörige MIETER", async () => {
    // Andere Seite, anderer Filter: Hier zählt `mieter_user_id`, nicht
    // `vermieter_id`. Vertauscht wäre es eine Rechteverwechslung.
    const { db, mod } = await lade();
    await mod.bestaetigeAnliegenTermin("a-1", "2026-09-10T14:30");
    const upd = update(db)!;
    expect(upd.filter).toContain("eq:mieter_user_id=nutzer-1");
    expect(upd.filter.some((f) => f.startsWith("eq:vermieter_id"))).toBe(false);
  });

  it("ein frei erfundener Bestätigungswert wird abgewiesen", async () => {
    const { db, mod } = await lade();
    for (const s of ["", "irgendwann", "2026-09-10"]) {
      expect((await mod.bestaetigeAnliegenTermin("a-1", s)).error).toContain("Ungültige Eingabe");
    }
    expect(db.zugriffe).toEqual([]);
  });
});

describe("Termin in den Kalender übernehmen", () => {
  it("ohne bestätigten Termin passiert nichts", async () => {
    const { db, mod } = await lade({ antworten: { anliegen: { titel: "X", termin_bestaetigt: null } } });
    expect((await mod.terminInKalender("a-1")).error).toContain("Kein bestätigter Termin");
    expect(insert(db, "termine")).toBeUndefined();
  });

  it("Datum und Uhrzeit werden korrekt aufgeteilt", async () => {
    const { db, mod } = await lade({
      antworten: { anliegen: { titel: "Heizung", termin_bestaetigt: "2026-09-10T14:30", prop_id: "p-1" } },
    });
    await mod.terminInKalender("a-1");
    const t = insert(db, "termine")!;
    expect(t).toMatchObject({ datum: "2026-09-10", user_id: "nutzer-1", prop_id: "p-1" });
    expect(String(t.titel)).toContain("Heizung");
    expect(String(t.notiz)).toContain("14:30");
  });

  it("gelesen wird nur das eigene Anliegen", async () => {
    const { db, mod } = await lade({ antworten: { anliegen: null } });
    await mod.terminInKalender("fremd");
    expect(db.zugriffe[0].filter).toContain("eq:vermieter_id=nutzer-1");
  });
});

describe("Bearbeiten durch den Vermieter", () => {
  it("nur die drei bekannten Status", async () => {
    const { db, mod } = await lade();
    for (const status of ["offen", "in_arbeit", "erledigt"]) {
      expect((await mod.bearbeiteAnliegen(fd({ id: "a-1", status }))).ok).toBe(true);
    }
    for (const status of ["geloescht", "abgelehnt", ""]) {
      expect((await mod.bearbeiteAnliegen(fd({ id: "a-1", status }))).error).toContain("Ungültige Eingabe");
    }
    expect(db.zugriffe.filter((z) => z.op === "update")).toHaveLength(3);
  });

  it("bearbeitet wird nur das eigene Anliegen", async () => {
    const { db, mod } = await lade();
    await mod.bearbeiteAnliegen(fd({ id: "a-1", status: "erledigt", antwort: "Termin steht" }));
    const upd = update(db)!;
    expect(upd.filter).toContain("eq:vermieter_id=nutzer-1");
    expect(upd.daten).toMatchObject({ status: "erledigt", antwort: "Termin steht" });
  });

  it("eine leere Antwort wird zu null, nicht zu ''", async () => {
    const { db, mod } = await lade();
    await mod.bearbeiteAnliegen(fd({ id: "a-1", status: "offen", antwort: "   " }));
    expect(update(db)?.daten).toMatchObject({ antwort: null });
  });
});
