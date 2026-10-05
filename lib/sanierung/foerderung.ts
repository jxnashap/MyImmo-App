// Förderung im Sanierungsrechner (BuyImmo, 05.10.2026): geschätzter Zuschuss für energetische
// Posten. Reine Rechnung, ohne Datenbank und ohne React.
//
// Gefördert wird nur Energetisches — Dämmung, Fenster/Außentüren, Lüftung, Heizungsoptimierung,
// neue Heizung, dazu die Begleitung durch den Energieeffizienz-Experten. Spachteln, Streichen,
// Böden und Fliesen (die Maßnahmen der Raumliste) bekommen NIE einen Zuschuss; deshalb hängt die
// Förderung nur an den eigenen Posten, deren Art der Nutzer wählt.
//
// ALTERT: Konditionen nach der BEG-Reform zum 21.07.2026 (Richtlinie BEG EM „vom 17. August 2026“,
// BAnz AT 27.08.2026 B1), geprüft 05.10.2026 gegen bafa.de (Gebäudehülle) und kfw.de (458,
// „Anpassungen 2026“). Feste Änderungstermine: 01.02.2027 (KfW 458: Höchstkosten der ersten
// Wohneinheit −750 € je Halbjahr) und Q1 2027 (Wärmepumpe 15 % + Wertschöpfungsbonus).
// Prüfzyklus: docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md.
//
// Bewusst NICHT gerechnet: die Boni der KfW 458 für Selbstnutzer (Klimageschwindigkeit,
// Einkommen) — sie hängen an Heizungsalter und Haushaltseinkommen, die der Rechner nicht kennt;
// der Effizienzhaus-Kredit KfW 261 (braucht ein Effizienzhaus-Ziel, kein Posten-Rechner);
// § 35c EStG (Steuer, nur Selbstnutzer, nie zusätzlich zum Zuschuss).

export type FoerderArt = "keine" | "huelle" | "anlage" | "optimierung" | "heizung" | "experte";
export type Nutzung = "vermieten" | "eigennutzen";

export const FOERDER_ARTEN: { id: FoerderArt; label: string }[] = [
  { id: "keine", label: "Keine Förderung" },
  { id: "huelle", label: "Dämmung, Fenster, Außentüren (BAFA)" },
  { id: "anlage", label: "Lüftung, Anlagentechnik (BAFA)" },
  { id: "optimierung", label: "Heizungsoptimierung (BAFA)" },
  { id: "heizung", label: "Neue Heizung (KfW 458)" },
  { id: "experte", label: "Energieberater-Begleitung (BAFA)" },
];
const ARTEN = new Set<string>(FOERDER_ARTEN.map((a) => a.id));
export const istFoerderArt = (v: unknown): v is FoerderArt => typeof v === "string" && ARTEN.has(v);

export const FOERDER_STAND_SANIERUNG = "BEG-Reform 21.07.2026, geprüft 05.10.2026";

/** BAFA BEG EM: „Der Grundfördersatz beträgt 15 % der förderfähigen Ausgaben.“ */
export const BAFA_SATZ = 0.15;
/** iSFP-Bonus: +5 Prozentpunkte — seit 21.07.2026 nur auf den Teil über der Grenze ohne iSFP. */
export const ISFP_BONUS = 0.05;
/** KfW 458: „Die Grundförderung beträgt weiterhin 30 %.“ (Vermieter bekommen nur diese.) */
export const HEIZUNG_SATZ = 0.3;
/** Fachplanung und Baubegleitung durch den Energieeffizienz-Experten: 50 %. */
export const EXPERTE_SATZ = 0.5;
/** „Das förderfähige Mindestinvestitionsvolumen liegt bei 300 Euro brutto“ — je Maßnahme. */
export const MINDESTINVESTITION = 300;
/** Heizungsoptimierung nur in Gebäuden mit höchstens fünf Wohneinheiten. */
export const OPTIMIERUNG_MAX_WE = 5;

/** Höchstgrenze nach Wohneinheiten: erste / je zweite bis sechste / je ab der siebten. */
export function staffel(wohneinheiten: number, erste: number, zweiBisSechs: number, abSieben: number): number {
  const n = Number.isFinite(wohneinheiten) ? Math.max(1, Math.floor(wohneinheiten)) : 1;
  return erste + Math.min(n - 1, 5) * zweiBisSechs + Math.max(n - 6, 0) * abSieben;
}

