// Paket P14 (10.10.2026): die sechs C-Befunde der Gesamtprüfung 07.10.2026, die keinem Paket zugeordnet
// waren (C18–C21, C23, C24), dazu B1 — die Zeilen der Anlage V je Steuerjahr.
// Quellen: § 7 Abs. 4/5a, § 7b EStG, §§ 187, 188 BGB (gesetze-im-internet.de, Abruf 10.10.2026);
// Vordruck Anlage V 2025 und Anleitung zur Anlage V 2024 (siehe lib/steuer/anlageVZeilen.ts).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { berechneAnlageV, elsterZeilen, summenWarnung, positionMitZeile, ANLAGE_V_POSITIONEN, AFA_DEFAULT } from "@/lib/anlageV";
import { linearImJahr } from "@/lib/steuer/afaZeitraum";
import { fristendeNachJahren, tagDanach } from "@/lib/steuer/frist";
import { berechneSpekulation } from "@/lib/steuer/spekulation";
import { berechneAnschaffungsnah } from "@/lib/steuer/anschaffungsnah";
import { degressivPruefung, pruefe7b } from "@/lib/steuer/afa";
import { vorschlagAusAbrechnung } from "@/lib/nkVorjahr";
import { gleichzeitigeMieter, zeigeVerteiler } from "@/lib/umlage";
import { ANLAGE_V_ZEILEN, anlageVZeilen } from "@/lib/steuer/anlageVZeilen";
import type { Einnahme, Kosten, Property } from "@/lib/types";

const objekt = (x: Partial<Property>): Property => ({
  id: "p1", bezeichnung: "ETW Muster", adresse: null, typ: "Eigentumswohnung", kaufpreis: 300000, kaufdatum: "2000-01-15",
  baujahr: 1990, obj_status: "Vermietet", afa_gebaeudeanteil: 80, afa_methode: "auto", afa_start_jahr: null, afa_betrag: null, ...x,
} as unknown as Property);
const kost = (datum: string, betrag: number, kategorie: string): Kosten =>
  ({ id: `${datum}-${betrag}-${kategorie}`, prop_id: "p1", buchungsdatum: datum, kategorie, betrag } as unknown as Kosten);
const ein = (datum: string, betrag: number, kategorie: string, nk = 0): Einnahme =>
  ({ id: `${datum}-${kategorie}-${betrag}`, prop_id: "p1", buchungsdatum: datum, kategorie, betrag, nk_anteil: nk } as unknown as Einnahme);

describe("C18 — lineare AfA bis zur vollen Absetzung", () => {
  it("3 %: 33 volle Jahre, im 34. der Rest — 240.000 statt 237.600", () => {
    let summe = 0;
    for (let j = 2000; j <= 2040; j++) summe += linearImJahr(240000, 3, j, 2000, 1).betrag;
    expect(summe).toBe(240000);
    expect(linearImJahr(240000, 3, 2032, 2000, 1).betrag).toBe(7200);
    expect(linearImJahr(240000, 3, 2033, 2000, 1).betrag).toBe(2400);
    expect(linearImJahr(240000, 3, 2034, 2000, 1).betrag).toBe(0);
  });
  it("angebrochenes Anschaffungsjahr: der fehlende Teil kommt am Ende (2 %, Kauf im November)", () => {
    expect(linearImJahr(240000, 2, 2026, 2026, 11).betrag).toBe(800);
    expect(linearImJahr(240000, 2, 2076, 2026, 11).betrag).toBe(4000);
    expect(linearImJahr(240000, 2, 2077, 2026, 11).betrag).toBe(0);
  });
  it("die Anlage V rechnet damit (Kauf 15.01.2000: 2000–2032 voll, 2033 der Rest)", () => {
    const afa = (jahr: number, x: Partial<Property> = {}) =>
      berechneAnlageV(jahr, [objekt(x)], [], [], [], { gebaeudeAnteil: 80, satz: 3 }).objekte[0]?.werbungskosten.afa ?? 0; // ohne Bewegung blendet die Anlage V das Objekt aus
    expect(afa(2032)).toBe(7200);
    expect(afa(2033)).toBe(2400);
    // Kauf im November: 2/12 im Kaufjahr, dafür 2034 noch 10/12 × 7.200 − … = 1.200
    expect(afa(2033, { kaufdatum: "2000-11-15" })).toBe(7200);
    expect(afa(2034, { kaufdatum: "2000-11-15" })).toBe(1200);
    expect(afa(2035, { kaufdatum: "2000-11-15" })).toBe(0);
  });
});

