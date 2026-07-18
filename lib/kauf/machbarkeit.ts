// Machbarkeitsprüfung (Ampel) für den Finanzierungs-Assistenten.
// Bildet nach, was eine Bank grob prüft: tragbare Rate (Belastungsquote +
// Haushaltsüberschuss), Beleihungsauslauf und Eigenkapital-Deckung.
//
// WICHTIG: marktübliche Faustwerte, KEINE Zusage und keine Finanzberatung —
// jede Bank rechnet intern anders. Nur eine erste Selbsteinschätzung.

export type Ampel = "gruen" | "gelb" | "rot" | "grau";

export type MachbarkeitInput = {
  // aus dem gewählten Objekt (Kauf-Auswahl / Cockpit)
  darlehen: number;        // Darlehensbedarf
  rate: number;            // geplante Monatsrate gesamt
  kaufpreis: number;
  gesamtInvest: number;    // Kaufpreis + Nebenkosten + Extras
  kaltmieteNeu: number;    // Nettokaltmiete des neuen Objekts (bei Vermietung)
  // aus der Selbstauskunft
  haushaltsNetto: number;      // Netto ohne Mieteinnahmen
  mieteinnahmenBestehend: number;
  ausgabenFix: number;         // laufende Kredite + Versicherungen + Unterhalt + sonstige
  anzahlPersonen: number;
  eigenkapital: number;        // Summe Vermögen
};

export type MachbarkeitCheck = {
  key: string;
  label: string;
  ampel: Ampel;
  wert: string;
  hinweis: string;
};

export type MachbarkeitErgebnis = {
  checks: MachbarkeitCheck[];
  gesamt: Ampel;
  frei: number;              // frei verfügbar für die Rate (Haushaltsüberschuss)
  belastungsquote: number;   // Rate / anrechenbare Einnahmen (0..1)
  hatDaten: boolean;
};

const MIETABSCHLAG = 0.75;   // Banken rechnen Mieteinnahmen mit Abschlag an
const QUOTE_GRUEN = 0.35;    // ≤35 % gilt als komfortabel
const QUOTE_GELB = 0.40;     // ≤40 % Obergrenze
const PAUSCHALE_1 = 700;     // Lebenshaltung 1. Person
const PAUSCHALE_WEITERE = 225;

// Lebenshaltungspauschale nach Haushaltsgröße (Faustwert).
export function lebenshaltung(anzahlPersonen: number): number {
  const n = Math.max(1, Math.floor(anzahlPersonen || 1));
  return PAUSCHALE_1 + (n - 1) * PAUSCHALE_WEITERE;
}

function schlechteste(ampeln: Ampel[]): Ampel {
  if (ampeln.includes("rot")) return "rot";
  if (ampeln.includes("gelb")) return "gelb";
  if (ampeln.includes("gruen")) return "gruen";
  return "grau";
}

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const pct = (n: number) => (n * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " %";

export function pruefeMachbarkeit(i: MachbarkeitInput): MachbarkeitErgebnis {
  const hatDaten = i.haushaltsNetto > 0;
  const anrechenbareEinnahmen = i.haushaltsNetto + MIETABSCHLAG * (Math.max(0, i.mieteinnahmenBestehend) + Math.max(0, i.kaltmieteNeu));
  const pauschale = lebenshaltung(i.anzahlPersonen);
  const frei = anrechenbareEinnahmen - Math.max(0, i.ausgabenFix) - pauschale;
  const belastungsquote = anrechenbareEinnahmen > 0 ? i.rate / anrechenbareEinnahmen : 0;

  const checks: MachbarkeitCheck[] = [];

  // 1) Belastungsquote (Rate vs. anrechenbares Einkommen)
  if (hatDaten && i.rate > 0) {
    const ampel: Ampel = belastungsquote <= QUOTE_GRUEN ? "gruen" : belastungsquote <= QUOTE_GELB ? "gelb" : "rot";
    checks.push({
      key: "quote",
      label: "Rate im Verhältnis zum Einkommen",
      ampel,
      wert: pct(belastungsquote),
      hinweis: "Banken sehen ~35 % (max. 40 %) des anrechenbaren Netto als tragbar. Mieteinnahmen zu 75 % angesetzt.",
    });
  }

  // 2) Haushaltsüberschuss (frei verfügbar vs. Rate)
  if (hatDaten && i.rate > 0) {
    const ampel: Ampel = i.rate <= frei ? "gruen" : i.rate <= frei * 1.1 ? "gelb" : "rot";
    checks.push({
      key: "frei",
      label: "Haushaltsüberschuss deckt die Rate",
      ampel,
      wert: `${eur(frei)}/Mo frei · Rate ${eur(i.rate)}/Mo`,
      hinweis: `Einnahmen − Ausgaben − Lebenshaltung (${eur(pauschale)} für ${Math.max(1, Math.floor(i.anzahlPersonen || 1))} Pers.).`,
    });
  }

  // 3) Beleihungsauslauf (Darlehen / Kaufpreis)
  if (i.kaufpreis > 0 && i.darlehen > 0) {
    const auslauf = i.darlehen / i.kaufpreis;
    const ampel: Ampel = auslauf <= 0.6 ? "gruen" : auslauf <= 0.85 ? "gelb" : "rot";
    checks.push({
      key: "ltv",
      label: "Beleihungsauslauf (Darlehen / Kaufpreis)",
      ampel,
      wert: pct(auslauf),
      hinweis: "Unter 60 % beste Zinsen, über 80 % wird es teurer. Der Beleihungswert der Bank liegt unter dem Kaufpreis → realer Auslauf oft höher.",
    });
  }

  // 4) Eigenkapital-Deckung
  if (i.gesamtInvest > 0) {
    const benoetigt = Math.max(0, i.gesamtInvest - i.darlehen);
    const nebenkosten = Math.max(0, i.gesamtInvest - i.kaufpreis);
    const ampel: Ampel = i.eigenkapital >= benoetigt ? "gruen" : i.eigenkapital >= nebenkosten ? "gelb" : "rot";
    checks.push({
      key: "ek",
      label: "Eigenkapital deckt die Finanzierungslücke",
      ampel,
      wert: `${eur(i.eigenkapital)} vorhanden · ${eur(benoetigt)} nötig`,
      hinweis: "Mindestens die Kaufnebenkosten sollten aus Eigenkapital kommen; besser zusätzlich 10–20 % des Kaufpreises.",
    });
  }

  return {
    checks,
    gesamt: hatDaten ? schlechteste(checks.map((c) => c.ampel)) : "grau",
    frei,
    belastungsquote,
    hatDaten,
  };
}
