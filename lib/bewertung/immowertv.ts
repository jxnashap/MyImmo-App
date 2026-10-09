// Marktwert-Schätzung nach den Modellen der ImmoWertV 2021.
// WICHTIG: Ergebnis ist eine Orientierungs-Schätzung, KEIN Verkehrswertgutachten
// i. S. d. § 194 BauGB. Reine Rechenfunktionen ohne DB-Zugriff.
//
// Leitverfahren nach Objekt: vermietet/MFH → Ertragswert (§§27–34),
// eigengenutztes EFH → Sachwert (§§35–39). Ergebnisse werden bewusst als
// SPANNE ausgegeben (Marktanpassung LZ/Sachwertfaktor variiert), um keine
// Scheingenauigkeit zu suggerieren.

import { heuteBerlin } from "@/lib/zeitraum";

// ---- Anlage 3: Bewirtschaftungskosten je Wertermittlungsjahr ----------------
// Anlage 3 ImmoWertV nennt Verwaltung und Instandhaltung „für das Jahr 2021“; für spätere Stichtage sind
// sie nach Nr. III jährlich fortzuschreiben (VPI Oktober des Vorjahres gegenüber Oktober 2001, auf die
// Basiswerte 230 €/275 €/30 € und 9,00 €/m²/68 €; €-Werte auf volle Euro, €/m² auf eine Nachkommastelle).
// Bis 09.10.2026 rechnete die App immer mit 2021 — der Ertragswert lag dadurch rund 5 % zu hoch
// (Gesamtprüfung 07.10.2026, B33: Halle 87.621 € statt 83.442 €).
//
// Werte NICHT selbst aus dem VPI gerechnet, sondern wie veröffentlicht übernommen:
//   2021 — Wortlaut Anlage 3 (gesetze-im-internet.de/immowertv_2022/anlage_3.html, abgerufen 09.10.2026)
//   2022–2026 — Oberer Gutachterausschuss Brandenburg, „Bewirtschaftungskosten entsprechend Anlage 3
//     ImmoWertV … für die Jahre 2022 bis 2026“ (gutachterausschuss.brandenburg.de/sixcms/media.php/9/
//     BewKo_2026.pdf, abgerufen 09.10.2026); 2026 gegengeprüft: immobilien-wertermittlung.de, „Neue
//     Bewirtschaftungskosten für 2026“ (15.11.2025: VPI Okt. 2001 = 77,1, Okt. 2025 = 123,0, Faktor 1,5953).
// Prüfzyklus: jeden November (VPI Oktober) die Zeile fürs nächste Jahr — docs/app-entwicklung/07.
export type Bewirtschaftungskosten = {
  verwaltungWohnung: number; // €/Jahr je Wohnung bzw. je Wohngebäude bei EFH/ZFH
  verwaltungEtw: number; // €/Jahr je Eigentumswohnung
  verwaltungGarage: number; // €/Jahr je Garage/Einstellplatz
  instandhaltungProM2: number; // €/m² Wohnfläche/Jahr (Schönheitsreparaturen beim Mieter)
  instandhaltungGarage: number; // €/Jahr je Garage/Einstellplatz
};

export const BEWIRTSCHAFTUNG_JE_JAHR: Record<number, Bewirtschaftungskosten> = {
  2021: { verwaltungWohnung: 298, verwaltungEtw: 357, verwaltungGarage: 39, instandhaltungProM2: 11.7, instandhaltungGarage: 88 },
  2022: { verwaltungWohnung: 312, verwaltungEtw: 373, verwaltungGarage: 41, instandhaltungProM2: 12.2, instandhaltungGarage: 92 },
  2023: { verwaltungWohnung: 339, verwaltungEtw: 405, verwaltungGarage: 44, instandhaltungProM2: 13.2, instandhaltungGarage: 100 },
  2024: { verwaltungWohnung: 351, verwaltungEtw: 421, verwaltungGarage: 46, instandhaltungProM2: 13.8, instandhaltungGarage: 104 },
  2025: { verwaltungWohnung: 359, verwaltungEtw: 429, verwaltungGarage: 47, instandhaltungProM2: 14.0, instandhaltungGarage: 106 },
  2026: { verwaltungWohnung: 367, verwaltungEtw: 439, verwaltungGarage: 48, instandhaltungProM2: 14.4, instandhaltungGarage: 108 },
};

/** Mietausfallwagnis Wohnen: 2 % des Rohertrags (Anlage 3 Nr. I.3, nicht fortgeschrieben). */
export const MIETAUSFALLWAGNIS_WOHNEN = 0.02;

