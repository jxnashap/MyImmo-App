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
  // B01 (11.10.2026): Geprüft wird GENAU das Token, dessen aal/amr gelesen wird — getUser(token),
  // nicht ein paralleles getUser() aus dem Cookie, das ein anderes (erneuertes) Token sehen könnte.
  it("fragt den Auth-Server mit genau dem Token, das danach ausgewertet wird", async () => {
    vi.resetModules();
    const { client } = fakeSupabase({});
    const gesehen: unknown[] = [];
    const echt = client.auth.getUser;
    (client.auth as { getUser: unknown }).getUser = async (...args: unknown[]) => { gesehen.push(args[0]); return echt(); };
    const { data: { session } } = await client.auth.getSession();
    const { pruefeFrischeAnmeldung } = await import("@/lib/auth/frisch");
    expect(await pruefeFrischeAnmeldung(client as never)).toEqual({ ok: true });
    expect(gesehen).toEqual([session!.access_token]);
  });
  it("lehnt der Auth-Server das Token ab, ist nichts frisch", async () => {
    vi.resetModules();
    const { client } = fakeSupabase({});
    (client.auth as { getUser: unknown }).getUser = async () => ({ data: { user: null }, error: { message: "invalid JWT" } });
    const { pruefeFrischeAnmeldung } = await import("@/lib/auth/frisch");
    expect(await pruefeFrischeAnmeldung(client as never)).toEqual({ ok: false, grund: "reauth" });
  });
});

