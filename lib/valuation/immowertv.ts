// Rechenkern der Immobilienbewertung nach ImmoWertV 2021 (gültig seit 01.01.2022).
// REINE Funktionen ohne UI-/DB-Abhängigkeit — vollständig unit-testbar.
// Drei anerkannte Verfahren: Vergleichs-, Ertrags-, Sachwertverfahren.
//
// WICHTIG: Ergebnisse sind unverbindliche Schätzungen und ersetzen kein Gutachten.
// Qualität = Qualität der Eingangs-Kennzahlen (Bodenrichtwert, Liegenschaftszins,
// Vergleichspreis/-miete, NHK, Faktoren). Alle Formeln sind nachvollziehbar
// dokumentiert; jede Funktion liefert zusätzlich eine Herleitung.

export type Herleitungszeile = { label: string; wert: number; einheit?: string; hinweis?: string };

/**
 * Vervielfältiger (Barwertfaktor) für nachschüssige, gleichbleibende jährliche
 * Zahlungen über die Restnutzungsdauer — Anlage 1 zur ImmoWertV:
 *   V = (1 − (1 + p)^(−n)) / p   mit p = Liegenschaftszins/100, n = Restnutzungsdauer.
 * Grenzfälle: n ≤ 0 → 0 (kein Gebäude­ertrag mehr); p ≤ 0 → n (ohne Verzinsung).
 */
export function vervielfaeltiger(liegenschaftszinsProzent: number, restnutzungsdauer: number): number {
  const n = restnutzungsdauer;
  if (!Number.isFinite(n) || n <= 0) return 0;
  const p = liegenschaftszinsProzent / 100;
  if (!Number.isFinite(p) || p <= 0) return n;
  return (1 - Math.pow(1 + p, -n)) / p;
}

