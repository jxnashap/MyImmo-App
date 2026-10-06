import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { berlinZuIso, telefonGueltig, telLink, terminIcs, terminMeldung, terminOrt, terminText } from "@/lib/freigabeTermin";
import { bauePortalNeuigkeiten } from "@/lib/portalNeuigkeiten";

// Termin über Bank-/Makler-Link (06.10.2026, Migration 20261006120000). Vorgabe des Betreibers:
// 1–3 Termine zur Auswahl ODER Telefonnummer für einen Rückruf. Zeitpunkte kommen als Berliner
// Ortszeit aus `datetime-local`; der Server läuft in UTC — ohne Umrechnung stünde jeder Termin
// eine bzw. zwei Stunden daneben.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

const T = "11111111-2222-3333-4444-555555555555";

describe("Berliner Ortszeit → UTC", () => {
  it("Sommerzeit (UTC+2) und Winterzeit (UTC+1)", () => {
    expect(berlinZuIso("2026-07-01T14:30")).toBe("2026-07-01T12:30:00.000Z");
    expect(berlinZuIso("2026-12-01T14:30")).toBe("2026-12-01T13:30:00.000Z");
  });
  it("Umstellungstage: 25.10. nach der Umstellung, 29.03. die fehlende Stunde", () => {
    expect(berlinZuIso("2026-10-25T09:00")).toBe("2026-10-25T08:00:00.000Z");
    expect(berlinZuIso("2026-03-29T02:30")).toBeNull();
  });
  it("Unsinn → null", () => {
    for (const s of ["", "2026-13-01T10:00", "2026-02-30T10:00", "morgen", "2026-07-01 14:30"]) expect(berlinZuIso(s)).toBeNull();
  });
  it("unabhängig von der Zeitzone des Servers (Ausgabe bleibt Berlin)", () => {
    expect(terminText("2026-07-01T12:30:00.000Z")).toContain("14:30");
  });
});

