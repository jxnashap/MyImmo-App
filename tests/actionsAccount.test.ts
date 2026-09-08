import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect } from "./stubs/actionHarness";

// lib/actions/account.ts (Konto löschen, DSGVO Art. 17) und
// lib/actions/billing.ts (Paddle-Checkout/-Portal, inaktiv bis BILLING_ENFORCED).
//
// FUND (08.09.2026) in account.ts: Die Abo-Abfrage vor dem Löschen wertete den
// Fehler nicht aus. Käme sie wegen eines Fehlers leer zurück, gälte „kein
// laufendes Abo" — das Konto würde gelöscht, und Paddle buchte weiter ab, ohne
// dass der Kunde noch kündigen könnte. Der Kommentar in der Datei schließt
// genau das ausdrücklich aus („kein stilles Weiterlaufen von Zahlungen"); die
// Abfrage darunter hielt sich nicht daran. Zehnte Fundstelle der vierten Klasse
// — und die erste, bei der es ums Geld des Nutzers geht, nicht um seine Daten.

type Paddle = { konfiguriert?: boolean; kuendigen?: boolean; checkout?: string | null; portal?: string | null };
let paddleAufrufe: string[] = [];

beforeEach(() => {
  vi.resetModules();
  paddleAufrufe = [];
});
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/billing/paddle"]) {
    vi.doUnmock(m);
  }
});

function mockePaddle(p: Paddle) {
  vi.doMock("@/lib/billing/paddle", () => ({
    paddleKonfiguriert: () => p.konfiguriert ?? false,
    kuendigeSubscription: async (id: string) => {
      paddleAufrufe.push(`kuendige:${id}`);
      return p.kuendigen ?? false;
    },
    erstelleCheckoutUrl: async (args: { plan: string; zyklus: string }) => {
      paddleAufrufe.push(`checkout:${args.plan}:${args.zyklus}`);
      return p.checkout ?? null;
    },
    kundenPortalUrl: async (id: string) => {
      paddleAufrufe.push(`portal:${id}`);
      return p.portal ?? null;
    },
  }));
}

async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}, paddle: Paddle = {}) {
  vi.resetModules();
  mockePaddle(paddle);
  const { db, client } = fakeSupabase(init);
  const signOut = vi.fn(async () => ({ error: null }));
  (client.auth as unknown as { signOut: unknown }).signOut = signOut;
  const spuren = mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, spuren, mod, signOut };
}

const geloescht = (db: { zugriffe: { tabelle: string }[] }) => db.zugriffe.some((z) => z.tabelle === "rpc:delete_own_account");

