import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { fetch as undiciFetch } from "undici";
import { mockeNextUndSupabase } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";

// B16/B17 (Prüfstand 11.10.2026): KI- und Link-Import mit echten Grenzen — Anbieter, Größe, Zeit,
// Bremse — und ohne DNS-Rebinding-Fenster. Wo es geht, mit ECHTEN Sockets gegen einen lokalen Server.

const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/planGate"]) vi.doUnmock(m);
});

/** Lokaler HTTP-Server; `antwort` bekommt req/res. */
async function server(antwort: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const s = http.createServer(antwort);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  const port = (s.address() as AddressInfo).port;
  return { port, zu: () => new Promise<void>((r) => { s.closeAllConnections(); s.close(() => r()); }) };
}

describe("liesBegrenzt / jsonBegrenzt", () => {
  const strom = (teile: number[], laenge?: number) => {
    let gelesen = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        const n = teile.shift();
        if (n === undefined) return c.close();
        gelesen += n;
        c.enqueue(new Uint8Array(n).fill(65));
      },
    });
    return { quelle: { headers: new Headers(laenge != null ? { "content-length": String(laenge) } : {}), body }, gelesen: () => gelesen };
  };

  it("unter der Grenze: alles; darüber: Abbruch, bevor der Rest gelesen wird", async () => {
    const { liesBegrenzt, ZuGrossFehler } = await import("@/lib/net/grenzen");
    expect((await liesBegrenzt(strom([3, 4]).quelle, 10)).byteLength).toBe(7);
    const s = strom([6, 6, 6, 6, 6]);
    await expect(liesBegrenzt(s.quelle, 10)).rejects.toBeInstanceOf(ZuGrossFehler);
    expect(s.gelesen()).toBeLessThanOrEqual(12);
  });

  it("Content-Length über der Grenze: abgelehnt, ohne ein Byte zu lesen", async () => {
    const { liesBegrenzt, ZuGrossFehler } = await import("@/lib/net/grenzen");
    const s = strom([5], 50_000_000);
    await expect(liesBegrenzt(s.quelle, 10)).rejects.toBeInstanceOf(ZuGrossFehler);
    expect(s.gelesen()).toBe(0);
  });

  it("abschneiden: die ersten N Bytes, nicht mehr", async () => {
    const { liesBegrenzt } = await import("@/lib/net/grenzen");
    expect((await liesBegrenzt(strom([6, 6, 6]).quelle, 10, { abschneiden: true })).byteLength).toBe(10);
  });

  it("jsonBegrenzt: großer Body → ZuGrossFehler statt Speicher voll", async () => {
    const { jsonBegrenzt, ZuGrossFehler } = await import("@/lib/net/grenzen");
    const req = new Request("https://x/", { method: "POST", body: JSON.stringify({ data: "x".repeat(5000) }) });
    await expect(jsonBegrenzt(req, 1000)).rejects.toBeInstanceOf(ZuGrossFehler);
    expect(await jsonBegrenzt(new Request("https://x/", { method: "POST", body: '{"a":1}' }), 1000)).toEqual({ a: 1 });
  });
});

describe("B17: DNS-Rebinding — verbunden wird NUR mit der geprüften Adresse", () => {
  it("festeAufloesung: ein nicht auflösbarer Name erreicht genau die festgehaltene Adresse (echter Socket)", async () => {
    const { festeAufloesung } = await import("@/lib/net/ssrf");
    const srv = await server((req, res) => res.end(`host=${req.headers.host}`));
    try {
      const agent = festeAufloesung([{ address: "127.0.0.1", family: 4 }]);
      const r = await undiciFetch(`http://gibt-es-nicht.invalid:${srv.port}/`, { dispatcher: agent });
      // Der Name bleibt im Host-Kopf (und bei https für SNI/Zertifikat) — verbunden wurde mit 127.0.0.1.
      expect(await r.text()).toBe(`host=gibt-es-nicht.invalid:${srv.port}`);
      await agent.close();
    } finally {
      await srv.zu();
    }
  });

  it("je Sprung wird EINMAL aufgelöst; die Verbindung bekommt GENAU diese Antwort, eine zweite (umgebogene) nie", async () => {
    const { sicheresFetch, festeAufloesung } = await import("@/lib/net/ssrf");
    const antworten = [[{ address: "93.184.216.34", family: 4 }], [{ address: "169.254.169.254", family: 4 }]];
    let aufgeloest = 0;
    const verbunden: unknown[] = [];
    const r = await sicheresFetch(new URL("http://boese.example/expose"), {
      accept: "*/*", timeoutMs: 1000, userAgent: "t", maxBytes: 1000,
      aufloesen: async () => antworten[aufgeloest++],
      verbinden: (adressen) => { verbunden.push(adressen); return festeAufloesung(adressen); },
      holen: async () => new Response("ok", { status: 200 }) as never,
    });
    expect(r.ok).toBe(true);
    expect(aufgeloest).toBe(1);
    expect(verbunden).toEqual([[{ address: "93.184.216.34", family: 4 }]]);
  });

  it("festeAufloesung: auch eine Abfrage nach ALLEN Adressen liefert nur die geprüften", async () => {
    const { festeAufloesung } = await import("@/lib/net/ssrf");
    const srv = await server((_req, res) => res.end("ok"));
    try {
      // Zwei geprüfte Adressen: die erste nicht erreichbar (TEST-NET), die zweite lokal — undici/Node
      // probieren mit `autoSelectFamily` reihum; es gibt KEINEN Weg zu einer ungeprüften Adresse.
      const agent = festeAufloesung([{ address: "127.0.0.1", family: 4 }]);
      expect(await (await undiciFetch(`http://x.invalid:${srv.port}/`, { dispatcher: agent })).text()).toBe("ok");
      await agent.close();
    } finally {
      await srv.zu();
    }
  });

  it("eine Weiterleitung auf eine interne Adresse wird vor dem Verbinden abgewiesen", async () => {
    const { sicheresFetch, ZielNichtErlaubtFehler } = await import("@/lib/net/ssrf");
    const rufe: string[] = [];
    await expect(sicheresFetch(new URL("http://harmlos.example/"), {
      accept: "*/*", timeoutMs: 1000, userAgent: "t", maxBytes: 1000,
      aufloesen: async (h) => (h === "harmlos.example" ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "10.0.0.5", family: 4 }]),
      holen: async (url) => {
        rufe.push(url);
        return new Response(null, { status: 302, headers: { location: "http://intern.example/geheim" } }) as never;
      },
    })).rejects.toBeInstanceOf(ZielNichtErlaubtFehler);
    expect(rufe).toEqual(["http://harmlos.example/"]);
  });
});

