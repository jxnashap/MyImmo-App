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
