// Installierbare Web-App, Stufe 1 (10.10.2026). Plan und Datenrecht: docs/zukunft/WEBAPP-INSTALLIERBAR.md
//
// Was hier festgehalten wird, ist die Zusage aus Datenschutzerklärung (Ziffer 6) und AVV (TOM
// „Endgeräte“): Der Service Worker hält NUR die Offline-Seite vor, legt nie eine Antwort in einen
// Cache, und registriert wird er nur im angemeldeten App-Bereich. Der Worker wird dafür wirklich
// ausgeführt (vm-Sandbox mit nachgebauten Browser-Schnittstellen), nicht nur gelesen.
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { CACHE_PRAEFIX, OFFLINE_PFAD, SW_AN, SW_PFAD, installWeg, starteDienst } from "@/lib/pwa";
import manifest from "@/app/manifest";
import nextConfig from "../next.config.mjs";
import { AVV_BLOECKE } from "@/lib/avvInhalt";

const lies = (p: string) => readFileSync(p, "utf8");
const SW = lies("public/sw.js");
const BASIS = "https://www.myimmoapp.de";

// ---------- Sandbox für public/sw.js ----------

class FakeRequest {
  url: string;
  cache?: string;
  constructor(url: string, init?: { cache?: string }) {
    this.url = new URL(url, BASIS).href;
    this.cache = init?.cache;
  }
}

