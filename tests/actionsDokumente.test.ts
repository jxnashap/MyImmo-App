import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// lib/actions/dokumente.ts — „Speichern" für Brief, NK-Abrechnung und
// Übergabeprotokoll: erzeugt dasselbe PDF wie die Download-Route und legt es
// als Archiv-Eintrag beim Mieter ab. Die PDF-Erzeugung selbst (lib/pdf/erzeugen)
// wird hier ersetzt — geprüft wird, was mit dem Ergebnis passiert.
//
// FUND (08.09.2026): Die Mieter-Abfrage in `archiviere()` wertete den Fehler
// nicht aus und filterte nicht auf den Nutzer. Bei einem Abfragefehler landete
// das Dokument OHNE Objekt-Zuordnung im Archiv — unter dem Objekt nicht zu
// finden, aber „gespeichert". Jetzt fail-closed.

const PDF = new Uint8Array(Buffer.from("%PDF-1.4 test"));

type Erzeuger = { titel: string; dateiname: string; pdf: Uint8Array } | null;

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/pdf/erzeugen"]) {
    vi.doUnmock(m);
  }
});

async function lade(
  init: Parameters<typeof fakeSupabase>[0] = {},
  erzeuger: { brief?: Erzeuger | Error; nk?: Erzeuger | Error; protokoll?: Erzeuger | Error } = {},
) {
  vi.resetModules();
  const { db, client } = fakeSupabase({ antworten: { mieter: { prop_id: "obj-1" } }, ...init });
  const spuren = mockeNextUndSupabase(client);
  const liefere = (e: Erzeuger | Error | undefined) => async () => {
    if (e instanceof Error) throw e;
    return e === undefined ? { titel: "Dok", dateiname: "dok.pdf", pdf: PDF } : e;
  };
  vi.doMock("@/lib/pdf/erzeugen", () => ({
    erzeugeBriefPdf: liefere(erzeuger.brief),
    erzeugeNkPdf: liefere(erzeuger.nk),
    erzeugeProtokollPdf: liefere(erzeuger.protokoll),
  }));
  const mod = await import("@/lib/actions/dokumente");
  return { db, spuren, mod };
}

const archivEintrag = (db: { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown> }[] }) =>
  db.zugriffe.find((z) => z.tabelle === "notizen" && z.op === "insert")?.daten;

describe("Archivieren", () => {
  it("das PDF landet als base64 beim Mieter, mit Objekt-Zuordnung aus dem Mieter", async () => {
    const { db, spuren, mod } = await lade({}, { brief: { titel: "Mahnung März", dateiname: "mahnung.pdf", pdf: PDF } });
    const r = await mod.speichereBrief("m1", {} as never);
    expect(r).toEqual({ ok: true });
    const e = archivEintrag(db)!;
    expect(e).toMatchObject({
      user_id: "nutzer-1", mieter_id: "m1", prop_id: "obj-1",
      kategorie: "Schreiben / Brief", titel: "Mahnung März", datei_name: "mahnung.pdf",
      datei_type: "application/pdf", datei_size: PDF.length, mieter_freigabe: false,
    });
    expect(String(e.datei_data)).toBe("data:application/pdf;base64," + Buffer.from(PDF).toString("base64"));
    expect(spuren.revalidiert).toContain("/tenants/m1");
  });

  it("die Mieter-Abfrage ist auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade();
    await mod.speichereBrief("m1", {} as never);
    const lese = db.zugriffe.find((z) => z.tabelle === "mieter" && z.op === "select")!;
    expect(lese.filter).toContain("eq:user_id=nutzer-1");
  });

  it("ein fremder oder unbekannter Mieter: nichts wird archiviert", async () => {
    const { db, mod } = await lade({ antworten: { mieter: null } });
    const r = await mod.speichereBrief("fremd", {} as never);
    expect(r).toEqual({ ok: false, error: "Mieter nicht gefunden." });
    expect(archivEintrag(db)).toBeUndefined();
  });

  it("scheitert die Mieter-Abfrage, wird NICHT ohne Objekt archiviert", async () => {
    // DER FUND. Vorher: prop_id null, Eintrag trotzdem angelegt, „gespeichert".
    const { db, mod } = await lade({ fehlerBei: { "mieter:select": { message: "connection reset" } } });
    const r = await mod.speichereBrief("m1", {} as never);
    expect(r.ok).toBe(false);
    expect(archivEintrag(db)).toBeUndefined();
  });

  it("ein Speicherfehler wird gemeldet", async () => {
    const { mod } = await lade({ fehlerBei: { "notizen:insert": { message: "boom" } } });
    expect(await mod.speichereBrief("m1", {} as never)).toEqual({ ok: false, error: "Speichern im Archiv fehlgeschlagen." });
  });
});

