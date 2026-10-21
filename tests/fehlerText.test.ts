import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fehlerText } from "@/lib/fehlerText";

// Fehlermeldungen in der Oberfläche (21.10.2026). Next schwärzt geworfene Server-Fehler in
// Produktion — `e.message` zeigte Nutzern dann einen englischen Absatz.

describe("fehlerText()", () => {
  const ERSATZ = "Nicht gespeichert — bitte erneut versuchen.";

  it("geschwärzter Server-Fehler (mit digest) → fester deutscher Satz", () => {
    const e = Object.assign(new Error("An error occurred in the Server Components render. The specific message is omitted in production builds"), { digest: "123" });
    expect(fehlerText(e, ERSATZ)).toBe(ERSATZ);
  });

  it("rohe Browser-Fehler → fester Satz", () => {
    expect(fehlerText(new TypeError("Failed to fetch"), ERSATZ)).toBe(ERSATZ);
    expect(fehlerText(new SyntaxError("Unexpected token '<'"), ERSATZ)).toBe(ERSATZ);
    expect(fehlerText("kaputt", ERSATZ)).toBe(ERSATZ);
    expect(fehlerText(new Error("   "), ERSATZ)).toBe(ERSATZ);
  });

  it("im Browser selbst geworfener Text bleibt", () => {
    expect(fehlerText(new Error("PDF zu groß (max. 20 MB)."), ERSATZ)).toBe("PDF zu groß (max. 20 MB).");
  });
});

describe("Keine Komponente zeigt e.message direkt", () => {
  const MUSTER = /\((e|err|error|fehler)\s+as\s+Error\)\??\.message|(e|err)\s+instanceof\s+Error\s*\?\s*(e|err)\.message/;
  const dateien: string[] = [];
  const sammle = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) sammle(p);
      else if (p.endsWith(".tsx")) dateien.push(p);
    }
  };
  sammle("components");
  sammle("app");

  it("der Wächter hat gesucht", () => {
    expect(dateien.length).toBeGreaterThan(200);
  });

  it("überall fehlerText() statt e.message", () => {
    const treffer = dateien.filter((p) => MUSTER.test(readFileSync(p, "utf8")));
    expect(treffer).toEqual([]);
  });

  it("die Stellen aus dem Fund benutzen fehlerText", () => {
    for (const p of ["components/MaklerOrdner.tsx", "components/MaklerLink.tsx", "components/BeleihungsOrdner.tsx", "components/DeleteButton.tsx"]) {
      expect(readFileSync(p, "utf8")).toContain("fehlerText(");
    }
  });
});