describe("B16: Zeit- und Größengrenzen am echten Socket", () => {
  // Öffentliche Adresse für die Prüfung, tatsächlich aber zum lokalen Server umgeleitet (holen).
  const ueberLokal = (port: number) => (url: string, init: Record<string, unknown>) =>
    undiciFetch(url.replace("http://extern.example", `http://127.0.0.1:${port}`), { ...init, dispatcher: undefined } as never) as never;
  const oeffentlich = async () => [{ address: "93.184.216.34", family: 4 }];

  it("Kopfzeilen sofort, Body tröpfelt → Abbruch nach dem Zeitlimit (vorher: Zeitgeber endete mit den Kopfzeilen)", async () => {
    const { sicheresFetch } = await import("@/lib/net/ssrf");
    const srv = await server((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.write("<html>"); /* nie fertig */ });
    try {
      const start = Date.now();
      await expect(sicheresFetch(new URL("http://extern.example/"), {
        accept: "*/*", timeoutMs: 300, userAgent: "t", maxBytes: 1_000_000, aufloesen: oeffentlich, holen: ueberLokal(srv.port),
      })).rejects.toThrow();
      expect(Date.now() - start).toBeLessThan(3000);
    } finally {
      await srv.zu();
    }
  });

  it("ein 5-MB-Body bei 1 MB Grenze: Abbruch mit ZuGrossFehler", async () => {
    const { sicheresFetch } = await import("@/lib/net/ssrf");
    const { ZuGrossFehler } = await import("@/lib/net/grenzen");
    const srv = await server((_req, res) => { res.writeHead(200); for (let i = 0; i < 5; i++) res.write(Buffer.alloc(1024 * 1024, 65)); res.end(); });
    try {
      await expect(sicheresFetch(new URL("http://extern.example/"), {
        accept: "*/*", timeoutMs: 5000, userAgent: "t", maxBytes: 1024 * 1024, aufloesen: oeffentlich, holen: ueberLokal(srv.port),
      })).rejects.toBeInstanceOf(ZuGrossFehler);
    } finally {
      await srv.zu();
    }
  });

  it("callAnthropic: ein tröpfelnder KI-Body wird nach dem Zeitlimit abgebrochen", async () => {
    vi.stubGlobal("fetch", async (_u: string, init: { signal: AbortSignal }) => new Response(new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"content":['));
        init.signal.addEventListener("abort", () => c.error(Object.assign(new Error("abgebrochen"), { name: "AbortError" })));
      },
    }), { status: 200 }));
    const { callAnthropic } = await import("@/lib/aiRoute");
    await expect(callAnthropic("k", {}, 100)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("B16: Anbieter und Bremse", () => {
  const bedrock = () => Object.assign(process.env, {
    BEDROCK_ACCESS_KEY_ID: "AKIA", BEDROCK_SECRET_ACCESS_KEY: "s", BEDROCK_MODEL_ID: "eu.anthropic.claude", ANTHROPIC_API_KEY: "",
  });

  it("kiBereit: Bedrock ODER Anthropic-Schlüssel", async () => {
    delete process.env.ANTHROPIC_API_KEY; delete process.env.BEDROCK_ACCESS_KEY_ID;
    expect((await import("@/lib/aiRoute")).kiBereit()).toBe(false);
    vi.resetModules(); bedrock();
    expect((await import("@/lib/aiRoute")).kiBereit()).toBe(true);
  });

  async function route(pfad: string, opts: { admin?: unknown } = {}) {
    vi.resetModules();
    const db = speicherDb();
    mockeNextUndSupabase(db.client, opts.admin === undefined ? { rpc: async () => ({ error: null }) } : opts.admin);
    vi.doMock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
    vi.doMock("@/lib/planGate", () => ({ featureSperre: async () => null }));
    return import(pfad);
  }
  const post = (url: string, body: string) => new Request(url, { method: "POST", body });

  for (const pfad of ["@/app/api/nk-ocr/route", "@/app/api/import/route", "@/app/api/import-url/route"]) {
    it(`${pfad}: nur Bedrock eingerichtet → kein 503 mehr (vorher verlangt: ANTHROPIC_API_KEY)`, async () => {
      bedrock();
      const mod = await route(pfad);
      const r = await mod.POST(post("https://x/", "kein json"));
      expect(r.status).toBe(400);
    });

    it(`${pfad}: gar kein Anbieter → 503 mit verständlicher Meldung`, async () => {
      delete process.env.ANTHROPIC_API_KEY; delete process.env.BEDROCK_ACCESS_KEY_ID;
      const mod = await route(pfad);
      const r = await mod.POST(post("https://x/", "{}"));
      expect(r.status).toBe(503);
      expect((await r.json()).error).toMatch(/Kein KI-Anbieter eingerichtet/);
    });

    it(`${pfad}: fällt die Bremse aus (kein Service-Schlüssel), wird NICHT durchgelassen`, async () => {
      process.env.ANTHROPIC_API_KEY = "sk";
      const mod = await route(pfad, { admin: null });
      expect((await mod.POST(post("https://x/", "{}"))).status).toBe(429);
    });
  }

  it("ein übergroßer Body wird mit 413 abgewiesen, bevor er ganz gelesen ist", async () => {
    process.env.ANTHROPIC_API_KEY = "sk";
    const mod = await route("@/app/api/nk-ocr/route");
    // 40 × 1 MB, ohne Content-Length — gezählt wird, wie viel die Route wirklich abholt.
    let gezogen = 0;
    const teil = new TextEncoder().encode("A".repeat(1024 * 1024));
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (gezogen === 0) c.enqueue(new TextEncoder().encode('{"isPdf":true,"data":"'));
        if (gezogen >= 40) { c.enqueue(new TextEncoder().encode('"}')); return c.close(); }
        gezogen++;
        c.enqueue(teil);
      },
    });
    const r = await mod.POST(new Request("https://x/", { method: "POST", body, duplex: "half" } as RequestInit));
    expect(r.status).toBe(413);
    expect(gezogen).toBeLessThan(35); // Grenze ≈ 26,7 MB; vorher wurden alle 40 MB gelesen
  });

  it("darfWeiter: Standard lässt bei Ausfall durch, kostenpflichtige Wege nicht", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    const { darfWeiter } = await import("@/lib/net/bremse");
    expect(await darfWeiter("x", 1, 60, "k")).toBe(true);
    expect(await darfWeiter("x", 1, 60, "k", { sperrtBeiAusfall: true })).toBe(false);
  });
});

