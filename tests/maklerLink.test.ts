import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { maklerVorauswahl, maklerLinkPfad, MAKLER_CHECKLISTE } from "@/lib/makler";
import { abrufeJeLink, abrufZusammenfassung } from "@/lib/freigabeAbrufe";
import { istOeffentlicheSeite } from "@/lib/oeffentlich";

// Makler-Link + Abruf-Protokoll (05.10.2026, Migration 20261005160000).
// Der Link öffnet die heikelsten Dokumente der App (Ausweis, SCHUFA, Einkommen) für jeden, der ihn
// hat. Deshalb: frische Anmeldung, nur bekannte Punkte mit Datei, Laufzeit 7/14/30, datensparsame
// Punkte nicht vorausgewählt, Widerruf ohne Rückweg — und jeder Abruf landet im Protokoll.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
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
    await mod.createMaklerFreigabe(["schufa_bonitaet", "finanzierungsbestaetigung", "erfunden", "../x"], 14);
    expect(eingefuegt(db)).toMatchObject({ user_id: "nutzer-1", item_keys: ["schufa_bonitaet"] });
  });

  it("ohne gültigen Punkt kein Datenbankzugriff, ohne Datei kein Link", async () => {
    const a = await lade();
    await expect(a.mod.createMaklerFreigabe(["erfunden"], 14)).rejects.toThrow("mindestens ein Dokument");
    expect(a.db.zugriffe).toEqual([]);
    const b = await lade();
    await expect(b.mod.createMaklerFreigabe(["finanzierungsbestaetigung"], 14)).rejects.toThrow("keine Datei");
    expect(eingefuegt(b.db)).toBeUndefined();
  });

  it("nur 7, 14 oder 30 Tage — sonst 14", async () => {
    for (const [ein, soll] of [[7, 7], [30, 30], [90, 14], [0, 14]] as const) {
      const { db, mod } = await lade();
      const vorher = Date.now();
      await mod.createMaklerFreigabe(["schufa_bonitaet"], ein);
      const tage = Math.round((new Date(String(eingefuegt(db)?.ablauf)).getTime() - vorher) / 86_400_000);
      expect(tage, `Eingabe ${ein}`).toBe(soll);
    }
  });

  it("verlangt eine frische Anmeldung — vor dem Anlegen", async () => {
    const { db, mod } = await lade({ amrVorSekunden: 3 * 3600 });
    await expect(mod.createMaklerFreigabe(["schufa_bonitaet"], 14)).rejects.toThrow();
    expect(eingefuegt(db)).toBeUndefined();
  });

  it("ein Lesefehler legt keinen Link an (fail-closed)", async () => {
    const { db, mod } = await lade({ fehlerBei: { "makler_dokumente:select": { message: "kaputt" } } });
    await expect(mod.createMaklerFreigabe(["schufa_bonitaet"], 14)).rejects.toThrow("kaputt");
    expect(eingefuegt(db)).toBeUndefined();
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

  it("Rückfall für den Bank-Link liegt bereit", () => {
    expect(existsSync("scripts/sql/rueckfall-bank-link-protokoll-2026-10-05.sql")).toBe(true);
  });
});
