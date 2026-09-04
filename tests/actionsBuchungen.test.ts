import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";

// lib/actions/buchungen.ts — Einnahmen, Kosten, Verbrauch, Kredite, Notizen.
//
// Diese Datei FÜHRT die Actions aus. Bis zum 04.09.2026 tat das keine einzige
// Testdatei; `tests/registrierung.test.ts` durchsucht Actions nur als Text.
//
// Warum ausgerechnet hier angefangen wird: Es ist die Datei, in der Beträge
// entstehen. Ein Fehler wandert von hier ins Dashboard, in die NK-Abrechnung
// und in die Anlage V — also in ein Dokument, das ans Finanzamt geht.

beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
  vi.resetModules();
});
afterEach(() => {
  vi.doUnmock("next/cache");
  vi.doUnmock("next/navigation");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/admin");
});

async function lade(init = {}) {
  const { db, client, storage } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/buchungen");
  return { db, storage, spuren, mod };
}

/** Der letzte Schreibzugriff auf eine Tabelle. */
function schrieb(db: { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown> }[] }, tabelle: string) {
  const z = [...db.zugriffe].reverse().find((x) => x.tabelle === tabelle && x.daten);
  return z?.daten;
}

describe("Beträge: die Prüfung, die das Dashboard vor Unsinn schützt", () => {
  it("ein fehlender Betrag wird abgelehnt — nichts wird geschrieben", async () => {
    const { db, mod } = await lade();
    await expect(mod.createEinnahme(fd({ kategorie: "Miete" }))).rejects.toThrow("Bitte Betrag angeben.");
    // Der eigentliche Punkt: kein halb angelegter Datensatz.
    expect(db.zugriffe.filter((z) => z.op === "insert")).toHaveLength(0);
  });

  it("0 und negative Beträge werden abgelehnt", async () => {
    const { mod } = await lade();
    for (const betrag of ["0", "-1", "-0,01"]) {
      await expect(mod.createEinnahme(fd({ betrag }))).rejects.toThrow("muss größer als 0 sein");
    }
  });

  it("Komma-Beträge werden als Dezimalzahl gelesen, nicht verworfen", async () => {
    // Deutsche Eingabe: "1234,56". Ohne die Komma-Ersetzung wäre das NaN.
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "1234,56" })));
    expect(schrieb(db, "einnahmen")?.betrag).toBe(1234.56);
  });

  it("die eigene user_id wird mitgeschrieben — nicht dem Client überlassen", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "100", user_id: "fremde-id" })));
    // Auch wenn das Formular eine user_id mitschickt: maßgeblich ist die
    // aus der Sitzung. Sonst könnte man Buchungen unter fremdem Konto anlegen.
    expect(schrieb(db, "einnahmen")?.user_id).toBe("nutzer-1");
  });

  it("beim Ändern wird KEINE user_id geschrieben (RLS entscheidet)", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.updateEinnahme("e1", fd({ betrag: "50" })));
    const daten = schrieb(db, "einnahmen")!;
    expect("user_id" in daten).toBe(false);
    expect(db.zugriffe.some((z) => z.filter.includes("eq:id=e1"))).toBe(true);
  });
});

describe("NK-Anteil: muss in den Betrag passen", () => {
  it("ein NK-Anteil über dem Betrag wird abgelehnt", async () => {
    const { mod } = await lade();
    await expect(mod.createEinnahme(fd({ betrag: "500", nk_anteil: "600" }))).rejects.toThrow(
      "NK-Anteil muss zwischen 0 und dem Betrag liegen.",
    );
  });

  it("ein negativer NK-Anteil wird abgelehnt", async () => {
    const { mod } = await lade();
    await expect(mod.createEinnahme(fd({ betrag: "500", nk_anteil: "-1" }))).rejects.toThrow("NK-Anteil");
  });

  it("NK-Anteil genau in Höhe des Betrags ist erlaubt (reine NK-Zahlung)", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "500", nk_anteil: "500" })));
    expect(schrieb(db, "einnahmen")?.nk_anteil).toBe(500);
  });

  it("ohne NK-Anteil wird null geschrieben, nicht 0", async () => {
    // 0 hiesse „NK-Anteil ist null Euro", null heisst „nicht erfasst".
    // In der NK-Abrechnung ist das ein Unterschied.
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "500" })));
    expect(schrieb(db, "einnahmen")?.nk_anteil).toBeNull();
  });
});

describe("Kredite: die Restschuld-Vorbelegung", () => {
  it("leere Restschuld wird mit der Darlehenssumme vorbelegt", async () => {
    // Ohne diese Regel stünde ein frisches Darlehen mit Restschuld 0 da und
    // würde als „100 % getilgt" dargestellt.
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createKredit(fd({ betrag: "300000" })));
    expect(schrieb(db, "kredite")?.restschuld).toBe(300000);
  });

  it("eine angegebene Restschuld wird NICHT überschrieben", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createKredit(fd({ betrag: "300000", restschuld: "250000" })));
    expect(schrieb(db, "kredite")?.restschuld).toBe(250000);
  });

  it("Restschuld 0 bleibt 0 — ein getilgtes Darlehen wird nicht zurückgesetzt", async () => {
    // Fallstrick: `num(...) ?? num("betrag")` greift bei null, nicht bei 0.
    // Dieser Test hält fest, dass das so gemeint ist.
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createKredit(fd({ betrag: "300000", restschuld: "0" })));
    expect(schrieb(db, "kredite")?.restschuld).toBe(0);
  });

  it("die Darlehensnummer wird verschlüsselt gespeichert, nie im Klartext", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createKredit(fd({ betrag: "1000", darlnr: "DN-4711-GEHEIM" })));
    const darlnr = schrieb(db, "kredite")?.darlnr as string;
    expect(darlnr).not.toContain("4711");
    expect(darlnr).not.toBe("DN-4711-GEHEIM");
  });

  it("ohne Darlehensnummer wird null gespeichert, kein Chiffretext von ''", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createKredit(fd({ betrag: "1000" })));
    expect(schrieb(db, "kredite")?.darlnr).toBeNull();
  });
});