const BEWIRTSCHAFTUNG_JAHRE = Object.keys(BEWIRTSCHAFTUNG_JE_JAHR).map(Number).sort((a, b) => a - b);

/**
 * Bewirtschaftungskosten für einen Wertermittlungsstichtag im Jahr `jahr`. Vor 2021 gilt 2021 (älter rechnet
 * die App nicht). Liegt das Jahr hinter der Tabelle, gilt die letzte Zeile — `veraltet` sagt es dann, und
 * der Ertragswert nennt es in seinen Warnungen (lieber sichtbar zu niedrig als still erfunden).
 */
export function bewirtschaftungFuer(jahr: number): { werte: Bewirtschaftungskosten; jahr: number; veraltet: boolean } {
  const erstes = BEWIRTSCHAFTUNG_JAHRE[0];
  const letztes = BEWIRTSCHAFTUNG_JAHRE[BEWIRTSCHAFTUNG_JAHRE.length - 1];
  const j = Number.isInteger(jahr) ? Math.max(erstes, Math.min(letztes, jahr)) : letztes;
  return { werte: BEWIRTSCHAFTUNG_JE_JAHR[j], jahr: j, veraltet: Number.isInteger(jahr) && jahr > letztes };
}

/** Wertermittlungsjahr, wenn der Aufrufer keines nennt: das laufende Jahr in Berlin. */
export function laufendesJahr(): number {
  return Number(heuteBerlin().slice(0, 4));
}

// ---- Anlage 1: Gesamtnutzungsdauer ------------------------------------------
export const GND_WOHNGEBAEUDE = 80; // Jahre (EFH/ZFH/RH/MFH/Mischnutzung)

// ---- Anlage 4: Normalherstellungskosten 2010 (€/m² BGF, inkl. USt) -----------
// Standardstufen 1..5 = sehr einfach..hochwertig. Für Typen, bei denen die
// Anlage nur Std. 3–5 nennt, sind 1/2 konservativ abgeleitet (×0,80 / ×0,90).
export const NHK2010: Record<string, number[]> = {
  efh: [655, 725, 835, 1005, 1260], // freistehendes EFH, unterkellert
  mfh_klein: [660, 743, 825, 985, 1190], // MFH bis 6 WE (Std. 3–5 belegt)
  mfh_mittel: [612, 689, 765, 915, 1105], // MFH 7–20 WE
  mfh_gross: [604, 680, 755, 900, 1090], // MFH > 20 WE
  mischnutzung: [688, 774, 860, 1085, 1375], // Wohnhaus mit Gewerbeanteil
};

