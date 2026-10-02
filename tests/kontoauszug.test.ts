import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { leseKontoauszug, gleicheAb, zielMonat, normIban, type AbgleichMieter, type Zahlung } from "@/lib/kontoauszug";

// Kontoauszug-Abgleich per CSV (02.10.2026). Die Beispiel-Exporte spiegeln den AUFBAU der
// Bank-Formate (Vorspann, Spaltennamen, Zahlenformat); sie sind nachgebaut, nicht echt.

const SPARKASSE = [
  `"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"`,
  `"DE00111";"01.10.26";"01.10.26";"GUTSCHR. UEBERW. DAUERAUFTR";"Miete Oktober Whg 3";"Sophie Berger";"DE89 3704 0044 0532 0130 00";"COBADEFFXXX";"1.050,00";"EUR";"Umsatz gebucht"`,
  `"DE00111";"02.10.26";"02.10.26";"LASTSCHRIFT";"Strom";"Stadtwerke";"DE11";"X";"-89,90";"EUR";"Umsatz gebucht"`,
  `"DE00111";"03.10.26";"03.10.26";"GUTSCHRIFT";"Gehalt";"Arbeitgeber GmbH";"DE22";"X";"3.200,00";"EUR";"Umsatz gebucht"`,
].join("\r\n");

const DKB = [
  `"Girokonto";"DE00 1203 0000 0000 0000 00"`,
  `""`,
  `"Kontostand vom 02.10.2026:";"5.000,00 €"`,
  `""`,
  `"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"`,
  `"30.09.26";"30.09.26";"Gebucht";"Max Krüger";"Jonas";"Miete";"Eingang";"DE44500105175407324931";"840";"";"";""`,
].join("\n");

const ING = [
  `Umsatzanzeige;Datei erstellt am: 02.10.2026`,
  ``,
  `IBAN;DE00 5001 0517 0000 0000 00`,
  `Zeitraum;01.09.2026 - 02.10.2026`,
  ``,
  `Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung`,
  `15.09.2026;15.09.2026;Anna Weiß;Gutschrift;Miete September Weiss;12.000,00;EUR;695,00;EUR`,
].join("\n");

describe("Bank-CSV lesen", () => {
  it("Sparkasse: nur Eingänge, deutsches Zahlenformat, zweistelliges Jahr, IBAN ohne Leerzeichen", () => {
    const a = leseKontoauszug(SPARKASSE);
    if (!a.ok) throw new Error(a.fehler);
    expect(a.zahlungen).toEqual([
      { zeile: 2, datum: "2026-10-01", betrag: 1050, name: "Sophie Berger", zweck: "Miete Oktober Whg 3", iban: "DE89370400440532013000" },
      { zeile: 4, datum: "2026-10-03", betrag: 3200, name: "Arbeitgeber GmbH", zweck: "Gehalt", iban: "DE22" },
    ]);
    expect(a.ausgaenge).toBe(1);
    expect(a.spalten).toMatchObject({ datum: "Buchungstag", betrag: "Betrag", name: "Beguenstigter/Zahlungspflichtiger", iban: "Kontonummer/IBAN" });
  });

  it("DKB: Vorspann übersprungen, Zahler = Zahlungspflichtige*r (nicht Empfänger)", () => {
    const a = leseKontoauszug(DKB);
    if (!a.ok) throw new Error(a.fehler);
    expect(a.zahlungen).toEqual([{ zeile: 6, datum: "2026-09-30", betrag: 840, name: "Max Krüger", zweck: "Miete", iban: "DE44500105175407324931" }]);
  });

  it("ING: Kopfzeile nach Vorspann, „Betrag“ statt „Saldo“", () => {
    const a = leseKontoauszug(ING);
    if (!a.ok) throw new Error(a.fehler);
    expect(a.zahlungen.map((z) => [z.datum, z.betrag, z.name])).toEqual([["2026-09-15", 695, "Anna Weiß"]]);
  });

  it("getrennte Soll-/Haben-Spalten; unbekanntes Format wird gemeldet statt geraten", () => {
    const a = leseKontoauszug(`Datum;Name;Verwendungszweck;Soll;Haben\n01.10.2026;Berger;Miete;;1.050,00\n02.10.2026;Shop;Kauf;20,00;`);
    if (!a.ok) throw new Error(a.fehler);
    expect(a.zahlungen.map((z) => z.betrag)).toEqual([1050]);
    expect(a.ausgaenge).toBe(1);
    expect(leseKontoauszug("a;b;c\n1;2;3")).toEqual({ ok: false, fehler: expect.stringContaining("Keine Kopfzeile") });
    expect(leseKontoauszug("Datum;Betrag\n01.10.2026;5,00")).toEqual({ ok: false, fehler: expect.stringContaining("Weder Name") });
  });
});

