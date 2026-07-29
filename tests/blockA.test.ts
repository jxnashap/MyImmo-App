import { describe, it, expect } from "vitest";
import { sollFuerMonat, dritterWerktag, offeneMieten, type MietkontoZeitraum } from "@/lib/mietkonto";
import { berechneNk, vorauszahlungFuerJahr, belegung, type NkTenant, type NkRawPosition } from "@/lib/nk";
import { berechneVerkauf, SPEK_FREIGRENZE } from "@/lib/verkauf";
import { berechneAnlageV, elsterZeilen } from "@/lib/anlageV";
import { berechneUmlage, type UmlageZeile } from "@/lib/umlage";
import { co2PreisBekannt } from "@/lib/co2";
import { marktwert, type MarktwertEingabe } from "@/lib/kauf/marktwert";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";

// Regressionstests zu den Rechenfehlern aus dem Gesamt-Check.
// Jeder Test beschreibt den Fehler, den er verhindern soll.

// ------------------------------------------------- Soll-Miete anteilig ----

describe("Soll-Miete: Mieterwechsel mitten im Monat", () => {
  const basis = { kaltmiete: 600, nk_vorauszahlung: 150, stellplatz_miete: null };

  it("voller Monat bleibt voll", () => {
    const s = sollFuerMonat({ ...basis, mietbeginn: "2020-01-01", mietende: null }, [], "2026-06");
    expect(s?.gesamt).toBe(750);
    expect(s?.anteilig).toBeUndefined();
  });

  it("Auszug am 15.06. → halbe Junimiete (15/30 Tage)", () => {
    const s = sollFuerMonat({ ...basis, mietbeginn: "2020-01-01", mietende: "2026-06-15" }, [], "2026-06");
    expect(s?.anteilig).toEqual({ tage: 15, tageImMonat: 30 });
    expect(s?.kaltmiete).toBe(300);
    expect(s?.gesamt).toBe(375);
  });

  it("Einzug am 16.06. → Rest des Monats (15/30 Tage)", () => {
    const s = sollFuerMonat({ ...basis, mietbeginn: "2026-06-16", mietende: null }, [], "2026-06");
    expect(s?.anteilig).toEqual({ tage: 15, tageImMonat: 30 });
    expect(s?.gesamt).toBe(375);
  });

  it("Vormieter + Nachmieter zusammen ergeben genau EINE Monatsmiete", () => {
    const raus = sollFuerMonat({ ...basis, mietbeginn: "2020-01-01", mietende: "2026-06-15" }, [], "2026-06");
    const rein = sollFuerMonat({ ...basis, mietbeginn: "2026-06-16", mietende: null }, [], "2026-06");
    expect((raus?.gesamt ?? 0) + (rein?.gesamt ?? 0)).toBe(750);
  });

  it("Februar wird mit 28 Tagen gerechnet, nicht mit 30", () => {
    const s = sollFuerMonat({ ...basis, mietbeginn: "2026-02-15", mietende: null }, [], "2026-02");
    expect(s?.anteilig).toEqual({ tage: 14, tageImMonat: 28 });
  });
});

// ----------------------------------------------------- 3. Werktag BGB ----

describe("Fälligkeit der Miete (§ 556b BGB)", () => {
  it("Monat beginnt Donnerstag → 3. Werktag ist der 3.", () => {
    expect(dritterWerktag("2026-01")).toBe("2026-01-03"); // Do/Fr/Sa
  });

  it("Monat beginnt Samstag → Sonntag zählt nicht, 3. Werktag ist der 4.", () => {
    // 01.08.2026 = Samstag, 02. = Sonntag, 03. = Montag, 04. = Dienstag
    expect(dritterWerktag("2026-08")).toBe("2026-08-04");
  });

  it("Monat beginnt Sonntag → 3. Werktag ist der 4.", () => {
    // 01.11.2026 = Sonntag → Werktage 2./3./4.
    expect(dritterWerktag("2026-11")).toBe("2026-11-04");
  });

  it("Rückstand wird nicht vor der Fälligkeit gemeldet", () => {
    const mieter = { kaltmiete: 500, nk_vorauszahlung: 0, mietbeginn: "2026-01-01", mietende: null };
    // 03.08.2026 ist Montag = 2. Werktag → noch nicht fällig
    const offen = offeneMieten(mieter, [], [], new Date("2026-08-03T12:00:00"));
    expect(offen.find((o) => o.jahrMonat === "2026-08")).toBeUndefined();
  });
});

// ------------------------------------------------- NK-Vorauszahlungen ----

