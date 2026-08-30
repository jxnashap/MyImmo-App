// Ratgeber-Inhalte (SEO): strukturierte Artikel für private Vermieter, die auf
// die passenden MyImmo-Funktionen verweisen. Reiner Content, keine DB.
// Rechtsstand Juli 2026 — Anhaltspunkte ohne Gewähr, keine Steuer-/Rechtsberatung.

export type RatgeberSektion = { h?: string; p?: string[]; liste?: string[] };

export type RatgeberFeature = { titel: string; text: string; href: string; cta: string };

// Kurzcheck über dem Artikel: Wer ihn aufschlägt, soll in zehn Sekunden wissen,
// ob er hier richtig ist — statt neun Minuten zu lesen und am Ende zu merken,
// dass es um einen anderen Fall ging. Ein konkreter Beispielfall trägt das
// besser als eine abstrakte Zielgruppenbeschreibung: Man erkennt sich wieder
// oder eben nicht.
export type RatgeberKurzcheck = {
  /** Ein konkreter Fall in ein bis zwei Sätzen — zum Wiedererkennen. */
  fall: string;
  /** Woran der Leser merkt, dass der Artikel seinen Fall trifft. */
  passt: string[];
  /** Wann er sich das Lesen sparen kann — inklusive Verweis, wohin stattdessen. */
  nichtNoetig?: string;
};

/**
 * Rechtsstand der Ratgeber-Inhalte. Wird über jedem Artikel SICHTBAR
 * ausgewiesen — bei Steuer- und Mietrechtsthemen (YMYL) ist das kein
 * Beiwerk, sondern die Angabe, an der ein Leser erkennt, ob er sich auf den
 * Text noch verlassen kann.
 *
 * **Beim Überarbeiten von Inhalten mit hochsetzen** — und dann im jeweiligen
 * Artikel `aktualisiert` füllen (siehe dort).
 */
export const RECHTSSTAND = "Juli 2026";

export type RatgeberArtikel = {
  slug: string;
  titel: string;
  beschreibung: string; // Meta-Description / Teaser
  kategorie: "Nebenkosten" | "Steuer" | "Recht" | "Einstieg";
  datum: string;        // ISO — Erstveröffentlichung
  /**
   * NUR setzen, wenn der Artikel inhaltlich überarbeitet wurde — nicht bei
   * Tippfehlern, und schon gar nicht, „damit das Datum frisch aussieht".
   * Speist `dateModified` im Article-Markup: ein erfundenes Datum ist ein
   * Falschsignal an Google UND an den Leser, der glaubt, der Text sei
   * gegen die aktuelle Rechtslage geprüft worden.
   */
  aktualisiert?: string;
  /** Nur, wenn dieser Artikel einen anderen Rechtsstand hat als `RECHTSSTAND`. */
  rechtsstand?: string;
  lesezeit: number;     // Minuten
  kurzcheck?: RatgeberKurzcheck;
  intro: string;
  sektionen: RatgeberSektion[];
  feature?: RatgeberFeature; // interner Verweis auf eine MyImmo-Funktion
};