describe("Telefon, Meldungen, Kalenderdatei", () => {
  it("Telefonnummer: wie die Datenbank", () => {
    expect(telefonGueltig("+49 451 123456")).toBe(true);
    expect(telefonGueltig("0451/12 34-56")).toBe(true);
    expect(telefonGueltig("12")).toBe(false);
    expect(telefonGueltig("ruf an: 0451")).toBe(false);
    expect(telLink("+49 (451) 12-34")).toBe("tel:+4945112 34".replace(" ", ""));
    expect(telLink("javascript:alert(1)")).toBeNull();
  });
  it("Meldungen und Sprungziel", () => {
    expect(terminMeldung("ok")).toBeNull();
    expect(terminMeldung("offen")).toMatch(/offenen Vorschlag/);
    expect(terminMeldung(null)).toMatch(/abgelaufen/);
    expect(terminOrt("bank", "p1")).toBe("/properties/p1/beleihung#termin");
  });
  it("ICS: UTC-Zeiten, eine Stunde Dauer, Sonderzeichen maskiert", () => {
    const ics = terminIcs({ start: "2026-07-01T12:30:00.000Z", titel: "Bank; Termin, Kern", ort: "Filiale", uid: "x@myimmo" });
    expect(ics).toContain("DTSTART:20260701T123000Z");
    expect(ics).toContain("DTEND:20260701T133000Z");
    expect(ics).toContain("SUMMARY:Bank\\; Termin\\, Kern");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});

describe("schlageTerminVor (öffentlich)", () => {
  async function lade(rpcAntwort: unknown, cookie?: { name: string; wert: string }) {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      cookies: async () => ({ get: (n: string) => (cookie && n === cookie.name ? { value: cookie.wert } : undefined) }),
    }));
    const { db, client } = fakeSupabase({ rpc: { freigabe_public_termin: rpcAntwort } });
    const args: Record<string, unknown>[] = [];
    const rpc = client.rpc;
    client.rpc = async (name: string, a?: unknown) => { args.push(a as Record<string, unknown>); return rpc(name, a); };
    mockeNextUndSupabase(client);
    return { db, args, mod: await import("@/lib/actions/freigabeTerminPublic") };
  }
  const BANK = { name: "mi_bank", wert: "a".repeat(64) };
  const fd = (o: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
    return f;
  };

  it("ohne Code-Cookie (oder mit dem der anderen Art) nichts an die Datenbank", async () => {
    for (const c of [undefined, { name: "mi_makler", wert: "a".repeat(64) }]) {
      const { mod, db } = await lade("ok", c);
      expect("error" in (await mod.schlageTerminVor("bank", T, fd({ modus: "rueckruf", telefon: "+49 451 123456" })))).toBe(true);
      expect(db.zugriffe).toEqual([]);
    }
  });

  it("Makler-Link liest das Makler-Cookie — ein Bank-Cookie öffnet ihn nicht", async () => {
    const falsch = await lade("ok", BANK);
    expect("error" in (await falsch.mod.schlageTerminVor("makler", T, fd({ modus: "rueckruf", telefon: "+49 451 123456" })))).toBe(true);
    expect(falsch.db.zugriffe).toEqual([]);
    const richtig = await lade("ok", { name: "mi_makler", wert: "c".repeat(64) });
    expect(await richtig.mod.schlageTerminVor("makler", T, fd({ modus: "rueckruf", telefon: "+49 451 123456" }))).toEqual({ ok: true });
    expect(richtig.args[0]).toMatchObject({ p_art: "makler", p_code_hash: "c".repeat(64) });
  });

  it("Termine: Berliner Zeit wird als UTC übergeben, Hash aus dem Cookie", async () => {
    const { mod, args } = await lade("ok", BANK);
    const r = await mod.schlageTerminVor("bank", T, fd({ modus: "termine", vorschlag: ["2099-07-01T14:30", "2099-12-01T09:00"], ort: "Filiale" }));
    expect(r).toEqual({ ok: true });
    expect(args[0]).toMatchObject({
      p_art: "bank", p_token: T, p_code_hash: "a".repeat(64), p_modus: "termine",
      p_vorschlaege: ["2099-07-01T12:30:00.000Z", "2099-12-01T08:00:00.000Z"], p_ort: "Filiale",
    });
  });

  it("Termine: vier, doppelte, vergangene oder kaputte Zeitpunkte → abgelehnt ohne Datenbank", async () => {
    for (const v of [
      ["2099-01-01T10:00", "2099-01-02T10:00", "2099-01-03T10:00", "2099-01-04T10:00"],
      ["2099-01-01T10:00", "2099-01-01T10:00"],
      ["2001-01-01T10:00"],
      ["morgen"],
      [],
    ]) {
      const { mod, db } = await lade("ok", BANK);
      expect("error" in (await mod.schlageTerminVor("bank", T, fd({ modus: "termine", vorschlag: v })))).toBe(true);
      expect(db.zugriffe).toEqual([]);
    }
  });

  it("Rückruf: Telefonnummer Pflicht, keine Zeitpunkte", async () => {
    const ohne = await lade("ok", BANK);
    expect("error" in (await ohne.mod.schlageTerminVor("bank", T, fd({ modus: "rueckruf", telefon: "12" })))).toBe(true);
    expect(ohne.db.zugriffe).toEqual([]);
    const mit = await lade("ok", BANK);
    expect(await mit.mod.schlageTerminVor("bank", T, fd({ modus: "rueckruf", telefon: "+49 451 123456", vorschlag: "2099-01-01T10:00" }))).toEqual({ ok: true });
    expect(mit.args[0]).toMatchObject({ p_modus: "rueckruf", p_vorschlaege: [], p_telefon: "+49 451 123456" });
  });

  it("Antwort der Datenbank wird nicht verschluckt", async () => {
    for (const a of ["offen", "limit", "format", "ungueltig", null]) {
      const { mod } = await lade(a, BANK);
      expect("error" in (await mod.schlageTerminVor("bank", T, fd({ modus: "rueckruf", telefon: "+49 451 123456" })))).toBe(true);
    }
  });
});