const mieter2024: NkTenant = {
  vorname: "A", nachname: "B", mieter_adresse: null, einheit: null, flaeche: 70,
  mietbeginn: "2020-01-01", mietende: null, nk_vorauszahlung: 200,
};

describe("NK-Abrechnung: geleistete Vorauszahlungen", () => {
  it("gebuchte Zahlungen schlagen die Stammdaten", () => {
    const v = vorauszahlungFuerJahr(2024, mieter2024, 12, { gebucht: 2100, gebuchteMonate: 12 });
    expect(v.betrag).toBe(2100);
    expect(v.quelle).toBe("gebucht");
    expect(v.geschaetzt).toBe(false);
  });

  it("Erhöhung im Jahr wird aus der Historie berücksichtigt, nicht 12 × neuer Betrag", () => {
    // Erhöhung von 150 auf 200 zum 01.07.2024 → 6 × 150 + 6 × 200 = 2.100
    const zr: MietkontoZeitraum[] = [
      { von: "2020-01-01", bis: "2024-06-01", kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null },
      { von: "2024-07-01", bis: null, kaltmiete: 800, nk_vorauszahlung: 200, stellplatz_miete: null },
    ];
    const v = vorauszahlungFuerJahr(2024, mieter2024, 12, { zeitraeume: zr });
    expect(v.betrag).toBe(2100);
    expect(v.quelle).toBe("historie");
    // Der alte Fehler wäre 12 × 200 = 2400 gewesen.
    expect(v.betrag).not.toBe(2400);
  });

  it("ohne Historie wird geschätzt und als geschätzt markiert", () => {
    const v = vorauszahlungFuerJahr(2024, mieter2024, 12, null);
    expect(v.geschaetzt).toBe(true);
    expect(v.quelle).toBe("stammdaten");
  });

  it("unterjähriger Einzug zahlt nur ab Einzug — tagesanteilig im ersten Monat", () => {
    const t: NkTenant = { ...mieter2024, mietbeginn: "2024-07-01", nk_vorauszahlung: 100 };
    const v = vorauszahlungFuerJahr(2024, t, 6, null);
    expect(v.betrag).toBe(600); // Juli–Dezember
  });

  it("Abrechnung nutzt die gebuchte Summe und warnt nicht", () => {
    const pos: NkRawPosition[] = [
      { bezeichnung: "Müll", betrag: 1200, umlageschluessel: "Fläche", umlagefaehig: true, jahr: 2024 },
    ];
    const a = berechneNk(2024, mieter2024, null, pos, null, { gebucht: 2100, gebuchteMonate: 12 });
    expect(a.vorauszahlungGeleistet).toBe(2100);
    expect(a.saldo).toBe(900); // 2100 − 1200 = Guthaben
    expect(a.warnungen).toHaveLength(0);
  });

  it("geschätzte Vorauszahlung erzeugt eine Warnung an den Vermieter", () => {
    const a = berechneNk(2024, mieter2024, null, [], null, null);
    expect(a.vorauszahlung.geschaetzt).toBe(true);
    expect(a.warnungen.join(" ")).toContain("kein Nachweis tatsächlicher Zahlungseingänge");
  });

  it("nur teilweise gebuchte Monate zaehlen NICHT als Nachweis", () => {
    // 3 von 12 Monaten gebucht: die Summe waere viel zu niedrig und wuerde dem
    // Mieter eine Nachzahlung bescheinigen, die es nicht gibt.
    const v = vorauszahlungFuerJahr(2024, mieter2024, 12, { gebucht: 450, gebuchteMonate: 3 });
    expect(v.quelle).not.toBe("gebucht");
    expect(v.geschaetzt).toBe(true);
    expect(v.luecke).toEqual({ gebuchteMonate: 3, belegteMonate: 12, gebuchterBetrag: 450 });
  });

  it("Luecke bei Teilbuchungen wird dem Vermieter als Warnung gemeldet", () => {
    const pos: NkRawPosition[] = [
      { bezeichnung: "Müll", betrag: 1200, umlageschluessel: "Fläche", umlagefaehig: true, jahr: 2024 },
    ];
    const a = berechneNk(2024, mieter2024, null, pos, null, { gebucht: 450, gebuchteMonate: 3 });
    expect(a.warnungen.join(" ")).toContain("3 von 12 Monaten");
  });
});

// ------------------------------------------------------- CO₂-Preise ----

