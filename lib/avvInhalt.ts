// Auftragsverarbeitungsvertrag (Art. 28 DSGVO), den MyImmo seinen Nutzern anbietet.
//
// EINE Quelle für die Seite /avv UND das PDF (`scripts/gen-avv-pdf.mjs`). Bis 06.10.2026 stand
// der Text zweimal da und lief auseinander: Das PDF nannte noch Enable Banking (seit 29.08.2026
// entfernt), die Seite kannte Brevo nicht, obwohl Brevo Einladungen an Mieter verschickt.
//
// Reine Daten ohne Importe — das Skript liest die Datei mit `node --experimental-strip-types`
// (keine Pfad-Aliase, keine Enums). `**fett**` wird auf der Seite fett gesetzt, im PDF entfernt.
//
// Ändert sich ein Subauftragsverarbeiter, eine Funktion mit Daten Dritter oder eine TOM:
// hier ändern, `AVV_STAND` setzen, PDF neu erzeugen (`node --experimental-strip-types
// scripts/gen-avv-pdf.mjs`). Ein neuer Subauftragsverarbeiter ist nach Ziffer 7 VORAB
// anzukündigen (14 Tage Widerspruch) — bei echten Nutzern nicht still eintragen.

export type AvvBlock =
  | { h: string }
  | { p: string }
  | { b: string }
  | { kv: [string, string][] }
  | { ul: string[] }
  | { note: string }
  | { sign: true };

export const AVV_STAND = "6. Oktober 2026";
export const AVV_STAND_KURZ = "06.10.2026";
export const AVV_STAND_ISO = "2026-10-06";

export const AVV_HINWEIS =
  "Hinweis für den Betreiber: Entwurf — vor produktiver Akzeptanz anwaltlich prüfen lassen. Keine Rechtsberatung.";

