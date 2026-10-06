// Nutzungsdauern von Bauteilen — Grundlage für „kostengünstig oder langlebig“.
//
// QUELLE: BBSR, „Nutzungsdauern von Bauteilen für Lebenszyklusanalysen nach BNB“, Datei
// 26.03.13_BBSR_Nutzungdsdauern.xlsx (Stand der Werte 04.11.2025), Blätter „KG 300“ und „KG 400 “,
// am 05.10.2026 direkt aus der Datei gelesen (Kennnummer = Spalte 1 der Tabelle):
// https://www.nachhaltigesbauen.de/austausch/nutzungsdauern-von-bauteilen/
//
// GRENZEN (so in der Oberfläche zu sagen): Durchschnittswerte für Lebenszyklus-Rechnungen, keine
// Herstellergarantie. Die Laminat-Zeilen kamen laut Änderungshistorie der Datei vom Herstellerverband
// (EPLF). Für WC, Waschtisch, Armaturen, Schalter und Steckdosen nennt die Tabelle keine Werte.

export type Nutzungsdauer = {
  id: string;
  bauteil: string;
  /** Jahre laut BBSR; bei „≥ 50“ steht hier 50 und `mindestens` ist wahr. */
  jahre: number;
  mindestens: boolean;
  bbsr: string;
};

export const NUTZUNGSDAUER_STAND = "BBSR, Stand 04.11.2025 (Datei vom 13.03.2026), gelesen 05.10.2026";

export const NUTZUNGSDAUERN: Nutzungsdauer[] = [
  { id: "anstrich_k1", bauteil: "Innenanstrich, Nassabriebklasse 1", jahre: 20, mindestens: false, bbsr: "345.111.25" },
  { id: "anstrich_k2", bauteil: "Innenanstrich, Nassabriebklasse 2", jahre: 15, mindestens: false, bbsr: "345.112.25" },
  { id: "anstrich_k3", bauteil: "Innenanstrich, Nassabriebklasse ≥ 3", jahre: 10, mindestens: false, bbsr: "345.113.25" },
  { id: "tapete_ueberstreichbar", bauteil: "Tapete, überstreichbar", jahre: 25, mindestens: false, bbsr: "345.411.25" },
  { id: "tapete_nicht_ueberstreichbar", bauteil: "Tapete, nicht überstreichbar", jahre: 18, mindestens: false, bbsr: "345.412.25" },
  { id: "laminat_nk31", bauteil: "Laminat/MMF, Wohnen, schwimmend, Nutzungsklasse 31", jahre: 15, mindestens: false, bbsr: "353.125.25" },
  { id: "laminat_nk32", bauteil: "Laminat/MMF, Wohnen, schwimmend, Nutzungsklasse 32/33", jahre: 20, mindestens: false, bbsr: "353.126.25" },
  { id: "cv_belag", bauteil: "CV-Belag, Nadelvlies, Tufting (Wohnen, geklebt)", jahre: 10, mindestens: false, bbsr: "353.127.25" },
  { id: "pvc_heterogen", bauteil: "PVC heterogen (geklebt)", jahre: 20, mindestens: false, bbsr: "353.132.25" },
  { id: "linoleum_pvc_homogen", bauteil: "Linoleum, PVC homogen (geklebt)", jahre: 25, mindestens: false, bbsr: "353.131.25" },
  { id: "parkett_mehrschicht_duenn", bauteil: "Holz-Mehrschichtparkett, Nutzschicht < 3,5 mm", jahre: 45, mindestens: false, bbsr: "353.142.25" },
  { id: "parkett_mehrschicht_dick", bauteil: "Holz-Mehrschichtparkett, Nutzschicht > 3,5 mm", jahre: 50, mindestens: true, bbsr: "353.143.25" },
  { id: "parkett_massiv", bauteil: "Vollholzparkett, Holzdielen", jahre: 50, mindestens: true, bbsr: "353.141.25" },
  { id: "holzlack", bauteil: "Holzlack/Versiegelung für Bodenbeläge", jahre: 15, mindestens: false, bbsr: "353.144.25" },
  { id: "fliesen", bauteil: "Keramische Fliesen (Boden)", jahre: 50, mindestens: true, bbsr: "353.118.25" },
  { id: "innentuer", bauteil: "Innentür, Standard", jahre: 50, mindestens: true, bbsr: "344.111.25" },
  { id: "feuchtraumtuer", bauteil: "Feuchtraumtür", jahre: 40, mindestens: false, bbsr: "344.114.25" },
  { id: "heizkoerper", bauteil: "Plattenheizkörper, Stahl", jahre: 50, mindestens: true, bbsr: "423.113.25" },
  { id: "thermostatventil", bauteil: "Thermostatventile", jahre: 15, mindestens: false, bbsr: "423.119.25" },
  { id: "elektroinstallation", bauteil: "Niederspannungsinstallation (Leitungen)", jahre: 30, mindestens: false, bbsr: "444.111.25" },
  { id: "gas_brennwert_wand", bauteil: "Gas-Brennwertkessel, wandhängend", jahre: 18, mindestens: false, bbsr: "421.113.25" },
  { id: "waermepumpe_luft", bauteil: "Wärmepumpe Luft/Wasser", jahre: 18, mindestens: false, bbsr: "421.129.25" },
  { id: "fenster_pvc", bauteil: "Fenster (Rahmen und Flügel), PVC-U", jahre: 50, mindestens: true, bbsr: "334.212.25" },
];

export function nutzungsdauer(id: string): Nutzungsdauer | null {
  return NUTZUNGSDAUERN.find((n) => n.id === id) ?? null;
}

/**
 * Kosten je Jahr Nutzung = Preis ÷ Nutzungsdauer — das Vergleichsmaß zwischen „günstig“ und
 * „langlebig“. Bei „≥ 50 Jahre“ ist das Ergebnis eine Obergrenze (die Dauer kann länger sein).
 */
export function kostenJeJahr(preis: number, n: Nutzungsdauer): { wert: number; hoechstens: boolean } {
  return { wert: n.jahre > 0 ? Math.round((preis / n.jahre) * 100) / 100 : 0, hoechstens: n.mindestens };
}