describe("C19 — Fristende bei Kauf am 29.02. (§ 188 Abs. 3 BGB)", () => {
  it("fällt auf den letzten Februartag, nicht auf den 01.03.", () => {
    expect(fristendeNachJahren("2016-02-29", 10)).toBe("2026-02-28");
    expect(fristendeNachJahren("2016-02-29", 12)).toBe("2028-02-29");
    expect(fristendeNachJahren("2016-05-15", 10)).toBe("2026-05-15");
    expect(tagDanach("2026-02-28")).toBe("2026-03-01");
    expect(tagDanach("2026-12-31")).toBe("2027-01-01");
  });
  it("Spekulationsfrist: steuerfrei ab 01.03.2026 (vorher 02.03.)", () => {
    expect(berechneSpekulation("2016-02-29", new Date("2020-01-01T00:00:00Z")).steuerfreiAb).toBe("2026-03-01");
    expect(berechneSpekulation("2016-05-15", new Date("2020-01-01T00:00:00Z")).steuerfreiAb).toBe("2026-05-16");
  });
  it("15-%-Fenster endet am 28.02.2027 (vorher 01.03.)", () => {
    const r = berechneAnschaffungsnah({ kaufpreis: 100000, gebaeudeanteilProzent: 80, kaufdatum: "2024-02-29" }, [], new Date("2025-01-01T00:00:00Z"));
    expect(r.fensterBis).toBe("2027-02-28");
  });
});

describe("C20 — degressive AfA nur, wenn § 7 Abs. 5a passen kann", () => {
  it("Fertigstellung vor 2023 oder Kauf nach dem Fertigstellungsjahr: nicht zulässig", () => {
    expect(degressivPruefung({ baujahr: 1998, kaufdatum: "2024-03-01" }).zulaessig).toBe(false);
    expect(degressivPruefung({ baujahr: 2024, kaufdatum: "2026-03-01" }).zulaessig).toBe(false);
    expect(degressivPruefung({ baujahr: 2024, kaufdatum: "2024-06-01" }).zulaessig).toBe("pruefen");
    expect(degressivPruefung({ baujahr: null, kaufdatum: null }).zulaessig).toBe("pruefen");
  });
  it("in der Anlage V: Hinweis, AfA und Summen nicht übertragbar — umgebucht wird nicht", () => {
    const p = objekt({ afa_methode: "degressiv", afa_start_jahr: 2024, kaufdatum: "2024-01-10", baujahr: 1998 });
    const erg = berechneAnlageV(2025, [p], [], [], [], AFA_DEFAULT);
    const o = erg.objekte[0];
    expect(o.werbungskosten.afa).toBeGreaterThan(0);
    expect(o.afaUnzulaessig).toBe(true);
    expect(o.hinweise.join(" ")).toMatch(/vor dem 01\.10\.2023/);
    expect(summenWarnung(o)).toMatch(/§ 7 Abs\. 5a/);
    expect(summenWarnung(erg.gesamt)).toMatch(/§ 7 Abs\. 5a/);
    expect(elsterZeilen(o, 2025).find((z) => z.bezeichnung === "AfA für Gebäude")?.uebertragbar).toBe(false);
  });
  it("passt es, bleibt es ein Prüfpunkt ohne Sperre", () => {
    const p = objekt({ afa_methode: "degressiv", afa_start_jahr: 2024, kaufdatum: "2024-06-10", baujahr: 2024 });
    const o = berechneAnlageV(2025, [p], [], [], [], AFA_DEFAULT).objekte[0];
    expect(o.afaUnzulaessig).toBeFalsy();
    expect(o.hinweise.join(" ")).toMatch(/Bitte prüfen/);
  });
});

describe("C21 — § 7b nur mit zehnjähriger Vermietung zu Wohnzwecken", () => {
  const gut = { bauantragJahr: 2024, neueWohnung: true, qngNachweis: true, vermietungZehnJahre: true, baukostenProM2: 4800, flaeche: 100 };
  it("ohne die Vermietungsbindung keine Sonder-AfA, und der Grund steht da", () => {
    expect(pruefe7b(gut).berechtigt).toBe(true);
    const r = pruefe7b({ ...gut, vermietungZehnJahre: false });
    expect(r.berechtigt).toBe(false);
    expect(r.gruende.find((g) => !g.ok)?.text).toMatch(/folgenden neun Jahren/);
  });
  it("der Assistent fragt es ab", () => {
    expect(readFileSync("components/kalkulator/AfaAssistent.tsx", "utf8")).toMatch(/vermietungZehnJahre: zehnJahre/);
  });
});

