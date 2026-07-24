import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";

// ---- Farben / Maße ----
const GOLD = rgb(0.722, 0.565, 0.169);   // Akzent, Linien, Subheadings, Logo-"Immo"
const THEAD = rgb(0.60, 0.46, 0.15);     // Tabellen-Kopf (etwas satter)
const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.44, 0.44, 0.42);
const LINE = rgb(0.80, 0.78, 0.74);
const BOX = rgb(0.972, 0.958, 0.928);    // Creme
const ZEBRA = rgb(0.972, 0.968, 0.960);  // sehr helles Grau für Tabellen-Zebra
const EMPH = rgb(0.965, 0.945, 0.90);    // Hervorhebungszeile (Summen)
const WHITE = rgb(1, 1, 1);
const A4 = { w: 595.28, h: 841.89 };
const ML = 62, MR = 62, RIGHT = A4.w - MR, CW = RIGHT - ML;

function sanitize(s) {
  return (s ?? "").replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/…/g, "...").replace(/→/g, "->").replace(/ /g, " ")
    .split("").map((c) => {
      if (c === "€" || c === "–" || c === "—" || c.charCodeAt(0) <= 255) return c;
      const b = c.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      return b.length && b.charCodeAt(0) <= 255 ? b : "?";
    }).join("");
}
const tracked = (s) => s.split("").join(" ");

