import { describe, it, expect } from "vitest";
import { zahlDe, datumIsoDe, nameSplit } from "@/lib/onboardingParse";

describe("zahlDe", () => {
  it("parst deutsche Formate", () => {
    expect(zahlDe("189.000")).toBe(189000);
    expect(zahlDe("1.234,56")).toBe(1234.56);
    expect(zahlDe("3,9")).toBe(3.9);
    expect(zahlDe("710")).toBe(710);
    expect(zahlDe("€ 2.130")).toBe(2130);
  });
  it("verzeiht englische Dezimalpunkte", () => {
    expect(zahlDe("3.9")).toBe(3.9);
  });
  it("leer/Unsinn → null", () => {
    expect(zahlDe("")).toBeNull();
    expect(zahlDe("  ")).toBeNull();
    expect(zahlDe("drei")).toBeNull();
    expect(zahlDe(null)).toBeNull();
  });
});

describe("datumIsoDe", () => {
  it("TT.MM.JJJJ → ISO", () => {
    expect(datumIsoDe("1.8.2026")).toBe("2026-08-01");
    expect(datumIsoDe("01.08.2026")).toBe("2026-08-01");
    expect(datumIsoDe("31.12.2027")).toBe("2027-12-31");
  });
  it("ISO wird durchgereicht", () => {
    expect(datumIsoDe("2026-08-01")).toBe("2026-08-01");
  });
  it("ungültig → null (kein Rollover)", () => {
    expect(datumIsoDe("31.2.2026")).toBeNull();
    expect(datumIsoDe("kein datum")).toBeNull();
    expect(datumIsoDe("")).toBeNull();
  });
});

describe("nameSplit", () => {
  it("teilt beim letzten Leerzeichen", () => {
    expect(nameSplit("Anna Berger")).toEqual({ vorname: "Anna", nachname: "Berger" });
    expect(nameSplit("Karl Heinz Müller")).toEqual({ vorname: "Karl Heinz", nachname: "Müller" });
    expect(nameSplit("Berger")).toEqual({ vorname: null, nachname: "Berger" });
  });
});
