import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// E-Mail-Benachrichtigungen (02.10.2026, Schritt 3 des Mieterportal-Plans).
// Grundsatz: Die Mail sagt nur, DASS etwas bereitliegt — nie WAS. Adresse aus dem
// Auth-Konto, nie vom Aufrufer. Beste Mühe: Sie lässt keine Handlung scheitern.

const MODULE = ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/mail/brevo", "@/lib/net/bremse", "@/lib/net/basisUrl", "@/lib/benachrichtigung"];
beforeEach(() => vi.resetModules());
afterEach(() => { for (const m of MODULE) vi.doUnmock(m); });

describe("die Mail selbst", () => {
  it("nennt keinen Inhalt, verlinkt den richtigen Bereich und sagt, wie man abschaltet", async () => {
    const { benachrichtigungsMail } = await import("@/lib/benachrichtigung");
    const m = benachrichtigungsMail("dokument", "https://www.myimmoapp.de");
    expect(m.text).toContain("https://www.myimmoapp.de/portal");
    expect(m.html).toContain('href="https://www.myimmoapp.de/portal"');
    expect(m.text).toContain("nur im Portal, nicht in dieser E-Mail");
    expect(m.text).toContain("Konto → Benachrichtigungen");
    const v = benachrichtigungsMail("anliegen_neu", "https://www.myimmoapp.de");
    expect(v.text).toContain("https://www.myimmoapp.de/anliegen");
    expect(v.text).toContain("Einstellungen → Sicherheit → Benachrichtigungen");
  });
  it("die Signatur nimmt keinen Titel, keinen Text, keinen Namen entgegen", async () => {
    const { benachrichtigungsMail } = await import("@/lib/benachrichtigung");
    expect(benachrichtigungsMail.length).toBe(2); // (art, basis) — mehr gibt es nicht
  });
});

describe("benachrichtige()", () => {
  type Lage = { bereit?: boolean; user?: Record<string, unknown> | null; fehler?: boolean; bremse?: boolean; senden?: boolean | Error };
  async function lade(l: Lage = {}) {
    vi.resetModules();
    const gesendet: { an: string; betreff: string; text: string }[] = [];
    const gefragt: string[] = [];
    vi.doMock("@/lib/mail/brevo", () => ({
      brevoBereit: () => l.bereit ?? true,
      sendeMail: async (m: { an: string; betreff: string; text: string }) => {
        if (l.senden instanceof Error) throw l.senden;
        gesendet.push(m); return l.senden ?? true;
      },
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ auth: { admin: { getUserById: async (id: string) => {
        gefragt.push(id);
        // Auch wenn bei einem Fehler Daten mitkommen: Fehler heißt keine Mail.
        return l.fehler ? { data: { user: { email: "anna@example.org", user_metadata: {} } }, error: { message: "x" } } : { data: { user: l.user === undefined ? { email: "anna@example.org", user_metadata: {} } : l.user }, error: null };
      } } } }),
    }));
    const bremse: string[] = [];
    vi.doMock("@/lib/net/bremse", () => ({ darfWeiter: async (_a: string, _m: number, _s: number, k: string) => { bremse.push(k); return l.bremse ?? true; } }));
    vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://www.myimmoapp.de" }));
    const mod = await import("@/lib/benachrichtigung");
    return { mod, gesendet, gefragt, bremse };
  }

  it("sendet an die Adresse des KONTOS", async () => {
    const { mod, gesendet, gefragt, bremse } = await lade();
    expect(await mod.benachrichtige("konto-a", "dokument", "n1")).toBe("gesendet");
    expect(gefragt).toEqual(["konto-a"]);
    expect(gesendet.map((g) => g.an)).toEqual(["anna@example.org"]);
    expect(bremse).toEqual(["konto-a:dokument:n1"]);
  });
  it("ohne Brevo, ohne Konto, abbestellt, Demo, gebremst: keine Mail", async () => {
    const faelle: [Lage, string][] = [
      [{ bereit: false }, "kein_versand"],
      [{ fehler: true }, "kein_konto"],
      [{ user: { email: null } }, "kein_konto"],
      [{ user: { email: "anna@example.org", user_metadata: { benachrichtigungen_aus: true } } }, "abbestellt"],
      [{ user: { email: "demo.mieter@myimmo.test", user_metadata: {} } }, "demo"],
      [{ bremse: false }, "gebremst"],
    ];
    for (const [lage, erwartet] of faelle) {
      const { mod, gesendet } = await lade(lage);
      expect(await mod.benachrichtige("konto-a", "dokument", "n1"), erwartet).toBe(erwartet);
      expect(gesendet, erwartet).toEqual([]);
    }
  });
  it("ohne Empfänger-ID: nicht einmal nachgefragt", async () => {
    const { mod, gefragt } = await lade();
    expect(await mod.benachrichtige(null, "termine", "a1")).toBe("kein_konto");
    expect(gefragt).toEqual([]);
  });
  it("ein Versandfehler wirft nicht — die Handlung davor bleibt gültig", async () => {
    const still = vi.spyOn(console, "error").mockImplementation(() => {});
    const { mod } = await lade({ senden: new Error("Brevo down") });
    expect(await mod.benachrichtige("konto-a", "dokument", "n1")).toBe("fehler");
    const { mod: m2 } = await lade({ senden: false });
    expect(await m2.benachrichtige("konto-a", "dokument", "n1")).toBe("fehler");
    still.mockRestore();
  });
});