function ladeSw(netz: (req: unknown) => Promise<Response> = async () => new Response("vom Netz")) {
  const handler: Record<string, (e: unknown) => void> = {};
  const speicher = new Map<string, Map<string, Response>>();
  const geholt: unknown[] = [];
  const fetchFn = vi.fn(async (req: unknown) => {
    geholt.push(req);
    return netz(req);
  });
  const puts: string[] = [];
  const caches = {
    open: async (name: string) => {
      if (!speicher.has(name)) speicher.set(name, new Map());
      const m = speicher.get(name)!;
      return {
        add: async (req: FakeRequest) => {
          m.set(new URL(req.url).pathname, await fetchFn(req));
        },
        put: async (req: unknown) => {
          puts.push(String(req));
        },
      };
    },
    keys: async () => [...speicher.keys()],
    delete: async (name: string) => speicher.delete(name),
    match: async (pfad: string, o?: { cacheName?: string }) => (o?.cacheName ? speicher.get(o.cacheName)?.get(pfad) : undefined),
  };
  const self = {
    addEventListener: (typ: string, f: (e: unknown) => void) => {
      handler[typ] = f;
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    registration: { navigationPreload: { enable: vi.fn(async () => undefined) } },
  };
  vm.runInNewContext(SW, { self, caches, fetch: fetchFn, Request: FakeRequest, Response, Promise, URL });
  return { handler, speicher, fetchFn, geholt, puts, self, caches };
}

async function installiere(sw: ReturnType<typeof ladeSw>) {
  let warten: Promise<unknown> = Promise.resolve();
  sw.handler.install({ waitUntil: (p: Promise<unknown>) => (warten = p) });
  await warten;
}

/** Löst ein fetch-Ereignis aus; `antwort` ist undefined, wenn der Worker die Anfrage nicht anfasst. */
async function hole(
  sw: ReturnType<typeof ladeSw>,
  req: { url: string; mode: string; method?: string },
  preload?: Response,
) {
  let antwort: Promise<Response> | undefined;
  sw.handler.fetch({
    request: { method: "GET", ...req, url: new URL(req.url, BASIS).href },
    preloadResponse: Promise.resolve(preload),
    respondWith: (p: Promise<Response>) => (antwort = p),
  });
  return antwort ? await antwort : undefined;
}

const VERSION = /const VERSION = "([0-9a-f]+)"/.exec(SW)?.[1];

describe("Service Worker: hält nur die Offline-Seite vor", () => {
  it("Installation legt GENAU die Offline-Seite ab, frisch vom Server", async () => {
    const sw = ladeSw();
    await installiere(sw);
    expect([...sw.speicher.keys()]).toEqual([`${CACHE_PRAEFIX}offline-${VERSION}`]);
    expect([...sw.speicher.values()][0].size).toBe(1);
    expect([...[...sw.speicher.values()][0].keys()]).toEqual([OFFLINE_PFAD]);
    expect((sw.geholt[0] as FakeRequest).cache).toBe("reload");
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it("Seitenaufruf mit Netz: Antwort vom Netz, nichts wird gespeichert", async () => {
    const sw = ladeSw();
    await installiere(sw);
    const vorher = [...sw.speicher.values()][0].size;
    const r = await hole(sw, { url: "/tenants/123", mode: "navigate" });
    expect(await r!.text()).toBe("vom Netz");
    expect([...sw.speicher.values()][0].size).toBe(vorher);
    expect(sw.puts).toEqual([]);
  });

  it("Vorab geladene Seite wird genommen, ohne zweite Anfrage", async () => {
    const sw = ladeSw();
    await installiere(sw);
    sw.fetchFn.mockClear();
    const r = await hole(sw, { url: "/", mode: "navigate" }, new Response("vorab"));
    expect(await r!.text()).toBe("vorab");
    expect(sw.fetchFn).not.toHaveBeenCalled();
  });

  it("Seitenaufruf ohne Netz: die Hinweisseite", async () => {
    let offline = false;
    const sw = ladeSw(async () => {
      if (offline) throw new TypeError("Failed to fetch");
      return new Response("<h1>Keine Verbindung</h1>");
    });
    await installiere(sw);
    offline = true;
    const r = await hole(sw, { url: "/mietkonto", mode: "navigate" });
    expect(await r!.text()).toContain("Keine Verbindung");
  });

  it("alles andere fasst er NICHT an: Programmdateien, API, Supabase, Formulare", async () => {
    const sw = ladeSw();
    await installiere(sw);
    expect(await hole(sw, { url: "/_next/static/chunks/app.js", mode: "no-cors" })).toBeUndefined();
    expect(await hole(sw, { url: "/api/export/buchungen", mode: "cors" })).toBeUndefined();
    expect(await hole(sw, { url: "https://kozhxrvyilkchjpcuwcm.supabase.co/rest/v1/mieter", mode: "cors" })).toBeUndefined();
    expect(await hole(sw, { url: "/tenants/new", mode: "navigate", method: "POST" })).toBeUndefined();
  });

  it("im Quelltext gibt es genau EIN Ablegen — das der Offline-Seite bei der Installation", () => {
    const code = SW.replace(/\/\/.*$/gm, "");
    expect(code.match(/\.(put|add|addAll)\(/g)).toEqual([".add("]);
    expect(code).toMatch(/cache\.add\(new Request\(OFFLINE, \{ cache: "reload" \}\)\)/);
  });

  it("Aufräumen: alte eigene Caches weg, fremde bleiben; Vorab-Laden an", async () => {
    const sw = ladeSw();
    await installiere(sw);
    await (await sw.caches.open(`${CACHE_PRAEFIX}offline-alt`)).add(new FakeRequest(OFFLINE_PFAD));
    await sw.caches.open("fremd-cache");
    let warten: Promise<unknown> = Promise.resolve();
    sw.handler.activate({ waitUntil: (p: Promise<unknown>) => (warten = p) });
    await warten;
    expect([...sw.speicher.keys()].sort()).toEqual([`${CACHE_PRAEFIX}offline-${VERSION}`, "fremd-cache"].sort());
    expect(sw.self.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("VERSION folgt der Offline-Seite — sonst behalten installierte Apps die alte", () => {
    const hash = createHash("sha256").update(readFileSync("public/pwa/offline.html")).digest("hex").slice(0, 12);
    expect(VERSION).toBe(hash);
    expect(SW).toContain(`const OFFLINE = "${OFFLINE_PFAD}";`);
    expect(SW).toContain(`n.startsWith("${CACHE_PRAEFIX}")`);
    expect(existsSync("public" + OFFLINE_PFAD)).toBe(true);
    expect(existsSync("public" + SW_PFAD)).toBe(true);
  });
});

describe("Anmelden, Notschalter, Installationsweg", () => {
  const container = () => {
    const regs = [{ unregister: vi.fn(async () => true) }, { unregister: vi.fn(async () => true) }];
    return { register: vi.fn(async () => ({})), getRegistrations: vi.fn(async () => regs), regs };
  };
  const cacheSpeicher = () => {
    const namen = new Set(["myimmo-offline-abc", "fremd"]);
    return { keys: async () => [...namen], delete: vi.fn(async (n: string) => namen.delete(n)), namen };
  };

  it("angeschaltet: meldet /sw.js für die ganze App an, am HTTP-Cache vorbei", async () => {
    const sw = container();
    expect(await starteDienst(sw, cacheSpeicher(), true)).toBe("angemeldet");
    expect(sw.register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
    expect(SW_AN).toBe(true);
  });

  it("Notschalter: alle Registrierungen ab, nur die eigenen Caches leer", async () => {
    const sw = container();
    const c = cacheSpeicher();
    expect(await starteDienst(sw, c, false)).toBe("abgemeldet");
    expect(sw.register).not.toHaveBeenCalled();
    for (const r of sw.regs) expect(r.unregister).toHaveBeenCalled();
    expect([...c.namen]).toEqual(["fremd"]);
  });

  it("ohne Service-Worker-Unterstützung: nichts", async () => {
    expect(await starteDienst(undefined, undefined, true)).toBe("ohne");
  });

  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPADOS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";
  const FIREFOX_ANDROID = "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0";
  const w = (ua: string, o: Partial<{ standalone: boolean; hatAngebot: boolean; touchPunkte: number }> = {}) =>
    installWeg({ ua, standalone: false, hatAngebot: false, touchPunkte: 0, ...o });

  it("jeder Browser bekommt den Weg, den er kann", () => {
    expect(w(IPHONE, { touchPunkte: 5 })).toBe("ios");
    expect(w(IPADOS, { touchPunkte: 5 })).toBe("ios"); // iPadOS gibt sich als Mac aus
    expect(w(IPADOS)).toBe("mac-safari");
    expect(w(CHROME_MAC)).toBe("menue");
    expect(w(FIREFOX)).toBe("nicht");
    expect(w(FIREFOX_ANDROID)).toBe("menue");
    expect(w(CHROME_MAC, { hatAngebot: true })).toBe("knopf");
    expect(w(IPHONE, { standalone: true, touchPunkte: 5 })).toBe("installiert");
  });
});

describe("Ausgeliefert ohne Login-Weiche, mit eigenen Headern", () => {
  const matcher = (() => {
    const m = /matcher:\s*\[\s*"([^"]+)"/.exec(lies("proxy.ts"))![1].replace(/\\\\/g, "\\");
    return new RegExp(`^${m}$`);
  })();

  it("Manifest, Worker, Symbole und Offline-Seite laufen nicht über den Proxy", () => {
    for (const p of ["/sw.js", "/manifest.webmanifest", "/pwa/icon-192.png", "/pwa/offline.html", "/pwa/apple-touch-icon.png"]) {
      expect(matcher.test(p), p).toBe(false);
    }
    for (const p of ["/", "/login", "/tenants", "/sw.jsx", "/swimmingpool", "/pwa"]) {
      expect(matcher.test(p), p).toBe(true);
    }
  });

  it("Header: der Worker nie aus dem HTTP-Cache, mit eigener CSP; die übrigen mit den Sicherheits-Headern", async () => {
    const regeln = await nextConfig.headers();
    const kopf = (quelle: string) => Object.fromEntries((regeln.find((r: { source: string }) => r.source === quelle)?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(kopf("/sw.js")["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
    expect(kopf("/sw.js")["Content-Security-Policy"]).toBe("default-src 'self'; script-src 'self'");
    expect(kopf("/sw.js")["Content-Type"]).toMatch(/^application\/javascript/);
    for (const q of ["/manifest.webmanifest", "/pwa/:pfad*"]) {
      expect(kopf(q)["Content-Security-Policy"], q).toContain("default-src 'self'");
      expect(kopf(q)["X-Content-Type-Options"], q).toBe("nosniff");
    }
  });

  it("die App-CSP erlaubt Worker und Manifest nur vom eigenen Origin", () => {
    const proxy = lies("proxy.ts");
    expect(proxy).toContain(`"worker-src 'self'"`);
    expect(proxy).toContain(`"manifest-src 'self'"`);
  });
});

describe("Registriert nur im angemeldeten App-Bereich", () => {
  const layout = lies("app/(app)/layout.tsx");

  it("in den beiden angemeldeten Hüllen (Vermieter, Mieter/Service) — sonst nirgends", () => {
    expect(layout.match(/<PwaAnmeldung \/>/g)).toHaveLength(2);
    const abgemeldet = layout.slice(layout.indexOf("if (!user) {"), layout.indexOf("const pathname = (await headers())"));
    expect(abgemeldet).not.toContain("PwaAnmeldung");
    const oeffentlich = layout.slice(layout.indexOf("if (istOeffentlicheSeite) {"), layout.indexOf("const [{ data: props }"));
    expect(oeffentlich).not.toContain("PwaAnmeldung");
    const willkommen = layout.slice(layout.indexOf('if (pathname.startsWith("/willkommen")) {'), layout.indexOf('if (rolle === "mieter"'));
    expect(willkommen).not.toContain("PwaAnmeldung");
    expect(lies("app/(pub)/layout.tsx")).not.toContain("PwaAnmeldung");
  });

  it("nur lib/pwa.ts meldet einen Service Worker an", () => {
    const dateien: string[] = [];
    const lauf = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) lauf(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(n)) dateien.push(p);
      }
    };
    for (const d of ["app", "components", "lib"]) lauf(d);
    const melden = dateien.filter((f) => /\.register\(SW_PFAD|serviceWorker\.register\(/.test(lies(f)));
    expect(melden).toEqual([join("lib", "pwa.ts")]);
  });
});

describe("Manifest, Symbole, Hinweis, Rechtstexte", () => {
  const pngGroesse = (p: string) => {
    const b = readFileSync(p);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };

  it("Manifest: eigenständige App für die ganze Seite, Symbole liegen bereit", () => {
    const m = manifest();
    expect(m).toMatchObject({ id: "/", start_url: "/?app=1", scope: "/", display: "standalone", short_name: "MyImmo", lang: "de" });
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const i of icons) {
      const [b, h] = pngGroesse("public" + i.src);
      expect(`${b}x${h}`, i.src).toBe(i.sizes);
    }
    expect(pngGroesse("public/pwa/apple-touch-icon.png")).toEqual([180, 180]);
    for (const l of ["app/(app)/layout.tsx", "app/(pub)/layout.tsx"]) {
      expect(lies(l), l).toContain('apple: "/pwa/apple-touch-icon.png"');
      // Mit `icons` in den Metadaten lässt Next das Datei-Favicon weg — es muss mitgenannt sein.
      expect(lies(l), l).toContain('url: "/icon.svg"');
    }
  });

  it("der Hinweis „Als App installieren“ steht in Support (/hilfe, Einstellungen) und im Mieter-/Service-Konto", () => {
    expect(lies("components/HilfeInhalt.tsx")).toContain("<AppInstallieren />");
    expect(lies("app/(app)/konto/page.tsx")).toContain("<AppInstallieren />");
  });

  it("Datenschutzerklärung und AVV sagen, was auf dem Gerät liegt — und was nicht", () => {
    const ds = lies("app/(pub)/datenschutz/page.tsx");
    expect(ds).toMatch(/Service Worker, den Ihr Browser beim ersten\s+angemeldeten Aufruf anlegt/);
    expect(ds).toMatch(/eine einzige Hinweisseite/);
    expect(ds).toMatch(/Inhalte aus Ihrem Konto legt er nicht ab/);
    const tom = AVV_BLOECKE.flatMap((b) => ("ul" in b ? b.ul : [])).join(" ");
    expect(tom).toContain("**Endgeräte:**");
    expect(tom).toContain("nicht zwischengespeichert");
  });
});
