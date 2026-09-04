import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/beleihung.ts — der Beleihungsordner fürs Bankgespräch.
//
// Was hier hochgeladen wird, ist das Empfindlichste, was die App speichert:
// Gehaltsabrechnungen, Steuerbescheide, SCHUFA-Selbstauskunft, Personalausweis.
// Alles als base64 IN DER TABELLE, nicht in einem Storage-Bucket. Zwei Dinge
// müssen deshalb stimmen: die Verschlüsselung, wenn ein Schlüssel da ist, und
// die Freigabe-Links, über die eine Bank ohne Konto an genau diese Dokumente
// kommt.

const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = KEY;
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init = {}) {
  const { db, client } = fakeSupabase({ antworten: { beleihung_dokumente: { item_key: "grundbuch" } }, ...init });
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/beleihung");
  return { db, mod };
}

function geschrieben(db: { zugriffe: { op: string; daten?: unknown }[] }) {
  return db.zugriffe.find((z) => z.op === "upsert")?.daten as Record<string, unknown> | undefined;
}

function datei(bytes: number, name = "gehalt.pdf") {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

describe("Nur bekannte Checklisten-Punkte", () => {
  it("ein erfundener Punkt wird abgewiesen — vor jedem Datenbankzugriff", async () => {
    // Sonst liesse sich über einen freien Schlüssel eine beliebige Zeile in
    // der Tabelle anlegen, die in keiner Oberfläche mehr auftaucht.
    const { db, mod } = await lade();
    await expect(mod.setBeleihungStatus("p1", "erfunden", "erledigt")).rejects.toThrow("Unbekanntes Checklisten-Item");
    expect(db.zugriffe).toEqual([]);
  });

  it("die Prüfung greift in allen vier Schreib-Aktionen", async () => {
    const { db, mod } = await lade();
    await expect(mod.setBeleihungDatum("p1", "quatsch", "2025-01-01")).rejects.toThrow("Unbekanntes");
    await expect(mod.removeBeleihungDatei("p1", "quatsch")).rejects.toThrow("Unbekanntes");
    await expect(mod.uploadBeleihungDatei("p1", "quatsch", fd({ datei: datei(10) }))).rejects.toThrow("Unbekanntes");
    expect(db.zugriffe).toEqual([]);
  });

  it("ein echter Punkt kommt durch", async () => {
    const { db, mod } = await lade();
    await mod.setBeleihungStatus("p1", "grundbuch", "erledigt");
    expect(geschrieben(db)).toMatchObject({ item_key: "grundbuch", status: "erledigt", user_id: "nutzer-1" });
  });
});

describe("Dateien: Grenze und Verschlüsselung", () => {
  it("über 8 MB wird abgelehnt — nichts wird geschrieben", async () => {
    const { db, mod } = await lade();
    await expect(mod.uploadBeleihungDatei("p1", "gehalt", fd({ datei: datei(8 * 1024 * 1024 + 1) }))).rejects.toThrow(
      "Datei zu groß",
    );
    expect(db.zugriffe).toEqual([]);
  });

  it("eine leere Datei zählt als „keine Datei“", async () => {
    const { mod } = await lade();
    await expect(mod.uploadBeleihungDatei("p1", "gehalt", fd({ datei: datei(0) }))).rejects.toThrow("Keine Datei");
  });

  it("mit Schlüssel liegt der Inhalt NICHT als lesbares base64 in der Zeile", async () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    vi.resetModules();
    const { db, mod } = await lade();
    const inhalt = new File([Buffer.from("GEHALT 4200 EUR NETTO")], "g.pdf", { type: "application/pdf" });
    await mod.uploadBeleihungDatei("p1", "gehalt", fd({ datei: inhalt }));
    const gespeichert = String(geschrieben(db)?.datei_data);
    expect(gespeichert).not.toContain("data:application/pdf;base64,");
    // Und der Klartext taucht auch nicht base64-kodiert auf.
    expect(gespeichert).not.toContain(Buffer.from("GEHALT 4200 EUR NETTO").toString("base64"));
  });

  it("ohne Schlüssel wird base64 abgelegt — bewusst, damit Bestand lesbar bleibt", async () => {
    // Kein Versehen: Die Datei-Routen entschlüsseln tolerant. Dieser Test hält
    // fest, dass das eine Entscheidung ist und keine vergessene Stelle.
    delete process.env.DATA_ENCRYPTION_KEY;
    vi.resetModules();
    const { db, mod } = await lade();
    await mod.uploadBeleihungDatei("p1", "gehalt", fd({ datei: datei(10) }));
    expect(String(geschrieben(db)?.datei_data)).toContain("data:application/pdf;base64,");
  });

  it("der Upload setzt den Status auf „hochgeladen“ und merkt die Metadaten", async () => {
    const { db, mod } = await lade();
    await mod.uploadBeleihungDatei("p1", "gehalt", fd({ datei: datei(1234, "Lohn Januar.pdf") }));
    expect(geschrieben(db)).toMatchObject({
      status: "hochgeladen",
      datei_name: "Lohn Januar.pdf",
      datei_type: "application/pdf",
      datei_size: 1234,
    });
  });

  it("Entfernen räumt alle vier Dateifelder ab, nicht nur den Namen", async () => {
    // Eine zurückbleibende `datei_data` wäre genau das, was der Nutzer mit dem
    // Klick loswerden wollte.
    const { db, mod } = await lade();
    await mod.removeBeleihungDatei("p1", "gehalt");
    expect(geschrieben(db)).toMatchObject({
      status: "offen",
      datei_name: null,
      datei_type: null,
      datei_size: null,
      datei_data: null,
    });
  });

  it("geschrieben wird je Nutzer/Objekt/Punkt genau eine Zeile", async () => {
    const { db, mod } = await lade();
    await mod.setBeleihungStatus("p1", "grundbuch", "erledigt");
    // onConflict verhindert, dass wiederholtes Abhaken Zeilen vervielfacht.
    expect(db.zugriffe[0].op).toBe("upsert");
  });
});