export const AVV_BLOECKE: AvvBlock[] = [
  { h: "1. Parteien, Gegenstand und Dauer" },
  {
    kv: [
      ["Verantwortlicher:", "die Nutzerin / der Nutzer des jeweiligen MyImmo-Kontos (Vermieter)."],
      ["Auftragsverarbeiter:", "Jonas Scharp (MyImmo), Ludwig-Jahn-Straße 42, 23611 Bad Schwartau („Betreiber“)."],
    ],
  },
  {
    p: "Gegenstand ist die Bereitstellung der Web-Anwendung MyImmo zur Immobilien- und Mietverwaltung, in der der Verantwortliche personenbezogene Daten Dritter (insbesondere seiner Mieter und Mietinteressenten) speichert und verarbeitet. Die Vereinbarung gilt für die Dauer des Nutzungsverhältnisses und endet mit der Löschung des Kontos.",
  },
  {
    note: "Nicht Gegenstand dieser Fassung: Die treuhänderische Verwaltung fremder Immobilienbestände durch gewerbliche Hausverwaltungen (Mehrmandanten-Verwaltung) wird — vor ihrer produktiven Nutzung — durch eine gesonderte Ergänzung dieses Vertrags geregelt.",
  },

  { h: "2. Art und Zweck der Verarbeitung" },
  {
    p: "Hosting, Speicherung, Anzeige, Auswertung und Ausgabe (z. B. Abrechnungen, Briefe, Exporte) der vom Verantwortlichen erfassten Daten. Hinzu kommen — jeweils auf Veranlassung des Verantwortlichen:",
  },
  {
    ul: [
      "**Mieterportal** für die von ihm eingeladenen Mieter: Meldung von Zählerständen mit Foto-Beleg, Schadens- und sonstige Anliegen mit Foto-/Dokumentanhängen und Nachrichtenverlauf, Terminabstimmung, Einsicht in das eigene Mietkonto, Mitteilungen und Gebäude-Informationen sowie die **Zustellung von Dokumenten** (z. B. Nebenkostenabrechnung) an das verbundene Konto des Mieters mit Zeitpunkt von Zustellung, Abruf und Lesebestätigung. Nach dem Auszug bleibt der Zugang bis zum 31.12. des Folgejahres bestehen, danach endet er;",
      "**Versand von E-Mails**: Einladungen ins Mieterportal an die vom Verantwortlichen eingetragene Adresse des Mieters sowie inhaltslose Hinweis-E-Mails („es liegt etwas Neues bereit“) an die Adresse des jeweiligen Kontos; Briefe an Mieter (z. B. Zahlungserinnerungen) versendet der Betreiber nicht — sie erzeugt der Verantwortliche als PDF und verschickt sie selbst;",
      "**Mietbewerbungen**: Erfassung und Auswertung von Selbstauskünften von Mietinteressenten;",
      "**Service-Partner**: Abwicklung von Aufträgen mit vom Verantwortlichen beauftragten Hausmeistern und Dienstleistern (mit eigenem Zugang) einschließlich Fotos und Notizen zum Auftrag, Freigabe-Anträgen und der für Termin und Leistung erforderlichen Weitergabe von Objekt- und Mieterkontaktdaten; Angebotsanfragen an Fachbetriebe über einen befristeten Link, Mieterkontaktdaten dort erst bei Beauftragung und nur auf ausdrückliche Auswahl;",
      "**Freigabe-Links** an vom Verantwortlichen benannte Empfänger (Bank, Makler): nur ausgewählte Dokumente, befristet, widerrufbar, nur mit Zugangscode; jeder Abruf wird mit Zeitpunkt und Dokument protokolliert (ohne IP-Adresse); Dateien, die der Empfänger zurückschickt, landen in einem Eingang des Verantwortlichen; der Empfänger kann außerdem bis zu drei Terminvorschläge machen oder um Rückruf bitten, die nur der Verantwortliche sieht;",
      "**Vertrauensperson**: Stammdaten einer vom Verantwortlichen benannten Person und ihrer Vollmacht (einschließlich Scan) für Bank-, Notar- und Darlehensangelegenheiten; die Person erhält keinen Zugang zur App;",
      "**KI-gestützte Dokumentauswertung** (z. B. Auslesen einer Nebenkostenabrechnung), nur wenn der Verantwortliche sie auslöst.",
    ],
  },
  { p: "Eine Verarbeitung zu eigenen Zwecken des Betreibers findet nicht statt." },

  { h: "3. Art der Daten und Kategorien betroffener Personen" },
  { b: "Datenarten:" },
  {
    ul: [
      "Stammdaten (Name, Anschrift, Kontaktdaten);",
      "Vertragsdaten des Mietverhältnisses (Mietbeginn/-ende, Miete, Kaution, Einheit);",
      "Abrechnungs- und Zahlungsdaten einschließlich Bankverbindung (letztere anwendungsseitig verschlüsselt);",
      "Verbrauchsdaten, einschließlich der vom Mieter selbst gemeldeten Zählerstände nebst Foto-Belegen;",
      "Anliegen- und Kommunikationsdaten: vom Mieter gemeldete Schäden, Fragen und Dokumentanfragen mit Freitext und Foto-/PDF-Anhängen; Nachrichten zwischen Verantwortlichem und Mieter; Daten zur Terminkoordination;",
      "Zustell- und Abrufdaten: Zeitpunkt der Zustellung eines Dokuments, seines Abrufs und der Lesebestätigung; Protokoll der Abrufe über Freigabe-Links (Zeitpunkt und Dokument);",
      "Dokumente, Belege und Übergabeprotokolle, einschließlich der über Freigabe-Links zurückgeschickten Dateien;",
      "Bewerbungsdaten von Mietinteressenten: selbst angegebene Angaben zu Beruf, Arbeitgeber, Netto-Einkommen, Bonität/SCHUFA, Haushaltsgröße, Haustieren/Rauchen, eine Freitext-Nachricht sowie eine elektronische Unterschrift;",
      "Auftrags- und Dienstleisterdaten: Aufträge an Service-Partner (Titel, Beschreibung, Tätigkeit, Objekt- und Vermietername, Termin, Betrag, Lohnanteil nach § 35a EStG), Fotos und Notizen zum Auftrag, Angebote, zugehörige Rechnungen sowie Kontaktdaten beauftragter Handwerks- und Dienstleistungsbetriebe;",
      "Daten einer Vertrauensperson: Name, Kontaktdaten, Art und Gültigkeit der Vollmacht, Vollmachts-Scan;",
      "E-Mail-Adressen von Empfängern eines Freigabe-Links (Bank-, Maklerkontakt) sowie deren Terminvorschläge oder Rückrufbitten (Zeitpunkte, Telefonnummer, optional Name, Ort und Notiz);",
      "Notizen des Verantwortlichen.",
    ],
  },
  {
    note: "Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) sind nicht Gegenstand der Verarbeitung; der Verantwortliche trägt dafür Sorge, keine solchen Daten in Freitext- oder Upload-Feldern einzugeben. Kontoauszüge, die der Verantwortliche zum Abgleich der Mieteingänge öffnet, werden nur im Browser gelesen und nicht an den Betreiber übertragen; gespeichert werden nur die daraus bestätigten Buchungen.",
  },
  { b: "Betroffene Personen:" },
  {
    ul: [
      "Mieter und ehemalige Mieter des Verantwortlichen, die die App teilweise selbst nutzen (eigener, per Einladung erstellter Zugang);",
      "Mietinteressenten und Bewerber;",
      "weitere im Haushalt lebende oder im Mietverhältnis auftretende Personen (z. B. Mitbewohner, Bürgen);",
      "vom Verantwortlichen beauftragte Service-Partner (Hausmeister, Handwerks- und Dienstleistungsbetriebe) und deren Ansprechpartner;",
      "Ansprechpartner von Banken und Maklern bei Freigaben, Rückmeldungen, Rücksendungen und Terminabsprachen;",
      "vom Verantwortlichen benannte Vertrauenspersonen (Bevollmächtigte).",
    ],
  },

  { h: "4. Weisungsbindung (Art. 28 Abs. 3 lit. a)" },
  {
    p: "Der Betreiber verarbeitet die Daten ausschließlich auf dokumentierte Weisung des Verantwortlichen; Weisungen werden über die Funktionen der App erteilt (Anlegen, Ändern, Freigeben, Zustellen, Löschen). Auch Eingaben, die vom Verantwortlichen eingeladene Mieter, Mietinteressenten, Service-Partner oder Empfänger eines Freigabe-Links über die von ihm freigeschalteten Funktionen selbst vornehmen (z. B. Zählerstände, Anliegen, Bewerbungen, Auftragsnotizen, Rücksendungen), gelten als im Auftrag und auf Veranlassung des Verantwortlichen erfolgt. Hält der Betreiber eine Weisung für rechtswidrig, informiert er den Verantwortlichen unverzüglich. Eine Verarbeitung nach dem Recht der Union oder eines Mitgliedstaats bleibt vorbehalten; in diesem Fall wird der Verantwortliche vorab informiert, soweit rechtlich zulässig.",
  },

  { h: "5. Vertraulichkeit (lit. b)" },
  {
    p: "Zum Zugriff befugte Personen sind zur Vertraulichkeit verpflichtet. Der Betreiber greift auf Inhaltsdaten nur zu, soweit dies für Betrieb, Fehlerbehebung oder auf Wunsch des Verantwortlichen erforderlich ist.",
  },

  { h: "6. Sicherheit der Verarbeitung (lit. c, Art. 32)" },
  {
    p: "Der Betreiber trifft die in der **Anlage TOM** (unten) beschriebenen technischen und organisatorischen Maßnahmen und entwickelt sie entsprechend dem Stand der Technik fort.",
  },

  { h: "7. Subauftragsverarbeiter (lit. d)" },
  { p: "Der Verantwortliche erteilt die **allgemeine Genehmigung** zum Einsatz folgender Subauftragsverarbeiter:" },
  {
    ul: [
      "**Supabase Inc.** — Datenbank, Authentifizierung, Datei-Speicher; Datenhaltung in Frankfurt (AWS eu-central-1); DPA mit EU-Standardvertragsklauseln.",
      "**Vercel Inc.** (USA) — Hosting und Auslieferung der App; Laufzeit-Protokolle werden nach einem Tag gelöscht; DPA mit EU-Standardvertragsklauseln.",
      "**Anthropic PBC** (USA) — KI-Auswertung, nur bei aktiver Nutzung durch den Verantwortlichen; DPA mit EU-Standardvertragsklauseln; kein Modell-Training mit API-Daten.",
      "**Brevo** (Sendinblue SAS, Paris) — Versand der Einladungen ins Mieterportal und der Hinweis-E-Mails (Ziffer 2); Versanddaten in der EU; einzelne Unterauftragsverarbeiter von Brevo verarbeiten in den USA und in Indien, abgesichert über EU-Standardvertragsklauseln im Vertrag mit Brevo.",
    ],
  },
  {
    p: "Über beabsichtigte Änderungen (Hinzufügen/Ersetzen) informiert der Betreiber vorab in der App oder per E-Mail; der Verantwortliche kann innerhalb von 14 Tagen aus wichtigem Grund widersprechen. Bei Widerspruch steht beiden Parteien die Kündigung des Nutzungsverhältnisses offen. Der Betreiber verpflichtet Subauftragsverarbeiter auf mindestens gleichwertige Datenschutzpflichten und haftet für sie wie für eigenes Handeln. Übermittlungen in Drittländer erfolgen nur mit Garantien nach Kap. V DSGVO (Standardvertragsklauseln bzw. Angemessenheitsbeschluss).",
  },
  {
    p: "**Externe Dienste ohne Zugriff auf Mieterdaten.** Nutzt der Verantwortliche die Marktwert-Schätzung, übermittelt der Betreiber allein die **Objektadresse** an den Suchdienst Nominatim der OpenStreetMap Foundation (Vereinigtes Königreich, Angemessenheitsbeschluss), je Adresse einmal. Beim Import eines Online-Exposés per Link wird allein der **Link** an den Lesedienst der Jina AI GmbH (Berlin) übergeben. Namen, Mieterdaten oder Dokumente erhalten beide nicht.",
  },
  {
    p: "Von Subauftragsverarbeitern zu unterscheiden sind **Empfänger**, an die der Verantwortliche über die App bewusst Daten weitergibt — etwa Banken und Makler über Freigabe-Links oder von ihm beauftragte Service-Partner und Fachbetriebe zur Auftrags-, Angebots- und Terminabwicklung. Diese Weitergabe erfolgt ausschließlich auf Veranlassung des Verantwortlichen; die Empfänger verarbeiten die Daten für ihre eigenen Zwecke in eigener datenschutzrechtlicher Verantwortung. Ebenfalls in eigener Verantwortung handeln Google (nur „Login mit Google“) und Paddle (Abrechnung eines MyImmo-Abos als Händler); beide erhalten keine Daten, die der Verantwortliche in der App über Dritte erfasst.",
  },

  { h: "8. Unterstützung bei Betroffenenrechten (lit. e)" },
  {
    p: "Der Betreiber unterstützt den Verantwortlichen mit geeigneten Mitteln bei der Beantwortung von Anträgen betroffener Personen (Art. 12–23 DSGVO) — insbesondere durch die Auskunfts-, Export-, Berichtigungs- und Löschfunktionen der App. Anträge, die beim Betreiber eingehen, leitet er unverzüglich an den Verantwortlichen weiter.",
  },

  { h: "9. Meldepflichten und weitere Unterstützung (lit. f)" },
  {
    p: "Der Betreiber meldet dem Verantwortlichen Verletzungen des Schutzes personenbezogener Daten **unverzüglich** nach Bekanntwerden mit den Informationen nach Art. 33 Abs. 3 DSGVO und unterstützt ihn bei seinen Pflichten aus Art. 32–36 DSGVO (Sicherheit, Meldungen, ggf. Datenschutz-Folgenabschätzung) unter Berücksichtigung der verfügbaren Informationen.",
  },

  { h: "10. Löschung und Rückgabe (lit. g)" },
  {
    p: "Nach Ende des Nutzungsverhältnisses — insbesondere bei Kontolöschung durch den Verantwortlichen — werden sämtliche personenbezogenen Daten einschließlich der gespeicherten Dateien (Belege, Dokumente, Fotos, Scans) unwiderruflich gelöscht, soweit keine gesetzliche Aufbewahrungspflicht des Betreibers entgegensteht. Der Verantwortliche kann seine Daten zuvor über die Export-Funktionen der App sichern. Restkopien in technischen Backups des Datenbank-Anbieters (tägliche Sicherung, Aufbewahrung 7 Tage) werden spätestens **sieben Tage** nach der Löschung automatisch überschrieben; sie dienen ausschließlich der Wiederherstellung im Störungsfall.",
  },

  { h: "11. Nachweise und Kontrollen (lit. h)" },
  {
    p: "Der Betreiber stellt dem Verantwortlichen alle zum Nachweis der Einhaltung dieses Vertrags erforderlichen Informationen zur Verfügung (insbesondere diese Vereinbarung, die Anlage TOM und die Zertifizierungen/DPAs der Subauftragsverarbeiter) und ermöglicht angemessene Überprüfungen. Kontrollen erfolgen in der Regel durch Auskünfte und Vorlage geeigneter Nachweise; Vor-Ort-Kontrollen nur bei konkretem Anlass und nach Ankündigung.",
  },

  { h: "12. Schlussbestimmungen" },
  {
    p: "Es gilt deutsches Recht. Die Haftung richtet sich nach Art. 82 DSGVO und den gesetzlichen Regeln. Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Bei Widersprüchen zu den allgemeinen Nutzungsbedingungen geht dieser AVV in Datenschutzfragen vor.",
  },

  { h: "Anlage: Technische und organisatorische Maßnahmen (TOM)" },
  {
    ul: [
      "**Zugangs- und Zugriffskontrolle:** Anmeldung mit E-Mail/Passwort (bcrypt-Hash, Mindestlänge 8 Zeichen, bekannte geleakte Passwörter werden abgelehnt) oder Google-OAuth; optional Zwei-Faktor-Anmeldung (TOTP) mit Wiederherstellungscodes, von denen nur ein Hash gespeichert wird; vor besonders sensiblen Aktionen (Kontolöschung, Gesamtexport, Erstellen eines Freigabe-Links) wird eine frische Anmeldung verlangt; automatische Abmeldung nach Inaktivität (Standard 30 Minuten).",
      "**Mandantentrennung:** Row Level Security auf jeder Tabelle — jedes Konto liest und schreibt ausschließlich eigene Datensätze. Mieter lesen Objekt- und Vertragsdaten nur über begrenzte Ansichten mit den Feldern, die ihr Portal zeigt; Service-Partner sehen nur die ihnen zugewiesenen Aufträge und Objekte; Zugänge ehemaliger Mieter enden automatisch.",
      "**Freigabe-Links:** nur explizit ausgewählte Dokumente, befristet und widerrufbar; Inhalte erst nach Eingabe eines Zugangscodes, der nur als HMAC gespeichert wird; Sperre nach 10 Fehlversuchen; Abrufprotokoll ohne IP-Adresse.",
      "**Dateien:** Belege in einem privaten Datei-Speicher, abrufbar nur über signierte Links mit 60 Sekunden Gültigkeit; übrige Dateien in der Datenbank hinter Row Level Security. Ausgeliefert werden nur PDF und Bilder zur Ansicht, alles andere ausschließlich als Download.",
      "**Übertragungskontrolle:** ausschließlich TLS-verschlüsselte Verbindungen; Content-Security-Policy und Sicherheits-Header. Hinweis-E-Mails enthalten keine Inhalte, nur den Hinweis auf Neues.",
      "**Verschlüsselung:** Speicherung bei Anbietern mit Verschlüsselung „at rest“; zusätzlich anwendungsseitige AES-256-GCM-Verschlüsselung von Bankverbindungsdaten mit Schlüssel außerhalb der Datenbank.",
      "**Datensparsamkeit beim Missbrauchsschutz:** Kennungen für Zugriffsbegrenzungen (IP-Adresse, E-Mail-Adresse) werden nur als HMAC gespeichert; Einträge, die älter als 24 Stunden sind, werden fortlaufend gelöscht.",
      "**Verfügbarkeitskontrolle:** Betrieb bei professionellen Cloud-Anbietern mit redundanter Infrastruktur; tägliche Datenbanksicherung mit 7 Tagen Aufbewahrung.",
      "**Eingabekontrolle:** Änderungen erfolgen kontogebunden über authentifizierte Sitzungen; destruktive Aktionen erfordern Bestätigung. Eingaben von Mietern, Mietinteressenten, Service-Partnern und Link-Empfängern sind dem Verantwortlichen zugeordnet und nur ihm zugänglich; Zustellungen und Abrufe werden mit Zeitpunkt festgehalten.",
      "**Löschkonzept:** Die Kontolöschung entfernt alle Datensätze und gespeicherten Dateien des Kontos; die Vollständigkeit wird bei jeder neuen Tabelle und jedem neuen Datei-Speicher durch automatische Tests geprüft.",
      "**Organisatorisches:** Zugriff auf Produktionssysteme nur durch den Betreiber; Geheimnisse (API-Schlüssel, Verschlüsselungsschlüssel) werden außerhalb des Quellcodes in der Hosting-Umgebung verwaltet.",
    ],
  },
  { sign: true },
];