describe("wer wann benachrichtigt wird", () => {
  async function ladeAction<T>(pfad: string, init: Parameters<typeof fakeSupabase>[0]) {
    vi.resetModules();
    const aufrufe: [string | null | undefined, string, string][] = [];
    vi.doMock("@/lib/benachrichtigung", () => ({
      benachrichtige: async (u: string | null | undefined, art: string, bezug: string) => { aufrufe.push([u, art, bezug]); return "gesendet"; },
    }));
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    const mod = (await import(pfad)) as T;
    return { mod, aufrufe, db };
  }
  type A = typeof import("@/lib/actions/anliegen");

  it("neues Anliegen → der Vermieter aus dem ZUGANG", async () => {
    const { mod, aufrufe } = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { mieter_zugaenge: { vermieter_id: "v-1", mieter_id: "m-1", prop_id: "p-1" }, anliegen: { id: "a-1" } } });
    expect((await mod.erstelleAnliegen(fd({ typ: "schaden", titel: "Heizung", vermieter_id: "fremd" }))).ok).toBe(true);
    expect(aufrufe).toEqual([["v-1", "anliegen_neu", "a-1"]]);
  });
  it("Nachricht im Verlauf → immer die GEGENSEITE", async () => {
    const m = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { id: "a-1", vermieter_id: "v-1", mieter_user_id: "nutzer-1" } } });
    await m.mod.schreibeNachricht("a-1", "Kalt");
    expect(m.aufrufe).toEqual([["v-1", "nachricht_an_vermieter", "a-1"]]);
    const v = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { id: "a-1", vermieter_id: "nutzer-1", mieter_user_id: "m-9" } } });
    await v.mod.schreibeNachricht("a-1", "Komme Montag");
    expect(v.aufrufe).toEqual([["m-9", "nachricht_an_mieter", "a-1"]]);
  });
  it("scheitert das Speichern, geht keine Mail raus", async () => {
    const { mod, aufrufe } = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { id: "a-1", vermieter_id: "v-1", mieter_user_id: "nutzer-1" } }, fehlerBei: { "anliegen_ereignisse:insert": { message: "rls" } } });
    await mod.schreibeNachricht("a-1", "Kalt");
    expect(aufrufe).toEqual([]);
  });
  it("Status ändern ohne Nachricht → keine Mail; mit Nachricht → an den Mieter", async () => {
    const ohne = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { id: "a-1", mieter_user_id: "m-9" } } });
    await ohne.mod.bearbeiteAnliegen(fd({ id: "a-1", status: "erledigt" }));
    expect(ohne.aufrufe).toEqual([]);
    const mit = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { id: "a-1", mieter_user_id: "m-9" } } });
    await mit.mod.bearbeiteAnliegen(fd({ id: "a-1", status: "erledigt", nachricht: "Erledigt." }));
    expect(mit.aufrufe).toEqual([["m-9", "nachricht_an_mieter", "a-1"]]);
  });
  it("Terminvorschläge → Mieter; Terminbestätigung → Vermieter", async () => {
    const t = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { mieter_user_id: "m-9" } } });
    await t.mod.schlageTermineVor(fd({ id: "a-1", slot1: "2026-10-05T10:00" }));
    expect(t.aufrufe).toEqual([["m-9", "termine", "a-1"]]);
    const b = await ladeAction<A>("@/lib/actions/anliegen", { antworten: { anliegen: { vermieter_id: "v-1" } } });
    await b.mod.bestaetigeAnliegenTermin("a-1", "2026-10-05T10:00");
    expect(b.aufrufe).toEqual([["v-1", "termin_bestaetigt", "a-1"]]);
  });
  it("Anfrage des Vermieters → jedes verbundene Konto dieses Mieters", async () => {
    const { mod, aufrufe, db } = await ladeAction<typeof import("@/lib/actions/vermieterAnfragen")>("@/lib/actions/vermieterAnfragen", {
      antworten: { mieter: { id: "m-1", prop_id: "p-1" }, mieter_zugaenge: [{ user_id: "k-1" }, { user_id: "k-2" }] },
    });
    expect((await mod.erstelleVermieterAnfrage(fd({ mieterId: "m-1", typ: "zaehlerstand", titel: "Zählerstand" }))).ok).toBe(true);
    expect(aufrufe).toEqual([["k-1", "anfrage", "m-1"], ["k-2", "anfrage", "m-1"]]);
    const z = db.zugriffe.find((x) => x.tabelle === "mieter_zugaenge")!;
    expect(z.filter).toEqual(expect.arrayContaining(["eq:mieter_id=m-1", "eq:vermieter_id=nutzer-1"]));
  });
  it("Dokument zugestellt → jedes Empfänger-Konto", async () => {
    const { mod, aufrufe } = await ladeAction<typeof import("@/lib/actions/zustellung")>("@/lib/actions/zustellung", {
      antworten: { notizen: { id: "n1", mieter_id: "m1", titel: "NK", datei_name: "nk.pdf" }, mieter: { mietbeginn: "2021-01-01", mietende: null }, mieter_zugaenge: [{ user_id: "k-1", email: "a@b.de" }], zustellungen: [{ id: "z" }] },
      antwortFolge: { "zustellungen:select": [[]] },
    });
    // Mail ging hinaus → nichts zu melden (P4, B43: nur Abweichungen werden genannt).
    expect(await mod.stelleDokumentZu("n1")).toEqual({ ok: true, an: ["a@b.de"], hinweis: null });
    expect(aufrufe).toEqual([["k-1", "dokument", "n1"]]);
  });
});