describe("CO₂-Referenzpreis", () => {
  it("hinterlegte Jahre sind bekannt", () => {
    expect(co2PreisBekannt(2026)).toBe(true);
  });

  it("2027 ist nicht hinterlegt — darf nicht still 0 € ergeben", () => {
    expect(co2PreisBekannt(2027)).toBe(false);
  });

  it("Abrechnung 2027 ohne echte CO₂-Kosten warnt sichtbar", () => {
    const a = berechneNk(2027, mieter2024, null, [], { co2_kg: 3000, co2_kosten: null, flaeche: 70, gewerbe: false }, { gebucht: 100 });
    expect(a.warnungen.join(" ")).toContain("CO₂-Referenzpreis");
  });
});

// ------------------------------------------- Spekulationssteuer § 23 ----

const verkaufBasis = {
  verkaufspreis: 300_000, kaufdatum: "2020-01-01", kaufpreis: 250_000,
  steuersatz: 42, heute: new Date("2026-07-28T12:00:00Z"),
};

describe("Spekulationssteuer § 23 EStG", () => {
  it("Gewinn unter der Freigrenze löst keine Steuer aus", () => {
    const r = berechneVerkauf({ ...verkaufBasis, verkaufspreis: 250_900 });
    expect(r.ergebnisRoh).toBe(900);
    expect(r.steuerfreiGrund).toBe("freigrenze");
    expect(r.spekulationssteuer).toBe(0);
  });

  it("Gewinn ab der Freigrenze ist voll steuerpflichtig (Freigrenze, kein Freibetrag)", () => {
    const r = berechneVerkauf({ ...verkaufBasis, verkaufspreis: 250_000 + SPEK_FREIGRENZE });
    expect(r.steuerfreiGrund).toBeNull();
    expect(r.veraeusserungsgewinn).toBe(SPEK_FREIGRENZE);
    expect(r.spekulationssteuer).toBe(420);
  });

  it("selbstgenutztes Wohneigentum ist steuerfrei trotz laufender Frist", () => {
    const r = berechneVerkauf({ ...verkaufBasis, eigennutzung: true });
    expect(r.steuerfreiGrund).toBe("eigennutzung");
    expect(r.spekulationssteuer).toBe(0);
  });

  it("Veräußerungsverlust wird ausgewiesen statt auf 0 gekappt", () => {
    const r = berechneVerkauf({ ...verkaufBasis, verkaufspreis: 200_000 });
    expect(r.verlust).toBe(true);
    expect(r.ergebnisRoh).toBe(-50_000);
    expect(r.steuerfreiGrund).toBe("verlust");
    expect(r.spekulationssteuer).toBe(0);
  });

  it("fehlendes Kaufdatum wird gemeldet statt still voll besteuert", () => {
    const r = berechneVerkauf({ ...verkaufBasis, kaufdatum: null });
    expect(r.fehlend.join(" ")).toContain("Kaufdatum");
  });

  it("abgelaufene 10-Jahres-Frist bleibt steuerfrei", () => {
    const r = berechneVerkauf({ ...verkaufBasis, kaufdatum: "2010-01-01" });
    expect(r.steuerfreiGrund).toBe("frist");
  });
});

// ------------------------------------------------- Anlage V / AfA ----

const prop = (over: Partial<Property> = {}): Property =>
  ({ id: "p1", bezeichnung: "Objekt", adresse: null, kaufpreis: 300_000, baujahr: 1998, ...over }) as Property;