export const RATGEBER: RatgeberArtikel[] = [
  {
    slug: "nebenkostenabrechnung-erstellen-schritt-fuer-schritt",
    titel: "Nebenkostenabrechnung erstellen — Schritt für Schritt",
    beschreibung:
      "Von den Belegen bis zur fertigen Abrechnung: die vier Pflichtangaben, der richtige Umlageschlüssel, ein vollständiges Rechenbeispiel und die Fristen, an denen Abrechnungen scheitern.",
    kategorie: "Nebenkosten",
    datum: "2026-07-30",
    lesezeit: 9,
    kurzcheck: {
      fall:
        "Das Abrechnungsjahr ist um, der Mieter hat monatlich 200 € vorausgezahlt — und auf dem Tisch liegt ein Stapel Rechnungen, aus dem eine Abrechnung werden soll.",
      passt: [
        "Sie erstellen Ihre erste oder zweite Nebenkostenabrechnung und wollen die richtige Reihenfolge kennen.",
        "Sie rechnen seit Jahren ab, sind sich aber nie sicher, ob die Abrechnung formell hält.",
        "Ein Mieter hat Ihrer letzten Abrechnung widersprochen und Sie suchen die Stelle, an der es geklemmt hat.",
      ],
      nichtNoetig:
        "Sie wollen eine fremde Abrechnung prüfen statt selbst eine erstellen? Dann ist der Ratgeber zu Fristen und Fehlern der schnellere Einstieg.",
    },
    intro:
      "Die meisten Anleitungen erklären, was in einer Nebenkostenabrechnung falsch sein kann. Diese hier erklärt, wie Sie eine richtige erstellen — in sechs Schritten, mit einem durchgerechneten Beispiel für eine 80-m²-Wohnung in einem Haus mit 400 m². Wer diese Reihenfolge einhält, hat am Ende eine Abrechnung, die formell hält und inhaltlich nachvollziehbar ist.",
    sektionen: [
      {
        h: "Vorab: die vier Pflichtangaben",
        p: [
          "Bevor es ums Rechnen geht, muss klar sein, was am Ende auf dem Papier stehen muss. Der Bundesgerichtshof verlangt in ständiger Rechtsprechung vier Mindestangaben. Fehlt eine davon, ist die Abrechnung formell unwirksam — unabhängig davon, ob richtig gerechnet wurde.",
        ],
        liste: [
          "Eine Zusammenstellung der Gesamtkosten je Kostenart.",
          "Angabe und Erläuterung des jeweiligen Verteilerschlüssels.",
          "Die Berechnung des Anteils, der auf den Mieter entfällt.",
          "Der Abzug der geleisteten Vorauszahlungen.",
        ],
      },
      {
        h: "Schritt 1: Abrechnungszeitraum festlegen",
        p: [
          "Der Abrechnungszeitraum darf höchstens zwölf Monate umfassen. Üblich und am einfachsten ist das Kalenderjahr, weil sich Jahresrechnungen von Versorgern, Grundsteuerbescheid und Versicherungsbeiträge daran orientieren.",
          "Legen Sie den Zeitraum einmal fest und behalten Sie ihn bei. Ein Wechsel mitten im Mietverhältnis erzeugt Übergangsprobleme, die Sie sich sparen können.",
        ],
      },
      {
        h: "Schritt 2: Kosten sammeln — und aussortieren",
        p: [
          "Sammeln Sie alle Belege des Zeitraums und prüfen Sie jede Position auf zwei Fragen: Steht die Kostenart im Katalog der Betriebskostenverordnung (§ 2 BetrKV)? Und deckt der Mietvertrag die Umlage ab? Nur wenn beides zutrifft, darf die Position in die Abrechnung.",
          "Zusätzlich gilt das Wirtschaftlichkeitsgebot (§ 556 Abs. 3 Satz 1 BGB): Sie dürfen nur Kosten umlegen, die ein wirtschaftlich denkender Vermieter für vertretbar hält. Der teuerste Anbieter ohne Grund ist angreifbar.",
        ],
        liste: [
          "Umlagefähig: Grundsteuer, Wasser und Abwasser, Müllabfuhr, Gebäudeversicherung, Hausmeister, Allgemeinstrom, Aufzug, Gartenpflege, Straßenreinigung, Schornsteinfeger, Heizung und Warmwasser.",
          "Nicht umlagefähig: Verwaltungskosten, Reparaturen und Instandhaltung, Instandhaltungsrücklage, Kontoführung, Rechtsschutz- und Mietausfallversicherung.",
          "Häufig übersehen: Wartungskosten sind umlagefähig, die Reparatur derselben Anlage ist es nicht. Steht beides auf einer Rechnung, müssen Sie trennen.",
        ],
      },
      {
        h: "Schritt 3: Umlageschlüssel wählen",
        p: [
          "Haben Sie im Mietvertrag nichts anderes vereinbart, wird nach Wohnfläche umgelegt (§ 556a Abs. 1 BGB). Zulässig sind auch Personenzahl, Wohneinheiten oder erfasster Verbrauch — solange der Schlüssel vereinbart oder sachgerecht ist und Sie ihn nicht jedes Jahr wechseln.",
          "Heizung und Warmwasser sind die Ausnahme: Nach der Heizkostenverordnung müssen zwischen 50 und 70 Prozent verbrauchsabhängig abgerechnet werden, der Rest nach einem Flächenmaßstab. Die Wahl innerhalb dieser Spanne treffen Sie — üblich ist 70 zu 30.",
          "Erläutern Sie den Schlüssel in der Abrechnung mit einem Satz. „Verteilung nach Wohnfläche: 80 von 400 m²“ genügt und erfüllt zugleich die zweite Pflichtangabe.",
        ],
      },
      {
        h: "Schritt 4: Anteil berechnen — das Beispiel",
        p: [
          "Ausgangslage: Haus mit 400 m² Gesamtwohnfläche, die abzurechnende Wohnung hat 80 m² — das sind 20 Prozent. Die kalten Betriebskosten des Jahres betragen 6.400 €, Heizung und Warmwasser zusammen 4.800 €. Abgerechnet wird 70 zu 30.",
        ],
        liste: [
          "Kalte Betriebskosten: 6.400 € × 20 % = 1.280,00 €.",
          "Heizung, Verbrauchsanteil: 70 % von 4.800 € = 3.360 €. Gesamtverbrauch des Hauses 100.000 kWh, davon Wohnung 18.500 kWh = 18,5 % → 621,60 €.",
          "Heizung, Grundkosten: 30 % von 4.800 € = 1.440 € nach Fläche → 20 % = 288,00 €.",
          "Summe Heizung und Warmwasser: 909,60 €.",
          "Gesamtanteil des Mieters: 1.280,00 € + 909,60 € = 2.189,60 €.",
        ],
      },
      {
        h: "Schritt 5: Vorauszahlungen abziehen",
        p: [
          "Der Mieter hat monatlich 200 € vorausgezahlt, im Jahr also 2.400 €. Gegenüber dem Anteil von 2.189,60 € ergibt das ein Guthaben von 210,40 € zugunsten des Mieters.",
          "Zieht ein Mieter unterjährig ein oder aus, wird nicht geschätzt, sondern tagegenau nach Belegungszeit aufgeteilt. Bei verbrauchsabhängigen Positionen ist eine Zwischenablesung der sauberere Weg; ohne sie greift die Gradtagszahlen-Methode der Heizkostenverordnung.",
          "Prüfen Sie zum Schluss, ob die Vorauszahlung für das laufende Jahr noch passt. Eine Anpassung ist nach § 560 Abs. 4 BGB zulässig, aber nur auf Grundlage einer wirksamen Abrechnung und nur in angemessener Höhe.",
        ],
      },
      {
        h: "Schritt 6: Zustellen — und die Fristen einhalten",
        p: [
          "Die Abrechnung muss dem Mieter spätestens zum Ablauf des zwölften Monats nach Ende des Abrechnungszeitraums zugehen (§ 556 Abs. 3 Satz 2 BGB). Für 2025 heißt das: bis zum 31.12.2026 zugegangen — nicht abgeschickt. Danach können Sie keine Nachzahlung mehr verlangen; ein Guthaben müssen Sie trotzdem auszahlen.",
          "Eine Nachzahlung wird mit Zugang der Abrechnung fällig. In der Praxis setzt man dem Mieter eine Zahlungsfrist von etwa 30 Tagen — das ist kulant, üblich und vermeidet Streit über den Verzugsbeginn.",
          "Der Mieter kann bis zum Ablauf des zwölften Monats nach Zugang Einwendungen erheben (§ 556 Abs. 3 Satz 5 BGB); danach sind sie ausgeschlossen, sofern er die Verspätung zu vertreten hat. Auf Verlangen müssen Sie Belegeinsicht gewähren.",
        ],
      },
      {
        h: "Die fünf Fehler, an denen Abrechnungen scheitern",
        liste: [
          "Zu spät zugegangen — der häufigste und teuerste Fehler, weil er den ganzen Anspruch kostet.",
          "Nicht umlagefähige Positionen enthalten, allen voran Verwaltungskosten und Reparaturen.",
          "Verteilerschlüssel nicht genannt oder nicht erläutert — eine der vier Pflichtangaben.",
          "Heizkosten vollständig nach Fläche verteilt, statt 50 bis 70 Prozent nach Verbrauch. Der Mieter darf dann um 15 Prozent kürzen (§ 12 HeizkostenV).",
          "Mieterwechsel pauschal halbiert statt tagegenau gerechnet.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Dieser Text gibt Anhaltspunkte ohne Gewähr und ersetzt keine Rechts- oder Steuerberatung. Bei strittigen Positionen oder ungewöhnlichen Vertragsklauseln lohnt der Gang zum Fachanwalt für Mietrecht oder zum Vermieterverein.",
        ],
      },
    ],
    feature: {
      titel: "Die Abrechnung in MyImmo erstellen",
      text:
        "Der Umlage-Assistent führt genau durch diese sechs Schritte: Kosten erfassen, Schlüssel je Position wählen, Mieterwechsel tagegenau abrechnen, Vorauszahlungen abziehen. Am Ende steht eine fertige PDF-Abrechnung mit ausgewiesenem Rechenweg, Verteilerschlüssel und § 35a-Ausweis für Ihre Mieter — die vier Pflichtangaben sind dabei fest eingebaut.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "umlageschluessel-flaeche-personen-verbrauch",
    titel: "Umlageschlüssel: Fläche, Personen, Verbrauch — was wann gilt",
    beschreibung:
      "Welcher Verteilerschlüssel für welche Kostenart zulässig ist, wann Sie ihn wechseln dürfen und warum dieselbe Rechnung je nach Schlüssel 240 € oder 400 € ergibt.",
    kategorie: "Nebenkosten",
    datum: "2026-07-30",
    lesezeit: 7,
    kurzcheck: {
      fall:
        "Vier Wohnungen, 1.200 € Müllgebühren im Jahr — und die Frage, ob die vierköpfige Familie mehr zahlen muss als der Single in der gleich großen Wohnung.",
      passt: [
        "Ihr Mietvertrag sagt zum Verteilerschlüssel nichts oder nur den Satz nach Wohnfläche.",
        "Sie wollen einen Schlüssel wechseln und wissen nicht, ob Sie das einseitig dürfen.",
        "Sie haben Leerstand im Haus oder eine Gewerbeeinheit im Erdgeschoss.",
      ],
      nichtNoetig:
        "Geht es nur um Heizung und Warmwasser? Für die gilt eine eigene Verordnung — dazu der Heizkosten-Ratgeber.",
    },
    intro:
      "Der Umlageschlüssel entscheidet darüber, wer wie viel zahlt — und er ist einer der vier Punkte, die in jeder Abrechnung genannt und erläutert werden müssen. Dieser Ratgeber zeigt, welcher Schlüssel wann gilt, wann Sie ihn wechseln dürfen und wie stark die Wahl das Ergebnis verschiebt.",
    sektionen: [
      {
        h: "Die Grundregel: Wohnfläche, wenn nichts anderes vereinbart ist",
        p: [
          "Enthält der Mietvertrag keine Regelung, werden Betriebskosten nach dem Anteil der Wohnfläche umgelegt (§ 556a Abs. 1 Satz 1 BGB). Das ist der gesetzliche Auffangmaßstab — und in der Praxis der häufigste.",
          "Eine wirksame vertragliche Vereinbarung geht vor. Prüfen Sie deshalb immer zuerst den Mietvertrag: Steht dort ein Schlüssel, ist er anzuwenden, auch wenn Sie einen anderen für gerechter hielten.",
          "Für Kosten, die vom erfassten Verbrauch oder von der Verursachung abhängen, gilt eine Ausnahme: Sie sind nach diesem Maßstab umzulegen (§ 556a Abs. 1 Satz 2 BGB). Wo Wasserzähler hängen, wird also nach Zählerstand abgerechnet, nicht nach Fläche.",
        ],
      },
      {
        h: "Die vier gängigen Schlüssel im Vergleich",
        liste: [
          "Wohnfläche — gesetzlicher Regelfall, unstrittig, ohne Pflege. Passt für Grundsteuer, Gebäudeversicherung, Gartenpflege, Allgemeinstrom.",
          "Wohneinheit — einfach, aber grob: Die 40-m²-Wohnung zahlt so viel wie die 120-m²-Wohnung. Vertretbar nur bei etwa gleich großen Einheiten.",
          "Personenzahl — nah an der Verursachung bei Müll und Wasser, aber pflegeintensiv: Sie müssen unterjährige Änderungen erfassen und nachweisen können.",
          "Erfasster Verbrauch — der gerechteste Maßstab, aber nur mit funktionierender Messtechnik. Bei Heizung und Warmwasser ohnehin zwingend.",
        ],
      },
      {
        h: "Was der Schlüssel ausmacht — ein Beispiel",
        p: [
          "Haus mit vier Wohnungen, 400 m² Gesamtfläche, 9 Bewohner. Die abzurechnende Wohnung hat 80 m² und 3 Bewohner. Umzulegen sind 1.200 € Müllgebühren.",
        ],
        liste: [
          "Nach Fläche: 80 von 400 m² = 20 % → 240,00 €.",
          "Nach Wohneinheit: 1 von 4 = 25 % → 300,00 €.",
          "Nach Personenzahl: 3 von 9 = 33,3 % → 400,00 €.",
        ],
      },
      {
        h: "Schlüssel wechseln — wann das geht",
        p: [
          "Ein einmal angewandter Schlüssel darf nicht beliebig getauscht werden. Wer jedes Jahr neu wählt, verliert die Nachvollziehbarkeit und macht die Abrechnung angreifbar.",
          "Eine ausdrückliche Ausnahme sieht das Gesetz für den Wechsel zur Verbrauchserfassung vor: Sie dürfen durch Erklärung in Textform bestimmen, dass künftig nach erfasstem Verbrauch abgerechnet wird — die Erklärung muss dem Mieter vor Beginn des Abrechnungszeitraums zugehen (§ 556a Abs. 2 BGB).",
          "Ein Wechsel weg vom Verbrauch, hin zu einem pauschaleren Maßstab, ist ohne Zustimmung des Mieters dagegen nicht möglich.",
        ],
      },
      {
        h: "Typische Streitpunkte",
        liste: [
          "Leerstand geht zu Ihren Lasten. Den auf leerstehende Wohnungen entfallenden Anteil tragen Sie selbst — er darf nicht auf die übrigen Mieter verteilt werden.",
          "Aufzugskosten dürfen in der Regel auch auf Erdgeschossmieter umgelegt werden, wenn der Vertrag das vorsieht. Ohne Vereinbarung ist es angreifbar.",
          "Bei der Personenzahl brauchen Sie einen Stichtag oder eine zeitanteilige Berechnung — und Sie müssen die Zahlen belegen können, ohne fremde Meldedaten offenzulegen.",
          "Gemischt genutzte Häuser mit Gewerbeeinheiten: Verursacht das Gewerbe erheblich höhere Kosten, ist ein Vorwegabzug nötig, sonst ist die Abrechnung angreifbar.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Bei ungewöhnlichen Vertragsklauseln oder gemischt genutzten Objekten lohnt die anwaltliche Prüfung.",
        ],
      },
    ],
    feature: {
      titel: "Schlüssel je Position wählen",
      text:
        "In MyImmo legen Sie den Verteilerschlüssel nicht für die ganze Abrechnung fest, sondern für jede Kostenart einzeln — Grundsteuer nach Fläche, Müll nach Personen, Wasser nach Zähler. Der gewählte Schlüssel wird in der fertigen Abrechnung automatisch genannt und erläutert.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "heizkostenabrechnung-50-70-regel-fernablesung",
    titel: "Heizkostenabrechnung: die 50–70-%-Regel — und die Frist zum 31.12.2026",
    beschreibung:
      "Wie Heiz- und Warmwasserkosten nach der Heizkostenverordnung verteilt werden, wann 70 % zwingend sind, und warum die Fernablesepflicht zum 31.12.2026 jeden Vermieter betrifft.",
    kategorie: "Nebenkosten",
    datum: "2026-07-30",
    lesezeit: 8,
    kurzcheck: {
      fall:
        "Die Abrechnung des Messdienstes liegt vor, 6.000 € Heizkosten fürs Haus — und der Mieter fragt, warum er trotz sparsamen Heizens fast so viel zahlt wie im Vorjahr.",
      passt: [
        "Sie verteilen Heizkosten bisher ganz oder überwiegend nach Wohnfläche.",
        "Sie wissen nicht, ob Ihre Zähler bis zum 31.12.2026 fernablesbar sein müssen.",
        "Ein Mieter ist unterjährig ein- oder ausgezogen.",
        "Sie bewohnen selbst eine Wohnung in einem Zweifamilienhaus — dann könnte eine Ausnahme greifen.",
      ],
      nichtNoetig:
        "Sind Heizung und Warmwasser bei Ihnen in der Miete enthalten und Sie rechnen gar nicht ab, betrifft Sie praktisch nur der Abschnitt zur Fernablesepflicht.",
    },
    intro:
      "Heizung und Warmwasser sind der größte Posten der Nebenkostenabrechnung und der einzige, für den eine eigene Verordnung gilt. Wer hier pauschal nach Fläche verteilt, verschenkt 15 Prozent. Und zum 31.12.2026 läuft eine Frist ab, die viele Vermieter noch nicht auf dem Schirm haben.",
    sektionen: [
      {
        h: "Die Grundregel: 50 bis 70 Prozent nach Verbrauch",
        p: [
          "Die Heizkostenverordnung verlangt, dass mindestens 50 und höchstens 70 Prozent der Heizkosten nach erfasstem Verbrauch verteilt werden (§ 7 Abs. 1 HeizkostenV). Der Rest — die Grundkosten — wird nach Wohnfläche oder umbautem Raum umgelegt.",
          "Die Grundkosten sind kein Zugeständnis an die Bequemlichkeit, sondern sachlich begründet: Leitungsverluste, Bereitschaftswärme und die Lage der Wohnung im Gebäude hängen nicht vom Heizverhalten ab.",
          "Für Warmwasser gilt dieselbe Spanne (§ 8 HeizkostenV). Sind Heizung und Warmwasser über eine verbundene Anlage versorgt, müssen die Kosten zuerst rechnerisch getrennt werden — seit 2014 ist bei Neuinstallationen dafür ein Wärmemengenzähler vorgeschrieben.",
        ],
      },
      {
        h: "Wann 70 Prozent zwingend sind",
        p: [
          "In Gebäuden, in denen die freiliegenden Leitungen der Wärmeverteilung überwiegend gedämmt sind, müssen mindestens 70 Prozent nach Verbrauch verteilt werden (§ 7 Abs. 1 Satz 2 HeizkostenV). Das betrifft in der Praxis die meisten Bestandsgebäude mit nachgerüsteter Dämmung.",
          "Prüfen Sie das einmal für Ihr Objekt und halten Sie das Ergebnis fest. Die Wahl innerhalb der Spanne ist Ihre Entscheidung, aber sie muss zum Gebäude passen und sollte nicht jedes Jahr wechseln.",
        ],
      },
      {
        h: "Das Rechenbeispiel",
        p: [
          "Gesamtkosten Heizung 6.000 €, Gebäude 400 m², Wohnung 80 m² (20 %). Abgerechnet wird 70 zu 30. Gesamtverbrauch des Hauses 120.000 Einheiten, davon Wohnung 21.600 Einheiten (18 %).",
        ],
        liste: [
          "Verbrauchsanteil: 70 % von 6.000 € = 4.200 € × 18 % = 756,00 €.",
          "Grundkosten: 30 % von 6.000 € = 1.800 € × 20 % = 360,00 €.",
          "Anteil des Mieters: 1.116,00 €.",
          "Zum Vergleich: Rein nach Fläche wären es 1.200,00 € — der sparsame Mieter zahlt hier 84 € weniger, und genau das ist der Zweck der Verordnung.",
        ],
      },
      {
        h: "Das 15-Prozent-Kürzungsrecht",
        p: [
          "Rechnen Sie nicht verbrauchsabhängig ab, obwohl Sie es müssten, darf der Mieter seinen Anteil um 15 Prozent kürzen (§ 12 Abs. 1 HeizkostenV). Im Beispiel oben wären das rund 167 € — pro Wohnung und pro Jahr.",
          "Das Kürzungsrecht greift unabhängig davon, ob Sie den Fehler bemerkt haben oder ob die Abrechnung sonst korrekt ist. Es ist der teuerste vermeidbare Fehler der ganzen Nebenkostenabrechnung.",
        ],
      },
      {
        h: "Frist 31.12.2026: fernablesbare Zähler",
        p: [
          "Bis zum 31. Dezember 2026 müssen Zähler und Heizkostenverteiler fernablesbar sein — Geräte, die nicht fernablesbar sind, müssen bis dahin nachgerüstet oder ersetzt werden (§ 5 HeizkostenV). Das ist keine Empfehlung, sondern eine Pflicht mit ablaufender Frist.",
          "Für fernablesbare Geräte kommt eine zweite Pflicht hinzu: die monatliche Verbrauchsinformation an die Nutzer, mit Vergleich zum Vormonat, zum Vorjahresmonat und zu einem Durchschnittsnutzer (§ 6a HeizkostenV).",
          "Beides ist mit einem Kürzungsrecht bewehrt: Fehlt die fernablesbare Ausstattung, darf der Mieter um 3 Prozent kürzen; bleibt die monatliche Information aus, noch einmal um 3 Prozent. Zusammen mit den 15 Prozent aus nicht verbrauchsabhängiger Abrechnung summiert sich das schnell.",
          "Wenn Sie einen Messdienstleister beauftragt haben, klären Sie jetzt schriftlich, ob Ihr Bestand zum Stichtag umgestellt ist. Der Termin fällt bei vielen Anbietern mit dem Jahresende zusammen — kurzfristige Termine werden knapp.",
        ],
      },
      {
        h: "Mieterwechsel und Ausnahmen",
        p: [
          "Zieht ein Mieter unterjährig aus, ist eine Zwischenablesung der saubere Weg. Ist sie nicht möglich, werden die Kosten nach den Gradtagszahlen der Verordnung aufgeteilt — nicht einfach hälftig (§ 9b HeizkostenV). Die Kosten der Zwischenablesung trägt in der Regel der ausziehende Mieter.",
          "Von der verbrauchsabhängigen Abrechnung ausgenommen sind unter anderem Zweifamilienhäuser, von denen der Vermieter eine Wohnung selbst bewohnt, sowie bestimmte Passivhäuser und Gebäude mit überwiegend erneuerbarer Wärmeversorgung (§ 11 HeizkostenV). Prüfen Sie, ob Ihr Objekt darunterfällt — die Ausnahme ist eng.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Ob Ihr Gebäude unter die 70-Prozent-Regel oder unter eine Ausnahme fällt, klären Sie im Zweifel mit Ihrem Messdienstleister oder anwaltlich.",
        ],
      },
    ],
    feature: {
      titel: "Heizkosten in MyImmo",
      text:
        "Verbrauchswerte je Einheit erfassen, die Spanne zwischen 50 und 70 Prozent einmal festlegen, den Rest nach Fläche verteilen — die Aufteilung übernimmt der Umlage-Assistent, inklusive tagegenauer Abrechnung bei Mieterwechsel. Der Rechenweg steht in der fertigen PDF-Abrechnung.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "belegeinsicht-was-mieter-verlangen-duerfen",
    titel: "Belegeinsicht: was Mieter verlangen dürfen — und was nicht",
    beschreibung:
      "Originalbelege statt Kopien, Einsicht am Ort der Verwaltung, Zurückbehaltungsrecht bei Verweigerung: die Regeln der Belegeinsicht und der einfachste Weg, Streit zu vermeiden.",
    kategorie: "Nebenkosten",
    datum: "2026-07-30",
    lesezeit: 6,
    kurzcheck: {
      fall:
        "Zwei Wochen nach der Abrechnung schreibt der Mieter, er wolle sämtliche Belege sehen — und zwar als Kopie per Post.",
      passt: [
        "Ein Mieter hat Belegeinsicht verlangt und Sie wissen nicht, was Sie schulden.",
        "Der Mieter wohnt weit entfernt oder ist bereits ausgezogen.",
        "Sie überlegen, ob Sie die Nachzahlung anmahnen können, solange die Einsicht offen ist.",
      ],
      nichtNoetig:
        "Sie müssen die Abrechnung erst noch erstellen? Dann zuerst der Schritt-für-Schritt-Ratgeber.",
    },
    intro:
      "Nach fast jeder Nachzahlung kommt die Frage nach den Belegen. Wer dann falsch reagiert — pauschal ablehnt oder ungefragt alles verschickt — macht sich das Leben schwerer als nötig. Die Rechtslage ist übersichtlicher, als die meisten annehmen.",
    sektionen: [
      {
        h: "Der Anspruch und seine Grenzen",
        p: [
          "Das Einsichtsrecht folgt aus dem Anspruch auf Rechenschaftslegung (§ 259 BGB). Der Mieter darf die Belege einsehen, auf denen die Abrechnung beruht — Rechnungen, Verträge, Zahlungsnachweise, Ableseprotokolle, den Grundsteuerbescheid, die Versicherungspolice.",
          "Geschuldet ist Einsicht in die Originalunterlagen, und zwar grundsätzlich dort, wo sie verwahrt werden: bei Ihnen oder bei der Hausverwaltung. Der Mieter darf sich Notizen machen, fotografieren und auf eigene Kosten Kopien anfertigen.",
          "Einen allgemeinen Anspruch auf Zusendung von Kopien gibt es dagegen nicht. Wo die Einsicht vor Ort zumutbar ist, genügt das Angebot dazu.",
        ],
      },
      {
        h: "Die Ausnahme: zu weit weg",
        p: [
          "Zumutbar ist die Anreise nicht immer. Wohnt der Mieter oder die Verwaltung so weit entfernt, dass die Fahrt außer Verhältnis steht, kann der Mieter die Übersendung von Kopien verlangen — die Kosten dafür trägt in der Regel er.",
          "Eine feste Kilometergrenze gibt es nicht; die Gerichte entscheiden nach den Umständen. Praktisch heißt das: Streiten Sie nicht über die Grenze, sondern bieten Sie eine Lösung an.",
        ],
      },
      {
        h: "Was passiert, wenn Sie die Einsicht verweigern",
        p: [
          "Verweigern Sie die Einsicht, kann der Mieter die Zahlung der Nachforderung zurückhalten (§ 273 BGB). Der Anspruch verschwindet dadurch nicht, aber er ist bis zur Einsichtsgewährung nicht durchsetzbar — Sie verlieren Zeit und im Streitfall die Kosten.",
          "Umgekehrt gilt: Wer die Einsicht angeboten hat und der Mieter nimmt sie nicht wahr, steht gut da. Dokumentieren Sie das Angebot mit Datum und Terminvorschlag.",
        ],
      },
      {
        h: "Datenschutz nicht vergessen",
        p: [
          "Belege enthalten oft personenbezogene Daten Dritter — Namen anderer Mieter auf Ableselisten, Kontonummern auf Zahlungsnachweisen, Angaben zu Handwerkern. Diese Daten gehen den einsehenden Mieter nichts an und sollten vor der Einsicht unkenntlich gemacht werden.",
          "Das gilt besonders, wenn Sie Kopien oder Scans herausgeben: Was einmal verschickt ist, holen Sie nicht zurück.",
        ],
      },
      {
        h: "Der praktische Weg",
        liste: [
          "Auf die erste Anfrage sofort einen Termin anbieten — mit Datum, Ort und dem Hinweis, dass fotografiert werden darf.",
          "Belege nach Kostenart sortiert bereitlegen, in derselben Reihenfolge wie in der Abrechnung.",
          "Personenbezogene Daten Dritter vorher schwärzen.",
          "Digital anbieten, wo es geht: Ein Ordner mit gescannten Belegen erledigt die meisten Anfragen ohne Termin — freiwillig, aber deeskalierend.",
          "Die Einwendungsfrist des Mieters läuft zwölf Monate ab Zugang der Abrechnung. Bis dahin sollten die Belege greifbar bleiben.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Die Rechtsprechung zur Zumutbarkeit der Anreise ist einzelfallabhängig.",
        ],
      },
    ],
    feature: {
      titel: "Belege digital bereitstellen",
      text:
        "Jeder Beleg wird in MyImmo direkt an der Kostenposition abgelegt und bleibt der Abrechnung zugeordnet. Fragt ein Mieter nach, ist die Einsicht eine Sache von Minuten statt eines Aktenordner-Nachmittags.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "erste-vermietung-zehn-schritte",
    titel: "Erste Vermietung: die 10 Schritte",
    beschreibung:
      "Von der Mietpreisfindung bis zum Fristenkalender — was beim ersten Mietverhältnis in welcher Reihenfolge zu tun ist, mit den Pflichten, die man leicht übersieht.",
    kategorie: "Einstieg",
    datum: "2026-07-30",
    lesezeit: 9,
    kurzcheck: {
      fall:
        "Die Wohnung ist frei, das Inserat steht, drei Bewerber haben sich gemeldet — und Sie haben noch nie einen Mietvertrag geschlossen.",
      passt: [
        "Sie vermieten zum ersten Mal.",
        "Sie haben eine leere Wohnung gekauft oder geerbt und suchen jetzt Mieter.",
        "Sie sind unsicher, welche Pflichten mit dem Einzug beginnen.",
      ],
      nichtNoetig:
        "Übernehmen Sie ein laufendes Mietverhältnis, ändert sich am Vertrag zunächst nichts — dann passt der Ratgeber zum Mietvertrag besser.",
    },
    intro:
      "Die erste Vermietung ist keine Frage der Begabung, sondern der Reihenfolge. Wer die zehn Schritte in dieser Abfolge abarbeitet, hat am Ende ein Mietverhältnis, das trägt — und keine Nachfrage vom Ordnungsamt, weil eine Zwei-Wochen-Frist übersehen wurde.",
    sektionen: [
      {
        h: "1. Die Miete bestimmen",
        p: [
          "Grundlage ist die ortsübliche Vergleichsmiete: Mietspiegel der Gemeinde, Mietdatenbank oder vergleichbare Wohnungen. Schätzen Sie nicht — die Zahl brauchen Sie später bei jeder Mieterhöhung wieder.",
          "In Gebieten mit angespanntem Wohnungsmarkt gilt die Mietpreisbremse (§§ 556d ff. BGB): Die Miete darf die ortsübliche Vergleichsmiete um höchstens 10 Prozent übersteigen. Ob Ihr Ort betroffen ist, regelt eine Verordnung des Bundeslandes. Wollen Sie sich auf eine Ausnahme berufen — etwa die höhere Vormiete oder eine umfassende Modernisierung —, müssen Sie den Mieter darüber unaufgefordert vor Vertragsschluss informieren (§ 556g Abs. 1a BGB).",
        ],
      },
      {
        h: "2. Bewerber auswählen",
        p: [
          "Zulässig sind Fragen nach Einkommen, Beruf, Zahl der einziehenden Personen und bestehenden Mietschulden. Unzulässig sind Fragen nach Familienplanung, Religion, Parteizugehörigkeit oder Vorstrafen ohne Bezug zum Mietverhältnis — falsche Antworten darauf berechtigen später auch nicht zur Anfechtung.",
          "Eine Bonitätsauskunft ist üblich, sollte aber erst in der engeren Auswahl verlangt werden, nicht von jedem Besichtigungsgast. Das ist auch datenschutzrechtlich der saubere Weg: Unterlagen abgelehnter Bewerber vernichten Sie zeitnah.",
        ],
      },
      {
        h: "3. Den Mietvertrag aufsetzen",
        p: [
          "Ein Mietvertrag über mehr als ein Jahr bedarf der Schriftform (§ 550 BGB). Wird sie nicht gewahrt, gilt der Vertrag als auf unbestimmte Zeit geschlossen und ist ordentlich kündbar — ein Fehler, der die ganze Laufzeitplanung kippt.",
          "Benutzen Sie ein aktuelles Formular. Alte Vorlagen aus dem Internet enthalten regelmäßig Klauseln, die der Bundesgerichtshof längst kassiert hat.",
        ],
      },
      {
        h: "4. Die Kaution richtig vereinbaren",
        p: [
          "Die Kaution beträgt höchstens drei Nettokaltmieten, also ohne Betriebskosten (§ 551 Abs. 1 BGB). Der Mieter darf sie in drei gleichen Monatsraten zahlen; die erste Rate ist zu Beginn des Mietverhältnisses fällig.",
          "Sie müssen die Kaution getrennt von Ihrem Vermögen anlegen (§ 551 Abs. 3 BGB) — insolvenzfest, verzinst, und die Zinsen stehen dem Mieter zu. Ein eigenes Kautionskonto ist der einfachste Weg, das nachzuweisen.",
        ],
      },
      {
        h: "5. Betriebskosten ausdrücklich vereinbaren",
        p: [
          "Ohne eine wirksame Umlagevereinbarung im Mietvertrag sind sämtliche Betriebskosten mit der Miete abgegolten — Sie können dann nichts abrechnen. Das ist einer der teuersten Anfängerfehler überhaupt.",
          "Nehmen Sie einen Verweis auf die Betriebskostenverordnung auf und benennen Sie „sonstige Betriebskosten“ einzeln. Ein pauschaler Sammelposten ohne Aufzählung ist unwirksam.",
        ],
      },
      {
        h: "6. Übergabeprotokoll und Zählerstände",
        p: [
          "Das Protokoll ist gesetzlich nicht vorgeschrieben, aber es entscheidet später über die Beweislast. Halten Sie den Zustand jedes Raumes fest, machen Sie Fotos, notieren Sie alle Zählerstände und die Zahl der übergebenen Schlüssel. Beide Seiten unterschreiben.",
        ],
      },
      {
        h: "7. Wohnungsgeberbestätigung — die Zwei-Wochen-Falle",
        p: [
          "Als Vermieter müssen Sie dem Mieter den Einzug schriftlich bestätigen, damit er sich anmelden kann (§ 19 BMG). Die Bestätigung ist innerhalb von zwei Wochen nach dem Einzug auszustellen.",
          "Wer das versäumt oder gar eine Scheinanmeldung bestätigt, begeht eine Ordnungswidrigkeit. Das ist die Pflicht, die Erstvermieter am häufigsten übersehen — sie steht in keinem Mietvertragsformular.",
        ],
      },
      {
        h: "8. Versicherungen prüfen",
        liste: [
          "Wohngebäudeversicherung — umlagefähig, deckt Feuer, Leitungswasser, Sturm.",
          "Haus- und Grundbesitzerhaftpflicht — greift, wenn jemand auf Ihrem Grundstück zu Schaden kommt; ebenfalls umlagefähig.",
          "Optional: Mietausfall- oder Rechtsschutzversicherung — nicht umlagefähig, Kosten tragen Sie selbst.",
        ],
      },
      {
        h: "9. Die Steuer von Anfang an aufsetzen",
        p: [
          "Mieteinnahmen gehören in die Anlage V der Einkommensteuererklärung. Absetzbar sind unter anderem Abschreibung, Schuldzinsen, Grundsteuer, Versicherungen, Verwaltung, Instandhaltung und Fahrtkosten.",
          "Zwei Dinge sollten Sie im ersten Jahr klären: die Aufteilung des Kaufpreises in Grund und Boden und Gebäude — nur der Gebäudeanteil wird abgeschrieben — und die 15-Prozent-Grenze für anschaffungsnahe Herstellungskosten in den ersten drei Jahren.",
          "Legen Sie von Beginn an jeden Beleg ab. Was im ersten Jahr nicht erfasst wird, ist am Jahresende praktisch nicht mehr rekonstruierbar.",
        ],
      },
      {
        h: "10. Den Fristenkalender anlegen",
        liste: [
          "Nebenkostenabrechnung: Zugang beim Mieter binnen zwölf Monaten nach Ende des Abrechnungszeitraums (§ 556 Abs. 3 BGB).",
          "Mieterhöhung auf die ortsübliche Vergleichsmiete: frühestens 15 Monate nach Einzug oder der letzten Erhöhung, mit Zustimmungsfrist.",
          "Wartungen und Prüfungen: Heizung, Rauchwarnmelder, Schornsteinfeger, Trinkwasser.",
          "Kautionsrückzahlung nach Auszug — mit angemessener Abrechnungsfrist.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Ob die Mietpreisbremse für Ihren Ort gilt, ergibt sich aus der jeweiligen Landesverordnung.",
        ],
      },
    ],
    feature: {
      titel: "Das erste Mietverhältnis in MyImmo",
      text:
        "Objekt anlegen, Mieter erfassen, Kaution und Betriebskosten hinterlegen — die Fristen für Abrechnung, Mieterhöhung und Wartung trägt MyImmo danach selbst nach und meldet sich rechtzeitig. Am Jahresende steht die Anlage V fast von allein.",
      href: "/anmelden",
      cta: "Kostenlos starten",
    },
  },
  {
    slug: "mietvertrag-pruefen-klauseln-kleinvermieter",
    titel: "Mietvertrag prüfen: die Klauseln, die Kleinvermieter Geld kosten",
    beschreibung:
      "Schönheitsreparaturen, Kleinreparaturen, Betriebskosten, Schriftform: die Klauseln, die in alten Vorlagen stehen und vor Gericht ersatzlos wegfallen.",
    kategorie: "Recht",
    datum: "2026-07-30",
    lesezeit: 8,
    kurzcheck: {
      fall:
        "Der Mieter zieht aus, die Wände sind bunt, Sie verweisen auf die Renovierungsklausel im Vertrag von 2009 — und der Mieter antwortet, die sei unwirksam.",
      passt: [
        "Ihr Mietvertrag stammt aus einer Vorlage oder ist einige Jahre alt.",
        "Sie haben eine Wohnung mit laufendem Mietvertrag gekauft oder geerbt.",
        "Sie wollen wissen, ob Sie sich auf eine bestimmte Klausel überhaupt berufen können.",
      ],
      nichtNoetig:
        "Sie setzen gerade einen neuen Vertrag auf? Dann ist der Ratgeber zur ersten Vermietung der Einstieg — dieser zeigt, was darin nicht stehen sollte.",
    },
    intro:
      "Mietverträge werden selten neu geschrieben. Sie werden kopiert — vom Vormieter, aus dem Internet, aus dem Ordner des Erblassers. Genau deshalb stehen in vielen Verträgen Klauseln, die der Bundesgerichtshof vor Jahren kassiert hat. Das Tückische daran: Der Vertrag sieht vollständig aus, und die Lücke zeigt sich erst, wenn Sie sich auf die Klausel berufen wollen.",
    sektionen: [
      {
        h: "Die Grundregel des AGB-Rechts",
        p: [
          "Ein vorformulierter Mietvertrag ist eine Allgemeine Geschäftsbedingung. Ist eine Klausel unwirksam, fällt sie ersatzlos weg — sie wird nicht auf das gerade noch Zulässige zurückgestutzt. Eine zu weit gefasste Klausel ist deshalb schlechter als eine maßvolle.",
          "Eine salvatorische Klausel („Sollte eine Bestimmung unwirksam sein…“) ändert daran nichts. Sie ist gegenüber Verbrauchern selbst unwirksam.",
        ],
      },
      {
        h: "Schönheitsreparaturen",
        p: [
          "Wurde die Wohnung unrenoviert oder renovierungsbedürftig übergeben, ist die Abwälzung der Schönheitsreparaturen auf den Mieter grundsätzlich unwirksam — es sei denn, der Mieter erhält dafür einen angemessenen Ausgleich. Das ist gefestigte Rechtsprechung seit 2015.",
          "Ebenfalls unwirksam sind starre Fristenpläne („alle drei Jahre Küche, alle fünf Jahre Wohnräume“), Endrenovierungsklauseln unabhängig vom Zustand und Vorgaben zur Farbwahl während der Mietzeit.",
          "Zulässig bleiben weiche Fristen, die auf den tatsächlichen Zustand abstellen — und nur bei renoviert übergebener Wohnung.",
        ],
      },
      {
        h: "Kleinreparaturen",
        p: [
          "Eine Kleinreparaturklausel hält nur, wenn sie zwei Grenzen nennt: einen Höchstbetrag je einzelner Reparatur und eine Jahresobergrenze für alle Kleinreparaturen zusammen. Fehlt eine der beiden oder ist sie zu hoch angesetzt, fällt die ganze Klausel weg.",
          "Die Rechtsprechung akzeptiert je nach Gericht und Zeitpunkt etwa 100 bis 150 € je Reparatur; die Jahresobergrenze liegt üblicherweise bei rund 8 Prozent der Jahresnettokaltmiete. Setzen Sie sich nicht an die Obergrenze — die Ersparnis ist gering, das Risiko trägt der ganze Absatz.",
          "Erfasst sind nur Teile, die dem häufigen und direkten Zugriff des Mieters unterliegen: Armaturen, Schalter, Verschlüsse, Rollladengurte. Die Reparatur der Heizungsanlage gehört nicht dazu. Und: Der Mieter schuldet nur die Kostenbeteiligung, nicht die Beauftragung des Handwerkers.",
        ],
      },
      {
        h: "Betriebskosten",
        p: [
          "Ohne wirksame Umlagevereinbarung sind alle Betriebskosten mit der Miete abgegolten. Der Vertrag muss die Umlage anordnen und die Kostenarten hinreichend bestimmt bezeichnen — üblicherweise durch Verweis auf die Betriebskostenverordnung.",
          "Der Auffangposten „sonstige Betriebskosten“ ist nur wirksam, wenn die darunter fallenden Kosten einzeln aufgezählt sind. Ein unbenannter Sammelposten läuft leer; was dort hineingerechnet wird, können Sie nicht abrechnen.",
        ],
      },
      {
        h: "Weitere Klauseln, die häufig kippen",
        liste: [
          "Generelles Tierhaltungsverbot — unwirksam. Zulässig ist ein Zustimmungsvorbehalt für Hunde und Katzen; Kleintiere sind immer erlaubt.",
          "Kündigungsverzicht über mehr als vier Jahre — unwirksam.",
          "Befristung ohne qualifizierten Grund (Eigenbedarf, Abriss, Betriebsbedarf) — der Vertrag gilt dann unbefristet (§ 575 BGB).",
          "Vollständiges Verbot der Untervermietung — der Mieter hat bei berechtigtem Interesse einen Anspruch auf Erlaubnis für einen Teil der Wohnung (§ 553 BGB).",
          "Kaution über drei Nettokaltmieten oder ohne Ratenrecht — insoweit unwirksam (§ 551 BGB).",
          "Formularmäßige Verpflichtung zur Endreinigung durch eine Fachfirma — unwirksam.",
        ],
      },
      {
        h: "Die Schriftform bei Änderungen",
        p: [
          "Bei Verträgen mit einer Laufzeit von mehr als einem Jahr gilt die Schriftform (§ 550 BGB) — und sie gilt auch für spätere Änderungen. Eine per E-Mail vereinbarte Mietsenkung oder Flächenänderung kann die Schriftform des Gesamtvertrags zerstören und ihn ordentlich kündbar machen.",
          "Praktische Konsequenz: Jede wesentliche Änderung als unterschriebenen Nachtrag festhalten, der auf den Ursprungsvertrag Bezug nimmt.",
        ],
      },
      {
        h: "Was Sie jetzt tun sollten",
        liste: [
          "Alle laufenden Verträge einmal durchgehen und die sechs genannten Punkte abhaken.",
          "Unwirksame Klauseln nicht heimlich streichen — bestehende Verträge lassen sich nicht einseitig ändern. Wissen Sie aber, dass eine Klausel nicht hält, berufen Sie sich nicht darauf und sparen sich den Streit.",
          "Für neue Vermietungen ein aktuelles Formular verwenden, nicht die Kopie des alten Vertrags.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Die Grenzwerte bei Kleinreparaturen sind Rechtsprechung und keine gesetzlichen Beträge — sie entwickeln sich fort. Bei laufendem Streit ist anwaltlicher Rat der richtige Weg.",
        ],
      },
    ],
    feature: {
      titel: "Verträge und Belege an einem Ort",
      text:
        "In MyImmo liegt der Mietvertrag beim Mieter, das Übergabeprotokoll beim Objekt und jeder Beleg bei seiner Kostenposition. Wenn eine Klausel zur Diskussion steht, ist das Dokument in Sekunden auf dem Schirm statt im Aktenordner.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "wohnung-geerbt-steuern-fristen",
    titel: "Wohnung geerbt: Steuern, Fristen und die erste Abrechnung",
    beschreibung:
      "Sechs Wochen, drei Monate, zwei Jahre: der Fristenkalender nach dem Erbfall — plus Erbschaftsteuer, der 10-%-Abschlag für vermietete Wohnungen und die AfA-Fortführung.",
    kategorie: "Einstieg",
    datum: "2026-07-30",
    lesezeit: 8,
    kurzcheck: {
      fall:
        "Der Vater ist im März gestorben, zum Nachlass gehört eine vermietete Zweizimmerwohnung — und niemand weiß, was zuerst zu tun ist.",
      passt: [
        "Der Erbfall liegt weniger als sechs Wochen zurück.",
        "Zum Nachlass gehört Grundbesitz und Sie haben dem Finanzamt noch nichts gemeldet.",
        "Sie erben gemeinsam mit Geschwistern.",
        "Die Nebenkostenabrechnung für das Vorjahr ist noch offen.",
      ],
      nichtNoetig:
        "Geht es Ihnen um die praktischen Schritte der Weitervermietung statt um Steuern und Fristen, hilft der Ratgeber zur geerbten Immobilie.",
    },
    intro:
      "Nach einem Erbfall laufen mehrere Fristen gleichzeitig, und keine davon meldet sich von selbst. Dieser Ratgeber sortiert sie nach Dringlichkeit und erklärt die drei steuerlichen Punkte, die bei einer geerbten Mietwohnung wirklich zählen. Wer die Immobilie behalten und weitervermieten will, findet die praktischen ersten Schritte im Ratgeber „Geerbte Immobilie vermieten“.",
    sektionen: [
      {
        h: "Zuerst: sechs Wochen",
        p: [
          "Wollen Sie das Erbe ausschlagen, haben Sie dafür sechs Wochen ab dem Zeitpunkt, zu dem Sie vom Erbfall und Ihrer Berufung als Erbe erfahren haben (§ 1944 BGB). Hatte der Erblasser seinen letzten Wohnsitz im Ausland oder halten Sie sich bei Fristbeginn im Ausland auf, sind es sechs Monate.",
          "Die Ausschlagung erfolgt zur Niederschrift beim Nachlassgericht oder in notariell beglaubigter Form — eine formlose Erklärung genügt nicht. Verstreicht die Frist, gilt das Erbe als angenommen, samt Schulden.",
          "Bei einer belasteten Immobilie ist das keine theoretische Frage: Sie erben das Objekt mit dem Darlehen und mit allen laufenden Verpflichtungen aus den Mietverträgen.",
        ],
      },
      {
        h: "Dann: drei Monate zum Finanzamt",
        p: [
          "Jeder Erwerb von Todes wegen ist dem zuständigen Erbschaftsteuerfinanzamt binnen drei Monaten anzuzeigen (§ 30 ErbStG). Eine formlose Mitteilung genügt.",
          "Die Anzeige entfällt normalerweise, wenn der Erwerb auf einer von einem deutschen Gericht oder Notar eröffneten Verfügung von Todes wegen beruht. Gehört Grundbesitz zum Nachlass, gilt diese Erleichterung nicht — dann müssen Sie in jedem Fall selbst anzeigen. Genau hier verlassen sich viele Erben zu Unrecht auf den Notar.",
          "Die Steuererklärung selbst verlangt das Finanzamt erst nach Aufforderung, mit einer Frist von mindestens einem Monat.",
        ],
      },
      {
        h: "Und: zwei Jahre für das Grundbuch",
        p: [
          "Die Berichtigung des Grundbuchs ist gebührenfrei, wenn der Antrag innerhalb von zwei Jahren nach dem Erbfall gestellt wird. Danach fallen Gebühren nach dem Wert der Immobilie an — bei einer Eigentumswohnung schnell ein dreistelliger Betrag ohne jeden Gegenwert.",
          "Als Nachweis dient der Erbschein oder ein notarielles Testament nebst Eröffnungsprotokoll. Liegt Letzteres vor, ist ein Erbschein für die Grundbuchberichtigung meist entbehrlich — das spart die Erbscheinkosten.",
        ],
      },
      {
        h: "Erbschaftsteuer: Freibeträge und der 10-%-Abschlag",
        p: [
          "Die persönlichen Freibeträge richten sich nach dem Verwandtschaftsgrad (§ 16 ErbStG): 500.000 € für Ehegatten und eingetragene Lebenspartner, 400.000 € für Kinder je Elternteil, 200.000 € für Enkel, 20.000 € für Geschwister, Nichten und Neffen. Zusätzlich kann für Ehegatten und Kinder ein Versorgungsfreibetrag greifen.",
          "Für Grundstücke, die zu Wohnzwecken vermietet sind, gilt ein Bewertungsabschlag von 10 Prozent: Nur 90 Prozent des Steuerwerts werden angesetzt (§ 13d ErbStG). Für vermietete Büro- oder Gewerbeflächen gibt es diesen Abschlag nicht.",
          "Die weitergehende Befreiung für das Familienheim (§ 13 Abs. 1 Nr. 4b, 4c ErbStG) setzt Selbstnutzung voraus und hilft bei einer vermieteten Wohnung nicht. Wer sie nutzen will, muss selbst einziehen — und zehn Jahre bleiben.",
          "Grunderwerbsteuer fällt beim Erwerb von Todes wegen nicht an (§ 3 Nr. 2 GrEStG).",
        ],
      },
      {
        h: "Rechenbeispiel",
        p: [
          "Eine Tochter erbt eine vermietete Eigentumswohnung mit einem Steuerwert von 500.000 €.",
        ],
        liste: [
          "Ansatz nach § 13d ErbStG: 90 % von 500.000 € = 450.000 €.",
          "Abzüglich Freibetrag 400.000 € → steuerpflichtiger Erwerb 50.000 €.",
          "Steuerklasse I, Satz 7 % → rund 3.500 € Erbschaftsteuer.",
          "Ohne den 10-%-Abschlag wären 100.000 € steuerpflichtig und der Satz läge in der nächsten Stufe — der Abschlag ist also mehr wert als die 50.000 € Bemessungsgrundlage vermuten lassen.",
        ],
      },
      {
        h: "Die Abschreibung läuft weiter — nicht neu an",
        p: [
          "Der häufigste Irrtum bei geerbten Immobilien: dass der Verkehrswert im Todeszeitpunkt zur neuen Abschreibungsgrundlage wird. Das ist falsch. Bei unentgeltlichem Erwerb führen Sie die Abschreibung des Erblassers fort — mit dessen Bemessungsgrundlage, dessen Satz und dessen Restnutzungsdauer (§ 11d EStDV).",
          "Praktische Folge: Sie brauchen die alten Unterlagen des Erblassers — Kaufvertrag, Kaufpreisaufteilung, bisherige Abschreibungsbeträge. Ohne sie schätzt das Finanzamt, und selten zu Ihren Gunsten. Beschaffen Sie diese Papiere früh, solange der Nachlass noch beisammen ist.",
          "Dasselbe Prinzip gilt für die Spekulationsfrist: Beim Verkauf wird Ihnen die Anschaffung durch den Erblasser zugerechnet (§ 23 Abs. 1 Satz 3 EStG). Hat er die Wohnung vor mehr als zehn Jahren gekauft, ist der Verkauf für Sie sofort steuerfrei.",
        ],
      },
      {
        h: "Die erste Nebenkostenabrechnung",
        p: [
          "Als Erbe treten Sie in die laufenden Mietverträge ein — und damit auch in die Pflicht, über einen Abrechnungszeitraum abzurechnen, der zum Teil vor dem Erbfall lag. Die Zwölf-Monats-Frist des § 556 Abs. 3 BGB läuft unabhängig vom Todesfall weiter.",
          "Das heißt konkret: Sie brauchen die Belege des Erblassers für das gesamte Abrechnungsjahr. Sichern Sie Kontoauszüge, Versorgerrechnungen, den Grundsteuerbescheid und die Ableseprotokolle, bevor eine Wohnung geräumt oder ein Konto aufgelöst wird.",
          "Informieren Sie die Mieter zeitnah über den Eigentümerwechsel und die neue Bankverbindung. Zahlungen auf ein aufgelöstes Konto erzeugen sonst Rückläufer, die wie Mietrückstände aussehen, aber keine sind.",
        ],
      },
      {
        h: "Wenn Sie nicht allein erben",
        p: [
          "Mehrere Erben bilden eine Erbengemeinschaft. Die Immobilie gehört allen gemeinsam; über Verkauf oder größere Maßnahmen wird gemeinsam entschieden, Maßnahmen der ordnungsgemäßen Verwaltung durch Mehrheitsbeschluss.",
          "Mieteinnahmen werden nach Erbquote zugerechnet — jeder Miterbe versteuert seinen Anteil selbst. Klären Sie früh, wer das Mietkonto führt, wer die Abrechnung erstellt und wie die Überschüsse verteilt werden. Ungeklärte Zuständigkeit ist der häufigste Grund, warum die erste Abrechnung zu spät kommt.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Erbschaftsteuerliche Bewertung und Freibeträge hängen vom Einzelfall ab; bei größeren Nachlässen oder einer Erbengemeinschaft ist steuerlicher und anwaltlicher Rat sinnvoll.",
        ],
      },
    ],
    feature: {
      titel: "Übernommene Objekte sauber weiterführen",
      text:
        "MyImmo übernimmt die vorhandene Abschreibung mit Bemessungsgrundlage und Restlaufzeit, statt sie neu zu beginnen, führt das Mietkonto ab dem Erbfall weiter und behält die Zwölf-Monats-Frist für die erste Nebenkostenabrechnung im Blick.",
      href: "/anmelden",
      cta: "Kostenlos starten",
    },
  },
  {
    slug: "anlage-v-ausfuellen-abschnitt-fuer-abschnitt",
    titel: "Anlage V ausfüllen — Abschnitt für Abschnitt",
    beschreibung:
      "Welche der drei Anlagen Sie brauchen, was zu den Einnahmen zählt, welche Werbungskosten abziehbar sind — und die fünf Fehler, die Vermieter jedes Jahr wiederholen.",
    kategorie: "Steuer",
    datum: "2026-07-30",
    lesezeit: 9,
    kurzcheck: {
      fall:
        "Die Steuererklärung steht an, 9.600 € Mieteinnahmen im Jahr — und das Formularprogramm bietet drei verschiedene Anlagen V zur Auswahl an.",
      passt: [
        "Sie füllen die Anlage V zum ersten Mal aus.",
        "Sie vermieten eine Ferienwohnung oder untervermieten Räume und wissen nicht, welches Formular gilt.",
        "Sie haben ein Darlehen und sind unsicher, welcher Teil der Rate absetzbar ist.",
        "Sie vermieten an Angehörige unter der ortsüblichen Miete.",
      ],
      nichtNoetig:
        "Ist nur die Abschreibung unklar, geht der AfA-Ratgeber allein darauf ein.",
    },
    intro:
      "Die Anlage V ist kein kompliziertes Formular, aber ein unübersichtliches. Diese Anleitung geht es Abschnitt für Abschnitt durch. Bewusst ohne Zeilennummern: Die Nummerierung ändert sich fast jedes Jahr, die Struktur bleibt. Wer die Struktur verstanden hat, findet die Zeile in jeder Fassung.",
    sektionen: [
      {
        h: "Zuerst: welche Anlage überhaupt",
        p: [
          "Seit dem Veranlagungszeitraum 2023 ist die frühere zweiseitige Anlage V in drei Formulare aufgeteilt. Welches Sie brauchen, entscheidet sich nach der Art der Vermietung.",
        ],
        liste: [
          "Anlage V — der Regelfall: dauerhaft vermietete Wohnung oder vermietetes Haus. Für jedes Objekt eine eigene Anlage V.",
          "Anlage V-FeWo — Ferienwohnungen und kurzfristige Vermietung, etwa über Portale. Sie kommt zusätzlich zur Anlage V des Objekts.",
          "Anlage V-Sonstige — Sonderfälle: Untervermietung selbst angemieteter Räume, unbebaute Grundstücke, Beteiligungen an geschlossenen Immobilienfonds, Überlassung von Rechten.",
        ],
      },
      {
        h: "Abschnitt 1: Angaben zum Grundstück",
        p: [
          "Hier stehen Lage, Anschaffungs- oder Fertigstellungsdatum und die Aufteilung der Nutzung. Wichtig ist die Angabe, welcher Teil des Objekts zu fremden Wohnzwecken vermietet, welcher zu eigenen Wohnzwecken genutzt und welcher gewerblich vermietet wird.",
          "Diese Aufteilung steuert alles Weitere: Nur der vermietete Anteil führt zu Einnahmen und nur auf ihn entfallende Ausgaben sind Werbungskosten. Bei einer teilweise selbst genutzten Doppelhaushälfte wird hier der Schlüssel gesetzt, mit dem später jede Rechnung aufgeteilt wird.",
        ],
      },
      {
        h: "Abschnitt 2: Einnahmen",
        p: [
          "Zu den Einnahmen zählt alles, was Ihnen im Kalenderjahr zugeflossen ist. Maßgeblich ist der tatsächliche Geldeingang, nicht der Zeitraum, für den gezahlt wurde (§ 11 EStG). Eine Ausnahme gilt für regelmäßig wiederkehrende Zahlungen rund um den Jahreswechsel: Sie werden dem Jahr zugeordnet, zu dem sie wirtschaftlich gehören, wenn sie innerhalb von zehn Tagen vor oder nach dem Jahreswechsel fließen.",
        ],
        liste: [
          "Kaltmieten des Jahres.",
          "Vereinnahmte Nebenkostenvorauszahlungen — sie sind Einnahmen, auch wenn sie durchlaufende Posten zu sein scheinen. Die Ausgaben stehen dann auf der Werbungskostenseite gegenüber.",
          "Nachzahlungen aus der Nebenkostenabrechnung im Jahr des Zuflusses; erstattete Guthaben mindern die Einnahmen im Jahr der Auszahlung.",
          "Einnahmen aus Garagen, Stellplätzen, Werbeflächen, Mobilfunkantennen.",
          "Vereinnahmte Kaution zählt nicht — erst wenn Sie sie mit einer Forderung verrechnen, wird daraus eine Einnahme.",
        ],
      },
      {
        h: "Abschnitt 3: Werbungskosten",
        p: [
          "Werbungskosten sind alle Aufwendungen, die durch die Vermietung veranlasst sind. Die wichtigsten Gruppen im Formular:",
        ],
        liste: [
          "Abschreibung des Gebäudes — der größte Posten, ohne dass Geld fließt.",
          "Schuldzinsen und Geldbeschaffungskosten. Abziehbar ist nur der Zinsanteil der Rate, nie die Tilgung.",
          "Erhaltungsaufwand — Reparaturen und Instandhaltung, wahlweise sofort oder verteilt.",
          "Laufende Betriebskosten: Grundsteuer, Versicherungen, Müll, Wasser, Heizung, Allgemeinstrom, Hausmeister. Auch die Teile, die Sie auf Mieter umlegen, gehören hierher — sie stehen ja auch bei den Einnahmen.",
          "Verwaltungskosten, Kontoführung, Porto, Fachliteratur, Software für die Verwaltung.",
          "Fahrten zum Objekt, Mitgliedsbeiträge in Vermietervereinen, Kosten für Steuerberatung und Rechtsberatung, soweit sie die Vermietung betreffen.",
        ],
      },
      {
        h: "Die fünf Fehler, die sich jedes Jahr wiederholen",
        liste: [
          "Die Tilgung als Werbungskosten angesetzt. Nur die Zinsen zählen — der Tilgungsanteil ist Vermögensumschichtung.",
          "Nebenkostenvorauszahlungen weggelassen, weil sie durchlaufend wirken. Dann fehlen konsequenterweise auch die Ausgaben, und das Ergebnis stimmt zufällig — bis das Finanzamt nachfragt.",
          "Einzahlungen in die Erhaltungsrücklage der Eigentümergemeinschaft sofort abgezogen. Abziehbar sind sie erst, wenn die Gemeinschaft das Geld tatsächlich für Erhaltungsmaßnahmen verwendet.",
          "Kosten vor der ersten Vermietung nicht angesetzt. Aufwendungen in der Leerstands- oder Renovierungsphase sind bereits Werbungskosten, wenn die Vermietungsabsicht belegt ist — Inserate aufheben.",
          "Verbilligte Vermietung an Angehörige übersehen. Liegt die Miete unter 66 Prozent der ortsüblichen Marktmiete, werden die Werbungskosten gekürzt; zwischen 50 und 66 Prozent entscheidet eine Überschussprognose (§ 21 Abs. 2 EStG).",
        ],
      },
      {
        h: "Was Sie bereithalten sollten",
        liste: [
          "Mietkonto oder Kontoauszüge des ganzen Jahres.",
          "Die Nebenkostenabrechnung des Vorjahres, weil Nachzahlung oder Erstattung dort landet.",
          "Kaufvertrag und Kaufpreisaufteilung für die Abschreibung.",
          "Zins- und Tilgungsbescheinigung der Bank.",
          "Rechnungen über Reparaturen, getrennt nach Objekt.",
          "Bei Wohnungseigentum: die Jahresabrechnung der Verwaltung.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Dieser Text beschreibt den Aufbau des Formulars und gibt Anhaltspunkte ohne Gewähr. Er ist keine Steuerberatung und ersetzt sie nicht. Welche Angaben in Ihrem Fall richtig sind, klären Sie mit Ihrem Steuerberater oder einem Lohnsteuerhilfeverein im Rahmen von dessen Beratungsbefugnis.",
        ],
      },
    ],
    feature: {
      titel: "Die Zahlen stehen schon bereit",
      text:
        "MyImmo ordnet Einnahmen und Ausgaben das ganze Jahr über den Kategorien der Anlage V zu und stellt sie am Jahresende objektweise zusammen — inklusive Abschreibung, Zinsanteil und Erhaltungsaufwand. Übertragen müssen Sie die Werte nur noch.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "afa-richtig-ansetzen-linear-degressiv",
    titel: "AfA richtig ansetzen: 2 %, 2,5 %, 3 % oder degressiv",
    beschreibung:
      "Welcher Abschreibungssatz für welches Baujahr gilt, wann die degressive AfA von 5 % in Betracht kommt und wie die Bemessungsgrundlage überhaupt ermittelt wird.",
    kategorie: "Steuer",
    datum: "2026-07-30",
    lesezeit: 8,
    kurzcheck: {
      fall:
        "Sie haben eine Eigentumswohnung für 400.000 € gekauft, Baujahr 1998 — und müssen jetzt entscheiden, welcher Anteil davon Gebäude ist und mit welchem Satz abgeschrieben wird.",
      passt: [
        "Sie haben in diesem oder im vergangenen Jahr gekauft.",
        "Im Kaufvertrag steht keine Aufteilung zwischen Grund und Boden und Gebäude.",
        "Sie bauen neu oder kaufen einen Neubau und haben von degressiver Abschreibung gehört.",
        "Sie haben geerbt und wollen wissen, ob Sie neu abschreiben dürfen.",
      ],
      nichtNoetig:
        "Läuft Ihre Abschreibung seit Jahren unverändert und der Bescheid war nie strittig, ändert dieser Artikel für Sie wenig.",
    },
    intro:
      "Die Abschreibung ist bei den meisten Vermietern der größte Werbungskostenposten — und der einzige, dem kein Geldabfluss gegenübersteht. Umso ärgerlicher, wenn sie zu niedrig angesetzt wird, weil die Bemessungsgrundlage falsch ermittelt wurde oder der falsche Satz gewählt wurde.",
    sektionen: [
      {
        h: "Schritt 1: die Bemessungsgrundlage",
        p: [
          "Abgeschrieben wird nur das Gebäude. Der Grund und Boden nutzt sich nicht ab und bleibt außen vor. Der Kaufpreis muss deshalb aufgeteilt werden.",
          "In die Bemessungsgrundlage gehören neben dem Gebäudeanteil des Kaufpreises auch die anteiligen Anschaffungsnebenkosten: Grunderwerbsteuer, Notar, Grundbuch, Maklerprovision. Sie werden im selben Verhältnis aufgeteilt wie der Kaufpreis.",
          "Für die Aufteilung stellt das Bundesfinanzministerium eine Arbeitshilfe bereit. Der Bundesfinanzhof hat entschieden, dass sie nicht bindend ist: Führt sie zu einem unangemessenen Ergebnis, ist der Wert gutachterlich zu ermitteln. Eine Aufteilung, die schon im Kaufvertrag steht, erkennt die Finanzverwaltung an, wenn sie wirtschaftlich haltbar ist und nicht nur zum Steuersparen gegriffen wurde.",
        ],
      },
      {
        h: "Schritt 2: der lineare Satz nach Baujahr",
        liste: [
          "Fertigstellung ab dem 01.01.2023: 3 Prozent pro Jahr, rechnerische Nutzungsdauer 33 Jahre.",
          "Fertigstellung ab 01.01.1925 bis 31.12.2022: 2 Prozent, 50 Jahre.",
          "Fertigstellung vor dem 01.01.1925: 2,5 Prozent, 40 Jahre.",
        ],
        p: [
          "Maßgeblich ist die Fertigstellung des Gebäudes, nicht der Zeitpunkt Ihres Kaufs. Ein Altbau von 1900, den Sie 2026 erwerben, wird mit 2,5 Prozent abgeschrieben.",
          "Im Jahr der Anschaffung wird zeitanteilig gerechnet, monatsgenau ab dem Monat des Übergangs von Nutzen und Lasten.",
        ],
      },
      {
        h: "Kürzere Nutzungsdauer nachweisen",
        p: [
          "Ist die tatsächliche Restnutzungsdauer kürzer als der gesetzliche Typisierungswert, darf danach abgeschrieben werden (§ 7 Abs. 4 Satz 2 EStG). Der Nachweis erfolgt in der Praxis über ein Gutachten; die Finanzverwaltung stellt dafür Anforderungen, die in einem eigenen Schreiben geregelt sind.",
          "Das lohnt vor allem bei stark abgenutzten Altbauten. Kosten und Aufwand des Gutachtens stehen dem gegenüber — rechnen Sie beides gegeneinander, bevor Sie beauftragen.",
        ],
      },
      {
        h: "Die degressive AfA für Neubauten",
        p: [
          "Für neu gebaute oder im Jahr der Fertigstellung erworbene Wohngebäude gibt es eine degressive Abschreibung von 5 Prozent (§ 7 Abs. 5a EStG). Sie greift, wenn mit dem Bau zwischen dem 01.10.2023 und dem 30.09.2029 begonnen wurde beziehungsweise der Kaufvertrag in diesen Zeitraum fällt.",
          "Degressiv heißt: Die 5 Prozent werden nicht vom ursprünglichen Wert berechnet, sondern jedes Jahr vom verbleibenden Restwert. Der Abzug ist am Anfang deutlich höher und sinkt dann ab. Ein Wechsel zur linearen Abschreibung ist zulässig und sinnvoll, sobald diese den höheren Betrag ergibt.",
        ],
      },
      {
        h: "Die Sonderabschreibung nach § 7b EStG",
        p: [
          "Zusätzlich existiert eine Sonderabschreibung für den Mietwohnungsneubau: vier Jahre lang jeweils bis zu 5 Prozent, neben der regulären Abschreibung. Voraussetzung ist ein Bauantrag oder eine Bauanzeige im Zeitraum vom 01.01.2023 bis zum 30.09.2029, die Einhaltung eines Effizienzhaus-40-Standards mit Qualitätssiegel sowie Grenzen bei den Baukosten und bei der Bemessungsgrundlage je Quadratmeter Wohnfläche.",
          "Beide Instrumente lassen sich kombinieren, wenn die jeweiligen Voraussetzungen erfüllt sind. Bei der Berechnung ist zu beachten, dass der Restwert für die degressive Abschreibung nur um die degressive Abschreibung selbst gekürzt wird, nicht zusätzlich um die Sonderabschreibung.",
          "Beide Regelungen sind an enge Fristen und technische Nachweise gebunden. Wer hier ohne fachliche Begleitung plant, riskiert, die Voraussetzungen erst im Nachhinein zu prüfen — dann ist die Frist meist schon vorbei.",
        ],
      },
      {
        h: "Rechenbeispiel",
        p: [
          "Kaufpreis 400.000 €, Nebenkosten 40.000 €, Gebäudeanteil laut Aufteilung 75 Prozent. Baujahr 1998, also linear 2 Prozent. Nutzen und Lasten gehen am 1. Juli über.",
        ],
        liste: [
          "Bemessungsgrundlage: 75 % von 440.000 € = 330.000 €.",
          "Jahres-AfA: 2 % von 330.000 € = 6.600 €.",
          "Im Anschaffungsjahr zeitanteilig für sechs Monate: 3.300 €.",
          "Zum Vergleich: Wäre der Gebäudeanteil mit 60 statt 75 Prozent angesetzt, wären es nur 5.280 € pro Jahr — über 50 Jahre ein Unterschied von 66.000 € Abschreibungsvolumen.",
        ],
      },
      {
        h: "Geerbt oder geschenkt: keine neue Grundlage",
        p: [
          "Bei unentgeltlichem Erwerb führen Sie die Abschreibung des Vorgängers fort — mit dessen Bemessungsgrundlage, dessen Satz und dessen Restnutzungsdauer (§ 11d EStDV). Der Verkehrswert im Zeitpunkt des Erbfalls ist ausdrücklich nicht maßgeblich.",
          "Deshalb sind die alten Unterlagen des Erblassers so wertvoll. Ohne Kaufvertrag und bisherige Abschreibungsbeträge muss geschätzt werden.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Steuerberatung. Sätze, Fristen und Fördervoraussetzungen ändern sich häufig; degressive AfA und Sonderabschreibung sollten vor der Investitionsentscheidung steuerlich geprüft werden.",
        ],
      },
    ],
    feature: {
      titel: "Abschreibung ohne Tabelle",
      text:
        "In MyImmo hinterlegen Sie Kaufpreis, Nebenkosten, Gebäudeanteil und Baujahr einmal — der Jahresbetrag steht danach in jeder Auswertung und in der Anlage-V-Zusammenstellung, im Anschaffungsjahr automatisch zeitanteilig.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "erhaltungsaufwand-verteilen-82b-estdv",
    titel: "Erhaltungsaufwand über 5 Jahre verteilen (§ 82b EStDV)",
    beschreibung:
      "Wann sich die Verteilung größerer Reparaturkosten lohnt, wie das Wahlrecht ausgeübt wird — und was mit dem Restbetrag bei Verkauf oder Todesfall passiert.",
    kategorie: "Steuer",
    datum: "2026-07-30",
    lesezeit: 7,
    kurzcheck: {
      fall:
        "Das neue Dach hat 30.000 € gekostet, die Wohnung bringt 12.000 € Miete im Jahr — der Abzug wäre größer als alles, wogegen er sich rechnen ließe.",
      passt: [
        "Eine einzelne Maßnahme kostet mehr als die Jahresmiete des Objekts.",
        "Ihr zu versteuerndes Einkommen steigt oder sinkt in den nächsten Jahren spürbar.",
        "Sie haben in den ersten drei Jahren nach dem Kauf saniert.",
        "Sie haben eine Immobilie geerbt, bei der eine Verteilung noch läuft.",
      ],
      nichtNoetig:
        "Kleinere Reparaturen ziehen Sie schlicht im Jahr der Zahlung ab — dafür brauchen Sie diese Vorschrift nicht.",
    },
    intro:
      "Eine neue Heizung, ein neues Dach, neue Fenster: Größere Reparaturen sind im Jahr der Zahlung in voller Höhe abziehbar. Genau das ist manchmal das Problem — der Abzug verpufft, wenn ihm keine ausreichenden Einkünfte gegenüberstehen. Für diesen Fall erlaubt § 82b EStDV die Verteilung auf mehrere Jahre.",
    sektionen: [
      {
        h: "Was die Vorschrift erlaubt",
        p: [
          "Größerer Erhaltungsaufwand für Gebäude, die im Privatvermögen gehalten werden und überwiegend Wohnzwecken dienen, kann gleichmäßig auf zwei bis fünf Jahre verteilt werden. Die Aufteilung beginnt im Jahr der Zahlung.",
          "Es ist ein Wahlrecht, kein Zwang, und es wird für jede Maßnahme einzeln ausgeübt. Sie können also die Dachsanierung verteilen und die Fenster im selben Jahr sofort abziehen.",
          "Auf gewerblich vermietete Objekte und auf Gebäude im Betriebsvermögen ist die Vorschrift nicht anwendbar.",
        ],
      },
      {
        h: "Wann die Verteilung sinnvoll ist",
        liste: [
          "Wenn die Kosten so hoch sind, dass im Zahlungsjahr ein Verlust entsteht, der sich steuerlich nicht auswirkt.",
          "Wenn Ihr zu versteuerndes Einkommen in den Folgejahren steigt — dann wirkt derselbe Abzug bei höherem Grenzsteuersatz stärker.",
          "Wenn mehrere große Maßnahmen in einem Jahr zusammenfallen und Sie die Wirkung strecken wollen.",
        ],
        p: [
          "Umgekehrt spricht gegen die Verteilung, wenn Ihr Einkommen künftig sinkt — etwa vor dem Renteneintritt. Dann ist der Sofortabzug im Jahr der höheren Progression der wirksamere.",
        ],
      },
      {
        h: "Rechenbeispiel",
        p: [
          "Dachsanierung für 30.000 €, gezahlt im Jahr 2026. Die Mieteinnahmen des Objekts betragen 12.000 € im Jahr, die übrigen Werbungskosten 7.000 €.",
        ],
        liste: [
          "Sofortabzug: 12.000 € minus 7.000 € minus 30.000 € = 25.000 € Verlust im Jahr 2026. Er wird mit anderen Einkünften verrechnet — reichen die nicht aus, verpufft ein Teil der Wirkung.",
          "Verteilung auf fünf Jahre: je 6.000 € in den Jahren 2026 bis 2030. Das Ergebnis liegt jedes Jahr bei minus 1.000 € statt einmal bei minus 25.000 €.",
          "Welche Variante günstiger ist, hängt allein von Ihren übrigen Einkünften in diesen fünf Jahren ab — die Summe des Abzugs ist in beiden Fällen gleich.",
        ],
      },
      {
        h: "Die Abgrenzung, die vorher stimmen muss",
        p: [
          "Die Verteilung setzt voraus, dass es sich überhaupt um Erhaltungsaufwand handelt. Wird ein Gebäude wesentlich verbessert oder in seiner Substanz erweitert, liegen Herstellungskosten vor — sie sind nicht abziehbar, sondern nur über die Abschreibung zu berücksichtigen.",
          "Die schärfste Falle liegt in den ersten drei Jahren nach dem Kauf: Übersteigen die Instandsetzungsaufwendungen ohne Umsatzsteuer 15 Prozent der Gebäude-Anschaffungskosten, werden sie insgesamt zu anschaffungsnahen Herstellungskosten umqualifiziert (§ 6 Abs. 1 Nr. 1a EStG). Aus dem sofortigen Abzug wird dann eine Abschreibung über Jahrzehnte.",
        ],
      },
      {
        h: "Was mit dem Restbetrag passiert",
        p: [
          "Wird das Gebäude während des Verteilungszeitraums veräußert, in ein Betriebsvermögen eingebracht oder nicht mehr zur Einkünfteerzielung genutzt, ist der noch nicht berücksichtigte Teil im Jahr dieses Ereignisses in einer Summe abzuziehen.",
          "Anders beim Todesfall: Nach der Rechtsprechung des Bundesfinanzhofs kann der Erbe eine begonnene Verteilung nicht fortführen. Der Restbetrag ist im Todesjahr beim Erblasser abzuziehen. Wer eine geerbte Immobilie übernimmt, sollte das prüfen — der Abzug gehört in die letzte Steuererklärung des Erblassers, nicht in die eigene.",
        ],
      },
      {
        h: "Wie das Wahlrecht ausgeübt wird",
        p: [
          "Die Entscheidung treffen Sie in der Steuererklärung des Zahlungsjahres, indem Sie den Verteilungszeitraum angeben. In den Folgejahren tragen Sie die jeweilige Jahresrate ein.",
          "Führen Sie eine kleine Übersicht je Maßnahme mit Datum, Betrag, gewähltem Zeitraum und den bereits abgezogenen Raten. Über fünf Jahre hinweg ist das sonst kaum rekonstruierbar — insbesondere, wenn mehrere Maßnahmen parallel laufen.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Steuerberatung. Ob Verteilung oder Sofortabzug im Einzelfall günstiger ist, hängt von Ihrer gesamten Einkommenssituation ab und sollte steuerlich durchgerechnet werden.",
        ],
      },
    ],
    feature: {
      titel: "Verteilte Kosten im Blick behalten",
      text:
        "MyImmo hält bei jeder Erhaltungsmaßnahme fest, über welchen Zeitraum sie verteilt wird, und weist die Jahresrate in den Folgejahren automatisch aus — samt Hinweis, wenn eine Maßnahme in die 15-Prozent-Grenze der ersten drei Jahre läuft.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "mieterhoehung-fristen-kappungsgrenze-formfehler",
    titel: "Mieterhöhung: Fristen, Kappungsgrenze, Formfehler",
    beschreibung:
      "Wann Sie erhöhen dürfen, wie hoch die Kappungsgrenze liegt, wie das Schreiben begründet sein muss — und die Formfehler, an denen die meisten Erhöhungen scheitern.",
    kategorie: "Recht",
    datum: "2026-07-31",
    lesezeit: 8,
    kurzcheck: {
      fall: "Die Miete steht seit vier Jahren bei 8,00 € je Quadratmeter, im Mietspiegel stehen inzwischen 9,50 € — und Sie fragen sich, wie viel davon Sie tatsächlich durchsetzen können.",
      passt: [
        "Die letzte Mieterhöhung liegt mehr als ein Jahr zurück.",
        "Sie haben modernisiert und wollen die Kosten umlegen.",
        "Sie haben ein Erhöhungsschreiben verschickt und der Mieter hat nicht reagiert.",
        "Sie wissen nicht, ob Ihr Ort unter die abgesenkte Kappungsgrenze fällt.",
      ],
      nichtNoetig:
        "Haben Sie eine Staffel- oder Indexmiete vereinbart, steigt die Miete nach dieser Abrede — der Weg über die Vergleichsmiete ist dann versperrt.",
    },
    intro:
      "Eine Mieterhöhung scheitert selten an der Höhe. Sie scheitert an einer Frist, an einer fehlenden Begründung oder daran, dass das Schreiben nicht an alle Mieter gerichtet war. Dieser Ratgeber geht die drei Wege durch, auf denen die Miete überhaupt steigen darf, und zeigt, wo die Fallen liegen.",
    sektionen: [
      {
        h: "Drei Wege, die Miete zu erhöhen",
        liste: [
          "Anpassung an die ortsübliche Vergleichsmiete (§ 558 BGB) — der Regelfall, braucht die Zustimmung des Mieters.",
          "Modernisierungsumlage (§ 559 BGB) — nach einer echten Modernisierung, wirkt einseitig ohne Zustimmung.",
          "Vereinbarte Erhöhung: Staffelmiete (§ 557a BGB) oder Indexmiete (§ 557b BGB) — steht schon im Vertrag.",
        ],
        p: [
          "Die Wege schließen sich teilweise aus: Wo eine Staffel- oder Indexmiete vereinbart ist, gibt es keine Erhöhung zur Vergleichsmiete. Prüfen Sie deshalb zuerst den Mietvertrag.",
        ],
      },
      {
        h: "Weg 1: Anpassung an die Vergleichsmiete",
        p: [
          "Drei Bedingungen müssen zusammenkommen. Erstens die Zeit: Die Miete muss beim Wirksamwerden der Erhöhung seit mindestens 15 Monaten unverändert sein, und das Erhöhungsverlangen darf frühestens 12 Monate nach der letzten Erhöhung zugehen.",
          "Zweitens die Obergrenze: Die neue Miete darf die ortsübliche Vergleichsmiete nicht übersteigen. Sie ist die absolute Decke, unabhängig von jeder Prozentrechnung.",
          "Drittens die Kappungsgrenze: Innerhalb von drei Jahren darf die Miete um höchstens 20 Prozent steigen. In Gebieten mit angespanntem Wohnungsmarkt haben die Landesregierungen diesen Wert per Verordnung auf 15 Prozent abgesenkt — das betrifft inzwischen mehrere hundert Städte und Gemeinden. Ob Ihr Ort dazugehört, ergibt sich aus der Verordnung Ihres Bundeslandes.",
        ],
      },
      {
        h: "Rechenbeispiel",
        p: [
          "Wohnung mit 80 m², aktuelle Kaltmiete 8,00 € je Quadratmeter, also 640 €. Der Mietspiegel weist 9,50 € aus, das wären 760 €. Die letzte Erhöhung liegt vier Jahre zurück.",
        ],
        liste: [
          "Kappungsgrenze 20 %: 640 € plus 128 € = 768 € wären möglich.",
          "Die ortsübliche Vergleichsmiete deckelt bei 760 € — mehr geht nicht, obwohl die Kappungsgrenze mehr zuließe.",
          "In einem Gebiet mit abgesenkter Grenze von 15 %: 640 € plus 96 € = 736 €. Hier ist die Kappungsgrenze die engere Schranke.",
          "Es gilt immer der niedrigere der beiden Werte.",
        ],
      },
      {
        h: "Wie das Schreiben aussehen muss",
        p: [
          "Das Erhöhungsverlangen bedarf der Textform und muss begründet sein (§ 558a BGB). Als Begründung kommen in Betracht: ein Mietspiegel, eine Mietdatenbank, ein Sachverständigengutachten oder die Benennung von mindestens drei vergleichbaren Wohnungen.",
          "Formal entscheidend ist außerdem die Richtung: Das Schreiben muss von allen Vermietern ausgehen und an alle Mieter gerichtet sein. Haben zwei Personen den Mietvertrag unterschrieben, genügt ein Schreiben an eine von ihnen nicht.",
          "Beziehen Sie sich auf einen Mietspiegel, geben Sie das einschlägige Feld und die Einordnung Ihrer Wohnung an. Ein bloßer Verweis auf den Mietspiegel als Ganzes trägt die Begründung nicht.",
        ],
      },
      {
        h: "Die Fristen nach dem Zugang",
        p: [
          "Der Mieter hat bis zum Ablauf des zweiten Kalendermonats nach dem Zugang Zeit, zuzustimmen. Stimmt er zu, schuldet er die erhöhte Miete ab Beginn des dritten Kalendermonats nach Zugang.",
          "Beispiel: Das Schreiben geht am 10. März zu. Die Zustimmungsfrist läuft bis zum 31. Mai, die erhöhte Miete gilt ab dem 1. Juni.",
          "Stimmt der Mieter nicht zu, können Sie innerhalb von drei weiteren Monaten auf Zustimmung klagen. Lassen Sie diese Frist verstreichen, ist die Erhöhung erledigt und Sie müssen von vorn beginnen. Schweigen des Mieters ist keine Zustimmung.",
        ],
      },
      {
        h: "Weg 2: Umlage nach Modernisierung",
        p: [
          "Nach einer Modernisierung dürfen Sie die Jahresmiete um 8 Prozent der aufgewendeten Kosten erhöhen (§ 559 BGB). Anders als bei der Vergleichsmiete braucht es keine Zustimmung — die Erhöhung wirkt durch Erklärung.",
          "Abzuziehen sind der Erhaltungsanteil, also der Teil, der ohnehin als Reparatur angefallen wäre, sowie Zuschüsse und Förderungen. Nur der verbleibende Betrag ist umlagefähig.",
          "Gedeckelt ist die Modernisierungsumlage auf 3 € je Quadratmeter innerhalb von sechs Jahren; liegt die Ausgangsmiete unter 7 € je Quadratmeter, sind es 2 €. Die Kappungsgrenze des § 558 BGB gilt hier nicht — beide Wege werden getrennt gerechnet.",
          "Die Maßnahme müssen Sie mindestens drei Monate vor Beginn ankündigen (§ 555c BGB), mit Art, Umfang, voraussichtlicher Dauer und der zu erwartenden Mieterhöhung.",
        ],
      },
      {
        h: "Rechenbeispiel Modernisierung",
        p: [
          "Fenstertausch im ganzen Haus für 40.000 €, davon 10.000 € Erhaltungsanteil. Das Haus hat 400 m², die Wohnung 80 m².",
        ],
        liste: [
          "Umlagefähig: 40.000 € minus 10.000 € = 30.000 €.",
          "8 % im Jahr: 2.400 €, also 200 € im Monat für das ganze Haus.",
          "Anteil der Wohnung nach Fläche: 20 % von 200 € = 40 € im Monat.",
          "Das sind 0,50 € je Quadratmeter — die 3-€-Grenze ist damit nicht ausgeschöpft.",
        ],
      },
      {
        h: "Die Formfehler, an denen Erhöhungen scheitern",
        liste: [
          "Die 15-Monats-Frist nicht eingehalten oder falsch gerechnet.",
          "Schreiben nur an einen von mehreren Mietern gerichtet.",
          "Begründung fehlt oder verweist pauschal auf den Mietspiegel, ohne die Wohnung einzuordnen.",
          "Kappungsgrenze übersehen, weil die abgesenkte Grenze am Ort gilt.",
          "Nach ausbleibender Zustimmung die Drei-Monats-Klagefrist verstreichen lassen.",
          "Erhaltungsanteil bei der Modernisierungsumlage nicht abgezogen — das macht die gesamte Erhöhung angreifbar.",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Ob an Ihrem Ort die abgesenkte Kappungsgrenze gilt, ergibt sich aus der Verordnung des Bundeslandes; bei Widerspruch des Mieters ist anwaltlicher Rat sinnvoll.",
        ],
      },
    ],
    feature: {
      titel: "Die Frist meldet sich von selbst",
      text:
        "MyImmo kennt das Datum der letzten Mieterhöhung je Mietverhältnis und meldet sich, sobald eine Anpassung frühestens möglich wird — statt dass die Frist unbemerkt verstreicht. Das Erhöhungsschreiben erzeugt der Dokument-Generator im eigenen Briefkopf.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "vermietungssoftware-wechseln-ohne-datenverlust",
    titel: "Vermietungssoftware wechseln — ohne Datenverlust",
    beschreibung:
      "Export beim alten Anbieter, der richtige Zeitpunkt, was wirklich übertragen werden muss — und eine ehrliche Einschätzung, wie viel Handarbeit ein Wechsel kostet.",
    kategorie: "Einstieg",
    datum: "2026-07-31",
    lesezeit: 7,
    kurzcheck: {
      fall: "Ihre bisherige Vermieter-App ärgert Sie seit Monaten, aber drei Jahre Buchungen, Mieterdaten und Abrechnungen liegen darin — und niemand sagt Ihnen, wie die da wieder herauskommen.",
      passt: [
        "Sie denken über einen Anbieterwechsel nach und fürchten den Datenverlust.",
        "Ihr Anbieter hat eine Migration hinter sich, nach der Daten fehlten.",
        "Sie wollen wissen, welchen Zeitpunkt im Jahr Sie für den Wechsel wählen sollten.",
        "Sie fragen sich, welche Daten Sie rechtlich herausverlangen können.",
      ],
      nichtNoetig:
        "Verwalten Sie bisher mit Tabellen und Ordnern statt mit einer App, ist der Ratgeber zur ersten Vermietung der bessere Einstieg.",
    },
    intro:
      "Der häufigste Grund, bei einer unbefriedigenden Software zu bleiben, ist nicht Zufriedenheit — es ist die Angst vor dem Umzug. Diese Anleitung nimmt ihr die Grundlage: Sie zeigt, was Sie herausverlangen können, wann der Wechsel am wenigsten kostet und wie viel Arbeit realistisch übrig bleibt.",
    sektionen: [
      {
        h: "Schritt 1: Den Export verlangen, bevor Sie kündigen",
        p: [
          "Sie haben einen Anspruch darauf, Ihre Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten (Art. 20 DSGVO). Der Anbieter muss darauf grundsätzlich innerhalb eines Monats reagieren.",
          "Fordern Sie den Export schriftlich an, solange der Vertrag noch läuft. Nach der Kündigung wird es erfahrungsgemäß nicht einfacher, und manche Anbieter sperren den Zugang zum Vertragsende.",
          "Bewahren Sie die Exportdatei zusätzlich als Archiv auf, auch wenn Sie die Daten anderswo eingegeben haben. Für steuerliche Zwecke müssen Belege und Aufzeichnungen ohnehin aufbewahrt werden.",
        ],
      },
      {
        h: "Schritt 2: Wissen, was Sie wirklich brauchen",
        p: [
          "Ein Export enthält meist mehr, als Sie übertragen müssen. Diese Angaben brauchen Sie tatsächlich:",
        ],
        liste: [
          "Objektstammdaten: Adresse, Fläche, Baujahr, Kaufpreis und Kaufdatum, Aufteilung Grund und Boden zu Gebäude.",
          "Abschreibung: bisherige Bemessungsgrundlage, Satz und die bereits abgezogenen Jahre. Ohne diese Werte lässt sich die AfA nicht sauber fortführen.",
          "Mieterdaten: Namen, Vertragsbeginn, Kaltmiete, Vorauszahlung, Kaution samt Anlageort, Datum der letzten Mieterhöhung.",
          "Zählerstände und die letzte Nebenkostenabrechnung — sie ist der Anschlusspunkt für die nächste.",
          "Buchungen des laufenden Jahres, mindestens ab dem 1. Januar.",
          "Kredite: Restschuld, Zinssatz, Ende der Zinsbindung.",
          "Dokumente: Mietverträge, Übergabeprotokolle, Bescheide.",
        ],
      },
      {
        h: "Schritt 3: Den richtigen Zeitpunkt wählen",
        p: [
          "Der günstigste Moment ist der Jahreswechsel, und zwar nachdem die Nebenkostenabrechnung für das alte Jahr fertig ist. Dann müssen Sie kein angefangenes Abrechnungsjahr über zwei Systeme hinweg zusammensuchen.",
          "Der schlechteste Moment ist der Herbst, wenn die Abrechnungsfrist für das Vorjahr näher rückt und gleichzeitig Belege in zwei Systemen liegen.",
          "Ein Wechsel mitten im Jahr ist möglich, kostet aber zusätzliche Sorgfalt: Sie müssen die Buchungen seit dem 1. Januar vollständig nachtragen, sonst stimmt weder die Abrechnung noch die Anlage V.",
        ],
      },
      {
        h: "Schritt 4: Übertragen",
        p: [
          "Für Objekte und Mieter gibt es in MyImmo einen CSV-Import (Einstellungen → Daten & Recht → Import). Sie laden den Export Ihres bisherigen Anbieters oder eine Excel-Tabelle hoch, ordnen die Spalten den MyImmo-Feldern zu — ein Vorschlag kommt automatisch, weil die üblichen Spaltennamen hinterlegt sind — sehen eine Vorschau und bestätigen erst dann. Ohne diesen letzten Klick wird nichts geschrieben.",
          "Übernommen werden dabei die Stammdaten: bei Objekten unter anderem Bezeichnung, Adresse, Typ, Kaufpreis und -datum, Fläche, Baujahr, Miete und Hausgeld; bei Mietern Name, Objektzuordnung, Kaltmiete, Nebenkostenvorauszahlung, Kaution sowie Miet- und Auszugsdatum.",
          "Einzelne Objekte gehen auch ohne Tabelle: Der Exposé-Import liest eine Verkaufsanzeige als PDF, Link oder eingefügten Text aus und füllt die Felder vor.",
          "Was der Import nicht mitbringt, tragen Sie nach: laufende Buchungen, Kredite, Dokumente und vor allem die Abschreibungswerte — Bemessungsgrundlage, Satz und bereits abgezogene Jahre. Gerade die sind mühsam zu rekonstruieren und stehen selten in einem Export.",
          "Realistisch sind damit für die Stammdaten Minuten statt Stunden; der Rest bleibt Handarbeit und lohnt die Sorgfalt, weil Sie dabei jeden Wert einmal prüfen.",
        ],
      },
      {
        h: "Schritt 5: Parallel laufen lassen",
        p: [
          "Kündigen Sie nicht, bevor die erste vollständige Nebenkostenabrechnung im neuen System durchgelaufen ist. Solange der alte Zugang besteht, können Sie jeden Zweifelsfall nachschlagen.",
          "Prüfen Sie nach dem Übertragen drei Dinge gezielt: Stimmen die Kautionsbeträge? Stimmt der Abschreibungsbetrag mit der letzten Steuererklärung überein? Ist bei jedem Mietverhältnis das Datum der letzten Mieterhöhung gesetzt? Diese drei fallen erfahrungsgemäß am ehesten hinten runter.",
        ],
      },
      {
        h: "Schritt 6: Kündigen und löschen lassen",
        p: [
          "Erst wenn alles läuft, kündigen Sie zum nächsten möglichen Termin. Danach können Sie die Löschung Ihrer Daten verlangen (Art. 17 DSGVO) — aber wirklich erst danach, und erst nachdem Sie den Export gesichert haben.",
          "Beachten Sie dabei Ihre eigenen steuerlichen Aufbewahrungspflichten: Was Sie für das Finanzamt vorhalten müssen, muss bei Ihnen liegen, nicht beim alten Anbieter.",
        ],
      },
      {
        h: "Was Sie beim nächsten Anbieter prüfen sollten",
        p: [
          "Die Frage, die vor dem Wechsel zu stellen ist, lautet nicht, wie leicht man hineinkommt, sondern wie leicht man wieder heraus.",
        ],
        liste: [
          "Gibt es einen vollständigen Datenexport, jederzeit und ohne Nachfrage?",
          "In welchem Format — maschinenlesbar oder nur als PDF-Ausdruck?",
          "Lassen sich Buchungen einzeln exportieren, etwa für den Steuerberater?",
          "Wo liegen die Daten, und gibt es einen Auftragsverarbeitungsvertrag?",
        ],
      },
      {
        h: "Rechtsstand und Vorbehalt",
        p: [
          "Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Kündigungsfristen und Exportmöglichkeiten richten sich nach dem Vertrag mit Ihrem bisherigen Anbieter.",
        ],
      },
    ],
    feature: {
      titel: "Kein Einbahnstraßen-Vertrag",
      text:
        "MyImmo gibt jederzeit alles wieder heraus: sämtliche Daten als maschinenlesbarer Export, Buchungen einzeln als CSV, dazu ein DATEV-Export für den Steuerberater. Kein Antrag, keine Wartezeit — dieselbe Freiheit, die dieser Ratgeber von Ihrem bisherigen Anbieter einfordert.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "nebenkostenabrechnung-fristen-fehler",
    titel: "Nebenkostenabrechnung: Fristen und die häufigsten Fehler",
    beschreibung:
      "Die 12-Monats-Frist nach § 556 BGB, Belegeinsicht, korrekte Umlageschlüssel — und die Fehler, die Vermieter bares Geld kosten.",
    kategorie: "Nebenkosten",
    datum: "2026-07-15",
    lesezeit: 6,
    kurzcheck: {
      fall:
        "Der 31. Dezember rückt näher, und die Abrechnung für das Vorjahr liegt noch als Entwurf auf dem Schreibtisch.",
      passt: [
        "Sie sind unsicher, bis wann die Abrechnung beim Mieter sein muss.",
        "Eine Abrechnung ist verspätet und Sie wollen wissen, was Sie noch fordern können.",
        "Ein Mieter hat Einwendungen erhoben.",
      ],
      nichtNoetig:
        "Wollen Sie die Abrechnung erst erstellen, ist der Schritt-für-Schritt-Ratgeber der Einstieg.",
    },
    intro:
      "Studien schätzen, dass über 80 % der Nebenkostenabrechnungen fehlerhaft sind. Für Vermieter ist das teuer: Ein Formfehler oder eine versäumte Frist kann den gesamten Nachzahlungsanspruch kosten. Dieser Ratgeber zeigt die Fristen und die typischen Stolperfallen.",
    sektionen: [
      {
        h: "Die wichtigste Frist: 12 Monate (§ 556 Abs. 3 BGB)",
        p: [
          "Die Abrechnung über die Betriebskosten muss dem Mieter spätestens zum Ablauf des zwölften Monats nach Ende des Abrechnungszeitraums zugehen. Für das Kalenderjahr 2025 heißt das: Die Abrechnung muss dem Mieter bis zum 31.12.2026 vorliegen — nicht abgeschickt, sondern zugegangen.",
          "Versäumen Sie diese Frist, können Sie keine Nachzahlung mehr verlangen. Ein etwaiges Guthaben des Mieters müssen Sie dagegen trotzdem auszahlen. Die Frist ist damit einseitig zu Ihren Lasten — Pünktlichkeit ist bares Geld.",
        ],
      },
      {
        h: "Umlagefähig ist nicht gleich alles",
        p: [
          "Umlegen dürfen Sie nur die in der Betriebskostenverordnung (BetrKV) genannten laufenden Kosten und nur, wenn der Mietvertrag eine wirksame Umlagevereinbarung enthält. Nicht umlagefähig sind insbesondere Verwaltungskosten, Instandhaltung und Reparaturen sowie Rücklagen.",
        ],
        liste: [
          "Umlagefähig: Grundsteuer, Wasser/Abwasser, Müll, Gebäudeversicherung, Hausmeister, Allgemeinstrom, Aufzug, Gartenpflege, Schornsteinfeger, Heizung/Warmwasser.",
          "Nicht umlagefähig: Hausverwaltung, Reparaturen, Instandhaltungsrücklage, Kontoführung, Rechtsschutz.",
        ],
      },
      {
        h: "Der richtige Umlageschlüssel",
        p: [
          "Ohne abweichende Vereinbarung wird nach Wohnfläche umgelegt (§ 556a BGB). Heizung und Warmwasser sind eine Ausnahme: Nach der Heizkostenverordnung müssen 50–70 % verbrauchsabhängig abgerechnet werden. Bei unterjährigem Mieterwechsel wird tagegenau nach Belegungszeit aufgeteilt.",
        ],
      },
      {
        h: "Belegeinsicht und Einwendungsfrist",
        p: [
          "Auf Verlangen müssen Sie dem Mieter Einsicht in die Belege gewähren. Der Mieter hat nach Zugang der Abrechnung zwölf Monate Zeit, Einwendungen zu erheben. Eine ordentliche, nachvollziehbare Abrechnung mit Rechenweg beugt Streit vor.",
        ],
      },
    ],
    feature: {
      titel: "NK-Abrechnung mit MyImmo",
      text:
        "Der Umlage-Assistent verteilt jede Position cent-genau nach Fläche oder Einheit, rechnet unterjährige Mieterwechsel tagegenau ab und erzeugt eine fertige Abrechnung als PDF — inklusive § 35a-Ausweis für Ihre Mieter.",
      href: "/anmelden",
      cta: "Kostenlos ausprobieren",
    },
  },
  {
    slug: "grundsteuer-2025-auf-mieter-umlegen",
    titel: "Grundsteuer 2025 richtig auf die Mieter umlegen",
    beschreibung:
      "Nach der Grundsteuerreform haben sich viele Beträge geändert. So legen Sie die neue Grundsteuer korrekt um und passen Vorauszahlungen an.",
    kategorie: "Nebenkosten",
    datum: "2026-07-15",
    lesezeit: 4,
    kurzcheck: {
      fall:
        "Der neue Grundsteuerbescheid liegt vor, der Betrag ist deutlich höher als bisher — und offen ist, ob und ab wann der Mieter das trägt.",
      passt: [
        "Ihr Grundsteuerbetrag hat sich durch die Reform verändert.",
        "Sie wollen wissen, welcher Bescheid in welches Abrechnungsjahr gehört.",
        "Sie prüfen, ob Ihre Betriebskostenklausel die Grundsteuer überhaupt erfasst.",
      ],
      nichtNoetig:
        "Bei einer Bruttomiete ohne Betriebskostenumlage bleibt die Grundsteuer bei Ihnen — dann ist der Artikel nur zur Einordnung interessant.",
    },
    intro:
      "Seit dem 1.1.2025 gilt die reformierte Grundsteuer. Je nach Kommune und Landesmodell haben sich die Beträge teils deutlich verändert — nach oben wie nach unten. Für die Abrechnung 2025, die Sie 2026 erstellen, ist das relevant.",
    sektionen: [
      {
        h: "Grundsteuer bleibt voll umlagefähig",
        p: [
          "Die Grundsteuer (Grundsteuer B) zählt zu den umlagefähigen Betriebskosten nach § 2 Nr. 1 BetrKV. Voraussetzung ist eine wirksame Betriebskostenklausel im Mietvertrag. Umgelegt wird der tatsächlich gezahlte Jahresbetrag laut Grundsteuerbescheid.",
        ],
      },
      {
        h: "Neuen Bescheid zugrunde legen",
        p: [
          "Verwenden Sie für die Abrechnung 2025 den neuen Grundsteuerbescheid Ihrer Gemeinde. Prüfen Sie den Betrag — durch die Reform weichen viele Werte von den Vorjahren ab. Bei Mehrfamilienhäusern wird der Gesamtbetrag nach dem vereinbarten Schlüssel (i. d. R. Wohnfläche) auf die Einheiten verteilt.",
        ],
      },
      {
        h: "Vorauszahlung anpassen (§ 560 BGB)",
        p: [
          "Ist die Grundsteuer deutlich gestiegen, können Sie die monatliche Vorauszahlung nach einer Abrechnung anpassen — angemessen und mit Erklärung gegenüber dem Mieter. So vermeiden Sie hohe Nachzahlungen im Folgejahr. Ist sie gesunken, ist eine Senkung fair und beugt Guthaben-Rückzahlungen vor.",
        ],
      },
    ],
    feature: {
      titel: "Grundsteuer automatisch verteilen",
      text:
        "In MyImmo tragen Sie den neuen Jahresbetrag einmal ein — der Umlage-Assistent verteilt ihn auf alle Einheiten und übernimmt ihn in die Nebenkostenabrechnung.",
      href: "/anmelden",
      cta: "Jetzt starten",
    },
  },
  {
    slug: "paragraf-35a-mieter-steuern-sparen",
    titel: "§ 35a EStG: So sparen Ihre Mieter Steuern — und Sie sich Rückfragen",
    beschreibung:
      "Mieter können Lohnkosten aus den Nebenkosten absetzen. Mit dem richtigen Ausweis in der Abrechnung geben Sie ihnen bares Geld und sparen sich Nachfragen.",
    kategorie: "Steuer",
    datum: "2026-07-15",
    lesezeit: 5,
    kurzcheck: {
      fall:
        "Ein Mieter bittet Sie, die Handwerker- und Dienstleistungskosten aus der Nebenkostenabrechnung getrennt auszuweisen — er will sie in seiner Steuererklärung geltend machen.",
      passt: [
        "Ein Mieter hat nach einer Bescheinigung für haushaltsnahe Leistungen gefragt.",
        "Sie wollen wissen, welche Positionen der Abrechnung dafür überhaupt in Frage kommen.",
        "Sie möchten den Ausweis freiwillig anbieten, um Rückfragen einzusparen.",
      ],
      nichtNoetig:
        "Für Ihre eigene Steuererklärung als Vermieter bringt die Vorschrift nichts — dort zählen dieselben Kosten ohnehin voll als Werbungskosten.",
    },
    intro:
      "Viele Mieter wissen nicht, dass in ihrer Nebenkostenabrechnung steuerlich absetzbare Arbeitskosten stecken. Als Vermieter können Sie diese ausweisen — ein kleiner Service mit großer Wirkung für die Mieterzufriedenheit.",
    sektionen: [
      {
        h: "Worum geht es bei § 35a EStG?",
        p: [
          "Mieter können 20 % der in ihren Nebenkosten enthaltenen Arbeits-/Lohnkosten von ihrer Einkommensteuer abziehen: haushaltsnahe Dienstleistungen (§ 35a Abs. 2) mit bis zu 4.000 € im Jahr, Handwerkerleistungen (§ 35a Abs. 3) mit bis zu 1.200 €. Materialkosten zählen nicht mit.",
        ],
      },
      {
        h: "Was zählt als haushaltsnah, was als Handwerker?",
        liste: [
          "Haushaltsnahe Dienstleistungen: Hausmeister, Gartenpflege, Treppenhausreinigung, Winterdienst, Schornsteinfeger-Kehrarbeiten.",
          "Handwerkerleistungen: Wartung von Aufzug/Heizung, Reparaturen am Gemeinschaftseigentum, Prüfungen (z. B. der Elektroanlage).",
        ],
      },
      {
        h: "Ihre Rolle als Vermieter",
        p: [
          "Der Bundesfinanzhof hat entschieden (VI R 24/20), dass Mieter die Beträge auch ohne eigenen Vertrag mit dem Dienstleister absetzen können — sofern sie aus der Abrechnung hervorgehen. Nachweis ist entweder eine entsprechend aufgeschlüsselte Betriebskostenabrechnung oder eine gesonderte Bescheinigung. Ein solcher Ausweis ist ein starkes Service-Argument und erspart Ihnen Rückfragen.",
        ],
      },
    ],
    feature: {
      titel: "§ 35a-Ausweis auf Knopfdruck",
      text:
        "Bei jeder Position tragen Sie den Arbeitskostenanteil ein und ordnen ihn zu. MyImmo verteilt ihn auf die Mieter und weist auf der Abrechnung die absetzbaren Beträge nach § 35a Abs. 2 und Abs. 3 gesondert aus.",
      href: "/anmelden",
      cta: "Funktion testen",
    },
  },
  {
    slug: "anschaffungsnahe-herstellungskosten-15-prozent",
    titel: "Die 15-%-Falle: anschaffungsnahe Herstellungskosten vermeiden",
    beschreibung:
      "Wer nach dem Kauf zu viel renoviert, verliert den Sofortabzug. So funktioniert die 15-%-Grenze nach § 6 Abs. 1 Nr. 1a EStG — und wie Sie sie im Blick behalten.",
    kategorie: "Steuer",
    datum: "2026-07-15",
    lesezeit: 5,
    kurzcheck: {
      fall:
        "Sie haben die Wohnung vor 14 Monaten gekauft und seitdem Bad und Elektrik für 38.000 € erneuert — bei Gebäude-Anschaffungskosten von 240.000 €.",
      passt: [
        "Ihr Kauf liegt weniger als drei Jahre zurück.",
        "Sie planen eine größere Sanierung kurz nach dem Erwerb.",
        "Sie wollen wissen, welche Kosten in die Grenze einzurechnen sind und welche nicht.",
      ],
      nichtNoetig:
        "Liegt der Kauf länger als drei Jahre zurück, ist die Grenze für dieses Objekt erledigt.",
    },
    intro:
      "Direkt nach dem Kauf einer vermieteten Immobilie wird oft renoviert. Wer dabei zu viel ausgibt, tappt in eine teure Steuerfalle: Aus sofort abziehbaren Werbungskosten werden Herstellungskosten, die sich nur über Jahrzehnte abschreiben lassen.",
    sektionen: [
      {
        h: "Was besagt die 15-%-Grenze?",
        p: [
          "Übersteigen die Instandsetzungs- und Modernisierungskosten innerhalb von drei Jahren nach der Anschaffung netto 15 % der auf das Gebäude entfallenden Anschaffungskosten, gelten sie insgesamt als anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG). Folge: kein Sofortabzug, sondern nur die jährliche AfA von 2–3 %.",
        ],
      },
      {
        h: "Ein Rechenbeispiel",
        p: [
          "Kaufpreis 300.000 €, davon 80 % Gebäudeanteil = 240.000 €. Die 15-%-Grenze liegt bei 36.000 €. Renovieren Sie in den ersten drei Jahren für 40.000 €, kippt der gesamte Betrag in die AfA — statt rund 40.000 € sofort können Sie nur etwa 800–1.200 € pro Jahr absetzen.",
        ],
      },
      {
        h: "So bleiben Sie auf der sicheren Seite",
        liste: [
          "Kosten im Blick behalten und die Summe der ersten drei Jahre gegen die Grenze rechnen.",
          "Größere Maßnahmen ggf. hinter den Drei-Jahres-Stichtag verschieben.",
          "Jährlich übliche Erhaltungsarbeiten sind ausgenommen — sauber dokumentieren.",
        ],
      },
    ],
    feature: {
      titel: "Der 15-%-Wächter in MyImmo",
      text:
        "MyImmo kennt Kaufpreis, Gebäudeanteil und Kaufdatum und zeigt auf jeder Objektseite einen Fortschrittsbalken: Wie viel der 15-%-Grenze ist ausgeschöpft, wie lange läuft das Fenster noch — mit Warnung, bevor es teuer wird.",
      href: "/anmelden",
      cta: "Objekt anlegen",
    },
  },
  {
    slug: "geerbte-immobilie-vermieten-erste-schritte",
    titel: "Geerbte Immobilie vermieten: die ersten Schritte",
    beschreibung:
      "Vom Grundbuch über die Steuer bis zur ersten Abrechnung — ein Leitfaden für alle, die unerwartet zum Vermieter werden.",
    kategorie: "Einstieg",
    datum: "2026-07-15",
    lesezeit: 6,
    kurzcheck: {
      fall:
        "Die geerbte Wohnung ist vermietet, der Mieter überweist weiter auf ein Konto, das bald aufgelöst wird — und Sie sind seit vier Wochen Vermieter, ohne es geplant zu haben.",
      passt: [
        "Sie haben eine vermietete Immobilie geerbt und wollen sie behalten.",
        "Sie wissen nicht, was Sie den Mietern mitteilen müssen.",
        "Sie haben noch nie eine Mietverwaltung geführt.",
      ],
      nichtNoetig:
        "Fristen, Erbschaftsteuer und die erste Abrechnung stehen ausführlich im Ratgeber zu Steuern und Fristen nach dem Erbfall.",
    },
    intro:
      "Immer mehr Menschen werden durch Erbschaft zu Vermietern — oft ohne Vorerfahrung. Dieser Leitfaden ordnet die wichtigsten ersten Schritte, damit aus der geerbten Wohnung kein Bürokratie-Albtraum wird.",
    sektionen: [
      {
        h: "1. Eigentum klären und Grundbuch berichtigen",
        p: [
          "Nach dem Erbfall sollten Sie die Grundbuchberichtigung veranlassen (innerhalb von zwei Jahren nach dem Erbfall gebührenfrei mit Erbschein oder notariellem Testament). Bei einer Erbengemeinschaft entscheiden alle Miterben gemeinsam über die Immobilie.",
        ],
      },
      {
        h: "2. Bestehende Mietverhältnisse übernehmen",
        p: [
          "Sie treten als Erbe in laufende Mietverträge ein — unverändert. Informieren Sie die Mieter über den Eigentümerwechsel und die neue Bankverbindung für die Miete. Kündigen wegen Eigenbedarf ist nur unter engen Voraussetzungen möglich.",
        ],
      },
      {
        h: "3. Steuerliche Weichen stellen",
        p: [
          "Mieteinnahmen gehören in die Anlage V der Einkommensteuererklärung. Als Abschreibungsbasis dient bei geerbten Immobilien die frühere Anschaffung des Erblassers (Fußstapfentheorie) — die AfA läuft fort. Bewahren Sie alte Kaufunterlagen und Belege auf; sie sind für die Abschreibung wertvoll.",
        ],
      },
      {
        h: "4. Einnahmen und Ausgaben von Anfang an erfassen",
        p: [
          "Wer Mieten, Nebenkosten und Reparaturen von Beginn an sauber dokumentiert, spart am Jahresende viel Arbeit und verschenkt keine absetzbaren Kosten. Eine einfache Verwaltungssoftware nimmt Ihnen die Struktur ab.",
        ],
      },
    ],
    feature: {
      titel: "Der einfache Einstieg",
      text:
        "MyImmo führt Sie Schritt für Schritt: Objekt anlegen, Mieter erfassen, Ein- und Ausgaben buchen — und am Jahresende steht Ihre Anlage V fast von selbst. Gemacht für Vermieter ohne Vorerfahrung.",
      href: "/anmelden",
      cta: "Kostenlos starten",
    },
  },
];

export function ratgeberBySlug(slug: string): RatgeberArtikel | undefined {
  return RATGEBER.find((a) => a.slug === slug);
}

const MONATE_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
export function ratgeberDatum(iso: string): string {
  const [j, m, t] = iso.split("-").map(Number);
  return `${t}. ${MONATE_DE[(m ?? 1) - 1]} ${j}`;
}
