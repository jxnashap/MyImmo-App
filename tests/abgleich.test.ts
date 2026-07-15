import { describe, it, expect } from "vitest";
import { dedup } from "@/lib/mietkonto";
import {
  normalisiere,
  monatAusZweck,
  findeMietVorschlag,
  findeKostenVorschlag,
  type AbgleichUmsatz,
  type AbgleichMieter,
} from "@/lib/banking/abgleich";

const mieter = (over: Partial<AbgleichMieter> & { id: string }): AbgleichMieter => ({
  vorname: "Max",
  nachname: "Mustermann",
  prop_id: "prop-1",
  stammdaten: {
    kaltmiete: 600,
    nk_vorauszahlung: 150,
    stellplatz_miete: 0,
    mietbeginn: "2024-01-01",
    mietende: null,
  },
  zeitraeume: [],
  ...over,
});

const umsatz = (over: Partial<AbgleichUmsatz>): AbgleichUmsatz => ({
  id: "u1",
  buchungsdatum: "2026-07-01",
  betrag: 750,
  gegenpartei: "Max Mustermann",
  verwendungszweck: "Miete Juli",
  status: "neu",
  ...over,
});

const keineGebucht = new Map<string, Set<string>>();

describe("normalisiere", () => {
  it("löst Umlaute auf und entfernt Sonderzeichen", () => {
    expect(normalisiere("Müller-Lüdenscheid, GmbH & Co. KG")).toBe("mueller luedenscheid gmbh co kg");
    expect(normalisiere("José  Ávila")).toBe("jose avila");
    expect(normalisiere(null)).toBe("");
  });
});

describe("monatAusZweck", () => {
  it("liest Monatsnamen mit und ohne Jahr", () => {
    expect(monatAusZweck("Miete Juli 2026", "2026-07")).toBe("2026-07");
    expect(monatAusZweck("Miete Juli", "2026-08")).toBe("2026-07");
    expect(monatAusZweck("Miete Okt. 26", "2026-10")).toBe("2026-10");
    expect(monatAusZweck("MIETE MÄRZ", "2026-03")).toBe("2026-03");
  });

  it("liest numerische Formate", () => {
    expect(monatAusZweck("Miete 07/2026", "2026-07")).toBe("2026-07");
    expect(monatAusZweck("Miete 07.2026 Whg 3", "2026-08")).toBe("2026-07");
    expect(monatAusZweck("Miete 2026-07", "2026-07")).toBe("2026-07");
    expect(monatAusZweck("Miete 7/26", "2026-07")).toBe("2026-07");
  });

  it("korrigiert den Jahres-Umbruch ohne Jahresangabe", () => {
    expect(monatAusZweck("Miete Dezember", "2027-01")).toBe("2026-12"); // Nachzügler
    expect(monatAusZweck("Miete Januar", "2026-12")).toBe("2027-01");   // Vorauszahlung
  });

  it("liefert null ohne Monatsangabe und matcht nicht in Wörtern", () => {
    expect(monatAusZweck("Dauerauftrag Wohnung 3", "2026-07")).toBeNull();
    expect(monatAusZweck("Fam. Maier Miete", "2026-07")).toBeNull(); // "mai" steckt in "maier"
    expect(monatAusZweck(null, "2026-07")).toBeNull();
  });
});

