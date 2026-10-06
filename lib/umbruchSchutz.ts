// Geschützte Umbrüche für sichtbaren Fließtext der öffentlichen Seiten.
//
// Am Handy rutschten Einheiten allein in die nächste Zeile („240“ / „€ oder …“,
// „(§“ / „25 TDDDG)“, „Anlage“ / „V“) und Begriffe brachen am Bindestrich
// („50–70-%-“ / „Regel“). Statt jede Stelle im Quelltext von Hand zu schützen,
// läuft der Text beim RENDERN hier durch — die Daten (Titel, Beschreibungen,
// JSON-LD, Metadaten) bleiben unverändert.
//
// Nur für sichtbaren Text verwenden, nie für Metadaten oder strukturierte Daten.

const NBSP = " ";
const NB_BINDESTRICH = "‑"; // geschützter Bindestrich
const WJ = "⁠"; // Wortverbinder (kein Umbruch, keine Breite)

const EINHEITEN = "€|%|m²|m³|kWh|Euro|Jahre|Jahren|Monate|Monaten|Wochen|Tage|Tagen|Prozent";

export function schuetzeUmbrueche(text: string): string {
  return (
    text
      // Zahl + Einheit: „240 €“, „70 %“, „4 Wochen“
      .replace(new RegExp(`(\\d) (${EINHEITEN})(?![\\p{L}])`, "gu"), `$1${NBSP}$2`)
      // Paragraf/Artikel/Absatz/Nummer + Zahl: „§ 556“, „Art. 6“, „Abs. 3“, „Nr. 2“
      .replace(/(§§?|Art\.|Abs\.|Nr\.|Satz|Ziffer) (\d)/g, `$1${NBSP}$2`)
      // Formularname
      .replace(/Anlage V\b/g, `Anlage${NBSP}V`)
      // „50–70-%-Regel“: Bindestriche um das Prozentzeichen und den Bis-Strich schützen
      .replace(/(\d)-%-/g, `$1${NB_BINDESTRICH}%${NB_BINDESTRICH}`)
      .replace(/(\d)–(\d)/g, `$1${WJ}–${WJ}$2`)
  );
}
