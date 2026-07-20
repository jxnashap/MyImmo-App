import { describe, it, expect } from "vitest";
import {
  filterProgramme, PROGRAMME, LANDESBANKEN,
  foerderKredit, foerderKredite, foerderEinkommensgrenze,
  type FoerderKontext,
} from "@/lib/kauf/foerderung";

const basis: FoerderKontext = {
  nutzung: "eigennutzen", vorhaben: "kauf_bestand", einWohneinheit: true,
  kinder: 0, zveJahr: 0, eh40: false, keineFossileHeizung: false, qng: false,
  restbedarf: 400_000,
};

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

describe("Auto-Förderkredit (foerderKredit)", () => {
  it("Familie Neubau EH40 zvE 85k → KfW 300, gestaffelt nach Kindern & QNG", () => {
    const k: FoerderKontext = { ...basis, vorhaben: "neubau", kinder: 2, zveJahr: 85_000, eh40: true, keineFossileHeizung: true };
    expect(foerderKredit(k)?.key).toBe("KfW 300");
    expect(foerderKredit(k)?.hoechstbetrag).toBe(170_000);
    expect(foerderKredit({ ...k, qng: true })?.hoechstbetrag).toBe(220_000);
    expect(foerderKredit({ ...k, kinder: 3 })?.hoechstbetrag).toBe(200_000);
  });

  it("Familie Bestand Klasse G zvE 80k/1 Kind → KfW 308 (100k)", () => {
    const k: FoerderKontext = { ...basis, kinder: 1, zveJahr: 80_000, energieklasse: "G" };
    expect(foerderKredit(k)?.key).toBe("KfW 308");
    expect(foerderKredit(k)?.hoechstbetrag).toBe(100_000);
  });

  it("Eigennutzer Neubau EH40 ohne Kinder → KfW 297 (100k)", () => {
    const k: FoerderKontext = { ...basis, vorhaben: "neubau", eh40: true, keineFossileHeizung: true };
    expect(foerderKredit(k)?.key).toBe("KfW 297");
  });

  it("Eigennutzer Bestand ohne Familien-Kriterien → KfW 124 (100k)", () => {
    expect(foerderKredit({ ...basis, energieklasse: "C" })?.key).toBe("KfW 124");
  });

  it("Vermieter Neubau EH40 → KfW 298; vermieteter Bestand → null", () => {
    expect(foerderKredit({ ...basis, nutzung: "vermieten", vorhaben: "neubau", eh40: true, keineFossileHeizung: true })?.key).toBe("KfW 298");
    expect(foerderKredit({ ...basis, nutzung: "vermieten" })).toBeNull();
  });

  it("zvE=0 (unbekannt) unterdrückt Familienprogramme 300/308", () => {
    const k: FoerderKontext = { ...basis, vorhaben: "neubau", kinder: 2, zveJahr: 0, eh40: true, keineFossileHeizung: true };
    expect(foerderKredite(k).some((t) => t.key === "KfW 300")).toBe(false);
    expect(foerderKredit(k)?.key).toBe("KfW 297");
  });

  it("Segment auf Restbedarf gedeckelt", () => {
    const k: FoerderKontext = { ...basis, restbedarf: 60_000 };
    expect(foerderKredit(k)?.hoechstbetrag).toBe(100_000);
    expect(foerderKredit(k)?.segment).toBe(60_000);
  });

  it("Mehrfamilienhaus (nicht 1 WE) → kein Auto-Treffer", () => {
    expect(foerderKredite({ ...basis, einWohneinheit: false })).toHaveLength(0);
  });

  it("Einkommensgrenze steigt um 10k je weiterem Kind", () => {
    expect(foerderEinkommensgrenze(1)).toBe(90_000);
    expect(foerderEinkommensgrenze(3)).toBe(110_000);
  });
});
