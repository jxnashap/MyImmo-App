// Bausteine der Nebenkosten-Verteilung (ohne Abhängigkeiten). Der alte Verteiler (berechneUmlage,
// UmlageAssistent, Action verteileNebenkosten) ist seit NK Stufe 1 (07.10.2026) entfernt — die
// Verteilung rechnet jetzt lib/nkObjekt.ts. Geblieben: die cent-genaue Aufteilung und die Frage, ob
// ein Objekt mehrere Mietparteien hat.

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

// ---------------------------------------------------------------------------
// Sichtbarkeit des Nebenkosten-Verteilers
// ---------------------------------------------------------------------------
// Der Verteiler teilt Gesamtkosten auf MEHRERE Mietparteien auf. Bei einer
// einzelnen Einheit (ETW, EFH) gibt es nichts zu verteilen — dort landen die
// Kosten ohnehin vollständig beim einzigen Mieter. Deshalb wird das Werkzeug
// nur angeboten, wenn das Objekt tatsächlich mehrere Parteien hat.
//
// Wichtig: Das betrifft NUR den Verteiler. Die Frage, welche Kosten
// umlagefähig sind (BetrKV), und die NK-Abrechnung je Mieter gibt es
// unverändert für jeden Objekttyp — auch für die ETW.

/** Objekttypen, die von Haus aus mehrere Einheiten haben. */
export const MEHRPARTEIEN_TYPEN = ["Mehrfamilienhaus", "Garagenkomplex"];

export function zeigeVerteiler(p: {
  typ?: string | null;
  einheiten_anzahl?: number | null;
  mieterAnzahl?: number;
}): boolean {
  if (MEHRPARTEIEN_TYPEN.includes(p.typ ?? "")) return true;
  if ((p.einheiten_anzahl ?? 0) > 1) return true;
  return (p.mieterAnzahl ?? 0) > 1;
}
