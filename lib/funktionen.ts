// Funktions-Landingpages (SEO): je eine Seite pro Kernaufgabe, geschrieben auf
// die Suchabsicht „ich habe dieses Problem und suche ein Werkzeug dafür".
//
// Bewusst getrennt von der Übersicht `/funktionen`: Die Übersicht bedient den
// Vergleich („was kann die App alles"), diese Seiten bedienen die Einzelsuche
// („nebenkostenabrechnung software"). Beides in eine Seite zu pressen kostet
// die Rangfolge für beide Absichten.
//
// Regel für jede Seite: erst das Problem in der Sprache des Vermieters, dann
// die Lösung, dann der Beweis (Zahlen, Rechenweg) — Produktnennung nie zuerst.
// Verlinkt jeweils die passenden Ratgeber-Artikel; die Artikel verweisen über
// ihren Feature-Kasten zurück.

export type FunktionsAbschnitt = { h: string; p?: string[]; liste?: string[] };

export type Funktionsseite = {
  slug: string;
  titel: string;          // H1
  metaTitel: string;      // <title>
  beschreibung: string;   // Meta-Description
  kicker: string;
  sub: string;            // Unterzeile unter der H1
  problem: { h: string; p: string[] };
  abschnitte: FunktionsAbschnitt[];
  /** Slugs aus lib/ratgeber.ts — interne Verlinkung in beide Richtungen. */
  ratgeber: string[];
  cta: { titel: string; text: string };
};

