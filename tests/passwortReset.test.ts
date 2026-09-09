import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// „Passwort vergessen" — der Rückweg ins eigene Konto.
//
// WAS VORHER WAR (09.09.2026 gefunden)
// `resetPasswordForEmail` zeigte auf `/login`. Dort wurde der Link nirgends
// eingelöst, und ein Formular für ein neues Passwort gab es in der ganzen App
// nicht: `wechslePasswort` ist der einzige Weg zu einem neuen Passwort und
// verlangt das ALTE — also genau das, was der Nutzer vergessen hat. Wer sein
// Passwort verlor, kam nicht zurück ins Konto.
//
// DIE HEIKLE STELLE
// Eine Seite, die ein Passwort OHNE das alte setzt, ist die Hintertür an
// `wechslePasswort` vorbei. Sie darf nur nach einem eingelösten Reset-Token
// öffnen. Genau das prüfen die Tests hier.

// Der Nachweis signiert mit DATA_ENCRYPTION_KEY — für den Test ein fester Wert.
beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
});

const lade = async () => await import("@/lib/auth/resetNachweis");

const JETZT = 1_800_000_000;
const NUTZER = "11111111-2222-3333-4444-555555555555";

describe("Reset-Nachweis", () => {
  it("ein frisch ausgestellter Nachweis gilt", async () => {
    const { stelleNachweisAus, nachweisGueltig } = await lade();
    const n = stelleNachweisAus(NUTZER, JETZT);
    expect(nachweisGueltig(n, NUTZER, JETZT + 10)).toBe(true);
  });

  it("nach Ablauf gilt er nicht mehr", async () => {
    const { stelleNachweisAus, nachweisGueltig, NACHWEIS_SEKUNDEN } = await lade();
    const n = stelleNachweisAus(NUTZER, JETZT);
    expect(nachweisGueltig(n, NUTZER, JETZT + NACHWEIS_SEKUNDEN + 1)).toBe(false);
  });

  it("er gilt NUR für den Nutzer, für den er ausgestellt wurde", async () => {
    // Sonst könnte ein beliebiger angemeldeter Nutzer einen fremden Nachweis
    // mitbringen — der Bezug zur Sitzung wäre wertlos.
    const { stelleNachweisAus, nachweisGueltig } = await lade();
    const n = stelleNachweisAus(NUTZER, JETZT);
    expect(nachweisGueltig(n, "99999999-2222-3333-4444-555555555555", JETZT + 10)).toBe(false);
  });

  it("eine verfälschte Signatur gilt nicht", async () => {
    const { stelleNachweisAus, nachweisGueltig } = await lade();
    const n = stelleNachweisAus(NUTZER, JETZT);
    const [exp, sig] = n.split(".");
    const gedreht = sig[0] === "a" ? "b" : "a";
    expect(nachweisGueltig(`${exp}.${gedreht}${sig.slice(1)}`, NUTZER, JETZT + 10)).toBe(false);
  });

  it("eine verlängerte Ablaufzeit gilt nicht — die Zeit ist mitsigniert", async () => {
    // Ohne Signatur über `exp` könnte man den Nachweis beliebig lange gültig
    // machen, indem man die Zahl davor hochsetzt.
    const { stelleNachweisAus, nachweisGueltig } = await lade();
    const n = stelleNachweisAus(NUTZER, JETZT);
    const sig = n.slice(n.indexOf(".") + 1);
    expect(nachweisGueltig(`${JETZT + 999999}.${sig}`, NUTZER, JETZT + 10)).toBe(false);
  });

  it("Unfug wird abgewiesen, statt zu werfen", async () => {
    const { nachweisGueltig } = await lade();
    for (const w of [null, undefined, "", ".", "abc", "abc.def", `${JETZT + 60}.`, "1e9.x"]) {
      expect(nachweisGueltig(w, NUTZER, JETZT), String(w)).toBe(false);
    }
  });

  it("ohne Nutzer gilt nichts", async () => {
    const { stelleNachweisAus, nachweisGueltig } = await lade();
    const n = stelleNachweisAus(NUTZER, JETZT);
    expect(nachweisGueltig(n, null, JETZT + 10)).toBe(false);
    expect(nachweisGueltig(n, "", JETZT + 10)).toBe(false);
  });
});

