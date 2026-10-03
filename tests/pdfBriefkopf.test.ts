// Verbindliche Dokumentregel (CLAUDE.md, „Dokument-/PDF-Design“): Der kurze vertikale
// Goldstrich im Briefkopf sitzt exakt auf der Blattmitte (x = A4.w / 2). Bis 03.10.2026 stand
// er in allen sieben App-PDFs fest bei x = 372 — 74 pt rechts der Mitte.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const dir = path.resolve(__dirname, "../lib/pdf");
const dateien = readdirSync(dir).filter((f) => f.endsWith(".ts"));
// Der vertikale Strich: Start und Ende mit gleichem x, y von A4.h - 44 bis A4.h - 82.
const STRICH = /start:\s*\{\s*x:\s*([^,]+),\s*y:\s*A4\.h\s*-\s*44\s*\}\s*,\s*end:\s*\{\s*x:\s*([^,]+),\s*y:\s*A4\.h\s*-\s*82\s*\}/g;

describe("Briefkopf: Goldstrich auf der Blattmitte", () => {
  const funde = dateien.flatMap((f) =>
    [...readFileSync(path.join(dir, f), "utf8").matchAll(STRICH)].map((m) => ({ f, start: m[1].trim(), ende: m[2].trim() })),
  );

  it("findet die Briefkopf-Striche überhaupt (sonst prüft der Test nichts)", () => {
    expect(funde.length).toBeGreaterThanOrEqual(7);
  });

  it.each(dateien)("%s setzt den Strich auf A4.w / 2", (f) => {
    for (const x of funde.filter((z) => z.f === f)) {
      expect(x.start).toBe("A4.w / 2");
      expect(x.ende).toBe("A4.w / 2");
    }
  });
});