describe("Die drei Dokumentarten", () => {
  it("liefert der Erzeuger null, heißt das „Mieter nicht gefunden“ — für alle drei", async () => {
    const { db, mod } = await lade({}, { brief: null, nk: null, protokoll: null });
    expect(await mod.speichereBrief("m1", {} as never)).toEqual({ ok: false, error: "Mieter nicht gefunden." });
    expect(await mod.speichereNk("m1", 2025)).toEqual({ ok: false, error: "Mieter nicht gefunden." });
    expect(await mod.speichereProtokoll("m1", {} as never)).toEqual({ ok: false, error: "Mieter nicht gefunden." });
    expect(archivEintrag(db)).toBeUndefined();
  });

  it("wirft der Erzeuger, wird das gefangen — nicht als Absturz durchgereicht", async () => {
    const still = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, mod } = await lade({}, { nk: new Error("Schriftart fehlt") });
    const r = await mod.speichereNk("m1", 2025);
    expect(r).toEqual({ ok: false, error: "PDF konnte nicht erzeugt werden." });
    expect(archivEintrag(db)).toBeUndefined();
    still.mockRestore();
  });

  it("die NK-Abrechnung kann direkt ins Mieterportal zugestellt werden — nur wenn gewollt", async () => {
    const { db, mod } = await lade();
    await mod.speichereNk("m1", 2025, true);
    expect(archivEintrag(db)).toMatchObject({ kategorie: "Nebenkostenabrechnung", mieter_freigabe: true });
    const { db: db2, mod: mod2 } = await lade();
    await mod2.speichereNk("m1", 2025);
    expect(archivEintrag(db2)).toMatchObject({ mieter_freigabe: false });
  });

  it("Brief und Protokoll werden NIE automatisch freigegeben", async () => {
    // Ein Brief kann eine Abmahnung sein, ein Protokoll strittig — die
    // Freigabe ist eine eigene Entscheidung im Archiv.
    const { db, mod } = await lade();
    await mod.speichereProtokoll("m1", {} as never);
    expect(archivEintrag(db)).toMatchObject({ kategorie: "Übergabeprotokoll", mieter_freigabe: false });
  });

  it("ein unbrauchbares NK-Jahr fällt auf das Vorjahr zurück", async () => {
    const gesehen: number[] = [];
    vi.resetModules();
    const { client } = fakeSupabase({ antworten: { mieter: { prop_id: "obj-1" } } });
    mockeNextUndSupabase(client);
    vi.doMock("@/lib/pdf/erzeugen", () => ({
      erzeugeNkPdf: async (_s: unknown, _m: string, jahr: number) => {
        gesehen.push(jahr);
        return { titel: "NK", dateiname: "nk.pdf", pdf: PDF };
      },
      erzeugeBriefPdf: async () => null,
      erzeugeProtokollPdf: async () => null,
    }));
    const mod = await import("@/lib/actions/dokumente");
    await mod.speichereNk("m1", Number.NaN);
    await mod.speichereNk("m1", 2023);
    expect(gesehen).toEqual([new Date().getFullYear() - 1, 2023]);
  });
});
