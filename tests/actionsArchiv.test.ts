import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/archiv.ts — die zentrale Dokumentenablage (Tabelle `notizen`).
//
// Kein MIME-Whitelisting beim Hochladen — bewusst, die Auslieferung entscheidet
// (lib/net/dateiKopf.ts). Hier geht es um drei Dinge: die 8-MB-Grenze, dass
// Bearbeiten ohne neue Datei die alte NICHT anfasst, und dass Bearbeiten und
// Löschen am eigenen Konto hängen.
//
// Beim Bearbeiten geprüft (ArchivManager.tsx): Das Formular schickt alle fünf
// Felder mit — der `notiz_import`-Fehler aus properties.ts (nicht mitgeschicktes
// Feld wird mit null überschrieben) tritt hier nicht auf.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/archiv");
  return { db, spuren, mod };
}

type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const zugriff = (db: Db, op: string) => db.zugriffe.find((z) => z.tabelle === "notizen" && z.op === op);
const datei = (bytes: number, name = "vertrag.pdf", type = "application/pdf") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("Dokument anlegen", () => {
  it("ohne Datei entsteht ein reiner Notiz-Eintrag mit Standardwerten", async () => {
    const { db, spuren, mod } = await lade();
    await mod.createDokument(fd({ inhalt: "Nur ein Vermerk" }));
    const d = zugriff(db, "insert")!.daten!;
    expect(d).toMatchObject({ user_id: "nutzer-1", titel: "Dokument", kategorie: "Sonstiges", inhalt: "Nur ein Vermerk", prop_id: null, mieter_id: null });
    expect(d).not.toHaveProperty("datei_data");
    expect(spuren.revalidiert).toContain("/archiv");
  });

  it("mit Datei landen Name, Typ, Größe und base64-Inhalt in der Zeile", async () => {
    const { db, mod } = await lade();
    await mod.createDokument(fd({ titel: "Mietvertrag", kategorie: "Mietvertrag", prop_id: "obj-1", mieter_id: "m1", datei: datei(20, "MV 2024.pdf") }));
    expect(zugriff(db, "insert")!.daten).toMatchObject({
      titel: "Mietvertrag", kategorie: "Mietvertrag", prop_id: "obj-1", mieter_id: "m1",
      datei_name: "MV 2024.pdf", datei_type: "application/pdf", datei_size: 20,
      datei_data: "data:application/pdf;base64," + Buffer.alloc(20).toString("base64"),
    });
  });

  it("über 8 MB wird abgelehnt — nichts wird geschrieben", async () => {
    const { db, mod } = await lade();
    await expect(mod.createDokument(fd({ titel: "X", datei: datei(8 * 1024 * 1024 + 1) }))).rejects.toThrow("Datei zu groß");
    expect(zugriff(db, "insert")).toBeUndefined();
  });

  it("eine leere Datei zählt als keine", async () => {
    const { db, mod } = await lade();
    await mod.createDokument(fd({ titel: "X", datei: datei(0) }));
    expect(zugriff(db, "insert")!.daten).not.toHaveProperty("datei_data");
  });

  it("ohne MIME-Typ wird octet-stream gespeichert — die Auslieferung entscheidet", async () => {
    const { db, mod } = await lade();
    await mod.createDokument(fd({ titel: "X", datei: datei(5, "x", "") }));
    expect(zugriff(db, "insert")!.daten!.datei_type).toBe("application/octet-stream");
  });

  it("ein Datenbankfehler wird geworfen, nicht verschluckt", async () => {
    const { mod } = await lade({ fehlerBei: { notizen: { message: "boom" } } });
    await expect(mod.createDokument(fd({ titel: "X" }))).rejects.toThrow("boom");
  });
});

describe("Dokument bearbeiten", () => {
  it("ohne neue Datei bleibt die alte unangetastet", async () => {
    // Das Formular hat immer ein leeres Dateifeld. Würde das als „Datei
    // entfernen" gelesen, verlöre jede Titeländerung den Anhang.
    const { db, mod } = await lade();
    await mod.updateDokument("n1", fd({ titel: "Neuer Titel", kategorie: "Sonstiges" }));
    const d = zugriff(db, "update")!.daten!;
    expect(d.titel).toBe("Neuer Titel");
    for (const k of ["datei_name", "datei_type", "datei_size", "datei_data"]) expect(d).not.toHaveProperty(k);
  });

  it("mit neuer Datei wird sie ersetzt", async () => {
    const { db, mod } = await lade();
    await mod.updateDokument("n1", fd({ titel: "T", datei: datei(7, "neu.pdf") }));
    expect(zugriff(db, "update")!.daten).toMatchObject({ datei_name: "neu.pdf", datei_size: 7 });
  });

  it("Bearbeiten und Löschen sind auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade();
    await mod.updateDokument("n1", fd({ titel: "T" }));
    expect(zugriff(db, "update")!.filter).toEqual(expect.arrayContaining(["eq:id=n1", "eq:user_id=nutzer-1"]));
    const { db: db2, mod: mod2 } = await lade();
    await mod2.deleteDokument("n1");
    expect(zugriff(db2, "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=n1", "eq:user_id=nutzer-1"]));
  });
});