describe("Eigentümer", () => {
  async function lade(init: Parameters<typeof fakeSupabase>[0]) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    const args: Record<string, unknown>[] = [];
    const rpc = client.rpc;
    client.rpc = async (name: string, a?: unknown) => { args.push(a as Record<string, unknown>); return rpc(name, a); };
    mockeNextUndSupabase(client);
    return { db, args, mod: await import("@/lib/actions/freigabeTermin") };
  }
  it("Bestätigen: Vorschlag unverändert, Rückruf-Zeit aus Berliner Ortszeit; kein Treffer → Fehler", async () => {
    const a = await lade({ rpc: { freigabe_termin_bestaetigen: "t-1" } });
    expect(await a.mod.bestaetigeFreigabeTermin("f-1", "2099-07-01T12:30:00+00:00", "")).toEqual({ ok: true });
    expect(a.args[0]).toMatchObject({ p_id: "f-1", p_zeit: "2099-07-01T12:30:00+00:00" });
    const b = await lade({ rpc: { freigabe_termin_bestaetigen: "t-1" } });
    await b.mod.bestaetigeFreigabeTermin("f-1", "2099-07-01T14:30", "");
    expect(b.args[0].p_zeit).toBe("2099-07-01T12:30:00.000Z");
    const c = await lade({ rpc: { freigabe_termin_bestaetigen: null } });
    expect("error" in (await c.mod.bestaetigeFreigabeTermin("f-1", "2099-07-01T12:30:00+00:00", ""))).toBe(true);
    const d = await lade({ rpc: { freigabe_termin_bestaetigen: "t-1" } });
    expect("error" in (await d.mod.bestaetigeFreigabeTermin("f-1", "quatsch", ""))).toBe(true);
    expect(d.db.zugriffe).toEqual([]);
  });
  it("Keiner passt / erledigt: nur von 'offen', nur eigene, kein Treffer → Fehler", async () => {
    const a = await lade({ antworten: { freigabe_termine: { id: "f-1" } } });
    expect(await a.mod.lehneFreigabeTerminAb("f-1", "Bitte nachmittags")).toEqual({ ok: true });
    const z = a.db.zugriffe.find((x) => x.tabelle === "freigabe_termine" && x.op === "update")!;
    expect(z.daten).toMatchObject({ status: "abgelehnt", antwort: "Bitte nachmittags" });
    expect(JSON.stringify(z.filter)).toContain("user_id");
    expect(JSON.stringify(z.filter)).toContain("offen");
    const b = await lade({ antworten: { freigabe_termine: null } });
    expect("error" in (await b.mod.erledigeFreigabeRueckruf("f-1", ""))).toBe(true);
  });
});

describe("Dashboard-Neuigkeit", () => {
  const leer = { ereignisse: [], anliegen: new Map(), zustellungen: [], angebote: [], rueckmeldungen: [], freigaben: [], bewerbungen: [] };
  it("Vorschlag und Rückrufbitte erscheinen, auch wenn sie älter sind, mit Sprung zur Terminkarte", () => {
    const { liste } = bauePortalNeuigkeiten({
      ...leer,
      termine: [
        { art: "bank", propId: "p9", modus: "termine", anzahl: 2, name: "Frau Kern", created_at: "2026-08-01T10:00:00Z" },
        { art: "makler", propId: null, modus: "rueckruf", anzahl: 0, name: null, created_at: "2026-10-05T10:00:00Z" },
      ],
    }, "2026-10-06");
    expect(liste.map((n) => n.text)).toEqual(["Makler bittet um Rückruf", "Bank schlägt 2 Termine vor"]);
    expect(liste[1].href).toBe("/properties/p9/beleihung#termin");
  });
});

describe("Migration und Seiten", () => {
  const sql = readFileSync("supabase/migrations/20261006120000_freigabe_termine.sql", "utf8");
  it("Code-Hash Pflicht, 1–3 Vorschläge, ein offener je Link, Bestätigen nur mit Vorschlag", () => {
    expect(sql).toMatch(/and code_hash = p_code_hash/);
    expect(sql).toMatch(/cardinality\(v_vor\) not between 1 and 3/);
    expect(sql).toMatch(/if n_offen > 0 then return 'offen'/);
    expect(sql).toMatch(/t\.modus = 'termine' and not \(p_zeit = any\(t\.vorschlaege\)\)/);
    expect(sql).not.toMatch(/for insert to authenticated/);
    expect(sql).not.toMatch(/\bdelete\b|\bdrop\b/i);
  });
  it("Kontolöschung enthält Termine, Eingang und Abo-Zahlungen", () => {
    const k = readFileSync("supabase/migrations/20261006121000_kontoloeschung_freigabe_termine.sql", "utf8");
    for (const t of ["freigabe_termine", "freigabe_eingang", "abo_zahlungen", "makler_freigaben"]) {
      expect(k).toContain(`delete from public.${t}`);
    }
  });
  it("öffentliche Seiten holen die Termine nur mit Hash", () => {
    for (const p of ["app/(app)/beleihung/[token]/page.tsx", "app/(app)/makler-link/[token]/page.tsx"]) {
      expect(readFileSync(p, "utf8")).toMatch(/rpc\("freigabe_public_termine", \{ p_art: "(bank|makler)", p_token: params\.token, p_code_hash: hash \}\)/);
    }
  });
});
