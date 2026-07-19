// Wertentwicklung: baut Zeitreihen für den Wertverlauf eines Objekts und des
// gesamten Portfolios. Quelle sind die erfassten Wert-Stände in
// `bewertung_historie` — angereichert um den Kaufpreis als Startpunkt
// (Anschaffung) und den aktuellen Wert als Endpunkt (heute), damit der Verlauf
// auch dann eine Kurve zeigt, wenn noch keine Historie protokolliert wurde.
// Reine Funktionen, keine DB-/Netzzugriffe — testbar (tests/wertVerlauf.test.ts).

export type WertPunkt = { datum: string; marktwert: number };

export type RohStand = { datum: string; marktwert: number | null };

export type ObjektEingabe = {
  kaufpreis?: number | null;
  kaufdatum?: string | null; // YYYY-MM-DD
  aktuellerWert?: number | null;
  standDatum?: string | null; // Stand des aktuellen Werts (ISO/Date)
  historie?: RohStand[];
  heute: string; // YYYY-MM-DD — Endpunkt, wenn standDatum fehlt
};

// Timestamp/Date-String auf reines YYYY-MM-DD kürzen (Tages-Granularität).
function tag(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

const gueltig = (n: number | null | undefined): n is number =>
  n != null && Number.isFinite(n) && n > 0;

// Zeitreihe eines einzelnen Objekts, aufsteigend sortiert. Bei mehreren Ständen
// am selben Tag gewinnt die höherwertige Quelle (aktuell > Historie > Kauf).
// Aufeinanderfolgende gleiche (gerundete) Werte werden zusammengefasst.
export function objektWertReihe(o: ObjektEingabe): WertPunkt[] {
  // Priorität je Quelle: höher überschreibt am selben Tag.
  const prio = new Map<string, number>(); // datum -> prio
  const wert = new Map<string, number>(); // datum -> marktwert

  const setze = (datum: string | null, betrag: number | null | undefined, p: number) => {
    if (!datum || !gueltig(betrag)) return;
    if ((prio.get(datum) ?? -1) <= p) {
      prio.set(datum, p);
      wert.set(datum, Math.round(betrag));
    }
  };

  setze(tag(o.kaufdatum), o.kaufpreis, 0);
  for (const h of o.historie ?? []) setze(tag(h.datum), h.marktwert, 1);
  setze(tag(o.standDatum) ?? o.heute, o.aktuellerWert, 2);

  const reihe = [...wert.entries()]
    .map(([datum, marktwert]) => ({ datum, marktwert }))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  // Aufeinanderfolgende identische Werte ausdünnen (flache Segmente).
  return reihe.filter((p, i) => i === 0 || p.marktwert !== reihe[i - 1].marktwert);
}

// Portfolio-Gesamtwert über die Zeit: an jedem Datum, an dem sich der Wert
// irgendeines Objekts ändert, die Summe der je Objekt zuletzt bekannten Werte.
// Objekte tragen erst ab ihrem ersten bekannten Stand bei (davor 0 = noch nicht
// im Bestand). Aufeinanderfolgende gleiche Summen werden zusammengefasst.
export function portfolioWertReihe(objekte: ObjektEingabe[]): WertPunkt[] {
  const reihen = objekte.map(objektWertReihe).filter((r) => r.length > 0);
  if (reihen.length === 0) return [];

  const daten = [...new Set(reihen.flatMap((r) => r.map((p) => p.datum)))].sort((a, b) =>
    a.localeCompare(b),
  );

  const wertAn = (reihe: WertPunkt[], datum: string): number => {
    let v = 0;
    for (const p of reihe) {
      if (p.datum <= datum) v = p.marktwert;
      else break;
    }
    return v; // 0, solange der erste Stand des Objekts in der Zukunft liegt
  };

  const summe = daten.map((datum) => ({
    datum,
    marktwert: reihen.reduce((s, r) => s + wertAn(r, datum), 0),
  }));

  return summe.filter((p, i) => i === 0 || p.marktwert !== summe[i - 1].marktwert);
}

// Prozentuale Veränderung vom ersten zum letzten Punkt einer Reihe.
export function veraenderungProzent(reihe: WertPunkt[]): number | null {
  if (reihe.length < 2) return null;
  const erst = reihe[0].marktwert;
  const letzt = reihe[reihe.length - 1].marktwert;
  if (erst <= 0) return null;
  return Math.round(((letzt - erst) / erst) * 1000) / 10;
}
