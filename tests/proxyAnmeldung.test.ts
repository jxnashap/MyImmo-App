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

const SUB = "11111111-2222-3333-4444-555555555555";
// Antwort des Auth-Servers auf GET /auth/v1/user — `factors` steuert die 2FA-Schranke.
let nutzerAntwort: Record<string, unknown> | null = null;
async function token(opts: { schluessel?: CryptoKey; email?: string; exp?: number; alg?: string; aal?: string } = {}) {
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
    aal: opts.aal ?? "aal1",
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
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  nutzerAntwort = { id: SUB, aud: "authenticated", role: "authenticated", email: "vermieter@example.de", factors: [] };
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
    if (url.endsWith("/auth/v1/user") && nutzerAntwort) {
      return new Response(JSON.stringify(nutzerAntwort), { status: 200, headers: { "content-type": "application/json" } });
    }
    // Auth-Server (Token-Auffrischung) antwortet hier sonst nie positiv —
    // wer ihn braucht, scheitert sichtbar. 400 wie Supabase bei ungültigem
    // Token (bei 5xx versucht die Bibliothek es mehrfach mit Wartezeit).
    return new Response(JSON.stringify({ code: 400, error_code: "bad_jwt", msg: "nicht im Test" }), { status: 400, headers: { "content-type": "application/json" } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Proxy-Anmeldung über getClaims", () => {
  it("gültig signiertes Token: durch; die ANMELDUNG fragt den Auth-Server nicht (aal2 → gar nicht)", async () => {
    // Seit der Zwei-Faktor-Schranke (01.10.2026) fragt der Proxy bei einer
    // aal1-Sitzung EINMAL je zehn Minuten nach dem Faktorstatus — die
    // Signaturprüfung selbst braucht den Server weiterhin nicht. Beleg: Mit
    // aal2-Token bleibt es bei JWKS allein.
    const r = await anfrage("/steuer", cookieFuer(await token({ aal: "aal2" })));
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
    nutzerAntwort = null; // der Server lehnt ab
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
    const c = cookieFuer(await token({ aal: "aal2" }));
    await proxy(new NextRequest("https://www.myimmoapp.de/steuer", { headers: { cookie: c } }));
    const nachErster = aufrufe.length;
    const r = await proxy(new NextRequest("https://www.myimmoapp.de/tenants", { headers: { cookie: c } }));
    expect(landetAufLogin(r)).toBe(false);
    expect(aufrufe.length).toBe(nachErster);
  });
});

describe("Abgelaufene Sitzung bekommt einen Grund (Audit 01.10.2026, B30)", () => {
  it("ungültiges Sitzungs-Cookie → /login?grund=abgelaufen, Ziel bleibt erhalten", async () => {
    const r = await anfrage("/steuer", cookieFuer(await token({ exp: Math.floor(Date.now() / 1000) - 60 })));
    expect(landetAufLogin(r)).toBe(true);
    const ziel = new URL(r.headers.get("location") ?? "", "https://www.myimmoapp.de");
    expect(ziel.searchParams.get("grund")).toBe("abgelaufen");
    expect(ziel.searchParams.get("next")).toBe("/steuer");
  });

  it("ganz ohne Cookie: kein Grund — der Besucher war nie angemeldet", async () => {
    const r = await anfrage("/steuer");
    expect(landetAufLogin(r)).toBe(true);
    const ziel = new URL(r.headers.get("location") ?? "", "https://www.myimmoapp.de");
    expect(ziel.searchParams.get("grund")).toBeNull();
  });
});

describe("Zwei-Faktor-Schranke im Proxy (Audit 01.10.2026, A2/A3)", () => {
  const FAKTOR = [{ id: "f1", factor_type: "totp", status: "verified" }];
  const nutzerAufrufe = () => aufrufe.filter((u) => u.endsWith("/auth/v1/user")).length;

  it("aal1-Sitzung, Konto hat Faktor → Seite: /login?mfa=1 mit next; der Server wurde gefragt", async () => {
    nutzerAntwort = { ...nutzerAntwort!, factors: FAKTOR };
    const r = await anfrage("/steuer", cookieFuer(await token()));
    expect(r.status).toBe(307);
    const ziel = new URL(r.headers.get("location")!);
    expect(ziel.pathname).toBe("/login");
    expect(ziel.searchParams.get("mfa")).toBe("1");
    expect(ziel.searchParams.get("next")).toBe("/steuer");
    expect(nutzerAufrufe()).toBe(1);
  });

  it("aal1 + Faktor → POST (Server-Action) und API-Route bekommen 403 JSON, keine Weiterleitung", async () => {
    nutzerAntwort = { ...nutzerAntwort!, factors: FAKTOR };
    const { proxy } = await import("@/proxy");
    const c = cookieFuer(await token());
    const post = await proxy(new NextRequest("https://www.myimmoapp.de/tenants", { method: "POST", headers: { cookie: c } }));
    expect(post.status).toBe(403);
    expect(await post.json()).toMatchObject({ mfa: true });
    const api = await proxy(new NextRequest("https://www.myimmoapp.de/api/export/buchungen", { headers: { cookie: c } }));
    expect(api.status).toBe(403);
  });

  it("das Sitzungs-Cookie mit factors: [] täuscht den Proxy NICHT — der Server zählt", async () => {
    // Genau der Angriff aus dem Audit: Cookie behauptet „kein Faktor", Server sagt „einer".
    nutzerAntwort = { ...nutzerAntwort!, factors: FAKTOR };
    const t = await token();
    const sitzung = { access_token: t.jwt, refresh_token: "x", expires_at: t.exp, expires_in: 3600, token_type: "bearer", user: { id: SUB, factors: [] } };
    const r = await anfrage("/steuer", `${COOKIE}=base64-${b64url(JSON.stringify(sitzung))}`);
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("mfa=1");
  });

  it("aal2-Sitzung → durch, OHNE den Auth-Server zu fragen", async () => {
    nutzerAntwort = { ...nutzerAntwort!, factors: FAKTOR };
    const r = await anfrage("/steuer", cookieFuer(await token({ aal: "aal2" })));
    expect(r.status).toBe(200);
    expect(nutzerAufrufe()).toBe(0);
  });

  it("kein Faktor → durch; der Nachweis-Cookie erspart die nächste Nachfrage — für DIESEN Nutzer", async () => {
    const { proxy } = await import("@/proxy");
    const c = cookieFuer(await token());
    const r1 = await proxy(new NextRequest("https://www.myimmoapp.de/steuer", { headers: { cookie: c } }));
    expect(r1.status).toBe(200);
    const nachweis = r1.cookies.get("mi_faktor")?.value;
    expect(nachweis).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(nutzerAufrufe()).toBe(1);

    const r2 = await proxy(new NextRequest("https://www.myimmoapp.de/tenants", { headers: { cookie: `${c}; mi_faktor=${nachweis}` } }));
    expect(r2.status).toBe(200);
    expect(nutzerAufrufe()).toBe(1); // keine zweite Nachfrage

    // Manipulierter oder fremder Nachweis → wieder nachfragen.
    // Das letzte Zeichen IMMER ändern: Vorher wurde es durch „0“ ersetzt — war es schon
    // eine „0“ (1 von 16 Läufen), blieb der Nachweis gültig und der Test flackerte rot.
    const letztes = nachweis!.slice(-1);
    const verfaelscht = `${nachweis!.slice(0, -1)}${letztes === "0" ? "1" : "0"}`;
    const r3 = await proxy(new NextRequest("https://www.myimmoapp.de/tenants", { headers: { cookie: `${c}; mi_faktor=${verfaelscht}` } }));
    expect(r3.status).toBe(200);
    expect(nutzerAufrufe()).toBe(2);
  });

  it("ein Nachweis eines ANDEREN Nutzers zählt nicht — der Server wird gefragt", async () => {
    const { stelleFaktorNachweisAus } = await import("@/lib/auth/faktorNachweis");
    const fremd = stelleFaktorNachweisAus("99999999-0000-0000-0000-000000000000");
    const r = await anfrage("/steuer", `${cookieFuer(await token())}; mi_faktor=${fremd}`);
    expect(r.status).toBe(200);
    expect(nutzerAufrufe()).toBe(1);
  });

  it("Auth-Server nicht erreichbar → fail-closed: Sitzung gilt als abgelaufen", async () => {
    nutzerAntwort = null;
    const r = await anfrage("/steuer", cookieFuer(await token()));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("grund=abgelaufen");
  });

  it("/login und /auth bleiben erreichbar — sonst käme niemand mehr zum zweiten Schritt", async () => {
    nutzerAntwort = { ...nutzerAntwort!, factors: FAKTOR };
    const { proxy } = await import("@/proxy");
    const c = cookieFuer(await token());
    for (const p of ["/login", "/auth/passwort-neu"]) {
      const r = await proxy(new NextRequest(`https://www.myimmoapp.de${p}`, { headers: { cookie: c } }));
      expect(r.status, p).toBe(200);
    }
    expect(nutzerAufrufe()).toBe(0);
  });
});
