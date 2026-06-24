// Nebenkosten-Verteiler — reine Berechnungslogik (ohne Abhängigkeiten).
// Verteilt Gesamtkosten je Position nach Flächenanteil (m²) oder zu gleichen
// Teilen je Einheit auf die Mieter. Geteilt zwischen Live-Vorschau (Client)
// und Server-Action, damit Anzeige und gespeicherte Werte identisch sind.

export type UmlageSchluessel = "flaeche" | "gleich";

export type UmlageZeile = {
  bezeichnung: string;
  betrag: number; // Gesamtbetrag der Position
  schluessel: UmlageSchluessel;
};

export type UmlageMieter = {
  id: string;
  name: string;
  flaeche: number; // m²
};

export type UmlageAnteil = {
  bezeichnung: string;
  schluessel: string; // gespeicherter Umlageschlüssel: "Fläche" | "Einheit"
  betrag: number;
};

export type UmlageErgebnisMieter = {
  id: string;
  name: string;
  flaeche: number;
  anteilProzent: number; // Flächenanteil in %
  positionen: UmlageAnteil[];
  summe: number;
};

export type UmlageErgebnis = {
  perMieter: UmlageErgebnisMieter[];
  totalFlaeche: number;
  zeilenSummen: number[]; // Gesamtbetrag je Zeile (zur Kontrolle)
  gesamt: number;
};

// Ein-/Ausgabe der Server-Action (hier definiert, da "use server"-Dateien
// nur async Funktionen exportieren dürfen).
export type VerteilenInput = {
  propId: string;
  jahr: number;
  zeilen: UmlageZeile[];
  mieter: { id: string; flaeche: number }[];
};

export type VerteilenErgebnis = {
  ok: boolean;
  positionen: number; // Anzahl geschriebener Positionen
  mieter: number; // Anzahl belieferter Mieter
  gesamt: number; // verteilte Gesamtsumme
  fehler?: string;
};

/** Schlüssel-Mapping in die gespeicherte Bezeichnung (mieter_positionen.umlageschluessel). */
export function schluesselLabel(s: UmlageSchluessel): string {
  return s === "gleich" ? "Einheit" : "Fläche";
}

/**
 * Verteilt einen Betrag cent-genau anhand von Gewichten.
 * Rundungsrest (Cents) wird per größtem Nachkommarest vergeben, sodass die
 * Summe der Anteile exakt dem Ausgangsbetrag entspricht.
 */
export function verteileBetrag(betrag: number, gewichte: number[]): number[] {
  const n = gewichte.length;
  if (n === 0) return [];
  const summe = gewichte.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (summe <= 0) return gewichte.map(() => 0);

  const cents = Math.round(betrag * 100);
  const roh = gewichte.map((g) => (cents * (g > 0 ? g : 0)) / summe);
  const floor = roh.map((r) => Math.floor(r));
  const verteilt = floor.reduce((a, b) => a + b, 0);
  let rest = cents - verteilt;

  const reihenfolge = roh
    .map((r, i) => ({ i, f: r - Math.floor(r) }))
    .sort((a, b) => b.f - a.f);

  const res = floor.slice();
  let k = 0;
  while (rest > 0 && reihenfolge.length > 0) {
    res[reihenfolge[k % reihenfolge.length].i] += 1;
    rest -= 1;
    k += 1;
  }
  return res.map((c) => c / 100);
}

/** Berechnet die komplette Verteilung über alle Positionen und Mieter. */
export function berechneUmlage(
  zeilen: UmlageZeile[],
  mieter: UmlageMieter[],
): UmlageErgebnis {
  const totalFlaeche = mieter.reduce((s, m) => s + (m.flaeche > 0 ? m.flaeche : 0), 0);

  const perMieter: UmlageErgebnisMieter[] = mieter.map((m) => ({
    id: m.id,
    name: m.name,
    flaeche: m.flaeche,
    anteilProzent: totalFlaeche > 0 ? ((m.flaeche > 0 ? m.flaeche : 0) / totalFlaeche) * 100 : 0,
    positionen: [],
    summe: 0,
  }));

  const zeilenSummen: number[] = [];

  for (const z of zeilen) {
    const gewichte =
      z.schluessel === "gleich" ? mieter.map(() => 1) : mieter.map((m) => (m.flaeche > 0 ? m.flaeche : 0));
    const anteile = verteileBetrag(z.betrag, gewichte);
    zeilenSummen.push(anteile.reduce((a, b) => a + b, 0));
    anteile.forEach((a, i) => {
      perMieter[i].positionen.push({
        bezeichnung: z.bezeichnung,
        schluessel: schluesselLabel(z.schluessel),
        betrag: a,
      });
      perMieter[i].summe = Math.round((perMieter[i].summe + a) * 100) / 100;
    });
  }

  const gesamt = Math.round(perMieter.reduce((s, m) => s + m.summe, 0) * 100) / 100;

  return { perMieter, totalFlaeche, zeilenSummen, gesamt };
}
