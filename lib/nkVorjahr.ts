// NK-Abrechnung: Positionen aus dem Vorjahr übernehmen + Vorauszahlung vorschlagen
// (02.10.2026, Ausbau-Paket Punkt 3). Reine Funktionen.
//
// ÜBERNEHMEN: Kostenarten, Umlageschlüssel, Aufteilung und Beträge des Vorjahres als Startpunkt —
// die jährliche Tipparbeit ist fast immer dieselbe Liste. NICHT übernommen werden Werte, die je
// Jahr neu sind und still falsch wären: Verbrauch des Mieters und des Gebäudes (Zählerstände) und
// der Lohnanteil nach § 35a. Die Beträge stammen aus dem Vorjahr — die Seite sagt das deutlich.
//
// VORSCHLAG: Nach einer Abrechnung kann jede Partei die Vorauszahlung auf eine angemessene Höhe
// anpassen (§ 560 Abs. 4 BGB). Vorgeschlagen wird der Monatsanteil der abgerechneten Kosten,
// auf volle Euro aufgerundet. Nur ein Vorschlag; erst ab 5 € Unterschied angezeigt.

export type VorjahrPosition = {
  bezeichnung: string;
  betrag: number | null;
  umlageschluessel: string | null;
  umlagefaehig: boolean | null;
  jahr: number | null;
  aufteilung: string | null;
  verbrauch_mieter?: number | null;
  verbrauch_gesamt?: number | null;
  grundkosten_prozent: number | null;
  flaeche_gesamt: number | null;
  lohnanteil?: number | null;
  art_35a: string | null;
};

/** Was sich übernehmen lässt: nur Positionen MIT Jahr = Vorjahr (ohne Jahr gelten sie ohnehin jedes Jahr). */
export function vorjahrUebernahme(positionen: VorjahrPosition[], jahr: number) {
  const schonDa = positionen.some((p) => p.jahr === jahr);
  const quelle = positionen.filter((p) => p.jahr === jahr - 1);
  return {
    moeglich: !schonDa && quelle.length > 0,
    anzahl: quelle.length,
    zeilen: quelle.map((p) => ({
      bezeichnung: p.bezeichnung,
      betrag: p.betrag,
      jahr,
      umlageschluessel: p.umlageschluessel,
      umlagefaehig: p.umlagefaehig ?? true,
      aufteilung: p.aufteilung,
      grundkosten_prozent: p.grundkosten_prozent,
      flaeche_gesamt: p.flaeche_gesamt,
      art_35a: p.art_35a,
      // bewusst leer — je Jahr neu:
      verbrauch_mieter: null,
      verbrauch_gesamt: null,
      lohnanteil: null,
    })),
  };
}

export const VORSCHLAG_SCHWELLE = 5;

export function vorauszahlungsVorschlag(kostenImJahr: number, monate: number, aktuellMonat: number) {
  if (!(monate > 0) || !(kostenImJahr > 0)) return null;
  const vorschlag = Math.ceil(kostenImJahr / monate);
  const differenz = vorschlag - (aktuellMonat || 0);
  if (Math.abs(differenz) < VORSCHLAG_SCHWELLE) return null;
  return { vorschlag, differenz };
}

/**
 * Hat das Jahr Positionen, deren Bezeichnungen UND Beträge exakt denen des Vorjahres gleichen?
 * Dann wurde vermutlich übernommen und noch nicht aktualisiert → Hinweis vor dem Versand.
 */
export function gleicheBetraegeWieVorjahr(positionen: VorjahrPosition[], jahr: number): boolean {
  const schluessel = (p: VorjahrPosition) => `${p.bezeichnung}|${p.betrag ?? ""}`;
  const dieses = positionen.filter((p) => p.jahr === jahr).map(schluessel).sort();
  const vor = positionen.filter((p) => p.jahr === jahr - 1).map(schluessel).sort();
  return dieses.length > 0 && dieses.length === vor.length && dieses.every((k, i) => k === vor[i]);
}
