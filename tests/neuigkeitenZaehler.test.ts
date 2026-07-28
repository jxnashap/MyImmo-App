import { describe, it, expect } from "vitest";

// Die Zähl-Regeln aus lib/neuigkeiten.ts als reine Funktionen nachgebildet,
// damit die Definition getestet ist, ohne Supabase zu brauchen. Ändert sich
// die Regel dort, muss sie hier mitgezogen werden.

type Mieter = {
  id: string;
  kaltmiete: number | null;
  nk_vorauszahlung: number | null;
  stellplatz_miete: number | null;
  mietbeginn: string | null;
  mietende: string | null;
};

function offeneMieten(mieter: Mieter[], gebucht: Set<string>, monat: string): number {
  const monatsStart = `${monat}-01`;
  return mieter.filter((m) => {
    const soll = (m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0) + (m.stellplatz_miete ?? 0);
    if (soll <= 0 || !m.mietbeginn) return false;
    if (m.mietbeginn > `${monat}-31`) return false;
    if (m.mietende && m.mietende < monatsStart) return false;
    return !gebucht.has(`${m.id}|${monat}`);
  }).length;
}

const m = (id: string, over: Partial<Mieter> = {}): Mieter => ({
  id, kaltmiete: 700, nk_vorauszahlung: 150, stellplatz_miete: null,
  mietbeginn: "2020-01-01", mietende: null, ...over,
});

describe("offene Mieteingänge des Monats", () => {
  const monat = "2026-07";

  it("zählt Mieter ohne gebuchte Miete", () => {
    expect(offeneMieten([m("a"), m("b")], new Set(), monat)).toBe(2);
  });

  it("bereits gebuchte zählen nicht mehr", () => {
    expect(offeneMieten([m("a"), m("b")], new Set(["a|2026-07"]), monat)).toBe(1);
  });

  it("eine Buchung für einen ANDEREN Monat zählt nicht als erledigt", () => {
    expect(offeneMieten([m("a")], new Set(["a|2026-06"]), monat)).toBe(1);
  });

  it("Mietverhältnis ohne Soll wird ignoriert", () => {
    expect(offeneMieten([m("a", { kaltmiete: 0, nk_vorauszahlung: 0 })], new Set(), monat)).toBe(0);
  });

  it("beendete Mietverhältnisse zählen nicht", () => {
    expect(offeneMieten([m("a", { mietende: "2026-06-30" })], new Set(), monat)).toBe(0);
  });

  it("ein im selben Monat endendes Mietverhältnis zählt noch", () => {
    expect(offeneMieten([m("a", { mietende: "2026-07-31" })], new Set(), monat)).toBe(1);
  });

  it("später beginnende Mietverhältnisse zählen nicht", () => {
    expect(offeneMieten([m("a", { mietbeginn: "2026-09-01" })], new Set(), monat)).toBe(0);
  });

  it("ohne Mietbeginn kein Soll", () => {
    expect(offeneMieten([m("a", { mietbeginn: null })], new Set(), monat)).toBe(0);
  });
});