// ---- Inhalt ----
const NUTZER = "die Nutzerin / der Nutzer";
const SECTIONS = [
  { n: 1, title: "Zusammenfassung", body: [
    { p: "MyImmo ist eine Web- und iOS-App, mit der private Vermieter ihre Immobilien vollständig digital verwalten: Einnahmen und Ausgaben, Mieter und Mietverhältnisse, Verbrauch, Kredite, die jährliche Nebenkostenabrechnung sowie die steuerliche Anlage V – in einer aufgeräumten, modernen Oberfläche mit automatischer Wiederkehr-Logik für Mieten und regelmäßige Kosten." },
    { p: "Der Zielmarkt ist groß und wächst: In Deutschland gibt es rund 5,5 Millionen private Vermieter, die etwa zwei Drittel aller rund 25 Millionen Mietwohnungen bereitstellen. Rund 60 % davon besitzen genau eine vermietete Einheit – also genau die Gruppe, für die bestehende Profi-Software zu teuer und zu komplex ist und für die Excel-Listen zu fehleranfällig sind." },
    { p: "MyImmo wird als Abo-Modell (Freemium mit kostenpflichtigen Plänen) über den Apple App Store und als Web-App/PWA vertrieben. Die Preisposition liegt bewusst zwischen dem günstigen, aber funktionsärmeren objego und dem umfangreicheren, teureren immocloud." },
    { box: { title: "Eckdaten auf einen Blick", lines: [
      "Produkt: SaaS-App für Immobilien- und Nebenkostenverwaltung für private Vermieter",
      "Zielgruppe: private Klein- und Hobbyvermieter mit 1–15 Einheiten",
      "Modell: Freemium-Abo, ~96 € durchschnittlicher Jahresumsatz je zahlendem Nutzer",
      "Kanäle: iOS App Store + Web-App/PWA (Vercel + Supabase, EU-Region)",
      "Plan: Jahr 1 ~ kostendeckend · Jahr 3 ~ 77.000 € Umsatz · ~52.000 € Ergebnis",
      "Start nebenberuflich/bootstrapped, ohne externes Kapital",
    ] } },
    { p: "Der Plan ist bewusst konservativ und auf einen nebenberuflichen, eigenfinanzierten Start ausgelegt. Größter Engpass ist nicht die Technik (die App läuft bereits live), sondern die rechtlichen Launch-Voraussetzungen sowie der Aufbau eines verlässlichen Nutzerwachstums. Das Gewerbe ist seit Juli 2026 angemeldet, die zentralen Auftragsverarbeitungs-Verträge (Supabase, Anthropic) liegen unterschrieben bzw. archiviert vor." },
  ]},

  { n: 2, title: "Geschäftsidee & Produkt", body: [
    { h2: "Das Problem" },
    { p: "Private Vermieter müssen einmal im Jahr eine korrekte Nebenkostenabrechnung erstellen, die Anlage V für die Steuer ausfüllen und laufend Einnahmen, Kosten und Belege im Blick behalten. In der Praxis passiert das überwiegend in Excel oder auf Papier: zeitraubend, fehleranfällig und unübersichtlich, sobald mehrere Einheiten oder Mieterwechsel hinzukommen." },
    { h2: "Die Lösung" },
    { p: "MyImmo bündelt die gesamte Verwaltung in einer App. Kernfunktionen:" },
    { ul: [
      "Objekte, Einheiten und Mieter inkl. Mietverhältnis, Kaution und Mietverlauf verwalten.",
      "Einnahmen und Ausgaben erfassen – mit automatischer Wiederkehr (Mieten, Grundsteuer, Müll) im gewählten Zyklus, rückwirkend bis 10 Jahre.",
      "Nebenkostenabrechnung weitgehend automatisch erzeugen (PDF-Export).",
      "Steuer/Anlage V, Jahresbericht, Cashflow- und Portfolio-Auswertungen mit Zeitraum-Filtern.",
      "Belegarchiv, Datenexport (JSON/CSV) und ein durchgängiges Dark-/Light-Design.",
    ] },
    { h2: "Alleinstellung (USP)" },
    { ul: [
      "Fokus auf den einfachen Anwendungsfall des Kleinvermieters – nicht auf professionelle Hausverwaltungen.",
      "Modernes, mobil-first Design statt überladener Verwaltungssoftware.",
      "Durchdachte Automatik (wiederkehrende Buchungen, automatische Zuordnung) als zentraler Zeitsparer.",
      "Faire, transparente Preise ohne lineare Pro-Einheit-Kostenfalle.",
    ] },
    { p: "Technisch läuft die App bereits live (Next.js/React, Supabase als Datenbank in der EU-Region, Hosting über Vercel). Das senkt das Umsetzungsrisiko erheblich – der Schwerpunkt liegt jetzt auf Veröffentlichung, Recht und Wachstum." },
  ]},

  { n: 3, title: "Markt & Zielgruppe", body: [
    { p: "Der deutsche Mietwohnungsmarkt wird maßgeblich von Privatpersonen getragen – das ist exakt die Zielgruppe von MyImmo." },
    { table: { head: ["Marktkennzahl", "Wert (Deutschland)"], widths: [CW * 0.62, CW * 0.38], align: ["l", "r"], zebra: true, rows: [
      ["Private Vermieter", "~ 5,5 Mio."],
      ["Mietwohnungen insgesamt", "~ 25 Mio."],
      ["Anteil privater Kleinvermieter am Mietmarkt", "~ 64 %"],
      ["Vermieter mit genau einer Einheit", "~ 60 %"],
      ["Vermieter mit mehr als 15 Einheiten", "~ 3 %"],
      ["Wachstum private Vermieter (12 Jahre)", "3,9 → 5,5 Mio."],
    ] } },
    { p: "Selbst bei sehr vorsichtiger Betrachtung ist der adressierbare Markt riesig: Schon 1 % der rund 5,5 Mio. privaten Vermieter entspricht 55.000 potenziellen Nutzern. Der für MyImmo realistisch erreichbare Anteil liegt im niedrigen Promillebereich – dennoch reicht das für ein tragfähiges Geschäft." },
    { h2: "Zielkunden im Detail" },
    { ul: [
      "Primär: Hobby-/Kleinvermieter mit 1–5 Einheiten, die heute Excel nutzen und die NK-Abrechnung als lästige Pflicht empfinden.",
      "Sekundär: wachsende Vermieter mit 6–24 Einheiten, denen reine Gratis-Tools zu unübersichtlich werden.",
      "Geschäftskunden (B2B): semiprofessionelle Vermieter, kleine Hausverwaltungen und Immobilienfirmen mit größeren Beständen (ca. 25+ Einheiten) – zahlenmäßig klein (nur ~3 % der Vermieter halten über 15 Einheiten), aber mit deutlich höherem Umsatz je Kunde. Adressiert über den Firmen-Account (siehe Kapitel 5).",
      "Treiber: steigende Digitalisierung, komplexere Abrechnungen (z. B. CO2-Kostenaufteilung) und der Wunsch, Belege und Steuerunterlagen jederzeit parat zu haben.",
    ] },
  ]},

  { n: 4, title: "Wettbewerb & Positionierung", body: [
    { p: "Der Markt für Vermieter-Software ist etabliert, aber nicht gesättigt – viele Lösungen sind entweder funktional dünn (Gratis-Tools) oder auf Profis zugeschnitten und entsprechend teuer. MyImmo positioniert sich im Mittelfeld: einfacher als die Profi-Tools, vollständiger als die Gratis-Angebote." },
    { table: { head: ["Anbieter", "Einstiegspreis", "Profil", "Schwäche für die Zielgruppe"], widths: [CW * 0.17, CW * 0.20, CW * 0.31, CW * 0.32], align: ["l", "l", "l", "l"], boldCol0: true, rows: [
      ["objego", "0 € / ab 7,95 € + 0,95 €/Einheit", "Gratis-Einstieg, beliebt bei Anfängern", "Pro-Einheit-Preis skaliert linear, NK kostet extra"],
      ["immocloud", "9,99 €/Monat (1–5 Einh.)", "Funktionsstark, >15.000 Nutzer", "Teurer, eher für ambitionierte/größere Vermieter"],
      ["vermietet.de", "Freemium", "Teil von ImmoScout24, Portal-Integration", "An ImmoScout-Ökosystem gebunden"],
      ["Excel / Papier", "0 €", "Weit verbreiteter Status quo", "Fehleranfällig, keine Automatik, kein NK-PDF"],
      ["MyImmo", "~6–13 €/Monat", "Einfach, modern, mobil-first für Kleinvermieter", "Neu am Markt, Marke noch unbekannt"],
    ] } },
    { h2: "Positionierung" },
    { p: "MyImmo zielt auf das Preis-Leistungs-Mittelfeld: günstiger und schlanker als immocloud, aber mit vollem NK- und Steuer-Funktionsumfang, der bei objego erst kostenpflichtig dazugebucht wird. Der Wettbewerbsvorteil ist nicht der Preis allein, sondern die Kombination aus Einfachheit, Design und Automatik." },
  ]},

  { n: 5, title: "Geschäftsmodell & Preise", body: [
    { p: "MyImmo ist ein Software-Abo (SaaS) nach dem Freemium-Prinzip: Ein kostenloser Einstieg senkt die Hürde, kostenpflichtige Pläne schalten NK-Abrechnung, Steuer-Export und mehr Einheiten frei. Jahresabos werden mit Rabatt gegenüber der Monatszahlung angeboten, um Bindung und planbaren Umsatz zu erhöhen." },
    { table: { head: ["Tarif", "pro Monat", "pro Jahr", "Einheiten"], widths: [CW * 0.34, CW * 0.20, CW * 0.20, CW * 0.26], align: ["l", "r", "r", "r"], boldCol0: true, rows: [
      ["Kostenlos", "0 €", "0 €", "1 (Basis)"],
      ["MyImmo Privat", "7,99 €", "79 €", "bis 5"],
      ["MyImmo Plus", "12,99 €", "129 €", "bis 24"],
      ["MyImmo Business", "ab 29,99 €", "ab 299 €", "ab 25 (Firmen)"],
    ] } },
    { i: "Preise als Orientierung (Brutto); finale Höhe wird im Markttest justiert. Über den Tarifmix ergibt sich ein durchschnittlicher Jahresumsatz von rund 96 € je zahlendem Nutzer." },
    { h2: "Firmen-Account für große Portfolios (MyImmo Business)" },
    { p: "Für professionelle Vermieter, kleine Hausverwaltungen und Immobilienfirmen mit größeren Beständen entsteht ein eigener Firmen-Account. Er nutzt dasselbe Design und dieselbe Logik wie die Privatversion – das Layout wird jedoch auf die Verwaltung vieler Objekte (ca. 25 und mehr) optimiert." },
    { ul: [
      "Portfolio-Ansicht für viele Objekte: Listen, Filter und Suche statt Einzelkarten – auch bei 25+ Einheiten übersichtlich.",
      "Team-Zugänge mit Rollen und Rechten, damit mehrere Mitarbeiter gemeinsam am selben Bestand arbeiten.",
      "Sammel- und Bulk-Funktionen (Massen-Import, Sammelbuchungen) sparen bei großen Beständen viel Zeit.",
      "Aggregierte Auswertungen über das gesamte Portfolio (Cashflow, Rendite, Leerstand).",
    ] },
    { p: "Der Firmen-Account adressiert ein kleineres, aber deutlich umsatzstärkeres Segment (höherer Preis je Kunde) und ist ein logischer Wachstumshebel, sobald die Privatversion etabliert ist." },
    { h2: "Einnahmequellen & Kanäle" },
    { ul: [
      "iOS App Store: In-App-Abos (Apple behält 15–30 %; im Small-Business-Programm i. d. R. 15 %).",
      "Web-App/PWA: Abos über einen Zahlungsdienstleister (z. B. Stripe/Paddle, ~3–5 % Gebühr) – margenstärker als iOS.",
      "Optional später: Zusatzmodule oder höhere Tarifstufen für Vermieter mit vielen Einheiten.",
    ] },
    { p: "Gemittelt über beide Kanäle werden in der Planung rund 12 % Plattform- und Zahlungsgebühren auf den Umsatz angesetzt." },
  ]},

  { n: 6, title: "Marketing & Vertrieb", body: [
    { p: "Da das Budget zu Beginn klein ist, liegt der Schwerpunkt auf kostengünstigen, gut skalierenden Kanälen statt auf teurer Werbung:" },
    { ul: [
      "App-Store-Optimierung (ASO) und SEO rund um Suchbegriffe wie „Nebenkostenabrechnung erstellen\" oder „Vermieter App\".",
      "Content-Marketing: hilfreiche Ratgeber zu NK-Abrechnung, Anlage V und Mietrecht ziehen genau die Zielgruppe an.",
      "Communities & Foren für Vermieter (z. B. Haus & Grund-Umfeld, Vermieter-Gruppen), Empfehlungen und Mundpropaganda.",
      "Kostenlose Einstiegsversion als wichtigster Vertriebskanal – Nutzer testen ohne Risiko und steigen bei Bedarf auf einen Bezahlplan um.",
      "Später punktuell bezahlte Kampagnen (Google/Meta), sobald Conversion-Zahlen die Wirtschaftlichkeit belegen.",
    ] },
    { box: { title: "Wachstumsannahme (konservativ)", lines: [
      "Freemium-Conversion: ~3–5 % der aktiven Gratis-Nutzer werden zahlend.",
      "Zahlende Nutzer (Jahresende): Jahr 1 ~120 · Jahr 2 ~500 · Jahr 3 ~1.200.",
      "Wachstum getragen von organischen Kanälen, nicht von gekauftem Traffic.",
    ] } },
  ]},

  { n: 7, title: "Stärken-Schwächen-Analyse (SWOT)", body: [
    { table: { head: ["Stärken", "Schwächen"], widths: [CW / 2, CW / 2], align: ["l", "l"], rows: [
      [[
        "App läuft bereits live (geringes Technikrisiko)",
        "Modernes, einfaches Design",
        "Durchdachte Automatik & NK-PDF",
        "Sehr schlanke Kostenstruktur",
      ], [
        "Unbekannte Marke, kein Marketingbudget",
        "Solo-/nebenberuflicher Betrieb",
        "Rechtliche Restschritte vor Launch (Apple, Rest-Dokumente)",
        "Abhängig von Apple/Plattformregeln",
      ]],
    ] } },
    { table: { head: ["Chancen", "Risiken"], widths: [CW / 2, CW / 2], align: ["l", "l"], rows: [
      [[
        "Riesiger, wachsender Markt (5,5 Mio.)",
        "Status quo ist Excel – viel Luft nach oben",
        "Zunehmende Digitalisierung & KI-Funktionen",
        "Margenstarker Web-Kanal",
      ], [
        "Etablierte Wettbewerber mit Budget",
        "DSGVO-/Datenschutzanforderungen (Mieterdaten)",
        "Plattformgebühren drücken iOS-Marge",
        "Wachstum kann langsamer ausfallen",
      ]],
    ] } },
  ]},

  { n: 8, title: "Fahrplan & Meilensteine", body: [
    { p: "Vor der ersten Euro-Einnahme stehen rechtliche und plattformseitige Voraussetzungen – sie bestimmen den kritischen Pfad." },
    { h2: "Phase 1 – Fundament (Q3 2026)" },
    { ul: [
      "Gewerbe ist angemeldet (erledigt Juli 2026, Nebenerwerb, SaaS/digitale Dienstleistungen); steuerliche Erfassung und Kleinunternehmer-Frage in Klärung.",
      "DSGVO-Grundlage: Auftragsverarbeiter-Rolle geklärt; AVV mit Supabase signiert und Anthropic-DPA archiviert (beide erledigt); Datenhaltung EU-Region, Row Level Security.",
      "Pflichtdokumente: Impressum & Datenschutzerklärung mit der Gewerbeanmeldung abgeglichen; eigener Nutzer-AVV im Entwurf – AGB und AVV noch anwaltlich prüfen lassen.",
    ] },
    { h2: "Phase 2 – App-Reife für Bezahlmodell (Q3–Q4 2026)" },
    { ul: [
      "Konto-Löschung, Datenexport und „Sign in with Apple\" ergänzen (Apple- & DSGVO-Pflicht).",
      "In-App-Abos einrichten, App Privacy Label, App Review durchlaufen.",
    ] },
    { h2: "Phase 3 – Launch & erste Nutzer (Q4 2026)" },
    { ul: [
      "Soft-Launch Web/PWA, danach iOS-Release; Beta über TestFlight.",
      "Erste Inhalte/ASO live, Feedback einsammeln, Conversion messen.",
    ] },
    { h2: "Phase 4 – Wachstum (2027–2028)" },
    { ul: [
      "Funktionen nachschärfen, Content-Engine ausbauen, ab Profitabilität punktuell bezahltes Marketing.",
    ] },
  ]},

  { n: 9, title: "Finanzplanung (3-Jahres-Übersicht)", body: [
    { p: "Die Planung ist bewusst vorsichtig und auf einen eigenfinanzierten, nebenberuflichen Start ohne externes Kapital ausgelegt. Grundlage sind die folgenden Annahmen:" },
    { ul: [
      "Durchschnittlicher Umsatz je zahlendem Nutzer: ~96 €/Jahr (Mix aus Monats- und Jahresabos).",
      "Durchschnittlich zahlende Nutzer im Jahr: ~50 (J1), ~300 (J2), ~800 (J3).",
      "Plattform-/Zahlungsgebühren: ~12 % des Umsatzes (iOS + Web gemittelt).",
      "Eigene Arbeitszeit ist nicht als Kosten angesetzt (bootstrapped) – siehe Hinweis unten.",
    ] },
    { h2: "Umsatz- und Ergebnisplan" },
    { table: { head: ["Position", "Jahr 1", "Jahr 2", "Jahr 3"], widths: [CW * 0.46, CW * 0.18, CW * 0.18, CW * 0.18], align: ["l", "r", "r", "r"], boldCol0: false, emphRows: [9, 10], rows: [
      ["Zahlende Nutzer (Jahresende)", "120", "500", "1.200"],
      ["Umsatz", "4.800 €", "28.800 €", "76.800 €"],
      ["– Plattform-/Zahlungsgebühren", "576 €", "3.456 €", "9.216 €"],
      ["– Infrastruktur (Supabase, Vercel, Domain)", "300 €", "1.200 €", "3.600 €"],
      ["– Apple Developer Program", "99 €", "99 €", "99 €"],
      ["– Tools & Software", "300 €", "600 €", "1.200 €"],
      ["– Recht/DSGVO (Dokumente, Prüfung)", "2.000 €", "500 €", "600 €"],
      ["– Marketing", "500 €", "3.000 €", "8.000 €"],
      ["– Steuerberatung/Buchhaltung", "600 €", "1.200 €", "1.800 €"],
      ["Kosten gesamt", "4.375 €", "10.055 €", "24.515 €"],
      ["Ergebnis (vor Unternehmerlohn)", "+425 €", "+18.745 €", "+52.285 €"],
    ] } },
    { box: { title: "Wichtige Hinweise zur Finanzplanung", lines: [
      "Jahr 1 ist rechnerisch etwa kostendeckend – die einmaligen Rechts-/DSGVO-Kosten drücken das Ergebnis.",
      "Kumuliertes Ergebnis über 3 Jahre: ~71.500 € (vor kalkulatorischem Unternehmerlohn).",
      "Die eigene Arbeitszeit ist nicht eingepreist. Bei z. B. 1.500 €/Monat kalkulatorischem Lohn wäre erst ab ~Jahr 2/3 ein echter Gewinn erreichbar.",
      "Größter Stellhebel: Nutzerwachstum und Anteil margenstarker Web-Abos.",
      "Der Firmen-Account (Business, ab 25 Einheiten) ist zusätzliches, umsatzstärkeres Potenzial und in diesen konservativen Zahlen noch nicht enthalten.",
    ] } },
    { p: "Der Kapitalbedarf ist gering: Die wichtigsten Anfangsausgaben (Gewerbe, Rechtsdokumente, Apple-Programm, Infrastruktur) liegen zusammen im niedrigen vierstelligen Bereich und können aus Eigenmitteln gedeckt werden – ein wesentlicher Vorteil des bootstrapped-Ansatzes." },
  ]},

  { n: 10, title: "Risiken & Gegenmaßnahmen", body: [
    { table: { head: ["Risiko", "Wirkung", "Gegenmaßnahme"], widths: [CW * 0.29, CW * 0.28, CW * 0.43], align: ["l", "l", "l"], boldCol0: true, rows: [
      ["Wachstum bleibt aus", "Umsatz unter Plan", "Organische Kanäle früh testen, Conversion messen, Produkt nachschärfen"],
      ["DSGVO-/Datenschutzfehler", "Bußgeld, Vertrauensverlust", "EU-Hosting, RLS, AVV, fachkundige Prüfung vor Launch"],
      ["Apple lehnt App ab", "iOS-Launch verzögert", "Pflichten (Löschung, Apple-Login, Privacy Label) vorab erfüllen; Web zuerst"],
      ["Plattformgebühren", "Niedrigere iOS-Marge", "Web-Abos forcieren; Small-Business-Programm nutzen"],
      ["Wettbewerb/Preisdruck", "Margendruck", "Differenzierung über Einfachheit & Design statt Preis"],
      ["Solo-Abhängigkeit", "Engpass bei Zeit/Krankheit", "Automatisieren, dokumentieren, später punktuell auslagern"],
    ] } },
  ]},

  { n: 11, title: "Zukunftspläne: Immobilien-Vergleichstool & Portal-Partnerschaften", body: [
    { p: "Über die reine Verwaltung hinaus soll MyImmo zur Entscheidungshilfe beim Immobilienkauf werden. Im Cockpit entsteht ein Immobilien-Vergleichstool, mit dem der Vermieter Kaufobjekte schnell bewerten und gegenüberstellen kann. Das hebt MyImmo deutlich von reinen Verwaltungs-Apps ab und zieht neue Nutzer schon an, bevor sie überhaupt eine Immobilie besitzen." },
    { i: "Stand Juli 2026: Ein erster Ausbaustand ist bereits in der App umgesetzt – Objektbewertung (Sachwert/Grundstücks- und Bodenwert), Kaufpreisfaktor, Mietrendite und Cashflow sowie grafische Finanzierungsvorschläge inklusive automatischer KfW-Förder-Übersicht. Der Portal-Datenzugang (Link-Import) ist der noch offene Ausbauschritt." },
    { h2: "So funktioniert das Vergleichstool" },
    { ol: [
      "Objekt hinzufügen: Der Nutzer fügt eine Immobilie über den Link einer Online-Anzeige oder per Upload eines Exposés (PDF) hinzu.",
      "Automatisch bewerten: Die relevanten Werte (Kaufpreis, Wohnfläche, Lage, Miete, Baujahr) fließen in den integrierten Immobilien-Bewertungsrechner – Kennzahlen wie Kaufpreisfaktor, Mietrendite, Preis pro m² und Cashflow werden ermittelt.",
      "Ergebnis speichern: Die Bewertung wird im Cockpit gespeichert.",
      "Vergleichen: Sobald mindestens zwei Objekte gespeichert sind, lassen sie sich Kennzahl für Kennzahl nebeneinander vergleichen – so wird sofort sichtbar, welches Objekt die bessere Investition ist.",
    ] },
    { h2: "Technische Herausforderung: Daten aus den Anzeigen" },
    { p: "Die größte Hürde ist das Auslesen der Anzeigendaten. Große Portale wie ImmoScout24 sperren das automatische Auslesen ihrer Seiten technisch und untersagen es in ihren Nutzungsbedingungen. Ein bequemes, rechtssicheres Einlesen per Link ist deshalb ohne Kooperation nicht dauerhaft möglich." },
    { ul: [
      "Robuster Einstieg: Der Exposé-Upload (PDF) funktioniert unabhängig von den Portalen, da der Nutzer die Datei selbst bereitstellt – damit ist das Tool von Anfang an nutzbar.",
      "Komfortweg „Link einfügen\": Dafür braucht es offiziellen Datenzugang über die Portale – siehe Partnerschaften unten.",
    ] },
    { h2: "Lösung: Partnerschaften mit Immobilienportalen" },
    { p: "Statt gegen die Blocker zu arbeiten, geht MyImmo aktiv auf die Portale zu. Mit Anbietern wie ImmoScout24 – und weiteren – werden Kooperationen angestrebt: offizieller Datenzugang über deren Schnittstelle im Austausch gegen Sichtbarkeit und Werbung für das Portal innerhalb von MyImmo. Beide Seiten gewinnen:" },
    { ul: [
      "MyImmo erhält rechtssicheren, strukturierten Zugriff auf Anzeigendaten (offizielle Schnittstelle statt unzulässigem Auslesen).",
      "Das Portal erhält im Gegenzug Werbung und Reichweite bei einer hochrelevanten Zielgruppe – kaufinteressierten Vermietern – sowie qualifizierte Weiterleitungen (Klicks/Leads) zurück auf seine Anzeigen.",
      "Mehrere Portale parallel: keine Abhängigkeit von einem einzigen Anbieter, breitere Datenbasis und mehr Auswahl für die Nutzer.",
    ] },
    { p: "Perspektivisch können solche Kooperationen zu einer eigenen Einnahmequelle werden – etwa über Vergütungen für vermittelte Klicks oder Leads." },
    { h2: "Mehrere Anbieter & internationale Skalierung" },
    { p: "Die Strategie wird bewusst mit mehreren Portalen gleichzeitig verfolgt, um Abhängigkeiten zu vermeiden und möglichst viele Anzeigen abzudecken. Beim Schritt ins Ausland (siehe Kapitel 13) wird dasselbe Modell auf die führenden Portale des jeweiligen Landes übertragen – pro Markt werden die relevanten lokalen Anbieter angesprochen (z. B. willhaben in Österreich, homegate in der Schweiz)." },
    { box: { title: "Warum das strategisch wertvoll ist", lines: [
      "MyImmo wächst von der Verwaltung zur Kaufentscheidung – mehr Nutzungsanlässe und frühere Kundenbindung.",
      "Klare Differenzierung gegenüber reinen Verwaltungs-Apps wie objego oder immocloud.",
      "Partnerschaften statt Scraping: rechtssicher, stabil und fair (Daten gegen Reichweite).",
      "Win-win mit den Portalen; perspektivisch eigene Einnahmequelle über Leads.",
    ] } },
  ]},

  { n: 12, title: "Zukunftspläne: Bank-Paket & Konto-Anbindung", body: [
    { p: "Viele Vermieter beleihen ihre Immobilien, um neue Objekte zu finanzieren. Banken verlangen dafür stets aktuelle und vollständige Unterlagen – heute ein mühsamer Prozess mit Unterlagensuche, mehreren Terminen und ständigem Nachreichen. MyImmo soll das auf Knopfdruck erledigen." },
    { h2: "Bank-Ordner je Immobilie" },
    { p: "Pro Immobilie stellt MyImmo automatisch einen vollständigen, stets aktuellen Unterlagen-Ordner zusammen, den der Vermieter direkt an die Bank schicken kann – gebündelt als Paket bzw. PDF. Typischer Inhalt:" },
    { ul: [
      "Grundbuchauszug, Teilungserklärung, Flurkarte/Lageplan.",
      "Aktuelle Mietverträge, Mietaufstellung und Nachweis der Mieteinnahmen.",
      "Nebenkostenabrechnungen und laufende Kosten.",
      "Objektdaten (Lage, Baujahr, Wohnfläche), Fotos bzw. Exposé.",
      "Aktuelle Cashflow- und Rendite-Auswertung direkt aus MyImmo.",
    ] },
    { h2: "Direkte Beleihungs- bzw. Kreditanfrage (Bank-Schnittstelle)" },
    { p: "Perspektivisch entsteht eine Schnittstelle zur Bank: Der Vermieter stellt in der App eine Kredit- oder Beleihungsanfrage zusammen und übermittelt sie – etwa über das Online-Banking – direkt an seinen Berater. Die Bank erhält damit sofort alle aktuellen Daten in strukturierter, einheitlicher Form." },
    { h2: "Konto-Anbindung: Einnahmen & Kosten automatisch buchen" },
    { p: "Über eine Banking-Schnittstelle (Open Banking / PSD2) werden Zahlungseingänge und -ausgänge automatisch erkannt und in MyImmo gebucht, sobald sie auf dem Konto eingehen. Mieten und Kosten sind dadurch immer aktuell – ohne manuelles Erfassen – und bestätigen die wiederkehrenden Buchungen mit echten Kontodaten." },
    { h2: "Nutzen" },
    { table: { head: ["Profitiert", "Nutzen"], widths: [CW * 0.22, CW * 0.78], align: ["l", "l"], boldCol0: true, rows: [
      ["Vermieter", "Keine Zettelwirtschaft, weniger Banktermine, nichts vergessen oder nachzureichen – alles kompakt und immer aktuell an einem Ort."],
      ["Bank", "Sofort vollständige, einheitliche und aktuelle Daten → schnellere Bearbeitung und deutlich weniger Rückfragen."],
      ["MyImmo", "Starker Bindungsfaktor (der Konto-Sync macht die App zum täglichen Werkzeug), klare Differenzierung und ein möglicher Kooperationskanal mit Banken."],
    ] } },
    { box: { title: "Hinweis zur Umsetzung", lines: [
      "Der Bank-Ordner (Export) lässt sich früh und ohne Schnittstelle umsetzen – schneller, hoher Mehrwert.",
      "Konto- und Bank-Schnittstellen unterliegen der PSD2 und erfordern einen lizenzierten/zertifizierten Open-Banking-Partner sowie erhöhten Schutz der Finanzdaten.",
      "Die Schnittstellen sind daher ein späterer Ausbauschritt – idealerweise über einen spezialisierten Dienstleister.",
    ] } },
  ]},

  { n: 13, title: "Zukunftspläne: Expansion ins Ausland", body: [
    { p: "Sobald MyImmo im deutschen Heimatmarkt trägt, bietet sich die Erschließung weiterer Länder an. Der Reiz des Modells: Die App selbst bleibt im Kern unverändert – gleiche Funktionen, gleiches Design, gleiche Technik. Pro Zielland müssen nur die länderspezifischen Steuer- und Rechtsregeln angepasst werden. Dadurch lassen sich neue Märkte erschließen, ohne die Software neu zu entwickeln." },
    { h2: "Grundprinzip: gleiche App, lokalisierte Regeln" },
    { p: "Immobilienverwaltung folgt überall demselben Muster – Objekte, Mieter, Einnahmen und Ausgaben, Abrechnung und Auswertung. Unterschiedlich sind allein die rechtlichen und steuerlichen Rahmenbedingungen. Diese werden als austauschbare „Länder-Module\" hinterlegt, sodass dieselbe Codebasis mehrere Märkte bedient." },
    { table: { head: ["Bleibt unverändert", "Wird je Zielland angepasst"], widths: [CW / 2, CW / 2], align: ["l", "l"], rows: [
      [[
        "App-Logik & Bedienung",
        "Design (Dark/Light, Gold-Akzent)",
        "Technik (Next.js, Supabase, Vercel)",
        "Grundfunktionen: Objekte, Mieter, Buchungen, Auswertungen",
      ], [
        "Steuerlogik & Steuerformulare",
        "Miet-/Immobilienrecht (NK-Abrechnung, Umlage, Fristen)",
        "Datenschutz (nur außerhalb der EU)",
        "Sprache, Währung, Datums-/Zahlenformat",
      ]],
    ] } },
    { h2: "Was pro Land angepasst werden muss" },
    { ul: [
      "Steuern: Die Steuerlogik ist länderspezifisch (in Deutschland z. B. die Anlage V). Mit einem auf Immobilien spezialisierten Steuerberater im Zielland werden lokale Abschreibungen, Formulare und Meldepflichten abgebildet – ebenso die Umsatzsteuer auf das Abo selbst.",
      "Immobilien- & Mietrecht: Nebenkostenabrechnung, umlagefähige Kosten, Kündigungsfristen und Mieterhöhungsregeln unterscheiden sich je Land. Ein lokaler Rechtsanwalt für Immobilienrecht passt diese Regeln an die jeweilige Rechtslage an.",
      "Datenschutz: Innerhalb der EU gilt einheitlich die DSGVO – kein zusätzlicher Aufwand. Außerhalb der EU (z. B. Schweiz, Großbritannien, USA) ist ein Rechtsanwalt für das lokale Datenschutzrecht nötig, um Speicherung und Verarbeitung der Mieterdaten rechtskonform zu gestalten.",
      "Lokalisierung: Übersetzung der Oberfläche sowie Anpassung von Währung, Datums- und Zahlenformaten.",
    ] },
    { h2: "Vorgehen in Phasen" },
    { ul: [
      "Phase A – DACH zuerst: Österreich (EU, DSGVO gilt) und die Schweiz (außerhalb der EU → Datenschutz-Anwalt für das revidierte Schweizer Datenschutzgesetz). Die gemeinsame Sprache senkt den Lokalisierungsaufwand deutlich.",
      "Phase B – weitere EU-Länder: Der Datenschutz bleibt über die DSGVO einheitlich; angepasst werden nur Steuer- und Immobilienrecht je Land.",
      "Phase C – außerhalb der EU: zusätzlich das jeweilige lokale Datenschutzrecht über einen Rechtsanwalt absichern.",
    ] },
    { h2: "Benötigte Partner je Zielland" },
    { table: { head: ["Bereich", "Partner", "Wann nötig"], widths: [CW * 0.28, CW * 0.44, CW * 0.28], align: ["l", "l", "l"], boldCol0: true, rows: [
      ["Steuern", "Steuerberater (Immobilien) im Zielland", "immer"],
      ["Miet-/Immobilienrecht", "Rechtsanwalt für Immobilienrecht", "immer"],
      ["Datenschutz", "Rechtsanwalt für Datenschutzrecht", "nur außerhalb der EU"],
      ["Sprache", "Übersetzung / Lokalisierung", "bei anderer Sprache"],
    ] } },
    { box: { title: "Hinweis zur Umsetzung", lines: [
      "Die Expansion sollte erst starten, wenn der deutsche Heimatmarkt trägt.",
      "Pro Land fallen vor allem einmalige Anpassungskosten an (Steuer- und Rechtsberatung); die Technik skaliert ohne Neuentwicklung.",
      "Dadurch lassen sich neue Märkte vergleichsweise günstig und schnell erschließen – ein zentraler Hebel für späteres Wachstum.",
    ] } },
  ]},

  { n: 14, title: "Fazit & nächste Schritte", body: [
    { p: "MyImmo trifft einen großen, wachsenden Markt mit einem Produkt, das technisch bereits steht und sich klar im Mittelfeld zwischen Gratis-Tools und teurer Profi-Software positioniert. Bei vorsichtiger Planung ist das Vorhaben bereits ab Jahr 1 etwa kostendeckend und entwickelt sich bis Jahr 3 zu einem soliden Nebenerwerb mit Skalierungspotenzial – ganz ohne externes Kapital." },
    { p: "Der kritische Pfad liegt nicht in der Technik, sondern in den rechtlichen Launch-Voraussetzungen und im Aufbau verlässlichen Nutzerwachstums." },
    { h2: "Empfohlene nächste Schritte" },
    { ol: [
      "Gewerbe ist angemeldet (Juli 2026); steuerliche Erfassung abschließen und Kleinunternehmer-Status final klären.",
      "Rechtsdokumente (Datenschutzerklärung, Impressum, AGB, Nutzer-AVV) finalisieren und anwaltlich prüfen lassen (Impressum/Datenschutz bereits mit der Gewerbeanmeldung abgeglichen).",
      "Apple-Pflichten (Konto-Löschung, Datenexport, Sign in with Apple) in der App nachrüsten.",
      "Soft-Launch der Web-App, erste Inhalte/ASO live, Conversion messen.",
      "Auf Basis echter Zahlen die Preise justieren und das Marketing schrittweise ausbauen.",
    ] },
    { h2: "Quellen & Annahmen" },
    { i: "Marktzahlen und Wettbewerbspreise basieren auf öffentlich verfügbaren Quellen (Stand Mitte 2026); Finanzzahlen sind eigene, bewusst konservative Annahmen." },
    { ul: [
      "Private Vermieter / Marktstruktur: IW Köln, Statista, Haus & Grund („Wohnen in Zahlen\").",
      "Wettbewerbspreise: immocloud, objego, vermietet.de sowie Vergleichsportale (hausverwaltungschecker.de, ohnehausverwaltung.de).",
      "Produkt-/Statusangaben: interne MyImmo-Unterlagen (Ideensammlung, DSGVO-Checkliste).",
    ] },
  ]},
];