describe("C23 — Vorauszahlungsvorschlag nach Tagen, nur bei laufendem Vertrag", () => {
  // 16.04.–31.12.2025 = 260 Tage. Angebrochen gezählt wären es 9 Monate → 559,07 / 9 = 63 €.
  const a = { jahr: 2025, zeitraumVon: "2025-04-16", zeitraumBis: "2025-12-31", monate: 9, positionen: [{}], kostenNachCo2: 559.07, nkVorauszahlungMonat: 50 };
  it("Tagesanteil: 559,07 / (260/365 × 12) = 65,40 → 66 €", () => {
    expect(vorschlagAusAbrechnung(a, null, "2026-10-10")).toEqual({ vorschlag: 66, differenz: 16 });
  });
  it("ausgezogen: kein Vorschlag für eine künftige Vorauszahlung", () => {
    expect(vorschlagAusAbrechnung(a, "2026-08-31", "2026-10-10")).toBeNull();
    expect(vorschlagAusAbrechnung(a, "2027-03-31", "2026-10-10")).not.toBeNull();
  });
  it("die NK-Seite nutzt genau diese Regel", () => {
    expect(readFileSync("app/(app)/tenants/[id]/nk/page.tsx", "utf8")).toMatch(/vorschlag=\{vorschlagAusAbrechnung\(a, tenant\.mietende \?\? null, heuteBerlin\(\)\)\}/);
  });
});

