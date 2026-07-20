// Laientaugliche Schnell-Schätzung der Haus-Substanz (Sachwertmodell ImmoWertV
// 2021) für den Objekt-Rechner. REINE Wiederverwendung von lib/bewertung/
// immowertv.ts — keine eigene Rechenlogik. KEINE Wertermittlung, kein Gutachten
// (§ 194 BauGB). Die örtliche Marktanpassung (Sachwertfaktor) ist BEWUSST NICHT
// eingerechnet — sie kann den Wert deutlich verschieben (Grundstücksmarktbericht).

import { sachwert, restnutzungsdauer, GND_WOHNGEBAEUDE } from "@/lib/bewertung/immowertv";

// Bruttogrundfläche/Wohnfläche-Verhältnis je Gebäudetyp (grobe Richtwerte).
const BGF_FAKTOR: Record<string, number> = {
  efh: 1.55, mfh_klein: 1.3, mfh_mittel: 1.25, mfh_gross: 1.2, mischnutzung: 1.35,
};

export type HausSachwertInput = {
  wohnflaeche: number;    // m² (aus dem Rechner-Hauptfeld)
  grundFlaeche: number;   // m²
  bodenrichtwert: number; // €/m² (BORIS)
  baujahr: number;        // 0 = unbekannt
  gebTyp: string;         // NHK2010-key
  ausstattung: number;    // 1..5
  bpiFaktor: number;      // Baupreisindex 2010→heute (~1,9 in 2026)
  regionalFaktor: number; // 1,0 neutral
};

export type HausSachwertErgebnis = {
  bodenwert: number;
  gebaeudesachwert: number;
  vorlaeufigerSachwert: number; // Bodenwert + Gebäudesachwert (VOR Marktanpassung)
  spanneMin: number;            // −20 %
  spanneMax: number;            // +20 %
  restnutzungsdauer: number;
  bereit: boolean;              // Bodenwert + Wohnfläche vorhanden?
  hinweise: string[];
};

export const HAUS_DISCLAIMER =
  "Überschlägige Substanz-Schätzung nach dem Sachwertmodell der ImmoWertV 2021 — " +
  "keine Wertermittlung und kein Gutachten (§ 194 BauGB). Der Bodenrichtwert ist amtlich " +
  "(BORIS) nachzuschlagen. Die örtliche Marktanpassung (Sachwertfaktor) ist hier NICHT " +
  "eingerechnet und kann den Wert deutlich verschieben; ebenso Modernisierungen. Für einen " +
  "belastbaren Wert den Marktwert-Schätzer (Schritt 1) oder einen Gutachterausschuss nutzen.";

export function hausSachwert(i: HausSachwertInput): HausSachwertErgebnis {
  const jahr = new Date().getFullYear();
  const rnd = i.baujahr > 0
    ? restnutzungsdauer(i.baujahr, jahr, GND_WOHNGEBAEUDE)
    : GND_WOHNGEBAEUDE; // Baujahr unbekannt → neuwertig (+ Hinweis)

  const e = sachwert({
    typ: i.gebTyp,
    standardstufe: i.ausstattung,
    wohnflaeche: Math.max(0, i.wohnflaeche),
    baupreisindex: i.bpiFaktor,
    regionalfaktor: i.regionalFaktor,
    restnutzungsdauer: rnd,
    bodenrichtwert: Math.max(0, i.bodenrichtwert),
    grundstuecksflaeche: Math.max(0, i.grundFlaeche),
    bgfFaktor: BGF_FAKTOR[i.gebTyp] ?? 1.55,
    sachwertfaktor: 1.0, // neutral → wert == vorläufiger Sachwert (keine Scheingenauigkeit)
  });

  const bodenwert = e.details.bodenwert;
  const gebaeudesachwert = e.details.gebaeudesachwert;
  const vorlaeufig = e.details.vorlaeufigerSachwert;

  const hinweise: string[] = [];
  if (i.baujahr <= 0) hinweise.push("Ohne Baujahr wird das Gebäude als neuwertig gerechnet — echter Wert meist niedriger.");
  if (i.bodenrichtwert <= 0) hinweise.push("Bodenrichtwert fehlt: amtlich bei BORIS nachschlagen (bodenrichtwerte-boris.de).");
  for (const w of e.warnungen) if (!w.includes("Sachwertfaktor")) hinweise.push(w);

  // Bodenwert ist bei Häusern oft 30–50 % des Werts → ohne BRW keine Headline-Zahl.
  const bereit = i.wohnflaeche > 0 && i.bodenrichtwert > 0;

  return {
    bodenwert,
    gebaeudesachwert,
    vorlaeufigerSachwert: vorlaeufig,
    spanneMin: Math.round(vorlaeufig * 0.8),
    spanneMax: Math.round(vorlaeufig * 1.2),
    restnutzungsdauer: rnd,
    bereit,
    hinweise,
  };
}