export const FUNKTIONSSEITEN: Funktionsseite[] = [
  {
    slug: "nebenkostenabrechnung",
    metaTitel: "Nebenkostenabrechnung erstellen — Software für Vermieter",
    titel: "Nebenkostenabrechnung, die formell hält",
    beschreibung:
      "Nebenkostenabrechnung für private Vermieter: Umlageschlüssel je Position, tagegenaue Abrechnung bei Mieterwechsel, fertiges PDF mit ausgewiesenem Rechenweg.",
    kicker: "Nebenkosten",
    sub: "Umlageschlüssel je Kostenart, Heizkosten nach Verordnung, Mieterwechsel tagegenau — am Ende ein PDF, das die vier Pflichtangaben von sich aus enthält.",
    problem: {
      h: "Warum über 80 Prozent der Abrechnungen fehlerhaft sind",
      p: [
        "Eine Nebenkostenabrechnung ist keine schwierige Rechnung. Sie ist eine Rechnung mit vielen Nebenbedingungen: Jede Kostenart braucht den passenden Verteilerschlüssel, Heizung und Warmwasser folgen einer eigenen Verordnung, ein Mieterwechsel muss tagegenau aufgeteilt werden, und formell verlangt der Bundesgerichtshof vier Mindestangaben, ohne die alles unwirksam ist.",
        "In einer Tabellenkalkulation passt jeder dieser Punkte einzeln — bis einer vergessen wird. Genau daran scheitern die meisten Abrechnungen, und die durchschnittliche Korrektur liegt bei mehreren hundert Euro.",
      ],
    },
    abschnitte: [
      {
        h: "Was MyImmo übernimmt",
        liste: [
          "Verteilerschlüssel je Kostenart statt einmal für die ganze Abrechnung — Grundsteuer nach Fläche, Müll nach Personen, Wasser nach Zähler.",
          "Heizung und Warmwasser mit der Spanne zwischen 50 und 70 Prozent nach Verbrauch, der Rest nach Fläche.",
          "Mieterwechsel tagegenau, nicht pauschal halbiert.",
          "Die vier Pflichtangaben sind fest eingebaut: Gesamtkosten, Schlüssel mit Erläuterung, Anteilsberechnung, Abzug der Vorauszahlungen.",
          "Getrennter Ausweis der haushaltsnahen Leistungen nach § 35a EStG für Ihre Mieter.",
          "Fertiges PDF im eigenen Briefkopf, mit nachvollziehbarem Rechenweg.",
        ],
      },
      {
        h: "Belege per Foto statt Abtippen",
        p: [
          "Versorgerrechnungen und Bescheide lassen sich fotografieren oder als PDF hochladen; die Beträge werden ausgelesen und der passenden Kostenart zugeordnet. Sie prüfen und bestätigen — die App entscheidet nichts still.",
          "Jeder Beleg bleibt an seiner Position hängen. Fragt ein Mieter nach Belegeinsicht, ist das eine Sache von Minuten statt eines Aktenordner-Nachmittags.",
        ],
      },
      {
        h: "Die Frist meldet sich selbst",
        p: [
          "Die Abrechnung muss dem Mieter binnen zwölf Monaten nach Ende des Abrechnungszeitraums zugehen. Danach ist eine Nachforderung ausgeschlossen — ein Guthaben müssen Sie trotzdem auszahlen.",
          "MyImmo trägt diese Frist je Objekt selbst nach und meldet sich rechtzeitig, statt zu warten, bis Sie daran denken.",
        ],
      },
    ],
    ratgeber: [
      "nebenkostenabrechnung-erstellen-schritt-fuer-schritt",
      "umlageschluessel-flaeche-personen-verbrauch",
      "heizkostenabrechnung-50-70-regel-fernablesung",
      "belegeinsicht-was-mieter-verlangen-duerfen",
    ],
    cta: {
      titel: "Die nächste Abrechnung an einem Abend",
      text: "Objekt anlegen, Kosten erfassen, Schlüssel wählen — das PDF steht am Ende von selbst.",
    },
  },
  {
    slug: "steuer-anlage-v",
    metaTitel: "Anlage V für Vermieter — Software für die Steuererklärung",
    titel: "Anlage V, ohne das Jahr zu rekonstruieren",
    beschreibung:
      "Einkünfte aus Vermietung und Verpachtung je Objekt: Abschreibung, Zinsanteil, Erhaltungsaufwand — als Ausfüllhilfe für die Anlage V, PDF-Aufstellung und DATEV-Export.",
    kicker: "Steuer",
    sub: "Einnahmen und Ausgaben werden das ganze Jahr über den Kategorien der Anlage V zugeordnet. Im Frühjahr steht die Aufstellung, statt dass Sie Kontoauszüge sortieren.",
    problem: {
      h: "Das Problem ist nicht das Formular, sondern der März",
      p: [
        "Die Anlage V ist überschaubar. Was sie mühsam macht, ist der Zustand der Unterlagen, wenn man sie ausfüllt: ein Jahr Kontoauszüge, Rechnungen in zwei Ordnern, eine Zinsbescheinigung, und irgendwo die Frage, wie hoch die Abschreibung noch mal war.",
        "Wer erst im März sortiert, findet nicht alles. Was nicht gefunden wird, wird nicht abgesetzt — und das ist teurer als jede Software.",
      ],
    },
    abschnitte: [
      {
        h: "Was MyImmo übernimmt",
        liste: [
          "Jede Buchung wird beim Erfassen der richtigen Kategorie der Anlage V zugeordnet.",
          "Abschreibung aus Kaufpreis, Nebenkosten, Gebäudeanteil und Baujahr — im Anschaffungsjahr automatisch zeitanteilig.",
          "Bei Krediten wird der Zinsanteil getrennt geführt; nur er ist Werbungskosten, die Tilgung nicht.",
          "Erhaltungsaufwand wahlweise sofort oder über zwei bis fünf Jahre verteilt, mit Jahresrate in den Folgejahren.",
          "Aufstellung je Objekt als PDF, Buchungen als CSV, dazu ein DATEV-Export für den Steuerberater.",
        ],
      },
      {
        h: "Der Wächter, den sonst niemand hat",
        p: [
          "Wer in den ersten drei Jahren nach dem Kauf saniert, kann eine unangenehme Grenze reißen: Übersteigen die Instandsetzungskosten 15 Prozent der Gebäude-Anschaffungskosten, werden sie insgesamt zu anschaffungsnahen Herstellungskosten. Aus dem sofortigen Abzug wird eine Abschreibung über Jahrzehnte.",
          "MyImmo rechnet diesen Stand laufend mit und warnt, bevor die Grenze erreicht ist — nicht erst im Steuerbescheid. Das ist der Unterschied zwischen einer Warnung und einer Nachricht.",
        ],
      },
      {
        h: "Was die App nicht tut",
        p: [
          "MyImmo rechnet und stellt zusammen. Sie berät nicht: Welche Angaben in Ihrem Fall richtig sind, ob eine Verteilung günstiger ist als der Sofortabzug und wie ein Sachverhalt einzuordnen ist, entscheiden Sie mit Ihrem Steuerberater.",
          "Diese Grenze ist Absicht. Eine App, die so tut, als ersetze sie steuerliche Beratung, hilft niemandem — sie verlagert nur das Risiko auf Sie.",
        ],
      },
    ],
    ratgeber: [
      "anlage-v-ausfuellen-abschnitt-fuer-abschnitt",
      "afa-richtig-ansetzen-linear-degressiv",
      "erhaltungsaufwand-verteilen-82b-estdv",
      "anschaffungsnahe-herstellungskosten-15-prozent",
    ],
    cta: {
      titel: "Nächstes Jahr ohne Zettelwirtschaft",
      text: "Ab der ersten Buchung sortiert sich das Jahr von selbst — die Aufstellung fällt am Ende ab.",
    },
  },
  {
    slug: "mietkonto",
    metaTitel: "Mietkonto führen — Mieteingänge und Rückstände im Blick",
    titel: "Mietkonto: Sie sehen den Rückstand, bevor er einer wird",
    beschreibung:
      "Sollstellung, Zahlungseingänge und offene Posten je Mietverhältnis — mit Warnung bei ausbleibender Miete und fertigem Mahnschreiben im eigenen Briefkopf.",
    kicker: "Mietkonto",
    sub: "Für jedes Mietverhältnis wird geführt, was geschuldet ist und was gezahlt wurde. Bleibt eine Zahlung aus, sagt die App Bescheid — statt dass es beim Jahresabschluss auffällt.",
    problem: {
      h: "Rückstände fallen zu spät auf",
      p: [
        "Bei einer Wohnung merkt man eine fehlende Miete. Bei drei Wohnungen mit unterschiedlichen Zahlungsterminen, einer Anpassung im Sommer und einer Nachzahlung aus der Abrechnung merkt man sie oft erst, wenn zwei Monate offen sind.",
        "Das ist nicht nur ein Liquiditätsproblem. Eine Kündigung wegen Zahlungsverzugs setzt voraus, dass der Rückstand nachweisbar ist — und der Nachweis gelingt nur mit einer sauberen Sollstellung.",
      ],
    },
    abschnitte: [
      {
        h: "Was MyImmo übernimmt",
        liste: [
          "Sollstellung je Mietverhältnis aus Kaltmiete und Vorauszahlung, mit Wirkung ab dem richtigen Monat bei jeder Anpassung.",
          "Zahlungseingänge werden gegen das Soll gestellt; offene Posten stehen mit Betrag und Monat da.",
          "Der Rückstands-Wächter meldet sich, sobald eine Miete ausbleibt — nicht erst am Jahresende.",
          "Nachzahlungen und Guthaben aus der Nebenkostenabrechnung laufen ins selbe Konto, statt daneben zu liegen.",
          "Mahnung und Zahlungserinnerung als fertige Brief-PDFs im eigenen Briefkopf.",
        ],
      },
      {
        h: "Kaution getrennt geführt",
        p: [
          "Die Kaution beträgt höchstens drei Nettokaltmieten, der Mieter darf sie in drei Raten zahlen, und sie ist getrennt von Ihrem Vermögen anzulegen. MyImmo führt Betrag, Raten und Anlageort je Mietverhältnis — samt Bankverbindung, die wie alle Bankdaten zusätzlich verschlüsselt gespeichert wird.",
          "Beim Auszug steht damit fest, was einbehalten wurde und warum. Das ist die Unterlage, die im Streitfall zählt.",
        ],
      },
    ],
    ratgeber: [
      "erste-vermietung-zehn-schritte",
      "mieterhoehung-fristen-kappungsgrenze-formfehler",
      "mietvertrag-pruefen-klauseln-kleinvermieter",
    ],
    cta: {
      titel: "Offene Posten auf einen Blick",
      text: "Mietverhältnis anlegen, Zahlungen erfassen — den Rest meldet die App.",
    },
  },
  {
    slug: "termine-fristen",
    metaTitel: "Fristen für Vermieter im Blick — Termine automatisch",
    titel: "Die Fristen, die Geld kosten, wenn man sie verpasst",
    beschreibung:
      "Abrechnungsfrist, Mieterhöhung, Zinsbindung, Wartungen: MyImmo leitet Termine aus Ihren Daten ab und meldet sich rechtzeitig — als Kalender und iCal-Export.",
    kicker: "Termine",
    sub: "Nicht noch eine Liste, die gepflegt werden will: Die Fristen entstehen aus den Daten, die ohnehin in der App stehen.",
    problem: {
      h: "Fristen melden sich nicht von selbst",
      p: [
        "Die Nebenkostenabrechnung muss binnen zwölf Monaten zugehen, sonst ist die Nachforderung weg. Eine Mieterhöhung setzt voraus, dass die Miete 15 Monate unverändert war. Die Zinsbindung endet an einem Datum, das drei Jahre vorher vereinbart wurde. Rauchwarnmelder, Heizung und Trinkwasser haben eigene Prüfzyklen.",
        "Keine dieser Fristen schickt eine Erinnerung. Wer sie in einem Kalender pflegt, pflegt eine zweite Datenbank — und die veraltet, sobald sich ein Mietverhältnis ändert.",
      ],
    },
    abschnitte: [
      {
        h: "Abgeleitet statt gepflegt",
        p: [
          "MyImmo erzeugt die Termine aus den vorhandenen Daten: Aus dem Abrechnungszeitraum folgt die Abrechnungsfrist, aus dem Datum der letzten Mieterhöhung der früheste nächste Termin, aus dem Kredit das Ende der Zinsbindung, aus dem Mietverhältnis die Kündigungs- und Staffeltermine.",
          "Ändert sich die Grundlage, ändert sich der Termin mit. Das ist der Unterschied zu jedem Kalendereintrag, den man einmal anlegt und danach vergisst.",
        ],
      },
      {
        h: "Was zusammenkommt",
        liste: [
          "Zwölf-Monats-Frist der Nebenkostenabrechnung je Objekt.",
          "Früheste zulässige Mieterhöhung je Mietverhältnis.",
          "Ende der Zinsbindung, mit Vorlauf für die Anschlussfinanzierung.",
          "Wiederkehrende Wartungen und Prüfungen, frei anlegbar.",
          "Eigene Termine und Notizen, wo die Ableitung nicht reicht.",
          "iCal-Export in den Kalender, den Sie ohnehin benutzen.",
        ],
      },
      {
        h: "Ausblendbar, wo es nicht passt",
        p: [
          "Nicht jede abgeleitete Frist trifft jeden Fall. Termine, die für Ihr Objekt keine Rolle spielen, lassen sich ausblenden — dauerhaft, aber nicht endgültig: Eine wiederkehrende Frist kommt im Folgejahr zurück, sonst wäre sie für immer stumm.",
        ],
      },
    ],
    ratgeber: [
      "nebenkostenabrechnung-fristen-fehler",
      "mieterhoehung-fristen-kappungsgrenze-formfehler",
      "heizkostenabrechnung-50-70-regel-fernablesung",
    ],
    cta: {
      titel: "Einmal eintragen, dann erinnert die App",
      text: "Die Fristen entstehen aus Ihren Objekten und Mietverhältnissen — ohne zweite Liste.",
    },
  },
];

export function funktionsseiteBySlug(slug: string): Funktionsseite | undefined {
  return FUNKTIONSSEITEN.find((f) => f.slug === slug);
}