/** BAFA: 30.000 / 15.000 / 8.000 € je Gebäude und Kalenderjahr, mit iSFP 60.000 / 30.000 / 15.000 €. */
export const grenzeBafa = (we: number, isfp: boolean) => (isfp ? staffel(we, 60_000, 30_000, 15_000) : staffel(we, 30_000, 15_000, 8_000));
/**
 * KfW 458, erste Wohneinheit — sinkt laut Richtlinie BEG EM Nr. 8.3.1 a „beginnend ab 1. Februar 2027
 * alle sechs Monate jeweils zum 1. Februar und 1. August eines Jahres um 750 Euro“, ab 01.08.2030
 * 22.000 €. Gerechnet auf den Zahlen des ISO-Datums (keine Ortszeit).
 */
export function heizungErsteWohneinheit(stichtag: string): number {
  const m = /^(\d{4})-(\d{2})/.exec(stichtag);
  if (!m) return 28_000;
  const monate = Number(m[1]) * 12 + (Number(m[2]) - 1) - (2027 * 12 + 1); // seit Februar 2027
  if (monate < 0) return 28_000;
  const stufen = Math.min(1 + Math.floor(monate / 6), 8);
  return 28_000 - 750 * stufen;
}
/** KfW 458: erste WE (siehe oben) / je 15.000 € zweite bis sechste / je 8.000 € ab der siebten — je Gebäude insgesamt. */
export const grenzeHeizung = (we: number, stichtag: string) => staffel(we, heizungErsteWohneinheit(stichtag), 15_000, 8_000);
/** Experte: 5.000 € beim Ein-/Zweifamilienhaus, sonst 2.000 € je Wohneinheit, höchstens 20.000 €. */
export function grenzeExperte(we: number): number {
  const n = Number.isFinite(we) ? Math.max(1, Math.floor(we)) : 1;
  return n <= 2 ? 5_000 : Math.min(2_000 * n, 20_000);
}

export type FoerderPosten = { id: string; bezeichnung: string; betrag: number; art: FoerderArt };
export type FoerderEingabe = {
  posten: FoerderPosten[];
  /** Wohneinheiten, die die Maßnahmen betreffen (bei einer Eigentumswohnung meist 1). */
  wohneinheiten: number;
  isfp: boolean;
  nutzung: Nutzung;
  /** Heute als ISO-Datum (vom Server) — die Heizungsgrenze sinkt ab 2027 halbjährlich. */
  stichtag: string;
};

export type Topf = {
  programm: "BAFA" | "KfW 458" | "BAFA Experte";
  /** Summe der Posten, die mitzählen (je Posten mindestens 300 €). */
  kosten: number;
  /** Davon förderfähig (gedeckelt auf die Höchstgrenze). */
  foerderfaehig: number;
  grenze: number;
  zuschuss: number;
};

export type FoerderErgebnis = {
  toepfe: Topf[];
  zuschuss: number;
  /** Posten mit Förderart, die nicht mitzählen — mit Grund. */
  ausgeschlossen: { id: string; bezeichnung: string; grund: string }[];
  hinweise: string[];
};

const rund2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

const BAFA_ARTEN: FoerderArt[] = ["huelle", "anlage", "optimierung"];

