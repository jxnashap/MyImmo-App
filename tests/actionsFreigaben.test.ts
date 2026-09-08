import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// Zwei Dateien, in denen es um FREMDZUGRIFF geht:
//
//   · lib/actions/beleihungPublic.ts — neben `bewerbenPublic.ts` die zweite
//     Server-Action OHNE Login. Eine Bank antwortet über einen Freigabe-Link.
//     Token-, Ablauf- und Mengenprüfung sitzen in der SECURITY-DEFINER-RPC;
//     die Action davor ist Spam-Bremse und Eingabesieb.
//   · lib/actions/archivFreigabe.ts — der Vermieter gibt Archiv-Dokumente und
//     Belege fürs Mieterportal frei (§ 556 Abs. 4 BGB Belegeinsicht).
//
// KEIN FUND in beiden Dateien. `archivFreigabe.ts` benutzt sogar das beste
// Muster der Codebasis: `.update().select().maybeSingle()` mit `error || !data`
// — damit fällt auch das RLS-Treffer-Null auf, das sonst wie Erfolg aussieht.

let ipZaehler = 0;
const frischeIp = () => `198.51.100.${++ipZaehler % 250}`;

// Die IP wird beim AUFRUF gelesen, nicht beim Import — so lässt sie sich in
// einem Test wechseln, ohne das Modul (und damit seine Limiter-Map) neu zu laden.
let aktuelleIp = "unbekannt";
function mockeHeaders(ip: string) {
  aktuelleIp = ip;
  vi.doMock("next/headers", () => ({
    headers: async () => new Map([["x-forwarded-for", aktuelleIp]]) as never,
  }));
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

const TOKEN = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("Bank-Rückmeldung ohne Login", () => {
  async function lade(rpc: unknown = true, ip = frischeIp(), extra: Parameters<typeof fakeSupabase>[0] = {}) {
    vi.resetModules();
    mockeHeaders(ip);
    const { db, client } = fakeSupabase({ rpc: { beleihung_public_rueckmeldung: rpc }, ...extra });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/beleihungPublic");
    return { db, mod };
  }

  const gueltig = () => fd({ name: "Frau Meier", nachricht: "Bitte noch den Grundbuchauszug.", bank: "Sparkasse" });

  it("ein Token in falschem Format wird abgewiesen — ohne Datenbankzugriff", async () => {
    const { db, mod } = await lade();
    for (const t of ["", "abc", "'; drop table--", TOKEN + "x"]) {
      const r = await mod.sendeBankRueckmeldung(t, gueltig());
      expect(r.ok, t).toBe(false);
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("Name und Nachricht sind Pflicht", async () => {
    const { db, mod } = await lade();
    expect((await mod.sendeBankRueckmeldung(TOKEN, fd({ name: "X" }))).ok).toBe(false);
    expect((await mod.sendeBankRueckmeldung(TOKEN, fd({ nachricht: "X" }))).ok).toBe(false);
    expect((await mod.sendeBankRueckmeldung(TOKEN, fd({ name: "  ", nachricht: "  " }))).ok).toBe(false);
    expect(db.zugriffe).toEqual([]);
  });

  it("die Rückmeldung geht mit Token und Feldern an die RPC", async () => {
    const { db, mod } = await lade();
    const r = await mod.sendeBankRueckmeldung(TOKEN, gueltig());
    expect(r).toEqual({ ok: true });
    expect(db.zugriffe.map((z) => z.tabelle)).toEqual(["rpc:beleihung_public_rueckmeldung"]);
  });

  it("die Liste fehlender Unterlagen wird auf 30 Einträge gekappt", async () => {
    // Die Kappung der ZEICHEN je Eintrag (100) und je Feld (200/300/4000)
    // sitzt in der RPC — hier nur die Zahl der Zeilen.
    const { client } = fakeSupabase();
    const gesehen: unknown[] = [];
    client.rpc = async (_n: string, args?: unknown) => {
      gesehen.push(args);
      return { data: true, error: null };
    };
    mockeHeaders(frischeIp());
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/beleihungPublic");
    const fehlend = Array.from({ length: 50 }, (_, i) => `Unterlage ${i}`).join("\n") + "\n\n   \n";
    await mod.sendeBankRueckmeldung(TOKEN, fd({ name: "A", nachricht: "B", fehlend }));
    const args = gesehen[0] as { p_fehlend: string[]; p_token: string };
    expect(args.p_token).toBe(TOKEN);
    expect(args.p_fehlend).toHaveLength(30);
    expect(args.p_fehlend[0]).toBe("Unterlage 0");
  });

  it("ein abgelaufener oder widerrufener Link wird als solcher gemeldet", async () => {
    // Die RPC antwortet `false`, ohne zu verraten, ob der Link je existiert
    // hat — die Meldung hier ebenso wenig.
    const { mod } = await lade(false);
    const r = await mod.sendeBankRueckmeldung(TOKEN, gueltig());
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/abgelaufen|widerrufen/);
  });

  it("ein Datenbankfehler verrät nichts über die Ursache", async () => {
    const { mod } = await lade(true, frischeIp(), { fehler: { message: "Zu viele Rückmeldungen — relation beleihung_rueckmeldungen" } });
    const r = await mod.sendeBankRueckmeldung(TOKEN, gueltig());
    expect(r.ok).toBe(false);
    expect(r.fehler).not.toContain("relation");
  });

  it("nach fünf Rückmeldungen von einer IP ist zehn Minuten Schluss", async () => {
    const ip = frischeIp();
    const { db, mod } = await lade(true, ip);
    for (let i = 0; i < 5; i++) expect((await mod.sendeBankRueckmeldung(TOKEN, gueltig())).ok).toBe(true);
    const r = await mod.sendeBankRueckmeldung(TOKEN, gueltig());
    expect(r.ok).toBe(false);
    expect(r.fehler).toMatch(/Zu viele/);
    expect(db.zugriffe).toHaveLength(5);
  });

  it("die Bremse greift VOR der Token-Prüfung — auch Fehlversuche zählen", async () => {
    // Sonst ließe sich der Token-Raum kostenlos abtasten.
    const ip = frischeIp();
    const { db, mod } = await lade(true, ip);
    for (let i = 0; i < 5; i++) await mod.sendeBankRueckmeldung("kaputt", gueltig());
    const r = await mod.sendeBankRueckmeldung(TOKEN, gueltig());
    expect(r.fehler).toMatch(/Zu viele/);
    expect(db.zugriffe).toEqual([]);
  });

  it("eine andere IP ist davon nicht betroffen", async () => {
    const gesperrt = frischeIp();
    const { mod } = await lade(true, gesperrt);
    for (let i = 0; i < 6; i++) await mod.sendeBankRueckmeldung(TOKEN, gueltig());
    // Gleiches Modul (gleiche Map), andere IP.
    aktuelleIp = frischeIp();
    expect((await mod.sendeBankRueckmeldung(TOKEN, gueltig())).ok).toBe(true);
  });
});

describe("Freigaben fürs Mieterportal", () => {
  async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    const spuren = mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/archivFreigabe");
    return { db, spuren, mod };
  }

  it("ein Archiv-Dokument wird nur am eigenen Konto umgestellt", async () => {
    const { db, spuren, mod } = await lade({ antworten: { notizen: { mieter_id: "m1" } } });
    const r = await mod.setzeMieterFreigabe("n1", true);
    expect(r).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "notizen")!;
    expect(z.op).toBe("update");
    expect(z.daten).toEqual({ mieter_freigabe: true });
    expect(z.filter).toContain("eq:id=n1");
    expect(z.filter).toContain("eq:user_id=nutzer-1");
    // Die Mieterseite wird neu geladen — sonst sähe der Vermieter dort den alten Stand.
    expect(spuren.revalidiert).toContain("/tenants/m1");
    expect(spuren.revalidiert).toContain("/portal");
  });

  it("trifft das Update keine Zeile, gilt das als Fehler — nicht als Erfolg", async () => {
    // DAS ist das Muster, das den RLS-Treffer-Null sichtbar macht: Ein
    // fremdes oder gelöschtes Dokument liefert kein `data`, obwohl kein
    // `error` kommt.
    const { mod } = await lade({ antworten: { notizen: null } });
    expect(await mod.setzeMieterFreigabe("fremd", true)).toEqual({ error: "Freigabe konnte nicht geändert werden." });
    const { mod: mod2 } = await lade({ antworten: { kosten: null } });
    expect(await mod2.setzeBelegFreigabe("fremd", true)).toEqual({ error: "Freigabe konnte nicht geändert werden." });
  });

  it("ein Beleg wird ebenso nur am eigenen Konto umgestellt — und wieder zurück", async () => {
    const { db, mod } = await lade({ antworten: { kosten: { id: "k1" } } });
    expect(await mod.setzeBelegFreigabe("k1", false)).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "kosten")!;
    expect(z.daten).toEqual({ mieter_freigabe: false });
    expect(z.filter).toContain("eq:user_id=nutzer-1");
  });

  it("ein Datenbankfehler wird gemeldet", async () => {
    const { mod } = await lade({ antworten: { notizen: { mieter_id: "m1" } }, fehler: { message: "boom" } });
    expect(await mod.setzeMieterFreigabe("n1", true)).toEqual({ error: "Freigabe konnte nicht geändert werden." });
  });
});
