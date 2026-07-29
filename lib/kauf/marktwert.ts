// Marktwert im Kauf-Tool — führt Marktwert-Schätzer und Objekt-Rechner zusammen.
//
// Das Verfahren richtet sich nach der gewählten Nutzung:
//   Vermietung    → Ertragswert (aus der Miete)
//   Eigennutzung  → Sachwert    (aus der Bausubstanz)
// Beides rechnet mit derselben ImmoWertV-Engine wie der Reiter „Marktwert-
// Schätzer"; hier kommen die Eingaben aber aus dem Kauf-Rechner, damit man
// Wohnfläche, Baujahr, Bodenrichtwert usw. nur EINMAL eintragen muss.
//
// Wichtig: Der Kauf-Rechner führt die Kaltmiete als MONATSbetrag, die
// Ertragswert-Formel braucht die Jahresnettokaltmiete — die Umrechnung
// passiert hier an einer Stelle statt in der Oberfläche.

import { ertragswert, sachwert, restnutzungsdauer, GND_WOHNGEBAEUDE, type Bewertungsergebnis } from "@/lib/bewertung/immowertv";

export type MarktwertEingabe = {
  nutzung: "vermietung" | "eigennutzung";
  objektTyp: "wohnung" | "haus";
  wohnflaeche: number;
  kaltmieteMonat: number; // €/Monat (wie im Kauf-Rechner)
  anzahlWohnungen: number;
  grundFlaeche: number;
  bodenrichtwert: number;
  baujahr: number; // 0 = unbekannt
  gebTyp: string; // NHK2010-Key
  ausstattung: number; // 1..5
  bpiFaktor: number;
  regionalFaktor: number;
  liegenschaftszins: number; // % p. a. (nur Ertragswert)
  sachwertfaktor: number; // (nur Sachwert)
};

export type MarktwertErgebnis = {
  verfahren: "ertragswert" | "sachwert";
  verfahrenLabel: string;
  /** false = Pflichtangaben fehlen; dann ist `ergebnis` null. */
  bereit: boolean;
  fehlend: string[];
  /** Gerechnet wurde, aber diese Angaben fehlen und verzerren das Ergebnis. */
  unsicher: string[];
  ergebnis: Bewertungsergebnis | null;
  restnutzungsdauer: number;
};

/** Welche Angaben fehlen noch für das jeweilige Verfahren? */
export function fehlendeAngaben(e: MarktwertEingabe): string[] {
  const fehlt: string[] = [];
  if (e.wohnflaeche <= 0) fehlt.push("Wohnfläche");
  if (e.nutzung === "vermietung") {
    if (e.kaltmieteMonat <= 0) fehlt.push("Kaltmiete");
  } else {
    if (e.bodenrichtwert <= 0) fehlt.push("Bodenrichtwert");
  }
  return fehlt;
}

/**
 * Angaben, ohne die gerechnet WIRD, das Ergebnis aber deutlich unsicherer ist.
 *
 * Beim Ertragswert ist der Bodenwert Teil der Formel (§ 28 ImmoWertV: Reinertrag
 * abzüglich Bodenwertverzinsung). Fehlt er, rechnet die Engine mit 0 € Boden —
 * das Ergebnis ist dann keine Marktwertschätzung mehr, sondern eine reine
 * Ertragsrechnung. Das darf man zeigen, aber nicht wortlos.
 *
 * Fehlt das Baujahr, setzt die Restnutzungsdauer auf die volle Gesamtnutzungs-
 * dauer — die App rechnet das Objekt also still als Neubau.
 */
export function unsichereAngaben(e: MarktwertEingabe): string[] {
  const unsicher: string[] = [];
  if (e.baujahr <= 0) unsicher.push("Baujahr — gerechnet wird sonst mit voller Restnutzungsdauer (wie ein Neubau)");
  if (e.nutzung === "vermietung" && !(e.bodenrichtwert > 0 && e.grundFlaeche > 0)) {
    unsicher.push("Bodenrichtwert und Grundstücksfläche — ohne sie bleibt der Bodenwert im Ertragswert unberücksichtigt");
  }
  return unsicher;
}

