// Arbeiten-Katalog des Sanierungs-Guides: was ein Fachbetrieb oder Handwerker je Einheit kostet.
//
// ALTERT: Preise ändern sich laufend und je Region. Prüfzyklus in
// docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md. Ändert sich ein Wert, nur hier.
//
// WIE ERHOBEN (05.10.2026): Jede Zahl steht wörtlich auf der genannten Seite (`zitat`) — beim
// Eintragen selbst nachgelesen, nicht aus einer Zusammenfassung übernommen (eine Zusammenfassung
// hatte „Fliesen-Demontage 350 €/m²“ gelesen; auf der Seite stehen 65 €/m²).
// Regeln (docs/zukunft/SANIERUNGS-GUIDE.md, Abschnitt 2a):
//   1. Mindestens zwei UNABHÄNGIGE Quellen je Arbeit — sonst `einzelquelle` mit Begründung.
//      Wer nachweislich abschreibt (gleiche Spanne, gleicher Wortlaut), zählt nicht mit (`abhaengigVon`).
//   2. Alles brutto: Netto-Angaben × 1,19. Angaben ohne brutto/netto bleiben, wie sie sind (`unklar`).
//   3. Ausreißer werden NICHT gemittelt, sondern weggelassen und im Kommentar begründet.
//   4. Die Spanne je Arbeit ergibt sich aus den Quellen (`preisSpanne`) — nie von Hand.
// Neutrale Euro-Werte für den Innenausbau gibt es nicht frei (Verbraucherzentrale, test.de,
// co2online, BBSR, Destatis durchsucht). Die beste Quelle sind BKI-Mittelwerte aus abgerechneten
// Projekten, die Schwäbisch Hall veröffentlicht (netto; „Bei Einzelmaßnahmen und direkter
// Beauftragung durch den Bauherren ist mit Preiszuschlägen und Mehrkosten zu rechnen.“).

import type { Spanne } from "@/lib/sanierung/rechner";

export const ARBEITEN_STAND = "05.10.2026";
export const MWST = 0.19;

/** Stärke der Quelle: neutral (Verbraucherzentrale, co2online, kommunal) > BKI-Statistik > Portal. */
export type QuellenArt = "neutral" | "bki" | "portal";

export type PreisQuelle = {
  name: string;
  url: string;
  /** Stand laut Seite; „ohne Datum“, wenn die Seite keinen nennt. */
  stand: string;
  art: QuellenArt;
  /** Werte so, wie sie auf der Seite stehen (vor Umrechnung). Ein Einzelwert: von = bis. */
  von: number;
  bis: number;
  mwst: "brutto" | "netto" | "unklar";
  /** Wörtlicher Ausschnitt der Seite — der Beleg. */
  zitat: string;
  /** Name der Quelle, von der diese erkennbar abschreibt — zählt dann nicht als zweite Quelle. */
  abhaengigVon?: string;
  /** Wenn `von`/`bis` aus dem Zitat errechnet sind (nicht wörtlich): wie. */
  umgerechnet?: string;
};

export type Gewerk = "elektrik" | "bad" | "heizung" | "fenster" | "tueren" | "kueche" | "maler" | "boden" | "fliesen" | "entsorgung";

export type Mengenbasis =
  | "stueck"
  | "wohnflaeche"
  | "badflaeche"
  | "wandflaeche"
  | "bodenflaeche"
  | "laufmeter"
  | "pauschal";

export type ArbeitId =
  | "schalter_steckdose_tauschen"
  | "steckdose_neu"
  | "fi_nachruesten"
  | "unterverteilung_erneuern"
  | "elektrik_komplett"
  | "e_check"
  | "bad_komplett"
  | "wc_tauschen"
  | "wc_vorwand"
  | "waschtisch_tauschen"
  | "badewanne_tauschen"
  | "heizkoerper_tauschen"
  | "waermepumpe"
  | "fenster_tauschen"
  | "innentuer_komplett"
  | "kueche_moebel"
  | "kueche_montage"
  | "maler_streichen"
  | "maler_raufaser_streichen"
  | "maler_spachteln"
  | "tapete_entfernen"
  | "klickboden_verlegen"
  | "parkett_schleifen"
  | "bodenbelag_entfernen"
  | "fliesen_verlegen"
  | "altfliesen_entfernen"
  | "container_bauschutt"
  | "container_mischabfall";