describe("Konto löschen", () => {
  it("ohne Abo: Konto wird gelöscht, Sitzung beendet, Umleitung zum Login", async () => {
    const { db, signOut, mod } = await lade("@/lib/actions/account", { antworten: { abos: null } });
    const ziel = await fangeRedirect(() => mod.deleteAccount());
    expect(geloescht(db)).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
    expect(ziel).toBe("/login?geloescht=1");
  });

  it("die Abo-Abfrage ist auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade("@/lib/actions/account", { antworten: { abos: null } });
    await fangeRedirect(() => mod.deleteAccount());
    expect(db.zugriffe.find((z) => z.tabelle === "abos")!.filter).toContain("eq:user_id=nutzer-1");
  });

  it("scheitert die Abo-Abfrage, wird das Konto NICHT gelöscht", async () => {
    // DER FUND. Vorher: leer = „kein Abo" → Konto weg, Paddle bucht weiter.
    const { db, signOut, mod } = await lade("@/lib/actions/account", { fehlerBei: { abos: { message: "connection reset" } } });
    const r = await mod.deleteAccount();
    expect(r).toMatchObject({ ok: false });
    expect(String((r as { fehler: string }).fehler)).toMatch(/NICHT gelöscht/);
    expect(geloescht(db)).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("ein laufendes Abo wird ZUERST gekündigt — erst dann gelöscht", async () => {
    const { db, mod } = await lade(
      "@/lib/actions/account",
      { antworten: { abos: { provider_subscription_id: "sub_1", status: "aktiv" } } },
      { konfiguriert: true, kuendigen: true },
    );
    await fangeRedirect(() => mod.deleteAccount());
    expect(paddleAufrufe).toEqual(["kuendige:sub_1"]);
    expect(geloescht(db)).toBe(true);
  });

  it("schlägt die Kündigung fehl, bleibt das Konto — mit Hinweis auf Einstellungen → Abo", async () => {
    const { db, mod } = await lade(
      "@/lib/actions/account",
      { antworten: { abos: { provider_subscription_id: "sub_1", status: "ueberfaellig" }, nutzer_rollen: { rolle: "vermieter" } } },
      { konfiguriert: true, kuendigen: false },
    );
    const r = await mod.deleteAccount();
    expect(r).toMatchObject({ ok: false });
    expect(String((r as { fehler: string }).fehler)).toMatch(/Einstellungen → Abo/);
    expect(geloescht(db)).toBe(false);
  });

  it("Mieter- und Service-Konten bekommen den Support-Hinweis statt eines Pfads, den sie nicht öffnen können", async () => {
    for (const rolle of ["mieter", "service"]) {
      const { mod } = await lade(
        "@/lib/actions/account",
        { antworten: { abos: { provider_subscription_id: "sub_1", status: "aktiv" }, nutzer_rollen: { rolle } } },
        { konfiguriert: true, kuendigen: false },
      );
      const r = await mod.deleteAccount();
      expect(String((r as { fehler: string }).fehler), rolle).toMatch(/info@myimmoapp\.de/);
      expect(String((r as { fehler: string }).fehler), rolle).not.toMatch(/Einstellungen → Abo/);
    }
  });

  it("ein beendetes Abo (gekündigt/abgelaufen) blockiert die Löschung nicht", async () => {
    for (const status of ["gekuendigt", "abgelaufen", "kostenlos"]) {
      const { db, mod } = await lade(
        "@/lib/actions/account",
        { antworten: { abos: { provider_subscription_id: "sub_1", status } } },
        { konfiguriert: true, kuendigen: false },
      );
      await fangeRedirect(() => mod.deleteAccount());
      expect(paddleAufrufe, status).toEqual([]);
      expect(geloescht(db), status).toBe(true);
    }
  });

  it("ohne Paddle-Konfiguration gilt ein laufendes Abo als nicht kündbar — Löschung wird verweigert", async () => {
    // Bewusst: Lieber ein Konto zu viel behalten als eine Abbuchung ohne Konto.
    const { db, mod } = await lade(
      "@/lib/actions/account",
      { antworten: { abos: { provider_subscription_id: "sub_1", status: "aktiv" }, nutzer_rollen: null } },
      { konfiguriert: false },
    );
    const r = await mod.deleteAccount();
    expect(r).toMatchObject({ ok: false });
    expect(geloescht(db)).toBe(false);
  });

  it("scheitert die Lösch-RPC, wird das gemeldet und die Sitzung bleibt bestehen", async () => {
    const { signOut, mod } = await lade("@/lib/actions/account", { antworten: { abos: null }, fehlerBei: { "rpc:delete_own_account": { message: "boom" } } });
    const r = await mod.deleteAccount();
    expect(r).toMatchObject({ ok: false });
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("Paddle-Checkout und -Portal", () => {
  it("ohne Paddle-Env: verständliche Meldung, kein Aufruf", async () => {
    const { mod } = await lade("@/lib/actions/billing", {}, { konfiguriert: false });
    const r = await mod.starteCheckout("plus", "monat");
    expect(r).toMatchObject({ fehler: expect.stringMatching(/Early Access/) });
    expect(paddleAufrufe).toEqual([]);
  });

  it("nur Privat/Plus und nur Monat/Jahr — alles andere wird vor dem Aufruf abgewiesen", async () => {
    const { mod } = await lade("@/lib/actions/billing", {}, { konfiguriert: true, checkout: "https://pay" });
    expect(await mod.starteCheckout("business" as never, "monat")).toMatchObject({ fehler: /Tarif/ });
    expect(await mod.starteCheckout("plus", "woche" as never)).toMatchObject({ fehler: /Abrechnungszeitraum/ });
    expect(await mod.starteCheckout("plus", "" as never)).toMatchObject({ fehler: /Abrechnungszeitraum/ });
    expect(paddleAufrufe).toEqual([]);
  });

  it("gültige Wahl liefert die Checkout-URL", async () => {
    const { mod } = await lade("@/lib/actions/billing", {}, { konfiguriert: true, checkout: "https://pay/abc" });
    expect(await mod.starteCheckout("privat", "jahr")).toEqual({ url: "https://pay/abc" });
    expect(paddleAufrufe).toEqual(["checkout:privat:jahr"]);
  });

  it("das Portal braucht eine Kunden-ID aus der Abo-Zeile", async () => {
    const { mod } = await lade("@/lib/actions/billing", { antworten: { abos: null } }, { konfiguriert: true, portal: "https://portal" });
    expect(await mod.oeffneAboPortal()).toMatchObject({ fehler: /Kein aktives Abo/ });
    const { mod: mod2 } = await lade("@/lib/actions/billing", { antworten: { abos: { provider_customer_id: "ctm_9" } } }, { konfiguriert: true, portal: "https://portal" });
    expect(await mod2.oeffneAboPortal()).toEqual({ url: "https://portal" });
    expect(paddleAufrufe).toEqual(["portal:ctm_9"]);
  });
});
