import { describe, it, expect } from "vitest";
import { iso, addMonate, addTage } from "@/lib/datum";

// Regressionstests zum Sommerzeit-Fehler: Die frühere Variante rechnete mit
// lokalen Gettern/Settern und formatierte mit toISOString() in UTC — jedes
// abgeleitete Datum zwischen April und Oktober lag dadurch einen Tag zu früh
// (Kündigungsfristen, Staffelstufen, Zinsbindung, Energieausweis …).
describe("addMonate (DST-fest)", () => {
  it("bleibt beim Sprung Winter → Sommer auf demselben Tag", () => {
    expect(iso(addMonate(new Date("2026-01-15"), 6))).toBe("2026-07-15");
    expect(iso(addMonate(new Date("2026-01-15"), 18))).toBe("2027-07-15");
    expect(iso(addMonate(new Date("2026-02-28"), 4))).toBe("2026-06-28");
  });

  it("bleibt beim Sprung Sommer → Winter auf demselben Tag", () => {
    expect(iso(addMonate(new Date("2026-07-15"), 6))).toBe("2027-01-15");
    expect(iso(addMonate(new Date("2026-09-30"), 3))).toBe("2026-12-30");
  });

  it("rollt nicht in den Folgemonat, wenn der Zielmonat kürzer ist", () => {
    expect(iso(addMonate(new Date("2026-03-31"), -1))).toBe("2026-02-28");
    expect(iso(addMonate(new Date("2024-03-31"), -1))).toBe("2024-02-29"); // Schaltjahr
    expect(iso(addMonate(new Date("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonate(new Date("2026-05-31"), 1))).toBe("2026-06-30");
  });

  it("rechnet über Jahresgrenzen und rückwärts", () => {
    expect(iso(addMonate(new Date("2026-11-15"), 3))).toBe("2027-02-15");
    expect(iso(addMonate(new Date("2026-02-15"), -3))).toBe("2025-11-15");
    expect(iso(addMonate(new Date("2026-06-15"), 0))).toBe("2026-06-15");
  });

  it("verändert das Ausgangsdatum nicht", () => {
    const d = new Date("2026-01-15");
    addMonate(d, 6);
    expect(iso(d)).toBe("2026-01-15");
  });
});

describe("addTage", () => {
  it("überspringt die Zeitumstellung ohne Tagesverlust", () => {
    // 29.03.2026 ist der Umstellungstag in Europa
    expect(iso(addTage(new Date("2026-03-28"), 2))).toBe("2026-03-30");
    expect(iso(addTage(new Date("2026-10-24"), 2))).toBe("2026-10-26");
  });
});