export type Arbeit = {
  id: ArbeitId;
  gewerk: Gewerk;
  label: string;
  /** Wofür der Preis gilt — so steht es im Ergebnis neben der Menge. */
  einheit: string;
  mengenbasis: Mengenbasis;
  /** Preis enthält das Material (sonst kommt das Material aus dem Baumarkt-Katalog dazu). */
  inklMaterial: boolean;
  /** Nur durch einen Fachbetrieb (Strom, Gas, Trinkwasser — NAV/NDAV/AVBWasserV) — keine Eigenleistung anbieten. */
  nurFachbetrieb: boolean;
  quellen: PreisQuelle[];
  /** Begründung, wenn nur eine unabhängige Quelle vorliegt. */
  einzelquelle?: string;
  hinweis?: string;
};

const brutto = (wert: number, mwst: PreisQuelle["mwst"]) => (mwst === "netto" ? wert * (1 + MWST) : wert);

/** Rundung nach außen: unter 100 € auf ganze Euro, unter 1.000 € auf 5 €, darüber auf 50 €. */
function schritt(v: number): number {
  return v < 100 ? 1 : v < 1000 ? 5 : 50;
}
const ab = (v: number) => Math.floor(v / schritt(v)) * schritt(v);
const auf = (v: number) => Math.ceil(v / schritt(v)) * schritt(v);

/** Brutto-Spanne je Einheit über alle Quellen (kleinster bis größter Wert), nach außen gerundet. */
export function preisSpanne(a: Arbeit): Spanne {
  const werte = a.quellen.flatMap((q) => [brutto(q.von, q.mwst), brutto(q.bis, q.mwst)]);
  return { min: ab(Math.min(...werte)), max: auf(Math.max(...werte)) };
}

/** Stärkste Quelle der Arbeit. Eine Zeile gilt nur dann als „Portalpreis“, wenn nichts Besseres sie stützt. */
export function herkunft(a: Arbeit): QuellenArt {
  const arten = new Set(a.quellen.map((q) => q.art));
  return arten.has("neutral") ? "neutral" : arten.has("bki") ? "bki" : "portal";
}

/** Zahl der Quellen, die nicht erkennbar voneinander abschreiben. */
export function unabhaengigeQuellen(a: Arbeit): number {
  return a.quellen.filter((q) => !q.abhaengigVon).length;
}

// ---- Quellen, die mehrfach vorkommen --------------------------------------------------------

const AM = { name: "Angebots-Meister (Software für Handwerker), Elektroarbeiten Preise 2026", url: "https://angebots-meister.de/blog/elektroarbeiten-preise-2026", stand: "23.03.2026", art: "portal" as const };
const AG = { name: "AuftragsGlück, Elektroinstallation Kosten 2026", url: "https://auftragsglueck.de/ratgeber/elektroinstallation-kosten/", stand: "2026 (ohne Tagesdatum)", art: "portal" as const };
const SH_BAD = { name: "Schwäbisch Hall, Badsanierung Kosten (BKI-Werte)", url: "https://www.schwaebisch-hall.de/kosten-bauen-sanieren/kosten-sanieren-renovieren/badsanierung-kosten.html", stand: "BKI 4. Quartal 2025", art: "bki" as const };
const SH_RENO = { name: "Schwäbisch Hall, Kosten Sanieren & Renovieren (BKI-Werte)", url: "https://www.schwaebisch-hall.de/kosten-bauen-sanieren/kosten-sanieren-renovieren.html", art: "bki" as const };
const AH_MALER = { name: "Aroundhome, Maler Preise & Kosten", url: "https://www.aroundhome.de/maler/preise-kosten/", stand: "30.07.2026", art: "portal" as const };
const RR_SAN = { name: "Renovierung-Ratgeber (Andymen Baugesellschaft), Sanitär-Kosten", url: "https://renovierung-ratgeber.de/ratgeber/sanitaer-kosten", stand: "02.08.2026", art: "portal" as const };
const BA = "https://ratgeber.blauarbeit.de/kosten-preise/";
const DAIBAU = { name: "Daibau, Baukostenrechner Fliesenleger", url: "https://www.daibau.de/baukostenrechner/fliesenleger", stand: "07.08.2025", art: "portal" as const };
const TL_BODEN = { name: "Trustlocal, Bodenleger Kosten (eigene Anfragedaten)", url: "https://trustlocal.de/kosten/bodenleger-kosten/", stand: "06.05.2026", art: "portal" as const };
const CL = { name: "Clearago, Containerdienst Preisliste", url: "https://www.clearago.de/containerdienst/preisliste/", stand: "ohne Datum", art: "portal" as const };
const CDP = { name: "Containerdienst-Portal, 7-m³-Container Kosten", url: "https://www.containerdienst-portal.de/containergroessen/7m3-container-kosten/", stand: "ohne Datum", art: "portal" as const };

