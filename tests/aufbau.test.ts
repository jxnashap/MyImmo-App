import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bestandLage, type AufbauKredit, type AufbauObjekt } from "@/lib/aufbau";
import { MAKLER_CHECKLISTE, maklerErledigt } from "@/lib/makler";

// BuyImmo-Kommandozentrale (05.10.2026). Die Zahlen MÜSSEN mit Dashboard und /kredite
// übereinstimmen — die Testwerte sind so gewählt, dass jede abweichende Regel ein anderes
// Ergebnis liefert (Lehre aus reviewRunde3: gleiche Zahlen auf zwei Wegen beweisen nichts).

const obj = (id: string, wert: number | null, kaufpreis: number | null = null): AufbauObjekt => ({
  id, bezeichnung: id, wert, kaufpreis,
});
const kredit = (prop_id: string | null, restschuld: number | null, grundschuld: number | null = null): AufbauKredit => ({
  prop_id, restschuld, grundschuld, betrag: null, monatsrate: null, zinssatz: null,
});

describe("bestandLage", () => {
  it("Normalfall: Wert − Restschuld = Eigenkapital, Restschuld in % vom Wert", () => {
    // 300.000 + 200.000 = 500.000 Wert; 180.000 + 120.000 = 300.000 Schuld → 200.000 EK, 60 %.
    const l = bestandLage([obj("a", 300_000), obj("b", 200_000)], [kredit("a", 180_000), kredit("b", 120_000)]);
    expect(l).toMatchObject({ objekte: 2, ohneWert: 0, wert: 500_000, restschuld: 300_000, eigenkapital: 200_000, restschuldProzent: 60 });
  });

  it("leere Listen (neues Konto) — alles 0, kein Prozent, keine freie Grundschuld", () => {
    expect(bestandLage([], [])).toEqual({
      objekte: 0, ohneWert: 0, wert: 0, restschuld: 0, restschuldProzent: null, eigenkapital: 0, freieGrundschuld: null,
    });
  });

  it("Wert wie die Dashboard-Kachel: nur gepflegter Wert, KEIN Kaufpreis als Ersatz", () => {
    // Mit Kaufpreis-Ersatz wäre der Wert 450.000 statt 250.000.
    const l = bestandLage([obj("a", 250_000, 240_000), obj("b", null, 200_000)], []);
    expect(l.wert).toBe(250_000);
    expect(l.ohneWert).toBe(1);
  });

  it("Objekt ohne Wert: seine Schulden zählen trotzdem — Eigenkapital ist dann zu NIEDRIG, nicht zu hoch", () => {
    const l = bestandLage([obj("a", 400_000), obj("b", null)], [kredit("a", 100_000), kredit("b", 150_000)]);
    expect(l.restschuld).toBe(250_000);
    expect(l.eigenkapital).toBe(150_000);
    expect(l.ohneWert).toBe(1);
  });

  it("Restschuld wie die Schulden-Uhr: auch Darlehen ohne Objekt, nie negativ", () => {
    const l = bestandLage([obj("a", 100_000)], [kredit(null, 30_000), kredit("a", -5_000), kredit("a", null)]);
    expect(l.restschuld).toBe(30_000);
  });

  it("freie Grundschuld wie /kredite: je Objekt Grundschuld über der Restschuld, nie negativ", () => {
    // a: 300.000 Grundschuld − 200.000 Rest = 100.000; b: 50.000 − 80.000 → 0; c: ohne Grundschuld.
    const l = bestandLage(
      [obj("a", 400_000), obj("b", 120_000), obj("c", 90_000)],
      [kredit("a", 200_000, 300_000), kredit("b", 80_000, 50_000), kredit("c", 40_000)],
    );
    expect(l.freieGrundschuld).toBe(100_000);
  });

  it("ohne eingetragene Grundschuld ist die freie Grundschuld unbekannt (null), nicht 0", () => {
    const l = bestandLage([obj("a", 400_000)], [kredit("a", 200_000)]);
    expect(l.freieGrundschuld).toBeNull();
  });
});

describe("maklerErledigt — EINE Zählregel für Ordner und Kommandozentrale", () => {
  const [erster, zweiter] = MAKLER_CHECKLISTE;

  it("zählt nur erledigte Punkte der Checkliste, jeden höchstens einmal", () => {
    expect(
      maklerErledigt([
        { item_key: erster.key, status: "erledigt" },
        { item_key: erster.key, status: "erledigt" }, // doppelt
        { item_key: zweiter.key, status: "hochgeladen" }, // hochgeladen ≠ erledigt
        { item_key: "gibt_es_nicht", status: "erledigt" }, // Altzeile
      ]),
    ).toBe(1);
  });

  it("alle erledigt → volle Zahl, leer → 0", () => {
    expect(maklerErledigt(MAKLER_CHECKLISTE.map((i) => ({ item_key: i.key, status: "erledigt" })))).toBe(MAKLER_CHECKLISTE.length);
    expect(maklerErledigt([])).toBe(0);
  });

  it("der Makler-Ordner selbst zählt mit derselben Funktion", () => {
    expect(readFileSync("components/MaklerOrdner.tsx", "utf8")).toContain("maklerErledigt(");
  });
});
