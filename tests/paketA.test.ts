import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KOSTEN_KATEGORIEN, EINNAHME_KATEGORIEN, kategorieOptionen } from "@/lib/kategorien";
import { jahresZeile } from "@/lib/jahresberichtZeile";

// Verknüpfungs-Audit 06.10.2026, Paket A — Zahlen, die still falsch wurden.
// Details: docs/AUDIT-2026-10-06-verknuepfung.md

const lies = (p: string) => readFileSync(p, "utf8");

function dateien(dir: string, aus: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.tsx?$/.test(n)) aus.push(p);
  }
  return aus;
}

describe("A1 — eine Kategorienliste, und Bearbeiten ändert nichts still", () => {
  it("eine unbekannte gespeicherte Kategorie bleibt beim Bearbeiten wählbar (vorne)", () => {
    expect(kategorieOptionen(KOSTEN_KATEGORIEN, "Bankgebühren")[0]).toBe("Bankgebühren");
    expect(kategorieOptionen(KOSTEN_KATEGORIEN, "Bankgebühren")).toHaveLength(KOSTEN_KATEGORIEN.length + 1);
  });

  it("eine bekannte Kategorie wird nicht verdoppelt, leer ergibt die Liste", () => {
    expect(kategorieOptionen(KOSTEN_KATEGORIEN, "Schuldzinsen")).toEqual([...KOSTEN_KATEGORIEN]);
    expect(kategorieOptionen(EINNAHME_KATEGORIEN, null)).toEqual([...EINNAHME_KATEGORIEN]);
    expect(kategorieOptionen(EINNAHME_KATEGORIEN, "  ")).toEqual([...EINNAHME_KATEGORIEN]);
  });

  it("Schuldzinsen sind in der Liste (der Bearbeiten-Dialog machte sie zur Reparatur)", () => {
    expect(KOSTEN_KATEGORIEN).toContain("Schuldzinsen");
  });

  it("jede Kostenkategorie hat eine Zeile in der Anlage V", () => {
    const anlageV = lies("lib/anlageV.ts");
    const bucket = anlageV.slice(anlageV.indexOf("const KOSTEN_BUCKET"), anlageV.indexOf("};", anlageV.indexOf("const KOSTEN_BUCKET")));
    for (const k of KOSTEN_KATEGORIEN) expect(bucket, k).toContain(k.includes(" ") ? `"${k}"` : `${k}:`);
  });

  it("keine Komponente oder Seite führt eine eigene volle Kategorienliste", () => {
    const funde = [...dateien("components"), ...dateien("app")].filter((p) =>
      /\[\s*"Reparatur",\s*"Instandhaltung",\s*"Verwaltung"|\[\s*"Miete",\s*"Kaution",\s*"Nebenkostenabrechnung"/.test(lies(p)),
    );
    expect(funde).toEqual([]);
  });

  it("jedes Bearbeiten-Feld für eine Kategorie behält den gespeicherten Wert", () => {
    for (const p of [
      "components/lists/KostenListe.tsx",
      "components/lists/EinnahmenListe.tsx",
      "app/(app)/kosten/[id]/edit/page.tsx",
      "app/(app)/einnahmen/[id]/edit/page.tsx",
      "components/BuchungForm.tsx",
    ]) expect(lies(p), p).toMatch(/kategorieOptionen\(/);
  });
});

describe("A2 — Jahresbericht wie Anlage V ohne Kaution", () => {
  const daten = {
    einnahmen: [
      { prop_id: "a", buchungsdatum: "2025-03-01", betrag: 900, kategorie: "Miete" },
      { prop_id: "a", buchungsdatum: "2025-03-01", betrag: 2700, kategorie: "Kaution" },
      { prop_id: "a", buchungsdatum: "2025-04-01", betrag: 50, kategorie: "Sonstiges" },
    ],
    kosten: [],
    kredite: [],
  };
  it("die Kaution zählt nicht als Einnahme", () => {
    expect(jahresZeile("a", 2025, 12, daten).e).toBe(950);
  });
});

describe("A3 — das Dashboard blendet aus, was /termine ausblendet", () => {
  const seite = lies("app/(app)/page.tsx");
  it("lädt die ausgeblendeten Fristen und prüft jede Quelle mit demselben Schlüssel", () => {
    expect(seite).toMatch(/from\("frist_ausgeblendet"\)/);
    for (const q of ["mieter", "kredit", "objekt", "steuer"]) expect(seite, q).toContain(`sichtbar("${q}", f)`);
    expect(seite).toMatch(/versteckt\.has\(fristSchluessel\(quelle, f\.datum, f\.label\)\)/);
  });
  it("die Quellen heißen wie in /termine (sonst greift der Schlüssel nie)", () => {
    const termine = lies("app/(app)/termine/page.tsx");
    for (const q of ["mieter", "kredit", "objekt", "steuer"]) expect(termine, q).toContain(`quelle: "${q}"`);
  });
});

describe("A4 — eine Kreditrate ist Pflicht", () => {
  it("Anlegen und Bearbeiten verlangen die Monatsrate", () => {
    for (const p of ["app/(app)/kredite/new/page.tsx", "app/(app)/kredite/[id]/edit/page.tsx"]) {
      const feld = lies(p).match(/<input[^>]*name="monatsrate"[^>]*>/)?.[0] ?? "";
      expect(feld, p).toMatch(/\brequired\b/);
    }
  });
});
