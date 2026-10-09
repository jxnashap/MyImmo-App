import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { kennzahlenSummary, objektKennzahlen, type ObjektEingaben } from "@/lib/kauf/objektKennzahlen";
import { VERGLEICH_MAX } from "@/components/kauf/ObjektVergleich";
import { DEMO_EMAIL } from "@/lib/demo";

// Beispiel-Kandidaten der Demo (Migration 20261006064806, Ja des Betreibers 06.10.2026). Vorher zeigte
// die Demo Schritt 1 „Objekte vergleichen“ leer. Festgehalten: Die gespeicherten Kennzahlen sind genau
// das, was der Objekt-Rechner aus den gespeicherten Eingaben rechnet — keine erfundenen Zahlen.

const MIGRATION = readFileSync("supabase/migrations/20261006064806_demo_kaufpruefungen.sql", "utf8");

type Zeile = { id: string; name: string; data: Record<string, string>; summary: Record<string, number> };
const ZEILE = /\('([0-9a-f-]{36})'::uuid, '((?:[^']|'')*)',\s*'((?:[^']|'')*)'::jsonb,\s*'((?:[^']|'')*)'::jsonb,/g;
const ent = (s: string) => s.replace(/''/g, "'");
const eingefuegt: Zeile[] = [...MIGRATION.matchAll(ZEILE)].map((m) => ({
  id: m[1],
  name: ent(m[2]),
  data: JSON.parse(ent(m[3])),
  summary: JSON.parse(ent(m[4])),
}));
// Paket P9 (09.10.2026): Kürzel, Bewertungsjahr und neue Kennzahlen — die Zeilen gelten in dieser Fassung.
const P9 = readFileSync("supabase/migrations/20261009130000_demo_kaufpruefungen_p9.sql", "utf8");
const UPDATE = /\('([0-9a-f-]{36})'::uuid,\s*'((?:[^']|'')*)'::jsonb,\s*'((?:[^']|'')*)'::jsonb\)/g;
const neu = new Map([...P9.matchAll(UPDATE)].map((m) => [m[1], { data: JSON.parse(ent(m[2])), summary: JSON.parse(ent(m[3])) }]));
const zeilen: Zeile[] = eingefuegt.map((z) => ({ ...z, ...(neu.get(z.id) ?? {}) }));

describe("Demo-Kandidaten", () => {
  it("P9 hat jede Zeile neu gesetzt — mit Länderkürzel und Bewertungsjahr (sonst rot ab 2027)", () => {
    expect(neu.size).toBe(eingefuegt.length);
    for (const z of zeilen) {
      expect(z.data.bundesland, z.name).toMatch(/^[A-Z]{2}$/);
      expect(z.data.bewertungsjahr, z.name).toBe("2026");
    }
  });

  it("drei bis fünf Zeilen — alle passen nebeneinander in den Vergleich", () => {
    expect(zeilen.length).toBeGreaterThanOrEqual(3);
    expect(zeilen.length).toBeLessThanOrEqual(VERGLEICH_MAX);
    expect(new Set(zeilen.map((z) => z.id)).size).toBe(zeilen.length);
  });

  it("jede Kennzahl ist die Rechnung des Objekt-Rechners über die gespeicherten Eingaben", () => {
    for (const z of zeilen) {
      expect(z.summary, z.name).toEqual(kennzahlenSummary(objektKennzahlen(z.data as unknown as ObjektEingaben)));
    }
  });

  it("die Eingaben haben genau die Felder, die der Rechner speichert — sonst ginge „Bearbeiten“ leer aus", () => {
    const quelle = readFileSync("components/kauf/ObjektRechner.tsx", "utf8");
    const block = quelle.slice(quelle.indexOf("function eingabenSnapshot()"), quelle.indexOf("function summarySnapshot()"));
    const felder = block.slice(block.indexOf("return {") + 8, block.indexOf("};")).split(",").map((s) => s.trim()).filter(Boolean);
    expect(felder.length).toBeGreaterThan(15);
    for (const z of zeilen) expect(Object.keys(z.data).sort(), z.name).toEqual([...felder].sort());
  });

  it("als Beispiel erkennbar, ohne Hausnummer; Name = Adresse (so speichert der Rechner)", () => {
    for (const z of zeilen) {
      expect(z.name).toMatch(/\(Beispiel\)$/);
      expect(z.name).not.toMatch(/\d+[a-z]?,/i);
      expect(z.data.adresse).toBe(z.name);
    }
  });

  it("mindestens ein Kandidat zeigt den Weg aus der Besichtigung (Sanierung in der Gesamtinvestition)", () => {
    expect(zeilen.some((z) => z.summary.sanierung > 0)).toBe(true);
  });

  it("nur für das Demo-Konto, wiederholbar", () => {
    expect(MIGRATION).toContain(`where u.email = '${DEMO_EMAIL}'`);
    expect(MIGRATION).toContain("on conflict (id) do nothing");
  });

  it("der Rauchtest sieht einen Kandidaten im Vergleich und in der Besichtigung", () => {
    const rauch = readFileSync("scripts/rauchtest.mjs", "utf8");
    const halle = zeilen.find((z) => z.summary.sanierung > 0)!;
    expect(rauch).toContain(`pfad: "/sanierung?objekt=${halle.id}"`); // eigener Weg, nicht nur ein Link im Vergleich
    expect(rauch).toContain(`href="/sanierung?objekt=${halle.id}"`);
    expect(rauch).toContain(halle.name);
  });
});
