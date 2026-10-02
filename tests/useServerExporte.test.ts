import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

// Eine „use server“-Datei darf nur async-Funktionen exportieren — sonst bricht der
// Turbopack-Build ab („Only async functions are allowed to be exported“). Am 02.10.2026
// fiel das erst im Build auf (zwei Konstanten in lib/actions/mitteilungen.ts); die Tests
// waren grün, weil vitest die Regel nicht kennt. Typen sind erlaubt (werden entfernt).
const dateien = readdirSync("lib/actions").filter((f) => f.endsWith(".ts")).map((f) => `lib/actions/${f}`);

describe("use server: nur async-Funktionen exportieren", () => {
  it("der Wächter hat Dateien gefunden", () => {
    expect(dateien.length).toBeGreaterThan(30);
  });
  for (const datei of dateien) {
    const text = readFileSync(datei, "utf8");
    if (!/^\s*["']use server["'];?/m.test(text.split("\n").slice(0, 3).join("\n"))) continue;
    it(datei, () => {
      const falsch = text.split("\n").filter((z) => /^export\s/.test(z) && !/^export\s+(async\s+function|type\s|interface\s)/.test(z));
      expect(falsch).toEqual([]);
    });
  }
});
