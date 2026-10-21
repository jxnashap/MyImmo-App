import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { abmeldeZiel, bestaetigungsZiel, heimVon, zielNachAnmeldung } from "@/lib/auth/anmeldeZiel";

// Anmeldung, Abmeldung und Bestätigungslink (21.10.2026, Durchsicht „Mieter-Weg“).
// Vorher: (1) Ein Mieter wurde nach dem Abmelden mit richtigem Passwort wieder abgemeldet,
// weil die Seite auf „Vermieter“ stand. (2) Der Bestätigungslink der Registrierung landete
// ohne eigenes Ziel auf der Site URL, wo der Proxy den `code` als „Passwort vergessen“ abfing.

describe("lib/auth/anmeldeZiel", () => {
  it("die Kontorolle bestimmt die Startseite", () => {
    expect(heimVon("mieter")).toBe("/portal");
    expect(heimVon("service")).toBe("/service");
    expect(heimVon("vermieter")).toBe("/");
    expect(heimVon("hausverwaltung")).toBe("/");
    expect(heimVon(null)).toBe("/");
  });

  it("ein Deep-Link gewinnt, sonst die eigene Startseite", () => {
    expect(zielNachAnmeldung("mieter", null)).toBe("/portal");
    expect(zielNachAnmeldung("mieter", "/portal?tab=anliegen")).toBe("/portal?tab=anliegen");
    expect(zielNachAnmeldung("vermieter", null)).toBe("/");
  });

  it("Abmelden behält nur bekannte Rollen", () => {
    expect(abmeldeZiel("mieter")).toBe("/login?rolle=mieter");
    expect(abmeldeZiel("service")).toBe("/login?rolle=service");
    expect(abmeldeZiel("vermieter")).toBe("/login");
    expect(abmeldeZiel("<script>")).toBe("/login");
    expect(abmeldeZiel(null)).toBe("/login");
  });

  it("der Bestätigungslink führt über /auth/callback (vom Reset-Abfang ausgenommen)", () => {
    const m = new URL(bestaetigungsZiel("https://www.myimmoapp.de", "mieter"));
    expect(m.pathname).toBe("/auth/callback");
    expect(m.searchParams.get("bestaetigt")).toBe("1");
    expect(m.searchParams.get("next")).toBe("/portal");
    expect(m.searchParams.get("rolle")).toBe("mieter");
    const v = new URL(bestaetigungsZiel("https://www.myimmoapp.de", "vermieter"));
    expect(v.searchParams.get("next")).toBe("/");
    expect(v.searchParams.get("rolle")).toBeNull();
  });
});

describe("Anmeldeseite (Quelltext)", () => {
  const login = readFileSync("app/(app)/login/page.tsx", "utf8");

  it("weist eine andere Kontorolle nicht mehr ab und meldet nicht ab", () => {
    const handle = login.slice(login.indexOf("async function handleSubmit"), login.indexOf("async function googleLogin"));
    expect(handle).not.toMatch(/kontoRolle !== rolle/);
    expect(handle).toContain("zielNachAnmeldung(kontoRolle, nextUrl)");
    // Abmelden gibt es im Anmelde-Zweig nur noch beim Abbruch des zweiten Faktors (mfaAbbrechen, außerhalb).
    expect(handle).not.toContain("signOut");
  });

  it("beide Registrierungen geben dem Bestätigungslink ein eigenes Ziel", () => {
    expect(login.match(/emailRedirectTo: bestaetigungsZiel\(window\.location\.origin, rolle\)/g)?.length).toBe(2);
  });

  it("die Datenschutzerklärung wird zur Kenntnis genommen, nicht „akzeptiert“", () => {
    expect(login).toContain("habe ich zur Kenntnis genommen");
    expect(login).not.toContain("gelesen und akzeptiere sie");
  });
});

// ---- Routen mit Attrappe des Supabase-Servers -------------------------------------------------
type Antwort = { exchangeFehler?: boolean; rolle?: string | null; freigeschaltet?: boolean };
let antwort: Antwort = {};
const signOut = vi.fn(async () => ({ error: null }));

function attrappe() {
  return {
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({ error: antwort.exchangeFehler ? { message: "kein Verifier" } : null })),
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
      signOut,
    },
    from: (tabelle: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tabelle === "nutzer_rollen"
                ? antwort.rolle ? { rolle: antwort.rolle } : null
                : antwort.freigeschaltet ? { user_id: "u1" } : null,
          }),
        }),
      }),
    }),
  };
}

async function routen() {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => attrappe() }));
  const callback = await import("@/app/(app)/auth/callback/route");
  const signout = await import("@/app/(app)/auth/signout/route");
  return { callback, signout };
}

const ort = (r: Response) => new URL(r.headers.get("location") ?? "", "https://www.myimmoapp.de");

describe("/auth/callback", () => {
  beforeEach(() => {
    antwort = {};
    signOut.mockClear();
  });

  it("Bestätigungslink im selben Browser: angemeldet, direkt ins Portal", async () => {
    antwort = { rolle: "mieter", freigeschaltet: true };
    const { callback } = await routen();
    const r = await callback.GET(new Request("https://www.myimmoapp.de/auth/callback?bestaetigt=1&next=%2Fportal&rolle=mieter&code=abc"));
    expect(ort(r).pathname).toBe("/portal");
  });

  it("Bestätigungslink in anderem Browser (Tausch scheitert): „bestätigt, jetzt anmelden“, kein Google-Fehler", async () => {
    antwort = { exchangeFehler: true };
    const { callback } = await routen();
    const r = await callback.GET(new Request("https://www.myimmoapp.de/auth/callback?bestaetigt=1&next=%2Fportal&rolle=mieter&code=abc"));
    expect(ort(r).pathname).toBe("/login");
    expect(ort(r).searchParams.get("bestaetigt")).toBe("1");
    expect(ort(r).searchParams.get("rolle")).toBe("mieter");
    expect(ort(r).searchParams.get("fehler")).toBeNull();
  });

  it("Google mit anderer Rolle: in den eigenen Bereich, ohne Abmelden", async () => {
    antwort = { rolle: "mieter", freigeschaltet: true };
    const { callback } = await routen();
    const r = await callback.GET(new Request("https://www.myimmoapp.de/auth/callback?rolle=vermieter&code=abc"));
    expect(ort(r).pathname).toBe("/portal");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("Google ohne Code bleibt ein Google-Fehler", async () => {
    const { callback } = await routen();
    const r = await callback.GET(new Request("https://www.myimmoapp.de/auth/callback?rolle=vermieter"));
    expect(ort(r).searchParams.get("fehler")).toBe("google");
  });
});

describe("/auth/signout", () => {
  it("Mieter-Portal → Anmeldung mit Rolle Mieter; ohne Rolle → schlicht", async () => {
    const { signout } = await routen();
    const fd = new FormData();
    fd.set("rolle", "mieter");
    const r = await signout.POST(new Request("https://www.myimmoapp.de/auth/signout", { method: "POST", body: fd }));
    expect(r.status).toBe(303);
    expect(`${ort(r).pathname}${ort(r).search}`).toBe("/login?rolle=mieter");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    const leer = await signout.POST(new Request("https://www.myimmoapp.de/auth/signout", { method: "POST" }));
    expect(`${ort(leer).pathname}${ort(leer).search}`).toBe("/login");
  });
});
