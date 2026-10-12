// Rechtsgrundlagen der abgeleiteten Fristen (Ablauf D, Prüfstand 11.10.2026) — mit Fundstelle, dem Satz,
// auf dem die Rechnung beruht (wörtlich aus der amtlichen Fassung), Annahme und Prüfdatum.
// Quelle: gesetze-im-internet.de (Bundesministerium der Justiz), abgerufen am 11.10.2026.
// `tests/ablaufD.test.ts` verlangt für JEDE Rechtsgrundlage, die `mieterFristen()`, `kreditFristen()`,
// `objektFristen()` oder `globaleFristen()` ausgibt, einen Eintrag hier (ausgenommen ausdrücklich als
// „Empfehlung:“ gekennzeichnete Hinweise — sie berufen sich auf keine Norm). Prüfzyklus: docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md.

export type FristQuelle = {
  /** Wie die Frist die Norm nennt (Präfix von `Frist.rechtsgrundlage`). */
  norm: string;
  url: string;
  /** Wörtlicher Auszug der amtlichen Fassung, auf dem die Rechnung beruht. */
  wortlaut: string;
  /** Was MyImmo dabei annimmt — der Teil, der im Einzelfall abweichen kann. */
  annahme: string;
  geprueft: string;
};

export const FRIST_QUELLEN: FristQuelle[] = [
  {
    norm: "§ 19 BMG",
    url: "https://www.gesetze-im-internet.de/bmg/__19.html",
    wortlaut: "den Einzug schriftlich oder gegenüber der Meldebehörde nach Absatz 4 auch elektronisch innerhalb der in § 17 Absatz 1 genannten Frist zu bestätigen",
    annahme: "Einzug = Mietbeginn; Frist nach § 17 Abs. 1 BMG zwei Wochen („innerhalb von zwei Wochen nach dem Einzug“). Bußgeld bis 1.000 € (§ 54 Abs. 2 Nr. 3, Abs. 3 BMG). Eine Auszugsbestätigung verlangt § 19 nicht mehr.",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 573c BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__573c.html",
    wortlaut: "Die Kündigung ist spätestens am dritten Werktag eines Kalendermonats zum Ablauf des übernächsten Monats zulässig.",
    annahme: "Angezeigt wird Mietende minus der eingetragenen Kündigungsfrist in Monaten — also VOR dem dritten Werktag (sichere Seite). Die genaue Frist mit Karenztagen rechnet der Brief-Generator (lib/briefPruefung.ts).",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 558 Abs. 1 BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__558.html",
    wortlaut: "Das Mieterhöhungsverlangen kann frühestens ein Jahr nach der letzten Mieterhöhung geltend gemacht werden.",
    annahme: "Letzte Mieterhöhung = eingetragenes Datum; Erhöhungen nach §§ 559–560 zählen nicht (Abs. 1 S. 3). Nur bei normaler Miete: ausgeschlossen bei Staffelmiete (§ 557a Abs. 2 S. 2) und Indexmiete (§ 557b Abs. 2 S. 3).",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 558 BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__558.html",
    wortlaut: "wenn die Miete in dem Zeitpunkt, zu dem die Erhöhung eintreten soll, seit 15 Monaten unverändert ist",
    annahme: "Ohne eingetragene letzte Erhöhung gilt der Mietbeginn als Stand; der Hinweis erscheint ab zwölf Monaten Mietdauer.",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 556 Abs. 3 BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__556.html",
    wortlaut: "Die Abrechnung ist dem Mieter spätestens bis zum Ablauf des zwölften Monats nach Ende des Abrechnungszeitraums mitzuteilen.",
    annahme: "Abrechnungszeitraum = Kalenderjahr → Frist 31.12. des Folgejahres. Ein abweichender Abrechnungszeitraum wird nicht erkannt.",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 557a BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__557a.html",
    wortlaut: "Die Miete muss jeweils mindestens ein Jahr unverändert bleiben.",
    annahme: "Stufen aus dem eingetragenen Staffelplan; eine verstrichene Stufe ohne Miet-Zeitraum wird als Warnung gezeigt.",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 557b BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__557b.html",
    wortlaut: "Während der Geltung einer Indexmiete muss die Miete, von Erhöhungen nach den §§ 559 bis 560 abgesehen, jeweils mindestens ein Jahr unverändert bleiben.",
    annahme: "Anpassung frühestens ein Jahr nach der letzten; die Erklärung braucht Textform (§ 557b Abs. 3).",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 489 Abs. 1 Nr. 1 BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__489.html",
    wortlaut: "wenn die Sollzinsbindung vor der für die Rückzahlung bestimmten Zeit endet und keine neue Vereinbarung über den Sollzinssatz getroffen ist, unter Einhaltung einer Kündigungsfrist von einem Monat frühestens für den Ablauf des Tages, an dem die Sollzinsbindung endet",
    annahme: "Ende der Zinsbindung = eingetragenes Datum; ob das Darlehen dann noch nicht zurückzuzahlen ist und keine neue Zinsvereinbarung besteht, prüft MyImmo nicht.",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 489 Abs. 1 Nr. 2 BGB",
    url: "https://www.gesetze-im-internet.de/bgb/__489.html",
    wortlaut: "in jedem Fall nach Ablauf von zehn Jahren nach dem vollständigen Empfang unter Einhaltung einer Kündigungsfrist von sechs Monaten",
    annahme: "Vollständiger Empfang = eingetragenes Auszahlungsdatum; eine spätere neue Vereinbarung über Rückzahlung oder Zins (Satz 2) verschiebt den Beginn — die kennt MyImmo nicht.",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 149 Abs. 2 AO",
    url: "https://www.gesetze-im-internet.de/ao_1977/__149.html",
    wortlaut: "spätestens sieben Monate nach Ablauf des Kalenderjahres oder sieben Monate nach dem gesetzlich bestimmten Zeitpunkt abzugeben",
    annahme: "Ohne Steuerberater (mit Berater gilt § 149 Abs. 3). Fällt der 31.07. auf ein Wochenende oder einen bundesweiten Feiertag, endet die Frist am nächsten Werktag (§ 108 Abs. 3 AO).",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 28 GrStG",
    url: "https://www.gesetze-im-internet.de/grstg_1973/__28.html",
    wortlaut: "Die Grundsteuer wird zu je einem Viertel ihres Jahresbetrags am 15. Februar, 15. Mai, 15. August und 15. November fällig.",
    annahme: "Vierteljahresraten nach Abs. 1. Abweichungen kennt MyImmo nicht: Kleinbeträge nach Bestimmung der Gemeinde (Abs. 2) und Jahreszahlung am 1. Juli auf Antrag (Abs. 3).",
    geprueft: "2026-10-11",
  },
  {
    norm: "§ 79 Abs. 3 GModG",
    url: "https://www.gesetze-im-internet.de/geg/__79.html",
    wortlaut: "Ein Energieausweis ist für eine Gültigkeitsdauer von zehn Jahren auszustellen.",
    annahme: "Ausstellungsdatum = eingetragenes Datum. Ein neuer Ausweis nach § 80 Abs. 2 (wesentliche Änderung) beendet die Gültigkeit früher — das erkennt MyImmo nicht. Bis 28.07.2026 hieß das Gesetz GEG.",
    geprueft: "2026-10-11",
  },
];

/** Quelle zu einer Rechtsgrundlage (Präfix-Treffer, längste Norm zuerst). */
export function quelleZu(rechtsgrundlage: string | undefined): FristQuelle | null {
  if (!rechtsgrundlage) return null;
  return [...FRIST_QUELLEN].sort((a, b) => b.norm.length - a.norm.length).find((q) => rechtsgrundlage.startsWith(q.norm)) ?? null;
}
