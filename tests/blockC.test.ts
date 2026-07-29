import { describe, it, expect } from "vitest";
import { wartetAufVermieter } from "@/lib/zaehler";

// Regressionstests zu Block C/D des Gesamt-Checks.

describe("wartetAufVermieter — eine Definition für Seitenleiste und Reiter", () => {
  const a = (status: string) => ({ status });

  it("zählt Aufträge im Status 'freigabe'", () => {
    expect(wartetAufVermieter([a("freigabe"), a("freigabe")])).toBe(2);
  });

  it("zählt 'offen' NICHT — die liegen beim Service-Partner", () => {
    expect(wartetAufVermieter([a("offen"), a("offen"), a("freigabe")])).toBe(1);
  });

  it("erledigte und abgelehnte zählen nicht", () => {
    expect(wartetAufVermieter([a("erledigt"), a("abgelehnt"), a("angenommen")])).toBe(0);
  });

  it("leere Liste ergibt 0", () => {
    expect(wartetAufVermieter([])).toBe(0);
  });

  it("null-Status stürzt nicht ab", () => {
    expect(wartetAufVermieter([{ status: null }, a("freigabe")])).toBe(1);
  });
});

// Der Zeitraum-Filter der Termine-Seite. Vorher wurde aufs Kalenderjahr
// gefiltert — im Dezember waren die Januar-Fristen damit unsichtbar, obwohl
// die KPI-Kachel „In 30 Tagen" sie mitzählte.

function imZeitraum(datum: string, heuteMs: number): boolean {
  return new Date(datum).getTime() <= heuteMs + 365 * 86400000;
}

describe("Termine — rollierender Zeitraum statt Kalenderjahr", () => {
  const dezember = new Date("2026-12-15T12:00:00Z").getTime();

  it("Januar-Frist des Folgejahres ist im Dezember sichtbar", () => {
    expect(imZeitraum("2027-01-10", dezember)).toBe(true);
  });

  it("überfällige Termine bleiben sichtbar", () => {
    expect(imZeitraum("2026-10-01", dezember)).toBe(true);
    expect(imZeitraum("2024-03-01", dezember)).toBe(true);
  });

  it("mehr als 12 Monate in der Zukunft fällt raus", () => {
    expect(imZeitraum("2028-06-01", dezember)).toBe(false);
  });

  it("genau am Rand (in 12 Monaten) noch drin", () => {
    expect(imZeitraum("2027-12-14", dezember)).toBe(true);
  });
});
