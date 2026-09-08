import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/makler.ts — der Makler-Ordner (Käuferseite).
//
// Strukturzwilling von `beleihung.ts`, aber nutzergebunden statt objektgebunden:
// unique (user_id, item_key). Die Tests spiegeln deshalb bewusst die des
// Zwillings — wo die beiden Dateien sich unterscheiden, steht es dabei.
//
// Was hier liegt, ist ähnlich empfindlich wie im Bank-Ordner (Ausweis, SCHUFA,
// Einkommensnachweise) — und die Checkliste selbst rät zur Datensparsamkeit.
// Umso wichtiger, dass Verschlüsselung und Schlüssel-Weißliste greifen.

const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = KEY;
  for (const m of [
    "next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin",
    "@/lib/actions/selbstauskunft", "@/lib/pdf/kaeuferPdf",
  ]) {
    vi.doUnmock(m);
  }
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}, selbstauskunft: unknown = null) {
  vi.resetModules();
  const { db, client } = fakeSupabase({ antworten: { makler_dokumente: { item_key: "ausweis" } }, ...init });
  mockeNextUndSupabase(client);
  // Die Selbstauskunft ist verschlüsselt gespeichert und hat eine eigene
  // Action; hier wird nur ihr Ergebnis vorgegeben.
  vi.doMock("@/lib/actions/selbstauskunft", () => ({ ladeSelbstauskunft: async () => selbstauskunft }));
  vi.doMock("@/lib/pdf/kaeuferPdf", () => ({
    buildKaeuferSelbstauskunftPdf: async () => new Uint8Array(Buffer.from("%PDF-1.4 fake")),
  }));
  const mod = await import("@/lib/actions/makler");
  return { db, mod };
}

const geschrieben = (db: { zugriffe: { op: string; daten?: unknown }[] }) =>
  db.zugriffe.find((z) => z.op === "upsert")?.daten as Record<string, unknown> | undefined;

const datei = (bytes: number, name = "ausweis.pdf") =>
  new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

describe("Nur bekannte Checklisten-Punkte", () => {
  it("ein erfundener Punkt wird abgewiesen — vor jedem Datenbankzugriff", async () => {
    const { db, mod } = await lade();
    await expect(mod.setMaklerStatus("erfunden", "erledigt")).rejects.toThrow("Unbekanntes Checklisten-Item");
    expect(db.zugriffe).toEqual([]);
  });

  it("die Prüfung greift in allen vier Schreib-Aktionen", async () => {
    const { db, mod } = await lade();
    await expect(mod.setMaklerDatum("quatsch", "2025-01-01")).rejects.toThrow("Unbekanntes");
    await expect(mod.removeMaklerDatei("quatsch")).rejects.toThrow("Unbekanntes");
    await expect(mod.uploadMaklerDatei("quatsch", fd({ datei: datei(10) }))).rejects.toThrow("Unbekanntes");
    expect(db.zugriffe).toEqual([]);
  });

  it("ein echter Punkt kommt durch — und hängt am Nutzer, nicht an einem Objekt", async () => {
    // Der Unterschied zum Bank-Ordner: keine prop_id, Konflikt auf (user_id, item_key).
    const { db, mod } = await lade();
    await mod.setMaklerStatus("ausweis", "erledigt");
    const d = geschrieben(db)!;
    expect(d).toMatchObject({ item_key: "ausweis", status: "erledigt", user_id: "nutzer-1" });
    expect(d).not.toHaveProperty("prop_id");
  });

  it("das Datum wird gesetzt, ein leerer Wert löscht es", async () => {
    const { db, mod } = await lade();
    await mod.setMaklerDatum("schufa_bonitaet", "2026-08-01");
    expect(geschrieben(db)!.datum).toBe("2026-08-01");
    const { db: db2, mod: mod2 } = await lade();
    await mod2.setMaklerDatum("schufa_bonitaet", "");
    expect(geschrieben(db2)!.datum).toBeNull();
  });
});

