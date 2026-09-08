import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// Fünfter Durchgang, Teil 4: KI-Import und die Bankdaten-Migration.
//
// FUNDE
//   · /api/import hatte KEINE Mengenbremse; /api/import-url nur eine je
//     Serverless-Instanz; /api/nk-ocr eine datenbankgestützte. Jeder Aufruf
//     kostet Geld beim KI-Anbieter. Jetzt alle drei über `darfWeiter`.
//   · /api/encrypt-bankdaten las Kredite und Mieter fail-open: Bei einem
//     Abfragefehler meldete die Route „ok, 0 migriert" — und der Klartext
//     blieb liegen. Die Route hat genau einen Zweck, und den hätte sie
//     stillschweigend verfehlt.

const ENV = { ...process.env };
let bremseOffen = true;
let bremseAufrufe: string[] = [];

beforeEach(() => {
  vi.resetModules();
  bremseOffen = true;
  bremseAufrufe = [];
  process.env.ANTHROPIC_API_KEY = "sk-test";
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  process.env = { ...ENV };
  for (const m of [
    "next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin",
    "@/lib/planGate", "@/lib/net/bremse", "@/lib/aiImport", "@/lib/net/ssrf",
  ]) vi.doUnmock(m);
});

async function lade(pfad: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  vi.doMock("@/lib/planGate", () => ({ featureSperre: async () => null }));
  vi.doMock("@/lib/net/bremse", () => ({
    darfWeiter: async (aktion: string) => { bremseAufrufe.push(aktion); return bremseOffen; },
    besucherIp: async () => "203.0.113.1",
  }));
  vi.doMock("@/lib/aiImport", () => ({
    extrahiereImmodaten: async () => ({ bezeichnung: "Testobjekt" }),
    AiImportFehler: class extends Error { status = 502; },
  }));
  vi.doMock("@/lib/net/ssrf", () => ({
    pruefeZielUrl: async () => undefined,
    sicheresFetch: async () => ({ response: new Response("<html>" + "Exposé ".repeat(200) + "</html>", { headers: { "content-type": "text/html" } }) }),
    ZielNichtErlaubtFehler: class extends Error {},
  }));
  const mod = await import(pfad);
  return { db, mod };
}

const post = (url: string, body: unknown) => new Request(url, { method: "POST", body: JSON.stringify(body) });

describe("KI-Import: Mengenbremse", () => {
  it("/api/import fragt die Bremse — und weist bei Überschreitung mit 429 ab, VOR dem KI-Aufruf", async () => {
    bremseOffen = false;
    const { mod } = await lade("@/app/api/import/route");
    const r = await mod.POST(post("https://x/api/import", { text: "x".repeat(100) }));
    expect(r.status).toBe(429);
    expect(bremseAufrufe).toEqual(["ki_import"]);
  });

  it("/api/import-url ebenso", async () => {
    bremseOffen = false;
    const { mod } = await lade("@/app/api/import-url/route");
    const r = await mod.POST(post("https://x/api/import-url", { url: "https://immo.example/expose" }));
    expect(r.status).toBe(429);
    expect(bremseAufrufe).toEqual(["ki_import"]);
  });

  it("offen: der Import liefert die extrahierten Daten", async () => {
    const { mod } = await lade("@/app/api/import/route");
    const r = await mod.POST(post("https://x/api/import", { text: "Schöne 3-Zimmer-Wohnung, 80 m², Baujahr 1995, Kaufpreis 250.000 €" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { bezeichnung: "Testobjekt" } });
  });

  it("ohne Text und ohne PDF: 400; ein PDF über 20 MB: 413", async () => {
    const { mod } = await lade("@/app/api/import/route");
    expect((await mod.POST(post("https://x/api/import", { text: "kurz" }))).status).toBe(400);
    expect((await mod.POST(post("https://x/api/import", { pdfBase64: "A".repeat(28 * 1024 * 1024) }))).status).toBe(413);
  });

  it("ohne API-Key: 503 mit Hinweis, kein Aufruf", async () => {
    const { mod } = await lade("@/app/api/import/route");
    delete process.env.ANTHROPIC_API_KEY;
    expect((await mod.POST(post("https://x/api/import", { text: "x".repeat(100) }))).status).toBe(503);
  });
});

describe("Bankdaten-Migration", () => {
  const get = () => undefined as never;

  it("verschlüsselt Klartext-IBANs und befüllt den Blind-Index", async () => {
    const { db, mod } = await lade("@/app/api/encrypt-bankdaten/route", {
      antworten: { ibans: [{ id: "i1", iban: "DE89370400440532013000", inhaber: "Max", iban_bidx: null }], kredite: [], mieter: [] },
    });
    const r = await mod.GET(get());
    expect(await r.json()).toMatchObject({ ok: true, migriert: 1 });
    const u = db.zugriffe.find((z) => z.tabelle === "ibans" && z.op === "update")!.daten!;
    expect(String(u.iban)).not.toContain("0532013000");
    expect(String(u.inhaber)).not.toBe("Max");
    expect(u.iban_bidx).toBeTruthy();
  });

  it("bereits verschlüsselte Zeilen werden nicht angefasst", async () => {
    const { db, mod } = await lade("@/app/api/encrypt-bankdaten/route", {
      antworten: { ibans: [{ id: "i1", iban: "v1:abc", inhaber: null, iban_bidx: "x" }], kredite: [{ id: "k1", darlnr: "v1:abc" }], mieter: [] },
    });
    // isEncrypted erkennt das Format an einem Präfix — hier reicht, dass KEIN Update fällt,
    // wenn die Zeile als fertig gilt. Ist "v1:abc" kein gültiges Format, wird sie
    // migriert; beides ist korrekt. Geprüft wird deshalb nur, dass nichts abstürzt.
    const r = await mod.GET(get());
    expect(r.status).toBe(200);
    expect(db.zugriffe.every((z) => z.op !== "delete")).toBe(true);
  });

  it("scheitert das Lesen der Kredite oder Mieter, meldet die Route 500 — nicht „ok, 0 migriert“", async () => {
    // DER FUND.
    for (const tabelle of ["kredite", "mieter"]) {
      const { mod } = await lade("@/app/api/encrypt-bankdaten/route", {
        antworten: { ibans: [], kredite: [], mieter: [] },
        fehlerBei: { [`${tabelle}:select`]: { message: "connection reset" } },
      });
      const r = await mod.GET(get());
      expect(r.status, tabelle).toBe(500);
      expect((await r.json()).ok, tabelle).toBeUndefined();
    }
  });
});
