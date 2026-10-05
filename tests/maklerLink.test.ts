import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { maklerVorauswahl, maklerLinkPfad, MAKLER_CHECKLISTE, maklerMailLink, normalisiereMaklerCode, istMaklerCodeFormat } from "@/lib/makler";
import { abrufeJeLink, abrufZusammenfassung } from "@/lib/freigabeAbrufe";
import { istOeffentlicheSeite } from "@/lib/oeffentlich";

// Makler-Link + Abruf-Protokoll (05.10.2026, Migration 20261005160000).
// Der Link öffnet die heikelsten Dokumente der App (Ausweis, SCHUFA, Einkommen) für jeden, der ihn
// hat. Deshalb: frische Anmeldung, nur bekannte Punkte mit Datei, Laufzeit 7/14/30, datensparsame
// Punkte nicht vorausgewählt, Widerruf ohne Rückweg — und jeder Abruf landet im Protokoll.

beforeEach(() => vi.resetModules());
const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => { process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = KEY;
});

const FREIGABE = { token: "t-1", item_keys: ["schufa_bonitaet"], ablauf: "2026-10-19T00:00:00Z", aktiv: true, created_at: null };
const MIT_DATEI = [
  { item_key: "schufa_bonitaet", datei_name: "schufa.pdf" },
  { item_key: "ausweis", datei_name: "ausweis.pdf" },
  { item_key: "finanzierungsbestaetigung", datei_name: null },
];

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase({
    antwortFolge: { "makler_dokumente:select": [MIT_DATEI] },
    antworten: { makler_freigaben: FREIGABE },
    ...init,
  });
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/makler");
  return { db, mod };
}
const eingefuegt = (db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }) =>
  db.zugriffe.find((z) => z.tabelle === "makler_freigaben" && z.op === "insert")?.daten as Record<string, unknown> | undefined;

describe("Makler-Link erstellen", () => {
  it("nur bekannte Punkte, und nur solche mit Datei", async () => {
    const { db, mod } = await lade();
    await mod.createMaklerFreigabe(["schufa_bonitaet", "finanzierungsbestaetigung", "erfunden", "../x"], 14, "m@makler.de");
    expect(eingefuegt(db)).toMatchObject({ user_id: "nutzer-1", item_keys: ["schufa_bonitaet"] });
  });

  it("ohne gültigen Punkt kein Datenbankzugriff, ohne Datei kein Link", async () => {
    const a = await lade();
    await expect(a.mod.createMaklerFreigabe(["erfunden"], 14, "m@makler.de")).rejects.toThrow("mindestens ein Dokument");
    expect(a.db.zugriffe).toEqual([]);
    const b = await lade();
    await expect(b.mod.createMaklerFreigabe(["finanzierungsbestaetigung"], 14, "m@makler.de")).rejects.toThrow("keine Datei");
    expect(eingefuegt(b.db)).toBeUndefined();
  });

  it("nur 7, 14 oder 30 Tage — sonst 14", async () => {
    for (const [ein, soll] of [[7, 7], [30, 30], [90, 14], [0, 14]] as const) {
      const { db, mod } = await lade();
      const vorher = Date.now();
      await mod.createMaklerFreigabe(["schufa_bonitaet"], ein, "m@makler.de");
      const tage = Math.round((new Date(String(eingefuegt(db)?.ablauf)).getTime() - vorher) / 86_400_000);
      expect(tage, `Eingabe ${ein}`).toBe(soll);
    }
  });

  it("verlangt eine frische Anmeldung — vor dem Anlegen", async () => {
    const { db, mod } = await lade({ amrVorSekunden: 3 * 3600 });
    await expect(mod.createMaklerFreigabe(["schufa_bonitaet"], 14, "m@makler.de")).rejects.toThrow();
    expect(eingefuegt(db)).toBeUndefined();
  });

  it("ein Lesefehler legt keinen Link an (fail-closed)", async () => {
    const { db, mod } = await lade({ fehlerBei: { "makler_dokumente:select": { message: "kaputt" } } });
    await expect(mod.createMaklerFreigabe(["schufa_bonitaet"], 14, "m@makler.de")).rejects.toThrow("kaputt");
    expect(eingefuegt(db)).toBeUndefined();
  });
});

