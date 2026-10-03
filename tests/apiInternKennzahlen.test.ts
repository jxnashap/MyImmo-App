import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { geheimnisGleich } from "@/lib/net/geheimnis";

// `/api/intern/kennzahlen` — die fünf Zahlen für den n8n-Wochenbericht
// (docs/zukunft/AI-AGENCY-OS.md 4.3). Die Route läuft mit der SERVICE-ROLE
// (RLS-Bypass) und liest die Konten-Liste: derselbe Risikoschnitt wie bei den
// Cron-Routen, deshalb dasselbe Prüfmuster.
//
// FUND BEIM ZUSAMMENFÜHREN (30.09.2026): Die Route hatte das ALTE Auth-Muster
// der Cron-Route kopiert — inklusive `?secret=` in der Query. Genau das wurde
// am 08.09.2026 aus `cron/wert-refresh` entfernt, weil das Geheimnis dadurch
// in den Vercel-Zugriffslogs im Klartext steht. Der Test „Query-Parameter
// genügt NICHT" ist der Wächter dagegen: baut man die Zeile wieder ein, wird
// er rot (geprüft).
//
// Zweitens: Der Vergleich lief mit `!==` statt in konstanter Zeit. Der Helfer
// liegt jetzt einmal in `lib/net/geheimnis.ts` statt als Kopie in einer Route.

const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
  for (const m of [
    "next/cache", "next/navigation", "next/headers",
    "@/lib/supabase/server", "@/lib/supabase/admin",
  ]) vi.doUnmock(m);
});

type Konto = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null };

const KONTEN: Konto[] = [
  // extern, 6 Objekte, kam an einem zweiten Tag wieder
  { id: "v1", email: "eins@gmail.com", created_at: "2026-08-01T09:00:00Z", last_sign_in_at: "2026-08-20T09:00:00Z" },
  // extern, 1 Objekt, nur am Anmeldetag da
  { id: "v2", email: "zwei@web.de", created_at: "2026-09-28T09:00:00Z", last_sign_in_at: "2026-09-28T10:00:00Z" },
  // extern, kein Objekt, nie eingeloggt
  { id: "v3", email: "drei@gmx.de", created_at: "2026-09-27T09:00:00Z", last_sign_in_at: null },
  // Rollen-Konto (Mieter) → kein Kunde
  { id: "m1", email: "mieter@gmail.com", created_at: "2026-07-01T09:00:00Z", last_sign_in_at: "2026-07-09T09:00:00Z" },
  // Demo-Konto → kein Kunde
  { id: "d1", email: "demo.vermieter@myimmo.test", created_at: "2026-07-01T09:00:00Z", last_sign_in_at: "2026-09-29T09:00:00Z" },
];

