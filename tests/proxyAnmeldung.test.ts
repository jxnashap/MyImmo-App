import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Proxy: Anmeldung über `getClaims` statt `getUser` (30.09.2026).
//
// Geprüft mit ECHTEN Schlüsseln und der ECHTEN Supabase-Bibliothek — nur das
// Netz ist ersetzt. Behauptet wird dreierlei:
//   1. Ein gültig signiertes Token lässt durch, OHNE den Auth-Server zu fragen
//      (das ist der Zweck der Umstellung).
//   2. Alles andere gilt als nicht angemeldet: fremde Signatur, abgelaufen,
//      HS256, kein Cookie, Schlüsselsatz nicht erreichbar (fail-closed).
//   3. Die Demo-Sperre greift weiter über die E-Mail aus dem Token.

const PROJEKT = "testprojekt";
const COOKIE = `sb-${PROJEKT}-auth-token`;
// Eigene Schlüssel-ID je Test: Die Bibliothek hält den Schlüsselsatz modulweit
// (auch über `vi.resetModules()` hinweg, sie wird nicht neu geladen). Ein
// neues Paar unter alter ID gibt es bei Supabase nicht.
let KID = "";
let zaehler = 0;

type Aufruf = string;
let aufrufe: Aufruf[] = [];
let jwksErreichbar = true;
let oeffentlich: JsonWebKey;
let privat: CryptoKey;
let fremdPrivat: CryptoKey;

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === "string" ? b : b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");

async function token(opts: { schluessel?: CryptoKey; email?: string; exp?: number; alg?: string } = {}) {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = { alg: opts.alg ?? "ES256", kid: KID, typ: "JWT" };
  const inhalt = {
    sub: "11111111-2222-3333-4444-555555555555",
    email: opts.email ?? "vermieter@example.de",
    aud: "authenticated",
    role: "authenticated",
    exp: opts.exp ?? jetzt + 3600,
    iat: jetzt,
    session_id: "sitzung-1",
  };
  const roh = `${b64url(JSON.stringify(kopf))}.${b64url(JSON.stringify(inhalt))}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    opts.schluessel ?? privat,
    new TextEncoder().encode(roh),
  );
  return { jwt: `${roh}.${b64url(sig)}`, exp: inhalt.exp, email: inhalt.email };
}

function cookieFuer(t: { jwt: string; exp: number; email: string }, expiresAt = t.exp) {
  const sitzung = {
    access_token: t.jwt,
    refresh_token: "auffrischen",
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "11111111-2222-3333-4444-555555555555", email: t.email },
  };
  return `${COOKIE}=base64-${b64url(JSON.stringify(sitzung))}`;
}

async function anfrage(pfad: string, cookie?: string) {
  const { proxy } = await import("@/proxy");
  const req = new NextRequest(`https://www.myimmoapp.de${pfad}`, { headers: cookie ? { cookie } : {} });
  return proxy(req);
}

const landetAufLogin = (r: Response) => r.status === 307 && (r.headers.get("location") ?? "").includes("/login");

