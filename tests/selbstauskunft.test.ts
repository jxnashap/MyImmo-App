import { describe, it, expect } from "vitest";
import {
  LEERE_SELBSTAUSKUNFT, normalisiereSelbstauskunft, eigenkapitalGesamt, haushaltsNetto,
} from "@/lib/kauf/selbstauskunft";

describe("Selbstauskunft-Helfer", () => {
  it("normalisiere füllt fehlende Felder aus dem Default", () => {
    const d = normalisiereSelbstauskunft({ einkommen: 3000 });
    expect(d.einkommen).toBe(3000);
    expect(d.anzahlPersonen).toBe(1);
    expect(d.beschaeftigung).toBe("angestellt");
  });

  it("eigenkapitalGesamt summiert Vermögensposten (negatives ignoriert)", () => {
    const d = { ...LEERE_SELBSTAUSKUNFT, bankguthaben: 20000, wertpapiere: 15000, bausparen: 5000, sonstigesVermoegen: -100 };
    expect(eigenkapitalGesamt(d)).toBe(40000);
  });

  it("haushaltsNetto zählt Mieteinnahmen NICHT mit", () => {
    const d = { ...LEERE_SELBSTAUSKUNFT, einkommen: 2500, einkommenPartner: 2000, kindergeld: 250, sonstigeEinnahmen: 100, mieteinnahmen: 800 };
    expect(haushaltsNetto(d)).toBe(4850);
  });
});