export const NHK_TYPEN: { key: string; label: string }[] = [
  { key: "efh", label: "Einfamilienhaus (freistehend)" },
  { key: "mfh_klein", label: "Mehrfamilienhaus (bis 6 Whg.)" },
  { key: "mfh_mittel", label: "Mehrfamilienhaus (7–20 Whg.)" },
  { key: "mfh_gross", label: "Mehrfamilienhaus (über 20 Whg.)" },
  { key: "mischnutzung", label: "Wohn-/Geschäftshaus" },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
const r0 = (n: number) => Math.round(n);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Barwertfaktor (Kapitalisierung, § 34 Abs. 2, jährlich nachschüssig). */
export function barwertfaktor(liegenschaftszinsProzent: number, restnutzungsdauer: number): number {
  const p = liegenschaftszinsProzent / 100;
  if (p <= 0) return restnutzungsdauer; // Grenzfall: Summe der Jahre
  return (1 - Math.pow(1 + p, -restnutzungsdauer)) / p;
}

/** Restnutzungsdauer = GND − Alter, mit Modernisierungs-Anhebung (Anlage 2).
 *  modernisierungsgrad 0..1 hebt die RND bis max. 70 % der GND (kernsaniert 90 %). */
export function restnutzungsdauer(
  baujahr: number,
  jahr: number,
  gnd = GND_WOHNGEBAEUDE,
  modernisierungsgrad = 0,
  kernsaniert = false,
): number {
  const alter = Math.max(0, jahr - baujahr);
  const basis = gnd - alter;
  const maxAnteil = kernsaniert ? 0.9 : 0.7;
  const modernisiert = gnd * clamp(modernisierungsgrad, 0, 1) * maxAnteil;
  // mindestens die fiktive Modernisierungs-RND, höchstens der Deckel
  const rnd = Math.max(basis, modernisiert);
  return r0(clamp(rnd, 1, gnd));
}

// ---------------------------------------------------------------- Ertragswert --
export type ErtragswertInput = {
  jahresnettokaltmiete: number; // Rohertrag €/Jahr (marktüblich)
  wohnflaeche: number; // m²
  anzahlWohnungen: number;
  istEtw: boolean;
  bodenrichtwert: number; // €/m²
  grundstuecksflaeche: number; // m²
  liegenschaftszins: number; // % (Default aus Bandbreite)
  restnutzungsdauer: number; // Jahre
  garagen?: number;
  /** Jahr des Wertermittlungsstichtags — bestimmt die Bewirtschaftungskosten (Standard: laufendes Jahr). */
  stichtagJahr?: number;
};

export type Bewertungsergebnis = {
  wert: number; // Punktschätzung
  min: number; // untere Spanne
  max: number; // obere Spanne
  details: Record<string, number>;
  warnungen: string[];
};

export function ertragswert(i: ErtragswertInput): Bewertungsergebnis {
  const roh = Math.max(0, i.jahresnettokaltmiete);
  const bk = bewirtschaftungFuer(i.stichtagJahr ?? laufendesJahr());
  const garagen = Math.max(0, i.garagen ?? 0);
  const verwaltungProWE = i.istEtw ? bk.werte.verwaltungEtw : bk.werte.verwaltungWohnung;
  const verwaltung = verwaltungProWE * Math.max(1, i.anzahlWohnungen) + bk.werte.verwaltungGarage * garagen;
  const instandhaltung = bk.werte.instandhaltungProM2 * Math.max(0, i.wohnflaeche) + bk.werte.instandhaltungGarage * garagen;
  const mietausfall = roh * MIETAUSFALLWAGNIS_WOHNEN;
  const bewk = verwaltung + instandhaltung + mietausfall;
  const reinertrag = roh - bewk;
  const bodenwert = Math.max(0, i.bodenrichtwert) * Math.max(0, i.grundstuecksflaeche);

  const rechne = (lz: number) => {
    const bwf = barwertfaktor(lz, i.restnutzungsdauer);
    const bodenwertverzinsung = bodenwert * (lz / 100);
    const gebaeudeertragswert = Math.max(0, reinertrag - bodenwertverzinsung) * bwf;
    return gebaeudeertragswert + bodenwert;
  };

  const wert = rechne(i.liegenschaftszins);
  // Spanne: Liegenschaftszins ±0,5 Prozentpunkte (höherer Zins → niedrigerer Wert)
  const max = rechne(Math.max(0.1, i.liegenschaftszins - 0.5));
  const min = rechne(i.liegenschaftszins + 0.5);

  const warnungen: string[] = [];
  if (bk.veraltet) {
    warnungen.push(`Bewirtschaftungskosten für ${i.stichtagJahr ?? laufendesJahr()} sind noch nicht eingetragen — gerechnet mit dem Stand ${bk.jahr}; der Wert fällt dadurch etwas zu hoch aus.`);
  }
  const bewkAnteil = roh > 0 ? bewk / roh : 0;
  if (i.liegenschaftszins < 2 || i.liegenschaftszins > 5.5) warnungen.push("Liegenschaftszins außerhalb der üblichen Spanne (2,0–5,5 %). Wert aus dem Grundstücksmarktbericht prüfen.");
  if (roh > 0 && (bewkAnteil < 0.15 || bewkAnteil > 0.32)) warnungen.push(`Bewirtschaftungskosten liegen bei ${(bewkAnteil * 100).toFixed(0)} % des Rohertrags (üblich 18–29 %).`);
  if (reinertrag <= 0) warnungen.push("Reinertrag ist ≤ 0 — Miete zu niedrig oder Kosten zu hoch; Ertragswert wenig aussagekräftig.");
  // Ohne Bodenwert rechnet § 28 ImmoWertV faktisch nur den Gebaeudeertrag: der
  // Grund und Boden faellt komplett weg. Bei einem Haus sind das schnell 30–50 %
  // des Werts — und das Ergebnis sah bisher genauso serioes aus wie ein
  // vollstaendiges.
  if (bodenwert <= 0) warnungen.push("Kein Bodenwert hinterlegt (Bodenrichtwert × Grundstücksfläche) — der Grund und Boden fehlt im Ergebnis. Der ausgewiesene Wert ist dadurch systematisch ZU NIEDRIG, bei Häusern oft erheblich.");

  return {
    wert: r0(wert),
    min: r0(min),
    max: r0(max),
    details: { rohertrag: r0(roh), bewirtschaftungskosten: r0(bewk), reinertrag: r0(reinertrag), bodenwert: r0(bodenwert), barwertfaktor: r2(barwertfaktor(i.liegenschaftszins, i.restnutzungsdauer)) },
    warnungen,
  };
}

// ------------------------------------------------------------------- Sachwert --
export type SachwertInput = {
  typ: string; // key aus NHK2010
  standardstufe: number; // 1..5
  wohnflaeche: number; // m²
  bgfFaktor?: number; // Bruttogrundfläche / Wohnfläche (EFH ~1,55)
  baupreisindex: number; // Faktor 2010 → heute (~1,9 in 2025/26)
  regionalfaktor: number; // aus Grundstücksmarktbericht, sonst 1,0
  restnutzungsdauer: number;
  gnd?: number;
  bodenrichtwert: number;
  grundstuecksflaeche: number;
  sachwertfaktor: number; // Marktanpassung (aus Grundstücksmarktbericht)
  aussenanlagen?: number; // € pauschal, optional
};

export function sachwert(i: SachwertInput): Bewertungsergebnis {
  const reihe = NHK2010[i.typ] ?? NHK2010.efh;
  const nhk = reihe[clamp(Math.round(i.standardstufe), 1, 5) - 1];
  const bgf = Math.max(0, i.wohnflaeche) * (i.bgfFaktor ?? 1.55);
  const hkHeute = nhk * i.baupreisindex * i.regionalfaktor;
  const gnd = i.gnd ?? GND_WOHNGEBAEUDE;
  const gebaeudesachwert = hkHeute * bgf * clamp(i.restnutzungsdauer / gnd, 0, 1);
  const bodenwert = Math.max(0, i.bodenrichtwert) * Math.max(0, i.grundstuecksflaeche);
  const vorlaeufig = gebaeudesachwert + (i.aussenanlagen ?? 0) + bodenwert;

  const wert = vorlaeufig * i.sachwertfaktor;
  // Spanne: Sachwertfaktor ±0,15
  const min = vorlaeufig * Math.max(0.1, i.sachwertfaktor - 0.15);
  const max = vorlaeufig * (i.sachwertfaktor + 0.15);

  const warnungen: string[] = [];
  if (i.sachwertfaktor < 0.5 || i.sachwertfaktor > 2.0) warnungen.push("Sachwertfaktor außerhalb 0,5–2,0 — den örtlichen Wert aus dem Grundstücksmarktbericht verwenden.");
  if (i.baupreisindex < 1.5 || i.baupreisindex > 2.2) warnungen.push("Baupreisindex-Faktor unplausibel (2025/26 ~1,7–2,1).");
  if (bodenwert <= 0) warnungen.push("Kein Bodenwert hinterlegt (Bodenrichtwert × Grundstücksfläche) — im Sachwert fehlt damit der komplette Grundstücksanteil. Der ausgewiesene Wert ist zu niedrig.");

  return {
    wert: r0(wert),
    min: r0(min),
    max: r0(max),
    details: { normalherstellungskosten2010: nhk, herstellungskostenHeute: r0(hkHeute), bruttogrundflaeche: r0(bgf), gebaeudesachwert: r0(gebaeudesachwert), bodenwert: r0(bodenwert), vorlaeufigerSachwert: r0(vorlaeufig) },
    warnungen,
  };
}

/** Vervielfältiger-Check: Kaufpreis / Jahresnettokaltmiete (Plausibilität). */
export function vervielfaeltiger(kaufpreis: number, jahresnettokaltmiete: number): { faktor: number; hinweis: string } {
  if (jahresnettokaltmiete <= 0) return { faktor: 0, hinweis: "Keine Miete angegeben." };
  const f = kaufpreis / jahresnettokaltmiete;
  let hinweis = "";
  if (f < 15) hinweis = "Sehr günstig (< 15) — Zustand/Lage/Leerstandsrisiko prüfen.";
  else if (f > 33) hinweis = "Hoch (> 33) — nur in Top-Lagen üblich; Rendite entsprechend niedrig.";
  else hinweis = "Im üblichen Bereich (15–33).";
  return { faktor: r2(f), hinweis };
}

/** Ampel: geschätzter Marktwert vs. Kaufpreis. */
export function kaufpreisAmpel(marktwert: number, kaufpreis: number): { farbe: "gruen" | "gelb" | "rot"; text: string } {
  if (kaufpreis <= 0 || marktwert <= 0) return { farbe: "gelb", text: "Kaufpreis oder Wert fehlt." };
  const diff = (kaufpreis - marktwert) / marktwert;
  if (diff <= -0.05) return { farbe: "gruen", text: `Kaufpreis liegt ${Math.abs(diff * 100).toFixed(0)} % unter der Schätzung.` };
  if (diff <= 0.1) return { farbe: "gelb", text: "Kaufpreis im Bereich der Schätzung." };
  return { farbe: "rot", text: `Kaufpreis liegt ${(diff * 100).toFixed(0)} % über der Schätzung.` };
}