describe("Wiederherstellungscodes (B01, 11.10.2026: nur über die Service-Role, HMAC, Bremse, Rücknahme)", () => {
  const KEY = process.env.DATA_ENCRYPTION_KEY;
  beforeEach(() => { process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64"); });
  afterEach(() => { if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = KEY; });

  // Konto mit bestätigtem Faktor in einer aal2-Sitzung, frisch angemeldet — die Lage direkt nach dem
  // Einrichten oder nach „Anmeldung bestätigen“.
  const MIT_2FA = { aal: { currentLevel: "aal2", nextLevel: "aal2" } };

  type AdminInit = Parameters<typeof fakeSupabase>[0] & { faktoren?: { id: string }[]; loeschFehler?: boolean; listFehler?: boolean };
  async function lade(init: Parameters<typeof fakeSupabase>[0] = MIT_2FA, adminInit: AdminInit | null = {}) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    let adb: ReturnType<typeof fakeSupabase>["db"] | null = null;
    const geloescht: string[] = [];
    let admin: unknown = null;
    if (adminInit) {
      const a = fakeSupabase(adminInit);
      adb = a.db;
      admin = {
        ...a.client,
        auth: {
          ...a.client.auth,
          admin: {
            mfa: {
              listFactors: async () => (adminInit.listFehler
                ? { data: null, error: { message: "weg" } }
                : { data: { factors: adminInit.faktoren ?? [{ id: "f1" }] }, error: null }),
              deleteFactor: async ({ id }: { id: string }) => {
                if (adminInit.loeschFehler) return { error: { message: "kaputt" } };
                geloescht.push(id);
                return { error: null };
              },
            },
          },
        },
      };
    }
    mockeNextUndSupabase(client, admin);
    const mod = await import("@/lib/actions/mfa");
    return { db, adb: adb!, mod, geloescht };
  }
  const nurTabelle = (d: Db) => d.zugriffe.filter((z) => z.tabelle === "mfa_wiederherstellung");
  const erwarteterHash = async (code: string) => {
    const { blindIndex } = await import("@/lib/crypto/secure");
    return blindIndex("mfa-wiederherstellung-v2:" + code);
  };

  it("erzeugt acht Codes und speichert NUR HMAC-Hashes — über die Service-Role, nie über die Nutzer-Sitzung", async () => {
    const { db, adb, mod } = await lade();
    const r = await mod.erzeugeWiederherstellungscodes();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.codes).toHaveLength(8);
    for (const c of r.codes) expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(new Set(r.codes).size).toBe(8);
    expect(nurTabelle(db)).toEqual([]);
    const ins = zugriff(adb, "mfa_wiederherstellung", "insert")!;
    const zeilen = ins.daten as unknown as { user_id: string; code_hash: string }[];
    expect(zeilen).toHaveLength(8);
    for (const [i, z] of zeilen.entries()) {
      expect(z.user_id).toBe("nutzer-1");
      expect(z.code_hash).toBe(await erwarteterHash(r.codes[i].replace("-", "")));
    }
    // Ein bloßer SHA-256 (offline ratbar) wird NICHT mehr gespeichert.
    const { createHash } = await import("node:crypto");
    expect(zeilen.map((z) => z.code_hash)).not.toContain(createHash("sha256").update(r.codes[0].replace("-", "")).digest("hex"));
    // Alte Codes werden vorher entfernt — sonst gälten zwei Sätze.
    expect(zugriff(adb, "mfa_wiederherstellung", "delete")!.filter).toContain("eq:user_id=nutzer-1");
  });

  it("ohne bestätigten Faktor keine Codes (frische Passwort-Anmeldung allein reicht nicht)", async () => {
    const { adb, mod } = await lade({});
    const r = await mod.erzeugeWiederherstellungscodes();
    expect(r).toMatchObject({ ok: false });
    expect(nurTabelle(adb)).toEqual([]);
  });

  it("mit Faktor, aber nur aal1 (Passwort-Sitzung) → reauth, nichts geschrieben", async () => {
    const { adb, mod } = await lade({ aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    expect(await mod.erzeugeWiederherstellungscodes()).toMatchObject({ ok: false, reauth: true });
    expect(nurTabelle(adb)).toEqual([]);
  });

  it("aal2, aber alte Anmeldung → reauth, nichts geschrieben", async () => {
    const { adb, mod } = await lade({ ...MIT_2FA, amrVorSekunden: 3600 });
    expect(await mod.erzeugeWiederherstellungscodes()).toMatchObject({ ok: false, reauth: true });
    expect(nurTabelle(adb)).toEqual([]);
  });

  it("ohne Schlüssel (DATA_ENCRYPTION_KEY) keine Codes — kein Rückfall auf ungeschützte Hashes", async () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    const { adb, mod } = await lade();
    expect((await mod.erzeugeWiederherstellungscodes()).ok).toBe(false);
    expect(nurTabelle(adb)).toEqual([]);
  });

  it("Einlösen: atomar über die Service-Role (HMAC + alter SHA-256), dann Faktoren weg, übrige Codes ungültig", async () => {
    const { db, adb, mod, geloescht } = await lade(
      { aal: { currentLevel: "aal1", nextLevel: "aal2" } },
      { antwortFolge: { "mfa_wiederherstellung:update": [[{ id: "c1" }]] }, faktoren: [{ id: "f1" }, { id: "f2" }] },
    );
    const r = await mod.loeseWiederherstellungscodeEin("abcd-efgh");
    expect(r).toEqual({ ok: true });
    expect(nurTabelle(db)).toEqual([]);
    const upd = zugriff(adb, "mfa_wiederherstellung", "update")!;
    expect(upd.daten).toHaveProperty("verbraucht_am");
    expect(upd.filter).toEqual(expect.arrayContaining(["eq:user_id=nutzer-1", "is:verbraucht_am=null"]));
    const { createHash } = await import("node:crypto");
    const inFilter = upd.filter.find((f) => f.startsWith("in:code_hash="))!;
    expect(inFilter).toContain(await erwarteterHash("ABCDEFGH"));
    expect(inFilter).toContain(createHash("sha256").update("ABCDEFGH").digest("hex"));
    expect(geloescht).toEqual(["f1", "f2"]);
    // Nach dem Erfolg gilt kein weiterer Code des entfernten Faktors.
    expect(zugriff(adb, "mfa_wiederherstellung", "delete")!.filter).toContain("eq:user_id=nutzer-1");
    // Die Bremse wurde VOR dem Verbrauch gefragt, mit dem Konto als Kennung.
    const reihe = adb.zugriffe.map((z) => z.tabelle);
    expect(reihe.indexOf("rpc:rate_limit_pruefen")).toBeLessThan(reihe.indexOf("mfa_wiederherstellung"));
  });

  it("ein falscher oder verbrauchter Code entfernt KEINEN Faktor", async () => {
    const { mod, geloescht } = await lade({ aal: { currentLevel: "aal1", nextLevel: "aal2" } }, { antwortFolge: { "mfa_wiederherstellung:update": [[]] } });
    const r = await mod.loeseWiederherstellungscodeEin("ABCD-EFGH");
    expect(r.ok).toBe(false);
    expect(geloescht).toEqual([]);
  });

  it("zu viele Versuche: Die Bremse stoppt VOR jedem Zugriff auf die Codes", async () => {
    const { adb, mod, geloescht } = await lade(
      { aal: { currentLevel: "aal1", nextLevel: "aal2" } },
      { fehlerBei: { "rpc:rate_limit_pruefen": { message: "zu viele" } }, antwortFolge: { "mfa_wiederherstellung:update": [[{ id: "c1" }]] } },
    );
    const r = await mod.loeseWiederherstellungscodeEin("ABCD-EFGH");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Zu viele Versuche/) });
    expect(nurTabelle(adb)).toEqual([]);
    expect(geloescht).toEqual([]);
  });

  it("scheitert das Entfernen des Faktors, wird der Verbrauch zurückgenommen — der Code bleibt gültig", async () => {
    const { adb, mod } = await lade(
      { aal: { currentLevel: "aal1", nextLevel: "aal2" } },
      { antwortFolge: { "mfa_wiederherstellung:update": [[{ id: "c1" }], [{ id: "c1" }]] }, loeschFehler: true },
    );
    const r = await mod.loeseWiederherstellungscodeEin("ABCD-EFGH");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/bleibt gültig/) });
    const updates = adb.zugriffe.filter((z) => z.tabelle === "mfa_wiederherstellung" && z.op === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1].daten).toEqual({ verbraucht_am: null });
    expect(updates[1].filter).toEqual(expect.arrayContaining(["eq:user_id=nutzer-1", "in:id=c1"]));
    // Und KEIN Aufräumen der übrigen Codes — der Faktor ist ja noch da.
    expect(zugriff(adb, "mfa_wiederherstellung", "delete")).toBeUndefined();
  });

  it("Faktorliste nicht lesbar → ebenfalls Rücknahme", async () => {
    const { adb, mod } = await lade(
      { aal: { currentLevel: "aal1", nextLevel: "aal2" } },
      { antwortFolge: { "mfa_wiederherstellung:update": [[{ id: "c1" }], [{ id: "c1" }]] }, listFehler: true },
    );
    expect((await mod.loeseWiederherstellungscodeEin("ABCD-EFGH")).ok).toBe(false);
    expect(adb.zugriffe.filter((z) => z.op === "update")[1]?.daten).toEqual({ verbraucht_am: null });
  });

  it("ohne Faktor oder ohne Service-Role wird KEIN Code verbraucht", async () => {
    const ohneFaktor = await lade({}, { antwortFolge: { "mfa_wiederherstellung:update": [[{ id: "c1" }]] } });
    expect((await ohneFaktor.mod.loeseWiederherstellungscodeEin("ABCD-EFGH")).ok).toBe(false);
    expect(nurTabelle(ohneFaktor.adb)).toEqual([]);
    const ohneAdmin = await lade({ aal: { currentLevel: "aal1", nextLevel: "aal2" } }, null);
    expect((await ohneAdmin.mod.loeseWiederherstellungscodeEin("ABCD-EFGH")).ok).toBe(false);
    expect(nurTabelle(ohneAdmin.db)).toEqual([]);
  });

  it("ein Code mit falscher Länge erreicht die Datenbank nicht", async () => {
    const { db, adb, mod } = await lade();
    expect((await mod.loeseWiederherstellungscodeEin("ABC")).ok).toBe(false);
    expect((await mod.loeseWiederherstellungscodeEin("")).ok).toBe(false);
    expect(db.zugriffe).toEqual([]);
    expect(adb.zugriffe).toEqual([]);
  });

  it("Löschen (beim Abschalten): mit noch aktivem Faktor nur frisch + aal2; ohne Faktor über die Service-Role", async () => {
    const offen = await lade({ aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    expect((await offen.mod.loescheWiederherstellungscodes()).ok).toBe(false);
    expect(nurTabelle(offen.adb)).toEqual([]);
    const aus = await lade({});
    expect(await aus.mod.loescheWiederherstellungscodes()).toEqual({ ok: true });
    expect(zugriff(aus.adb, "mfa_wiederherstellung", "delete")!.filter).toContain("eq:user_id=nutzer-1");
    expect(nurTabelle(aus.db)).toEqual([]);
  });

  it("Zählen läuft über die Service-Role", async () => {
    const { db, adb, mod } = await lade(MIT_2FA, { zaehler: { mfa_wiederherstellung: 5 } });
    expect(await mod.zaehleWiederherstellungscodes()).toBe(5);
    expect(nurTabelle(db)).toEqual([]);
    expect(zugriff(adb, "mfa_wiederherstellung", "select")!.filter).toEqual(expect.arrayContaining(["eq:user_id=nutzer-1", "is:verbraucht_am=null"]));
  });

  it("das Demo-Konto bekommt keine Codes", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase(MIT_2FA);
    (client.auth as { getUser: unknown }).getUser = async () => ({ data: { user: { id: "demo", email: "demo.vermieter@myimmo.test", factors: [{ status: "verified" }] } } });
    mockeNextUndSupabase(client, client);
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
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:konto_loeschen" || z.tabelle === "rpc:delete_own_account")).toBe(false);
  });

  it("Kontolöschung: 2FA-Konto ohne aal2 → reauth, auch mit frischem Passwort", async () => {
    vi.resetModules();
    vi.doMock("@/lib/billing/paddle", () => ({ paddleKonfiguriert: () => false, kuendigeSubscription: async () => false }));
    const { db, client } = fakeSupabase({ aal: { currentLevel: "aal1", nextLevel: "aal2" }, antworten: { abos: null } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/account");
    expect(await mod.deleteAccount()).toMatchObject({ ok: false, reauth: true });
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:konto_loeschen" || z.tabelle === "rpc:delete_own_account")).toBe(false);
  });

  it("Bank-Freigabe: alte Sitzung → Fehler, kein Link", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({ amrVorSekunden: 3600 });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/beleihung");
    await expect(mod.createFreigabe("p1", ["grundbuch"], {}, 14, "b@bank.de")).rejects.toThrow(/frische Anmeldung/);
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

describe("aalStandAus — Faktorstatus vom Server, nie aus dem Cookie (Audit 01.10.2026, A2)", () => {
  const tokenMit = (aal?: string) => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({ alg: "none" })}.${b64(aal ? { sub: "u", aal } : { sub: "u" })}.sig`;
  };
  it("bestätigter Faktor + aal1-Token → nachholen; aal2-Token → nicht", async () => {
    const { aalStandAus, mussMfaNachholen } = await import("@/lib/auth/sitzung");
    const faktor = [{ status: "verified", factor_type: "totp" }];
    expect(mussMfaNachholen(aalStandAus(faktor, tokenMit("aal1")))).toBe(true);
    expect(mussMfaNachholen(aalStandAus(faktor, tokenMit("aal2")))).toBe(false);
    expect(mussMfaNachholen(aalStandAus([{ status: "unverified" }], tokenMit("aal1")))).toBe(false);
    expect(mussMfaNachholen(aalStandAus([], tokenMit("aal1")))).toBe(false);
  });
  it("FAIL-CLOSED: ohne aal-Claim gilt aal1 — ein Faktor-Konto muss dann nachholen", async () => {
    const { aalStandAus, mussMfaNachholen } = await import("@/lib/auth/sitzung");
    expect(mussMfaNachholen(aalStandAus([{ status: "verified" }], tokenMit()))).toBe(true);
    expect(mussMfaNachholen(aalStandAus([{ status: "verified" }], null))).toBe(true);
  });
  it("pruefeFrischeAnmeldung fragt den Server (getUser) — das Cookie sagt im Prüfstand das Gegenteil und wird ignoriert", async () => {
    vi.resetModules();
    const { fakeSupabase } = await import("./stubs/actionHarness");
    // Server: Faktor vorhanden, Token aal1 → mfa. (Cookie behauptet: kein Faktor.)
    const { client } = fakeSupabase({ aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    const { pruefeFrischeAnmeldung } = await import("@/lib/auth/frisch");
    expect(await pruefeFrischeAnmeldung(client as never)).toEqual({ ok: false, grund: "mfa" });
    // Server: kein Faktor (Cookie behauptet: einer) → ok.
    const { client: c2 } = fakeSupabase({});
    expect(await pruefeFrischeAnmeldung(c2 as never)).toEqual({ ok: true });
  });
});