describe("Zuordnung", () => {
  const hash = (iban: string) => createHash("sha256").update(normIban(iban)).digest("hex");
  const mieter = (x: Partial<AbgleichMieter> = {}): AbgleichMieter => ({
    mieterId: "m1", propId: "p1", name: "Sophie Berger", nachname: "Berger", ibanHash: null,
    offen: [{ jahrMonat: "2026-09", gesamt: 1050, nk: 200 }, { jahrMonat: "2026-10", gesamt: 1050, nk: 200 }], ...x,
  });
  const zahlung = (x: Partial<Zahlung> = {}): Zahlung => ({ zeile: 2, datum: "2026-10-01", betrag: 1050, name: "S. Berger", zweck: "Miete Oktober", iban: "", ...x });
  const hashe = (...z: Zahlung[]) => new Map(z.filter((y) => y.iban).map((y) => [y.zeile, hash(y.iban)]));

  it("Betrag allein reicht NICHT — fremde 1.050 € werden niemandem zugeordnet", () => {
    const z = zahlung({ name: "Arbeitgeber GmbH", zweck: "Gehalt" });
    expect(gleicheAb([z], [mieter()], hashe(z))).toEqual({ treffer: [], ohneZuordnung: [z] });
  });

  it("Name + Betrag = sicher (4); IBAN + Betrag = sicher (5); IBAN allein = Vorschlag (3)", () => {
    const a = gleicheAb([zahlung()], [mieter()], new Map()).treffer[0];
    expect([a.stufe, a.punkte, a.gruende]).toEqual(["sicher", 4, ["Name", "Betrag"]]);
    const zi = zahlung({ name: "Fremdname", iban: "DE89 3704 0044 0532 0130 00" });
    const b = gleicheAb([zi], [mieter({ ibanHash: hash("DE89370400440532013000") })], hashe(zi)).treffer[0];
    expect([b.stufe, b.gruende]).toEqual(["sicher", ["IBAN", "Betrag"]]);
    const zj = zahlung({ name: "Fremdname", iban: "DE89 3704 0044 0532 0130 00", betrag: 500 });
    const c = gleicheAb([zj], [mieter({ ibanHash: hash("DE89370400440532013000") })], hashe(zj)).treffer[0];
    expect([c.stufe, c.punkte]).toEqual(["vorschlag", 3]);
  });

  it("Name ohne passenden Betrag (2 Punkte) ist keine Zuordnung", () => {
    expect(gleicheAb([zahlung({ betrag: 500 })], [mieter()], new Map()).treffer).toEqual([]);
  });

  it("Monat: Zahlung ab dem 25. gilt dem Folgemonat; ist der schon gebucht, der älteste offene", () => {
    expect(zielMonat("2026-09-30")).toBe("2026-10");
    expect(zielMonat("2026-10-03")).toBe("2026-10");
    expect(gleicheAb([zahlung({ datum: "2026-09-29" })], [mieter()], new Map()).treffer[0].jahrMonat).toBe("2026-10");
    const nurSept = mieter({ offen: [{ jahrMonat: "2026-09", gesamt: 1050, nk: 200 }] });
    expect(gleicheAb([zahlung()], [nurSept], new Map()).treffer[0].jahrMonat).toBe("2026-09");
  });

  it("zwei Zahlungen → zwei verschiedene Monate, nie derselbe doppelt", () => {
    const r = gleicheAb([zahlung({ zeile: 2, datum: "2026-10-01" }), zahlung({ zeile: 3, datum: "2026-10-02" })], [mieter()], new Map());
    expect(r.treffer.map((t) => t.jahrMonat).sort()).toEqual(["2026-09", "2026-10"]);
    const dritte = gleicheAb([zahlung({ zeile: 2 }), zahlung({ zeile: 3 }), zahlung({ zeile: 4 })], [mieter()], new Map());
    expect(dritte.treffer).toHaveLength(2);
    expect(dritte.ohneZuordnung).toHaveLength(1);
  });

  it("NK-Anteil anteilig bei Teilzahlung, nie über dem Soll-NK; der stärkere Mieter gewinnt", () => {
    const iban = "DE89370400440532013000";
    const z = zahlung({ betrag: 525, iban });
    const t = gleicheAb([z], [mieter({ ibanHash: hash(iban) })], hashe(z)).treffer[0];
    expect(t.nkAnteil).toBe(100);
    const zwei = gleicheAb([zahlung()], [mieter({ mieterId: "andere", nachname: "Xyz" }), mieter()], new Map());
    expect(zwei.treffer[0].mieterId).toBe("m1");
  });
});

describe("Zuordnung — Grenzfälle", () => {
  const mieter = (x: Partial<AbgleichMieter> = {}): AbgleichMieter => ({
    mieterId: "m1", propId: "p1", name: "A", nachname: "Berger", ibanHash: null,
    offen: [{ jahrMonat: "2026-10", gesamt: 700, nk: 100 }], ...x,
  });
  const z: Zahlung = { zeile: 2, datum: "2026-10-01", betrag: 700, name: "Familie Berger", zweck: "Miete", iban: "" };

  it("zwei gleich passende Mieter (gleicher Nachname, gleiche Miete): nie „sicher“, als mehrdeutig markiert", () => {
    const t = gleicheAb([z], [mieter(), mieter({ mieterId: "m2" })], new Map()).treffer[0];
    expect([t.mieterId, t.stufe, t.gruende]).toEqual(["m1", "vorschlag", ["Name", "Betrag", "mehrdeutig"]]);
  });

  it("Nachnamen unter 3 Zeichen zählen nicht (sonst passt „Es“ auf „Rest“)", () => {
    const kurz = gleicheAb([{ ...z, name: "Rest", zweck: "" }], [mieter({ nachname: "Es" })], new Map());
    expect(kurz.treffer).toEqual([]);
  });
});

describe("Anbindung", () => {
  it("die Datei wird im Browser gelesen; gebucht wird über bestaetigeMehrere", () => {
    const k = readFileSync("components/KontoauszugAbgleich.tsx", "utf8");
    expect(k).toContain("new TextDecoder(\"windows-1252\")");
    expect(k).toContain("await bestaetigeMehrere(zeilen)");
    expect(k).not.toMatch(/fetch\(|FormData/);
  });
  it("der Server reicht nur eine Prüfsumme der Mieter-IBAN in den Browser", () => {
    const d = readFileSync("lib/mietkontoDaten.ts", "utf8");
    expect(d).toContain('createHash("sha256").update(iban).digest("hex")');
    expect(d).toContain("ibanHash: ibanHash(m.iban)");
    expect(d).not.toMatch(/iban: decryptNullable/);
  });
});