describe("Verdrahtung des Reset-Wegs", () => {
  const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("der Reset-Link zeigt auf die Einlöse-Route, nicht auf /login", () => {
    // Das war der eigentliche Fehler: Der Link landete auf einer Seite, die
    // ihn gar nicht auswertete.
    const login = lies("app/(app)/login/page.tsx");
    expect(login).toMatch(/resetPasswordForEmail\([\s\S]{0,200}\/auth\/passwort`/);
  });

  it("die Einlöse-Route bedient BEIDE Linkformen", () => {
    // token_hash/verifyOtp ist der geräteübergreifende Fall — Mail auf dem
    // Handy öffnen ist der Normalfall, nicht die Ausnahme. `code` deckt die
    // Standard-Vorlage auf demselben Gerät ab.
    const route = lies("app/(app)/auth/passwort/route.ts");
    expect(route).toMatch(/verifyOtp\(\{\s*token_hash/);
    expect(route).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("die Route stellt den Nachweis erst NACH bestätigtem Nutzer aus", () => {
    const route = lies("app/(app)/auth/passwort/route.ts");
    // Auf die AUFRUFSTELLE prüfen, nicht auf den Namen: Der steht auch oben im
    // Import, und der kommt zwangsläufig zuerst — die erste Fassung dieses
    // Tests verglich genau das und war deshalb rot, ohne dass etwas fehlte.
    const getUser = route.indexOf("getUser()");
    const setzen = route.indexOf("stelleNachweisAus(user.id)");
    expect(getUser).toBeGreaterThan(-1);
    expect(setzen).toBeGreaterThan(getUser);
  });

  it("der Nachweis-Keks ist httpOnly — sonst könnte ihn Skript-Code lesen", () => {
    expect(lies("app/(app)/auth/passwort/route.ts")).toMatch(/httpOnly:\s*true/);
  });

  it("die Seite öffnet das Formular nur mit gültigem Nachweis", () => {
    // Ohne diese Bedingung wäre die Seite die Hintertür an `wechslePasswort`
    // vorbei: fremde offene Sitzung → neues Passwort ohne Kenntnis des alten.
    const seite = lies("app/(app)/auth/passwort-neu/page.tsx");
    expect(seite).toMatch(/nachweisGueltig\(nachweis,\s*user\?\.id\)/);
    expect(seite).toMatch(/\{darf \?/);
  });

  it("nach dem Wechsel wird auf ALLEN Geräten abgemeldet", () => {
    // Ein Passwort setzt man oft zurück, weil man fremden Zugriff vermutet.
    // Bliebe dessen Sitzung gültig, hätte das Zurücksetzen nichts bewirkt.
    expect(lies("components/PasswortNeu.tsx")).toMatch(/signOut\(\{\s*scope:\s*"global"\s*\}\)/);
  });

  it("das Formular verlangt KEIN altes Passwort", () => {
    // Klingt selbstverständlich, ist aber der Punkt: Genau daran scheiterte
    // der Weg vorher.
    const f = lies("components/PasswortNeu.tsx");
    expect(f).not.toMatch(/aktuell|current_password|altes Passwort/i);
  });

  it("der Weg liegt unter /auth/ — dort greift weder Middleware noch 2FA-Gate", () => {
    // Ein Konto mit Zwei-Faktor muss sein Passwort auch dann zuruecksetzen
    // koennen, wenn der zweite Faktor in dieser Sitzung noch nicht bestaetigt
    // ist. Sonst waere der Rueckweg erneut versperrt.
    const mw = lies("middleware.ts");
    expect(mw).toMatch(/pathname\.startsWith\("\/auth"\)/);
    const layout = lies("app/(app)/layout.tsx");
    expect(layout).toMatch(/!pathname\.startsWith\("\/auth"\)/);
  });
});

// ---------------------------------------------------------------------------
// Rückfall, wenn Supabase das Ziel verwirft (09.09.2026, live gemeldet:
// „URL führt ins Nichts")
//
// `redirectTo` gilt nur, wenn die URL WÖRTLICH in der Redirect-URL-Weißliste
// des Supabase-Projekts steht. Fehlt sie, nimmt Supabase stillschweigend die
// Site URL — steht die auf localhost, landet der Nutzer im Nichts. Das ist
// eine Dashboard-Einstellung, die im Code nicht sichtbar ist; der Rückweg ins
// Konto darf nicht daran hängen.
describe("Rückfall: Reset-Merkmale landen woanders", () => {
  const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

  it("die Middleware leitet Recovery-Merkmale zur Einlöse-Route", () => {
    expect(mw).toMatch(/type"\) === "recovery"/);
    expect(mw).toMatch(/new URL\("\/auth\/passwort", request\.url\)/);
  });

  it("die Suchparameter gehen dabei mit — sonst wäre der Token weg", () => {
    expect(mw).toMatch(/ziel\.search = request\.nextUrl\.search/);
  });

  it("/auth/ ist ausgenommen — sonst Endlosschleife und gekaperter Google-Login", () => {
    // Die Einlöse-Route selbst trägt dieselben Merkmale; ohne die Ausnahme
    // würde sie sich im Kreis auf sich selbst weiterleiten. Und
    // /auth/callback nutzt `code` für Google — den darf der Rückfall nicht
    // an die Passwort-Route umbiegen.
    expect(mw).toMatch(/if \(!pathname\.startsWith\("\/auth"\)\) \{/);
  });

  it("ein blankes `code` greift nur auf / und /login, nicht überall", () => {
    // `code` allein ist mehrdeutig. Nur dort umbiegen, wo Supabase bei
    // verworfenem Ziel tatsächlich landet.
    expect(mw).toMatch(/p\.has\("code"\) && \(pathname === "\/" \|\| pathname === "\/login"\)/);
  });
});
