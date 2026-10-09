import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { pruefeZustellung } from "@/lib/mieterZugang";

// Zustellung an eine PERSON (02.10.2026, docs/zukunft/MIETERPORTAL-AUSBAU.md S1/S6/S9).
// Vorher zeigte `notizen.mieter_freigabe` ein Dokument jedem, der gerade an der
// Mieter-Zeile hing — ein Nachmieter in derselben Zeile bekam die Abrechnung des
// Vormieters. Jetzt geht jede Zustellung an ein bestimmtes Konto, und das Portal
// liest nur über diese Zustellungen. Was die Datenbank erzwingt (Herkunft, keine
// Rückdatierung, kein Dateitausch), wurde in einer zurückgerollten Transaktion als
// Vermieter, Mieter und Fremder bewiesen; hier stehen die Actions und die Anbindung.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

const lies = (p: string) => readFileSync(p, "utf8");

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/zustellung");
  return { db, spuren, mod };
}

const DOK = { id: "n1", mieter_id: "m1", titel: "Mietvertrag", datei_name: "mv.pdf" };
const LAUFEND = { mietbeginn: "2021-03-01", mietende: null };
const ANNA = { user_id: "konto-a", email: "anna@example.org" };

/** Antworten je Tabelle; `notizen` = das Dokument, `mieter` = Mietzeit. */
function lage(extra: Record<string, unknown> = {}) {
  return {
    antworten: { notizen: DOK, mieter: LAUFEND, mieter_zugaenge: [ANNA], zustellungen: [{ id: "z-neu" }], ...extra },
    // Erste zustellungen-Abfrage = „schon zugestellt?“ → nein.
    antwortFolge: { "zustellungen:select": [[]] },
  };
}

const einfuegen = (db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }) =>
  db.zugriffe.find((z) => z.tabelle === "zustellungen" && z.op === "insert");

