// CO₂-Kostenaufteilung zwischen Vermieter und Mieter nach dem
// Kohlendioxidkostenaufteilungsgesetz (CO2KostAufG) — reine Funktionen,
// keine DB-Zugriffe. Grundlage ist der spezifische CO₂-Ausstoß des
// Gebäudes in kg CO₂ je m² Wohnfläche und Jahr (Stufenmodell der Anlage
// zum CO2KostAufG). Keine Steuer-/Rechtsberatung.

export type Co2Stufe = { min: number; max: number | null; mieter: number; vermieter: number };

// Stufenmodell Wohngebäude (Anlage CO2KostAufG). vermieter + mieter = 100.
export const CO2_STUFEN: Co2Stufe[] = [
  { min: 0, max: 12, mieter: 100, vermieter: 0 },
  { min: 12, max: 17, mieter: 90, vermieter: 10 },
  { min: 17, max: 22, mieter: 80, vermieter: 20 },
  { min: 22, max: 27, mieter: 70, vermieter: 30 },
  { min: 27, max: 32, mieter: 60, vermieter: 40 },
  { min: 32, max: 37, mieter: 50, vermieter: 50 },
  { min: 37, max: 42, mieter: 40, vermieter: 60 },
  { min: 42, max: 47, mieter: 30, vermieter: 70 },
  { min: 47, max: 52, mieter: 20, vermieter: 80 },
  { min: 52, max: null, mieter: 5, vermieter: 95 },
];

// Referenz-CO₂-Preise (BEHG) in €/t — nur Fallback, wenn die tatsächlichen
// CO₂-Kosten (€) von der Brennstoffrechnung nicht vorliegen.
export const CO2_PREIS: Record<number, number> = {
  2021: 25,
  2022: 30,
  2023: 30,
  2024: 45,
  2025: 55,
  2026: 60,
};

const rund2 = (n: number) => Math.round(n * 100) / 100;

/** Spezifischer Ausstoß in kg CO₂ je m² und Jahr (0 bei flaeche <= 0). */
export function spezAusstoss(co2Kg: number, flaeche: number): number {
  if (!(flaeche > 0) || !Number.isFinite(co2Kg)) return 0;
  return co2Kg / flaeche;
}

/** Passende Stufe zum spezifischen Ausstoß (>= 52 → letzte Stufe). */
export function findeStufe(kgProM2: number): Co2Stufe {
  const s = CO2_STUFEN.find(
    (st) => kgProM2 >= st.min && (st.max == null || kgProM2 < st.max),
  );
  return s ?? CO2_STUFEN[0];
}

export type Co2Aufteilung = {
  spez: number;
  stufeIndex: number;
  mieterProzent: number;
  vermieterProzent: number;
  kostenGesamt: number;
  vermieterAnteil: number;
  mieterAnteil: number;
};

/**
 * Aufteilung der CO₂-Kosten.
 * - co2Kosten fehlt/null → Schätzung über CO2_PREIS[jahr]: (co2Kg/1000) * preis.
 * - gewerbe = true → 50/50 unabhängig vom Ausstoß (§ 8 CO2KostAufG).
 * - Beträge auf 2 Nachkommastellen gerundet.
 */
export function co2Aufteilung(opts: {
  co2Kg: number;
  co2Kosten?: number | null;
  flaeche: number;
  jahr?: number;
  gewerbe?: boolean;
}): Co2Aufteilung {
  const spez = spezAusstoss(opts.co2Kg, opts.flaeche);
  const stufe = findeStufe(spez);
  const stufeIndex = CO2_STUFEN.indexOf(stufe);

  const mieterProzent = opts.gewerbe ? 50 : stufe.mieter;
  const vermieterProzent = opts.gewerbe ? 50 : stufe.vermieter;

  const kosten =
    opts.co2Kosten != null && Number.isFinite(opts.co2Kosten) && opts.co2Kosten >= 0
      ? opts.co2Kosten
      : (Math.max(0, opts.co2Kg) / 1000) * (CO2_PREIS[opts.jahr ?? 0] ?? 0);

  const kostenGesamt = rund2(kosten);
  const vermieterAnteil = rund2((kostenGesamt * vermieterProzent) / 100);
  const mieterAnteil = rund2(kostenGesamt - vermieterAnteil);

  return {
    spez: rund2(spez),
    stufeIndex,
    mieterProzent,
    vermieterProzent,
    kostenGesamt,
    vermieterAnteil,
    mieterAnteil,
  };
}