describe("Anlage V", () => {
  const einnahmen: Einnahme[] = [
    { id: "e1", prop_id: "p1", buchungsdatum: "2024-05-01", kategorie: "Miete", betrag: 1000, nk_anteil: 200 } as Einnahme,
  ];

  it("degressive AfA ohne Startjahr rechnet nicht mehr aufs Baujahr zurück", () => {
    const r = berechneAnlageV(
      2024,
      [prop({ afa_methode: "degressiv", afa_start_jahr: null } as Partial<Property>)],
      einnahmen, [], [], { gebaeudeAnteil: 80, satz: null },
    );
    const o = r.objekte[0];
    expect(o.werbungskosten.afa).toBe(0);
    expect(o.hinweise.join(" ")).toContain("AfA-Startjahr");
  });

  it("degressive AfA mit Startjahr rechnet vom Restbuchwert", () => {
    const r = berechneAnlageV(
      2024,
      [prop({ afa_methode: "degressiv", afa_start_jahr: 2023 } as Partial<Property>)],
      einnahmen, [], [], { gebaeudeAnteil: 80, satz: null },
    );
    // Basis 240.000 × 5 % × 0,95^1 = 11.400
    expect(r.objekte[0].werbungskosten.afa).toBe(11_400);
  });

  it("geschätzte Schuldzinsen sind in ELSTER nicht übertragbar", () => {
    const kredite: Kredit[] = [{ id: "k1", prop_id: "p1", restschuld: 200_000, zinssatz: 3 } as Kredit];
    const r = berechneAnlageV(2024, [prop()], einnahmen, [], kredite, { gebaeudeAnteil: 80, satz: null });
    const o = r.objekte[0];
    expect(o.werbungskosten.schuldzinsen).toBe(6000);
    expect(o.schuldzinsenGeschaetzt).toBe(true);
    const z37 = elsterZeilen(o).find((z) => z.zeile === "37")!;
    expect(z37.uebertragbar).toBe(false);
    expect(z37.warnung).toBeTruthy();
  });

  it("gebuchte Schuldzinsen schlagen die Schätzung und sind übertragbar", () => {
    const kosten: Kosten[] = [
      { id: "c1", prop_id: "p1", buchungsdatum: "2024-03-01", kategorie: "Schuldzinsen", betrag: 5400 } as Kosten,
    ];
    const kredite: Kredit[] = [{ id: "k1", prop_id: "p1", restschuld: 200_000, zinssatz: 3 } as Kredit];
    const r = berechneAnlageV(2024, [prop()], einnahmen, kosten, kredite, { gebaeudeAnteil: 80, satz: null });
    const o = r.objekte[0];
    expect(o.werbungskosten.schuldzinsen).toBe(5400);
    expect(o.schuldzinsenGeschaetzt).toBe(false);
    expect(elsterZeilen(o).find((z) => z.zeile === "37")!.uebertragbar).toBe(true);
  });
});

// ---------------------------------------- Zeitanteiligkeit vereinheitlicht ----

describe("Verteiler und Abrechnung rechnen dieselbe Zeitanteiligkeit", () => {
  it("Einzug am 20.03. ergibt im Verteiler denselben Faktor wie in der Abrechnung", () => {
    const jahr = 2025;
    const b = belegung(jahr, "2025-03-20", null);
    expect(b.tage).toBe(287); // 20.03.–31.12.

    const zeilen: UmlageZeile[] = [{ bezeichnung: "Müll", betrag: 1000, schluessel: "flaeche" }];
    const r = berechneUmlage(
      zeilen,
      [{ id: "a", name: "A", flaeche: 100, monate: b.monate, tage: b.tage }],
      { zeitanteilig: true, jahresTage: 365, referenzFlaeche: 100 },
    );
    // Tagesgenau: 287/365 = 78,63 % — nicht 10/12 = 83,3 %
    expect(r.perMieter[0].summe).toBeCloseTo(1000 * (287 / 365), 1);
    expect(r.perMieter[0].summe).toBeLessThan(1000 * (10 / 12));
  });

  it("ohne Tage bleibt das alte Monatsverfahren erhalten", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "Müll", betrag: 120, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [{ id: "a", name: "A", flaeche: 100, monate: 6 }], {
      zeitanteilig: true, referenzFlaeche: 100,
    });
    expect(r.perMieter[0].summe).toBe(60);
  });
});

// ------------------------------------------------ Marktwert-Vollständigkeit ----

describe("Marktwert im Kauf-Rechner", () => {
  const eingabe: MarktwertEingabe = {
    nutzung: "vermietung", objektTyp: "wohnung", wohnflaeche: 70, kaltmieteMonat: 700,
    anzahlWohnungen: 1, grundFlaeche: 0, bodenrichtwert: 0, baujahr: 0,
    gebTyp: "efh_freistehend", ausstattung: 3, bpiFaktor: 1.9, regionalFaktor: 1,
    liegenschaftszins: 3, sachwertfaktor: 1,
  };

  it("fehlendes Baujahr wird als Unsicherheit gemeldet, nicht still als Neubau gerechnet", () => {
    const m = marktwert(eingabe);
    expect(m.bereit).toBe(true);
    expect(m.unsicher.join(" ")).toContain("Baujahr");
  });

  it("fehlender Bodenwert wird beim Ertragswert gemeldet", () => {
    const m = marktwert(eingabe);
    expect(m.unsicher.join(" ")).toContain("Bodenrichtwert");
  });

  it("vollständige Angaben melden keine Unsicherheit", () => {
    const m = marktwert({ ...eingabe, baujahr: 1995, bodenrichtwert: 400, grundFlaeche: 200 });
    expect(m.unsicher).toHaveLength(0);
  });
});
