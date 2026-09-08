import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// FÜNFTER DURCHGANG: die API-Routen (08.09.2026). Dieselben vier Klassen wie in
// lib/actions/ — stille Schreibfehler, fail-open-Abfragen, Zahlen, Dateiköpfe —
// plus die Frage, die es dort nicht gab: Wer darf die Route überhaupt aufrufen?
//
// Hier: der Paddle-Webhook und die beiden Cron-Routen. Alle drei schreiben mit
// der SERVICE-ROLE (RLS-Bypass) — ein Fehler hier trifft nicht ein Konto,
// sondern alle.
//
// FUNDE
//   · Webhook: Der Reihenfolge-Schutz las den Stand fail-open. Bei einem
//     Abfragefehler gälte JEDES Event als „neuer" — ein verspätetes "updated"
//     überschriebe ein späteres "canceled": Der Kunde behielte bezahlte
//     Funktionen nach der Kündigung (oder verlöre sie trotz Zahlung).
//   · wert-refresh: DREI Schreibvorgänge ohne Fehlerauswertung. Der Lauf
//     zählte „aktualisiert", während der Wert nirgends stand — und schrieb die
//     Historie mit einem Wert fort, den das Objekt nicht hat.
//   · wert-refresh: `?secret=` in der URL akzeptiert → das Geheimnis landet in
//     Vercel-Logs. Entfernt; die GitHub-Action nutzt ohnehin den Header.
//   · cron/bewertung: `if (secret)` — OHNE gesetztes CRON_SECRET war die Route
//     für jeden erreichbar. Heute ein Gerüst ohne Schreibvorgänge, aber der
//     Zustand wäre beim Ausbau stillschweigend mitgewandert.

const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
  for (const m of [
    "next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin",
    "@/lib/billing/paddle", "@/lib/wert/hpi", "@/lib/wert/fortschreibung", "@/lib/wert/protokoll",
    "@/lib/valuation/sources/geocode", "@/lib/valuation/sources/boris",
  ]) vi.doUnmock(m);
});

type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const zugriff = (db: Db, tabelle: string, op: string) => db.zugriffe.find((z) => z.tabelle === tabelle && z.op === op);

describe("Paddle-Webhook", () => {
  const UPDATE = { user_id: "kunde-1", plan: "plus", status: "gekuendigt", letztes_event_am: "2026-09-08T10:00:00Z" };

  async function lade(init: Parameters<typeof fakeSupabase>[0] = {}, paddle: { signaturOk?: boolean; update?: unknown } = {}) {
    vi.resetModules();
    process.env.PADDLE_WEBHOOK_SECRET = "geheim";
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    vi.doMock("@/lib/billing/paddle", () => ({
      verifyPaddleSignature: () => paddle.signaturOk ?? true,
      parsePaddleEvent: () => (paddle.update === undefined ? UPDATE : paddle.update),
    }));
    const mod = await import("@/app/api/billing/webhook/route");
    return { db, mod };
  }
  const post = (body = "{}", headers: Record<string, string> = {}) =>
    new Request("https://www.myimmoapp.de/api/billing/webhook", { method: "POST", body, headers: { "paddle-signature": "ts=1;h1=x", ...headers } });

  it("ohne Secret ist die Route ein No-op (503) — vor dem Lesen des Bodys", async () => {
    const { db, mod } = await lade();
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const r = await mod.POST(post() as never);
    expect(r.status).toBe(503);
    expect(db.zugriffe).toEqual([]);
  });

  it("zu große Bodies werden VOR der Signaturprüfung abgewiesen", async () => {
    const { db, mod } = await lade();
    const r = await mod.POST(post("x".repeat(64 * 1024 + 1)) as never);
    expect(r.status).toBe(413);
    expect(db.zugriffe).toEqual([]);
  });

  it("eine ungültige Signatur endet mit 401 — nichts wird geschrieben", async () => {
    const { db, mod } = await lade({}, { signaturOk: false });
    expect((await mod.POST(post() as never)).status).toBe(401);
    expect(db.zugriffe).toEqual([]);
  });

  it("irrelevante Events werden mit 200 quittiert, sonst wiederholt Paddle endlos", async () => {
    const { db, mod } = await lade({}, { update: null });
    const r = await mod.POST(post() as never);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ignoriert: true });
    expect(db.zugriffe).toEqual([]);
  });

  it("ein neueres Event wird angewendet — per Upsert auf user_id", async () => {
    const { db, mod } = await lade({ antworten: { abos: { letztes_event_am: "2026-09-01T00:00:00Z" } } });
    const r = await mod.POST(post() as never);
    expect(await r.json()).toEqual({ ok: true });
    expect(zugriff(db, "abos", "upsert")!.daten).toMatchObject(UPDATE);
  });

  it("ein älteres Event wird verworfen", async () => {
    const { db, mod } = await lade({ antworten: { abos: { letztes_event_am: "2026-09-09T00:00:00Z" } } });
    const r = await mod.POST(post() as never);
    expect(await r.json()).toEqual({ veraltet: true });
    expect(zugriff(db, "abos", "upsert")).toBeUndefined();
  });

  it("scheitert das Lesen des Standes, wird NICHT geschrieben — 500, damit Paddle wiederholt", async () => {
    // DER FUND. Vorher: leer = „kein Stand" → ein verspätetes Event überschrieb
    // ein neueres.
    const { db, mod } = await lade({ fehlerBei: { "abos:select": { message: "connection reset" } } });
    const r = await mod.POST(post() as never);
    expect(r.status).toBe(500);
    expect(zugriff(db, "abos", "upsert")).toBeUndefined();
  });

  it("ein Schreibfehler verrät keine Datenbank-Interna", async () => {
    const { mod } = await lade({ fehlerBei: { "abos:upsert": { message: 'relation "abos" violates check constraint' } } });
    const r = await mod.POST(post() as never);
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("relation");
  });
});

