import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, jwtMitAmr } from "./stubs/actionHarness";
import { jwtPayload, juengsteAnmeldung, sitzungFrisch, mussMfaNachholen, FRISCH_SEKUNDEN } from "@/lib/auth/sitzung";

// ZWEI-FAKTOR-ANMELDUNG UND FRISCHE ANMELDUNG (08.09.2026, Feedback Befund 5 + 6).
//
// Drei Dinge werden hier festgenagelt:
//   1. Die reinen Helfer (lib/auth/sitzung.ts): Was heißt „frisch", was heißt
//      „zweiter Faktor fehlt". Fail-closed: ohne `amr` ist NICHTS frisch.
//   2. Die Wiederherstellungscodes (lib/actions/mfa.ts): nur Hashes in der
//      Tabelle, Einlösen atomar, danach Faktor weg — per Service-Role.
//   3. Die drei sensiblen Aktionen verlangen die Frische: Kontolöschung,
//      Bank-Freigabe, Vollexport.

const jetzt = Math.floor(Date.now() / 1000);

describe("lib/auth/sitzung — reine Helfer", () => {
  it("liest die Payload eines JWT, ohne die Signatur zu prüfen", () => {
    expect(jwtPayload(jwtMitAmr(0))?.sub).toBe("nutzer-1");
    expect(jwtPayload("kaputt")).toBeNull();
    expect(jwtPayload("a.!!!.c")).toBeNull();
    expect(jwtPayload(null)).toBeNull();
  });

  it("nimmt den JÜNGSTEN Zeitstempel aus amr — nicht den ersten", () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = `${b64({})}.${b64({ amr: [{ method: "password", timestamp: jetzt - 5000 }, { method: "totp", timestamp: jetzt - 10 }] })}.x`;
    expect(juengsteAnmeldung(token)).toBe(jetzt - 10);
  });

  it("frisch = jüngste Anmeldung liegt höchstens maxSekunden zurück", () => {
    expect(sitzungFrisch(jwtMitAmr(0), FRISCH_SEKUNDEN)).toBe(true);
    expect(sitzungFrisch(jwtMitAmr(FRISCH_SEKUNDEN - 5), FRISCH_SEKUNDEN)).toBe(true);
    expect(sitzungFrisch(jwtMitAmr(FRISCH_SEKUNDEN + 5), FRISCH_SEKUNDEN)).toBe(false);
  });

  it("FAIL-CLOSED: ohne amr, ohne Token oder mit Unsinn ist nichts frisch", () => {
    // Unbekannt = frisch wäre genau die Lücke, die geschlossen werden soll.
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    expect(sitzungFrisch(`${b64({})}.${b64({ sub: "x" })}.s`, 600)).toBe(false);
    expect(sitzungFrisch(`${b64({})}.${b64({ amr: [{ method: "password", timestamp: "gestern" }] })}.s`, 600)).toBe(false);
    expect(sitzungFrisch(null, 600)).toBe(false);
    expect(sitzungFrisch("", 600)).toBe(false);
  });

  it("mussMfaNachholen: nur wenn das Konto aal2 verlangt UND die Sitzung es nicht hat", () => {
    expect(mussMfaNachholen({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(mussMfaNachholen({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(mussMfaNachholen({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(mussMfaNachholen(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/billing/paddle"]) vi.doUnmock(m);
});

type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const zugriff = (db: Db, tabelle: string, op: string) => db.zugriffe.find((z) => z.tabelle === tabelle && z.op === op);

describe("pruefeFrischeAnmeldung (Server)", () => {
  async function pruefen(init: Parameters<typeof fakeSupabase>[0]) {
    vi.resetModules();
    const { client } = fakeSupabase(init);
    const { pruefeFrischeAnmeldung } = await import("@/lib/auth/frisch");
    return pruefeFrischeAnmeldung(client as never);
  }
  it("frisch und ohne 2FA-Pflicht → ok", async () => {
    expect(await pruefen({})).toEqual({ ok: true });
  });
  it("alt → reauth", async () => {
    expect(await pruefen({ amrVorSekunden: 3600 })).toEqual({ ok: false, grund: "reauth" });
  });
  it("2FA verlangt, aber nicht bestätigt → mfa — auch wenn das Passwort frisch ist", async () => {
    expect(await pruefen({ aal: { currentLevel: "aal1", nextLevel: "aal2" } })).toEqual({ ok: false, grund: "mfa" });
  });
});

describe("Wiederherstellungscodes", () => {
  let admin: { faktoren: { id: string }[]; geloescht: string[]; client: unknown };
  function adminAttrappe(faktoren: { id: string }[] = []) {
    const geloescht: string[] = [];
    const client = {
      auth: {
        admin: {
          mfa: {
            listFactors: async () => ({ data: { factors: faktoren }, error: null }),
            deleteFactor: async ({ id }: { id: string }) => { geloescht.push(id); return { error: null }; },
          },
        },
      },
    };
    admin = { faktoren, geloescht, client };
    return client;
  }
  async function lade(init: Parameters<typeof fakeSupabase>[0] = {}, faktoren: { id: string }[] = [{ id: "f1" }]) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client, adminAttrappe(faktoren));
    const mod = await import("@/lib/actions/mfa");
    return { db, mod };
  }

  it("erzeugt acht Codes im Format XXXX-XXXX ohne verwechselbare Zeichen — und speichert NUR Hashes", async () => {
    const { db, mod } = await lade();
    const r = await mod.erzeugeWiederherstellungscodes();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.codes).toHaveLength(8);
    for (const c of r.codes) expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(new Set(r.codes).size).toBe(8);
    const ins = zugriff(db, "mfa_wiederherstellung", "insert")!;
    const zeilen = ins.daten as unknown as { user_id: string; code_hash: string }[];
    expect(zeilen).toHaveLength(8);
    for (const z of zeilen) {
      expect(z.user_id).toBe("nutzer-1");
      expect(z.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.codes).not.toContain(z.code_hash);
    }
    // Alte Codes werden vorher entfernt — sonst gälten zwei Sätze.
    expect(zugriff(db, "mfa_wiederherstellung", "delete")!.filter).toContain("eq:user_id=nutzer-1");
  });

  it("verlangt eine frische Anmeldung", async () => {
    // Sonst könnte eine offene Sitzung neue Codes ziehen und damit später 2FA aushebeln.
    const { db, mod } = await lade({ amrVorSekunden: 3600 });
    const r = await mod.erzeugeWiederherstellungscodes();
    expect(r).toMatchObject({ ok: false, reauth: true });
    expect(db.zugriffe.filter((z) => z.tabelle === "mfa_wiederherstellung")).toEqual([]);
  });

  it("Einlösen: markiert ATOMAR über den Filter und entfernt dann alle Faktoren", async () => {
    const { db, mod } = await lade({ antworten: { mfa_wiederherstellung: { id: "c1" } } }, [{ id: "f1" }, { id: "f2" }]);
    const r = await mod.loeseWiederherstellungscodeEin("abcd-efgh");
    expect(r).toEqual({ ok: true });
    const upd = zugriff(db, "mfa_wiederherstellung", "update")!;
    expect(upd.daten).toHaveProperty("verbraucht_am");
    expect(upd.filter).toEqual(expect.arrayContaining(["eq:user_id=nutzer-1", "is:verbraucht_am=null"]));
    // Der Hash im Filter ist der des NORMALISIERTEN Codes (Groß, ohne Bindestrich).
    const { createHash } = await import("node:crypto");
    expect(upd.filter).toContain(`eq:code_hash=${createHash("sha256").update("ABCDEFGH").digest("hex")}`);
    expect(admin.geloescht).toEqual(["f1", "f2"]);
  });

  it("ein falscher oder verbrauchter Code entfernt KEINEN Faktor", async () => {
    // Das Update trifft keine Zeile (maybeSingle → null) — dieselbe Meldung für
    // beide Fälle, damit sich Codes nicht abtasten lassen.
    const { mod } = await lade({ antworten: { mfa_wiederherstellung: null } });
    const r = await mod.loeseWiederherstellungscodeEin("ABCD-EFGH");
    expect(r.ok).toBe(false);
    expect(admin.geloescht).toEqual([]);
  });

  it("ein Code mit falscher Länge erreicht die Datenbank nicht", async () => {
    const { db, mod } = await lade();
    expect((await mod.loeseWiederherstellungscodeEin("ABC")).ok).toBe(false);
    expect((await mod.loeseWiederherstellungscodeEin("")).ok).toBe(false);
    expect(db.zugriffe).toEqual([]);
  });

  it("ohne Service-Role kann nicht wiederhergestellt werden — der Code gilt dann trotzdem als verbraucht", async () => {
    // Bewusst so: Lieber ein verbrauchter Code als ein Code, der bei einem
    // späteren Versuch mit Service-Role doch noch zieht — dann wären es zwei.
    vi.resetModules();
    const { client } = fakeSupabase({ antworten: { mfa_wiederherstellung: { id: "c1" } } });
    mockeNextUndSupabase(client, null);
    const mod = await import("@/lib/actions/mfa");
    const r = await mod.loeseWiederherstellungscodeEin("ABCD-EFGH");
    expect(r.ok).toBe(false);
  });

  it("das Demo-Konto bekommt keine Codes", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase();
    (client.auth as { getUser: unknown }).getUser = async () => ({ data: { user: { id: "demo", email: "demo.vermieter@myimmo.test" } } });
    mockeNextUndSupabase(client, adminAttrappe());
    const mod = await import("@/lib/actions/mfa");
    const r = await mod.erzeugeWiederherstellungscodes();
    expect(r.ok).toBe(false);
    expect(db.zugriffe).toEqual([]);
  });
});

describe("Sensible Aktionen verlangen eine frische Anmeldung", () => {
  it("Kontolöschung: alte Sitzung → reauth, nichts gelöscht", async () => {
    vi.resetModules();
    vi.doMock("@/lib/billing/paddle", () => ({ paddleKonfiguriert: () => false, kuendigeSubscription: async () => false }));
    const { db, client } = fakeSupabase({ amrVorSekunden: 3600, antworten: { abos: null } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/account");
    const r = await mod.deleteAccount();
    expect(r).toMatchObject({ ok: false, reauth: true });
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:delete_own_account")).toBe(false);
  });

  it("Kontolöschung: 2FA-Konto ohne aal2 → reauth, auch mit frischem Passwort", async () => {
    vi.resetModules();
    vi.doMock("@/lib/billing/paddle", () => ({ paddleKonfiguriert: () => false, kuendigeSubscription: async () => false }));
    const { db, client } = fakeSupabase({ aal: { currentLevel: "aal1", nextLevel: "aal2" }, antworten: { abos: null } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/account");
    expect(await mod.deleteAccount()).toMatchObject({ ok: false, reauth: true });
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:delete_own_account")).toBe(false);
  });

  it("Bank-Freigabe: alte Sitzung → Fehler, kein Link", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({ amrVorSekunden: 3600 });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/beleihung");
    await expect(mod.createFreigabe("p1", ["grundbuch"], {}, 14)).rejects.toThrow(/frische Anmeldung/);
    expect(zugriff(db, "beleihung_freigaben", "insert")).toBeUndefined();
  });

  it("Vollexport: alte Sitzung → 403 mit Hinweis, nichts gelesen", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({ amrVorSekunden: 3600, antworten: { nutzer_rollen: null } });
    mockeNextUndSupabase(client);
    const mod = await import("@/app/api/export/alles/route");
    const r = await mod.GET();
    expect(r.status).toBe(403);
    expect(await r.text()).toMatch(/Anmeldung/);
    expect(db.zugriffe.filter((z) => z.op === "select" && z.tabelle !== "nutzer_rollen")).toEqual([]);
  });

  it("Vollexport: frische Sitzung → 200", async () => {
    vi.resetModules();
    const { client } = fakeSupabase({ antworten: { nutzer_rollen: null, notizen: [], kosten: [], ibans: [] } });
    mockeNextUndSupabase(client);
    const mod = await import("@/app/api/export/alles/route");
    expect((await mod.GET()).status).toBe(200);
  });
});