describe("Dokument zustellen", () => {
  it("geht an das verknüpfte Konto — mit Konto-ID und Adresse als Schnappschuss", async () => {
    const { db, mod, spuren } = await lade(lage());
    expect(await mod.stelleDokumentZu("n1")).toEqual({ ok: true, an: ["anna@example.org"], hinweis: expect.stringMatching(/Mailversand ist nicht eingerichtet/) });
    const z = einfuegen(db)!;
    expect(z.daten).toEqual([
      expect.objectContaining({
        vermieter_id: "nutzer-1", zugestellt_von: "nutzer-1", notiz_id: "n1", mieter_id: "m1",
        empfaenger_user_id: "konto-a", empfaenger_email: "anna@example.org", art: "dokument", bestaetigung_noetig: false,
      }),
    ]);
    expect(spuren.revalidiert).toContain("/tenants/m1");
  });

  it("mit gewünschter Bestätigung wird sie mitgeschrieben", async () => {
    const { db, mod } = await lade(lage());
    await mod.stelleDokumentZu("n1", true);
    expect((einfuegen(db)!.daten as Record<string, unknown>[])[0].bestaetigung_noetig).toBe(true);
  });

  it("zwei verbundene Konten: jedes bekommt eine eigene Zustellung", async () => {
    const { db, mod } = await lade(lage({ mieter_zugaenge: [ANNA, { user_id: "konto-b", email: "ben@example.org" }], zustellungen: [{ id: "1" }, { id: "2" }] }));
    expect(await mod.stelleDokumentZu("n1")).toEqual({ ok: true, an: ["anna@example.org", "ben@example.org"], hinweis: expect.stringMatching(/Mailversand ist nicht eingerichtet/) });
    expect((einfuegen(db)!.daten as { empfaenger_user_id: string }[]).map((x) => x.empfaenger_user_id)).toEqual(["konto-a", "konto-b"]);
  });

  it("schon zugestellt: nur noch an Konten, die es nicht haben — sonst gesperrt", async () => {
    const { db, mod } = await lade({ ...lage(), antwortFolge: { "zustellungen:select": [[{ empfaenger_user_id: "konto-a" }]] } });
    expect(await mod.stelleDokumentZu("n1")).toEqual({ error: "Dieses Dokument ist bereits zugestellt." });
    expect(einfuegen(db)).toBeUndefined();
  });

  it("die Prüf-Abfragen filtern auf den eigenen Vermieter, das Dokument und aktive Zustellungen", async () => {
    const { db, mod } = await lade(lage());
    await mod.stelleDokumentZu("n1");
    const dok = db.zugriffe.find((z) => z.tabelle === "notizen")!;
    expect(dok.filter).toEqual(expect.arrayContaining(["eq:id=n1", "eq:user_id=nutzer-1"]));
    const zug = db.zugriffe.find((z) => z.tabelle === "mieter_zugaenge")!;
    expect(zug.filter).toEqual(expect.arrayContaining(["eq:mieter_id=m1", "eq:vermieter_id=nutzer-1"]));
    const schon = db.zugriffe.find((z) => z.tabelle === "zustellungen" && z.op === "select")!;
    expect(schon.filter).toEqual(expect.arrayContaining(["eq:notiz_id=n1", "is:zurueckgezogen_am=null", "eq:vermieter_id=nutzer-1"]));
  });

  it("ohne verbundenes Konto, ohne Mieter oder ohne Datei: nichts zugestellt", async () => {
    const a = await lade(lage({ mieter_zugaenge: [] }));
    expect((await a.mod.stelleDokumentZu("n1") as { error: string }).error).toContain("kein verbundenes Portal-Konto");
    expect(einfuegen(a.db)).toBeUndefined();
    const b = await lade(lage({ notizen: { ...DOK, mieter_id: null } }));
    expect((await b.mod.stelleDokumentZu("n1") as { error: string }).error).toContain("keinem Mieter zugeordnet");
    const c = await lade(lage({ notizen: { ...DOK, datei_name: null } }));
    expect((await c.mod.stelleDokumentZu("n1") as { error: string }).error).toContain("keine Datei");
    expect(einfuegen(b.db)).toBeUndefined();
    expect(einfuegen(c.db)).toBeUndefined();
  });

  it("Zugang abgelaufen (Auszug vor mehr als einem Kalenderjahr): gesperrt", async () => {
    const { db, mod } = await lade(lage({ mieter: { mietbeginn: "2015-01-01", mietende: "2020-06-30" } }));
    expect((await mod.stelleDokumentZu("n1") as { error: string }).error).toContain("abgelaufen");
    expect(einfuegen(db)).toBeUndefined();
  });

  it("Abfragefehler: fail-closed", async () => {
    for (const stelle of ["mieter_zugaenge:select", "zustellungen:select", "mieter:select"]) {
      const { db, mod } = await lade({ ...lage(), fehlerBei: { [stelle]: { message: "x" } } });
      expect((await mod.stelleDokumentZu("n1") as { error: string }).error, stelle).toContain("nicht geprüft");
      expect(einfuegen(db), stelle).toBeUndefined();
    }
  });

  it("kommen weniger Zeilen zurück als eingefügt, gilt das nicht als zugestellt", async () => {
    const { mod } = await lade(lage({ mieter_zugaenge: [ANNA, { user_id: "konto-b", email: "ben@example.org" }], zustellungen: [{ id: "1" }] }));
    expect((await mod.stelleDokumentZu("n1") as { error: string }).error).toContain("NICHT sichtbar");
  });

  it("Einfügen scheitert (z. B. Regel der Datenbank): ehrlich „NICHT sichtbar“", async () => {
    const { mod } = await lade({ ...lage(), fehlerBei: { "zustellungen:insert": { message: "rls" } } });
    expect((await mod.stelleDokumentZu("n1") as { error: string }).error).toContain("NICHT sichtbar");
  });
});

describe("Zurückziehen und Bestätigen", () => {
  it("Zurückziehen läuft über die Funktion der Datenbank und meldet nur bei true Erfolg", async () => {
    const ok = await lade({ rpc: { zustellung_zurueckziehen: true } });
    expect(await ok.mod.zieheZustellungZurueck("z1", "m1")).toEqual({ ok: true });
    expect(ok.db.zugriffe.map((z) => z.tabelle)).toEqual(["rpc:zustellung_zurueckziehen"]);
    const nein = await lade({ rpc: { zustellung_zurueckziehen: false } });
    expect(await nein.mod.zieheZustellungZurueck("fremd")).toHaveProperty("error");
  });

  it("Bestätigen ebenso — false (nicht verlangt, fremd, schon bestätigt) ist kein Erfolg", async () => {
    const ok = await lade({ rpc: { zustellung_bestaetigen: true } });
    expect(await ok.mod.bestaetigeZustellung("z1")).toEqual({ ok: true });
    const nein = await lade({ rpc: { zustellung_bestaetigen: false } });
    expect(await nein.mod.bestaetigeZustellung("z1")).toHaveProperty("error");
  });
});

