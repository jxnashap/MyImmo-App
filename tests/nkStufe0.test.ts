// NK-Neubau Stufe 0 (07.10.2026): drei Fehler und der fehlende Weg zu den Positionen.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { NK_POSITION_SPALTEN } from "@/lib/nk";

const lies = (p: string) => readFileSync(p, "utf8");

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});
async function lade() {
  vi.resetModules();
  const { db, client } = fakeSupabase({});
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/positions");
  return { db, mod };
}
const insertZeilen = (db: { zugriffe: { op: string; daten?: unknown }[] }) => {
  const z = db.zugriffe.find((x) => x.op === "insert");
  return !z?.daten ? [] : Array.isArray(z.daten) ? z.daten : [z.daten];
};

describe("PDF und Bildschirm rechnen mit denselben Spalten", () => {
  it("die Spaltenliste enthält alles, was die Aufteilungen brauchen", () => {
    for (const s of ["aufteilung", "verbrauch_mieter", "verbrauch_gesamt", "grundkosten_prozent", "flaeche_gesamt", "lohnanteil", "art_35a"])
      expect(NK_POSITION_SPALTEN.split(",")).toContain(s);
  });
  it("NK-Seite, PDF und Beleihungs-Mappe laden über EINEN Lader, der genau diese Liste nimmt", () => {
    // Stufe 1: lib/nkPositionen.ts entscheidet zwischen Kosten am Objekt und Altbestand.
    expect(lies("lib/nkPositionen.ts")).toMatch(/from\("mieter_positionen"\)\s*\.select\(NK_POSITION_SPALTEN\)/);
    for (const f of ["lib/pdf/erzeugen.ts", "app/(app)/tenants/[id]/nk/page.tsx", "lib/actions/beleihung.ts"]) {
      expect(lies(f), f).toMatch(/ladeNkPositionen\(supabase,/);
      expect(lies(f), f).not.toMatch(/from\("mieter_positionen"\)/);
    }
  });
});

describe("KI-Import beim Mieter: neue Positionen ohne Gesamtfläche", () => {
  it("bekommen „voll“ statt null (die Spalte ist NOT NULL)", async () => {
    const { db, mod } = await lade();
    const r = await mod.uebernehmeNkOcr("m1", 2025, JSON.stringify({ neue: [{ name: "Müllabfuhr", betrag: 180 }] }));
    expect(r.ok).toBe(true);
    const z = insertZeilen(db);
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ bezeichnung: "Müllabfuhr", betrag: 180, aufteilung: "voll", jahr: 2025 });
  });
  it("mit Gesamtfläche weiter „flaeche“", async () => {
    const { db, mod } = await lade();
    await mod.uebernehmeNkOcr("m1", 2025, JSON.stringify({ neue: [{ name: "Grundsteuer", betrag: 2400, flaecheGesamt: 400, alsFlaeche: true }] }));
    expect(insertZeilen(db)[0]).toMatchObject({ aufteilung: "flaeche", flaeche_gesamt: 400 });
  });
  it("der Massenimport ebenso", async () => {
    const { db, mod } = await lade();
    await mod.addPositionsBulk("m1", JSON.stringify([{ name: "Wasser", betrag: 300 }]), 2025);
    expect(insertZeilen(db)[0]).toMatchObject({ aufteilung: "voll" });
  });
});

describe("KI-Import im Verteiler", () => {
  const s = lies("components/UmlageAssistent.tsx");
  it("übernimmt den Gesamtbetrag des Hauses (die Route liefert gesamt/anteil, kein betrag)", () => {
    expect(s).toMatch(/betrag: typeof p\.gesamt === "number" && Number\.isFinite\(p\.gesamt\) \? String\(p\.gesamt\) : ""/);
    expect(s).not.toMatch(/Number\.isFinite\(p\.betrag\)/);
  });
});

describe("Weg zu den Positionen", () => {
  it("die NK-Seite verlinkt die Positionen mit ihrem Jahr und Sprungmarke", () => {
    expect(lies("app/(app)/tenants/[id]/nk/page.tsx")).toMatch(/href=\{`\/tenants\/\$\{params\.id\}\/edit\?jahr=\$\{jahr\}#positionen`\}/);
  });
  it("die Positionen haben die Sprungmarke und übernehmen das Jahr", () => {
    expect(lies("components/PositionsManager.tsx")).toMatch(/<div id="positionen"/);
    expect(lies("components/PositionsManager.tsx")).toMatch(/useState\(startJahr \?\? JETZT - 1\)/);
    const e = lies("app/(app)/tenants/[id]/edit/page.tsx");
    expect(e).toMatch(/startJahr=\{nkJahr\}/);
    expect(e).toMatch(/jahr=\{nkJahr\}/);
  });
  it("nach dem Hinzufügen springt das Jahr nicht zurück, Gebäudewerte werden geleert", () => {
    const p = lies("components/PositionsManager.tsx");
    expect(p).not.toMatch(/setNJahr\(JETZT\)/);
    expect(p).toMatch(/setNGk\(""\);\s*setNFg\(""\);/);
  });
});
