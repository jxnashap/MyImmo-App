import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/freischaltung.ts — Zugangscode, Einladungscodes, Vormerkung.
//
// WARUM DIESE DATEI TESTS VERDIENT
// Sie ist die Zugangskontrolle der App. Und sie hat bereits zweimal versagt
// (gemeldet 31.08.2026): Das Willkommens-Gate schrieb den Beta-Code vor der
// Prüfung gross, obwohl der Vergleich exakt ist — derselbe Code, der bei der
// Registrierung ging, war hier zwangsläufig falsch. Und der Code wurde nur
// geprüft, nie vorgemerkt, weshalb überhaupt ein zweites Mal gefragt wurde.
//
// `tests/registrierung.test.ts` prüft das seither — aber per `readFileSync`
// und Zeichenkettensuche. Das hält die SCHREIBWEISE fest, nicht das Verhalten:
// Der Test bliebe grün, wenn jemand die Prüfung darunter umbaut. Hier wird die
// Action ausgeführt.

const ALT = { beta: process.env.BETA_CODE, pub: process.env.NEXT_PUBLIC_BETA_CODE };

beforeEach(() => {
  vi.resetModules();
  delete process.env.BETA_CODE;
  delete process.env.NEXT_PUBLIC_BETA_CODE;
});
afterEach(() => {
  if (ALT.beta === undefined) delete process.env.BETA_CODE;
  else process.env.BETA_CODE = ALT.beta;
  if (ALT.pub === undefined) delete process.env.NEXT_PUBLIC_BETA_CODE;
  else process.env.NEXT_PUBLIC_BETA_CODE = ALT.pub;
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/net/bremse"]) {
    vi.doUnmock(m);
  }
});

/** Die Zugriffsbremse braucht `next/headers`; hier durch eine Attrappe ersetzt. */
function mockeBremse(durchlassen = true) {
  vi.doMock("@/lib/net/bremse", () => ({
    darfWeiter: async () => durchlassen,
    ZU_VIELE: "Zu viele Versuche. Bitte später erneut probieren.",
  }));
}

async function lade(init = {}, bremseDurchlassen = true) {
  mockeBremse(bremseDurchlassen);
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/freischaltung");
  return { db, mod };
}

// Ein Code mit genau den Eigenschaften, die den Fehler von 2026 ausgelöst
// haben: Klein- UND Grossbuchstaben, Ziffern, Sonderzeichen.
const CODE = "myImmo-2026!x";

describe("Der Beta-Zugangscode wird exakt verglichen", () => {
  it("der richtige Code wird angenommen", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade();
    expect((await mod.pruefeBetaCode(CODE)).ok).toBe(true);
  });

  it("Grossschreibung macht den Code UNGÜLTIG — genau der Fehler von 2026", async () => {
    // Dieser Test ist der Grund, warum das Gate den Code unverändert
    // weiterreichen muss. Er belegt, dass `toUpperCase()` ihn zerstört.
    process.env.BETA_CODE = CODE;
    const { mod } = await lade();
    expect((await mod.pruefeBetaCode(CODE.toUpperCase())).ok).toBe(false);
  });

  it("umgebende Leerzeichen werden verziehen (Kopieren aus einer E-Mail)", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade();
    expect((await mod.pruefeBetaCode(`  ${CODE}\n`)).ok).toBe(true);
  });

  it("ein leerer Code ist nie gültig — auch nicht bei leerer Env", async () => {
    // Ohne diese Eigenschaft wäre eine vergessene Env eine offene Tür:
    // "" === "" hätte jeden durchgelassen.
    const { mod } = await lade();
    const r = await mod.pruefeBetaCode("");
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain("nicht freigeschaltet");
  });

  it("BETA_CODE hat Vorrang vor der öffentlichen Variante", async () => {
    // NEXT_PUBLIC_* landet im ausgelieferten JavaScript. Der server-only Wert
    // muss gewinnen, sonst nützt das Umstellen nichts.
    process.env.BETA_CODE = "server-geheim";
    process.env.NEXT_PUBLIC_BETA_CODE = "oeffentlich";
    const { mod } = await lade();
    expect((await mod.pruefeBetaCode("server-geheim")).ok).toBe(true);
    expect((await mod.pruefeBetaCode("oeffentlich")).ok).toBe(false);
  });

  it("die Fehlermeldung verrät den erwarteten Code nicht", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade();
    const r = await mod.pruefeBetaCode("falsch");
    expect(r.fehler).not.toContain(CODE);
  });

  it("greift die Bremse, wird abgewiesen — ohne den Code überhaupt zu prüfen", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade({}, false);
    const r = await mod.pruefeBetaCode(CODE); // der RICHTIGE Code
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain("Zu viele Versuche");
  });
});