describe("Dateien: Grenze und Verschlüsselung", () => {
  it("über 8 MB wird abgelehnt — nichts wird geschrieben", async () => {
    const { db, mod } = await lade();
    await expect(mod.uploadMaklerDatei("ausweis", fd({ datei: datei(8 * 1024 * 1024 + 1) }))).rejects.toThrow(
      "Datei zu groß",
    );
    expect(db.zugriffe).toEqual([]);
  });

  it("eine leere oder fehlende Datei zählt als „keine Datei“", async () => {
    const { mod } = await lade();
    await expect(mod.uploadMaklerDatei("ausweis", fd({ datei: datei(0) }))).rejects.toThrow("Keine Datei");
    await expect(mod.uploadMaklerDatei("ausweis", fd({}))).rejects.toThrow("Keine Datei");
  });

  it("mit Schlüssel liegt der Inhalt NICHT als lesbares base64 in der Zeile", async () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const { db, mod } = await lade();
    const inhalt = new File([Buffer.from("AUSWEISNUMMER L01X00T47")], "a.pdf", { type: "application/pdf" });
    await mod.uploadMaklerDatei("ausweis", fd({ datei: inhalt }));
    const gespeichert = String(geschrieben(db)?.datei_data);
    expect(gespeichert).not.toContain("data:application/pdf;base64,");
    expect(gespeichert).not.toContain(Buffer.from("AUSWEISNUMMER L01X00T47").toString("base64"));
  });

  it("ohne Schlüssel wird base64 abgelegt — bewusst, wie im Bank-Ordner", async () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    const { db, mod } = await lade();
    await mod.uploadMaklerDatei("ausweis", fd({ datei: datei(10) }));
    expect(String(geschrieben(db)?.datei_data)).toContain("data:application/pdf;base64,");
  });

  it("der Upload setzt den Status auf „hochgeladen“ und merkt die Metadaten", async () => {
    const { db, mod } = await lade();
    await mod.uploadMaklerDatei("ausweis", fd({ datei: datei(1234, "Ausweis vorn.pdf") }));
    expect(geschrieben(db)).toMatchObject({
      status: "hochgeladen", datei_name: "Ausweis vorn.pdf", datei_type: "application/pdf", datei_size: 1234,
    });
  });

  it("ohne MIME-Typ wird octet-stream gespeichert — die Auslieferung entscheidet dann", async () => {
    // Kein Upload-Whitelisting hier (bewusst, siehe lib/net/dateiKopf.ts):
    // alles, was nicht PDF/Bild ist, wird beim Ausliefern zum Download gezwungen.
    const { db, mod } = await lade();
    await mod.uploadMaklerDatei("ausweis", fd({ datei: new File([new Uint8Array(5)], "x") }));
    expect(geschrieben(db)!.datei_type).toBe("application/octet-stream");
  });

  it("Entfernen räumt alle vier Dateifelder ab, nicht nur den Namen", async () => {
    const { db, mod } = await lade();
    await mod.removeMaklerDatei("ausweis");
    expect(geschrieben(db)).toMatchObject({
      status: "offen", datei_name: null, datei_type: null, datei_size: null, datei_data: null,
    });
  });

  it("ein Datenbankfehler wird geworfen, nicht verschluckt", async () => {
    const { mod } = await lade({ fehlerBei: { makler_dokumente: { message: "boom" } } });
    await expect(mod.setMaklerStatus("ausweis", "erledigt")).rejects.toThrow("boom");
  });
});

describe("Käufer-Selbstauskunft aus MyImmo erzeugen", () => {
  it("nur der eine Punkt mit Auto-Funktion — alle anderen werden abgelehnt, bevor etwas geladen wird", async () => {
    const { db, mod } = await lade();
    for (const key of ["ausweis", "schufa_bonitaet", "gibtsnicht"]) {
      await expect(mod.generiereMaklerDokument(key)).rejects.toThrow("kann nicht automatisch erzeugt werden");
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("ohne ausgefüllte Selbstauskunft gibt es eine klare Meldung statt eines leeren PDFs", async () => {
    const { db, mod } = await lade({}, null);
    await expect(mod.generiereMaklerDokument("kaeufer_selbstauskunft")).rejects.toThrow("Keine Selbstauskunft");
    expect(db.zugriffe.some((z) => z.op === "upsert")).toBe(false);
  });

  it("das erzeugte PDF landet verschlüsselt am Punkt und setzt ihn auf „hochgeladen“", async () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const { db, mod } = await lade(
      { antworten: { vermieter_profil: { name: "Max Muster", strasse: "Weg 1", plz: "23611", ort: "Bad Schwartau", email: "m@x.de" }, makler_dokumente: { item_key: "kaeufer_selbstauskunft" } } },
      { einkommen: 4200 },
    );
    await mod.generiereMaklerDokument("kaeufer_selbstauskunft");
    const d = geschrieben(db)!;
    expect(d).toMatchObject({
      item_key: "kaeufer_selbstauskunft", status: "hochgeladen",
      datei_name: "Kaeufer-Selbstauskunft.pdf", datei_type: "application/pdf", user_id: "nutzer-1",
    });
    expect(String(d.datei_data)).not.toContain("data:application/pdf;base64,");
  });
});
