// Ratgeber-Inhalte (SEO): strukturierte Artikel für private Vermieter, die auf
// die passenden MyImmo-Funktionen verweisen. Reiner Content, keine DB.
// Rechtsstand Juli 2026 — Anhaltspunkte ohne Gewähr, keine Steuer-/Rechtsberatung.

export type RatgeberSektion = { h?: string; p?: string[]; liste?: string[] };

export type RatgeberFeature = { titel: string; text: string; href: string; cta: string };

export type RatgeberArtikel = {
  slug: string;
  titel: string;
  beschreibung: string; // Meta-Description / Teaser
  kategorie: "Nebenkosten" | "Steuer" | "Recht" | "Einstieg";
  datum: string;        // ISO
  lesezeit: number;     // Minuten
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
          "Stand Juli 2026. Dieser Text gibt Anhaltspunkte ohne Gewähr und ersetzt keine Rechts- oder Steuerberatung. Bei strittigen Positionen oder ungewöhnlichen Vertragsklauseln lohnt der Gang zum Fachanwalt für Mietrecht oder zum Vermieterverein.",
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
          "Stand Juli 2026. Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Bei ungewöhnlichen Vertragsklauseln oder gemischt genutzten Objekten lohnt die anwaltliche Prüfung.",
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
          "Stand Juli 2026. Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Ob Ihr Gebäude unter die 70-Prozent-Regel oder unter eine Ausnahme fällt, klären Sie im Zweifel mit Ihrem Messdienstleister oder anwaltlich.",
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
          "Stand Juli 2026. Anhaltspunkte ohne Gewähr, keine Rechts- oder Steuerberatung. Die Rechtsprechung zur Zumutbarkeit der Anreise ist einzelfallabhängig.",
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
    slug: "nebenkostenabrechnung-fristen-fehler",
    titel: "Nebenkostenabrechnung: Fristen und die häufigsten Fehler",
    beschreibung:
      "Die 12-Monats-Frist nach § 556 BGB, Belegeinsicht, korrekte Umlageschlüssel — und die Fehler, die Vermieter bares Geld kosten.",
    kategorie: "Nebenkosten",
    datum: "2026-07-15",
    lesezeit: 6,
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
