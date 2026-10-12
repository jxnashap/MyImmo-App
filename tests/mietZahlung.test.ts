import { describe, it, expect } from "vitest";
import { monatsStand, monatBezahlt, nkAnteilFuer, verteileZahlung } from "@/lib/mietZahlung";
import { zaehlerVerbrauch, type ZaehlerMeldung } from "@/lib/zaehlerVerbrauch";

// B09/B10/B11 (Prüfstand 11.10.2026) — die reinen Regeln hinter Mietkonto und Zählerübernahme.

const M = { kaltmiete: 700, nk_vorauszahlung: 150, stellplatz_miete: null, mietbeginn: "2025-01-01", mietende: null };
const stand = (buchungen: { soll_monat: string; betrag: number; nk_anteil: number }[] = []) =>
  (ym: string) => monatsStand(M, [], buchungen.map((b) => ({ ...b, buchungsdatum: `${b.soll_monat}-03` })), ym);

describe("monatsStand", () => {
  it("Soll, gezahlt, Rest — Altzeilen ohne Monat zählen nach Buchungsdatum", () => {
    const s = monatsStand(M, [], [
      { soll_monat: null, buchungsdatum: "2025-03-28", betrag: 400, nk_anteil: 70 },
      { soll_monat: "2025-02", buchungsdatum: "2025-03-01", betrag: 850, nk_anteil: 150 },
    ], "2025-03");
    expect(s).toMatchObject({ gezahlt: 400, nkGezahlt: 70, rest: 450 });
    expect(monatBezahlt(s)).toBe(false);
  });
  it("bis 1 € Fehlbetrag gilt als bezahlt; außerhalb der Mietzeit gibt es kein Soll", () => {
    expect(monatBezahlt(stand([{ soll_monat: "2025-03", betrag: 849.5, nk_anteil: 150 }])("2025-03"))).toBe(true);
    expect(monatBezahlt(stand([{ soll_monat: "2025-03", betrag: 848, nk_anteil: 150 }])("2025-03"))).toBe(false);
    expect(stand()("2024-12").soll).toBeNull();
  });
});

describe("nkAnteilFuer", () => {
  it("anteilig zur Zahlung, höchstens die noch offene Vorauszahlung", () => {
    expect(nkAnteilFuer(stand()("2025-03"), 425)).toBe(75);
    expect(nkAnteilFuer(stand()("2025-03"), 2000)).toBe(150);
    expect(nkAnteilFuer(stand([{ soll_monat: "2025-03", betrag: 850, nk_anteil: 150 }])("2025-03"), 100)).toBe(0);
  });
  it("ohne Vorauszahlung oder ohne Soll: null (nicht 0 — es gibt keinen Anteil)", () => {
    expect(nkAnteilFuer(monatsStand({ ...M, nk_vorauszahlung: 0 }, [], [], "2025-03"), 700)).toBeNull();
    expect(nkAnteilFuer(stand()("2024-01"), 700)).toBeNull();
  });
});

describe("verteileZahlung", () => {
  it("Sammelzahlung: Rest des Startmonats, dann die folgenden offenen Monate", () => {
    const v = verteileZahlung(2000, "2025-03", "2025-06", stand([{ soll_monat: "2025-03", betrag: 300, nk_anteil: 52.94 }]));
    expect(v.teile.map((t) => [t.jahrMonat, t.betrag])).toEqual([["2025-03", 550], ["2025-04", 850], ["2025-05", 600]]);
    expect(v.ueberzahlung).toBe(0);
  });
  it("bezahlte Monate werden übersprungen, frühere nie angefasst", () => {
    const v = verteileZahlung(850, "2025-03", "2025-05", stand([{ soll_monat: "2025-03", betrag: 850, nk_anteil: 150 }, { soll_monat: "2025-02", betrag: 0, nk_anteil: 0 }]));
    expect(v.teile.map((t) => t.jahrMonat)).toEqual(["2025-04"]);
  });
  it("was nach dem letzten offenen Monat übrig bleibt, ist Überzahlung und geht in den letzten Teil", () => {
    const v = verteileZahlung(1000, "2025-03", "2025-03", stand());
    expect(v).toEqual({ teile: [{ jahrMonat: "2025-03", betrag: 1000, nk: 150 }], ueberzahlung: 150 });
  });
  it("ein Rest bis zur Toleranz bleibt im Monat, statt einen Cent-Teil im Folgemonat zu erzeugen", () => {
    const v = verteileZahlung(850.6, "2025-03", "2025-06", stand());
    expect(v).toEqual({ teile: [{ jahrMonat: "2025-03", betrag: 850.6, nk: 150 }], ueberzahlung: 0 });
  });
  it("nichts offen: die ganze Zahlung ist Überzahlung im Startmonat", () => {
    const v = verteileZahlung(200, "2025-03", "2025-03", stand([{ soll_monat: "2025-03", betrag: 850, nk_anteil: 150 }]));
    expect(v).toEqual({ teile: [{ jahrMonat: "2025-03", betrag: 200, nk: 0 }], ueberzahlung: 200 });
  });
  it("die Summe der Teile ist immer genau der Zahlbetrag", () => {
    for (const betrag of [1, 425.37, 850, 1699.99, 3000]) {
      const v = verteileZahlung(betrag, "2025-03", "2025-05", stand());
      expect(Math.round(v.teile.reduce((s, t) => s + t.betrag, 0) * 100) / 100).toBe(betrag);
    }
  });
});

describe("zaehlerVerbrauch", () => {
  const m = (over: Partial<ZaehlerMeldung> = {}): ZaehlerMeldung => ({
    art: "Strom", einheit: "kWh", zaehlernummer: null, mieter_id: "m1", prop_id: "p1", stand: 1000, ablesedatum: "2026-01-01", ...over,
  });
  it("jüngste frühere Meldung desselben Zählers", () => {
    const r = zaehlerVerbrauch(m({ stand: 1500, ablesedatum: "2026-09-01" }), [m({ stand: 900, ablesedatum: "2025-09-01" }), m({ stand: 1200, ablesedatum: "2026-06-01" })]);
    expect(r).toEqual({ art: "verbrauch", menge: 300, vorher: { stand: 1200, ablesedatum: "2026-06-01" } });
  });
  it("mit Nummer: an anderem Objekt ist es ein anderer Zähler", () => {
    expect(zaehlerVerbrauch(m({ zaehlernummer: "A1", stand: 1500, ablesedatum: "2026-09-01" }), [m({ zaehlernummer: "A1", prop_id: "p2" })]).art).toBe("erste");
  });
  it("mit Nummer: ein Mieterwechsel ändert den Zähler nicht", () => {
    expect(zaehlerVerbrauch(m({ zaehlernummer: "A1", mieter_id: "m2", stand: 1500, ablesedatum: "2026-09-01" }), [m({ zaehlernummer: "A1" })])).toMatchObject({ art: "verbrauch", menge: 500 });
  });
  it("andere Zählerart zählt nie", () => {
    expect(zaehlerVerbrauch(m({ art: "Wasser", stand: 1500, ablesedatum: "2026-09-01" }), [m()]).art).toBe("erste");
  });
});