describe("C24 — nacheinander ist nicht gleichzeitig", () => {
  it("Mieterwechsel zählt einfach, auch bei Übergabe am selben Tag", () => {
    expect(gleichzeitigeMieter([{ mietbeginn: "2019-01-01", mietende: "2025-10-31" }, { mietbeginn: "2025-11-01", mietende: null }])).toBe(1);
    expect(gleichzeitigeMieter([{ mietbeginn: "2019-01-01", mietende: "2025-10-31" }, { mietbeginn: "2025-10-31", mietende: null }])).toBe(1);
    expect(zeigeVerteiler({ typ: "Haus", mieter: [{ mietbeginn: "2019-01-01", mietende: "2025-09-30" }, { mietbeginn: "2025-11-01", mietende: null }] })).toBe(false);
  });
  it("überlappende Verträge zählen doppelt; ohne Datum im Zweifel gleichzeitig", () => {
    expect(gleichzeitigeMieter([{ mietbeginn: "2020-01-01", mietende: null }, { mietbeginn: "2024-01-01", mietende: "2026-06-30" }])).toBe(2);
    expect(gleichzeitigeMieter([{ mietbeginn: null, mietende: null }, { mietbeginn: null, mietende: null }])).toBe(2);
    expect(gleichzeitigeMieter([])).toBe(0);
  });
  it("kein Aufrufer zählt mehr nur die Mieter", () => {
    for (const f of ["app/(app)/properties/[id]/page.tsx", "app/(app)/properties/[id]/nebenkosten/page.tsx", "app/(app)/tenants/[id]/nk/page.tsx", "lib/nkPositionen.ts", "lib/actions/positions.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/mieterAnzahl/);
    }
  });
});

describe("B1 — Zeilen der Anlage V je Steuerjahr", () => {
  // Wörtlicher Auszug aus dem Vordruck Anlage V 2025 (Zeilen 32, 83, 85) — die Summenzeilen nennen die
  // Endzeilen jedes Blocks. Die Tabelle muss dazu passen.
  const Z32 = "Summe der Einnahmen aus den Zeilen 15, 18 bis 28 und 31";
  const Z83 = "Summe der Werbungskosten (Summe der Zeilen 35, 38, 41, 45, 48, 51, 54, 55, 56, 60, 63, 66, 69, 72, 75, 78, 79 und 82)";
  const Z85 = "Überschuss (Einnahmen laut Zeile 32 abzüglich Werbungskosten laut Zeile 83)";
  const t = ANLAGE_V_ZEILEN[2025].felder;
  const ende = (z: string) => Number(z.split("–").pop());
  const wkEnden = Z83.match(/\d+/g)!.map(Number);

  it("jeder Werbungskosten-Block endet auf einer Zeile, die der Vordruck in Zeile 83 summiert", () => {
    for (const f of ["afa", "schuldzinsen", "umgelegt", "nichtUmgelegt", "sonstigeKosten"] as const) expect(wkEnden, f).toContain(ende(t[f].zeile));
    expect(t.erhaltung.zeile).toBe("55–56");
    expect(t.schuldzinsen.zeile).toBe("46–48");
  });
  it("Summen und Ergebnis stehen dort, wo der Vordruck sie nennt", () => {
    expect(Z85).toContain(`Zeile ${t.summeEinnahmen.zeile} `);
    expect(Z85).toContain(`Zeile ${t.summeWerbungskosten.zeile})`);
    expect(t.ueberschuss.zeile).toBe("85");
    expect(Z32).toContain(String(ende(t.miete.zeile)));
  });
  it("2024 gleich, andere Jahre ohne Zeilennummern", () => {
    expect(anlageVZeilen(2024)?.felder).toEqual(t);
    expect(anlageVZeilen(2023)).toBeNull();
    expect(anlageVZeilen(2026)).toBeNull();
  });
  it("ELSTER-Hilfe: Schuldzinsen 46–48, Summe 83, Ergebnis 85 — ohne geprüften Vordruck keine Nummer", () => {
    const kosten = [kost("2025-03-01", 5400, "Schuldzinsen"), kost("2025-04-01", 300, "Müll"), kost("2025-05-01", 200, "Verwaltung")];
    const einnahmen = [ein("2025-01-03", 1000, "Miete", 200), ein("2025-06-01", 120, "Nebenkostenabrechnung")];
    const o = berechneAnlageV(2025, [objekt({ kaufdatum: "2020-01-01" })], einnahmen, kosten, [], AFA_DEFAULT).objekte[0];
    const z = elsterZeilen(o, 2025);
    const nach = (b: string) => z.find((x) => x.bezeichnung.startsWith(b));
    expect(nach("Schuldzinsen")?.zeile).toBe("46–48");
    expect(nach("Summe der Werbungskosten")?.zeile).toBe("83");
    expect(z[z.length - 1]).toMatchObject({ bezeichnung: "Verlust", zeile: "85" });
    expect(nach("Verwaltungskosten")?.zeile).toBe("76–78");
    expect(nach("Umlagefähige Betriebskosten")).toMatchObject({ zeile: "73–75 / 76–78", betrag: 300 });
    expect(nach("Umlagen, laufend")).toMatchObject({ zeile: "20", betrag: 200 });
    expect(nach("Umlagen: Nachzahlungen")).toMatchObject({ zeile: "21", betrag: 120 });
    expect(z.every((x) => !["9", "13", "14", "21 ", "37", "40", "46", "47", "50", "51", "23/24"].includes(x.zeile))).toBe(true);
    for (const x of elsterZeilen(o, 2026)) expect(x.zeile).toBe("–");
  });
  it("Müll & Co. stehen als Betriebskosten, nicht unter „Hausgeld / Sonstiges“ — und zählen zur Summe", () => {
    const o = berechneAnlageV(2025, [objekt({ afa_methode: "keine" })], [], [kost("2025-04-01", 300, "Müll"), kost("2025-04-01", 50, "Sonstiges")], [], AFA_DEFAULT).objekte[0];
    expect(o.werbungskosten.betriebskosten).toBe(300);
    expect(o.werbungskosten.hausgeldSonstige).toBe(50);
    expect(o.werbungskosten.summe).toBe(350);
  });
  it("Positionen tragen die Zeile nur, wo sie geprüft ist", () => {
    const sz = ANLAGE_V_POSITIONEN.find((p) => p.key === "schuldzinsen")!;
    expect(positionMitZeile(sz, 2025)).toBe("Schuldzinsen — Z. 46–48");
    expect(positionMitZeile(sz, 2026)).toBe("Schuldzinsen");
  });
  it("kein fester Text nennt mehr eine Zeilennummer der Anlage V", () => {
    const dateien: string[] = [];
    const lauf = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) lauf(p);
        else if (/\.(ts|tsx)$/.test(n)) dateien.push(p);
      }
    };
    for (const d of ["app", "components", "lib"]) lauf(d);
    expect(dateien.length).toBeGreaterThan(300);
    const treffer = dateien
      .filter((f) => !f.endsWith("anlageVZeilen.ts"))
      .filter((f) => /Anlage V[^\n]{0,20}Zeile \d|\(Zeile \d{1,2}(\/\d+)?\)/.test(readFileSync(f, "utf8")));
    expect(treffer).toEqual([]);
  });
});
