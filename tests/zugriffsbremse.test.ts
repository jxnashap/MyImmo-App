import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Zugriffsbremse: die Kennung darf die App nie im Klartext verlassen.
//
// WARUM (08.09.2026, gemessen statt vermutet)
// `darfWeiter()` gab die rohe Besucher-IP als Teil des Schlüssels an die
// Datenbank. In `zugriff_limit` lagen daraufhin 29 Zeilen, ALLE 29 mit einer
// IP im Klartext, die älteste neun Tage alt — gelöscht wurde nie. Über
// `newsletter_adresse` wäre zusätzlich die E-Mail-Adresse dort gelandet.
// Eine Bremse braucht aber nur einen STABILEN Schlüssel, keinen lesbaren.

const QUELLE = readFileSync(join(process.cwd(), "lib", "net", "bremse.ts"), "utf8");

// 32 Byte base64 — nur für den Test, nirgends sonst verwendet.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

async function lade(mitKey: boolean) {
  vi.resetModules();
  if (mitKey) process.env.DATA_ENCRYPTION_KEY = TEST_KEY;
  else delete process.env.DATA_ENCRYPTION_KEY;

  const aufrufe: Record<string, unknown>[] = [];
  vi.doMock("next/headers", () => ({
    headers: async () => new Map([["x-forwarded-for", "203.0.113.42, 10.0.0.1"]]),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc: async (_name: string, args: Record<string, unknown>) => {
        aufrufe.push(args);
        return { error: null };
      },
    }),
  }));
  const mod = await import("@/lib/net/bremse");
  return { mod, aufrufe };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("Zugriffsbremse — Kennung", () => {
  it("gibt die IP NICHT im Klartext an die Datenbank", async () => {
    const { mod, aufrufe } = await lade(true);
    await mod.darfWeiter("test", 5, 60);
    expect(aufrufe).toHaveLength(1);
    const kennung = String(aufrufe[0].p_kennung);
    expect(kennung).not.toContain("203.0.113.42");
    // HMAC-SHA256 als Hex: 64 Zeichen.
    expect(kennung).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gibt auch eine übergebene E-Mail-Adresse nicht im Klartext weiter", async () => {
    // `newsletter_adresse` reicht die Adresse durch — vorher landete sie so,
    // wie sie war, als Teil des Schlüssels in der Tabelle.
    const { mod, aufrufe } = await lade(true);
    await mod.darfWeiter("newsletter_adresse", 3, 3600, "mieter@example.org");
    expect(String(aufrufe[0].p_kennung)).not.toContain("@");
    expect(String(aufrufe[0].p_kennung)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dieselbe Eingabe ergibt denselben Wert — sonst zählt die Bremse nicht", async () => {
    // Ohne Stabilität bekäme jeder Versuch einen neuen Schlüssel und die
    // Bremse wäre wirkungslos, ohne dass es auffiele.
    const a = await lade(true);
    await a.mod.darfWeiter("test", 5, 60, "gleich");
    const b = await lade(true);
    await b.mod.darfWeiter("test", 5, 60, "gleich");
    expect(a.aufrufe[0].p_kennung).toBe(b.aufrufe[0].p_kennung);
  });

  it("verschiedene Eingaben ergeben verschiedene Werte", async () => {
    const { mod, aufrufe } = await lade(true);
    await mod.darfWeiter("test", 5, 60, "eins");
    await mod.darfWeiter("test", 5, 60, "zwei");
    expect(aufrufe[0].p_kennung).not.toBe(aufrufe[1].p_kennung);
  });

  it("ohne DATA_ENCRYPTION_KEY bricht die Bremse nicht — und schickt trotzdem keinen Klartext", async () => {
    // Die Bremse ist eine zusätzliche Hürde, nicht die Zugangskontrolle:
    // Sie darf an einer fehlenden Env nicht scheitern. Klartext ist trotzdem
    // keine erlaubte Rückfallebene.
    const { mod, aufrufe } = await lade(false);
    const erg = await mod.darfWeiter("test", 5, 60);
    expect(erg).toBe(true);
    const kennung = String(aufrufe[0].p_kennung);
    expect(kennung).not.toContain("203.0.113.42");
    expect(kennung).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ohne Schlüssel ist der Wert ein ANDERER als mit — sonst wäre der Schlüssel wirkungslos", async () => {
    const mit = await lade(true);
    await mit.mod.darfWeiter("test", 5, 60, "x");
    const ohne = await lade(false);
    await ohne.mod.darfWeiter("test", 5, 60, "x");
    expect(mit.aufrufe[0].p_kennung).not.toBe(ohne.aufrufe[0].p_kennung);
  });

  it("es wird IMMER eine Kennung mitgegeben — nie der DB-seitige IP-Rückfall", () => {
    // Bleibt `p_kennung` leer, greift `anfrage_ip()` INNERHALB der Datenbank,
    // und die schreibt die IP wieder im Klartext. Der Aufruf muss deshalb
    // ohne Umweg durch `kennzeichen()` laufen.
    expect(QUELLE).toMatch(/p_kennung:\s*kennzeichen\(/);
    expect(QUELLE).not.toMatch(/p_kennung:\s*kennung\s*\?\?\s*\(await besucherIp\(\)\)/);
  });
});

describe("Zugriffsbremse — Aufräumen in der Datenbank", () => {
  const MIGRATION = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20260908143000_zugriff_limit_kennungen_pseudonymisieren.sql"),
    "utf8",
  );

  it("alte Zeilen werden gelöscht (Art. 5 Abs. 1 lit. e — Speicherbegrenzung)", () => {
    expect(MIGRATION).toMatch(/delete from zugriff_limit where fenster_start < jetzt - interval '24 hours'/);
  });

  it("das Aufrufrecht ist auch PUBLIC entzogen — sonst wirkungslos", () => {
    // `from anon, authenticated` allein hätte nichts bewirkt: Beide erben
    // EXECUTE von der Rolle PUBLIC (siehe CLAUDE.md, Datenbank).
    expect(MIGRATION).toMatch(/revoke execute on function public\.rate_limit_pruefen[\s\S]*from public/);
  });
});
