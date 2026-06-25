import { describe, it, expect } from "vitest";
import { isValidIban, normalizeIban } from "@/lib/iban";

describe("normalizeIban", () => {
  it("entfernt Leerzeichen und macht Großbuchstaben", () => {
    expect(normalizeIban("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
  });
});

describe("isValidIban — Mod-97-Prüfziffer", () => {
  it("akzeptiert gültige IBANs (mit/ohne Leerzeichen)", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true); // bekannte Test-IBAN
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true);
  });

  it("lehnt falsche Prüfziffer ab (Tippfehler)", () => {
    expect(isValidIban("DE90370400440532013000")).toBe(false);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
  });

  it("lehnt strukturell ungültige Eingaben ab", () => {
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("DE")).toBe(false);
    expect(isValidIban("1234567890")).toBe(false);
    expect(isValidIban("DEAB370400440532013000")).toBe(false); // Prüfziffer keine Zahl
  });
});