describe("Weiterleitung nach dem Speichern: kein Open Redirect", () => {
  it("ein interner Pfad aus dem Formular wird übernommen", async () => {
    const { mod } = await lade();
    const ziel = await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "1", back: "/objekte/5" })));
    expect(ziel).toContain("/objekte/5");
  });

  it("protokoll-relative Ziele werden auf den Fallback gezwungen", async () => {
    // "//example.com" beginnt mit "/", ist für den Browser aber eine ABSOLUTE
    // fremde URL — geeignet für eine nachgebaute Login-Maske.
    const { mod } = await lade();
    for (const boesartig of ["//example.com", "/\\example.com", "https://example.com"]) {
      const ziel = await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "1", back: boesartig })));
      expect(ziel.startsWith("/einnahmen")).toBe(true);
      expect(ziel).not.toContain("example.com");
    }
  });

  it("die Flash-Meldung wird URL-kodiert angehängt", async () => {
    const { mod } = await lade();
    const ziel = await fangeRedirect(() => mod.createEinnahme(fd({ betrag: "1" })));
    expect(ziel).toBe("/einnahmen?flash=Gespeichert.");
  });
});

describe("Datenbankfehler werden nicht verschluckt", () => {
  it("ein Insert-Fehler wirft und leitet NICHT weiter", async () => {
    // Sonst sähe der Nutzer „Gespeichert." zu etwas, das nie ankam.
    const { mod, spuren } = await lade({ fehler: { message: "duplicate key" } });
    await expect(mod.createEinnahme(fd({ betrag: "10" }))).rejects.toThrow("duplicate key");
    expect(spuren.redirects).toEqual([]);
  });
});

describe("Dateianhänge: Grössengrenzen greifen vor dem Upload", () => {
  function datei(bytes: number, name = "beleg.pdf") {
    return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
  }

  it("ein Beleg über 15 MB wird abgelehnt — und nichts hochgeladen", async () => {
    const { mod, storage, db } = await lade();
    await expect(mod.createKosten(fd({ betrag: "10", rechnung: datei(15 * 1024 * 1024 + 1) }))).rejects.toThrow(
      "Beleg zu groß",
    );
    expect(storage.hochgeladen).toEqual([]);
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("ein Notiz-Anhang über 6 MB wird abgelehnt", async () => {
    const { mod } = await lade();
    await expect(mod.createNotiz(fd({ titel: "x", datei: datei(6 * 1024 * 1024 + 1) }))).rejects.toThrow(
      "Anhang zu groß",
    );
  });

  it("eine leere Datei zählt als „kein Anhang“ und blockiert nicht", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.createKosten(fd({ betrag: "10", rechnung: datei(0) })));
    const daten = schrieb(db, "kosten")!;
    expect("rechnung_path" in daten).toBe(false);
  });

  it("der Upload-Pfad beginnt mit der eigenen user_id (RLS je Ordner)", async () => {
    const { mod, storage } = await lade();
    await fangeRedirect(() => mod.createKosten(fd({ betrag: "10", rechnung: datei(100) })));
    expect(storage.hochgeladen).toHaveLength(1);
    expect(storage.hochgeladen[0].startsWith("nutzer-1/")).toBe(true);
  });

  it("der Dateiname aus dem Upload landet NICHT im Speicherpfad", async () => {
    // Sonst liesse sich über einen präparierten Namen aus dem eigenen
    // user_id-Ordner heraussteuern.
    const { mod, storage } = await lade();
    const boese = new File([new Uint8Array(10)], "../../../etc/passwd.pdf", { type: "application/pdf" });
    await fangeRedirect(() => mod.createKosten(fd({ betrag: "10", rechnung: boese })));
    expect(storage.hochgeladen[0]).not.toContain("..");
    expect(storage.hochgeladen[0]).not.toContain("passwd");
    expect(storage.hochgeladen[0]).toMatch(/^nutzer-1\/[0-9a-f-]+\.pdf$/);
  });

  it("beim Ersetzen wird der alte Beleg entfernt", async () => {
    const { mod, storage } = await lade({ antworten: { kosten: { rechnung_path: "nutzer-1/alt.pdf" } } });
    await fangeRedirect(() => mod.updateKosten("k1", fd({ betrag: "10", rechnung: datei(100) })));
    expect(storage.entfernt).toContain("nutzer-1/alt.pdf");
  });

  it("Löschen einer Kostenzeile räumt den Beleg mit weg", async () => {
    const { mod, storage } = await lade({ antworten: { kosten: { rechnung_path: "nutzer-1/x.pdf" } } });
    await mod.deleteKosten("k1");
    expect(storage.entfernt).toContain("nutzer-1/x.pdf");
  });
});
