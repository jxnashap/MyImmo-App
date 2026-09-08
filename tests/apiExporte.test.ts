import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// Die Berichte lesen `req.nextUrl` — das gibt es nur am NextRequest.
const anfrage = (url: string) => new NextRequest(url);

// Fünfter Durchgang, Teil 3: Exporte und Berichte.
//
// DER FUND (08.09.2026): Fünf Routen lasen `properties`, `einnahmen`, `kosten`
// und `kredite` mit `select("*")` OHNE Nutzerfilter — „RLS liefert ohnehin nur
// eigene Zeilen". Für Vermieter stimmt das. Für MIETER nicht: Die Policy
// `properties_select_zugang` gibt dem Mieter die KOMPLETTE Objektzeile seiner
// Wohnung — inklusive Kaufpreis, Wert und Kaufdatum (live gegen die Datenbank
// geprüft). Ein Mieter-Konto, das `/api/export` oder `/api/berichte/anlage-v`
// aufruft, bekam damit die Zahlen seines Vermieters — beim Anlage-V-PDF sogar
// als fertig gerechnete Werbungskosten.
//
// `/api/export/alles` hatte genau diesen Fehler bereits behoben (der Kommentar
// dort beschreibt ihn). Die vier Geschwister-Routen und das ältere `/api/export`
// nicht. Derselbe Fehler, fünf Stellen weiter — das Muster dieser Woche.
//
// Jetzt: expliziter `user_id`-Filter auf JEDER Abfrage (die eigentliche
// Absicherung) plus Rollenprüfung (zweite Linie).

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of [
    "next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin",
    "@/lib/planGate", "@/lib/pdf/berichtPdf", "@/lib/ibanData", "@/lib/datev",
  ]) vi.doUnmock(m);
});

async function lade(pfad: string, rolle: string | null, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase({
    antworten: { nutzer_rollen: rolle ? { rolle } : null, properties: [], einnahmen: [], kosten: [], kredite: [], vermieter_profil: null },
    ...init,
  });
  mockeNextUndSupabase(client);
  vi.doMock("@/lib/planGate", () => ({ featureSperre: async () => null }));
  vi.doMock("@/lib/pdf/berichtPdf", () => ({
    buildAnlageVPdf: async () => new Uint8Array([1]),
    buildJahresberichtPdf: async () => new Uint8Array([1]),
  }));
  vi.doMock("@/lib/ibanData", () => ({ decryptIbanRow: (r: unknown) => r }));
  const mod = await import(pfad);
  return { db, mod };
}

type Db = { zugriffe: { tabelle: string; op: string; filter: string[] }[] };
const selects = (db: Db) => db.zugriffe.filter((z) => z.op === "select" && z.tabelle !== "nutzer_rollen");

const ROUTEN: [pfad: string, url: string, sperrStatus: number][] = [
  ["@/app/api/export/route", "https://x/api/export", 403],
  ["@/app/api/export/buchungen/route", "https://x/api/export/buchungen", 403],
  ["@/app/api/export/datev/route", "https://x/api/export/datev?jahr=2025", 403],
  ["@/app/api/berichte/anlage-v/route", "https://x/api/berichte/anlage-v?jahr=2025", 307],
  ["@/app/api/berichte/jahresbericht/route", "https://x/api/berichte/jahresbericht?jahr=2025", 307],
];

describe.each(ROUTEN)("%s", (pfad, url, sperrStatus) => {
  it("ein Mieter- oder Service-Konto kommt nicht an die Daten — nichts wird gelesen", async () => {
    for (const rolle of ["mieter", "service"]) {
      const { db, mod } = await lade(pfad, rolle);
      const r = await mod.GET(anfrage(url) as never);
      expect(r.status, rolle).toBe(sperrStatus);
      expect(selects(db), rolle).toEqual([]);
    }
  });

  it("ein Vermieter-Konto (auch ohne Rollenzeile) kommt durch — und JEDE Abfrage filtert auf user_id", async () => {
    for (const rolle of ["vermieter", "hausverwaltung", null]) {
      const { db, mod } = await lade(pfad, rolle);
      const r = await mod.GET(anfrage(url) as never);
      expect(r.status, String(rolle)).toBe(200);
      const s = selects(db);
      expect(s.length, String(rolle)).toBeGreaterThan(0);
      for (const z of s) expect(z.filter, `${rolle} ${z.tabelle}`).toContain("eq:user_id=nutzer-1");
    }
  });
});

describe("Berichte: Parameter", () => {
  it("DATEV nimmt nur plausible Jahre, sonst das Vorjahr", async () => {
    const jahre: string[] = [];
    vi.doMock("@/lib/datev", () => ({
      baueDatevBuchungen: () => [],
      baueDatevExtf: (_b: unknown, o: { jahr: number }) => { jahre.push(String(o.jahr)); return ""; },
    }));
    const { mod } = await lade("@/app/api/export/datev/route", "vermieter");
    for (const q of ["2025", "1999", "abc", "2025.5", ""]) await mod.GET(anfrage(`https://x/api/export/datev?jahr=${q}`) as never);
    const vorjahr = String(new Date().getFullYear() - 1);
    expect(jahre).toEqual(["2025", vorjahr, vorjahr, vorjahr, vorjahr]);
  });

  it("die PDFs werden inline mit no-store ausgeliefert", async () => {
    const { mod } = await lade("@/app/api/berichte/anlage-v/route", "vermieter");
    const r = await mod.GET(anfrage("https://x/api/berichte/anlage-v?jahr=2025") as never);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-disposition")).toContain("Anlage-V_2025.pdf");
  });
});
