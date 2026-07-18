import { describe, it, expect } from "vitest";
import { filterProgramme, PROGRAMME, LANDESBANKEN } from "@/lib/kauf/foerderung";

describe("Fördercheck", () => {
  it("Selbstnutzer-Programme erscheinen nicht für Vermieter", () => {
    const vermieterKauf = filterProgramme("vermieten", "kauf_bestand");
    expect(vermieterKauf.some((p) => p.key === "kfw124")).toBe(false);
    expect(vermieterKauf.some((p) => p.key === "kfw308")).toBe(false);
    const eigenKauf = filterProgramme("eigennutzen", "kauf_bestand");
    expect(eigenKauf.some((p) => p.key === "kfw124")).toBe(true);
    expect(eigenKauf.some((p) => p.key === "kfw308")).toBe(true);
  });

  it("Heizung: KfW 458 für beide, § 35c nur Eigennutzer", () => {
    expect(filterProgramme("vermieten", "heizung").map((p) => p.key)).toContain("kfw458");
    expect(filterProgramme("vermieten", "heizung").map((p) => p.key)).not.toContain("steuer35c");
    expect(filterProgramme("eigennutzen", "heizung").map((p) => p.key)).toContain("steuer35c");
  });

  it("Neubau-Vermieter bekommt KfW 297/298, aber nicht KfW 300", () => {
    const keys = filterProgramme("vermieten", "neubau").map((p) => p.key);
    expect(keys).toContain("kfw297");
    expect(keys).not.toContain("kfw300");
  });

  it("jede Kombination liefert mindestens ein Programm", () => {
    for (const n of ["vermieten", "eigennutzen"] as const) {
      for (const v of ["kauf_bestand", "neubau", "sanierung", "heizung"] as const) {
        expect(filterProgramme(n, v).length, `${n}/${v}`).toBeGreaterThan(0);
      }
    }
  });

  it("alle 16 Bundesländer haben eine Landesförderbank mit URL", () => {
    expect(Object.keys(LANDESBANKEN)).toHaveLength(16);
    for (const l of Object.values(LANDESBANKEN)) expect(l.url).toMatch(/^https:\/\//);
  });

  it("jedes Programm hat Nutzung + Vorhaben + Link", () => {
    for (const p of PROGRAMME) {
      expect(p.fuer.length).toBeGreaterThan(0);
      expect(p.vorhaben.length).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https:\/\//);
    }
  });
});