describe("Prüfung ohne Jahresbezug", () => {
  const basis = { verbunden: true, email: "a@b.de", mietbeginn: "2026-02-01", mietende: null, schonZugestellt: false, heute: "2026-10-02" };
  it("ein Dokument ohne Jahr kennt keine Mietzeit-Sperre", () => {
    expect(pruefeZustellung({ ...basis, jahr: null }).sperre).toBeNull();
    expect(pruefeZustellung({ ...basis, jahr: 2025 }).sperre).toContain("beginnt erst nach 2025");
    // Ex-Mieter im Nachlauf: ein Dokument ohne Jahr darf noch zu ihm.
    expect(pruefeZustellung({ ...basis, mietbeginn: "2020-01-01", mietende: "2025-12-31", jahr: null }).sperre).toBeNull();
  });
});

describe("Archiv: ein zugestelltes Dokument bleibt", () => {
  async function ladeArchiv(init: Parameters<typeof fakeSupabase>[0]) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    return { db, mod: await import("@/lib/actions/archiv") };
  }
  it("Löschen bei aktiver Zustellung: abgelehnt, nichts gelöscht", async () => {
    const { db, mod } = await ladeArchiv({ antworten: { zustellungen: [{ id: "z1" }] } });
    await expect(mod.deleteDokument("n1")).rejects.toThrow(/zurückziehen/);
    expect(db.zugriffe.some((z) => z.op === "delete")).toBe(false);
    const schon = db.zugriffe.find((z) => z.tabelle === "zustellungen")!;
    expect(schon.filter).toEqual(expect.arrayContaining(["eq:notiz_id=n1", "is:zurueckgezogen_am=null"]));
  });
  it("Prüffehler: nicht löschen", async () => {
    const { db, mod } = await ladeArchiv({ fehlerBei: { "zustellungen:select": { message: "x" } } });
    await expect(mod.deleteDokument("n1")).rejects.toThrow();
    expect(db.zugriffe.some((z) => z.op === "delete")).toBe(false);
  });
  it("ohne Zustellung wird gelöscht", async () => {
    const { db, mod } = await ladeArchiv({ antworten: { zustellungen: [] } });
    await mod.deleteDokument("n1");
    expect(db.zugriffe.some((z) => z.tabelle === "notizen" && z.op === "delete")).toBe(true);
  });
});

describe("Anbindung", () => {
  it("die Datei-Route hält den ersten Abruf fest — außer in der Demo", () => {
    const r = lies("app/(app)/archiv/[id]/datei/route.ts");
    expect(r).toContain(`rpc("zustellung_abgerufen", { p_notiz: params.id })`);
    expect(r).toMatch(/if \(!istDemoKonto\(user\.email\)\)/);
  });
  it("niemand liest mehr `mieter_freigabe` als Entscheidung über Archiv-Dokumente", () => {
    for (const p of ["lib/portalDaten.ts", "app/(app)/tenants/[id]/nk/page.tsx", "app/(app)/tenants/[id]/page.tsx", "lib/zustellung.ts"]) {
      const notizenTeil = lies(p).split("\n").filter((z) => !z.trim().startsWith("//") && !z.trim().startsWith("*"));
      // Belege (kosten) dürfen den Schalter weiter benutzen — Dokumente nicht.
      const treffer = notizenTeil.filter((z) => z.includes("mieter_freigabe") && !z.includes("kosten"));
      if (p === "lib/portalDaten.ts") expect(treffer.length, p).toBe(1); // die Belege-Abfrage
      else expect(treffer, p).toEqual([]);
    }
  });
  it("die Migration enthält kein Schlüsselwort, das den Bestätigungsdialog auslöst", () => {
    for (const f of ["20261002140000_zustellungen.sql", "20261002141000_zustellungen_ohne_rekursion.sql"]) {
      expect(lies(`supabase/migrations/${f}`)).not.toMatch(/\b(delete|drop)\b/i);
    }
  });
  it("die Mieter-Regel auf `notizen` hängt an der Zustellung, mit Herkunftsprüfung", () => {
    const sql = lies("supabase/migrations/20261002140000_zustellungen.sql");
    expect(sql).toMatch(/alter policy notizen_select_mieter_freigabe[\s\S]*z\.vermieter_id = notizen\.user_id[\s\S]*z\.zurueckgezogen_am is null/);
    expect(sql).toContain("zugestellt_am between now() - interval '5 minutes' and now() + interval '5 minutes'");
  });
});
