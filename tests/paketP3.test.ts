// Paket P3 der Gesamtprüfung 07.10.2026 (docs/AUDIT-2026-10-07-gesamt.md): Kündigung und Mieterhöhung.
// A7, A8, B40, B42, B44 und die Liste der Schriftform-Arten. Normtexte: gesetze-im-internet.de, 08.10.2026.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  karenzTag, fruehesterKuendigungstermin, pruefeKuendigung, fruehestWirksam, pruefeMieterhoehung,
  letzteKaltmieteAenderung, istMonatsende, volleJahre, plusMonate, digitalGesperrt, SCHRIFTFORM,
  weitereMieterListe, alleMieter, namenAufzaehlung, anrede, pruefeBrief, hatLuecke, BEGRUENDUNGSMITTEL,
  mieterhoehungBasis, empfaengerNamenZeilen, briefAblehnung, MEHRERE_MIETER_HINWEIS,
} from "@/lib/briefPruefung";
import { DEFAULT_VORLAGEN, fehlendePlatzhalter } from "@/lib/dokumentVorlagen";

const lies = (p: string) => readFileSync(p, "utf8");

describe("§ 573c — dritter Werktag (Samstag zählt, außer als letzter Tag; BGH VIII ZR 206/04)", () => {
  it("Oktober 2026: 1. Do, 2. Fr, 3. Feiertag, 5. Mo → 05.10.", () => {
    expect(karenzTag("2026-10")).toBe("2026-10-05");
  });
  it("Samstag zählt mit, wenn er nicht der dritte Tag ist: Mai 2027 (1. Feiertag Sa, 3. Mo, 4. Di, 5. Mi)", () => {
    // 01.05.2027 ist ein Samstag UND Feiertag → zählt nicht; 3. Mo (1), 4. Di (2), 5. Mi (3).
    expect(karenzTag("2027-05")).toBe("2027-05-05");
  });
  it("Samstag mitten in der Frist zählt: Januar 2027 (1. Feiertag Fr, 2. Sa, 4. Mo, 5. Di)", () => {
    // 2. Sa (1), 4. Mo (2), 5. Di (3) — ohne Samstag wäre es der 6. (Heilige Drei Könige nur Landesfeiertag).
    expect(karenzTag("2027-01")).toBe("2027-01-05");
  });
  it("fiele der dritte Werktag auf einen Samstag → der nächste Werktag", () => {
    // Juli 2027: 1. Do (1), 2. Fr (2), 3. Sa (3 → zählt nicht als letzter Tag) → 5. Mo.
    expect(karenzTag("2027-07")).toBe("2027-07-05");
  });
});