describe("Zugangscode und Empfänger (seit 05.10.2026)", () => {
  it("der Code kommt EINMAL zurück, gespeichert wird nur sein Hash — an den Token gebunden", async () => {
    const { db, mod } = await lade();
    const r = await mod.createMaklerFreigabe(["schufa_bonitaet"], 14, "  M@Makler.de ");
    expect(r.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const ein = eingefuegt(db)!;
    expect(ein.empfaenger_email).toBe("m@makler.de");
    expect(String(ein.code_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ein)).not.toContain(r.code.replace("-", ""));
    expect(JSON.stringify(ein)).not.toContain(r.code);
    const { maklerCodeHash } = await import("@/lib/maklerCode");
    expect(ein.code_hash).toBe(maklerCodeHash(String(ein.token), r.code));
    expect(maklerCodeHash("00000000-0000-0000-0000-000000000000", r.code)).not.toBe(ein.code_hash);
  });

  it("ohne gültige Makler-Adresse kein Link — auch nicht mit Hintertür im mailto", async () => {
    for (const a of ["", "keine-mail", "a@b.de?bcc=x@y.de", "a b@c.de"]) {
      const { db, mod } = await lade();
      await expect(mod.createMaklerFreigabe(["schufa_bonitaet"], 14, a), a).rejects.toThrow("E-Mail");
      expect(eingefuegt(db)).toBeUndefined();
    }
  });

  it("zwei Links bekommen verschiedene Codes", async () => {
    const a = await lade(); const r1 = await a.mod.createMaklerFreigabe(["schufa_bonitaet"], 14, "m@makler.de");
    const b = await lade(); const r2 = await b.mod.createMaklerFreigabe(["schufa_bonitaet"], 14, "m@makler.de");
    expect(r1.code).not.toBe(r2.code);
  });

  it("die vorbereitete Mail: Empfänger, Betreff, Link, Code, Ablauf", () => {
    const m = maklerMailLink({ an: "m@makler.de", link: "https://x/makler-link/t", code: "ABCD-EF23", ablauf: "2026-10-19T10:00:00Z" });
    expect(m.startsWith("mailto:m@makler.de?subject=")).toBe(true);
    const text = decodeURIComponent(m.slice(m.indexOf("&body=") + 6));
    expect(text).toContain("https://x/makler-link/t");
    expect(text).toContain("Zugangscode: ABCD-EF23");
    expect(text).toContain("19.10.2026");
    expect(maklerMailLink({ an: "a@b.de?bcc=x@y.de", link: "l", code: "c", ablauf: "2026-10-19" })).toMatch(/^mailto:\?subject=/);
  });

  it("Code-Eingabe ist tolerant gegenüber Schreibweise, aber nicht gegenüber Länge", () => {
    expect(normalisiereMaklerCode(" abcd-ef23 ")).toBe("ABCDEF23");
    expect(istMaklerCodeFormat("ABCDEF23")).toBe(true);
    expect(istMaklerCodeFormat("ABCDEF2")).toBe(false);
    expect(istMaklerCodeFormat("ABCDEF2O")).toBe(false); // O gibt es im Alphabet nicht
  });
});

describe("Anmeldung des Maklers", () => {
  const T = "11111111-2222-3333-4444-555555555555";
  async function ladeAnmeldung(rpcAntwort: unknown) {
    vi.resetModules();
    const gesetzt: { name: string; wert: string; opt: Record<string, unknown> }[] = [];
    vi.doMock("next/headers", () => ({ cookies: async () => ({ set: (name: string, wert: string, opt: Record<string, unknown>) => gesetzt.push({ name, wert, opt }), get: () => undefined }) }));
    const { db, client } = fakeSupabase({ rpc: { makler_public_anmelden: rpcAntwort } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/maklerLinkPublic");
    return { db, mod, gesetzt };
  }
  it("richtiger Code: Cookie mit dem Hash, nur für diesen Link, httpOnly", async () => {
    const { mod, gesetzt } = await ladeAnmeldung("ok");
    expect(await mod.meldeMaklerAn(T, "abcd-ef23")).toEqual({ ok: true });
    const { maklerCodeHash } = await import("@/lib/maklerCode");
    expect(gesetzt).toHaveLength(1);
    expect(gesetzt[0].wert).toBe(maklerCodeHash(T, "ABCDEF23"));
    expect(gesetzt[0].opt).toMatchObject({ httpOnly: true, path: `/makler-link/${T}` });
  });
  it("falscher oder gesperrter Code: kein Cookie, klare Meldung", async () => {
    for (const [antwort, text] of [["falsch", "stimmt nicht"], ["gesperrt", "Zu viele"], [null, "abgelaufen"]] as const) {
      const { mod, gesetzt } = await ladeAnmeldung(antwort);
      const r = await mod.meldeMaklerAn(T, "ABCD-EF23");
      expect("error" in r && r.error, String(antwort)).toContain(text);
      expect(gesetzt).toEqual([]);
    }
  });
  it("Unsinn erreicht die Datenbank gar nicht", async () => {
    const { db, mod } = await ladeAnmeldung("ok");
    expect("error" in (await mod.meldeMaklerAn("kein-token", "ABCD-EF23"))).toBe(true);
    expect("error" in (await mod.meldeMaklerAn(T, "123"))).toBe(true);
    expect(db.zugriffe).toEqual([]);
  });
});

describe("Makler-Link widerrufen", () => {
  it("setzt nur aktiv = false, auf den eigenen Link", async () => {
    const { db, mod } = await lade();
    await mod.widerrufeMaklerFreigabe("t-1");
    const u = db.zugriffe.find((z) => z.op === "update");
    expect(u?.daten).toEqual({ aktiv: false });
    expect(u?.filter).toEqual(expect.arrayContaining(["eq:token=t-1", "eq:user_id=nutzer-1"]));
  });
  it("trifft der Widerruf keine Zeile, ist das ein Fehler — kein falsches „widerrufen“", async () => {
    const { mod } = await lade({ antworten: { makler_freigaben: null } });
    await expect(mod.widerrufeMaklerFreigabe("fremd")).rejects.toThrow();
  });
});

describe("Vorauswahl: Ausweis, Einkommen, Eigenkapital nie automatisch", () => {
  it("vorausgewählt ist nur, was eine Datei hat und nicht datensparsam ist", () => {
    const docs = Object.fromEntries(MAKLER_CHECKLISTE.map((i) => [i.key, { datei_name: "x.pdf" }]));
    const v = maklerVorauswahl(docs);
    expect([...v].sort()).toEqual(["finanzierungsbestaetigung", "kaeufer_selbstauskunft", "schufa_bonitaet"]);
    for (const k of ["ausweis", "einkommensnachweise", "eigenkapitalnachweis"]) expect(v.has(k), k).toBe(false);
  });
  it("ohne Datei nichts vorausgewählt", () => {
    expect(maklerVorauswahl({}).size).toBe(0);
  });
});

describe("Abruf-Protokoll (Darstellung)", () => {
  const a = [
    { token: "A", item_key: "x", abgerufen_am: "2026-10-05T10:00:00Z" },
    { token: "A", item_key: "y", abgerufen_am: "2026-10-05T12:03:00Z" },
    { token: "B", item_key: "x", abgerufen_am: "2026-10-04T08:00:00Z" },
  ];
  it("je Link gruppiert, neueste zuerst", () => {
    const m = abrufeJeLink(a);
    expect(m.get("A")?.map((x) => x.item_key)).toEqual(["y", "x"]);
    expect(m.get("B")).toHaveLength(1);
  });
  it("Zusammenfassung zählt und nennt den letzten Abruf in Berliner Zeit", () => {
    expect(abrufZusammenfassung(undefined)).toBe("Noch nicht abgerufen");
    expect(abrufZusammenfassung(abrufeJeLink(a).get("A"))).toBe("2× abgerufen · zuletzt 05.10.2026, 14:03");
  });
});

describe("Öffentliche Seite und Datenbank", () => {
  const sql = readFileSync("supabase/migrations/20261005160000_makler_link_abrufprotokoll.sql", "utf8");
  const code = sql.split("\n").filter((z) => !z.trim().startsWith("--")).join("\n");

  it("die Seite ist ohne Login erreichbar, aber nur unter /makler-link/ — /makler bleibt privat", () => {
    expect(istOeffentlicheSeite(maklerLinkPfad("abc"))).toBe(true);
    expect(istOeffentlicheSeite("/makler")).toBe(false);
    expect(istOeffentlicheSeite("/makler/datei/ausweis")).toBe(false);
    expect(readFileSync("app/(app)/layout.tsx", "utf8")).toContain('"/makler-link"]');
  });

  it("die Datei-Route liest nur über die Token-Funktion und liefert über dateiKopf()", () => {
    const r = readFileSync("app/(app)/makler-link/[token]/datei/[key]/route.ts", "utf8");
    expect(r).toContain('rpc("makler_public_datei"');
    expect(r).toContain("dateiKopf(");
    expect(r).not.toMatch(/from\("makler_dokumente"\)/);
    expect(readFileSync("app/(app)/makler-link/[token]/page.tsx", "utf8")).toContain("robots: { index: false, follow: false }");
  });

  it("BEIDE Datei-Funktionen schreiben ins Protokoll — Bank und Makler", () => {
    for (const [fn, art] of [["makler_public_datei", "makler"], ["beleihung_public_datei", "bank"]]) {
      const teil = code.slice(code.indexOf(`function public.${fn}(`));
      const ende = teil.indexOf("end $$;");
      expect(teil.slice(0, ende), fn).toContain(`freigabe_abruf_merken('${art}'`);
    }
  });

  it("das Protokoll ist nicht von außen beschreibbar und speichert keine IP", () => {
    expect(code).not.toMatch(/on public\.freigabe_abrufe\s+for (insert|update|all)/);
    expect(code).toMatch(/revoke all on function public\.freigabe_abruf_merken\(text, uuid, uuid, text\) from public, anon, authenticated/);
    expect(code).not.toMatch(/\bip\b|inet/i);
    expect(code).toContain("interval '60 seconds'");
  });

  it("ein widerrufener Link lässt sich nicht wieder aktivieren, und höchstens 31 Tage", () => {
    expect(code).toMatch(/makler_freigaben_widerrufen[\s\S]*?with check \(user_id = \(select auth\.uid\(\)\) and aktiv = false\)/);
    expect(code).toContain("ablauf <= now() + interval '31 days'");
  });

  it("die Migration enthält kein Lösch-Schlüsselwort (Bestätigungsdialog); die Kontolöschung liegt getrennt", () => {
    expect(sql).not.toMatch(/\b(delete|drop)\b/i);
    const manuell = readFileSync("supabase/migrations/20261005161000_kontoloeschung_makler_link.sql", "utf8");
    expect(manuell).toContain("MANUELL IM SUPABASE-SQL-EDITOR");
    expect(manuell).toMatch(/delete from public\.freigabe_abrufe\s+where user_id = uid/);
    expect(manuell).toMatch(/delete from public\.makler_freigaben\s+where user_id = uid/);
  });

  it("Code-Pflicht in der Datenbank: alte Funktionen ohne Code stillgelegt, neue verlangen den Hash", () => {
    const neu = readFileSync("supabase/migrations/20261005170000_makler_link_code.sql", "utf8");
    const c = neu.split("\n").filter((z) => !z.trim().startsWith("--")).join("\n");
    expect(neu).not.toMatch(/\b(delete|drop)\b/i);
    expect(c).toMatch(/revoke all on function public\.makler_public_info\(uuid\) from public, anon, authenticated/);
    expect(c).toMatch(/revoke all on function public\.makler_public_datei\(uuid, text\) from public, anon, authenticated/);
    expect(c).toMatch(/and code_hash is not null and code_hash = p_code_hash/);
    expect(c).toContain("fehlversuche >= 10");
    expect(c).toMatch(/code_hash is not null and char_length\(code_hash\) = 64\s+and empfaenger_email is not null/);
    // Seite und Datei-Route rufen nur noch die Fassungen MIT Hash.
    const seite = readFileSync("app/(app)/makler-link/[token]/page.tsx", "utf8");
    const route = readFileSync("app/(app)/makler-link/[token]/datei/[key]/route.ts", "utf8");
    expect(seite).toContain("p_code_hash: hash");
    expect(route).toContain("p_code_hash: hash");
    expect(route).toContain("if (!hash || !/^[0-9a-f]{64}$/.test(hash))");
    expect(route).toContain('return new NextResponse("Bitte zuerst den Zugangscode eingeben", { status: 403 })');
  });

  it("Rückfall für den Bank-Link liegt bereit", () => {
    expect(existsSync("scripts/sql/rueckfall-bank-link-protokoll-2026-10-05.sql")).toBe(true);
  });
});

describe("Bank-Link: Anmeldung, Rückmeldung und Seiten (05.10.2026)", () => {
  const T = "11111111-2222-3333-4444-555555555555";
  async function ladeBank(init: Parameters<typeof fakeSupabase>[0], cookie?: string) {
    vi.resetModules();
    const gesetzt: { name: string; wert: string; opt: Record<string, unknown> }[] = [];
    vi.doMock("next/headers", () => ({
      cookies: async () => ({
        set: (name: string, wert: string, opt: Record<string, unknown>) => gesetzt.push({ name, wert, opt }),
        get: (name: string) => (cookie && name === "mi_bank" ? { value: cookie } : undefined),
      }),
      headers: async () => new Headers({ "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }),
    }));
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/beleihungPublic");
    return { db, mod, gesetzt };
  }

  it("richtiger Code: Cookie mi_bank mit Bank-Hash, nur für /beleihung/<token>", async () => {
    const { mod, gesetzt } = await ladeBank({ rpc: { beleihung_public_anmelden: "ok" } });
    expect(await mod.meldeBankAn(T, "abcd-ef23")).toEqual({ ok: true });
    const { freigabeCodeHash } = await import("@/lib/freigabeCode");
    expect(gesetzt[0]).toMatchObject({ name: "mi_bank", wert: freigabeCodeHash("bank", T, "ABCDEF23") });
    expect(gesetzt[0].opt).toMatchObject({ httpOnly: true, path: `/beleihung/${T}` });
  });

  it("falscher/gesperrter Code: kein Cookie", async () => {
    for (const a of ["falsch", "gesperrt", null]) {
      const { mod, gesetzt } = await ladeBank({ rpc: { beleihung_public_anmelden: a } });
      expect("error" in (await mod.meldeBankAn(T, "ABCD-EF23"))).toBe(true);
      expect(gesetzt).toEqual([]);
    }
  });

  it("Rückmeldung nur mit Code-Cookie — ohne erreicht sie die Datenbank nicht", async () => {
    const f = new FormData(); f.set("name", "Frau Berg"); f.set("nachricht", "Bitte Grundbuch nachreichen");
    const ohne = await ladeBank({ rpc: { beleihung_public_rueckmeldung: true } });
    expect((await ohne.mod.sendeBankRueckmeldung(T, f)).ok).toBe(false);
    expect(ohne.db.zugriffe).toEqual([]);
    const mit = await ladeBank({ rpc: { beleihung_public_rueckmeldung: true } }, "a".repeat(64));
    expect((await mit.mod.sendeBankRueckmeldung(T, f)).ok).toBe(true);
  });

  it("Bank-Seite und Datei-Route: nur mit Hash, Datei ohne Cookie 403", () => {
    const seite = readFileSync("app/(app)/beleihung/[token]/page.tsx", "utf8");
    const route = readFileSync("app/(app)/beleihung/[token]/datei/[key]/route.ts", "utf8");
    expect(seite).toContain('rpc("beleihung_public_info", { p_token: params.token, p_code_hash: hash })');
    expect(seite).toContain("anmelden={meldeBankAn}");
    expect(route).toContain("p_code_hash: hash");
    expect(route).toContain("if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {");
    expect(route).toContain('return new NextResponse("Bitte zuerst den Zugangscode eingeben", { status: 403 })');
  });

  it("Datenbank: Bank-Fassungen ohne Code stillgelegt, Rückmeldung verlangt den Hash", () => {
    const sql = readFileSync("supabase/migrations/20261005180000_bank_link_code.sql", "utf8");
    const c = sql.split("\n").filter((z) => !z.trim().startsWith("--")).join("\n");
    expect(sql).not.toMatch(/\b(delete|drop)\b/i);
    for (const sig of ["beleihung_public_info\\(uuid\\)", "beleihung_public_datei\\(uuid, text\\)", "beleihung_public_rueckmeldung\\(uuid, text, text, text, text, text\\[\\]\\)"]) {
      expect(c, sig).toMatch(new RegExp(`revoke all on function public\\.${sig} from public, anon, authenticated`));
    }
    expect((c.match(/code_hash is not null and code_hash = p_code_hash/g) ?? []).length).toBe(3);
    expect(c).toContain("freigabe_braucht_code");
  });

  it("der alte Rückfall öffnet keinen Zugang ohne Code mehr", () => {
    const r = readFileSync("scripts/sql/rueckfall-bank-link-protokoll-2026-10-05.sql", "utf8");
    expect(r).toContain("p_code_hash text");
    expect(r).not.toMatch(/beleihung_public_datei\(p_token uuid, p_item_key text\)\s*\n\s*returns/);
  });
});
