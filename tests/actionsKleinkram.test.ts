import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { ARTEN } from "@/lib/dokumentVorlagen";

// Die fünf kleinsten Action-Dateien in einer Testdatei — damit ist T2 geschlossen:
//   · firmen.ts             Firmenverzeichnis (Handwerker, Dienste)
//   · vermieter.ts          Vermieter-Profil (Absender für Briefe/PDFs)
//   · dokumentVorlagen.ts   eigene Standardtexte je Dokumentart
//   · selbstauskunft.ts     verschlüsselte Selbstauskunft (Kauf-Assistent)
//   · vermieterAnfragen.ts  Anfragen des Vermieters an den Mieter
//
// Zwei Nachbesserungen in dokumentVorlagen.ts (08.09.2026): Die Dokumentart kam
// ungeprüft vom Client (ein freier Schlüssel legte eine Zeile an, die keine
// Oberfläche je zeigt), und der Text hatte keine Obergrenze.

const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  vi.resetModules();
});
afterEach(() => {
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = KEY;
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, spuren, mod };
}

type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const zugriff = (db: Db, tabelle: string, op: string) => db.zugriffe.find((z) => z.tabelle === tabelle && z.op === op);

describe("Firmenverzeichnis", () => {
  it("der Name ist Pflicht", async () => {
    const { db, mod } = await lade("@/lib/actions/firmen");
    expect(await mod.erstelleFirma(fd({ name: "  " }))).toEqual({ error: "Bitte den Firmennamen angeben." });
    expect(db.zugriffe).toEqual([]);
  });

  it("eine E-Mail mit ?, & oder Leerzeichen wird abgewiesen — sie käme in einen mailto-Link", async () => {
    const { db, mod } = await lade("@/lib/actions/firmen");
    for (const email of ["a@b.de?subject=x", "a@b.de&cc=x", "a b@c.de", "keine-mail"]) {
      expect((await mod.erstelleFirma(fd({ name: "X", email }))).error, email).toMatch(/E-Mail/);
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("die Website bekommt ein https://, wenn es fehlt; alle Felder werden gekappt", async () => {
    const { db, mod } = await lade("@/lib/actions/firmen");
    await mod.erstelleFirma(fd({ name: "n".repeat(300), website: "handwerker.de", telefon: "1".repeat(80), notiz: "z".repeat(600), email: "a@b.de" }));
    const d = zugriff(db, "firmen", "insert")!.daten!;
    expect(d.website).toBe("https://handwerker.de");
    expect(String(d.name)).toHaveLength(200);
    expect(String(d.telefon)).toHaveLength(50);
    expect(String(d.notiz)).toHaveLength(500);
    expect(d.user_id).toBe("nutzer-1");
    const { db: db2, mod: mod2 } = await lade("@/lib/actions/firmen");
    await mod2.erstelleFirma(fd({ name: "X", website: "http://alt.de" }));
    expect(zugriff(db2, "firmen", "insert")!.daten!.website).toBe("http://alt.de");
  });

  it("Löschen hängt am eigenen Konto und meldet Fehler", async () => {
    const { db, mod } = await lade("@/lib/actions/firmen");
    expect(await mod.loescheFirma("f1")).toEqual({ ok: true });
    expect(zugriff(db, "firmen", "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=f1", "eq:user_id=nutzer-1"]));
    const { mod: mod2 } = await lade("@/lib/actions/firmen", { fehlerBei: { firmen: { message: "boom" } } });
    expect(await mod2.loescheFirma("f1")).toEqual({ error: "Firma konnte nicht gelöscht werden." });
  });
});

describe("Vermieter-Profil", () => {
  it("ein Datensatz je Nutzer — Upsert auf user_id, leere Felder werden null", async () => {
    const { db, spuren, mod } = await lade("@/lib/actions/vermieter");
    await mod.saveVermieter(fd({ name: "  Max Muster ", strasse: "", plz: "23611" }));
    const z = zugriff(db, "vermieter_profil", "upsert")!;
    expect(z.daten).toMatchObject({ user_id: "nutzer-1", name: "Max Muster", strasse: null, plz: "23611", ort: null });
    expect(spuren.revalidiert).toContain("/einstellungen");
  });

  it("ein Datenbankfehler wird geworfen", async () => {
    const { mod } = await lade("@/lib/actions/vermieter", { fehlerBei: { vermieter_profil: { message: "boom" } } });
    await expect(mod.saveVermieter(fd({ name: "X" }))).rejects.toThrow("boom");
  });
});

describe("Dokument-Vorlagen", () => {
  it("nur bekannte Dokumentarten — ein erfundener Schlüssel erreicht die Datenbank nicht", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumentVorlagen");
    for (const art of ["erfunden", "", "../mahnung", "MAHNUNG"]) {
      await expect(mod.saveDokumentVorlage(art, "Text"), art).rejects.toThrow("Unbekannte Dokumentart");
      await expect(mod.resetDokumentVorlage(art), art).rejects.toThrow("Unbekannte Dokumentart");
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("jede Art aus der Liste kommt durch, Konflikt auf (user_id, art)", async () => {
    for (const { v } of ARTEN) {
      const { db, mod } = await lade("@/lib/actions/dokumentVorlagen");
      await mod.saveDokumentVorlage(v, "Sehr geehrte …");
      const z = zugriff(db, "dokument_vorlagen", "upsert")!;
      expect(z.daten, v).toMatchObject({ user_id: "nutzer-1", art: v, text: "Sehr geehrte …" });
    }
  });

  it("der Text hat eine Obergrenze", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumentVorlagen");
    await expect(mod.saveDokumentVorlage("mahnung", "x".repeat(20_001))).rejects.toThrow("zu lang");
    expect(db.zugriffe).toEqual([]);
    await mod.saveDokumentVorlage("mahnung", "x".repeat(20_000));
    expect(zugriff(db, "dokument_vorlagen", "upsert")).toBeDefined();
  });

  it("Zurücksetzen löscht genau die eigene Vorlage dieser Art", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumentVorlagen");
    await mod.resetDokumentVorlage("kuendigung");
    expect(zugriff(db, "dokument_vorlagen", "delete")!.filter).toEqual(expect.arrayContaining(["eq:user_id=nutzer-1", "eq:art=kuendigung"]));
  });
});

describe("Selbstauskunft", () => {
  it("wird verschlüsselt gespeichert — der Klartext taucht in der Zeile nicht auf", async () => {
    const { db, mod } = await lade("@/lib/actions/selbstauskunft");
    const r = await mod.speichereSelbstauskunft({ einkommen: 4200, arbeitgeber: "Musterwerk GmbH" } as never);
    expect(r).toEqual({ ok: true });
    const z = zugriff(db, "selbstauskunft", "upsert")!;
    expect(z.daten!.user_id).toBe("nutzer-1");
    expect(String(z.daten!.daten_enc)).not.toContain("Musterwerk");
    expect(String(z.daten!.daten_enc)).not.toContain("4200");
  });

  it("ohne Schlüssel wird NICHT im Klartext gespeichert, sondern abgebrochen", async () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    const { db, mod } = await lade("@/lib/actions/selbstauskunft");
    const r = await mod.speichereSelbstauskunft({ einkommen: 4200 } as never);
    expect(r.ok).toBe(false);
    expect(String(r.error)).toMatch(/DATA_ENCRYPTION_KEY/);
    expect(db.zugriffe).toEqual([]);
  });

  it("Laden gibt die entschlüsselten, normalisierten Daten zurück — und null, wenn nichts da ist", async () => {
    const { db, mod } = await lade("@/lib/actions/selbstauskunft");
    await mod.speichereSelbstauskunft({ einkommen: 4200 } as never);
    const enc = zugriff(db, "selbstauskunft", "upsert")!.daten!.daten_enc as string;
    const { mod: mod2 } = await lade("@/lib/actions/selbstauskunft", { antworten: { selbstauskunft: { daten_enc: enc } } });
    const d = await mod2.ladeSelbstauskunft();
    expect(d?.einkommen).toBe(4200);
    expect(d).toHaveProperty("bankguthaben"); // aus LEERE_SELBSTAUSKUNFT aufgefüllt
    const { mod: mod3 } = await lade("@/lib/actions/selbstauskunft", { antworten: { selbstauskunft: null } });
    expect(await mod3.ladeSelbstauskunft()).toBeNull();
  });

  it("ein defekter Blob (anderer Schlüssel) wird wie „noch nichts“ behandelt, nicht als Absturz", async () => {
    const { mod } = await lade("@/lib/actions/selbstauskunft", { antworten: { selbstauskunft: { daten_enc: "v1:kaputt" } } });
    expect(await mod.ladeSelbstauskunft()).toBeNull();
  });
});

describe("Anfragen des Vermieters an den Mieter", () => {
  const MIETER = { id: "m1", prop_id: "obj-1" };

  it("Mieter, bekannter Typ und Betreff sind Pflicht — geprüft vor jedem Zugriff", async () => {
    const { db, mod } = await lade("@/lib/actions/vermieterAnfragen", { antworten: { mieter: MIETER } });
    expect(await mod.erstelleVermieterAnfrage(fd({ typ: "zutritt", titel: "X" }))).toMatchObject({ error: /Mieter/ });
    expect(await mod.erstelleVermieterAnfrage(fd({ mieterId: "m1", typ: "erfunden", titel: "X" }))).toMatchObject({ error: /Typ/ });
    expect(await mod.erstelleVermieterAnfrage(fd({ mieterId: "m1", typ: "zutritt", titel: "  " }))).toMatchObject({ error: /Betreff/ });
    expect(db.zugriffe).toEqual([]);
  });

  it("der Mieter muss dem Vermieter gehören; das Objekt kommt aus dem Mieter, nicht vom Client", async () => {
    const { db, mod } = await lade("@/lib/actions/vermieterAnfragen", { antworten: { mieter: MIETER } });
    expect(await mod.erstelleVermieterAnfrage(fd({ mieterId: "m1", typ: "zaehlerstand", titel: "Bitte ablesen", prop_id: "fremd" }))).toEqual({ ok: true });
    expect(zugriff(db, "mieter", "select")!.filter).toContain("eq:user_id=nutzer-1");
    expect(zugriff(db, "vermieter_anfragen", "insert")!.daten).toMatchObject({
      vermieter_id: "nutzer-1", mieter_id: "m1", prop_id: "obj-1", typ: "zaehlerstand", titel: "Bitte ablesen", beschreibung: null,
    });
    const { db: db2, mod: mod2 } = await lade("@/lib/actions/vermieterAnfragen", { antworten: { mieter: null } });
    expect(await mod2.erstelleVermieterAnfrage(fd({ mieterId: "fremd", typ: "zutritt", titel: "X" }))).toEqual({ error: "Mieter nicht gefunden." });
    expect(zugriff(db2, "vermieter_anfragen", "insert")).toBeUndefined();
  });

  it("der Mieter kann nur „erledigt“ oder „abgelehnt“ antworten", async () => {
    const { db, mod } = await lade("@/lib/actions/vermieterAnfragen");
    for (const status of ["offen", "gelöscht", ""]) {
      expect((await mod.beantworteVermieterAnfrage(fd({ id: "a1", status }))).error, status).toBeTruthy();
    }
    expect(db.zugriffe).toEqual([]);
    expect(await mod.beantworteVermieterAnfrage(fd({ id: "a1", status: "abgelehnt", antwort: "  Passt nicht  " }))).toEqual({ ok: true });
    expect(zugriff(db, "vermieter_anfragen", "update")!.daten).toMatchObject({ status: "abgelehnt", antwort: "Passt nicht" });
  });

  it("Löschen hängt am Vermieter", async () => {
    const { db, mod } = await lade("@/lib/actions/vermieterAnfragen");
    await mod.loescheVermieterAnfrage("a1");
    expect(zugriff(db, "vermieter_anfragen", "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=a1", "eq:vermieter_id=nutzer-1"]));
  });
});