async function lade(opt: { secret?: string | null; konten?: Konto[]; ausschluss?: string } = {}) {
  vi.resetModules();
  if (opt.secret === null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = opt.secret ?? "geheim";
  if (opt.ausschluss !== undefined) process.env.INTERN_AUSSCHLUSS = opt.ausschluss;

  const { db, client } = fakeSupabase({
    antworten: {
      properties: [{ user_id: "v1" }, { user_id: "v1" }, { user_id: "v2" }, { user_id: "d1" }],
      mieter: [{ user_id: "v1" }, { user_id: "v2" }],
      einnahmen: [{ user_id: "v1" }, { user_id: "v1" }, { user_id: "v1" }, { user_id: "v2" }],
      kosten: [{ user_id: "v1" }],
      nutzer_rollen: [{ user_id: "m1" }],
      abos: [{ status: "aktiv" }, { status: "gekuendigt" }],
    },
  });
  const admin = {
    ...client,
    auth: {
      ...client.auth,
      admin: { listUsers: async () => ({ data: { users: opt.konten ?? KONTEN }, error: null }) },
    },
  };
  mockeNextUndSupabase(client, admin);
  const mod = await import("@/app/api/intern/kennzahlen/route");
  return { db, mod };
}

const anfrage = (headers: Record<string, string> = {}, url = "https://www.myimmoapp.de/api/intern/kennzahlen") =>
  new Request(url, { headers });

describe("/api/intern/kennzahlen — Zugang", () => {
  it("ohne gesetztes CRON_SECRET: 503, nicht offen", async () => {
    const { mod } = await lade({ secret: null });
    const res = await mod.GET(anfrage({ authorization: "Bearer irgendwas" }));
    expect(res.status).toBe(503);
  });

  it("ohne Kopf: 401", async () => {
    const { mod } = await lade();
    expect((await mod.GET(anfrage())).status).toBe(401);
  });

  it("falsches Geheimnis: 401", async () => {
    const { mod } = await lade();
    expect((await mod.GET(anfrage({ authorization: "Bearer falsch" }))).status).toBe(401);
  });

  it("Query-Parameter genügt NICHT — das Geheimnis gehört nicht in die URL", async () => {
    const { mod } = await lade();
    const res = await mod.GET(anfrage({}, "https://www.myimmoapp.de/api/intern/kennzahlen?secret=geheim"));
    expect(res.status).toBe(401);
  });

  it("richtiger Bearer-Kopf: 200", async () => {
    const { mod } = await lade();
    expect((await mod.GET(anfrage({ authorization: "Bearer geheim" }))).status).toBe(200);
  });

  it("POST prüft genauso", async () => {
    const { mod } = await lade();
    expect((await mod.POST(anfrage())).status).toBe(401);
    expect((await mod.POST(anfrage({ authorization: "Bearer geheim" }))).status).toBe(200);
  });
});

describe("/api/intern/kennzahlen — Zahlen", () => {
  it("zählt nur externe Vermieter-Konten und nennt die Aussortierten", async () => {
    const { mod } = await lade();
    const j = await (await mod.GET(anfrage({ authorization: "Bearer geheim" }))).json();
    expect(j.externeKonten).toBe(3);
    expect(j.ausgeschlossen).toEqual({ rollen: 1, eigeneUndTest: 1 });
    expect(j.mitObjekt).toBe(2);
    expect(j.rueckkehrer).toBe(1);
  });

  it("zählt nur zahlende Abo-Status", async () => {
    const { mod } = await lade();
    const j = await (await mod.GET(anfrage({ authorization: "Bearer geheim" }))).json();
    expect(j.zahlendeKunden).toBe(1); // aktiv ja, gekuendigt nein
  });

  it("liefert die Trichterstufen mit — Mieter und Buchungen", async () => {
    const { mod } = await lade();
    const j = await (await mod.GET(anfrage({ authorization: "Bearer geheim" }))).json();
    expect(j.mitMieter).toBe(2);
    // v1 hat 3 Einnahmen + 1 Kosten = 4 Buchungen (> 2), v2 nur eine.
    expect(j.mitBuchungen).toBe(1);
    expect(j.neueKonten30t).toBeGreaterThanOrEqual(j.neueKonten7t);
  });

  it("besucher7t bleibt null — nicht gemessen ist nicht null Besucher", async () => {
    const { mod } = await lade();
    const j = await (await mod.GET(anfrage({ authorization: "Bearer geheim" }))).json();
    expect(j.besucher7t).toBeNull();
  });

  it("INTERN_AUSSCHLUSS sortiert weitere eigene Konten aus", async () => {
    const { mod } = await lade({ ausschluss: "@web.de" });
    const j = await (await mod.GET(anfrage({ authorization: "Bearer geheim" }))).json();
    expect(j.externeKonten).toBe(2);
    expect(j.ausgeschlossen.eigeneUndTest).toBe(2);
  });

  it("gibt keine E-Mail-Adresse und keine Konto-ID heraus", async () => {
    const { mod } = await lade();
    const roh = await (await mod.GET(anfrage({ authorization: "Bearer geheim" }))).text();
    for (const heikel of ["eins@gmail.com", "mieter@gmail.com", "v1", "m1"]) {
      expect(roh).not.toContain(heikel);
    }
  });
});

describe("geheimnisGleich", () => {
  it("vergleicht Inhalt und Länge", () => {
    expect(geheimnisGleich("abc", "abc")).toBe(true);
    expect(geheimnisGleich("abc", "abd")).toBe(false);
    expect(geheimnisGleich("abc", "abcd")).toBe(false);
    expect(geheimnisGleich("", "")).toBe(true);
    expect(geheimnisGleich("", "x")).toBe(false);
  });
});