beforeEach(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PROJEKT}.supabase.co`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  aufrufe = [];
  jwksErreichbar = true;
  KID = `schluessel-${++zaehler}`;
  const paar = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  privat = paar.privateKey;
  oeffentlich = { ...(await crypto.subtle.exportKey("jwk", paar.publicKey)), kid: KID, alg: "ES256", use: "sig", key_ops: ["verify"] } as JsonWebKey;
  const fremd = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  fremdPrivat = fremd.privateKey;

  vi.stubGlobal("fetch", vi.fn(async (eingabe: RequestInfo | URL) => {
    const url = String(eingabe instanceof Request ? eingabe.url : eingabe);
    aufrufe.push(url);
    if (url.endsWith("/.well-known/jwks.json") && jwksErreichbar) {
      return new Response(JSON.stringify({ keys: [oeffentlich] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // Auth-Server (getUser, Token-Auffrischung) antwortet hier nie positiv —
    // wer ihn braucht, scheitert sichtbar. 400 wie Supabase bei ungültigem
    // Token (bei 5xx versucht die Bibliothek es mehrfach mit Wartezeit).
    return new Response(JSON.stringify({ code: 400, error_code: "bad_jwt", msg: "nicht im Test" }), { status: 400, headers: { "content-type": "application/json" } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Proxy-Anmeldung über getClaims", () => {
  it("gültig signiertes Token: durch, und der Auth-Server wird NICHT gefragt", async () => {
    const r = await anfrage("/steuer", cookieFuer(await token()));
    expect(landetAufLogin(r)).toBe(false);
    expect(aufrufe.some((u) => u.includes("/auth/v1/user"))).toBe(false);
    expect(aufrufe.every((u) => u.endsWith("/.well-known/jwks.json"))).toBe(true);
  });

  it("fremde Signatur unter bekannter Schlüssel-ID: nicht angemeldet", async () => {
    const r = await anfrage("/steuer", cookieFuer(await token({ schluessel: fremdPrivat })));
    expect(landetAufLogin(r)).toBe(true);
  });

  it("abgelaufenes Token, Auffrischen scheitert: nicht angemeldet", async () => {
    const r = await anfrage("/steuer", cookieFuer(await token({ exp: Math.floor(Date.now() / 1000) - 60 })));
    expect(landetAufLogin(r)).toBe(true);
  });

  it("abgelaufenes Token mit gefälschtem Ablauf im Cookie: nicht angemeldet", async () => {
    // Das Sitzungs-Cookie schreibt der Browser — `expires_at` darin ist frei
    // setzbar. Steht es in der Zukunft, frischt `getSession` nicht auf und
    // reicht das abgelaufene Token weiter; erst die Ablaufprüfung in
    // `getClaims` hält es auf.
    const t = await token({ exp: Math.floor(Date.now() / 1000) - 60 });
    const r = await anfrage("/steuer", cookieFuer(t, Math.floor(Date.now() / 1000) + 3600));
    expect(landetAufLogin(r)).toBe(true);
  });

  it("Token mit HS256-Kopf fällt auf den Auth-Server zurück — der sagt nein", async () => {
    const r = await anfrage("/steuer", cookieFuer(await token({ alg: "HS256" })));
    expect(landetAufLogin(r)).toBe(true);
    expect(aufrufe.some((u) => u.includes("/auth/v1/user"))).toBe(true);
  });

  it("Schlüsselsatz nicht erreichbar: fail-closed", async () => {
    jwksErreichbar = false;
    const r = await anfrage("/steuer", cookieFuer(await token()));
    expect(landetAufLogin(r)).toBe(true);
  });

  it("ohne Cookie: Login, mit Rücksprungziel", async () => {
    const r = await anfrage("/steuer");
    expect(landetAufLogin(r)).toBe(true);
    expect(r.headers.get("location")).toContain("next=%2Fsteuer");
  });

  it("Demo-Konto: die Sperre liest die E-Mail aus dem geprüften Token", async () => {
    const { DEMO_EMAIL } = await import("@/lib/demo");
    const t = cookieFuer(await token({ email: DEMO_EMAIL }));
    const gesperrt = await anfrage("/makler", t);
    expect(gesperrt.status).toBe(307);
    expect(gesperrt.headers.get("location")).toContain("demo=gesperrt");
    const frei = await anfrage("/", t);
    expect(frei.headers.get("location") ?? "").not.toContain("demo=gesperrt");
    expect(landetAufLogin(frei)).toBe(false);
  });

  it("der Schlüsselsatz wird zwischengespeichert: zweite Anfrage ohne jeden Netzaufruf", async () => {
    const { proxy } = await import("@/proxy");
    const c = cookieFuer(await token());
    await proxy(new NextRequest("https://www.myimmoapp.de/steuer", { headers: { cookie: c } }));
    const nachErster = aufrufe.length;
    const r = await proxy(new NextRequest("https://www.myimmoapp.de/tenants", { headers: { cookie: c } }));
    expect(landetAufLogin(r)).toBe(false);
    expect(aufrufe.length).toBe(nachErster);
  });
});