describe("findeMietVorschlag", () => {
  it("findet Mieter über Name + exakten Betrag (Konfidenz hoch)", () => {
    const v = findeMietVorschlag(umsatz({}), [mieter({ id: "m1" })], keineGebucht);
    expect(v).not.toBeNull();
    expect(v!.mieterId).toBe("m1");
    expect(v!.jahrMonat).toBe("2026-07");
    expect(v!.konfidenz).toBe("hoch");
    expect(v!.nkAnteil).toBe(150);
  });

  it("findet Mieter nur über den Namen (Konfidenz mittel), ohne NK-Vorschlag", () => {
    const v = findeMietVorschlag(
      umsatz({ betrag: 500, verwendungszweck: "Abschlag Mustermann" }),
      [mieter({ id: "m1" })],
      keineGebucht,
    );
    expect(v).not.toBeNull();
    expect(v!.konfidenz).toBe("mittel");
    expect(v!.nkAnteil).toBeNull();
  });

  it("findet Mieter nur über exakten Betrag, wenn eindeutig", () => {
    const v = findeMietVorschlag(
      umsatz({ gegenpartei: "Kontoinhaber XY", verwendungszweck: "Dauerauftrag" }),
      [mieter({ id: "m1" }), mieter({ id: "m2", nachname: "Schmidt", stammdaten: { kaltmiete: 400, nk_vorauszahlung: 80, stellplatz_miete: 0, mietbeginn: "2024-01-01", mietende: null } })],
      keineGebucht,
    );
    expect(v?.mieterId).toBe("m1");
  });

  it("macht bei mehrdeutigen Kandidaten KEINEN Vorschlag", () => {
    // Zwei Mieter mit gleicher Soll-Miete, kein Name im Text → mehrdeutig.
    const v = findeMietVorschlag(
      umsatz({ gegenpartei: "Konto 123", verwendungszweck: "Miete" }),
      [mieter({ id: "m1" }), mieter({ id: "m2", nachname: "Schmidt" })],
      keineGebucht,
    );
    expect(v).toBeNull();
  });

  it("ignoriert Ausgänge und Mieter außerhalb des Mietverhältnisses", () => {
    expect(findeMietVorschlag(umsatz({ betrag: -750 }), [mieter({ id: "m1" })], keineGebucht)).toBeNull();
    const ausgezogen = mieter({ id: "m1", stammdaten: { kaltmiete: 600, nk_vorauszahlung: 150, stellplatz_miete: 0, mietbeginn: "2020-01-01", mietende: "2025-12-31" } });
    expect(findeMietVorschlag(umsatz({}), [ausgezogen], keineGebucht)).toBeNull();
  });

  it("nimmt den Monat aus dem Verwendungszweck statt aus dem Buchungsdatum", () => {
    // Juli-Miete kommt erst am 2. August an — Zweck nennt den Monat.
    const v = findeMietVorschlag(
      umsatz({ buchungsdatum: "2026-08-02", verwendungszweck: "Miete Juli Mustermann" }),
      [mieter({ id: "m1" })],
      keineGebucht,
    );
    expect(v!.jahrMonat).toBe("2026-07");
  });

  it("markiert bereits gebuchte Monate", () => {
    const gebucht = new Map([["m1", new Set(["2026-07"])]]);
    const v = findeMietVorschlag(umsatz({}), [mieter({ id: "m1" })], gebucht);
    expect(v!.schonGebucht).toBe(true);
  });

  it("kurze Namen (<3 Zeichen) matchen nicht alles", () => {
    const m = mieter({ id: "m1", vorname: "Al", nachname: "Wu", stammdaten: { kaltmiete: 100, nk_vorauszahlung: 0, stellplatz_miete: 0, mietbeginn: "2024-01-01", mietende: null } });
    const v = findeMietVorschlag(umsatz({ betrag: 999, gegenpartei: "Irgendwer", verwendungszweck: "wunschlos" }), [m], keineGebucht);
    expect(v).toBeNull();
  });
});

describe("dedup mit soll_monat", () => {
  it("soll_monat schließt den richtigen Monat, nicht den des Buchungsdatums", () => {
    const erwartet = [
      { jahrMonat: "2026-07", standardDatum: "2026-07-01", kaltmiete: 600, nk: 150, stellplatz: 0, gesamt: 750 },
      { jahrMonat: "2026-08", standardDatum: "2026-08-01", kaltmiete: 600, nk: 150, stellplatz: 0, gesamt: 750 },
    ];
    // Juli-Miete, verspätet am 2.8. zugeflossen, aber dem Juli zugeordnet:
    const einnahmen = [{ buchungsdatum: "2026-08-02", kategorie: "Miete", soll_monat: "2026-07" }];
    const m = dedup(erwartet, einnahmen);
    expect(m.find((x) => x.jahrMonat === "2026-07")!.schonGebucht).toBe(true);
    expect(m.find((x) => x.jahrMonat === "2026-08")!.schonGebucht).toBe(false);
  });

  it("ohne soll_monat zählt wie bisher der Monat des Buchungsdatums", () => {
    const erwartet = [{ jahrMonat: "2026-08", standardDatum: "2026-08-01", kaltmiete: 600, nk: 150, stellplatz: 0, gesamt: 750 }];
    const m = dedup(erwartet, [{ buchungsdatum: "2026-08-02", kategorie: "Miete" }]);
    expect(m[0].schonGebucht).toBe(true);
  });
});

describe("findeKostenVorschlag", () => {
  it("rät die Kategorie aus Schlüsselwörtern", () => {
    expect(findeKostenVorschlag(umsatz({ betrag: -80, gegenpartei: "HUK Coburg Versicherung" }), [])!.kategorie).toBe("Versicherung");
    expect(findeKostenVorschlag(umsatz({ betrag: -120, gegenpartei: "Stadtkasse Köln", verwendungszweck: "Grundsteuer B" }), [])!.kategorie).toBe("Grundsteuer");
    expect(findeKostenVorschlag(umsatz({ betrag: -50, gegenpartei: "Unbekannt XY", verwendungszweck: "" }), [])!.kategorie).toBe("Sonstiges");
  });

  it("liefert für Eingänge nichts", () => {
    expect(findeKostenVorschlag(umsatz({ betrag: 100 }), [])).toBeNull();
  });

  it("erkennt wiederkehrende Abbuchungen (gleiche Gegenpartei + Betrag)", () => {
    const a = umsatz({ id: "a", betrag: -39.9, gegenpartei: "Stadtwerke", buchungsdatum: "2026-06-01" });
    const b = umsatz({ id: "b", betrag: -39.9, gegenpartei: "Stadtwerke", buchungsdatum: "2026-07-01" });
    expect(findeKostenVorschlag(a, [a, b])!.wiederkehrend).toBe(true);
    expect(findeKostenVorschlag(a, [a])!.wiederkehrend).toBe(false);
  });
});
