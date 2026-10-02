import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { autorLabel, ereignisText, gruppiereEreignisse, pruefeNachricht, type Ereignis } from "@/lib/vorgang";

// Vorgänge mit Verlauf (02.10.2026, docs/zukunft/MIETERPORTAL-AUSBAU.md § 9, Fundament 2).
// Die Schranken sitzen in der Datenbank (Migration 20261002160000) und wurden in einer
// zurückgerollten Transaktion als Mieter, Vermieter und Fremder bewiesen: falsche Rolle,
// Status-Eintrag vom Mieter, Rückdatierung, Ändern und fremdes Schreiben scheitern;
// Status- und Terminwechsel erscheinen von selbst. Hier: Beschriftung, Reihenfolge,
// Eingabeprüfung und die Eigenschaften der Migration, die nicht verloren gehen dürfen.

const e = (x: Partial<Ereignis>): Ereignis => ({
  id: "e", anliegen_id: "a1", autor_rolle: "mieter", art: "nachricht", text: "Hallo", status_neu: null,
  created_at: "2026-10-01T10:00:00Z", ...x,
});

describe("Beschriftung", () => {
  it("aus Sicht des Lesers: „Du“ für eigene, die Gegenseite beim Namen ihrer Rolle", () => {
    expect(autorLabel("mieter", "mieter")).toBe("Du");
    expect(autorLabel("vermieter", "mieter")).toBe("Dein Vermieter");
    expect(autorLabel("mieter", "vermieter")).toBe("Mieter");
    expect(autorLabel("vermieter", "vermieter")).toBe("Du");
    expect(autorLabel("system", "mieter")).toBe("MyImmo");
  });
  it("Statuswechsel werden lesbar, Nachrichten bleiben wörtlich", () => {
    expect(ereignisText(e({ art: "status", text: null, status_neu: "erledigt" }))).toBe("Status: erledigt");
    expect(ereignisText(e({ art: "status", text: null, status_neu: "offen" }))).toBe("Status: wieder geöffnet");
    expect(ereignisText(e({ art: "nachricht", text: "Status: erledigt?" }))).toBe("Status: erledigt?");
  });
});

describe("Reihenfolge", () => {
  it("je Anliegen chronologisch, älteste zuerst — auch wenn die Abfrage anders sortiert liefert", () => {
    const g = gruppiereEreignisse([
      e({ id: "3", created_at: "2026-10-03T00:00:00Z" }),
      e({ id: "x", anliegen_id: "a2" }),
      e({ id: "1", created_at: "2026-10-01T00:00:00Z" }),
      e({ id: "2", created_at: "2026-10-02T00:00:00Z" }),
    ]);
    expect(g.get("a1")!.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(g.get("a2")!.map((x) => x.id)).toEqual(["x"]);
  });
});

describe("Nachricht prüfen", () => {
  it("leer, nur Leerzeichen oder zu lang: abgelehnt; sonst getrimmt", () => {
    expect(pruefeNachricht("").ok).toBe(false);
    expect(pruefeNachricht("   ").ok).toBe(false);
    expect(pruefeNachricht(undefined).ok).toBe(false);
    expect(pruefeNachricht("x".repeat(4001)).ok).toBe(false);
    expect(pruefeNachricht("x".repeat(4000)).ok).toBe(true);
    expect(pruefeNachricht("  Hallo  ")).toEqual({ ok: true, text: "Hallo" });
  });
});

describe("Migration", () => {
  const sql = readFileSync("supabase/migrations/20261002160000_vorgang_verlauf.sql", "utf8");
  const ohneKommentar = sql.split("\n").filter((z) => !z.trim().startsWith("--")).join("\n");

  it("kein Schlüsselwort, das den Bestätigungsdialog auslöst", () => {
    expect(ohneKommentar).not.toMatch(/\b(delete|drop)\b/i);
  });
  it("Schreiben nur als Nachricht, als man selbst, jetzt — für beide Rollen", () => {
    for (const rolle of ["vermieter", "mieter"]) {
      const block = new RegExp(`create policy ereignis_insert_${rolle}[\\s\\S]*?\\);\\n`).exec(ohneKommentar)![0];
      expect(block, rolle).toContain(`art = 'nachricht' and autor_rolle = '${rolle}'`);
      expect(block, rolle).toContain("autor_id = (select auth.uid())");
      expect(block, rolle).toContain("created_at between now() - interval '5 minutes'");
    }
    expect(ohneKommentar).toMatch(/ereignis_insert_mieter[\s\S]*mieter_zugang_aktiv\(a\.mieter_id\)/);
  });
  it("keine Regel zum Ändern — der Verlauf ist unveränderlich", () => {
    expect(ohneKommentar).not.toMatch(/for update/i);
  });
  it("Trigger schreiben nur für angemeldete Nutzer (sonst häufte jeder Demo-Reset Einträge an)", () => {
    const n = ohneKommentar.match(/if uid is null( or new\.anliegen_id is null)? then\s+return new;/g) ?? [];
    expect(n.length).toBe(2);
  });
  it("der Mieter sieht keine Geschäftsdaten des Auftrags", () => {
    const fn = /function public\.auftrag_verlauf_mitschreiben[\s\S]*?\$\$;/.exec(ohneKommentar)![0];
    for (const geheim of ["betrag", "lohnanteil", "service_name", "firma"]) expect(fn).not.toContain(`new.${geheim}`);
  });
  it("Bestand und Demo mit fester ID — ein zweiter Lauf legt nichts doppelt an", () => {
    expect(ohneKommentar.match(/md5\(a\.id::text \|\| ':antwort'\)::uuid/g)?.length).toBe(2);
  });
});