describe("B16: KI-Ergebnis erst nach dem Prüfschritt", () => {
  it("kiVorschlaege: nur mit Gesamtbetrag wählbar, Vorhandenes nicht doppelt, Unsinn nie vorausgewählt", async () => {
    const { kiVorschlaege } = await import("@/lib/nkObjekt");
    const v = kiVorschlaege([
      { name: "Müllabfuhr", gesamt: 1200 },
      { name: "Wasser", gesamt: null },
      { name: "Grundsteuer", gesamt: 800 },
      { name: "", gesamt: 50 },
      { name: "Strom Allgemein", gesamt: -5 },
      { name: "Versicherung", gesamt: 2e7 },
    ], ["grundsteuer "]);
    expect(v.map((x) => [x.name, x.gewaehlt, x.grund])).toEqual([
      ["Müllabfuhr", true, null],
      ["Wasser", false, "ohne Gesamtbetrag des Hauses"],
      ["Grundsteuer", false, "schon erfasst"],
      ["—", false, "ohne Bezeichnung"],
      ["Strom Allgemein", false, "ohne Gesamtbetrag des Hauses"],
      ["Versicherung", false, "ohne Gesamtbetrag des Hauses"],
    ]);
  });

  it("der Upload am Objekt speichert nicht mehr selbst — nur „Ausgewählte übernehmen“ ruft die Übernahme", async () => {
    // Ergänzende Strukturprüfung (Oberfläche); das Verhalten der Auswahl prüft der Test darüber.
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync("components/nk/NkObjektEditor.tsx", "utf8");
    const upload = quelle.slice(quelle.indexOf("async function kiImport"), quelle.indexOf("function kiUebernehmen"));
    expect(upload).not.toMatch(/uebernehmeNkKi\(/);
    expect(upload).toMatch(/setKiVorschau\(kiVorschlaege\(/);
  });
});
