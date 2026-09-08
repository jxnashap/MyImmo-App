import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// Fünfter Durchgang, Teil 2: der Newsletter (Double-Opt-in, DSGVO Art. 7).
// Drei öffentliche Routen mit Service-Role — Anmelden, Bestätigen, Abmelden.
//
// FUNDE
//   · Anmelden: Die Prüfung „schon bestätigt?" las fail-open. Bei einem
//     Abfragefehler ging genau die Mail raus, die der Block verhindern soll.
//   · Anmelden: Wer sich ABGEMELDET hatte, konnte sich NIE wieder anmelden —
//     die Prüfung sah nur `bestaetigt_am` und schickte ihn mit „schon dabei"
//     weg. Der Upsert-Zweig `abgemeldet_am: null` („eine frühere Abmeldung wird
//     aufgehoben") wurde nie erreicht.
//   · Abmelden: Das Ergebnis von Brevo wurde ignoriert. Schlug die Abmeldung
//     dort fehl, stand die Adresse lokal als abgemeldet — und bekam trotzdem
//     Post. Der Kommentar direkt darüber warnt vor genau dieser Reihenfolge.

const ENV = { ...process.env };
let mails: unknown[] = [];
let brevo = { eintragen: true, abmelden: true };

beforeEach(() => {
  vi.resetModules();
  mails = [];
  brevo = { eintragen: true, abmelden: true };
});
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
  for (const m of [
    "next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin",
    "@/lib/mail/brevo", "@/lib/net/bremse", "@/lib/net/basisUrl",
  ]) vi.doUnmock(m);
});

async function lade(pfad: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  vi.doMock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "203.0.113.9"]]) as never }));
  vi.doMock("@/lib/net/bremse", () => ({ darfWeiter: async () => true, besucherIp: async () => "203.0.113.9" }));
  vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://www.myimmoapp.de" }));
  vi.doMock("@/lib/mail/brevo", () => ({
    brevoBereit: () => true,
    sendeMail: async (m: unknown) => { mails.push(m); return true; },
    kontaktEintragen: async () => brevo.eintragen,
    kontaktAbmelden: async () => brevo.abmelden,
  }));
  const mod = await import(pfad);
  return { db, mod };
}

type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const zugriff = (db: Db, op: string) => db.zugriffe.find((z) => z.tabelle === "newsletter_anmeldungen" && z.op === op);
const post = (body: unknown) => new Request("https://x/api/newsletter", { method: "POST", body: JSON.stringify(body) });

describe("Anmelden", () => {
  it("ungültige Adressen enden mit 400, ohne Datenbankzugriff", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/route");
    for (const email of ["", "keine", "a@b", 5]) {
      expect((await mod.POST(post({ email }))).status, String(email)).toBe(400);
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("eine neue Adresse wird vorgemerkt und bekommt die Bestätigungsmail — nicht den Verteiler", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/route", { antworten: { newsletter_anmeldungen: null } });
    const r = await mod.POST(post({ email: "Neu@Example.org", quelle: "vorlagen" }));
    expect(await r.json()).toEqual({ ok: true });
    const u = zugriff(db, "upsert")!.daten!;
    expect(u.email).toBe("neu@example.org");
    expect(u.abgemeldet_am).toBeNull();
    expect(u).not.toHaveProperty("bestaetigt_am");
    expect(String(u.token_hash)).not.toBe("");
    expect(mails).toHaveLength(1);
  });

  it("eine bestätigte Adresse bekommt KEINE weitere Mail", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/route", {
      antworten: { newsletter_anmeldungen: { id: "n1", bestaetigt_am: "2026-01-01", abgemeldet_am: null } },
    });
    expect(await (await mod.POST(post({ email: "a@b.de" }))).json()).toEqual({ ok: true, schon: true });
    expect(zugriff(db, "upsert")).toBeUndefined();
    expect(mails).toEqual([]);
  });

  it("wer sich abgemeldet hat, darf sich NEU anmelden", async () => {
    // DER FUND. Vorher: „schon dabei" — für immer.
    const { db, mod } = await lade("@/app/api/newsletter/route", {
      antworten: { newsletter_anmeldungen: { id: "n1", bestaetigt_am: "2026-01-01", abgemeldet_am: "2026-05-01" } },
    });
    expect(await (await mod.POST(post({ email: "a@b.de" }))).json()).toEqual({ ok: true });
    expect(zugriff(db, "upsert")!.daten!.abgemeldet_am).toBeNull();
    expect(mails).toHaveLength(1);
  });

  it("scheitert die Prüfung, geht KEINE Mail raus", async () => {
    // DER FUND. Vorher: leer = „unbekannt" → Mail an einen Bestandsabonnenten.
    const { db, mod } = await lade("@/app/api/newsletter/route", { fehlerBei: { "newsletter_anmeldungen:select": { message: "boom" } } });
    const r = await mod.POST(post({ email: "a@b.de" }));
    expect(r.status).toBe(500);
    expect(zugriff(db, "upsert")).toBeUndefined();
    expect(mails).toEqual([]);
  });

  it("kann die Mail nicht zugestellt werden, wird das gesagt (502) statt Erfolg gemeldet", async () => {
    const { mod } = await lade("@/app/api/newsletter/route", { antworten: { newsletter_anmeldungen: null } });
    vi.doMock("@/lib/mail/brevo", () => ({ brevoBereit: () => true, sendeMail: async () => false, kontaktEintragen: async () => true, kontaktAbmelden: async () => true }));
    vi.resetModules();
    const { mod: mod2 } = await (async () => {
      const { client } = fakeSupabase({ antworten: { newsletter_anmeldungen: null } });
      mockeNextUndSupabase(client);
      vi.doMock("next/headers", () => ({ headers: async () => new Map() as never }));
      vi.doMock("@/lib/net/bremse", () => ({ darfWeiter: async () => true, besucherIp: async () => "x" }));
      vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://x" }));
      return { mod: await import("@/app/api/newsletter/route") };
    })();
    void mod;
    expect((await mod2.POST(post({ email: "a@b.de" }))).status).toBe(502);
  });
});