export function marktwert(e: MarktwertEingabe): MarktwertErgebnis {
  const jahr = new Date().getFullYear();
  const rnd = e.baujahr > 0 ? restnutzungsdauer(e.baujahr, jahr, GND_WOHNGEBAEUDE) : GND_WOHNGEBAEUDE;
  const fehlt = fehlendeAngaben(e);
  const verfahren = e.nutzung === "vermietung" ? "ertragswert" : "sachwert";
  const verfahrenLabel = verfahren === "ertragswert" ? "Ertragswert (vermietet)" : "Sachwert (Bausubstanz)";

  const unsicher = unsichereAngaben(e);

  if (fehlt.length > 0) {
    return { verfahren, verfahrenLabel, bereit: false, fehlend: fehlt, unsicher, ergebnis: null, restnutzungsdauer: rnd };
  }

  const ergebnis =
    verfahren === "ertragswert"
      ? ertragswert({
          jahresnettokaltmiete: e.kaltmieteMonat * 12,
          wohnflaeche: e.wohnflaeche,
          anzahlWohnungen: Math.max(1, e.anzahlWohnungen),
          istEtw: e.objektTyp === "wohnung",
          bodenrichtwert: e.bodenrichtwert,
          grundstuecksflaeche: e.grundFlaeche,
          liegenschaftszins: e.liegenschaftszins,
          restnutzungsdauer: rnd,
        })
      : sachwert({
          typ: e.gebTyp,
          standardstufe: e.ausstattung,
          wohnflaeche: e.wohnflaeche,
          baupreisindex: e.bpiFaktor || 1.9,
          regionalfaktor: e.regionalFaktor || 1,
          restnutzungsdauer: rnd,
          bodenrichtwert: e.bodenrichtwert,
          grundstuecksflaeche: e.grundFlaeche,
          sachwertfaktor: e.sachwertfaktor || 1,
        });

  return { verfahren, verfahrenLabel, bereit: true, fehlend: [], unsicher, ergebnis, restnutzungsdauer: rnd };
}

/**
 * Kaufpreis gegen den geschätzten Marktwert — schlicht und ohne Drama.
 *
 * `unsicher` = die Schätzung selbst steht auf wackligen Beinen (fehlender
 * Bodenwert, fehlendes Baujahr; siehe `unsichereAngaben`). Dann darf hier KEIN
 * grünes „unter der Schätzung" stehen: Ohne Bodenwert fällt der geschätzte Wert
 * systematisch zu niedrig aus, ein günstig wirkender Preis wäre also gerade
 * dann falsch beruhigend, wenn er es am wenigsten sein darf. Das Urteil wird in
 * dem Fall neutral formuliert und ausdrücklich als vorläufig gekennzeichnet.
 */
export function preisUrteil(
  marktwert: number,
  kaufpreis: number,
  unsicher = false,
): { text: string; farbe: string; abweichung: number; vorlaeufig: boolean } | null {
  if (marktwert <= 0 || kaufpreis <= 0) return null;
  const abw = ((kaufpreis - marktwert) / marktwert) * 100;

  if (unsicher) {
    const richtung =
      abw <= -10 ? `${Math.abs(Math.round(abw))} % unter` : abw <= 10 ? "etwa auf Höhe" : `${Math.round(abw)} % über`;
    return {
      text: `${richtung} der vorläufigen Schätzung — die Schätzung ist noch unvollständig, daraus lässt sich kein Urteil über den Preis ableiten`,
      farbe: "var(--amber)",
      abweichung: abw,
      vorlaeufig: true,
    };
  }

  if (abw <= -10) return { text: `${Math.abs(Math.round(abw))} % unter der Schätzung`, farbe: "var(--green)", abweichung: abw, vorlaeufig: false };
  if (abw <= 10) return { text: "im Rahmen der Schätzung", farbe: "var(--teal, #2c9c8f)", abweichung: abw, vorlaeufig: false };
  if (abw <= 25) return { text: `${Math.round(abw)} % über der Schätzung`, farbe: "var(--amber)", abweichung: abw, vorlaeufig: false };
  return { text: `${Math.round(abw)} % über der Schätzung — genau prüfen`, farbe: "var(--amber)", abweichung: abw, vorlaeufig: false };
}
