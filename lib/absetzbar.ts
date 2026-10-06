// „Als Werbungskosten absetzbar" — die EINE Stelle für Wortlaut und Rechnung
// (05.10.2026). Steht bei den Preisen (/preise, Preis-Teaser der Startseite)
// und erscheint deshalb nur mit PREISE_SICHTBAR.
//
// WARUM NICHT „quasi kostenlos": Absetzbar heißt, die Kosten mindern das zu
// versteuernde Einkommen. Gespart wird der persönliche Grenzsteuersatz, nicht
// der Betrag — bei 30 % kostet ein Euro netto 70 Cent, unter dem
// Grundfreibetrag einen ganzen Euro. „Kostenlos" für ein Produkt mit Preis ist
// irreführend (§ 5 UWG). `tests/absetzbar.test.ts` hält fest, dass der Text
// das Wort nicht benutzt.
//
// „Automatisch gebucht" stimmt seit `lib/billing/aboBuchung.ts`: Jede bezahlte
// Rechnung wird als Kosten „Verwaltung" (Anlage V Zeile 46) gebucht.

/** Grenzsteuersätze für das Rechenbeispiel — ohne Solidaritätszuschlag und Kirchensteuer. */
export const BEISPIEL_SAETZE = [0.3, 0.42] as const;

/** „7,99 €" → 7.99; alles ohne Betrag → null. */
export function preisAusText(text: string): number | null {
  const m = /^(\d{1,4})(?:,(\d{2}))?\s*€$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

/** Was nach der Steuerersparnis bleibt, auf Cent gerundet. */
export function nettoNachSteuer(brutto: number, satz: number): number {
  return Math.round(brutto * (1 - satz) * 100) / 100;
}

const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export const ABSETZBAR_TITEL = "Als Werbungskosten absetzbar — und automatisch gebucht";

/** Der Absatz unter den Preisen. `brutto` = Monatspreis des Beispiel-Tarifs. */
export function absetzbarText(tarif: string, brutto: number): string[] {
  const [a, b] = BEISPIEL_SAETZE;
  return [
    "Für vermietete Objekte kannst du die Kosten für MyImmo in der Regel als Werbungskosten " +
      "in der Anlage V ansetzen (Verwaltungskosten). MyImmo bucht jede bezahlte Rechnung selbst " +
      "als Kosten — anteilig nach Einheiten auf deine Objekte, außer selbst bewohnten. Sie steht damit ohne " +
      "Zutun in deiner Anlage V.",
    `Was dich das netto kostet, hängt von deinem persönlichen Steuersatz ab: ${tarif} ` +
      `(${euro(brutto)} im Monat) kostet bei ${Math.round(a * 100)} % Grenzsteuersatz rund ` +
      `${euro(nettoNachSteuer(brutto, a))}, bei ${Math.round(b * 100)} % rund ` +
      `${euro(nettoNachSteuer(brutto, b))} im Monat. Liegt dein Einkommen unter dem ` +
      "Grundfreibetrag, sparst du nichts.",
  ];
}

export const ABSETZBAR_VORBEHALT =
  "Allgemeiner Hinweis, keine Steuerberatung. Ob und in welcher Höhe die Kosten abziehbar sind, " +
  "hängt von deinem Einzelfall ab.";