describe("Bestätigen", () => {
  const ZEILE = { id: "n1", email: "a@b.de", token_ablauf: "2999-01-01T00:00:00Z", bestaetigt_am: null };
  const get = (token = "tok") => new Request(`https://x/api/newsletter/bestaetigen?token=${token}`);
  const ziel = (r: Response) => new URL(r.headers.get("location")!).searchParams.get("nl");

  it("ohne Token oder mit unbekanntem Token: Fehlerseite, nichts geschrieben", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/bestaetigen/route", { antworten: { newsletter_anmeldungen: null } });
    expect(ziel(await mod.GET(new Request("https://x/api/newsletter/bestaetigen")))).toBe("fehler");
    expect(ziel(await mod.GET(get("falsch")))).toBe("fehler");
    expect(zugriff(db, "update")).toBeUndefined();
  });

  it("ein gültiger Klick bestätigt, verbraucht den Token und legt den Abmelde-Schlüssel an", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/bestaetigen/route", { antworten: { newsletter_anmeldungen: ZEILE } });
    expect(ziel(await mod.GET(get()))).toBe("ok");
    const u = zugriff(db, "update")!.daten!;
    expect(u.bestaetigt_am).toBeTruthy();
    expect(u.brevo_synchron_am).toBeTruthy();
    expect(u.abmelde_token_hash).toBeTruthy();
    // Der alte Token darf nicht weiter gelten: Der gespeicherte Hash muss ein
    // ANDERER sein als der des eben benutzten Tokens. (Erster Entwurf verglich
    // mit dem Klartext „tok" — der steht nie in der Spalte, die Zusicherung
    // blieb bei der Mutation „Token nicht verbraucht" grün.)
    const { tokenHash } = await import("@/lib/newsletterToken");
    expect(String(u.token_hash)).not.toBe(tokenHash("tok"));
  });

  it("nimmt Brevo den Kontakt nicht an, bleibt das erkennbar (brevo_synchron_am null)", async () => {
    brevo.eintragen = false;
    const { db, mod } = await lade("@/app/api/newsletter/bestaetigen/route", { antworten: { newsletter_anmeldungen: ZEILE } });
    expect(ziel(await mod.GET(get()))).toBe("ok");
    expect(zugriff(db, "update")!.daten!.brevo_synchron_am).toBeNull();
  });

  it("ein abgelaufener Token wird gemeldet; ein zweiter Klick ist kein Fehler", async () => {
    const { mod } = await lade("@/app/api/newsletter/bestaetigen/route", { antworten: { newsletter_anmeldungen: { ...ZEILE, token_ablauf: "2000-01-01T00:00:00Z" } } });
    expect(ziel(await mod.GET(get()))).toBe("abgelaufen");
    const { db, mod: mod2 } = await lade("@/app/api/newsletter/bestaetigen/route", { antworten: { newsletter_anmeldungen: { ...ZEILE, bestaetigt_am: "2026-01-01" } } });
    expect(ziel(await mod2.GET(get()))).toBe("ok");
    expect(zugriff(db, "update")).toBeUndefined();
  });
});

describe("Abmelden", () => {
  const ZEILE = { id: "n1", email: "a@b.de", abgemeldet_am: null };
  const get = () => new Request("https://x/api/newsletter/abmelden?token=tok");
  const ziel = (r: Response) => new URL(r.headers.get("location")!).searchParams.get("nl");

  it("ein gültiger Schlüssel meldet bei Brevo ab und vermerkt es lokal", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/abmelden/route", { antworten: { newsletter_anmeldungen: ZEILE } });
    expect(ziel(await mod.GET(get()))).toBe("abgemeldet");
    expect(zugriff(db, "update")!.daten!.abgemeldet_am).toBeTruthy();
  });

  it("schlägt Brevo fehl, wird NICHT lokal abgemeldet — sonst bekäme die Adresse trotzdem Post", async () => {
    // DER FUND.
    brevo.abmelden = false;
    const { db, mod } = await lade("@/app/api/newsletter/abmelden/route", { antworten: { newsletter_anmeldungen: ZEILE } });
    expect(ziel(await mod.GET(get()))).toBe("fehler");
    expect(zugriff(db, "update")).toBeUndefined();
  });

  it("ein zweiter Klick ist derselbe Erfolg", async () => {
    const { db, mod } = await lade("@/app/api/newsletter/abmelden/route", { antworten: { newsletter_anmeldungen: { ...ZEILE, abgemeldet_am: "2026-05-01" } } });
    expect(ziel(await mod.GET(get()))).toBe("abgemeldet");
    expect(zugriff(db, "update")).toBeUndefined();
  });
});