// =================== Rendering ===================
async function build(tocMap) {
  const doc = await PDFDocument.create();
  doc.setTitle("MyImmo – Businessplan");
  doc.setAuthor("Jonas Scharp (MyImmo)");
  doc.setCreator("MyImmo");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ital = await doc.embedFont(StandardFonts.HelveticaOblique);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifI = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const pages = [];
  let page, y;
  const chapterPages = {}; // n -> page-index (0-based)

  function wordmark(x, yy, size) {
    // Dokument-Wortmarke: "My" (Serif, INK) + "Immo" (Serif-Italic, GOLD)
    page.drawText("My", { x, y: yy, size, font: serif, color: INK });
    const w = serif.widthOfTextAtSize("My", size);
    page.drawText("Immo", { x: x + w, y: yy, size, font: serifI, color: GOLD });
    return w + serifI.widthOfTextAtSize("Immo", size);
  }

  function header() {
    const yh = A4.h - 44;
    // linke Seite: Wortmarke + " – Businessplan"
    const wmW = wordmark(ML, yh, 10.5);
    page.drawText(sanitize(" – Businessplan"), { x: ML + wmW + 2, y: yh, size: 9, font, color: MUTED });
    const rt = "Interne Planung";
    page.drawText(rt, { x: RIGHT - font.widthOfTextAtSize(rt, 9), y: yh, size: 9, font, color: MUTED });
    page.drawLine({ start: { x: ML, y: A4.h - 54 }, end: { x: RIGHT, y: A4.h - 54 }, thickness: 0.8, color: LINE });
  }

  function newPage(withHeader = true) {
    page = doc.addPage([A4.w, A4.h]); pages.push(page);
    if (withHeader) header();
    y = A4.h - 78;
  }

  function room(need) { if (y - need < 66) newPage(true); }

  function wrap(s, size, maxW, f) {
    const words = sanitize(s).split(" "); const lines = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  const LH = 14.5, GAP = 8;
  function para(s, { size = 10, f = font, color = INK, x = ML, maxW = CW, lh = LH, gap = GAP } = {}) {
    for (const ln of wrap(s, size, maxW, f)) { room(lh); page.drawText(ln, { x, y, size, font: f, color }); y -= lh; }
    y -= gap;
  }

  function bullets(items, { ordered = false } = {}) {
    items.forEach((it, idx) => {
      const marker = ordered ? `${idx + 1}.` : "•";
      const mW = ordered ? font.widthOfTextAtSize(marker, 10) + 4 : 12;
      const lines = wrap(it, 10, CW - mW - 2, font);
      room(lines.length * LH);
      page.drawText(marker, { x: ML + (ordered ? 2 : 2), y, size: 10, font: ordered ? font : bold, color: GOLD });
      lines.forEach((ln, i) => page.drawText(ln, { x: ML + mW + 2, y: y - i * LH, size: 10, font, color: INK }));
      y -= lines.length * LH + 4;
    });
    y -= 3;
  }

  function h1(n, title) {
    room(96); // Überschrift nicht allein am Seitenende stehen lassen
    y -= 6;
    chapterPages[n] = pages.length - 1;
    const head = `${n}. ${title}`;
    const lines = wrap(head, 15, CW, bold);
    lines.forEach((ln, i) => page.drawText(ln, { x: ML, y: y - i * 18, size: 15, font: bold, color: INK }));
    y -= lines.length * 18 - 4;
    page.drawLine({ start: { x: ML, y }, end: { x: RIGHT, y }, thickness: 1.2, color: GOLD });
    y -= 16;
  }

  function h2(title) {
    room(26);
    y -= 4;
    page.drawText(sanitize(title), { x: ML, y, size: 11, font: bold, color: GOLD });
    y -= 16;
  }

  function box(b) {
    const innerW = CW - 28;
    const wrapped = b.lines.map((l) => wrap(l, 9.5, innerW, font));
    const titleH = 16;
    const bodyH = wrapped.reduce((a, ls) => a + ls.length * 12.5 + 4, 0);
    const h = titleH + bodyH + 14;
    room(h + 6);
    const top = y;
    page.drawRectangle({ x: ML, y: top - h, width: CW, height: h, color: BOX });
    page.drawRectangle({ x: ML, y: top - h, width: 3.2, height: h, color: GOLD });
    let yy = top - 15;
    page.drawText(sanitize(b.title), { x: ML + 14, y: yy, size: 10, font: bold, color: GOLD });
    yy -= 18;
    for (const ls of wrapped) {
      ls.forEach((ln, i) => page.drawText(ln, { x: ML + 14, y: yy - i * 12.5, size: 9.5, font, color: INK }));
      yy -= ls.length * 12.5 + 4;
    }
    y = top - h - 8;
  }

  // ---- Tabelle ----
  function measureCell(val, w, f, size) {
    const inner = w - 12;
    if (Array.isArray(val)) {
      // Bullet-Liste in Zelle (Bullet separat gezeichnet, nicht in den Text sanitisiert)
      let lines = [];
      for (const it of val) {
        const ls = wrap(it, size, inner - 12, f);
        ls.forEach((ln, i) => lines.push({ ln, list: true, itemStart: i === 0 }));
      }
      return lines;
    }
    return wrap(val, size, inner, f).map((ln) => ({ ln, list: false, itemStart: false }));
  }

  function table(t) {
    const xs = []; let cx = ML; for (const w of t.widths) { xs.push(cx); cx += w; }
    const size = 9.5, clh = 12.5, pad = 5;

    // Kopfzeile messen
    const headCells = t.head.map((h, i) => wrap(h, size, t.widths[i] - 12, bold));
    const headH = Math.max(...headCells.map((c) => c.length)) * clh + 2 * pad;

    // Zeilen messen
    const rowsM = t.rows.map((r) => {
      const cells = r.map((c, i) => measureCell(c, t.widths[i], font, size));
      const h = Math.max(...cells.map((c) => c.length)) * clh + 2 * pad;
      return { cells, h };
    });

    const drawHead = () => {
      page.drawRectangle({ x: ML, y: y - headH, width: CW, height: headH, color: THEAD });
      t.head.forEach((h, i) => {
        const ls = headCells[i];
        ls.forEach((ln, k) => {
          const tw = bold.widthOfTextAtSize(ln, size);
          const tx = (t.align && t.align[i] === "r") ? xs[i] + t.widths[i] - 6 - tw : xs[i] + 6;
          page.drawText(ln, { x: tx, y: y - pad - size - k * clh + 1, size, font: bold, color: WHITE });
        });
      });
      y -= headH;
    };

    room(headH + rowsM[0].h + 4);
    drawHead();

    rowsM.forEach((rm, ri) => {
      if (y - rm.h < 60) { newPage(true); room(headH + rm.h); drawHead(); }
      const emph = t.emphRows && t.emphRows.includes(ri);
      if (emph) page.drawRectangle({ x: ML, y: y - rm.h, width: CW, height: rm.h, color: EMPH });
      else if (t.zebra && ri % 2 === 1) page.drawRectangle({ x: ML, y: y - rm.h, width: CW, height: rm.h, color: ZEBRA });
      // Zelltexte
      rm.cells.forEach((cell, ci) => {
        const bcol0 = t.boldCol0 && ci === 0;
        const f = (emph || bcol0) ? bold : font;
        cell.forEach((cl, k) => {
          const baseY = y - pad - size - k * clh + 1;
          if (cl.list) {
            const bx = xs[ci] + 6;
            if (cl.itemStart) page.drawText("•", { x: bx, y: baseY, size, font, color: GOLD });
            page.drawText(cl.ln, { x: bx + 11, y: baseY, size, font, color: INK });
          } else if (t.align && t.align[ci] === "r") {
            const tw = f.widthOfTextAtSize(cl.ln, size);
            page.drawText(cl.ln, { x: xs[ci] + t.widths[ci] - 6 - tw, y: baseY, size, font: f, color: INK });
          } else {
            page.drawText(cl.ln, { x: xs[ci] + 6, y: baseY, size, font: f, color: INK });
          }
        });
      });
      // horizontale Trennlinie
      page.drawLine({ start: { x: ML, y: y - rm.h }, end: { x: RIGHT, y: y - rm.h }, thickness: 0.5, color: LINE });
      y -= rm.h;
    });
    // Außenrahmen (vertikale Spaltenlinien)
    y -= 2;
    y -= 8;
  }

  // ---------- Seite 1: Titelseite ----------
  newPage(true);
  {
    // Wortmarke groß, zentriert
    const big = 46;
    const wMy = serif.widthOfTextAtSize("My", big);
    const wIm = serifI.widthOfTextAtSize("Immo", big);
    const totalW = wMy + wIm;
    const startX = (A4.w - totalW) / 2;
    const yLogo = A4.h - 300;
    page.drawText("My", { x: startX, y: yLogo, size: big, font: serif, color: INK });
    page.drawText("Immo", { x: startX + wMy, y: yLogo, size: big, font: serifI, color: GOLD });

    const center = (s, yy, size, f, color) => {
      const ss = sanitize(s);
      page.drawText(ss, { x: (A4.w - f.widthOfTextAtSize(ss, size)) / 2, y: yy, size, font: f, color });
    };
    center("Die Verwaltungs-App für private Vermieter", yLogo - 34, 13, font, MUTED);
    center(tracked("— BUSINESSPLAN —"), yLogo - 66, 12, bold, GOLD);
    center("Interne Planung & Strategie", yLogo - 92, 11.5, ital, MUTED);

    // kurzer Gold-Zierstrich
    page.drawLine({ start: { x: A4.w / 2 - 30, y: yLogo - 118 }, end: { x: A4.w / 2 + 30, y: yLogo - 118 }, thickness: 2, color: GOLD });

    center("Jonas Scharp", yLogo - 178, 11, bold, INK);
    center("Stand: Juli 2026", yLogo - 196, 10, font, MUTED);
    center("Status: Vorbereitung Markteinführung (iOS App Store + Web/PWA)", yLogo - 214, 10, font, MUTED);
  }

  // ---------- Seite 2: Inhalt ----------
  newPage(true);
  {
    page.drawText("Inhalt", { x: ML, y, size: 15, font: bold, color: INK });
    y -= 4;
    page.drawLine({ start: { x: ML, y }, end: { x: RIGHT, y }, thickness: 1.2, color: GOLD });
    y -= 22;
    for (const s of SECTIONS) {
      const label = `${s.n}.  ${s.title}`;
      const lines = wrap(label, 10.5, CW - 40, font);
      page.drawText(String(s.n) + ".", { x: ML, y, size: 10.5, font: bold, color: GOLD });
      lines.forEach((ln, i) => {
        // entferne führende Nummer aus erster Zeile Darstellung: einfach Titel ab Position
        page.drawText(i === 0 ? s.title : ln, { x: ML + 26, y: y - i * 14, size: 10.5, font, color: INK });
      });
      // Punkteführung + Seitenzahl (falls tocMap vorhanden)
      if (tocMap && tocMap[s.n] != null) {
        const pageNo = tocMap[s.n] + 1; // 1-basiert
        const numStr = String(pageNo);
        const numX = RIGHT - font.widthOfTextAtSize(numStr, 10.5);
        page.drawText(numStr, { x: numX, y, size: 10.5, font, color: MUTED });
        // Punktelinie
        const titleW = font.widthOfTextAtSize(s.title, 10.5);
        const dotStart = ML + 26 + titleW + 6;
        const dotEnd = numX - 6;
        if (dotEnd > dotStart) {
          page.drawLine({ start: { x: dotStart, y: y + 3 }, end: { x: dotEnd, y: y + 3 }, thickness: 0.5, color: rgb(0.8, 0.79, 0.76), dashArray: [1, 2] });
        }
      }
      y -= lines.length * 14 + 6;
    }
  }

  // ---------- Inhaltsseiten ----------
  newPage(true);
  for (const s of SECTIONS) {
    h1(s.n, s.title);
    for (const blk of s.body) {
      if (blk.p) para(blk.p);
      else if (blk.h2) h2(blk.h2);
      else if (blk.ul) bullets(blk.ul, {});
      else if (blk.ol) bullets(blk.ol, { ordered: true });
      else if (blk.box) box(blk.box);
      else if (blk.table) table(blk.table);
      else if (blk.i) para(blk.i, { f: ital, color: MUTED, size: 9.2 });
    }
  }

  // ---------- Fußzeilen ----------
  pages.forEach((pg, i) => {
    const label = `Seite ${i + 1}`;
    const suffix = "  ·  Vertraulich";
    const wLabel = font.widthOfTextAtSize(label, 8);
    const wSuffix = font.widthOfTextAtSize(suffix, 8);
    const total = wLabel + wSuffix;
    const startX = (A4.w - total) / 2;
    pg.drawText("Seite ", { x: startX, y: 38, size: 8, font, color: MUTED });
    const wSeite = font.widthOfTextAtSize("Seite ", 8);
    pg.drawText(String(i + 1), { x: startX + wSeite, y: 38, size: 8, font: bold, color: GOLD });
    pg.drawText(suffix, { x: startX + wLabel, y: 38, size: 8, font, color: MUTED });
  });

  return { doc, chapterPages, pageCount: pages.length };
}

// Pass 1: Kapitel-Seiten ermitteln
const pass1 = await build(null);
// Pass 2: mit Inhaltsverzeichnis-Seitenzahlen
const pass2 = await build(pass1.chapterPages);

fs.writeFileSync("docs/business/MyImmo-Businessplan-2026-07.pdf", await pass2.doc.save());
console.log("fertig:", pass2.pageCount, "Seiten; Kapitel-Seiten:", JSON.stringify(pass1.chapterPages));