export function berechneFoerderung(e: FoerderEingabe): FoerderErgebnis {
  const we = Number.isFinite(e.wohneinheiten) && e.wohneinheiten >= 1 ? Math.floor(e.wohneinheiten) : 1;
  const ausgeschlossen: FoerderErgebnis["ausgeschlossen"] = [];
  const zaehlt = (p: FoerderPosten): boolean => {
    if (p.art === "keine") return false;
    if (pos(p.betrag) === 0) return false;
    if (p.art !== "experte" && pos(p.betrag) < MINDESTINVESTITION) {
      ausgeschlossen.push({ id: p.id, bezeichnung: p.bezeichnung, grund: `unter ${MINDESTINVESTITION} € — zu klein für einen Antrag` });
      return false;
    }
    if (p.art === "optimierung" && we > OPTIMIERUNG_MAX_WE) {
      ausgeschlossen.push({ id: p.id, bezeichnung: p.bezeichnung, grund: `Heizungsoptimierung nur bis ${OPTIMIERUNG_MAX_WE} Wohneinheiten` });
      return false;
    }
    return true;
  };
  const gezaehlt = e.posten.filter(zaehlt);
  const summe = (arten: FoerderArt[]) => gezaehlt.filter((p) => arten.includes(p.art)).reduce((s, p) => s + pos(p.betrag), 0);

  const toepfe: Topf[] = [];

  // BAFA: Hülle, Anlagentechnik und Heizungsoptimierung teilen sich EINE Höchstgrenze je Gebäude
  // und Kalenderjahr. Mit iSFP steigt die Grenze, die 5 Prozentpunkte gibt es nur auf den Teil
  // darüber („Betragen die Investitionskosten beispielsweise 40.000 Euro brutto, dann wird der
  // iSFP-Bonus von 5% nur für 10.000 Euro gewährt“ — BAFA-Merkblatt).
  const bafaKosten = summe(BAFA_ARTEN);
  if (bafaKosten > 0) {
    const ohne = grenzeBafa(we, false);
    const grenze = grenzeBafa(we, e.isfp);
    const foerderfaehig = Math.min(bafaKosten, grenze);
    const zuschuss = BAFA_SATZ * Math.min(foerderfaehig, ohne) + (e.isfp ? (BAFA_SATZ + ISFP_BONUS) * Math.max(0, foerderfaehig - ohne) : 0);
    toepfe.push({ programm: "BAFA", kosten: rund2(bafaKosten), foerderfaehig: rund2(foerderfaehig), grenze, zuschuss: rund2(zuschuss) });
  }

  // KfW 458: eigene Grenze je Gebäude insgesamt; hier nur die Grundförderung.
  const heizKosten = summe(["heizung"]);
  if (heizKosten > 0) {
    const grenze = grenzeHeizung(we, e.stichtag);
    const foerderfaehig = Math.min(heizKosten, grenze);
    toepfe.push({ programm: "KfW 458", kosten: rund2(heizKosten), foerderfaehig: rund2(foerderfaehig), grenze, zuschuss: rund2(HEIZUNG_SATZ * foerderfaehig) });
  }

  const expKosten = summe(["experte"]);
  if (expKosten > 0) {
    const grenze = grenzeExperte(we);
    const foerderfaehig = Math.min(expKosten, grenze);
    toepfe.push({ programm: "BAFA Experte", kosten: rund2(expKosten), foerderfaehig: rund2(foerderfaehig), grenze, zuschuss: rund2(EXPERTE_SATZ * foerderfaehig) });
  }

  const hinweise: string[] = [];
  for (const t of toepfe) {
    if (t.kosten > t.grenze) {
      hinweise.push(`${t.programm}: Über der Höchstgrenze von ${t.grenze.toLocaleString("de-DE")} € — der Rest wird nicht gefördert.`);
    }
  }
  const brauchtExperten = gezaehlt.some((p) => p.art === "huelle" || p.art === "anlage");
  if (brauchtExperten && expKosten === 0) {
    hinweise.push("Für Dämmung, Fenster und Lüftung ist ein Energieeffizienz-Experte Pflicht — ohne ihn kein Zuschuss. Seine Kosten als „Energieberater-Begleitung“ eintragen, die Hälfte wird gefördert.");
  }
  if (heizKosten > 0 && e.nutzung === "eigennutzen") {
    hinweise.push("Selbstnutzer: Zur Grundförderung der Heizung können Boni kommen (Austausch einer alten Heizung, Einkommen) — zusammen bis 70 %, bei niedrigem Einkommen 80 %. Hier nicht gerechnet.");
  }
  if (e.nutzung === "vermieten" && toepfe.length > 0) {
    hinweise.push("Vermieter: Der Zuschuss mindert die absetzbaren Kosten bzw. die Abschreibung (R 21.5 EStR) — netto bringt er weniger, als die Zahl zeigt.");
  }

  return { toepfe, zuschuss: rund2(toepfe.reduce((s, t) => s + t.zuschuss, 0)), ausgeschlossen, hinweise };
}