describe("B40 — frühester Kündigungstermin (§ 573c Abs. 1 BGB)", () => {
  it("Audit-Fall: Überlassung 01.01.2022, Zugang 07.10.2026 → 31.01.2027", () => {
    const f = fruehesterKuendigungstermin("2026-10-07", "2022-01-01");
    expect(f.termin).toBe("2027-01-31");
    expect(f.fristMonate).toBe(3);
    // Bis zum Ende wird das Mietverhältnis fünf Jahre alt → späterer, sicherer Termin als Hinweis.
    expect(f.sichererTermin).toBe("2027-04-30");
    expect(f.hinweis).toMatch(/fünf Jahre/);
  });
  it("Zugang bis zum dritten Werktag → der laufende Monat zählt", () => {
    expect(fruehesterKuendigungstermin("2026-10-05", "2024-03-01").termin).toBe("2026-12-31");
    expect(fruehesterKuendigungstermin("2026-10-06", "2024-03-01").termin).toBe("2027-01-31");
  });
  it("nach fünf Jahren 6, nach acht Jahren 9 Monate", () => {
    expect(fruehesterKuendigungstermin("2026-10-01", "2021-01-01").termin).toBe("2027-03-31");
    expect(fruehesterKuendigungstermin("2026-10-01", "2018-01-01").termin).toBe("2027-06-30");
    expect(fruehesterKuendigungstermin("2026-10-01", "2018-01-01").hinweis).toBeNull();
  });
  it("ohne Mietbeginn die längste Frist, mit Hinweis", () => {
    const f = fruehesterKuendigungstermin("2026-10-01", null);
    expect(f.termin).toBe("2027-06-30");
    expect(f.hinweis).toMatch(/Mietbeginn/);
  });
  it("Prüfung: Monatsende Pflicht, früher als zulässig blockiert, sicherer Termin nur Hinweis", () => {
    expect(pruefeKuendigung({ zugang: "2026-10-07", termin: "2027-01-01", ueberlassung: "2022-01-01" }).fehler[0]).toMatch(/Ende eines Monats/);
    expect(pruefeKuendigung({ zugang: "2026-10-07", termin: "2026-12-31", ueberlassung: "2022-01-01" }).fehler[0]).toMatch(/Frühestens zum 31\.01\.2027/);
    const ok = pruefeKuendigung({ zugang: "2026-10-07", termin: "2027-01-31", ueberlassung: "2022-01-01" });
    expect(ok.fehler).toEqual([]);
    expect(ok.warnungen[0]).toMatch(/30\.04\.2027/);
  });
  it("Datumshilfen", () => {
    expect(istMonatsende("2027-02-28")).toBe(true);
    expect(istMonatsende("2028-02-28")).toBe(false); // Schaltjahr
    expect(volleJahre("2022-01-01", "2026-12-31")).toBe(4);
    expect(volleJahre("2022-01-01", "2027-01-01")).toBe(5);
    expect(plusMonate("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("A7 — Mieterhöhung: Begründung Pflicht, Fristen und Kappungsgrenze", () => {
  it("wirksam frühestens ab Beginn des dritten Kalendermonats nach Zugang (§ 558b Abs. 1)", () => {
    expect(fruehestWirksam("2026-10-07")).toBe("2027-01-01");
    expect(fruehestWirksam("2026-12-31")).toBe("2027-03-01");
  });
  const basis = { alteMiete: 800, neueMiete: 850, mieteVorDreiJahren: 750, letzteErhoehung: "2024-01-01" };
  it("zu früh → Fehler; korrekt → nichts", () => {
    expect(pruefeMieterhoehung({ ...basis, zugang: "2026-10-07", wirksamAb: "2026-12-01" }).fehler[0]).toMatch(/frühestens 1\.01\.2027|frühestens 01\.01\.2027/);
    expect(pruefeMieterhoehung({ ...basis, zugang: "2026-10-07", wirksamAb: "2027-01-01" })).toEqual({ fehler: [], warnungen: [] });
  });
  it("Sperrfrist ein Jahr und 15 Monate seit der letzten Erhöhung", () => {
    const r = pruefeMieterhoehung({ ...basis, letzteErhoehung: "2026-03-01", zugang: "2026-10-07", wirksamAb: "2027-01-01" });
    expect(r.warnungen.join(" ")).toMatch(/ein Jahr .* 01\.03\.2027/);
    expect(r.warnungen.join(" ")).toMatch(/15 Monaten .* 01\.06\.2027/);
  });
  it("Kappungsgrenze: über 20 % Warnung mit Höchstbetrag, zwischen 15 und 20 % Hinweis auf Landesverordnung", () => {
    expect(pruefeMieterhoehung({ ...basis, neueMiete: 910, zugang: "2026-10-07", wirksamAb: "2027-01-01" }).warnungen[0]).toMatch(/20 %.*900,00/);
    expect(pruefeMieterhoehung({ ...basis, neueMiete: 870, zugang: "2026-10-07", wirksamAb: "2027-01-01" }).warnungen[0]).toMatch(/15 %.*862,50/);
    expect(pruefeMieterhoehung({ ...basis, neueMiete: 860, zugang: "2026-10-07", wirksamAb: "2027-01-01" }).warnungen).toEqual([]);
  });
  it("neue Miete nicht höher → Fehler", () => {
    expect(pruefeMieterhoehung({ ...basis, neueMiete: 800, zugang: "2026-10-07", wirksamAb: "2027-01-01" }).fehler[0]).toMatch(/nicht über/);
  });
  it("letzte Kaltmiete-Änderung aus den Miet-Zeiträumen", () => {
    const stand = { kaltmiete: 900, nk_vorauszahlung: 100, stellplatz_miete: 0 };
    const z = [{ von: "2020-01-01", bis: "2024-05-31", kaltmiete: 800, nk_vorauszahlung: 100, stellplatz_miete: 0 }];
    expect(letzteKaltmieteAenderung(stand, z, "2020-01-01", "2026-10")).toBe("2024-06-01");
    expect(letzteKaltmieteAenderung(stand, [], "2020-01-01", "2026-10")).toBeNull();
  });
  it("Begründungsmittel: jeder Baustein hat Lücken, die vor dem PDF gefüllt werden müssen", () => {
    expect(BEGRUENDUNGSMITTEL.map((b) => b.key)).toEqual(["mietspiegel", "vergleich", "gutachten", "mietdatenbank"]);
    for (const b of BEGRUENDUNGSMITTEL) expect(hatLuecke(b.text)).toBe(true);
    expect(hatLuecke("Mietspiegel Lübeck 2025, Feld C3, 7,10 – 8,40 € je m²")).toBe(false);
  });
});

describe("A8 — Kündigung: Grund Pflicht, Widerspruchshinweis, Schriftform", () => {
  it("die Standardvorlage nennt Form und Frist des Widerspruchs (§ 568 Abs. 2, § 574b)", () => {
    expect(DEFAULT_VORLAGEN.kuendigung).toMatch(/Textform/);
    expect(DEFAULT_VORLAGEN.kuendigung).toMatch(/zwei Monate vor der Beendigung/);
    expect(DEFAULT_VORLAGEN.kuendigung).toMatch(/\{\{grund\}\}/);
  });
  it("Kündigung ist Schriftform-Pflicht; Quittung und Wohnungsgeberbestätigung nur Hinweis", () => {
    expect(digitalGesperrt("kuendigung")).toBe(true);
    expect(digitalGesperrt("mietquittung")).toBe(false);
    expect(digitalGesperrt("wohnungsgeber")).toBe(false);
    expect(digitalGesperrt("mahnung")).toBe(false);
    expect(SCHRIFTFORM.mietquittung?.stufe).toBe("ungeklaert");
  });
  const p = (x: Partial<Parameters<typeof pruefeBrief>[0]>) =>
    pruefeBrief({ art: "kuendigung", text: DEFAULT_VORLAGEN.kuendigung, grund: "Eigenbedarf für meine Tochter.", vName: "Max Muster", datum: "2027-01-31", zugang: "2026-10-07", kuendigung: { ueberlassung: "2022-01-01" }, ...x });
  it("ohne Begründung, ohne Zugang, ohne Absender: fehlt", () => {
    expect(p({ grund: "" }).fehlend).toContain("Begründung");
    expect(p({ zugang: "" }).fehlend).toContain("Zugang beim Mieter");
    expect(p({ vName: " " }).fehlend).toContain("Absender (Name)");
    expect(p({}).fehlend).toEqual([]);
  });
  it("eigene Vorlage ohne {{grund}} blockiert; ohne Widerspruchshinweis warnt", () => {
    expect(p({ text: "hiermit kündige ich zum {{datum}}." }).fehler[0]).toMatch(/\{\{grund\}\}/);
    expect(p({ text: "hiermit kündige ich zum {{datum}}. {{grund}}" }).warnungen.join(" ")).toMatch(/Textform/);
  });
  it("die Termin-Prüfung läuft mit", () => {
    expect(p({ datum: "2026-12-31" }).fehler[0]).toMatch(/Frühestens zum 31\.01\.2027/);
  });
  it("Mieterhöhung: Begründung Pflicht, Lücken blockieren", () => {
    const m = (x: Partial<Parameters<typeof pruefeBrief>[0]>) =>
      pruefeBrief({ art: "mieterhoehung", text: DEFAULT_VORLAGEN.mieterhoehung, grund: "Mietspiegel Lübeck 2025, Feld C3.", vName: "Max", datum: "2027-01-01", zugang: "2026-10-07", mieterhoehung: { alteMiete: 800, neueMiete: 850, mieteVorDreiJahren: 800, letzteErhoehung: null }, ...x });
    expect(m({ grund: "" }).fehlend).toContain("Begründung");
    expect(m({ grund: BEGRUENDUNGSMITTEL[0].text }).fehler[0]).toMatch(/Lücken/);
    expect(m({})).toEqual({ fehlend: [], fehler: [], warnungen: [] });
    expect(m({ datum: "2026-12-01" }).fehler[0]).toMatch(/Wirksam ab/);
  });
  it("andere Arten: Begründung bleibt freiwillig, Absender Pflicht", () => {
    const r = pruefeBrief({ art: "mahnung", text: DEFAULT_VORLAGEN.mahnung, grund: "", vName: "Max", datum: "2026-10-15", zugang: "" });
    expect(r).toEqual({ fehlend: [], fehler: [], warnungen: [] });
    expect(fehlendePlatzhalter(DEFAULT_VORLAGEN.mahnung, { betrag: "1,00 €", datum: "1. Oktober 2026", grund: "" })).toEqual([]);
  });
});

describe("B44 — alle Vertragspartner", () => {
  it("Namen aus Freitext, ohne Doppelte, als Aufzählung und Anrede", () => {
    expect(weitereMieterListe("Ben Weber\nClara Weber; ")).toEqual(["Ben Weber", "Clara Weber"]);
    expect(alleMieter("Anna Weber", "Ben Weber, anna weber")).toEqual(["Anna Weber", "Ben Weber"]);
    expect(namenAufzaehlung(["Anna Weber"])).toBe("Anna Weber");
    expect(namenAufzaehlung(["A", "B", "C"])).toBe("A, B und C");
    expect(anrede(["Anna Weber", "Ben Weber"])).toBe("Sehr geehrte/r Anna Weber, sehr geehrte/r Ben Weber,");
    expect(anrede(["Anna Weber"])).toBe("Sehr geehrte/r Anna Weber,");
  });
});

describe("A7 — Grundlage aus den Mieterdaten (EINE Rechnung für Vorschau und PDF)", () => {
  const stand = { kaltmiete: 800, nk_vorauszahlung: 100, stellplatz_miete: 0, mietbeginn: "2020-01-01", letzte_erhoehung: null };
  const z = [
    { von: "2020-01-01", bis: "2023-12-01", kaltmiete: 700, nk_vorauszahlung: 100, stellplatz_miete: 0 },
    { von: "2024-01-01", bis: null, kaltmiete: 760, nk_vorauszahlung: 100, stellplatz_miete: 0 },
  ];
  it("Kappungsbasis = Miete drei Jahre vor „Wirksam ab“, heutige Miete und letzte Änderung aus den Zeiträumen", () => {
    const b = mieterhoehungBasis(stand, z, "2026-12-01", "2026-10");
    expect(b.alteMiete).toBe(760); // laufender Zeitraum schlägt das Mieterfeld
    expect(b.mieteVorDreiJahren).toBe(700); // 12/2026 − 36 Monate = 12/2023 → erster Zeitraum
    expect(mieterhoehungBasis(stand, z, "2027-01-01", "2026-10").mieteVorDreiJahren).toBe(760); // 01/2024
    expect(b.letzteErhoehung).toBe("2024-01-01");
  });
  it("jüngeres Mietverhältnis: Basis ist die Anfangsmiete; Feld am Mieter zählt, wenn es später liegt", () => {
    const b = mieterhoehungBasis({ ...stand, mietbeginn: "2025-03-01", letzte_erhoehung: "2026-02-01" }, [], "2027-06-01", "2026-10");
    expect(b.mieteVorDreiJahren).toBe(800);
    expect(b.letzteErhoehung).toBe("2026-02-01");
    expect(b.mietbeginn).toBe("2025-03-01");
    // Mit Zeiträumen unterscheidbar: Anfangsmiete 700, heute 800. Ohne den Rückgriff auf den
    // Mietbeginn fiele 06/2024 (vor dem Vertrag) auf das Mieterfeld (800) zurück.
    const zr = [
      { von: "2025-03-01", bis: "2025-12-01", kaltmiete: 700, nk_vorauszahlung: 100, stellplatz_miete: 0 },
      { von: "2026-01-01", bis: null, kaltmiete: 800, nk_vorauszahlung: 100, stellplatz_miete: 0 },
    ];
    expect(mieterhoehungBasis({ ...stand, mietbeginn: "2025-03-01" }, zr, "2027-06-01", "2026-10").mieteVorDreiJahren).toBe(700);
  });
  it("15 Monate gelten auch ab Mietbeginn, wenn es keine Erhöhung gab (§ 558 Abs. 1 S. 1)", () => {
    const r = pruefeMieterhoehung({ zugang: "2026-10-07", wirksamAb: "2027-01-01", alteMiete: 800, neueMiete: 850, mieteVorDreiJahren: 800, letzteErhoehung: null, mietbeginn: "2026-01-01" });
    expect(r.warnungen.join(" ")).toMatch(/15 Monaten .* 01\.04\.2027/);
    expect(r.warnungen.join(" ")).not.toMatch(/ein Jahr/);
  });
});

describe("B44 — Empfänger und Hinweis", () => {
  it("bis drei Namen je eine Zeile, darüber eine Aufzählung", () => {
    expect(empfaengerNamenZeilen(["A"])).toEqual(["A"]);
    expect(empfaengerNamenZeilen(["A", "B", "C"])).toEqual(["A", "B", "C"]);
    expect(empfaengerNamenZeilen(["A", "B", "C", "D"])).toEqual(["A, B, C und D"]);
  });
  it("Mieterhöhung/Kündigung mit nur einem Namen → Hinweis; mit zweien oder bei anderen Arten nicht", () => {
    const k = { art: "kuendigung", text: DEFAULT_VORLAGEN.kuendigung, grund: "Eigenbedarf", vName: "Max", datum: "2027-01-31", zugang: "2026-10-07", kuendigung: { ueberlassung: "2022-01-01" } };
    expect(pruefeBrief({ ...k, mieterAnzahl: 1 }).warnungen).toContain(MEHRERE_MIETER_HINWEIS);
    expect(pruefeBrief({ ...k, mieterAnzahl: 2 }).warnungen).not.toContain(MEHRERE_MIETER_HINWEIS);
    const m = pruefeBrief({ art: "mahnung", text: DEFAULT_VORLAGEN.mahnung, grund: "", vName: "Max", datum: "2026-10-15", zugang: "", mieterAnzahl: 1 });
    expect(m.warnungen).toEqual([]);
  });
  it("Ablehnungstext: fehlende Angaben zuerst, dann Fehler", () => {
    expect(briefAblehnung({ fehlend: ["Absender (Name)", "Begründung"], fehler: ["X"], warnungen: ["W"] })).toEqual(["Bitte noch ausfüllen: Absender (Name), Begründung.", "X"]);
    expect(briefAblehnung({ fehlend: [], fehler: [], warnungen: ["W"] })).toEqual([]);
  });
});

describe("Anbindung an Generator, Versand und PDF", () => {
  it("Brief-Generator und Server prüfen mit DERSELBEN Funktion", () => {
    expect(lies("components/DocGenerator.tsx")).toMatch(/pruefeBrief\(/);
    expect(lies("lib/pdf/erzeugen.ts")).toMatch(/pruefeBrief\(/);
  });
});