/** Bodenwert = Bodenrichtwert (€/m²) × Grundstücksfläche (m²). */
export function bodenwert(bodenrichtwertM2: number, grundstuecksflaeche: number): number {
  return Math.max(0, bodenrichtwertM2 || 0) * Math.max(0, grundstuecksflaeche || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// a) Vergleichswertverfahren (§§ 24–26 ImmoWertV)
// ─────────────────────────────────────────────────────────────────────────────
export type VergleichInput = { vergleichspreisM2: number; flaeche: number; zuAbschlagProzent?: number };
export function vergleichswert(i: VergleichInput): { wert: number; herleitung: Herleitungszeile[] } {
  const basis = (i.vergleichspreisM2 || 0) * (i.flaeche || 0);
  const zuschlagProzent = i.zuAbschlagProzent ?? 0;
  const anpassung = basis * (zuschlagProzent / 100);
  const wert = Math.max(0, basis + anpassung);
  return {
    wert,
    herleitung: [
      { label: "Vergleichspreis", wert: i.vergleichspreisM2 || 0, einheit: "€/m²" },
      { label: "Wohn-/Nutzfläche", wert: i.flaeche || 0, einheit: "m²" },
      { label: "Basiswert (Preis × Fläche)", wert: basis, einheit: "€" },
      { label: `Zu-/Abschlag (${zuschlagProzent} %)`, wert: anpassung, einheit: "€", hinweis: "Lage, Ausstattung, Energie, Balkon/Garten, Etage/Aufzug …" },
      { label: "Vergleichswert", wert, einheit: "€" },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// b) Ertragswertverfahren (§§ 27–34 ImmoWertV)
// ─────────────────────────────────────────────────────────────────────────────
export type ErtragInput = {
  jahresRohertrag: number;                 // nachhaltig erzielbare Jahres-Nettokaltmiete
  bewirtschaftungskostenProzent: number;   // Verwaltung + Instandhaltung + Mietausfallwagnis, % vom Rohertrag
  bodenwert: number;
  liegenschaftszinsProzent: number;
  restnutzungsdauer: number;
};
export function ertragswert(i: ErtragInput): {
  wert: number; jahresreinertrag: number; gebaeudereinertrag: number; vervielfaeltiger: number; herleitung: Herleitungszeile[];
} {
  const bewk = (i.jahresRohertrag || 0) * ((i.bewirtschaftungskostenProzent || 0) / 100);
  const jahresreinertrag = (i.jahresRohertrag || 0) - bewk;
  const bodenwertverzinsung = (i.bodenwert || 0) * ((i.liegenschaftszinsProzent || 0) / 100);
  const gebaeudereinertrag = jahresreinertrag - bodenwertverzinsung;
  const V = vervielfaeltiger(i.liegenschaftszinsProzent, i.restnutzungsdauer);
  const gebaeudeertragswert = Math.max(0, gebaeudereinertrag) * V;
  const wert = Math.max(0, (i.bodenwert || 0) + gebaeudeertragswert);
  return {
    wert, jahresreinertrag, gebaeudereinertrag, vervielfaeltiger: V,
    herleitung: [
      { label: "Rohertrag (Jahresnettokaltmiete)", wert: i.jahresRohertrag || 0, einheit: "€" },
      { label: `Bewirtschaftungskosten (${i.bewirtschaftungskostenProzent || 0} %)`, wert: -bewk, einheit: "€" },
      { label: "Jahresreinertrag", wert: jahresreinertrag, einheit: "€" },
      { label: "Bodenwertverzinsung", wert: -bodenwertverzinsung, einheit: "€", hinweis: `Bodenwert × ${i.liegenschaftszinsProzent || 0} %` },
      { label: "Gebäudereinertrag", wert: gebaeudereinertrag, einheit: "€", hinweis: gebaeudereinertrag < 0 ? "negativ → auf 0 begrenzt" : undefined },
      { label: "Vervielfältiger V", wert: V, hinweis: `f(${i.liegenschaftszinsProzent || 0} %, RND ${i.restnutzungsdauer || 0} J.)` },
      { label: "Gebäudeertragswert", wert: gebaeudeertragswert, einheit: "€" },
      { label: "Bodenwert", wert: i.bodenwert || 0, einheit: "€" },
      { label: "Ertragswert", wert, einheit: "€" },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// c) Sachwertverfahren (§§ 35–39 ImmoWertV)
// ─────────────────────────────────────────────────────────────────────────────
export type SachInput = {
  nhkM2: number;                    // Normalherstellungskosten €/m² BGF (NHK 2010, indexiert)
  bgf: number;                      // Brutto-Grundfläche
  alterswertminderungProzent: number;
  aussenanlagen: number;
  bodenwert: number;
  sachwertfaktor: number;           // Marktanpassungsfaktor (Gutachterausschuss)
};
export function sachwert(i: SachInput): { wert: number; gebaeudesachwert: number; herleitung: Herleitungszeile[] } {
  const herstellung = (i.nhkM2 || 0) * (i.bgf || 0);
  const minderung = herstellung * ((i.alterswertminderungProzent || 0) / 100);
  const gebaeudesachwert = Math.max(0, herstellung - minderung);
  const vorlaeufigerSachwert = gebaeudesachwert + (i.aussenanlagen || 0) + (i.bodenwert || 0);
  const faktor = i.sachwertfaktor && i.sachwertfaktor > 0 ? i.sachwertfaktor : 1;
  const wert = Math.max(0, vorlaeufigerSachwert * faktor);
  return {
    wert, gebaeudesachwert,
    herleitung: [
      { label: "Normalherstellungskosten", wert: i.nhkM2 || 0, einheit: "€/m² BGF" },
      { label: "Brutto-Grundfläche", wert: i.bgf || 0, einheit: "m²" },
      { label: "Herstellungskosten", wert: herstellung, einheit: "€" },
      { label: `Alterswertminderung (${i.alterswertminderungProzent || 0} %)`, wert: -minderung, einheit: "€" },
      { label: "Gebäudesachwert", wert: gebaeudesachwert, einheit: "€" },
      { label: "Außenanlagen", wert: i.aussenanlagen || 0, einheit: "€" },
      { label: "Bodenwert", wert: i.bodenwert || 0, einheit: "€" },
      { label: "Vorläufiger Sachwert", wert: vorlaeufigerSachwert, einheit: "€" },
      { label: `Marktanpassung (× ${faktor})`, wert: wert - vorlaeufigerSachwert, einheit: "€" },
      { label: "Sachwert", wert, einheit: "€" },
    ],
  };
}

/**
 * Lineare Alterswertminderung in % = (Alter / Gesamtnutzungsdauer) × 100,
 * gekappt auf [0, 100]. Für das Sachwertverfahren.
 */
export function alterswertminderungProzent(alterJahre: number, gesamtnutzungsdauer: number): number {
  if (!gesamtnutzungsdauer || gesamtnutzungsdauer <= 0) return 0;
  return Math.min(100, Math.max(0, (alterJahre / gesamtnutzungsdauer) * 100));
}

/**
 * Fortschreibung eines Werts zwischen zwei Stichtagen über einen Preisindex
 * (z. B. Destatis Häuserpreisindex / vdp): wert × indexNeu / indexAlt.
 */
export function fortschreiben(wert: number, indexAlt: number, indexNeu: number): number {
  if (!indexAlt || indexAlt <= 0) return wert;
  return wert * (indexNeu / indexAlt);
}