describe("Freigabe-Links für die Bank", () => {
  const FREIGABE = { token: "abc", item_keys: ["grundbuch"], ablauf: "2026-09-18", aktiv: true, created_at: null };

  it("unbekannte Dokumentschlüssel werden herausgefiltert", async () => {
    const { db, mod } = await lade({ antworten: { beleihung_freigaben: FREIGABE } });
    await mod.createFreigabe("p1", ["grundbuch", "erfunden", "../../etc/passwd"], {}, 14);
    expect(db.zugriffe.find((z) => z.op === "insert")?.daten).toMatchObject({ item_keys: ["grundbuch"] });
  });

  it("bleibt nichts Gültiges übrig, entsteht KEIN Link", async () => {
    // Ein Link ohne Dokumente wäre harmlos — einer, der versehentlich alles
    // freigibt, nicht. Deshalb hier lieber ein Fehler.
    const { db, mod } = await lade({ antworten: { beleihung_freigaben: FREIGABE } });
    await expect(mod.createFreigabe("p1", ["erfunden"], {}, 14)).rejects.toThrow("mindestens ein Dokument");
    expect(db.zugriffe).toEqual([]);
  });

  it("nur 7, 14 oder 30 Tage Laufzeit — sonst 14", async () => {
    for (const [eingabe, erwartetTage] of [[7, 7], [14, 14], [30, 30], [3650, 14], [0, 14], [-1, 14]] as const) {
      vi.resetModules();
      const { db, mod } = await lade({ antworten: { beleihung_freigaben: FREIGABE } });
      const vorher = Date.now();
      await mod.createFreigabe("p1", ["grundbuch"], {}, eingabe);
      const ablauf = new Date(String((db.zugriffe.find((z) => z.op === "insert")?.daten as never)["ablauf"])).getTime();
      const tage = Math.round((ablauf - vorher) / (24 * 3600 * 1000));
      expect(tage).toBe(erwartetTage);
    }
  });

  it("ein Widerruf deaktiviert, statt zu löschen", async () => {
    // Gelöscht wäre der Vorgang nicht mehr nachweisbar; die Bank soll eine
    // klare Absage sehen, keinen 404.
    const { db, mod } = await lade();
    await mod.widerrufeFreigabe("tok-1");
    const upd = db.zugriffe.find((z) => z.op === "update");
    expect(upd?.daten).toEqual({ aktiv: false });
    expect(upd?.filter).toContain("eq:token=tok-1");
  });

  it("die Freigabe hängt am angemeldeten Nutzer", async () => {
    const { db, mod } = await lade({ antworten: { beleihung_freigaben: FREIGABE } });
    await mod.createFreigabe("p1", ["grundbuch"], { wunschzins: "3,4" }, 14);
    expect(db.zugriffe.find((z) => z.op === "insert")?.daten).toMatchObject({
      user_id: "nutzer-1",
      prop_id: "p1",
      angaben: { wunschzins: "3,4" },
    });
  });
});

describe("Automatisch erzeugte Dokumente", () => {
  it("ein Punkt ohne Auto-Funktion wird abgelehnt, bevor irgendetwas geladen wird", async () => {
    const { db, mod } = await lade();
    await expect(mod.generiereBeleihungDokument("p1", "grundbuch")).rejects.toThrow(
      "kann nicht automatisch erzeugt werden",
    );
    expect(db.zugriffe).toEqual([]);
  });

  it("ein erfundener Punkt ebenfalls", async () => {
    const { mod } = await lade();
    await expect(mod.generiereBeleihungDokument("p1", "gibtsnicht")).rejects.toThrow(
      "kann nicht automatisch erzeugt werden",
    );
  });
});