describe("Cron: Wert-Refresh", () => {
  const OBJEKT = { id: "obj-1", user_id: "nutzer-1", kaufpreis: 200000, kaufdatum: "2020-01-01", marktwert_aktuell: 200000, adresse: null, latitude: 1, longitude: 2, bodenrichtwert: null };
  let protokolliert: unknown[] = [];

  async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
    vi.resetModules();
    protokolliert = [];
    process.env.CRON_SECRET = "cron-geheim";
    const { db, client } = fakeSupabase({ antworten: { properties: [OBJEKT] }, ...init });
    mockeNextUndSupabase(client);
    vi.doMock("@/lib/wert/hpi", () => ({ holeIndexReihe: async () => ({ reihe: [], live: false }) }));
    vi.doMock("@/lib/wert/fortschreibung", () => ({ fortschreibeKaufpreis: () => ({ wert: 250000 }) }));
    vi.doMock("@/lib/wert/protokoll", () => ({ protokolliereWert: async (...a: unknown[]) => { protokolliert.push(a); } }));
    vi.doMock("@/lib/valuation/sources/geocode", () => ({ geocode: async () => null }));
    vi.doMock("@/lib/valuation/sources/boris", () => ({ bodenrichtwertAbrufen: async () => null }));
    const mod = await import("@/app/api/cron/wert-refresh/route");
    return { db, mod };
  }
  const get = (url = "https://www.myimmoapp.de/api/cron/wert-refresh", headers: Record<string, string> = {}) =>
    new Request(url, { headers });

  it("ohne CRON_SECRET ist die Route aus (503), nicht offen", async () => {
    const { db, mod } = await lade();
    delete process.env.CRON_SECRET;
    expect((await mod.GET(get())).status).toBe(503);
    expect(db.zugriffe).toEqual([]);
  });

  it("nur der Bearer-Header zählt — `?secret=` in der URL nicht mehr", async () => {
    // Ein Geheimnis in der URL steht in Vercel-Logs und Browserverläufen.
    const { db, mod } = await lade();
    expect((await mod.GET(get("https://www.myimmoapp.de/api/cron/wert-refresh?secret=cron-geheim"))).status).toBe(401);
    expect((await mod.GET(get(undefined, { authorization: "Bearer falsch" }))).status).toBe(401);
    expect(db.zugriffe).toEqual([]);
    expect((await mod.GET(get(undefined, { authorization: "Bearer cron-geheim" }))).status).toBe(200);
  });

  it("ein geänderter Wert wird geschrieben UND protokolliert — auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade();
    const r = await mod.GET(get(undefined, { authorization: "Bearer cron-geheim" }));
    const j = await r.json();
    expect(j).toMatchObject({ ok: true, aktualisiert: 1, fehlgeschlagen: 0 });
    const u = zugriff(db, "properties", "update")!;
    expect(u.daten).toMatchObject({ marktwert_aktuell: 250000 });
    expect(u.filter).toEqual(expect.arrayContaining(["eq:id=obj-1", "eq:user_id=nutzer-1"]));
    expect(protokolliert).toHaveLength(1);
  });

  it("scheitert das Schreiben, wird NICHT protokolliert, und der Lauf meldet ok: false", async () => {
    // DER FUND. Vorher: aktualisiert++ und Historie fortgeschrieben, obwohl der
    // Wert nirgends stand.
    const { mod } = await lade({ fehlerBei: { "properties:update": { message: "boom" } } });
    const r = await mod.GET(get(undefined, { authorization: "Bearer cron-geheim" }));
    const j = await r.json();
    expect(j).toMatchObject({ ok: false, aktualisiert: 0, fehlgeschlagen: 1 });
    expect(protokolliert).toEqual([]);
  });

  it("ein unveränderter Wert erzeugt keinen Schreibvorgang", async () => {
    const { db, mod } = await lade({ antworten: { properties: [{ ...OBJEKT, marktwert_aktuell: 250000 }] } });
    const j = await (await mod.GET(get(undefined, { authorization: "Bearer cron-geheim" }))).json();
    expect(j).toMatchObject({ unveraendert: 1, aktualisiert: 0 });
    expect(zugriff(db, "properties", "update")).toBeUndefined();
  });

  it("mit OWNER_USER_ID läuft nur dieses Konto", async () => {
    process.env.OWNER_USER_ID = "nur-ich";
    const { db, mod } = await lade();
    process.env.OWNER_USER_ID = "nur-ich";
    const j = await (await mod.GET(get(undefined, { authorization: "Bearer cron-geheim" }))).json();
    expect(j.scope).toBe("owner");
    expect(zugriff(db, "properties", "select")!.filter).toContain("eq:user_id=nur-ich");
  });
});

describe("Cron: Bewertung (Gerüst)", () => {
  async function lade() {
    vi.resetModules();
    const mod = await import("@/app/api/cron/bewertung/route");
    return mod;
  }

  it("ohne CRON_SECRET: 503 statt offen", async () => {
    // DER FUND: `if (secret)` ließ die Route ohne Env für jeden durch.
    delete process.env.CRON_SECRET;
    const mod = await lade();
    expect((await mod.GET(new Request("https://x/api/cron/bewertung"))).status).toBe(503);
  });

  it("mit Secret: falscher Header 401, richtiger 200", async () => {
    process.env.CRON_SECRET = "s";
    const mod = await lade();
    expect((await mod.GET(new Request("https://x/api/cron/bewertung"))).status).toBe(401);
    expect((await mod.GET(new Request("https://x/api/cron/bewertung", { headers: { authorization: "Bearer s" } }))).status).toBe(200);
  });
});
