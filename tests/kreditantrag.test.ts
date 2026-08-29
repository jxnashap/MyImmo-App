import { describe, it, expect } from "vitest";
import { baueKreditObjekt } from "@/lib/kauf/kreditantrag";
import type { KaufAuswahl } from "@/lib/kauf/auswahl";

// Regressionstest zu dem Fehler, bei dem der Kreditantrag OHNE Objektteil zur
// Bank ging: Die Route prüfte auf `kaufpreis`, die gespeicherte KaufAuswahl
// führt das Feld aber als `kp`. Deshalb hier bewusst der ECHTE KaufAuswahl-Typ
// — ein von Hand gebautes Objekt mit `kaufpreis` würde den Fehler nie finden.
const auswahl: KaufAuswahl = {
  kalkId: "abc",
  name: "ETW Lindenstraße 12",
  adresse: "Lindenstr. 12, 23611 Bad Schwartau",
  kp: 320000,
  gesamtInvest: 355000,
  eigenkapital: 80000,
  darlehen: 275000,
  rate: 1350,
  kaltmiete: 1100,
  cfNetto: 120,
  nutzung: "vermieten",
  gewaehltAm: "2026-08-29",
};

describe("baueKreditObjekt", () => {
  it("übernimmt den Kaufpreis aus dem echten Feld `kp`", () => {
    const o = baueKreditObjekt(auswahl, 90000, 265000);
    expect(o).not.toBeNull();
    expect(o!.kaufpreis).toBe(320000);
    expect(o!.name).toBe("ETW Lindenstraße 12");
    expect(o!.gesamtInvest).toBe(355000);
    expect(o!.kaltmiete).toBe(1100);
  });

  it("nimmt das Eigenkapital aus der Selbstauskunft, nicht aus der Auswahl", () => {
    // auswahl.eigenkapital = 80000 wird bewusst ignoriert
    expect(baueKreditObjekt(auswahl, 90000, 265000)!.eigenkapital).toBe(90000);
  });

  it("nutzt den Darlehenswunsch, wenn vorhanden", () => {
    expect(baueKreditObjekt(auswahl, 90000, 265000)!.darlehen).toBe(265000);
  });

  it("leitet das Darlehen sonst aus Gesamtinvest − Eigenkapital ab", () => {
    expect(baueKreditObjekt(auswahl, 90000, 0)!.darlehen).toBe(265000);
  });

  it("wird nie negativ, wenn das Eigenkapital die Investition übersteigt", () => {
    expect(baueKreditObjekt(auswahl, 400000, 0)!.darlehen).toBe(0);
  });

  it("akzeptiert weiterhin `kaufpreis` als Alias (ältere Stände)", () => {
    expect(baueKreditObjekt({ kaufpreis: 250000 }, 50000, 0)!.kaufpreis).toBe(250000);
  });

  it("liefert null ohne Auswahl oder ohne Kaufpreis", () => {
    expect(baueKreditObjekt(null, 90000, 0)).toBeNull();
    expect(baueKreditObjekt(undefined, 90000, 0)).toBeNull();
    expect(baueKreditObjekt({ ...auswahl, kp: 0 }, 90000, 0)).toBeNull();
  });
});
