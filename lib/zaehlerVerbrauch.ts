// Verbrauch aus zwei Zählerständen — nur, wenn es DERSELBE Zähler ist (B11, Prüfstand 11.10.2026).
//
// VORHER (lib/actions/zaehler.ts bis 11.10.2026): Die Vormeldung wurde über Mieter + Zählerart
// gesucht. Zwei Stromzähler eines Mieters (Haushalt + Wärmepumpe), ein getauschter Zähler oder eine
// andere Einheit (kWh gegen m³ beim Gas) wurden gegeneinander gerechnet — „Verbrauch“ war dann eine
// erfundene Zahl. Ein kleinerer Stand (Tausch, Überlauf, Tippfehler) ergab still „kein Verbrauch“.
//
// JETZT (rein, ohne Datenbank): Ein Verbrauch entsteht nur, wenn die Vormeldung nachweislich zum
// selben Zähler gehört — gleiche Zählerart, gleiche Einheit, gleiche Zählernummer (beide gesetzt) bzw.
// beide OHNE Nummer am selben Mieter und Objekt — und der neue Stand nicht kleiner ist. Sonst
// „Rückfrage“ mit Grund: Die Meldung wird übernommen, der Verbrauch aber nicht erfunden.

export type ZaehlerMeldung = {
  art: string;
  einheit: string | null;
  zaehlernummer: string | null;
  mieter_id: string | null;
  prop_id: string | null;
  stand: number;
  ablesedatum: string; // YYYY-MM-DD
};

export type VerbrauchErgebnis =
  | { art: "verbrauch"; menge: number; vorher: { stand: number; ablesedatum: string } }
  | { art: "erste"; grund: string }
  | { art: "rueckfrage"; grund: string };

// Zählernummern werden mit Leerzeichen, Bindestrichen oder Punkten geschrieben („1 ESY-1160.123“) —
// verglichen wird nur die Folge aus Buchstaben und Ziffern.
const nummer = (s: string | null | undefined) => (s ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase();
const einheitNorm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace("³", "3");

/**
 * `vorher` = bereits übernommene Meldungen desselben Vermieters (beliebig viele, unsortiert).
 * Gewählt wird die jüngste Meldung VOR `aktuell`, die zum selben Zähler gehört.
 */
export function zaehlerVerbrauch(aktuell: ZaehlerMeldung, vorher: ZaehlerMeldung[]): VerbrauchErgebnis {
  const nr = nummer(aktuell.zaehlernummer);
  const frueher = vorher
    .filter((v) => v.art === aktuell.art && v.ablesedatum < aktuell.ablesedatum)
    .sort((a, b) => b.ablesedatum.localeCompare(a.ablesedatum));

  // Derselbe Zähler: mit Nummer über die Nummer (am selben Objekt, falls bekannt); ohne Nummer nur
  // innerhalb desselben Mietverhältnisses und Objekts.
  const gleicherZaehler = (v: ZaehlerMeldung) =>
    nr
      ? nummer(v.zaehlernummer) === nr && (!aktuell.prop_id || !v.prop_id || v.prop_id === aktuell.prop_id)
      : !nummer(v.zaehlernummer) && v.mieter_id === aktuell.mieter_id && v.prop_id === aktuell.prop_id;
  const passend = frueher.find(gleicherZaehler);

  if (!passend) {
    // Gibt es am selben Mietverhältnis eine Vormeldung derselben Art mit ANDERER Nummer, ist das sehr
    // wahrscheinlich ein Zählertausch — dann nachfragen statt still „erste Meldung“ annehmen.
    const andere = frueher.find((v) => v.mieter_id === aktuell.mieter_id && v.prop_id === aktuell.prop_id);
    if (andere && nummer(andere.zaehlernummer) !== nr) {
      return { art: "rueckfrage", grund: "Andere Zählernummer als bei der letzten Meldung — Zählertausch? Den Verbrauch bitte mit End- und Anfangsstand von Hand erfassen." };
    }
    return { art: "erste", grund: "Erste Meldung dieses Zählers — ab hier wird der Verbrauch gerechnet." };
  }
  if (einheitNorm(passend.einheit) !== einheitNorm(aktuell.einheit)) {
    return { art: "rueckfrage", grund: `Andere Einheit als bei der letzten Meldung (${passend.einheit ?? "?"} → ${aktuell.einheit ?? "?"}) — kein Verbrauch berechnet.` };
  }
  if (aktuell.stand < passend.stand) {
    return { art: "rueckfrage", grund: "Der Stand ist kleiner als bei der letzten Meldung (Zählertausch, Überlauf oder Tippfehler?) — kein Verbrauch berechnet." };
  }
  return {
    art: "verbrauch",
    menge: Math.round((aktuell.stand - passend.stand) * 1000) / 1000,
    vorher: { stand: passend.stand, ablesedatum: passend.ablesedatum },
  };
}
