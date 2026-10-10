// Zeitliche Abgrenzung der Gebäude-AfA.
//
// Vorher rechnete lib/anlageV.ts die AfA für JEDES ausgewertete Jahr voll —
// auch für Jahre vor der Anschaffung und ohne die monatsgenaue Kürzung im
// Anschaffungsjahr. Beispiel: Kauf im November 2025, AfA-Basis 240.000 €,
// 2 % linear → ausgewiesen wurden 4.800 € statt 2/12 × 4.800 = 800 €.
// Die Zahl ist zum Abtippen in ELSTER gedacht — sie muss stimmen.
//
// § 7 Abs. 1 S. 4 EStG: Im Jahr der Anschaffung nur zeitanteilig, gerechnet ab
// dem AnschaffungsMONAT (der Monat zählt voll mit).

export type AfaZeitraum = {
  /** Faktor 0…1, mit dem der Jahresbetrag zu multiplizieren ist. */
  faktor: number;
  /** Laufendes AfA-Jahr, 0-basiert (0 = Anschaffungsjahr). -1 = außerhalb. */
  index: number;
  /** Kurzer Hinweis für die Oberfläche, wenn gekürzt oder null gerechnet wird. */
  hinweis?: string;
};

/**
 * Ermittelt den Zeitanteil der AfA für ein Auswertungsjahr.
 *
 * @param jahr         ausgewertetes Steuerjahr
 * @param startJahr    Jahr der Anschaffung (afa_start_jahr, sonst aus kaufdatum)
 * @param startMonat   Monat der Anschaffung 1–12; null = unbekannt → volles Jahr
 * @param dauerJahre   Nutzungsdauer in Jahren; null = kein Endpunkt (degressiv)
 */
export function afaZeitanteil(
  jahr: number,
  startJahr: number | null,
  startMonat: number | null,
  dauerJahre: number | null,
): AfaZeitraum {
  // Ohne Startjahr wird wie bisher voll gerechnet — der Aufrufer weist
  // gesondert darauf hin (fehlende Stammdaten sind kein Rechenfehler).
  if (startJahr == null || !Number.isFinite(startJahr)) {
    return { faktor: 1, index: 0 };
  }

  if (jahr < startJahr) {
    return {
      faktor: 0,
      index: -1,
      hinweis: `Das Objekt wurde erst ${startJahr} angeschafft — für ${jahr} gibt es keine AfA.`,
    };
  }

  const index = jahr - startJahr;

  // Ende der Nutzungsdauer: Im letzten Jahr läuft der im Anschaffungsjahr
  // nicht genutzte Rest aus (deshalb `> dauerJahre`, nicht `>=`).
  if (dauerJahre != null && dauerJahre > 0) {
    const angebrochen = startMonat != null && startMonat > 1;
    const letztesJahr = startJahr + dauerJahre - (angebrochen ? 0 : 1);
    if (jahr > letztesJahr) {
      return {
        faktor: 0,
        index,
        hinweis: `Die Abschreibungsdauer von ${dauerJahre} Jahren endete ${letztesJahr} — für ${jahr} gibt es keine AfA mehr.`,
      };
    }
    // Im angebrochenen Schlussjahr bleibt nur der im 1. Jahr fehlende Rest.
    if (angebrochen && jahr === letztesJahr) {
      const rest = (startMonat - 1) / 12;
      return {
        faktor: rest,
        index,
        hinweis: `Letztes Abschreibungsjahr — nur der im Anschaffungsjahr nicht genutzte Rest (${startMonat - 1}/12).`,
      };
    }
  }

  // Anschaffungsjahr: ab dem Anschaffungsmonat, dieser zählt voll.
  if (index === 0 && startMonat != null && startMonat >= 1 && startMonat <= 12) {
    const monate = 13 - startMonat;
    if (monate < 12) {
      return {
        faktor: monate / 12,
        index: 0,
        hinweis: `Anschaffung im ${startMonat}. Monat — AfA im ersten Jahr nur zeitanteilig (${monate}/12, § 7 Abs. 1 S. 4 EStG).`,
      };
    }
  }

  return { faktor: 1, index };
}

/** Monat 1–12 aus einem ISO-Datum; null, wenn nicht lesbar. */
export function monatVon(datum: string | null | undefined): number | null {
  if (!datum) return null;
  const m = Number(datum.slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null;
}

/**
 * Lineare Gebäude-AfA eines Jahres — bis zur vollen Absetzung (§ 7 Abs. 4 EStG), Gesamtprüfung
 * 07.10.2026, C18. Vorher endete die AfA nach `Math.round(100 / Satz)` Jahren: Bei 3 % waren das
 * 33 Jahre und 99 % — das letzte Prozent fehlte. Jetzt läuft sie, bis der Restbuchwert 0 ist; im
 * letzten Jahr nur noch der Rest (das deckt auch den im Anschaffungsjahr nicht genutzten Teil ab).
 */
export function linearImJahr(
  basis: number,
  satz: number,
  jahr: number,
  startJahr: number | null,
  startMonat: number | null,
): { betrag: number; hinweis?: string } {
  const jahresbetrag = (basis * satz) / 100;
  const z = afaZeitanteil(jahr, startJahr, startMonat, null);
  let betrag = jahresbetrag * z.faktor;
  let hinweis = z.hinweis;
  if (startJahr != null && Number.isFinite(startJahr) && jahresbetrag > 0 && jahr > startJahr) {
    const erstesJahr = afaZeitanteil(startJahr, startJahr, startMonat, null).faktor;
    const bisher = jahresbetrag * (erstesJahr + (jahr - startJahr - 1));
    const rest = basis - bisher;
    if (rest < 0.005) {
      betrag = 0;
      hinweis = `Das Gebäude ist voll abgeschrieben — für ${jahr} gibt es keine AfA mehr.`;
    } else if (betrag > rest) {
      betrag = rest;
      hinweis = "Letztes Abschreibungsjahr — nur noch der Restbuchwert.";
    }
  }
  return { betrag: Math.round(betrag * 100) / 100, hinweis };
}