describe("Das Willkommens-Gate: zwei Code-Arten, zwei Schreibweisen", () => {
  it("der Beta-Code wird UNVERÄNDERT geprüft und schaltet frei", async () => {
    process.env.BETA_CODE = CODE;
    const { db, mod } = await lade();
    const r = await mod.schalteKontoFrei(fd({ code: CODE, consent: "on" }));
    expect(r.ok).toBe(true);
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:konto_freischalten")).toBe(true);
  });

  it("ein Einladungscode wird grossgeschrieben eingelöst (MI-XXXX-XXXX)", async () => {
    // Hier ist Grossschreibung richtig: Einladungscodes sind immer gross,
    // ein auf dem Handy getipptes "mi-abcd-2345" soll trotzdem gehen.
    const { db, mod } = await lade({ rpc: { einladungscode_einloesen: { ok: true, rolle: "mieter" } } });
    const r = await mod.schalteKontoFrei(fd({ code: "mi-abcd-2345", consent: "on" }));
    expect(r.ok).toBe(true);
    expect(r.rolle).toBe("mieter");
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:einladungscode_einloesen")).toBe(true);
  });

  it("ohne Zustimmung passiert NICHTS — auch mit richtigem Code", async () => {
    process.env.BETA_CODE = CODE;
    const { db, mod } = await lade();
    const r = await mod.schalteKontoFrei(fd({ code: CODE }));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain("AGB");
    // Der eigentliche Punkt: keine Freischaltung ohne dokumentierte Zustimmung.
    expect(db.zugriffe.some((z) => z.tabelle.startsWith("rpc:"))).toBe(false);
  });

  it("passt weder Beta- noch Einladungscode, nennt die Meldung beide Wege", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade({ rpc: { einladungscode_einloesen: { ok: false } } });
    const r = await mod.schalteKontoFrei(fd({ code: "quatsch", consent: "on" }));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain("Zugangscode");
    expect(r.fehler).toContain("Vermieter");
  });

  it("die Bremse greift auch hier — sonst wäre das ein zweiter Rate-Weg", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade({}, false);
    expect((await mod.schalteKontoFrei(fd({ code: CODE, consent: "on" }))).fehler).toContain("Zu viele");
  });
});

describe("Registrierung vormerken: Prüfung und Vormerkung bleiben zusammen", () => {
  it("falscher Code → keine Vormerkung", async () => {
    process.env.BETA_CODE = CODE;
    const { db, mod } = await lade();
    const r = await mod.bereiteRegistrierungVor("falsch", "a@b.de", true);
    expect(r.ok).toBe(false);
    expect(db.zugriffe.some((z) => z.tabelle === "registrierung_freigaben")).toBe(false);
  });

  it("richtiger Code ohne Zustimmung → keine Vormerkung", async () => {
    process.env.BETA_CODE = CODE;
    const { db, mod } = await lade();
    expect((await mod.bereiteRegistrierungVor(CODE, "a@b.de", false)).ok).toBe(false);
    expect(db.zugriffe.some((z) => z.tabelle === "registrierung_freigaben")).toBe(false);
  });

  it("richtiger Code + Zustimmung → Vormerkung mit normalisierter Adresse", async () => {
    process.env.BETA_CODE = CODE;
    const { db, mod } = await lade();
    const r = await mod.bereiteRegistrierungVor(CODE, "  Max.Muster@Example.DE ", true);
    expect(r).toEqual({ ok: true, vorgemerkt: true });
    const zeile = db.zugriffe.find((z) => z.tabelle === "registrierung_freigaben");
    // Kleinschreibung ist hier Pflicht: Beim Einlösen wird über die Adresse
    // gesucht, und Supabase liefert die E-Mail kleingeschrieben.
    expect(zeile?.daten?.email).toBe("max.muster@example.de");
    expect(zeile?.daten?.consent).toBe(true);
  });

  it("fehlt der Service-Role-Key, bricht die Registrierung NICHT ab", async () => {
    // Bewusste Entscheidung: Ein funktionierender Rückfallweg über /willkommen
    // ist besser als eine abgebrochene Anmeldung.
    process.env.BETA_CODE = CODE;
    mockeBremse();
    const { client } = fakeSupabase();
    vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
    vi.doMock("next/navigation", () => ({ redirect: () => {} }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => client }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
    const mod = await import("@/lib/actions/freischaltung");
    expect(await mod.bereiteRegistrierungVor(CODE, "a@b.de", true)).toEqual({ ok: true, vorgemerkt: false });
  });

  it("scheitert das Vormerken, bleibt die Registrierung trotzdem möglich", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade({ fehler: { message: "kein Netz" } });
    expect(await mod.bereiteRegistrierungVor(CODE, "a@b.de", true)).toEqual({ ok: true, vorgemerkt: false });
  });

  it("leere E-Mail wird abgelehnt", async () => {
    process.env.BETA_CODE = CODE;
    const { mod } = await lade();
    expect((await mod.bereiteRegistrierungVor(CODE, "   ", true)).ok).toBe(false);
  });
});