// ---- Katalog --------------------------------------------------------------------------------

export const ARBEITEN: Record<ArbeitId, Arbeit> = {
  // ===== Elektrik (nur Fachbetrieb: NAV § 13 Abs. 2) =====
  schalter_steckdose_tauschen: {
    id: "schalter_steckdose_tauschen", gewerk: "elektrik", label: "Schalter oder Steckdose tauschen",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { ...AM, von: 35, bis: 75, mwst: "netto", zitat: "Steckdose in Bestandsleitung setzen 45–75 € pro Stück … Taster / Schalter tauschen (Bestand) 35–65 € pro Stück" },
      { ...AG, von: 60, bis: 120, mwst: "unklar", zitat: "Lichtschalter einbauen/tauschen 60–120 €" },
    ],
  },
  steckdose_neu: {
    id: "steckdose_neu", gewerk: "elektrik", label: "Zusätzliche Steckdose (Unterputz, neue Leitung)",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    hinweis: "Schlitze schließen und verputzen kommt je nach Betrieb dazu (Angebots-Meister: 15–40 € je Meter).",
    quellen: [
      { ...AM, von: 85, bis: 180, mwst: "netto", zitat: "Steckdose neu inkl. Leitungsverlegung (Unterputz) 85–180 € pro Stück" },
      { ...AG, von: 150, bis: 300, mwst: "unklar", zitat: "Steckdose neu setzen (mit Schlitz) 150–300 €" },
    ],
  },
  fi_nachruesten: {
    id: "fi_nachruesten", gewerk: "elektrik", label: "FI-Schutzschalter nachrüsten",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { ...AM, von: 180, bis: 320, mwst: "netto", zitat: "FI-Schutzschalter nachrüsten 180–320 € pro Stück" },
      { ...AG, von: 150, bis: 350, mwst: "unklar", zitat: "FI-Schutzschalter nachrüsten 150–350 €" },
    ],
  },
  // Weggelassen: Wohnglück „4.000–5.000 €“ (Bezug unklar) und Angebots-Meister 1.200–2.200 € netto
  // (gilt fürs Einfamilienhaus). Das Wohnungs-Rechenbeispiel von Angebots-Meister bleibt drin.
  unterverteilung_erneuern: {
    id: "unterverteilung_erneuern", gewerk: "elektrik", label: "Sicherungskasten (Unterverteilung) erneuern",
    einheit: "je Wohnung", mengenbasis: "pauschal", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { ...AG, von: 800, bis: 1800, mwst: "unklar", zitat: "Sicherungskasten erneuern (Wohnung) 800–1.800 €" },
      { ...AM, von: 1800, bis: 1800, mwst: "netto", zitat: "Altbauwohnung, 75 qm … 2 Sicherungskasten erneuern inkl. FI 1 Stk 1.800,00 €" },
    ],
  },
  // AuftragsGlück nennt Wohnungsgrößen, nicht €/m²: 3 Zimmer (70–90 m²) 7.000–12.000 € → 78–171 €/m²
  // (umgerechnet: 7.000 / 90 bis 12.000 / 70). BerufExperten 45–90 €/m² gilt für Wohnhäuser → weggelassen.
  elektrik_komplett: {
    id: "elektrik_komplett", gewerk: "elektrik", label: "Elektrik komplett erneuern (Altbau)",
    einheit: "je m² Wohnfläche", mengenbasis: "wohnflaeche", inklMaterial: true, nurFachbetrieb: true,
    hinweis: "Malerarbeiten nach dem Verputzen sind nicht enthalten.",
    quellen: [
      { ...AG, von: 78, bis: 171, mwst: "unklar", umgerechnet: "7.000 € / 90 m² bis 12.000 € / 70 m²", zitat: "3-Zimmer (70–90 m²) 7.000–12.000 € … Neuer Sicherungskasten, neue Leitungen in allen Räumen, neue Steckdosen und Schalter, Stemm- und Verputzarbeiten" },
      { name: "Sparkasse, Ratgeber Modernisierungskosten (ohne Quellenangabe)", url: "https://www.sparkasse.de/pk/ratgeber/wohnen/immobilie-modernisieren/modernisierungskosten.html", stand: "ohne Datum", art: "portal", von: 100, bis: 170, mwst: "unklar", zitat: "Erneuerung der Elektrik Je nach Aufwand circa 100 bis 170 Euro pro Quadratmeter" },
      { ...AM, von: 139, bis: 139, mwst: "brutto", zitat: "Das sind ca. 139 € pro qm brutto , marktüblich für eine Komplettsanierung im Altbau." },
    ],
  },
  e_check: {
    id: "e_check", gewerk: "elektrik", label: "E-Check (Prüfung der Anlage)",
    einheit: "je Wohnung", mengenbasis: "pauschal", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { name: "Blauarbeit, E-Check Kosten", url: BA + "e-check-kosten", stand: "26.06.2026", art: "portal", von: 100, bis: 200, mwst: "unklar", zitat: "Wohnung (bis 4 Zimmer) 100 bis 200 €" },
      { name: "BerufExperten, E-Check Preise", url: "https://www.berufexperten.de/preise/e-check", stand: "2026 (ohne Tagesdatum)", art: "portal", von: 120, bis: 220, mwst: "unklar", zitat: "Ein E-Check kostet in Wohnungen meist 120–220 €" },
    ],
  },

  // ===== Bad =====
  bad_komplett: {
    id: "bad_komplett", gewerk: "bad", label: "Bad komplett sanieren (inkl. Leitungen)",
    einheit: "je m² Badfläche", mengenbasis: "badflaeche", inklMaterial: true, nurFachbetrieb: true,
    hinweis: "Spanne von Standard bis Luxus — Aroundhome: Standard ca. 1.200, gehoben ca. 2.000, Luxus ca. 3.500 €/m².",
    quellen: [
      { name: "Aroundhome, Badezimmer Preise & Kosten", url: "https://www.aroundhome.de/badezimmer/preise-kosten/", stand: "18.02.2026", art: "portal", von: 1200, bis: 3500, mwst: "unklar", zitat: "Die Kosten für eine Badsanierung liegen zwischen 1.200 und 3.500 Euro pro Quadratmeter" },
      { name: "Schwäbisch Hall, Badsanierung Kosten (Überschrift, ohne Quellenangabe)", url: SH_BAD.url, stand: "aktualisiert 04.09.2025", art: "portal", von: 900, bis: 3500, mwst: "unklar", zitat: "Im Schnitt ist bei einer Badsanierung mit 900 bis 3.500 Euro Kosten pro Quadratmeter zu rechnen." },
    ],
  },
  wc_tauschen: {
    id: "wc_tauschen", gewerk: "bad", label: "Stand-WC tauschen (vorhandene Anschlüsse)",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { name: "Blauarbeit, Toilette einbauen lassen", url: BA + "toilette-einbauen-lassen", stand: "06.07.2026", art: "portal", von: 300, bis: 700, mwst: "unklar", zitat: "Eine Toilette tauschen zu lassen kostet 2026 in der Regel 300 bis 700 € inklusive neuem Stand-WC, Demontage und Montage." },
      { ...RR_SAN, von: 250, bis: 800, mwst: "brutto", zitat: "250–800 € Einzelmontage Waschtisch oder WC bei vorhandenen Anschlüssen … Bruttorichtwerte inklusive üblicher Montage" },
    ],
  },
  wc_vorwand: {
    id: "wc_vorwand", gewerk: "bad", label: "Wandhängendes WC mit Vorwandelement",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { name: "Blauarbeit, Toilette einbauen lassen", url: BA + "toilette-einbauen-lassen", stand: "06.07.2026", art: "portal", von: 800, bis: 1500, mwst: "unklar", zitat: "Teurer wird es beim Wechsel auf ein wandhängendes WC mit neuem Vorwandelement: Hier sind 800 bis 1.500 € realistisch." },
      { ...SH_BAD, von: 1045, bis: 1045, mwst: "netto", zitat: "WC, wandhängend, Spülkasten, WC-Sitz, Betätigungsplatte ca. 1.045 € / Stück" },
    ],
  },
  waschtisch_tauschen: {
    id: "waschtisch_tauschen", gewerk: "bad", label: "Waschtisch mit Armatur tauschen",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...RR_SAN, von: 250, bis: 800, mwst: "brutto", zitat: "250–800 € Einzelmontage Waschtisch oder WC bei vorhandenen Anschlüssen" },
      { ...SH_BAD, von: 1015, bis: 1015, mwst: "netto", zitat: "Waschtisch, 600/500 mm, Armatur, Siphon, Eckventile ca. 1.015 € / Stück" },
    ],
  },
  badewanne_tauschen: {
    id: "badewanne_tauschen", gewerk: "bad", label: "Badewanne tauschen",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { name: "Aroundhome, Badezimmer Preise & Kosten", url: "https://www.aroundhome.de/badezimmer/preise-kosten/", stand: "18.02.2026", art: "portal", von: 2000, bis: 4500, mwst: "unklar", zitat: "Badewanne austauschen: ca. 2.000 – 4.500 Euro inkl. Entsorgung der alten Wanne, neuer Abmauerung oder Schürze und Armatur" },
      { ...SH_BAD, von: 1920, bis: 1920, mwst: "netto", zitat: "Badewanne, 170 x 80 cm, Thermostat-Wandarmatur, Ablauf und Brausegarnitur ca. 1.920 € / Stück" },
    ],
  },

  // ===== Heizung =====
  heizkoerper_tauschen: {
    id: "heizkoerper_tauschen", gewerk: "heizung", label: "Heizkörper tauschen",
    einheit: "je Stück", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    quellen: [
      { name: "BerufExperten, Heizkörper austauschen Kosten", url: "https://www.berufexperten.de/preise/heizkoerper-austauschen-kosten", stand: "2026 (ohne Tagesdatum)", art: "portal", von: 300, bis: 700, mwst: "unklar", zitat: "einen einfachen 1:1-Tausch liegen die Heizkörper austauschen Kosten häufig bei 300–700 € pro Stück" },
      { name: "Renovierung-Ratgeber, Heizkörper tauschen Kosten", url: "https://renovierung-ratgeber.de/ratgeber/heizkoerper-tauschen-kosten", stand: "22.06.2026", art: "portal", von: 300, bis: 800, mwst: "unklar", zitat: "ca. 300–800 € pro Heizkörper inkl. Montage … inkl. Material & Arbeit" },
      { name: "Reduco, Heizkörper austauschen Kosten", url: "https://reduco.ai/blog/heizung/heizkoerper-austauschen-kosten", stand: "07.09.2026", art: "portal", von: 350, bis: 650, mwst: "unklar", zitat: "Einzelner Heizkörper inkl. Montage: Kompaktheizkörper Typ 22 350–650 €" },
    ],
  },
  waermepumpe: {
    id: "waermepumpe", gewerk: "heizung", label: "Luft-Wasser-Wärmepumpe (Heizungstausch)",
    einheit: "pauschal", mengenbasis: "pauschal", inklMaterial: true, nurFachbetrieb: true,
    einzelquelle: "Erhebung der Verbraucherzentrale-Energieberatung (neutral); Durchschnitt inkl. Entsorgung und Anschluss, ohne neue Leitungen und Heizflächen.",
    hinweis: "Durchschnittswert, keine Spanne. Förderung (KfW 458) rechnet der Sanierungsrechner gesondert.",
    quellen: [
      { name: "Verbraucherzentrale Energieberatung, Entwicklung Heiztechnikpreise", url: "https://verbraucherzentrale-energieberatung.de/heizen/neue-heiztechnik/entwicklung-heiztechnikpreise/", stand: "2026", art: "neutral", von: 36000, bis: 36000, mwst: "unklar", zitat: "Eine Luft-Wasser-Wärmepumpe kostet laut Erhebung aktuell durchschnittlich 36.000 Euro" },
    ],
  },

  // ===== Fenster (Eigentumswohnung: Gemeinschaftseigentum — lib/sanierung/zustand.ts) =====
  fenster_tauschen: {
    id: "fenster_tauschen", gewerk: "fenster", label: "Fenster tauschen (Standardfenster)",
    einheit: "je Fenster", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: true,
    einzelquelle: "co2online (neutral, gemeinnützig); Portalpreise nicht erhoben.",
    quellen: [
      { name: "co2online, Fenster tauschen", url: "https://www.co2online.de/energie-sparen/heizenergie-sparen/lueften-lueftungsanlagen-fenster/fenster-tauschen/", stand: "23.03.2026", art: "neutral", von: 500, bis: 1500, mwst: "unklar", zitat: "Ein Standardfenster kostet inklusive Einbau zwischen 500 und 1.500 Euro" },
    ],
  },

  // ===== Türen =====
  // BerufExperten „150–300 €“ ist nur die Montage → nicht als Gesamtpreis verwendet.
  innentuer_komplett: {
    id: "innentuer_komplett", gewerk: "tueren", label: "Innentür mit Zarge (Element + Einbau)",
    einheit: "je Tür", mengenbasis: "stueck", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { name: "Blauarbeit, Tür einbauen Kosten", url: BA + "tuer-einbauen-kosten", stand: "16.07.2026", art: "portal", von: 250, bis: 800, mwst: "unklar", zitat: "Rechnen Sie das Türelement dazu, liegen die Kosten gesamt bei 250 bis 800 € pro Tür." },
      { name: "byndl, Türen und Zargen", url: "https://byndl.de/ratgeber/tueren-zargen", stand: "ohne Datum", art: "portal", von: 480, bis: 480, mwst: "unklar", zitat: "Innentür mit Zarge einbauen: Kosten ab 480 € pro Tür" },
    ],
  },

  // ===== Küche =====
  kueche_moebel: {
    id: "kueche_moebel", gewerk: "kueche", label: "Einbauküche (Einstieg bis Mittelklasse, ohne Montage)",
    einheit: "je laufendem Meter", mengenbasis: "laufmeter", inklMaterial: true, nurFachbetrieb: false,
    einzelquelle: "Preisklassen von fachportal-kueche.de, zitiert von kuechenliebhaber.de (Portal mit Provision) — eine Quelle.",
    quellen: [
      { name: "Küchenliebhaber (zitiert fachportal-kueche.de)", url: "https://www.kuechenliebhaber.de/ratgeber/kuchenpreise", stand: "Mai 2026", art: "portal", von: 500, bis: 2000, mwst: "unklar", zitat: "Klasse Preis pro lfd. Meter … Einstieg 500–1.000 € … Mittelklasse 1.000–2.000 €" },
    ],
  },
  kueche_montage: {
    id: "kueche_montage", gewerk: "kueche", label: "Küchenmontage",
    einheit: "je laufendem Meter", mengenbasis: "laufmeter", inklMaterial: false, nurFachbetrieb: false,
    quellen: [
      { name: "Blauarbeit, Einbauküche Kosten", url: BA + "einbaukueche-kosten", stand: "03.09.2026", art: "portal", von: 150, bis: 250, mwst: "unklar", zitat: "Küchenmontage je laufendem Meter 150 bis 250 €" },
      { name: "Küchenliebhaber (zitiert Aroundhome)", url: "https://www.kuechenliebhaber.de/ratgeber/kuchenpreise", stand: "Mai 2026", art: "portal", von: 150, bis: 300, mwst: "unklar", zitat: "Montage nach Meter / Stunde 150–300 € pro lfd. Meter" },
    ],
  },

  // ===== Maler (Handwerker, Preis inkl. Material) =====
  // Trustlocal nennt dieselben Spannen wortgleich (Spachteln 12–25, Raufaser 10–18) wie Aroundhome,
  // dort aber „ohne Material“ — erkennbar abgeschrieben, zählt nicht als zweite Quelle.
  maler_streichen: {
    id: "maler_streichen", gewerk: "maler", label: "Wände und Decken streichen (Malerbetrieb)",
    einheit: "je m²", mengenbasis: "wandflaeche", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...AH_MALER, von: 8, bis: 15, mwst: "unklar", zitat: "Wände und Decken streichen ca. 8 – 15 € … *Kosten sind Richtwerte zur Orientierung inklusive Material und Arbeitsleistung." },
      { ...SH_RENO, stand: "BKI 4. Quartal 2024", von: 13, bis: 13, mwst: "netto", zitat: "Malern, Dispersionsfarbe auf Putz ca. 13 € / m 2" },
    ],
  },
  maler_raufaser_streichen: {
    id: "maler_raufaser_streichen", gewerk: "maler", label: "Raufaser tapezieren und streichen (Malerbetrieb)",
    einheit: "je m²", mengenbasis: "wandflaeche", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...AH_MALER, von: 15, bis: 20, mwst: "unklar", zitat: "Raufaser tapezieren und streichen ca. 15 – 20 €" },
      { ...SH_RENO, stand: "BKI 4. Quartal 2024", von: 26, bis: 26, mwst: "netto", zitat: "Tapezieren (Raufaser), Beschichtung ca. 26 € / m 2" },
    ],
  },
  maler_spachteln: {
    id: "maler_spachteln", gewerk: "maler", label: "Wände spachteln Q2–Q3 (Malerbetrieb)",
    einheit: "je m²", mengenbasis: "wandflaeche", inklMaterial: true, nurFachbetrieb: false,
    einzelquelle: "Trustlocal nennt dieselbe Spanne wortgleich — abgeschrieben, keine Bestätigung.",
    quellen: [
      { ...AH_MALER, von: 12, bis: 25, mwst: "unklar", zitat: "Wände verspachteln, Qualitätsstufe Q2 bis Q3 ca. 12 – 25 €" },
      { name: "Trustlocal, Maler Kosten", url: "https://trustlocal.de/kosten/maler-kosten/", stand: "01.07.2026", art: "portal", von: 12, bis: 25, mwst: "unklar", zitat: "Spachteln Qualitätsstufe Q2 bis Q3 12 € bis 25 €", abhaengigVon: AH_MALER.name },
    ],
  },
  tapete_entfernen: {
    id: "tapete_entfernen", gewerk: "maler", label: "Alte Tapete entfernen (Malerbetrieb)",
    einheit: "je m²", mengenbasis: "wandflaeche", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...AH_MALER, von: 5, bis: 20, mwst: "unklar", zitat: "Alte Tapeten entfernen ca. 5 –20 €" },
      { ...SH_RENO, stand: "BKI 4. Quartal 2024", von: 5, bis: 5, mwst: "netto", zitat: "Tapete entfernen ca. 5 € / m 2" },
    ],
  },

  // ===== Boden =====
  klickboden_verlegen: {
    id: "klickboden_verlegen", gewerk: "boden", label: "Laminat oder Klick-Vinyl verlegen (nur Arbeit)",
    einheit: "je m²", mengenbasis: "bodenflaeche", inklMaterial: false, nurFachbetrieb: false,
    hinweis: "Nur Arbeitslohn — das Material kommt aus dem Baumarkt-Katalog dazu.",
    quellen: [
      { ...TL_BODEN, von: 20, bis: 40, mwst: "unklar", zitat: "Materialkosten Laminat 5 € bis 75 € Verlegung 20 € bis 40 €" },
      { name: "Blauarbeit, Vinylboden verlegen Kosten", url: BA + "vinylboden-verlegen-kosten", stand: "06.07.2026", art: "portal", von: 8, bis: 20, mwst: "unklar", zitat: "Das Verlegen von Klick-Vinyl kostet 8 bis 20 € pro m² Arbeitslohn" },
    ],
  },
  parkett_schleifen: {
    id: "parkett_schleifen", gewerk: "boden", label: "Parkett schleifen und versiegeln/ölen",
    einheit: "je m²", mengenbasis: "bodenflaeche", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { name: "Blauarbeit, Parkett abschleifen Kosten", url: BA + "parkett-abschleifen-kosten", stand: "27.05.2026", art: "portal", von: 25, bis: 45, mwst: "unklar", zitat: "Komplettpaket Schleifen und Versiegeln 25 bis 45 Euro" },
      { ...SH_RENO, stand: "BKI 4. Quartal 2025", von: 70, bis: 70, mwst: "netto", zitat: "altes Parkett schleifen, ölen, wachsen ca. 70 € / m 2" },
    ],
  },
  bodenbelag_entfernen: {
    id: "bodenbelag_entfernen", gewerk: "boden", label: "Alten Bodenbelag entfernen und entsorgen",
    einheit: "je m²", mengenbasis: "bodenflaeche", inklMaterial: true, nurFachbetrieb: false,
    einzelquelle: "Nur Trustlocal schlüsselt Entfernen und Entsorgen getrennt auf; der BKI-Wert (85 €/m²) gilt für Fliesen samt Estrich und passt nicht.",
    hinweis: "Entfernen 4–8 € plus Entsorgung 2–15 € je m² (zusammengezählt). Gebäude vor 1993: Bodenplatten und Kleber können Asbest enthalten — nicht selbst entfernen, nicht überdecken (§ 11 GefStoffV).",
    quellen: [
      { ...TL_BODEN, von: 6, bis: 23, mwst: "unklar", umgerechnet: "Entfernen 4–8 € + Entsorgung 2–15 €", zitat: "4 bis 8 € für verklebtes Laminat oder Vinyl … Hinzu kommen Entsorgungskosten von 2 bis 15 € pro Quadratmeter" },
    ],
  },

  // ===== Fliesen =====
  fliesen_verlegen: {
    id: "fliesen_verlegen", gewerk: "fliesen", label: "Fliesen verlegen (Arbeit, Standardformat)",
    einheit: "je m²", mengenbasis: "bodenflaeche", inklMaterial: false, nurFachbetrieb: false,
    hinweis: "Großformat oder Mosaik teurer (Blauarbeit: 60–120 €/m²). Die Fliese selbst kommt aus dem Baumarkt-Katalog dazu.",
    quellen: [
      { name: "Blauarbeit, Fliesenlegen Kosten", url: BA + "fliesenlegen", stand: "Juli 2026", art: "portal", von: 40, bis: 80, mwst: "unklar", zitat: "Fliesen verlegen zu lassen kostet 40 bis 80 € pro m² Arbeitslohn für Standardformate" },
      { ...DAIBAU, von: 30, bis: 120, mwst: "unklar", zitat: "Verlegen keramischer Fliesen in Standardformaten auf einem vorbereiteten Untergrund im Innenbereich betragen in Deutschland zwischen 30 und 120 Euro pro m2 inklusive Fliesenkleber und Verfugung" },
    ],
  },
  altfliesen_entfernen: {
    id: "altfliesen_entfernen", gewerk: "fliesen", label: "Alte Fliesen entfernen",
    einheit: "je m²", mengenbasis: "bodenflaeche", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...DAIBAU, von: 25, bis: 42, mwst: "unklar", zitat: "Entfernen der alten Fliesen Kosten für das Entfernen der alten Wand- und Bodenfliesen und den Abtransport zur Deponie … 25 - 42 €/m2" },
      { ...SH_BAD, von: 65, bis: 65, mwst: "netto", zitat: "Abbruch alter Fliesen, Untergrund vorbereiten ca. 65 € / m 2" },
    ],
  },

  // ===== Entsorgung (regional sehr verschieden; „ab“-Preise als untere Grenze) =====
  container_bauschutt: {
    id: "container_bauschutt", gewerk: "entsorgung", label: "Container 7 m³, Bauschutt",
    einheit: "je Container", mengenbasis: "pauschal", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...CL, von: 360, bis: 360, mwst: "unklar", zitat: "Bauschutt ohne Fremdanteile ab 295,00 € ab 360,00 € ab 490,01 € (5 / 7 / 10 m³)" },
      { ...CDP, von: 450, bis: 750, mwst: "unklar", zitat: "Preisbereich (7 m³) … Bauschutt ca. 450–750 €" },
    ],
  },
  container_mischabfall: {
    id: "container_mischabfall", gewerk: "entsorgung", label: "Container 7 m³, Baumischabfall",
    einheit: "je Container", mengenbasis: "pauschal", inklMaterial: true, nurFachbetrieb: false,
    quellen: [
      { ...CL, von: 720, bis: 720, mwst: "unklar", zitat: "Baumischabfall (bis 15% Schutt / Erde) ab 560,00 € ab 720,00 € ab 980,00 € (5 / 7 / 10 m³)" },
      { ...CDP, von: 500, bis: 900, mwst: "unklar", zitat: "Baumischabfall / Mischcontainer ca. 500–900 €" },
    ],
  },
};

export const ARBEITEN_LISTE: Arbeit[] = Object.values(ARBEITEN);
