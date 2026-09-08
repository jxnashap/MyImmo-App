import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";

// lib/actions/tenants.ts (Mieter-Stammdaten) und lib/actions/mietzeitraeume.ts
// (Mietperioden mit eigener Kaltmiete/NK).
//
// GEPRÜFT, KEIN FUND in tenants.ts (08.09.2026): `updateTenant` überschreibt
// jedes Feld aus `parse()` — der `notiz_import`-Fehler aus properties.ts wäre
// hier möglich, wenn das Formular ein Feld nicht mitschickt. TenantForm.tsx
// schickt alle 26 Felder, und die Bearbeiten-Seite füllt die IBAN
// ENTSCHLÜSSELT vor. Ein Speichern löscht also nichts stillschweigend.
// Nachgezogen wurde nur der `user_id`-Filter für Bearbeiten/Löschen.
//
// FUND in mietzeitraeume.ts: Die Mieter-Abfrage war fail-open und ohne
// Nutzerfilter — ein fremder Mieter bekam einen Zeitraum mit prop_id null.

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

const IBAN = "DE89370400440532013000";

describe("Mieter anlegen und bearbeiten", () => {
  it("die IBAN wird verschlüsselt abgelegt — nie im Klartext, auch nicht ohne Leerzeichen", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants");
    await fangeRedirect(() => mod.createTenant(fd({ nachname: "Meier", iban: "DE89 3704 0044 0532 0130 00" })));
    const d = zugriff(db, "mieter", "insert")!.daten!;
    expect(d.nachname).toBe("Meier");
    expect(d.user_id).toBe("nutzer-1");
    expect(String(d.iban)).not.toContain(IBAN);
    expect(String(d.iban)).not.toContain("0532013000");
  });

  it("ohne IBAN im Formular wird null gespeichert — kein Verschlüsseln eines Leerstrings", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants");
    await fangeRedirect(() => mod.createTenant(fd({ nachname: "Meier", iban: "  " })));
    expect(zugriff(db, "mieter", "insert")!.daten!.iban).toBeNull();
  });

  it("Zahlenfelder lesen Komma und Punkt, leere Felder werden null", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants");
    await fangeRedirect(() => mod.createTenant(fd({ nachname: "M", kaltmiete: "850,50", kaution: "2551.5", flaeche: "" })));
    expect(zugriff(db, "mieter", "insert")!.daten).toMatchObject({ kaltmiete: 850.5, kaution: 2551.5, flaeche: null });
  });

  it("nach dem Anlegen geht es dorthin zurück, wo der Nutzer herkam — aber nur auf eigene Pfade", async () => {
    const { mod } = await lade("@/lib/actions/tenants");
    const ziel = await fangeRedirect(() => mod.createTenant(fd({ nachname: "M", back: "/properties/obj-1" })));
    expect(ziel).toMatch(/^\/properties\/obj-1\?/);
    const { mod: mod2 } = await lade("@/lib/actions/tenants");
    const fremd = await fangeRedirect(() => mod2.createTenant(fd({ nachname: "M", back: "https://boese.example/phish" })));
    expect(fremd).toMatch(/^\/tenants\?/);
  });

  it("Bearbeiten und Löschen sind auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade("@/lib/actions/tenants");
    await fangeRedirect(() => mod.updateTenant("m1", fd({ nachname: "Neu" })));
    expect(zugriff(db, "mieter", "update")!.filter).toEqual(expect.arrayContaining(["eq:id=m1", "eq:user_id=nutzer-1"]));
    const { db: db2, mod: mod2 } = await lade("@/lib/actions/tenants");
    await fangeRedirect(() => mod2.deleteTenant("m1"));
    expect(zugriff(db2, "mieter", "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=m1", "eq:user_id=nutzer-1"]));
  });

  it("ein Datenbankfehler wird geworfen", async () => {
    const { mod } = await lade("@/lib/actions/tenants", { fehlerBei: { mieter: { message: "boom" } } });
    await expect(mod.createTenant(fd({ nachname: "M" }))).rejects.toThrow("boom");
  });
});

describe("Miet-Zeiträume", () => {
  const MIETER = { prop_id: "obj-1" };

  it("„von“ ist Pflicht und wird zum Monatsersten", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: MIETER } });
    expect(await mod.createMietZeitraum("m1", fd({ kaltmiete: "800" }))).toMatchObject({ ok: false, error: /von/ });
    expect(zugriff(db, "miet_zeitraeume", "insert")).toBeUndefined();
    await mod.createMietZeitraum("m1", fd({ von: "2026-03", bis: "2026-12", kaltmiete: "800" }));
    expect(zugriff(db, "miet_zeitraeume", "insert")!.daten).toMatchObject({
      von: "2026-03-01", bis: "2026-12-01", kaltmiete: 800, user_id: "nutzer-1", mieter_id: "m1", prop_id: "obj-1",
    });
  });

  it("„bis“ vor „von“ wird abgewiesen — auch beim Bearbeiten", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: MIETER } });
    expect((await mod.createMietZeitraum("m1", fd({ von: "2026-06", bis: "2026-03" }))).ok).toBe(false);
    expect((await mod.updateMietZeitraum("z1", "m1", fd({ von: "2026-06", bis: "2026-03" }))).ok).toBe(false);
    expect(db.zugriffe.filter((z) => z.tabelle === "miet_zeitraeume")).toEqual([]);
  });

  it("ein unbrauchbares Monatsformat wird null — bei „von“ also ein Fehler", async () => {
    const { mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: MIETER } });
    expect((await mod.createMietZeitraum("m1", fd({ von: "03/2026" }))).ok).toBe(false);
  });

  it("ein fremder oder unbekannter Mieter bekommt KEINEN Zeitraum", async () => {
    // DER FUND. Vorher: prop_id null, Zeitraum trotzdem angelegt.
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { antworten: { mieter: null } });
    expect(await mod.createMietZeitraum("fremd", fd({ von: "2026-03" }))).toEqual({ ok: false, error: "Mieter nicht gefunden." });
    expect(zugriff(db, "miet_zeitraeume", "insert")).toBeUndefined();
    expect(zugriff(db, "mieter", "select")!.filter).toContain("eq:user_id=nutzer-1");
  });

  it("scheitert die Mieter-Abfrage, wird ebenfalls nichts angelegt", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume", { fehlerBei: { "mieter:select": { message: "boom" } } });
    expect((await mod.createMietZeitraum("m1", fd({ von: "2026-03" }))).ok).toBe(false);
    expect(zugriff(db, "miet_zeitraeume", "insert")).toBeUndefined();
  });

  it("Bearbeiten und Löschen hängen am eigenen Konto", async () => {
    const { db, mod } = await lade("@/lib/actions/mietzeitraeume");
    await mod.updateMietZeitraum("z1", "m1", fd({ von: "2026-03" }));
    expect(zugriff(db, "miet_zeitraeume", "update")!.filter).toEqual(expect.arrayContaining(["eq:id=z1", "eq:user_id=nutzer-1"]));
    await mod.deleteMietZeitraum("z1", "m1");
    expect(zugriff(db, "miet_zeitraeume", "delete")!.filter).toEqual(expect.arrayContaining(["eq:id=z1", "eq:user_id=nutzer-1"]));
  });
});
