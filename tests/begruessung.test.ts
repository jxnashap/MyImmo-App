import { describe, it, expect } from "vitest";
import { begruessung, stundeInDE } from "@/lib/format";

// Regression: Die Dashboard-Begrüßung stand rund um die Uhr auf „Guten Abend".
// Ursache war nicht die Zeitzone (die war korrekt Europe/Berlin), sondern das
// Parsen: `Intl…({hour:"numeric",hour12:false}).format()` liefert in de-DE
// „11 Uhr", und `Number("11 Uhr")` ist NaN — beide Vergleiche gegen NaN sind
// false, also fiel die Kette immer bis zum letzten Zweig durch.

// Hilfsmittel: ein UTC-Zeitpunkt, der in Berlin auf die gewünschte Stunde
// fällt. Ende August gilt CEST (UTC+2).
const berlinSommer = (stunde: number) => new Date(Date.UTC(2026, 7, 28, stunde - 2, 30));
// Im Januar gilt CET (UTC+1) — prüft, dass die Sommerzeit nicht fest verdrahtet ist.
const berlinWinter = (stunde: number) => new Date(Date.UTC(2026, 0, 15, stunde - 1, 30));

describe("stundeInDE", () => {
  it("liefert eine Zahl, nicht NaN (der eigentliche Bug)", () => {
    const h = stundeInDE(berlinSommer(11));
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBe(11);
  });

  it("rechnet in deutsche Zeit um, nicht in UTC", () => {
    // 22:30 UTC ist in Berlin bereits 00:30 des Folgetags.
    expect(stundeInDE(new Date(Date.UTC(2026, 7, 28, 22, 30)))).toBe(0);
  });

  it("berücksichtigt Winterzeit", () => {
    expect(stundeInDE(berlinWinter(9))).toBe(9);
  });
});

describe("begruessung", () => {
  it("Morgen bis 10:59", () => {
    expect(begruessung(berlinSommer(6))).toBe("Guten Morgen");
    expect(begruessung(berlinSommer(10))).toBe("Guten Morgen");
  });

  it("Tag von 11 bis 17:59 — der Fall, der vorher falsch war", () => {
    expect(begruessung(berlinSommer(11))).toBe("Guten Tag");
    expect(begruessung(berlinSommer(14))).toBe("Guten Tag");
    expect(begruessung(berlinSommer(17))).toBe("Guten Tag");
  });

  it("Abend ab 18", () => {
    expect(begruessung(berlinSommer(18))).toBe("Guten Abend");
    expect(begruessung(berlinSommer(23))).toBe("Guten Abend");
  });

  it("deckt alle 24 Stunden ab und liefert nie einen leeren Wert", () => {
    const gesehen = new Set<string>();
    for (let h = 0; h < 24; h++) gesehen.add(begruessung(berlinSommer(h)));
    expect(gesehen).toEqual(new Set(["Guten Morgen", "Guten Tag", "Guten Abend"]));
  });
});
