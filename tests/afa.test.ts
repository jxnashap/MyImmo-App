import { describe, it, expect } from "vitest";
import {
  afaSatzNachFertigstellung,
  degressivVsLinear,
  pruefe7b,
  verteile82b,
  kaufpreisAufteilung,
} from "@/lib/steuer/afa";

describe("afaSatzNachFertigstellung (§ 7 Abs. 4)", () => {
  it("liefert die Sätze nach Fertigstellungsjahr", () => {
    expect(afaSatzNachFertigstellung(2024)).toBe(3);
    expect(afaSatzNachFertigstellung(2000)).toBe(2);
    expect(afaSatzNachFertigstellung(1920)).toBe(2.5);
    expect(afaSatzNachFertigstellung(null)).toBe(2);
  });
});

describe("degressivVsLinear (§ 7 Abs. 5a)", () => {
  const v = degressivVsLinear(300000, 3, 15);

  it("rechnet die degressive AfA mit 5 % vom Restwert", () => {
    expect(v.plan[0].degressiv).toBe(15000); // 5 % von 300.000
    expect(v.plan[1].degressiv).toBe(14250); // 5 % von 285.000
  });

  it("nutzt den festen linearen Betrag (3 % vom Ursprung)", () => {
    expect(v.plan[0].linear).toBe(9000);
    expect(v.plan[5].linear).toBe(9000);
  });

  it("findet ein plausibles Wechseljahr (Mitte des Zeitraums)", () => {
    // Degressiv fällt unter die lineare AfA vom Restwert erst nach ~10 Jahren
    expect(v.wechseljahr).toBeGreaterThan(5);
    expect(v.wechseljahr).toBeLessThan(15);
  });

  it("die optimale Strategie schöpft in 10 Jahren mindestens so viel aus wie rein degressiv", () => {
    expect(v.summeOptimal10).toBeGreaterThanOrEqual(v.summeDegressiv10 - 0.01);
  });

  it("setzt die Nutzungsdauer aus dem linearen Satz", () => {
    expect(v.nutzungsdauer).toBe(33); // 100 / 3
  });
});

describe("pruefe7b (§ 7b Sonder-AfA)", () => {
  const gut = {
    bauantragJahr: 2024,
    neueWohnung: true,
    qngNachweis: true,
    baukostenProM2: 4800,
    flaeche: 100,
  };

  it("bestätigt Berechtigung bei erfüllten Voraussetzungen und deckelt die BMG auf 4.000 €/m²", () => {
    const r = pruefe7b(gut);
    expect(r.berechtigt).toBe(true);
    expect(r.bemessungsgrundlageProM2).toBe(4000); // gedeckelt
    expect(r.maxSonderAfaProJahr).toBe(20000); // 4000 × 100 × 5 %
  });

  it("verweigert bei überschrittener Baukostengrenze", () => {
    const r = pruefe7b({ ...gut, baukostenProM2: 6000 });
    expect(r.berechtigt).toBe(false);
    expect(r.maxSonderAfaProJahr).toBe(0);
  });

  it("verweigert außerhalb des Förderzeitraums", () => {
    expect(pruefe7b({ ...gut, bauantragJahr: 2022 }).berechtigt).toBe(false);
    expect(pruefe7b({ ...gut, bauantragJahr: 2030 }).berechtigt).toBe(false);
  });

  it("verweigert ohne QNG-Nachweis", () => {
    expect(pruefe7b({ ...gut, qngNachweis: false }).berechtigt).toBe(false);
  });
});

describe("verteile82b (§ 82b EStDV)", () => {
  it("verteilt gleichmäßig und begrenzt auf 2–5 Jahre", () => {
    const r = verteile82b(12000, 3);
    expect(r.jahre).toBe(3);
    expect(r.proJahr).toBe(4000);
    expect(verteile82b(12000, 9).jahre).toBe(5); // gedeckelt
  });

  it("berechnet die Steuerersparnis bei angegebenem Grenzsteuersatz", () => {
    const r = verteile82b(10000, 5, 42);
    expect(r.sofortSteuerersparnis).toBe(4200);
    expect(r.verteiltErsparnisProJahr).toBe(840); // 2000 × 42 %
  });
});

describe("kaufpreisAufteilung", () => {
  it("teilt nach Bodenwert (Fläche × Bodenrichtwert)", () => {
    const r = kaufpreisAufteilung(400000, 200, 500)!; // Boden 100.000
    expect(r.bodenwert).toBe(100000);
    expect(r.gebaeudewert).toBe(300000);
    expect(r.gebaeudeanteilProzent).toBe(75);
    expect(r.grundanteilProzent).toBe(25);
  });

  it("setzt ohne Bodenwert den vollen Preis als Gebäude an", () => {
    const r = kaufpreisAufteilung(400000, null, null)!;
    expect(r.gebaeudeanteilProzent).toBe(100);
  });

  it("kappt den Bodenwert auf den Kaufpreis", () => {
    const r = kaufpreisAufteilung(100000, 1000, 500)!; // Boden 500.000 > Preis
    expect(r.bodenwert).toBe(100000);
    expect(r.gebaeudewert).toBe(0);
  });

  it("liefert null bei ungültigem Kaufpreis", () => {
    expect(kaufpreisAufteilung(0, 100, 100)).toBeNull();
  });
});
