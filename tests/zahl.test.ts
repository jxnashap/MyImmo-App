import { describe, it, expect } from "vitest";
import { zahlDe, zahlDe0 } from "@/lib/zahl";

describe("zahlDe — deutsche Tausenderpunkte", () => {
  it("liest Tausenderpunkte korrekt (der Fehler im Marktwert-Schätzer)", () => {
    expect(zahlDe("8.520")).toBe(8520);
    expect(zahlDe("415.000")).toBe(415000);
    expect(zahlDe("1.234.567")).toBe(1234567);
  });

  it("Komma bleibt Dezimaltrenner", () => {
    expect(zahlDe("3,5")).toBe(3.5);
    expect(zahlDe("8.520,50")).toBe(8520.5);
    expect(zahlDe("1.234.567,89")).toBe(1234567.89);
  });

  it("englische Dezimalpunkte bleiben erhalten (Regler-Vorgaben wie 1.9)", () => {
    expect(zahlDe("1.9")).toBe(1.9);
    expect(zahlDe("1.0")).toBe(1);
    expect(zahlDe("3.75")).toBe(3.75);
  });

  it("ignoriert Währungszeichen und Leerraum", () => {
    expect(zahlDe("€ 415.000")).toBe(415000);
    expect(zahlDe("  8520  ")).toBe(8520);
  });

  it("leer/Unsinn → null", () => {
    expect(zahlDe("")).toBeNull();
    expect(zahlDe("   ")).toBeNull();
    expect(zahlDe("abc")).toBeNull();
    expect(zahlDe(null)).toBeNull();
    expect(zahlDe(undefined)).toBeNull();
  });

  it("negative Werte bleiben negativ", () => {
    expect(zahlDe("-1.500")).toBe(-1500);
  });
});

describe("zahlDe0", () => {
  it("liefert 0 statt null", () => {
    expect(zahlDe0("")).toBe(0);
    expect(zahlDe0("abc")).toBe(0);
    expect(zahlDe0("8.520")).toBe(8520);
  });
});

describe("Regression: Ertragswert wurde durch die Fehl-Lesung 0", () => {
  it("8.520 ist eine Jahresmiete, kein Cent-Betrag", () => {
    // Vorher: parseFloat("8.520") === 8.52 → Ertragswert 0 → Speichern abgelehnt.
    expect(zahlDe0("8.520")).toBeGreaterThan(8000);
  });
});

describe("Regression: führende Null ist ein Dezimalpunkt, kein Tausenderpunkt", () => {
  // Der Kauf-Rechner las den Grunderwerbsteuersatz aus der Bundesland-Auswahl
  // ("0.035") durch diesen Parser. Die 3er-Gruppen-Regel machte daraus 35 —
  // also 3500 % Grunderwerbsteuer und Nebenkosten um den Faktor 1000 zu hoch.
  it.each([
    ["0.035", 0.035], // Bayern 3,5 %
    ["0.055", 0.055], // Bremen, Hamburg, Sachsen 5,5 %
    ["0.065", 0.065], // Brandenburg, NRW, Saarland, Schleswig-Holstein 6,5 %
    ["0.025", 0.025],
    ["0.001", 0.001],
    ["0.5", 0.5],
    ["0.05", 0.05], // rechnete zufällig schon vorher richtig
    ["0.06", 0.06],
  ])("liest %j als %d", (roh, erwartet) => {
    expect(zahlDe(roh)).toBeCloseTo(erwartet, 10);
  });

  it("bleibt bei negativen Dezimalwerten korrekt", () => {
    expect(zahlDe("-0.035")).toBeCloseTo(-0.035, 10);
  });

  it("echte Tausenderpunkte werden weiterhin erkannt", () => {
    expect(zahlDe("1.234")).toBe(1234);
    expect(zahlDe("415.000")).toBe(415000);
    expect(zahlDe("1.234.567")).toBe(1234567);
  });

  it("deutsche Kommaschreibweise mit führender Null bleibt korrekt", () => {
    expect(zahlDe("0,035")).toBeCloseTo(0.035, 10);
    expect(zahlDe("0,5")).toBe(0.5);
  });

  it("Grunderwerbsteuer aller 16 Bundesländer bleibt unter 10 %", () => {
    // Der eigentliche Schaden: nkSatz ging in die Nebenkosten ein.
    const saetze = ["0.035", "0.05", "0.055", "0.06", "0.065"];
    for (const s of saetze) expect(zahlDe0(s)).toBeLessThan(0.1);
  });
});
