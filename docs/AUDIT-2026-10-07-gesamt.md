# Gesamtprüfung MyImmo + BuyImmo — 07.10.2026

**Auftrag (Betreiber):** Verlässlichkeit. Jede Zahl, jeder Betrag, jede Grafik, jeder Link und jede Ansicht
muss stimmen, am Rechner wie am Handy. Den größten Teil macht die Rechenprüfung aus. Die Phasen 1–4 waren
reine Leseprüfungen. Umgesetzt wird erst, wenn der Betreiber diesen Bericht freigibt.

**Stand:** Phasen 0–4 sind abgeschlossen, die Gegenprüfung (V) liegt vor. Die Rohberichte je Bereich liegen
in `.scan/audit/<Kürzel>.md`, die Prüfskripte in `.scan/audit/tests/<Kürzel>/`. Beides ist nicht im Repo.
Alle Belegpfade unten beziehen sich auf `.scan/audit/`.

## Phase 0 — Vorprüfungen (07.10.2026)

- `07 Volatile Kennzahlen`: **nichts fällig** (nächste Termine 01.11.2026 Brevo-AVV, 26.11.2026 Beispielzins).
- Demo-Sitzungen je Rolle einmal angemeldet (Vermieter, Mieter, Service) — alle Agenten nutzen dieselben.
- Bekannte Befunde aus `AUDIT-2026-10-01`, `AUDIT-2026-10-06-design`, `AUDIT-2026-10-06-verknuepfung` werden
  nicht neu gemeldet, nur ihr aktueller Stand nachgeprüft.

## Arbeitsteilung (Workflow)

| Kürzel | Bereich |
|---|---|
| I1 | Inventar aller Seiten, Reiter, Dialoge, Exporte, PDFs, Token-Seiten |
| U1–U5 | Klick- und Darstellungsprüfung (1440/768/390/360 px, hell/dunkel): öffentlich+Auth · MyImmo I · MyImmo II · BuyImmo · Portale/Token/Demo |
| R1–R7 | Rechenprüfung: Portfolio-Kennzahlen · Steuer · Nebenkosten · Mietkonto/Mieterhöhung/Kaution · Kredite · BuyImmo Kauf/Marktwert/Strategie · Sanierung/Förderung |
| F1–F3 | Fachstand je Reiter + Ratgeber · Vermieter-/Mieterprobleme aus dem Netz · Rechts-/Formprüfung der Dokumente |
| V | Gegenprüfung jedes A-Befunds durch einen zweiten Agenten mit dem Auftrag, ihn zu widerlegen |

---

## Umsetzungsstand

| Paket | Stand |
|---|---|
| P9 BuyImmo (B29–B37, C10, C28–C33; Zusammenführung 11) | ✅ gebaut 09.10.2026, `tests/paketP9.test.ts` (32 Mutationen rot). Strategie rechnet das Startjahr mit den restlichen Monaten (Referenz Okt. 2026 ≈ 27.198 €), Verkauf nennt Vorfälligkeitsentschädigung und gleichbleibende Sparrate; Vergleich: Zeile „Kaufpreis ggü. Schätzung“ statt absolutem Marktwert, „vorläufig“ zählt nicht, 0 zählt nicht (EINE Regel für Zelle und Krone); Machbarkeit ohne Darlehenswunsch gegen die Nebenkosten; `BundeslandWahl` mit Länderkürzel für alle drei Rechner; Bewirtschaftungskosten je Stichtagsjahr 2021–2026 (Halle 83.442 €, Quellen: Oberer Gutachterausschuss Brandenburg + immobilien-wertermittlung.de, VPI 123,0/77,1), Bewertungsjahr wird mitgespeichert; § 34i-Wortliste über `components/kauf`, `lib/kauf`, Strategie; „…&quot; app-weit (15 Stellen); KfW 458 anteilig nach Nr. 8.3.1 a (KfW-Beispiel 17.600 €, ohne WE-Zahl vorsichtig 8.000 €/Wohnung), Heizungsoptimierung nach Gebäude-WE; Wohnfläche deutsch gelesen + Warnung < 10 m²; Fliesenleger ohne Kleber/Fuge; Maße nur Rand-Leerzeichen. **C33 widerlegt:** Beide Daten stimmen — BMWE-Vorabfassung „vom 17. Juli 2026“, Bundesanzeiger „vom 17. August 2026“ (BAnz AT 27.08.2026 B1), Nr. 8.3.1 a wortgleich. Demo-Kandidaten: `20261009130000` (nach dem Merge) |
| P10 Ratgeber und Werbung (B46–B51, C34–C39, C41) | ✅ gebaut 09.10.2026, `tests/paketP10.test.ts` (17 Mutationen rot): Negativliste (16 korrigierte Aussagen), Normzitate mit Quelle, Werbe-Wächter (jede versprochene Funktion mit Code-Beleg). Belegeinsicht § 556 Abs. 4 BGB, Zwischenablesung (BGH VIII ZR 19/07), HeizkostenV § 2/§ 9/§ 11/§ 12 im Wortlaut, 180 €, Schornsteinfeger als Handwerkerleistung, BFH 12.11.2025, Berlin 2025, § 559e, § 31 TrinkwV; Kästen ohne Umlage-Assistent/AfA-Übernahme/§ 82b-Jahresrate; „Mandate getrennt“ und „Teams, Rechte“ gestrichen. **C37 widerlegt:** Anlage V ist seit VZ 2023 dreigeteilt (Stotax-Anleitung 2023, Haufe zu 2021) — der Ratgeber war richtig, der Befund falsch. **Offen:** Rechtsstand-Siegel bleibt „Juli 2026“, bis alle 17 Artikel geprüft sind; Kaufnebenkosten in der AfA-Basis (bekannt, AUDIT-2026-10-01 C31) jetzt offen benannt statt beworben |
| P8 Portfolio-Kennzahlen (B24–B28, C15–C17; Zusammenführungen 1–5) | ✅ gebaut 09.10.2026, `tests/paketP8.test.ts` (26 Mutationen rot). Eine Rendite auf den Kaufpreis (`lib/portfolioKennzahlen.ts`, Basis an der Zahl, Portfolio ohne „Selbst bewohnt“), ein Wert (gepflegt, sonst Kaufpreis — Kachel = Ende der Kurve), Cashflow je Objekt (`objektMonat()`), Dashboard = Summe + Posten „ohne Objekt“, je Objekt ganze Euro (Σ Objektseiten = Dashboard). Berliner Stichtag in allen Seiten und Routen unter `app/` (Wächter-Test), Objekt-Check mit `laeuftAm()` und ohne Fläche/Baujahr beim Grundstück, Jahresbericht-PDF mit Zeitraum. Demo (`20261009100000`, ohne SQL-Editor): Jahreskosten 2026, Kaufdatum Zentrum 01.12.2024, Zinsen fallen weiter (`demo_zinsen_fortschreiben()` nach dem Reset). **Live gemessen 09.10.2026 (Demo):** Warmmiete 6.960 €, Kosten 5.712 € (Raten 4.490 + Ø 1.222), Cashflow +1.248 € (= Σ der sechs Objektseiten), Rendite 4,3 % auf Kaufpreis, Wert 1.838.000 €; Zinsen fallen ab 07/2026 weiter. **Offen:** die einmaligen Reparaturen 2025 werden weiter jährlich fortgeschrieben (Eigenschaft des Resets) |
| P4 Weitere Dokumente (B38, B39, B41, B43, C43, C44, C45, C46) | ✅ gebaut 09.10.2026, `tests/paketP4.test.ts` (31 Mutationen rot). Quittung ohne Warmmiete-Rückfall, mit Monat; Mietkonto bietet „Quittung“ nur bei gebuchtem Eingang (Betrag, Monat, Tag aus den Buchungen). Erinnerung/Mahnung mit `{{monat}}` (aus der offenen Miete vorbelegt). Wohnungsgeberbestätigung mit allen Pflichtangaben nach § 19 Abs. 3 BMG (Name + Anschrift Wohnungsgeber, Eigentümer, Einzugsdatum, alle einziehenden Personen), eigene Vorlage ohne sie → Fehler. Reparatur nur § 555a, Hinweis auf § 555c. Portal: „bereitgestellt“ statt „zugestellt ✓“, Zugangshinweis vor und nach dem Zustellen, Ergebnis der Hinweis-Mail sichtbar (ohne Brevo: „keine Hinweis-Mail“), Dashboard-Aufgabe „Nicht abgerufen“ nach 7 Tagen. NK- und Brief-Anschrift über EINE Regel (`mieterAnschrift()`), kein interner Hinweis mehr im Adressfeld. Käufer-Selbstauskunft ohne Familienstand/Kinder/Staatsangehörigkeit, außer per Haken. /vorlagen-Texte korrigiert. **Offen:** keine Modernisierungsankündigung nach § 555c (bewusst nicht gebaut — Wortlaut + Mieterhöhungsrechnung, Anwalt); Zugang im Portal bleibt Anwaltsfrage 1; „Ich bin Eigentümer“ ist voreingestellt — ein Verwalter muss es aktiv umstellen |
| P3 Kündigung und Mieterhöhung (A7, A8, B40, B42, B44, Liste der Schriftform-Arten) | ✅ gebaut 08.10.2026, `tests/paketP3.test.ts` + `tests/paketP3Server.test.ts` (32 Mutationen rot). EINE Prüfung `pruefeBrief()` (`lib/briefPruefung.ts`) für Vorschau UND Server (PDF-Route 400, Archiv lehnt ab): Absender Pflicht (kein „MyImmo“ mehr), Begründung Pflicht bei Erhöhung und Kündigung (Bausteine je Begründungsmittel, Lücken in [Klammern] sperren), „Zugang beim Mieter“ als Grundlage der Fristen, § 573c-Termin mit drittem Werktag (Samstag nach BGH VIII ZR 206/04) und Verlängerung nach 5/8 Jahren, § 558b-Wirksamkeit, Sperrfrist 1 Jahr/15 Monate, Kappung 20 % (Hinweis 15 %). Kündigung: Widerspruchshinweis mit Textform und Zwei-Monats-Frist, kein Versand per Mail/Portal, keine eingebettete Unterschrift (auch serverseitig). `mieter.weitere_mieter` (`20261008120000`, live): Empfänger, Anrede und `{{mieter}}` nennen alle. Dabei: Das PDF nahm die Mieterfelder, die Vorschau die geltenden Beträge (Paket B) — jetzt beide `vertragswerte()`. **Offen:** Anwaltsfragen 3–6 (Wortlaut, Zugang vs. Beendigung, mehrere Mieter, Schriftform Quittung/Wohnungsgeber — dort nur Hinweis, nichts gesperrt); keine außerordentliche Kündigung (Werbetext angepasst); Modernisierungserhöhungen (§ 559) zählen in der Kappungsprüfung mit (strenger als das Gesetz) |
| P5 Demo-Sicherheit (B52–B56, C53; Bekannt B26, C22) | ✅ gebaut 08.10.2026, `tests/paketP5.test.ts` (26 Mutationen rot). Abmelden nur lokal; Auftrags-Link der Demo nimmt nichts an (RPC + Trigger auf allen Eingangstabellen, `20261008100000`); Schreibknöpfe mit `data-demo-sperre` → Sperr-Dialog, Rest über den Toast-Hinweis; Sperr-Dialog auch im Mieter-/Service-Portal; Dokument ohne Datei ohne Knöpfe; Alt-Adressen frei; ALLE Anlege-/Bearbeiten-/Import-Formulare gesperrt; Lese-Werkzeuge (Suche, Palette, Rechner, Jahreswahl) frei. **B54 nicht vollständig:** ~75 Knöpfe, die über eine Zwischenfunktion schreiben, sind nicht einzeln markiert — sie scheitern an der Datenbank und erklären sich im Toast |
| Nachtrag B10 (08.10.2026, Betreiber) | Mahnung NICHT mehr erst nach einer Erinnerung: Knopf „Dokument“ → Auswahl Zahlungserinnerung/Mahnung (`components/BriefWahl.tsx`), die archivierte Erinnerung ist nur noch Hinweis. Der Text behauptet weiter keine vorherige Erinnerung |
| P7 Mietkonto und Fristen (B7–B16, C26, C27, C40, C42; Zusammenführung 10) | ✅ gebaut 08.10.2026, `tests/paketP7.test.ts` (17 Mutationen rot). **Dabei gefunden (neu, Schwere A):** Portal-Sichten waren für Mieter schreibbar — behoben in `20261008081000`, live geprüft |
| P6 Kredite mit Zeit (B3 Jahresbericht-Teil, B17–B23, C7; Zusammenführungen 6, 7, 12) | ✅ gebaut 07.10.2026, `tests/paketP6.test.ts` (12 Mutationen rot). Kein Bank-Tilgungsplan als Referenzfall (keiner vorhanden) — Referenzfälle aus dem Bericht |
| P1 Anlage V richtig (A1, A2, A3, B2, B3 Anlage-V-Teil, B4, Doppelberechnung 9; 8 teilweise) | ✅ gebaut 07.10.2026, `tests/paketP1.test.ts` (10 Mutationen rot). B1 (Zeilennummern) und der Jahresbericht-Teil von B3 offen (P6) |
| P2 NK richtig (A4, A5, A6, B5, B6, C22, C25) | ✅ gebaut 07.10.2026, `tests/paketP2.test.ts` (11 Mutationen rot); B5 seit `20261007210000` live (Einfüge-Funktion nach dem Reset, kein SQL-Editor nötig) |

## 1. Zusammenfassung

**Neue Befunde nach der Gegenprüfung: 8 × A · 60 × B · 61 × C.** Doppelt gemeldete Befunde aus mehreren
Bereichen sind zusammengeführt; die ursprünglichen Kennungen stehen jeweils in Klammern. Bekannte Punkte, die
weiter offen sind, stehen gesammelt in 4a und sind nicht mitgezählt.

Von 12 gemeldeten A-Befunden hat die Gegenprüfung alle bestätigt. Vier davon wurden auf B herabgestuft
(R2-01, R2-05, R4-02, R5-01, siehe Abschnitt 5), verworfen wurde keiner.

**Wo die Schwächen liegen (nach Gewicht):**
1. **Rechtsdokumente des Brief-Generators.** Kündigung, Mieterhöhung, Mietquittung, Modernisierung,
   Wohnungsgeberbestätigung: Pflichtbestandteile fehlen, die Schriftform wird nicht beachtet, Termine werden
   nicht geprüft, Absender fehlt, mehrere Vertragspartner sind nicht vorgesehen. Hier sitzen zwei der A-Befunde
   und zehn B-Befunde.
2. **Steuer (Anlage V).** Anschaffungsnahe Herstellungskosten werden trotz Wächter-Warnung als Erhaltung
   geführt. „Selbst bewohnt“ landet in der Anlage V. Die degressive AfA ist nach einem unterjährigen Erstjahr
   ab Jahr 2 zu niedrig. Die Zeilennummern stimmen nicht mit dem Vordruck 2025 überein. Zinsen werden für Jahre
   vor der Auszahlung geschätzt.
3. **Nebenkosten.** Die CO2-Gutschrift wird im Mehrfamilienhaus mehrfach angesetzt. Beim Personenschlüssel
   rechnet die App anders, als ihre Warnung sagt. Bei unterjährigem Bezug fehlt in der HKVO-Grundkostenrechnung
   der Zeitanteil. Jeder Demo-Reset löscht die neuen NK am Objekt.
4. **Kredite ohne Zeitbezug.** Anlage V, Jahresbericht und Cashflow wissen nicht, wann ein Darlehen beginnt
   oder endet. Abbezahlte Darlehen zählen weiter. Leere Restschuld wird an vier Stellen unterschiedlich
   gelesen.
5. **Demo-Grenzen.** Ein Abmelden beendet die Sitzungen aller Demo-Besucher (`signOut` global). Der
   öffentliche Auftrags-Link schreibt in den Demo-Bestand. Schreibknöpfe außerhalb von Formularen enden in
   allgemeinen Fehlermeldungen.
6. **Mehrere Regeln für dieselbe Größe.** Rendite hat drei Bezugsgrößen. Für „überfällig“ gibt es drei
   Regeln, für die Teilzahlungs-Toleranz zwei. Der Kostenschnitt wird im Dashboard anders gebildet als auf der
   Objektseite. Als Stichtag dient mal UTC, mal Berliner Zeit.

**Ohne Befund (nachgerechnet):** Dashboard-Kennzahlen der Demo, Wertkurve, Buchungssaldo 1J/3J/5J/Max,
Schulden-Uhr, Ø-Zins, Beleihungsauslauf, freie Grundschuld. Ebenso Anlage V 2025 im Abgleich Seite = PDF =
CSV = DATEV, Jahresbericht 2025, NK 2025 aller sieben Demo-Mieter (Seite = PDF = Sammel-PDF), alle
16 Grunderwerbsteuersätze, Kaufnebenkosten, Kennzahlen der Kaufprüfung, Restschuld-Iteration gegen die
Annuitätenformel, KfW-458-Stichtagsabsenkung, BAFA/iSFP, KfW 308, § 35c und 21 Katalog-Zitate wörtlich.
Darstellung: 304 Ladungen der öffentlichen Strecke und alle App-Seiten in vier Breiten, hell und dunkel, ohne
waagerechten Überlauf, ohne abgeschnittenen Text und ohne CSP- oder Hydration-Fehler. Kein Link führt auf eine
500 oder auf eine nicht existierende Seite.

**Nicht geprüft** (Einzelheiten in Abschnitt 12): Schreibende Wege aller Art, weil nur gelesen werden durfte.
Gültige Bank-, Makler-, Bewerbungs- und Angebots-Links sowie das Code-Formular, weil die Demo keine solchen
Daten hat. Dateirouten mit echtem Inhalt, weil die Demo keine Belege und Fotos hat. Kreditantrag, Kennblatt
und Käufer-PDF nur im Code. Echte Telefone, Screenreader, iOS Safari. Amtlicher Anlage-V-Vordruck direkt vom
BMF (gelesen wurde ein Nachdruck plus ELSTER-Forum). DATEV-Formatbeschreibung. Bundesanzeiger-Fundstelle der
BEG-EM-Richtlinie. Echte Konten.

**Verstoß während der Prüfung:** Der Linkprüfer aus U1 ist fünfmal `/api/demo` gefolgt (GET ohne
Cookie-Speicher). Das kann den Demo-Bestand bis zu fünfmal zurückgesetzt haben. Belege anderer Bereiche aus
diesem Zeitfenster können deshalb einen frisch zurückgesetzten Bestand zeigen. Die Folgerung steht unter
Fundament (11): Crawler müssen zustandsändernde GET-Routen ausschließen.

---

## 2. A-Befunde (nach Gegenprüfung)

### A1 · Anschaffungsnahe Herstellungskosten stehen in der Anlage V als sofort abziehbare Erhaltung (R2-02)
- **Ort:** `lib/anlageV.ts:81` (KOSTEN_BUCKET „Modernisierung“ → erhaltung), `:192-197`, `elsterZeilen` (Zeile „40“ übertragbar); Wächter `lib/steuer/waechter.ts`. Adressen `/steuer`, `/api/berichte/anlage-v`.
- **Eingaben:** Kaufpreis 100.000 €, Gebäudeanteil 80 %, Kauf am 15.01.2025, Modernisierung 20.000 € am 01.06.2025.
- **Erwartet:** § 6 Abs. 1 Nr. 1a EStG (gesetze-im-internet.de, Abruf 07.10.2026): Aufwand innerhalb von 3 Jahren über 15 % der Gebäude-AK (80.000 × 15 % = 12.000) zählt zu den Herstellungskosten. Die Erhaltung ist dann 0 €, die AfA-Basis 80.000 + 20.000 = 100.000, die AfA 2025 bei 2 % = 2.000 €. Die App sollte die Erhaltung mindestens als nicht übertragbar markieren und einen Hinweis zeigen.
- **Tatsächlich:** Der Wächter meldet „überschritten“ (Grenze 12.000). Die Anlage V führt trotzdem 20.000 € Erhaltung und 1.600 € AfA, ohne Hinweis. Zeile 40 und die Summe gelten als übertragbar. Damit sind die Werbungskosten um 19.600 € zu hoch. PDF und ELSTER-Hilfe warnen nicht.
- **Beleg:** `tests/R2/anschaffungsnahAnlageV.test.ts`, `r2/an.log`; Gegenprüfung `tests/V-R2/gegen.test.ts`, `res.txt`.
- **Fix:** `berechneAnlageV` wertet je Objekt `berechneAnschaffungsnah()` aus. Bei „überschritten“ gibt es einen Hinweis und `uebertragbar:false` auf der Erhaltungszeile und der Summe. Umgebucht wird nicht, weil nur der Nutzer beurteilen kann, was netto gilt und was „jährlich üblich“ ist.
- **Test:** Der Fall oben ist ein Dauertest. Mutation „Prüfung entfernen“ macht ihn rot.

### A2 · Objekte „Selbst bewohnt“ erhalten AfA und Kosten in der Anlage V (R2-03)
- **Ort:** `lib/anlageV.ts:181/200` (kein Filter auf `obj_status`), `app/(app)/steuer/page.tsx:14`, `app/api/berichte/anlage-v/route.ts:42`, `lib/steuer/waechter.ts:40-50`. Gegenbeispiel in der App selbst: `lib/billing/aboBuchung.ts:84-86` nimmt „Selbst bewohnt“ von den Werbungskosten aus.
- **Eingaben:** obj_status „Selbst bewohnt“, 300.000 €, 80 %, Baujahr 1990, Kauf am 01.01.2020, Grundsteuer 500 €.
- **Erwartet:** Ohne Einkünfte nach § 21 EStG gibt es keine Anlage V und keine AfA als Werbungskosten.
- **Tatsächlich:** AfA 4.800 €/Jahr (300.000 × 80 % × 2 %), Überschuss −5.300 €. Der Wert steht in der Objektzeile, in der Gesamtsumme, im PDF und in der ELSTER-Hilfe; bei gemischtem Bestand drückt er den Gesamtüberschuss.
- **Nebenbefund (allein höchstens C):** Der Wächter zeigt dafür die Spekulationsfrist. Weil die Ausnahme nach § 23 Abs. 1 Nr. 1 S. 3 EStG eine durchgehende Eigennutzung voraussetzt, ist die Warnung als Vorsicht vertretbar.
- **Beleg:** `tests/R2/grenzfaelle.test.ts` (Block „Selbst bewohnt“), `r2/grenz.log`; Gegenprüfung in `V-R2.md`.
- **Fix:** „Selbst bewohnt“ aus Anlage V, PDF und Vorjahresvergleich herausnehmen, alternativ ausdrücklich mit „nicht in die Anlage V“ kennzeichnen.
- **Test:** Fall „Selbst bewohnt“ → Objekt nicht in der Summe. Mutation „Filter entfernen“ macht ihn rot.

### A3 · Degressive AfA ab dem zweiten Jahr zu niedrig, wenn das erste Jahr zeitanteilig war (R2-04)
- **Ort:** `lib/anlageV.ts:248-252` (`afaBasis × 0,05 × 0,95^n × faktor`). Adressen `/steuer`, Anlage-V-PDF.
- **Eingaben:** Basis 100.000 € (125.000 × 80 %), degressiv, Startjahr 2025, Kauf am 01.11.2025.
- **Erwartet:** § 7 Abs. 5a S. 4 EStG (gesetze-im-internet.de/estg/__7.html, 07.10.2026): 5 % vom jeweiligen Restwert. Nach S. 5 i. V. m. Abs. 1 S. 4 wird das erste Jahr gezwölftelt. Daraus folgt: 2025 = 100.000 × 5 % × 2/12 = **833,33**. 2026 = (100.000 − 833,33) × 5 % = **4.958,33**. 2027 = (99.166,67 − 4.958,33) × 5 % = **4.710,42**.
- **Tatsächlich:** 833,33 / 4.750,00 / 4.512,50, je 100.000 € Basis also 208,33 € (2026) und 197,92 € (2027) zu wenig. Bei einem Kauf im Januar rechnet die App richtig (5.000 / 4.750). `tests/afa.test.ts` prüft nur volle Jahre.
- **Beleg:** `tests/R2/grenzfaelle.test.ts` (Block „AfA degressiv“), `r2/grenz.log`; Gegenprüfung `V-R2.md`.
- **Fix:** Den Restwert jahresweise fortschreiben: Jahr 1 mit Zeitanteil, danach 5 % vom tatsächlichen Restwert.
- **Test:** Erwartungswerte 4.958,33 und 4.710,42. Mutation `0.95^n` macht ihn rot.

### A4 · CO2-Gutschrift im Mehrfamilienhaus mehrfach bzw. mit falscher Stufe (R3-01)
- **Ort:** `lib/nk.ts:295-325, 562-568`; `lib/co2.ts:80-111`; `components/NkCo2Panel.tsx:134-145` (Fläche vorbelegt mit der Wohnung, `app/(app)/tenants/[id]/nk/page.tsx:301-306`). Adresse `/tenants/<id>/nk?jahr=…`.
- **Eingaben:** Zweifamilienhaus mit 60 + 70 m². Laut Brennstoffrechnung 4.000 kg CO2 und 220 € CO2-Kosten für das Gebäude, im Block beider Mieter eingetragen.
- **Erwartet:** § 5 Abs. 1 CO2KostAufG (gesetze-im-internet.de, 07.10.2026; lokal `R3/co2voll.html`): Maßgeblich ist der Ausstoß des Gebäudes je m² der Gesamtwohnfläche, also 4.000/130 = 30,8 kg → Stufe 27 bis < 32 → Vermieteranteil 40 % = **88 € für das ganze Haus**. Nach § 7 Abs. 1 wird dieser Anteil nach der Heizkostenverteilung auf die Mieter aufgeteilt, die Gutschriften ergeben zusammen 88 € (Beispiel 640/1.400: 40,23 € + 47,77 €).
- **Tatsächlich:** Mit der Wohnfläche als Vorgabe ergibt sich je Mieter 66,7 bzw. 57,1 kg/m² → 95 % → je 209 €, zusammen **418 € Gutschrift bei 220 € CO2-Kosten**. Mit 130 m² sind es je 88 €, zusammen 176 €. „Vermieteranteil als Kosten buchen“ bucht je Mieter, die Werbungskosten werden also mehrfach angesetzt. Bei Einfamilienhaus oder Einzelwohnung mit einem Mieter stimmt die Rechnung.
- **Beleg:** `tests/R3/co2.test.ts`, `R3/lauf4.txt`; Gegenprüfung `tests/V-R3/v.test.ts`, `V-R3-out.txt`.
- **Fix:** CO2 einmal am Objekt erfassen (Gebäude-kg, Gebäudefläche, Gebäudekosten), dort die Stufe bilden und den Vermieteranteil nach dem Heizkostenanteil verteilen. Bis das gebaut ist, die Funktion im Mehrfamilienhaus sperren.
- **Test:** Zwei Mieter mit gleichen Gebäudewerten: Summe der Gutschriften = Gebäudekosten × Vermieterprozent. Mutation „Wohnfläche statt Gebäudefläche“ macht ihn rot.

### A5 · Personenschlüssel: fehlende Personenzahl wird dem anderen Mieter zugeschlagen, die Warnung behauptet das Gegenteil (R3-02)
- **Ort:** `lib/nkObjekt.ts:171-184` (die Tage von Mietern ohne Personenzahl zählen als „belegt“, deshalb wird `leerTage = 0`) und `:199-213` (Warnung). Adresse `/properties/<id>/nebenkosten?jahr=…`.
- **Eingaben:** 2 Einheiten, beide ganzjährig belegt. Mieter K mit 2 Personen, Mieter B ohne Angabe. Müll 300 € nach Personen.
- **Erwartet:** Laut eigener Warnung („Anteil bleibt beim Vermieter“), mit B wie eine leere Wohnung mit 1 Person: K = 300 × 730/(730 + 365) = **200 €**, Vermieter 100 €.
- **Tatsächlich:** K zahlt 300,00 €, Vermieter 0,00 €. Die Warnung lautet „Personenzahl fehlt bei B (Anteil bleibt beim Vermieter)“.
- **Beleg:** `tests/R3/nk.test.ts` („Personen-Schlüssel“), `R3/lauf2.txt`; Gegenprüfung `V-R3-out.txt`.
- **Fix:** Die Tage ohne Personenzahl als Vermieter-Gewicht mit 1 Person führen, oder die Position gar nicht verteilen.
- **Test:** Ein Mieter ohne Personenzahl → Anteil des anderen kleiner als der Gesamtbetrag. Mutation „alte leerTage-Formel“ macht ihn rot.

### A6 · Altbestand HKVO: Grundkosten bei unterjähriger Belegung für das ganze Jahr (R3-03)
- **Ort:** `lib/nk.ts:481-502` (Zweig `hkvo` ohne Zeitfaktor; Zweig `flaeche` in `:452-458` hat einen) und `:390-398`. Erreichbar über `components/PositionsManager.tsx:34`. Für EFH/ETW ohne Objekt-NK ist das der einzige Weg. Adressen `/tenants/<id>/nk`, NK-PDF.
- **Eingaben:** Einzug am 01.10.2025 (92 Tage), 60 von 120 m², Heizkosten 4.000 €, Grundkosten 30 %, Verbrauch 1.000 von 20.000.
- **Erwartet:** § 9b Abs. 2 HeizkostenV (gesetze-im-internet.de, 07.10.2026): Bei Nutzerwechsel werden die übrigen Kosten nach Gradtagszahlen oder zeitanteilig verteilt. Zeitanteilig: 4.000 × 0,3 × 60/120 × 92/365 = 151,23 €, dazu 4.000 × 0,7 × 1.000/20.000 = 140 €, zusammen **291,23 €**.
- **Tatsächlich:** **740,00 €** (600 € Grundkosten für das ganze Jahr + 140 €), also 448,77 € zu viel. Der Rechenweg nennt keine Tage.
- **Beleg:** `tests/R3/nk.test.ts` („Altbestand HKVO unterjährig“), `R3/lauf2.txt`; Gegenprüfung `V-R3-out.txt`.
- **Fix:** Grundkosten × Tage/Jahrestage (wahlweise Gradtag-Promille), im Rechenweg ausweisen.
- **Test:** Mietbeginn am 01.10. → Grundkosten = 600 × 92/365. Mutation „Zeitfaktor entfernen“ macht ihn rot.

### A7 · Mieterhöhungsverlangen § 558 ohne Begründung; Wartefrist, Kappungsgrenze und Wirksamkeitsdatum ungeprüft (R4-01, F1-02)
- **Ort:** `lib/dokumentVorlagen.ts:102-110` (`fehlendePlatzhalter` überspringt `grund`), `:133-139`; `components/DocGenerator.tsx:236` (Feld „optional“); Werbetext `app/(pub)/vorlagen/page.tsx:22` („mit korrekter Begründung und Frist“). Adresse `/tenants/<id>/dokument?art=mieterhoehung`, `/vorlagen`.
- **Eingaben:** Demo Sophie Berger, Art Mieterhöhung, Begründung leer.
- **Erwartet:** § 558a Abs. 1 BGB: das Verlangen ist „in Textform zu erklären und zu begründen“. Abs. 2 nennt die Begründungsmittel, Abs. 3 verlangt die Angaben aus einem qualifizierten Mietspiegel. § 558 Abs. 1: 15 Monate Wartefrist bzw. 1 Jahr seit der letzten Erhöhung. § 558 Abs. 3: Kappungsgrenze 20 % (15 %) in 3 Jahren. § 558b Abs. 1: Die Erhöhung wirkt ab Beginn des dritten Kalendermonats nach Zugang. Quelle gesetze-im-internet.de, 07.10.2026 (`r4/quellen/bgb_558a.html`).
- **Tatsächlich:** `fehlendePlatzhalter(...)` liefert [], der Absatz `{{grund}}` fällt weg. Der Brief beruft sich auf § 558/§ 558b ohne Begründungsmittel. „Wirksam ab“ ist frei wählbar, Kappungsgrenze und Wartefrist werden nicht geprüft. Das Verlangen ist so formell unwirksam.
- **Beleg:** `r4/bilder/_tenants_f3fd40b4_…_dokument_art_mieterhoehung-1280-s01.png`; Gegenprüfung `tests/V-R4/v.test.ts` (Exit 0), `V-R4.md`.
- **Fix:** Begründung als Pflichtfeld mit Auswahl der Begründungsmittel und Hinweis auf § 558a Abs. 3. Warnungen bei „wirksam ab“ vor dem Beginn des dritten Monats, bei weniger als 15 Monaten seit `letzte_erhoehung` und bei mehr als 20 % gegenüber der Miete vor drei Jahren. Den Werbetext erst ändern, wenn das gebaut ist. Mehrere Vertragspartner siehe B47.
- **Test:** `fehlendePlatzhalter(mieterhoehung)` ohne grund meldet „grund“. Mutation „Ausnahme zurück“ macht ihn rot.

### A8 · Kündigungsvorlage: Grund nicht verlangt, Widerspruchshinweis unvollständig, Versand per Mail/Portal mit Bild-Signatur trotz Schriftform (F1-01)
- **Ort:** `lib/dokumentVorlagen.ts:157-163`, `:103-111`; `components/DocGenerator.tsx:236, 423-433` (E-Signatur), `457-465` (BriefVersand ohne Abfrage der Art); `app/(pub)/vorlagen/page.tsx:25`. Adressen `/tenants/<id>/dokument?art=kuendigung`, `/vorlagen`.
- **Eingaben:** Demo-Mieterin Fatma Yılmaz, Art Kündigung, Datum gesetzt, Begründung leer.
- **Erwartet:** § 573 Abs. 3 BGB: Die Gründe sind im Kündigungsschreiben anzugeben. § 568 Abs. 1 verlangt Schriftform, § 126 Abs. 1 eine eigenhändige Unterschrift. Ein PDF mit Bild-Signatur per Mail oder Portal erreicht höchstens Textform (§ 126b) und ist nach § 125 nichtig. § 568 Abs. 2 i. V. m. § 574b: Hinweis auf Form (Textform) und Frist (zwei Monate vor Beendigung) des Widerspruchs. Quellen `f1/q/bgb___573.html`, `___568.html`, `___574b.html`, `___126.html` (gesetze-im-internet.de, 07.10.2026).
- **Tatsächlich:** Der Text lautet „kündige … ordentlich und fristgerecht zum {{datum}}“. Der Grund ist optional und entfällt, wenn das Feld leer ist. Der Hinweis lautet nur „gemäß § 574 BGB zu widersprechen“. Versand per Mail oder Portal und E-Signatur sind auch für die Kündigung möglich, ein Hinweis auf die Schriftform fehlt im gesamten Code. `/vorlagen` wirbt mit „ordentliche oder außerordentliche Kündigung mit den passenden Fristen“, die Vorlage kennt aber nur die ordentliche Kündigung und rechnet keine Frist (Termin siehe B51).
- **Einschränkung:** Der Text lässt sich bearbeiten, und es gibt Fälle ohne Begründungspflicht (§ 573a, § 549 Abs. 2). Ein fehlender Widerspruchshinweis allein verlängert nur die Widerspruchsmöglichkeit (§ 574b Abs. 2 S. 2).
- **Beleg:** `f1/shots/_tenants_190f1a7a_…_dokument_art_kuendigung-1280-s01.png`, `f1/kuend.html`; Gegenprüfung `tests/V-F1/kuend.test.ts`, `V-F1.md`.
- **Fix:** Grund als Pflichtfeld (Hinweis § 573 Abs. 2). Standardtext mit Form und Frist des Widerspruchs. Für Kündigung (und andere Schriftform-Arten, siehe Fundament) Mail, Portal und E-Signatur sperren und den Hinweis „nur ausgedruckt und eigenhändig unterschrieben wirksam“ zeigen. Text auf `/vorlagen` korrigieren.
- **Test:** `fehlendePlatzhalter(kuendigung)` enthält „grund“. Die Vorlage enthält „Textform“ und „zwei Monate“. Bei art=kuendigung wird BriefVersand nicht gerendert. Mutation macht ihn rot.

---

## 3. B-Befunde

Je Befund: Ort · Eingaben · Erwartet (Rechenweg/Quelle) · Tatsächlich · Beleg · Fix · Test.

### Steuer
**B1 · Zeilennummern der Anlage V passen nicht zum Vordruck 2025 (R2-01; von A herabgestuft)**
- Ort: `lib/anlageV.ts:355-364, 399-437`, `lib/pdf/berichtPdf.ts:189/199/205`, `components/ElsterHilfe.tsx:105`, `lib/billing/aboBuchung.ts:28`, `lib/absetzbar.ts:13`, `components/BuchungForm.tsx:168`. Adressen `/steuer`, `/api/berichte/anlage-v`, CSV.
- Eingaben: Demo 2025, ELSTER-Ansicht und PDF.
- Erwartet: Vordruck 2025 (Buhl-Nachdruck `r2/quellen/v25.txt`, ELSTER-Forum 443015/465384). Z.13-15 Mieten (Kz 01), Z.19 Umlagen, Z.33 AfA, Z.37 § 7b, Z.40 §§ 7h/7i, Z.46-48 Schuldzinsen, Z.55/56 Erhaltung, Z.73-75 umgelegte, Z.76-78 nicht umgelegte Kosten, Z.83 Summe WK, Z.85 Überschuss.
- Tatsächlich: Die App nennt 9/13/14/21/33/37/40/46/47/50/51/23-24. Schuldzinsen stehen auf „Z.37“, also der § 7b-Zeile, und der Abo-Hinweis bucht „Verwaltung (Zeile 46)“. Nur Z.33 stimmt. Bezeichnungen und Beträge sind richtig, und die App rät, die Zeilen gegenzuprüfen; deshalb B.
- Beleg: `r2/steuer-live.json`, `r2/av2025.pdf.txt`, `r2/steuer-elster-2025-*.png`.
- Fix: Zeilentabelle je Steuerjahr mit Kennzahl. Grundsteuer und Versicherung je nach Umlage in Z.73 oder Z.76. Bis die Tabelle da ist, Zeilennummern ausblenden. Prüftermin für jeden September in `07 Volatile Kennzahlen`.
- Test: Tabelle gegen einen Auszug aus `v25.txt`. Mutation „37“ statt „46-48“ macht ihn rot.

**B2 · afa_start_jahr ≠ Kaufjahr: Kaufmonat wird auf das Startjahr angewendet (R2-05; von A herabgestuft)**
- Ort: `lib/anlageV.ts:248, 260-262`; `components/PropertyForm.tsx:143, 216-217` (Platzhalter „= Baujahr“, Beschriftung „nur degressiv“, obwohl auch die lineare AfA das Feld nutzt).
- Eingaben: Kaufdatum 15.11.2024, afa_start_jahr 2025, linear 2 %, Basis 240.000.
- Erwartet: Wenn die Anschaffung im Januar 2025 liegt, gilt für 2025 die volle AfA von 4.800 € (§ 7 Abs. 1 S. 4 EStG). Mindestens sollte die App den Widerspruch melden.
- Tatsächlich: 800 € (2/12), ohne Hinweis. Die Eingaben widersprechen sich, die App merkt es nicht.
- Beleg: `tests/R2/grenzfaelle.test.ts`, `r2/grenz.log`; `V-R2.md`.
- Fix: Den Monat nur aus `kaufdatum` nehmen, wenn das Jahr dem Startjahr entspricht, sonst ein Hinweis. Beschriftung und Platzhalter korrigieren.
- Test: Der Fall als Dauertest.

**B3 · Kredite ohne Zeitgrenze: Zinsschätzung in der Anlage V und Raten im Jahresbericht für Jahre vor Auszahlung/Kauf (R5-01 von A herabgestuft, R5-02, R1-01)**
- Ort: `lib/anlageV.ts:280-298` (Σ Restschuld × Zins für das ganze Jahr), `app/(app)/steuer/page.tsx:17` (lädt kein `auszahlung_datum`); `lib/jahresberichtZeile.ts:53-60` (Rate × Monate); `app/(app)/jahresbericht/page.tsx:34`, `app/api/berichte/jahresbericht/route.ts:47`. Adressen `/steuer`, `/jahresbericht?year=2021|2023`, beide PDFs.
- Eingaben: (a) Kauf und Auszahlung am 01.03.2026, 200.000 € zu 3,5 %, keine Zinsbuchungen. (b) Demo Plagwitz: Kauf 15.08.2023, Auszahlung 01.10.2023, Rate 1.180 €, Restschuld 256.000 €, 3,8 %.
- Erwartet: (a) 2024/2025 Schuldzinsen 0, 2026 höchstens 200.000 × 3,5 % × 10/12 = 5.833 €. (b) 2023 Raten 3 × 1.180 = 3.540 €, Zinsen höchstens 256.000 × 3,8 % × 3/12 = 2.432 €. 2021 kein Objekt, also 0.
- Tatsächlich: (a) Je 7.000 € in 2024, 2025 und 2026. Das Objekt erscheint vor dem Kauf mit Verlust, die Summen und der Vorjahresvergleich enthalten den Wert, gekennzeichnet nur als „(geschätzt)“. (b) Je ~9.728 € Zins, 4.432 € Tilgung und −14.160 € Cashflow; Summe 2021 −53.880 € für vier Darlehen, obwohl Plagwitz erst 2023 gekauft wurde.
- Beleg: `tests/R5/anlagev.test.ts`, `r5/lauf2.txt`, `tests/V-R5/zins.test.ts`; `r1/jb2021.html.txt`, `r1/jb2023.html.txt`, `r5/jb2023.html`, `tests/R1/grenz.test.ts`.
- Fix: Eine gemeinsame Funktion `kreditAktivImMonat(k, monat)` (ab `auszahlung_datum`, ersatzweise Kaufdatum; bis Ablösung). Anlage V, Jahresbericht, Seite und PDF nutzen sie. `auszahlung_datum` mitladen. Ohne Datum der Hinweis „ganzjährig angenommen“.
- Test: Referenzfall Auszahlung im Oktober → 3 Raten, im Folgejahr → 0. Mutation „Zeitbegrenzung entfernen“ macht ihn rot.

**B4 · Anlage-V-PDF: Summe der Werbungskosten und Ergebnis enthalten die Zinsschätzung ohne Kennzeichnung (R2-07)**
- Ort: `lib/pdf/berichtPdf.ts:194-205` (die Oberfläche markiert über `lib/anlageV.ts:428-437`).
- Eingaben: Demo 2024 mit geschätzten Zinsen.
- Erwartet: Die gleiche Kennzeichnung wie in der App (Summe und Überschuss nicht übertragbar).
- Tatsächlich: Nur die Zinszeile ist „(geschätzt)“. „Summe Werbungskosten 8.638,00“ und „Verlust −8.638,00 €“ stehen ohne Zusatz.
- Beleg: `r2/av2024.pdf`, `av2024.pdf.txt`.
- Fix: Summe und Ergebnis über `uebertragbar` mit dem Zusatz „enthält Schätzung“ versehen.
- Test: PDF-Text bei geschätzten Zinsen enthält den Zusatz.

### Nebenkosten
**B5 · Jeder Demo-Reset löscht die NK am Objekt per Kaskade (U2-01, R3-04)**
- Ort: `supabase/migrations/20261007090000_nk_objekt.sql:17/34` (`prop_id … on delete cascade`); `20261007113957_demo_nk_objekt.sql` (Kommentar „der Reset fasst diese Tabellen nicht an“); `demo_zuruecksetzen()` (delete from properties). Adresse `/properties/d560ceb5-9dc2-4869-a0c8-41833c061a2c/nebenkosten?jahr=2025`.
- Eingaben: Demo-Konto nach den Resets vom 07.10.2026.
- Erwartet: 8 Kostenarten 2025 laut Migration. Nachgerechnet ergibt das Krüger 1.494,31 € (280×60/130 + 325×60/130 + 780×58/130 + 640 + 252/3 + 120/2 + 180×60/130), Guthaben 305,69 €; Berger 1.818,69 €; Vermieter 24,00 €.
- Tatsächlich: `nk_objekt_kosten` und `nk_objekt_jahr` haben 0 Zeilen (SELECT, `confdeltype='c'`). Die Seite zeigt „Noch keine Kosten für 2025“, und Krüger wird nach dem Altbestand abgerechnet (1.484,00 €).
- Beleg: `U2/hell-768/_properties_d560_nebenkosten-s01.png`, `R3/objekt-nk.html`, `R3/shots/…nebenkosten_jahr_2025-390-s01.png`.
- Fix: Beide Tabellen in `demo_seed` und in `tabellen` der Reset-Funktion aufnehmen und den Kommentar in Migration und `docs/zukunft/NK-NEU.md` korrigieren. Danach die übrigen Kaskaden-Tabellen auf properties/mieter prüfen, die nicht im Reset stehen (`miet_zeitraeume`, `nk_co2`, `beleihung_dokumente`, `bewertung_historie`, `vergleichsangebote`, `bewerber_links`).
- Test: SQL-Probe in einer zurückgerollten Transaktion: nach dem Reset `count(nk_objekt_kosten) > 0`. Zusätzlich ein Rauchtest-Weg mit „1.494,31“.

**B6 · Vorauszahlung „9 × 150,00 €“ neben 1.275,00 € (R3-05)**
- Ort: `lib/pdf/nkPdf.ts:296-301`, `app/(app)/tenants/[id]/nk/page.tsx:418`; Betrag aus `lib/nk.ts:189-205`.
- Eingaben: Mietbeginn 16.04.2025, Vorauszahlung 150 €, keine Buchungen.
- Erwartet: 150 × 15/30 + 8 × 150 = 1.275 €, und der Rechenweg zeigt genau das („April anteilig 75 € + 8 × 150 €“).
- Tatsächlich: „1.275,00 € · 9 × 150,00 €“, obwohl 9 × 150 = 1.350 ergibt.
- Beleg: `R3/sim-objekt.pdf` (`tests/R3/pdf.test.ts`).
- Fix: Den Zusatz aus der Monatsreihe bilden. Test: Zusatz × Rate = Betrag.

### Mietkonto, Fristen, Mieterhöhung
**B7 · Fälligkeit (`dritterWerktag`) ohne Feiertage (R4-02; von A herabgestuft)**
- Ort: `lib/mietkonto.ts:280-297`, `lib/mahnung.ts:18-20, 39-41`. Dashboard „Erinnerung schreiben“, Rückstands-Wächter, Brieftext.
- Eingaben: Monate 2026–2028 mit den bundesweiten Feiertagen (Osterformel).
- Erwartet: Werktage zählen ohne Sonn- und Feiertage (§ 193 BGB), Samstag zählt nicht (BGH VIII ZR 129/09). 04/2026: Karfreitag 03.04., Ostermontag 06.04. → 3. Werktag ist der 07.04. 01/2027 → 06.01. 05/2026 → 06.05.
- Tatsächlich: 2026-01 05.01., 2026-04 03.04., 2026-05 05.05., 2027-01 05.01., dazu 2028-05/06/10 jeweils einen Tag zu früh. Der Brief schreibt „fällig am 5. Januar 2027, dem dritten Werktag“. `mieteUeberfaellig('2026-04','2026-04-06')` = true, also schon am Ostermontag. Der Verzug selbst bleibt unberührt (§ 286 Abs. 2 Nr. 1), deshalb B.
- Beleg: `tests/R4/r4.test.ts`, `r4/lauf1.txt`, `tests/V-R4/lauf.txt`.
- Fix: Bundeseinheitliche Feiertage überspringen und die Landesfeiertage als Hinweis im Brief nennen. Der Kommentar dazu ist falsch und gehört korrigiert. Bekannt aus AUDIT-2026-10-01 A11, dort wurden die Feiertage bewusst ausgelassen; den zugesagten Hinweis im Schreiben gibt es aber nicht.
- Test: `dritterWerktag('2026-04') == '2026-04-07'`, `('2027-01') == '2027-01-06'`.

**B8 · „Mieterhöhung möglich (§ 558)“ auch bei Index- und Staffelmiete (U2-02, R4-03)**
- Ort: `lib/fristen.ts:73-83`. Adressen `/tenants/f3fd40b4-…` (Berger, Index), `/tenants/3b1ffc1f-…` (Schmidt, Staffel), `/termine`.
- Eingaben: `mieterFristen` mit mietart index/Index/staffel.
- Erwartet: Bei Staffelmiete sind §§ 558–559b ausgeschlossen (§ 557a Abs. 2 S. 2 BGB), bei Indexmiete § 558 (§ 557b Abs. 2 S. 3 BGB) (gesetze-im-internet.de und buzer.de, 07.10.2026). Der eigene Ratgeber sagt das auch (`lib/ratgeber.ts:1036, 1049`).
- Tatsächlich: „✓ Mieterhöhung möglich (keine bisher) – jetzt“, der Prüftest ist für alle drei Mietarten rot. Der Generator bietet der Indexmieterin § 558 ohne Warnung an.
- Beleg: `tests/U2/fristen.test.ts`, `U2/test-fristen.log`, `U2/hell-390/_tenants_f3fd-s04.png`, `r4/t_f3fd40b4-….html`.
- Fix: Den § 558-Zweig nur bei `normMietart() === 'standard'` anwenden, im Generator bei Index/Staffel warnen.
- Test: Index/Staffel → kein § 558-Eintrag.

**B9 · Abgelaufene Staffelstufe fällt still weg (R4-04)**
- Ort: `lib/fristen.ts:110-131`; Mietkonto. Adresse `/tenants/3b1ffc1f-93b3-4038-bfe4-4105d9804a45`.
- Eingaben: Demo Schmidt, 1.090 € kalt + 190 € NK, Staffel ab 01.09.2026 mit +40 €/12 Monate, keine Miet-Zeiträume.
- Erwartet: Soll ab September 1.320 €, mindestens aber der Hinweis „Stufe nicht übernommen“.
- Tatsächlich: Soll 1.280 €, kein Rückstand (2 × 40 € bleiben unbemerkt), die Frist springt auf 01.09.2027.
- Beleg: `r4/t_3b1ffc1f-….html`, `r4/bilder/…-1280-s02.png`.
- Fix: Eine verstrichene Stufe ohne Zeitraum erzeugt eine Warnung bzw. Aufgabe. Bekannt aus dem Verknüpfungs-Audit B2: der Knopf existiert, der Hinweis fehlt.
- Test: Verstrichene Stufe → Warn-Eintrag.

**B10 · Überfällig ab dem Folgetag; Mahnung sofort wählbar, Text behauptet eine vorherige Erinnerung (R4-05)**
- Ort: `lib/mahnung.ts:18-20`, `components/RueckstandWaechter.tsx:96-101`, `lib/dokumentVorlagen.ts:149`. Adresse `/mietkonto`.
- Eingaben: 07.10.2026, Berger Oktober unbezahlt, fällig 05.10.
- Erwartet: Nach BGH VIII ZR 222/15 vom 05.10.2016 reicht es, den Zahlungsauftrag bis zum dritten Werktag zu erteilen (lto.de, kpmg-law.de). Wenn das Geld am Folgetag noch nicht da ist, beweist das keinen Verzug. Die Formulierung „trotz vorheriger Erinnerung“ setzt voraus, dass eine Erinnerung verschickt wurde.
- Tatsächlich: „2 Tage überfällig“, Erinnerung und Mahnung stehen ab Tag 1 nebeneinander, der Kommentar lautet „Verzug ab dem Folgetag“.
- Beleg: `r4/mietkonto.html`.
- Fix: Die Mahnung erst nach einer archivierten Erinnerung anbieten oder den Text neutral fassen. Optional zwei Bankarbeitstage Karenz.
- Test: Ohne Erinnerung kein Mahnungs-Knopf.

**B11 · Zwei Teilzahlungs-Toleranzen (R4-06)**
- Ort: `lib/mietkonto.ts:230` (1,00 €, `>=`), `lib/mieterKonto.ts:35` (0,50 €).
- Eingaben: Soll 1.000 €, gebucht 999,20 €.
- Erwartet: Eine Regel für beide Sichten (Ziel aus Verknüpfungs-Audit B5).
- Tatsächlich: Der Vermieter sieht „bezahlt“, der Mieter „teilweise bestätigt“. Genau 1,00 € Fehlbetrag gilt als bezahlt, der Kommentar sagt aber „unter“.
- Beleg: `tests/R4/toleranz.test.ts`, `r4/tol.txt`.
- Fix: `TEILZAHLUNG_TOLERANZ` auch im Portal verwenden, Vergleich und Kommentar angleichen. Test: 0,80 € → gleiche Antwort.

**B12 · Dashboard: Offene Vormonatsmiete verschwindet am Monatsersten (R4-07)**
- Ort: `app/(app)/page.tsx:196-208`, `lib/heute.ts:108-130`.
- Eingaben: Oktober unbezahlt, heute 01.11.
- Erwartet: Der Rückstand bleibt in „Termine & Aufgaben“ stehen, bis er erledigt ist.
- Tatsächlich: Nur `erwarteteMonate(lfd, lfd)` wird geprüft, also fällt der Oktober heraus und steht nur noch im Wächter auf `/mietkonto`. Gelesen im Code; ein Live-Nachweis ist erst am Monatsersten möglich.
- Fix: Offene Monate der letzten ≤ 62 Tage aus `offeneMieten()` übernehmen. Test: Am 01.11. ist die Oktobermiete in der Liste.

**B13 · Drei verschiedene Regeln für „überfällig“ (R4-08, R4-13, R4-14)**
- Ort: `lib/heute.ts:117` (dringend ab dem 5.), `lib/mietkonto.ts:316-337` (`offeneMieten`, Server-Ortszeit), `lib/mahnung.ts` (`mieteUeberfaellig`, Berliner ISO-Datum), `components/RueckstandWaechter.tsx:30, 45-56`.
- Eingaben: (a) 05.10.2026, der 3. Werktag. (b) `2026-10-05T23:30Z`, in Berlin der 06.10. um 01:30.
- Erwartet: Überall dieselbe Regel `mieteUeberfaellig` nach Berliner Datum. Am Fälligkeitstag heißt es „fällig“, nicht „überfällig“.
- Tatsächlich: (a) dringend=true, die Erinnerung fehlt aber, und es ist rot markiert. (b) `tageOffen` ist bei TZ=UTC 0, bei Berlin 1, bei New York 0. Der Wächter-Titel zählt `tageOffen===0` als „überfällig“, die Zeile darunter sagt „heute fällig“.
- Beleg: `tests/R4/heute.test.ts`, `r4/heute.txt`, `tests/R4tz/tz.test.ts`, `r4/tz_*.txt`, `r4/lauf1.txt`.
- Fix: Eine Funktion für alle drei Stellen, mit `heuteBerlin()`.
- Test: 05.10.2026 → nicht dringend; Vergleich über vier Zeitzonen.

**B14 · Kontoauszug: Nachname als Teilstring des Verwendungszwecks ergibt „sicher“ beim falschen Mieter (R4-09)**
- Ort: `lib/kontoauszug.ts:155-156, 183`. Adresse `/mietkonto` → „Kontoauszug abgleichen“.
- Eingaben: Mieter „Kai Mai“ und „Eva Huber“, je 750 € offen; Zahlung 750 € von „Petra Schulz“, Zweck „Miete Mai 2026 Whg 2“, ohne IBAN.
- Erwartet: Höchstens „Vorschlag“, weil nur der Betrag passt.
- Tatsächlich: Treffer „mai“ gibt 2 + 2 = 4 Punkte → „sicher“, vorausgewählt.
- Beleg: `tests/R4/r4.test.ts`, `r4/lauf1.txt`.
- Fix: Namen nur als ganzes Wort werten, Monatsnamen und „miete“ ausnehmen. „Sicher“ nur bei passender IBAN oder Name im Auftraggeberfeld. Test: Fall → „vorschlag“.

**B15 · Berechtigte Mietminderung lässt sich nicht erfassen (F2-03)**
- Ort: `lib/mietkonto.ts:230-245, 316-337`, `lib/heute.ts:110-129`. Adressen `/`, `/mietkonto`.
- Eingaben: Soll 1.000 €, von Juli bis September 2026 je 900 € gezahlt wegen 10 % Minderung.
- Erwartet: Die Minderung tritt kraft Gesetzes ein (§ 536 Abs. 1 BGB; test.de). Offen ist also 0 €.
- Tatsächlich: Drei Monate mit je 100 € „offen“, ab dem 5. dringend, mit Knopf zur Zahlungserinnerung. Der Text dort sagt „noch nicht eingegangen“.
- Beleg: `tests/F2/f2.test.ts`, `F2src/lauf2.txt`.
- Fix: Minderung je Zeitraum erfassen (Betrag oder Prozent, Grund, Verweis auf das Anliegen). Geminderte Monate gelten nicht als offen. Test: erfasste Minderung → kein offener Monat.

**B16 · Werbeaussage zur Kaution: Anlageort und Einbehalt beim Auszug gibt es nicht (R4-10)**
- Ort: `lib/funktionen.ts:165-166`, `/funktionen/mietkonto`; `components/TenantForm.tsx:158-160`.
- Erwartet: Die Werbung beschreibt, was gebaut ist (§ 5 UWG).
- Tatsächlich: Es gibt kein Eingabefeld für `kaution_bank` und keinen Einbehalt-Ablauf; der Text sagt „Beim Auszug steht damit fest, was einbehalten wurde“. Bekannt aus AUDIT-2026-10-01 B14, dort wurde nur der Teil zu den Raten behoben.
- Beleg: `r4/funk.html`. Fix: Text kürzen. Test: Text-Wächter.

### Kredite
**B17 · Abbezahltes Darlehen: Rate zählt weiter als Tilgung und als Kosten (R5-03, R1-09)**
- Ort: `lib/schuldenStand.ts:44-49`, `app/(app)/page.tsx:332`, `app/(app)/kredite/page.tsx`, `app/(app)/kredite/[id]/edit/page.tsx:70` (min 0.01).
- Eingaben: Betrag 200.000 €, Restschuld 0, Rate 900 €, Zins 3 %.
- Erwartet: Tilgung 0, keine Rate im Monats-Cashflow.
- Tatsächlich: Die Uhr zeigt „− 900 € Tilgung / Monat“, der Cashflow ist um 900 €/Monat zu niedrig. Die Rate 0 lässt sich nicht speichern.
- Beleg: `tests/R5/kredite.test.ts`, `r5/lauf1.txt`, `tests/R1/grenz.test.ts`.
- Fix: Darlehen mit Restschuld ≤ 0 aus Raten und Tilgung herausnehmen oder einen Status „getilgt“ einführen; Rate 0 bei Restschuld 0 erlauben. Test: Restschuld 0 → Tilgung 0, Rate 0.

**B18 · Leere Restschuld wird an sechs Stellen auf vier Arten gelesen (R5-04)**
- Ort: `lib/actions/buchungen.ts:258` (`updateKredit` ohne Rückfall, `createKredit:236` mit Rückfall), `components/KrediteListe.tsx:146`; Leser `lib/schuldenStand.ts`, `lib/beleihungsauslauf.ts`, `app/(app)/properties/[id]/page.tsx:474`, `…/beleihung/page.tsx:86`, `…/beleihung/deckblatt/route.ts:55`, `app/(app)/verkauf/page.tsx:31`, `lib/pdf/beleihungPdf.ts:159`.
- Eingaben: Darlehen 200.000 €, Restschuld im Dialog geleert.
- Erwartet: Eine Regel, nach der Begründung in `createKredit`: unbekannt → Darlehenssumme.
- Tatsächlich: Gespeichert wird null. `/kredite` und das Dashboard zeigen „Abbezahlt 200.000 € · 100 %“ und einen Auslauf von 0 %. Die Objektseite zeigt „nicht erfasst“. Ordner, Kennblatt-PDF und Verkauf rechnen mit 200.000 €.
- Beleg: `tests/R5/updateKredit.test.ts`, `r5/lauf3.txt`, `r5/lauf1.txt`.
- Fix: Denselben Rückfall in `updateKredit`; eine Funktion `restschuldVon(k)` für alle Leser. Test: Action-Test leere Restschuld → Betrag.

**B19 · Bearbeiten-Dialog auf /kredite: Monatsrate ist kein Pflichtfeld (R5-05)**
- Ort: `components/KrediteListe.tsx:159`, `lib/actions/buchungen.ts:263`; `tests/paketA.test.ts:89-95` prüft nur new/ und edit.
- Eingaben: Rate im Dialog geleert, gespeichert.
- Erwartet: Abgelehnt (Verknüpfungs-Audit A4, als erledigt geführt).
- Tatsächlich: `monatsrate null`, das Darlehen geht mit 0 € in den Cashflow, der dadurch zu hoch ist.
- Beleg: `tests/R5/updateKredit.test.ts`.
- Fix: `required min=0.01` im Dialog und eine Prüfung auf dem Server. Test: alle drei Formulare, Action ohne Rate → Fehler.

**B20 · Termin „Sonderkündigungsrecht (10 J. nach Auszahlung)“ auch bei Zinsbindung bis zehn Jahre (R5-06)**
- Ort: `lib/fristen.ts:186-195`; `/termine?jahr=2031&quelle=kredit`, Dashboard.
- Eingaben: Demo Leipzig Süd (Auszahlung 01.04.2021, Bindung bis 31.03.2031), Berlin (01.01.2021 / 31.12.2030), Plagwitz (01.10.2023 / 30.09.2033).
- Erwartet: Nach § 489 Abs. 1 BGB (gesetze-im-internet.de und dejure.org, 07.10.2026) gilt Nr. 1, wenn die Bindung vor Auszahlung + 10 Jahre endet: Kündigung mit einem Monat Frist zum Bindungsende. Nach einer Anschlussvereinbarung beginnen die zehn Jahre neu. Ein Termin am Tag nach Bindungsende ist in beiden Fällen falsch.
- Tatsächlich: Bei drei von vier Demo-Darlehen steht „Zinsbindung endet 31.3.2031“ und „Sonderkündigungsrecht 1.4.2031“.
- Beleg: `r5/termine2031.html`, `r5/bgb489.html`, `r5/dejure489.html`.
- Fix: Den Termin nur zeigen, wenn die Bindung länger als Auszahlung + 120 Monate läuft, sonst den Hinweis auf Nr. 1. Test: Bindung unter 10 Jahren → kein Eintrag.

**B21 · Selbstauskunft und Kreditantrag-PDF sind nicht mit dem Kreditbestand verbunden (R5-07)**
- Ort: `lib/kauf/selbstauskunft.ts:61-73`, `lib/pdf/kreditantragPdf.ts:214, 233`, `components/KaufAssistent.tsx:151-152`.
- Eingaben: Demo-Selbstauskunft mit Raten 180 €, Verbindlichkeiten 6.400 €, Mieteinnahmen 0; dasselbe Konto hat 4.490 € Raten, 937.000 € Restschuld und 5.930 € Kaltmiete.
- Erwartet: Vorbelegung aus dem Bestand oder ein Hinweis auf die Abweichung. Ein Bankdokument mit 6.400 € widerspricht 937.000 € im selben Konto.
- Tatsächlich: Es gibt keine Verbindung, nur Handeingaben.
- Beleg: Quelltext; `r5/kredite.html`, `r5/dash.html`.
- Fix: `selbstauskunftVorschlag(kredite, mieter)` mit Markierung der Abweichungen. Test: reine Funktion mit Mutation.

**B22 · /kredite verspricht Tilgungsplan und fortgeschriebene Restschuld, beides gibt es nicht (R5-08)**
- Ort: `app/(app)/kredite/page.tsx:65, 110`.
- Erwartet: Nur Vorhandenes beschreiben (`lib/schuldenStand.ts:4`: wird nicht fortgeschrieben).
- Tatsächlich: „Darlehen, Zinsbindung, Tilgungsplan“, im Leerzustand „MyImmo rechnet daraus Restschuld … und Tilgungsverlauf“. Beispiel Demo Leipzig Süd: eingetragen sind 178.000 €, nach der Formel wären es heute 162.255 €, ein Hinweis fehlt.
- Beleg: `r5/kredite.txt`, `r5/lauf1.txt`. Fix: „Restschuld laut letztem Kontoauszug eintragen“. Test: Text-Wächter.

**B23 · Kredit-Details: „Beleihungsauslauf 82 %“ neben 61,6 % in der Tabelle derselben Seite (U3-05)**
- Ort: `components/KrediteListe.tsx:50`. Adresse `/kredite` → Darlehen.
- Eingaben: Leipzig Süd mit beleihung 82, Restschuld 178.000 €, Wert 289.000 €.
- Erwartet: Unterscheidbare Bezeichnungen, „laut Bank“ wie im Formular (Verknüpfungs-Audit, Paket D).
- Tatsächlich: Zweimal dasselbe Wort mit zwei Werten (178.000 / 289.000 = 61,6 %).
- Beleg: `U3/klick1-1440.log`, `U3/klick/1440-hell-kredit-dialog.png`. Fix: „Beleihungsauslauf laut Bank“. Test: Text-Test.

### Portfolio-Kennzahlen und Berichte
**B24 · „Rendite“ desselben Objekts mit drei Bezugsgrößen (R1-02)**
- Ort: `app/(app)/page.tsx:349` (Σ Wert), `app/(app)/properties/page.tsx:128` (Wert), `app/(app)/properties/[id]/page.tsx` (Kaufpreis).
- Eingaben: Leipzig Süd: 880 € kalt, KP 245.000 €, Wert 289.000 €. Portfolio: Σ Kalt 5.930 €, Σ Wert 1.838.000 €, Σ KP 1.643.000 €.
- Erwartet: Eine Definition. Nach der B20-Entscheidung (AUDIT-2026-10-01) ist das der Kaufpreis: 880 × 12 / 245.000 = 4,31 %, Dashboard 71.160 / 1.643.000 = 4,33 %. Sonst an jeder Zahl die Basis nennen.
- Tatsächlich: Liste 3,65 %, Objektseite 4,31 %, Dashboard 3,9 %.
- Beleg: `r1/props.html.txt`, `r1/obj-dbb0fe08-….html.txt`, `r1/dash.html.txt`.
- Fix: `bruttoRendite()` für alle drei Stellen, Basis beschriftet. Test: gleiches Objekt → gleicher Wert.

**B25 · Dashboard verdünnt den Kostenschnitt eines Zukaufs auf 12 Monate (R1-03)**
- Ort: `app/(app)/page.tsx:339` (ein Fenster für alle), dagegen `app/(app)/properties/[id]/page.tsx:108` (je Objekt); `lib/cashflowKennzahl.ts`.
- Eingaben: Objekt A mit 100 €/Monat von Nov. 2025 bis Okt. 2026, Zukauf B ab Aug. 2026 mit 300 €/Monat.
- Erwartet: 400 €/Monat, wie die Summe der Objektseiten. Der Code-Kommentar und CLAUDE.md sagen „Summe der Objekte = Dashboard“.
- Tatsächlich: (1.200 + 900)/12 = 175 €/Monat. Der Cashflow ist dadurch bis zu 11 Monate lang um 225 €/Monat zu gut. In der Demo ist der Fall nicht eingetreten.
- Beleg: `tests/R1/portfolio.test.ts`.
- Fix: Den Dashboard-Schnitt als Summe der Objekt-Schnitte bilden (Kosten ohne Objekt global). Test: Σ = Dashboard.

**B26 · Portfolio-Wert und Dashboard-Rendite lassen Objekte ohne Wert weg, Kurve und Liste nicht (R1-05)**
- Ort: `app/(app)/page.tsx:300, 349`; `lib/wert/verlauf.ts`.
- Eingaben: A mit Wert 300.000 € und 1.000 € kalt; B ohne Wert, KP 200.000 €, 800 € kalt.
- Erwartet: Kachel = Ende der Kurve = Summe der Liste; Rendite 21.600/500.000 = 4,32 %.
- Tatsächlich: 21.600/300.000 = 7,2 %. Die Kachel weicht vom Ende der Kurve ab.
- Beleg: `tests/R1/portfolio.test.ts`, `grenz.test.ts`. Fix: `wert ?? kaufpreis`. Test: Kachel = letzter Kurvenpunkt.

**B27 · Demo-Daten: wiederkehrende Kosten 2026 fehlen, Zinsen werden aus dem Vorjahresmonat kopiert (R1-04, U2-07)**
- Ort: `supabase/migrations/20260930154606_demo_daten_bis_heute.sql`, `demo_zuruecksetzen()`. Anzeige `/`, `/cashflow`, Objektseite.
- Eingaben: Demo-Kosten Jan.–Okt. 2025 gegen 2026 (CSV-Export).
- Erwartet: Für 2026 Versicherung 1.214 €, Grundsteuer weiterer Objekte 845 €, Müll 420 €, Straßenreinigung 96 €, Garten 180 €, Hausgeld Zentrum +840 €. Damit Ø-Kosten (11.060 + 3.595)/12 ≈ 1.221 € statt 922 € und Cashflow ≈ 6.960 − 4.490 − 1.221 = +1.249 € statt +1.548 €. Die Zinsen fallen mit der Restschuld.
- Tatsächlich: 2026 keine Versicherung, Grundsteuer nur bei einem Objekt. Kosten der ETW Zentrum liegen vor dem Kaufdatum. Die Zinsen springen 06→07/2026 von 311,50 € auf 322,64 € (Leipzig Süd) bzw. von 864,17 € auf 883,36 € (Dresden).
- Beleg: `r1/buchungen.csv`, Auswertung in `R1.md`; DB-Abfragen in `U2.md`.
- Fix: Jahreskosten in den Schnappschuss für Jan.–Jun. 2026, keine Kosten vor dem Kaufdatum, Zinsen als Restschuld × Zins fortschreiben.
- Test: SQL nach dem Reset prüft die Jahressumme je Kategorie und dass die Zinsen monoton fallen.

**B28 · Jahresbericht-PDF des laufenden Jahres ohne Hinweis „unterjährig“ (U3-01)**
- Ort: `lib/pdf/berichtPdf.ts:304`, `app/api/berichte/jahresbericht/route.ts:49`; die Seite (`jahresbericht/page.tsx:92-96`) hat den Hinweis.
- Eingaben: Demo, 2026, Abruf am 07.10.
- Erwartet: Zeitraum „Jan.–Okt. 2026 · unterjährig“ wie auf der Seite.
- Tatsächlich: Titel nur „Jahresbericht 2026“, Einnahmen 68.530 € für 10 Monate.
- Beleg: `U3/exp/jb-2026.txt`, `jb-2026-p1.png`. Fix: Zeitraum im Untertitel. Test: laufendes Jahr → Zeitraum im Text.

### BuyImmo und Sanierung
**B29 · Strategie: Das laufende Jahr wird mit 12 vollen Monaten Sparrate, Überschuss und Tilgung gerechnet (U4-01)**
- Ort: `lib/strategie.ts:316, 386`; Startjahr `app/(app)/strategie/page.tsx:41`.
- Eingaben: 07.10.2026, Erspartes 79.000 €, Sparrate 1.250,50 €, „Beispiel laden“ (Kauf 2026 180.000 € mit 20 % EK, Miete 650 €; Kauf 2029 200.000 € per Beleihung).
- Erwartet: Ende 2026 = 79.000 − 55.026 (NK 19.026 + EK 36.000) + 3 × (1.250,50 − 176) ≈ 27.198 €.
- Tatsächlich: 36.868 € (12 Monate), also rund 9.670 € zu viel. Der Fehler trägt sich bis „Rechnerisch gedeckt · 32.004 € aus Erspartem“ für 2029 fort.
- Beleg: `tests/U4/strategie.test.ts`, `U4/strat-hell-390/06-s4.png`.
- Fix: Im Startjahr nur die restlichen Monate ab `heuteBerlin()` ansetzen. Test: Stichtag Oktober → Erspartes + 3 × Sparrate.

**B30 · Vergleich: Höchster absoluter Marktwert gilt als Bestwert; vorläufige Werte ohne Kennzeichnung; die Krone zählt 0-Werte (U4-02, R6-04)**
- Ort: `components/kauf/ObjektVergleich.tsx:20-29, 38, 118-147`; `lib/kauf/auswahl.ts:59-75`. Adresse `/vergleich`.
- Eingaben: Demo-Kandidaten Lindenau (KP 289.000 €, Marktwert 235.703 €), Schönefeld (159.000/125.079), Gohlis (189.000/97.439), Halle (142.000/87.621), alle ohne Bodenrichtwert. Unit-Test mit Faktor 0.
- Erwartet: Absolute Werte verschieden großer Objekte sind nicht vergleichbar. Vergleichbar wäre das Verhältnis KP zu Schätzung (Lindenau +22,6 %). Der Rechner selbst nennt diese Schätzungen „vorläufig“. Die Krone zählt wie `bestWert` nur v > 0.
- Tatsächlich: 235.703 € grün mit „1 Bestwert“. Keine Kennzeichnung „vorläufig“. `objektPunkte` ergibt {A: 5, B: 1}, obwohl die Zelle „–“ zeigt.
- Beleg: `U4/hell-768/_vergleich-s2.png`, `R6src/vergleich.html`, `tests/R6/r6.test.ts`.
- Fix: Zeile „KP ggü. Schätzung (%)“ mit better: low, „vorläufig“ kennzeichnen und aus der Krone nehmen, Filter v > 0. Test: A (500k/400k) gegen B (100k/150k) → B ist besser.

**B31 · Machbarkeits-Ampel „Eigenkapital deckt die Lücke“ ist ohne Darlehenswunsch immer grün (R6-01)**
- Ort: `lib/kauf/machbarkeit.ts:110-123`, `components/KaufAssistent.tsx:117-119`. Adresse `/kauf`.
- Eingaben: Gesamtinvestition 270.897 € (KP 245.000 € + NK 25.897 €), EK 5.000 €, kein Wunsch.
- Erwartet: Nach der eigenen Regel ist EK < NK rot (5.000 < 25.897).
- Tatsächlich: Darlehen = 265.897 €, benötigt = 5.000 € = EK → grün, angezeigt als „5.000 € vorhanden · 5.000 € nötig“. Die Prüfung ist zirkulär.
- Beleg: `tests/R6/machbarkeit.test.ts`, `out2.txt`. Fix: Ohne Wunsch gegen die NK prüfen. Test: EK < NK → rot.

**B32 · Bundesland-Auswahl springt auf ein anderes Land mit gleichem Satz (R6-02)**
- Ort: `components/kauf/ObjektRechner.tsx:345` (`/vergleich`), `components/strategie/StrategiePlaner.tsx:197-200` (`/strategie`).
- Eingaben: Live Hessen, Niedersachsen, Bremen, Brandenburg gewählt, dann neu geladen.
- Erwartet: Das gewählte Land bleibt stehen.
- Tatsächlich: Hessen → „Berlin (6,0 %)“, Niedersachsen → „Baden-Württemberg (5,0 %)“. Gespeicherte Prüfungen (Halle = Sachsen-Anhalt) erscheinen unter einem anderen Land. Der Betrag stimmt.
- Beleg: `R6shots/land2.mjs` + `land2.out`, `R6shots/strategie_land_nach_reload.png`.
- Fix: Index oder Kürzel als Wert, wie in `components/NebenkostenRechner.tsx` (dort schon behoben). Test: Niedersachsen → Niedersachsen.

**B33 · Ertragswert mit den Bewirtschaftungskosten nach ImmoWertV Anlage 3 von 2021 (R6-03)**
- Ort: `lib/bewertung/immowertv.ts:11-17`. Wirkt in `/vergleich`, `/kauf`, `/bewertung`.
- Eingaben: Demo Halle: 66 m², 560 €/Monat, ETW, Restnutzungsdauer 24, Liegenschaftszins 3,5 %.
- Erwartet: Nach ImmoWertV Anl. 3 (gesetze-im-internet.de, `R6src/anl3.html`) gelten die Werte „für das Jahr 2021“ und werden jährlich nach VPI angepasst. Der Obere Gutachterausschuss Brandenburg nennt für 2026 367 €/Wohnung und 14,4 €/m² (`R6src/bewko2026.pdf`). Daraus: 6.720 − (439 + 14,4 × 66 + 134,4) = 5.196,2; × 16,058 = **83.442 €**. Die 439 € für ETW sind abgeleitet (429 € × 367/359).
- Tatsächlich: 87.621 €, rund 4,8 % zu hoch.
- Beleg: `tests/R6/r6.test.ts`.
- Fix: Wertetabelle je Jahr mit Quelle und Prüfzyklus. Test: Stichtag 2026 → fortgeschriebene Werte.

**B34 · Wertende Formulierungen an der § 34i-Grenze (R6-05)**
- Ort: `components/kauf/ObjektRechner.tsx:42-48` („Auf Lage & Wertsteigerung setzen“, „Starke/Solide Rendite“), `lib/kauf/machbarkeit.ts:121` („besser zusätzlich 10–20 %“), `lib/kauf/darlehen.ts:66` („asymmetrisch günstig“), `components/kauf/FinanzierungsVorschlaege.tsx:224`.
- Erwartet: CLAUDE.md, BuyImmo-Regel (4): keine Kaufempfehlung vor der § 34i-Klärung.
- Tatsächlich: Wie unter Ort, live „Ordentlich — genau rechnen“.
- Beleg: `R6src/vergleich.html`.
- Fix: Neutral formulieren und die Wortliste (wie in `tests/strategie.test.ts`) auf `components/kauf` und `lib/kauf` ausweiten. Test: Wortlisten-Mutation.

**B35 · Gemischte Anführungszeichen „…" im BuyImmo-Text (U4-03)**
- Ort: `components/KaufAssistent.tsx:223, 296`, `components/kauf/ObjektRechner.tsx:221, 299, 561`, `components/VerkaufAssistent.tsx:112`, `components/VerkaufRechner.tsx:193`.
- Erwartet: „…“. Tatsächlich: „Beleihungsordner", Toast „… (Beispiel)" zum Bearbeiten geladen.
- Beleg: `U4/kauf/kauf-1440.txt`, `U4/verg-hell-390/log.txt`. Bekannt aus dem Design-Audit nur für `/verkauf`, betrifft aber sieben Stellen. Fix: ersetzen. Test: Text-Wächter.

**B36 · KfW 458: Eigentumswohnung erhält die Höchstgrenze des ganzen Gebäudes (R7-01)**
- Ort: `lib/sanierung/foerderung.ts:61-74, 121-124`, `components/sanierung/GuideSeiten.tsx:518-519`, `lib/sanierung/eingabe.ts`. Adresse `/sanierung?ansicht=ergebnis`.
- Eingaben: ETW in einem MFH, 1 betroffene WE, Wärmepumpe 36.000 €, Stichtag 07.10.2026.
- Erwartet: Richtlinie BEG EM Nr. 8.3.1 a (Volltext `R7src/begem.txt` Z.699-733): Wenn nicht alle WE betroffen sind, wird der Gebäude-Höchstbetrag auf alle WE verteilt. Beispiel auf kfw.de/458: 88.000/5 = 17.600 €. Bei 5 WE: (28.000 + 4 × 15.000)/5 = 17.600 € → 30 % = **5.280 €**. Die Heizungsoptimierung (Nr. 5.4 a) ist nur bei höchstens 5 WE im Gebäude zulässig.
- Tatsächlich: Grenze 28.000 €, Zuschuss 8.400 €, also 3.120 € zu viel. Die Gesamtzahl der WE wird nicht abgefragt. Der Betrag wird nur angezeigt, nicht von der Summe abgezogen.
- Beleg: `tests/R7/rechnung.test.ts`, `R7shots/zuschuss-etw-wp.png`, `R7shots/ergebnis.txt`.
- Fix: Feld „WE im Gebäude“; Grenze = staffel(gesamt) × betroffen/gesamt. Test: KfW-Beispiel → 17.600 €.

**B37 · Wohnfläche „1.050“ ist im Guide 1,05 m², in der Kaufprüfung 1.050 m² (R7-02)**
- Ort: `lib/sanierung/eingabe.ts` (`mengeAus`), `lib/sanierung/auswertung.ts`, `lib/sanierung/uebergabe.ts`, `lib/kauf/objektKennzahlen.ts:12, 38`. Adresse `/sanierung?objekt=<id>`.
- Eingaben: Kaufprüfung mit Fläche „1.050“, Haus → „Besichtigen“, Elektrik schlecht.
- Erwartet: 1.050 m² × 78–175 €/m² = 81.900–183.750 €.
- Tatsächlich: Menge 1,05 → 81,90–183,75 €, ohne Warnung.
- Beleg: `tests/R7/wohnflaeche.test.ts`, `R7-lauf2.txt`.
- Fix: Die Wohnfläche mit `zahlDe()` lesen und unter 10 m² warnen. Test: „1.050“ → 1050.

### Rechts- und Formprüfung der Dokumente
**B38 · Mietquittung bestätigt ohne Eingabe die Warmmiete als erhalten, ohne Monat (F3-01)**
- Ort: `lib/dokumentVorlagen.ts:79` (`ART_BETRAG_RUECKFALL`), `:195-199`, `components/DocGenerator.tsx:124-126`, `lib/pdf/erzeugen.ts:96-98`.
- Eingaben: Datum 01.10.2026, Betrag leer, Vertrag 900 € + 170 €.
- Erwartet: § 368 BGB, die Quittung bestätigt die empfangene Leistung. Nur ein eingegebener oder gebuchter Betrag samt Monat.
- Tatsächlich: „Mietzahlung in Höhe von 1.070,00 € geleistet (Zahlung erhalten am 1. Oktober 2026)“, ohne Warnung.
- Beleg: `f3/bilder/…mietquittung…-1280-s01.png`, `f3/pdf/brief-mietquittung.pdf`, `tests/F3/vorlagen.test.ts`.
- Fix: Betrag und `{{monat}}` als Pflicht, Vorbelegung nur aus einer Buchung. Test: leer → „betrag“ fehlt.

**B39 · „Reparatur-Ankündigung“ wird für Modernisierung beworben und erfüllt § 555c nicht (F3-02)**
- Ort: `app/(pub)/vorlagen/page.tsx:27`, `lib/dokumentVorlagen.ts:165-169`.
- Erwartet: § 555c Abs. 1/2 BGB: drei Monate vorher in Textform, mit Art, Beginn, Dauer, erwarteter Erhöhung und Betriebskosten sowie dem Härtehinweis. Fehlt die Ankündigung, verschiebt § 559b Abs. 2 S. 2 die Erhöhung um 6 Monate (`f3/q/bgb___555c.txt`, `555d`, `559b`).
- Tatsächlich: Die Vorlage nennt nur § 555a und ein Datum.
- Beleg: `f3/pdf/brief-reparatur.pdf`, `tests/F3/vorlagen.test.ts`.
- Fix: Werbetext auf Instandhaltung beschränken oder eine eigene § 555c-Art bauen. Test: Pflichtplatzhalter.

**B40 · Kündigung: Jedes Datum gilt als „fristgerecht“, § 573c wird nicht gerechnet (F3-03; gehört zu A8)**
- Ort: `lib/dokumentVorlagen.ts:157`, `components/DocGenerator.tsx:208-218`.
- Eingaben: Überlassung 01.01.2022, Zugang 07.10.2026, Kündigung zum 01.01.2027.
- Erwartet: Zugang nach dem 3. Werktag im Oktober → zum Ablauf des übernächsten Monats nach November, also **31.01.2027**. Die Verlängerung nach 5 Jahren greift noch nicht (4 Jahre 9 Monate).
- Tatsächlich: „fristgerecht zum 1. Januar 2027“.
- Beleg: `f3/pdf/brief-kuendigung.pdf`, `f3/q/bgb___573c.txt`.
- Fix: Den frühesten Termin rechnen und nur Monatsenden zulassen. Test: Fall → 2027-01-31.

**B41 · Wohnungsgeberbestätigung: Pflichtangaben nach § 19 Abs. 3 BMG fehlen (F3-04)**
- Ort: `lib/dokumentVorlagen.ts:177-189`, `lib/pdf/erzeugen.ts:100-112`.
- Erwartet: Name des Eigentümers, wenn er nicht Wohnungsgeber ist; Einzugsdatum; Namen aller meldepflichtigen Personen (`f3/q/bmg___19.txt`).
- Tatsächlich: Nur ein Name aus der Mieterzeile, kein Feld für den Eigentümer, als Einzugsdatum der Mietbeginn.
- Beleg: `f3/pdf/brief-wohnungsgeber.pdf`. Fix: Felder für Personen, Eigentümer und Einzugsdatum. Test: Vorlage enthält `{{personen}}`, `{{eigentuemer}}`.

**B42 · Ohne Vermieterprofil stehen Absender und Unterzeichner „MyImmo“ im Brief (F3-05)**
- Ort: `lib/pdf/erzeugen.ts:137`, `components/DocGenerator.tsx:150`.
- Eingaben: Kein Profil, vName leer, Kündigung mit Grund.
- Erwartet: § 126b BGB verlangt, dass der Erklärende genannt ist. Ohne Absender also kein Dokument.
- Tatsächlich: Briefkopf und Grußzeile „MyImmo“, ohne Anschrift. Der Download bleibt möglich.
- Beleg: `f3/pdf/kuendigung-ohne-profil.pdf`. Fix: Rückfall auf „MyImmo“ streichen, ohne Name kein PDF. Test: Fehler.

**B43 · „Im Mieterportal zugestellt ✓“ ohne Hinweis, dass der Zugang damit nicht belegt ist (F3-06)**
- Ort: `components/BriefVersand.tsx:139, 163-165`, `lib/zustellung.ts:115` (Benachrichtigungsergebnis wird verworfen), `lib/benachrichtigung.ts:84, 91`. Gleicher Weg für die NK-Abrechnung.
- Erwartet: § 130 BGB: Die Erklärung wird erst mit Zugang wirksam, die Beweislast trägt der Absender. NK-Frist § 556 Abs. 3, § 558b ab Zugang. Rechtsprechung zum Mail-Zugang gibt es nur für Unternehmer (BGH VII ZR 895/21).
- Tatsächlich: Erfolgsmeldung ohne Zugangshinweis. Die Hinweis-Mail geht ohne Brevo nicht hinaus (CLAUDE.md Punkt 0), und ihr Ergebnis wird nicht angezeigt.
- Beleg: Quelltext; grep in `F3.md`.
- Fix: Hinweis „zugegangen erst mit Abruf; bei Fristsachen zusätzlich per Post/Bote“, Benachrichtigungsergebnis anzeigen, Aufgabe nach X Tagen ohne Abruf. Test: Hinweis im Text.

**B44 · Schreiben lassen sich nur an eine Person richten; bei mehreren Mietern ist die Mieterhöhung formell unwirksam (F2-02)**
- Ort: `components/TenantForm.tsx` (nur vorname/nachname), `components/DocGenerator.tsx:372, 377`, `lib/pdf/docPdf.ts:184`, `components/BriefVersand.tsx:130`, `lib/actions/dokumente.ts:87`.
- Eingaben: Vertrag von Anna und Ben Weber, erfasst als „Anna Weber“; Mieterhöhung.
- Erwartet: Berliner Mieterverein (`F2src/bmv_mh.html.txt`): Die Erhöhung muss an alle Vertragspartner gehen, sonst ist sie unwirksam. Der eigene Ratgeber `lib/ratgeber.ts:1076` sagt dasselbe.
- Tatsächlich: Kein Feld für weitere Vertragspartner, Anrede nur an eine Person, keine Warnung.
- Beleg: `tests/F2/f2.test.ts`, `F2src/lauf2.txt`.
- Fix: Feld „weitere Mieter laut Vertrag“, daraus Empfänger und Anrede, Pflichthinweis bei Erhöhung und Kündigung. Test: zwei Namen. Anwaltsfrage siehe Abschnitt 10, Nr. 4.

**B45 · Bewerbungslink fordert Unterlagen an, die nach DSK nicht verlangt werden dürfen; Einwilligung als Rechtsgrundlage; gelöscht werden nur abgelehnte Bewerbungen (F2-01)**
- Ort: `lib/bewerbungsDokumente.ts:19-28`, `components/BewerbungForm.tsx:233-235, 261-266`, `lib/actions/bewerber.ts:99-116`. Adressen `/bewerben/<token>`, `/anliegen?tab=bewerbungen`.
- Erwartet: DSK-Orientierungshilfe Selbstauskünfte V2.0, Januar 2026 (`F2src/dsk.txt`): Eine Mietschuldenfreiheitsbescheinigung darf nicht verlangt werden (Z. 255-259, BGH VIII ZR 238/08). Keine Datenkopie nach Art. 15 (Z. 275-281). Einkommensnachweise erst kurz vor Vertragsschluss (Z. 261-267). Einwilligung ist nicht das richtige Mittel (Z. 46-47). Daten von Nicht-Mietern sind zu löschen (Z. 302-305).
- Tatsächlich: Slot „Mietschuldenfreiheitsbescheinigung“, die auch im Standardtext steht. SCHUFA ohne Unterscheidung. Drei Gehaltsabrechnungen schon mit der Bewerbung. Rechtsgrundlage lit. a. Bewerbungen mit Status neu oder favorit erhalten nie eine Lösch-Erinnerung.
- Beleg: `tests/F2/f2.test.ts`, `F2src/lauf2.txt`.
- Fix: Slot streichen, SCHUFA präzise benennen, Einkommen erst im zweiten Schritt, lit. b/f statt lit. a, Lösch-Erinnerung für alle Nicht-Mieter. Test: Negativliste.

### Ratgeber und Werbeaussagen
**B46 · Belegeinsicht-Ratgeber übergeht § 556 Abs. 4 BGB (F1-03)**
- Ort: `lib/ratgeber.ts:368-377, 400` (auch 145, 1287). Adresse `/ratgeber/belegeinsicht-was-mieter-verlangen-duerfen`.
- Erwartet: § 556 Abs. 4 BGB (seit 01.01.2025): Der Vermieter darf die Belege elektronisch bereitstellen (`f1/q/bgb___556.html`; beck-aktuell 15.01.2025; Haus & Grund Frankfurt).
- Tatsächlich: Der Ratgeber stützt sich auf § 259, verlangt „Originalunterlagen dort, wo sie verwahrt werden“ und nennt die digitale Bereitstellung „freiwillig“.
- Beleg: `f1/live_ratgeber_belegeinsicht-….html`. Fix: Artikel neu fassen, Belegfreigabe im Portal als gesetzlichen Weg nennen.

**B47 · Heizkosten-Ratgeber: Zwischenablesekosten „trägt in der Regel der ausziehende Mieter“ (F1-04)**
- Ort: `lib/ratgeber.ts:324`.
- Erwartet: § 9b Abs. 1 HeizkostenV; BGH VIII ZR 19/07 vom 14.11.2007: Die Kosten trägt der Vermieter, wenn nichts anderes vereinbart ist (iww.de, Berliner MieterGemeinschaft).
- Beleg: `f1/live_ratgeber_heizkostenabrechnung-….html`. Fix: Satz korrigieren.

**B48 · Heizkosten-Ratgeber: Ausnahmen falsch zugeordnet, Wärmepumpe als befreit nahegelegt (F1-05)**
- Ort: `lib/ratgeber.ts:325`.
- Erwartet: Für das ZFH gilt § 2 HeizkostenV. § 11 Abs. 1 Nr. 3 erfasst nur Wärmerückgewinnung, Solar sowie KWK/Abwärme ohne Erfassung. Bei Wärmepumpen gilt die Erfassungspflicht bis 30.09.2025 (§ 12 Abs. 3) (`f1/q/heizkostenv___2/11/12.html`).
- Tatsächlich: „ausgenommen … Zweifamilienhäuser … erneuerbare Wärmeversorgung (§ 11)“.
- Fix: Wortlaut von § 2 und § 11 übernehmen.

**B49 · Werbeaussage „§ 82b-Verteilung mit Jahresrate“ beschreibt nichts Gebautes (F1-08)**
- Ort: `lib/funktionen.ts:106`, `lib/ratgeber.ts:1014`.
- Tatsächlich: § 82b gibt es nur als Einmal-Rechner (`lib/steuer/afa.ts`), die Anlage V kennt keine Verteilung (grep findet 0 Treffer).
- Beleg: `f1/live_funktionen_steuer-anlage-v.html`. Fix: Aussage streichen oder die Funktion bauen. Test: Werbe-Wächter.

**B50 · „Hausverwaltung … je Mandat sauber getrennt“ ohne Mandantentrennung (F1-09)**
- Ort: `components/landing/data.tsx:33, 73`, `app/(app)/anmelden/page.tsx:25`; `lib/rolle.ts:26` (Hausverwaltung = Vermieter), `lib/avvInhalt.ts:43` schließt Mehrmandanten-Verwaltung aus.
- Beleg: `f1/_funktionenx.html`. Fix: Satz streichen. Bekannt verwandt: AUDIT-2026-10-01 B15 (dort ohne die Werbeaussage).

**B51 · § 35a-Ratgeber: Schornsteinfeger als haushaltsnahe Dienstleistung (F1-10)**
- Ort: `lib/ratgeber.ts:1404`.
- Erwartet: BMF vom 09.11.2016 (IV C 8 – S 2296-b/07/10003:008), Anlage 1: Schornsteinfeger sind Handwerkerleistungen nach § 35a Abs. 3 (20 %, max. 1.200 €) (handwerksblatt.de, lohnsteuer-kompakt.de).
- Beleg: `f1/live_ratgeber_paragraf-35a-….html`. Fix: In die Kategorie Handwerkerleistung verschieben.

### Demo, Sitzungen, Portale
**B52 · Abmelden, „Demo beenden“ oder Auto-Abmeldung eines Demo-Besuchers beendet die Sitzungen aller Demo-Besucher (U5-05)**
- Ort: `components/DemoSperre.tsx:26`, `components/AutoLogout.tsx` (Standard 30 min, `app/(app)/layout.tsx:204`), `app/(app)/auth/signout/route.ts:6`. Jeweils `signOut()` ohne Scope, die Bibliothek nimmt dann `global` (`@supabase/auth-js/…/GoTrueClient.js:3316`).
- Eingaben: `auth_audit_logs` und `auth.sessions` des Demo-Vermieters vom 06.10. 10:17 bis 07.10. 09:30.
- Erwartet: Beendet wird nur die eigene Sitzung (`scope: "local"`).
- Tatsächlich: 19 Logins, danach ein einziger Logout um 09:01:33. Danach gab es keine Demo-Vermieter-Sitzung älter als 09:18:19. Demo-Mieter und Demo-Service behalten Sitzungen bis zum 01.10. zurück. Ein einziges Abmelden hat also mindestens 19 fremde Sitzungen beendet.
- Beleg: Abfragen in `U5.md` (U5-05).
- Fix: `scope: "local"` in allen drei Stellen. Global nur beim Passwort-Reset und bei „andere Sitzungen beenden“.
- Test: Struktur-Test — jedes `signOut()` ohne Scope außerhalb von PasswortNeu/SettingsView macht ihn rot.

**B53 · Der öffentliche Auftrags-Link der Demo schreibt in den gemeinsamen Demo-Bestand (U5-01)**
- Ort: DB-Funktion `auftrag_public_rueckmeldung` (SECURITY DEFINER, ohne Demo-Prüfung); `app/(app)/auftrag/[token]/page.tsx`. Token im HTML von `/service` (`components/AuftraegePortal.tsx:81`). Adresse `/auftrag/7a1c0e30-0000-4000-8000-000000000002`.
- Erwartet: Die Demo ist nur zum Lesen da. Laut `pg_get_functiondef` greift der Trigger `demo_schreibsperre` aber nur bei `ist_demo_nutzer()`, und ein anonymer Aufrufer fällt nicht darunter.
- Tatsächlich: Das Formular ist voll bedienbar. Absenden schreibt in `auftrag_rueckmeldungen` (bis 4.000 Zeichen, 10 je Stunde) und bei einer Zusage `auftraege.termin`. Das ist aus dem Funktionstext abgeleitet, nicht abgesendet.
- Beleg: `U5/gast/light-_auftrag_7a1c0e30_…-390-s0*.png`, `U5/service.html`.
- Fix: In der RPC früh abbrechen, wenn der Auftrag dem Demo-Konto gehört, wie bei den anderen `*_public_*`-Funktionen.
- Test: Zurückgerollte Transaktion, anon mit Demo-Token → Fehler.

**B54 · Schreibknöpfe außerhalb von Formularen entgehen der Demo-Sperre (U2-04, U4-04, U5-03)**
- Ort: `components/DemoNurLesen.tsx:64-71` (sperrt nur submit- und Formular-Knöpfe). Betroffen: `components/UebergabeProtokoll.tsx:85-99` (`/tenants/<id>/protokoll`), `components/kauf/ObjektRechner.tsx:249, 310` (`/vergleich`), `components/SchadenAssistent.tsx:138`, `components/DokumenteAnfrage.tsx:110-116` (`/portal?tab=anliegen|dokumente`), `lib/actions/anliegen.ts:62`.
- Eingaben: Demo-Vermieter bzw. Demo-Mieter, 390 px.
- Erwartet: Ausfüllen ja, Senden nein, mit einem verständlichen Demo-Hinweis (wie AuftraegePortal mit `vorschau`). Lesendes (Protokoll-PDF) ist bedienbar.
- Tatsächlich: Im Protokoll ist das PDF gesperrt, „Speichern“, „Raum“ und „Raum entfernen“ sind aber aktiv. „Im Ordner speichern“ antwortet mit 500 und dem Toast „Speichern fehlgeschlagen.“ „Schaden melden“ und „Anfrage senden“ sind aktiv und enden in „Anliegen konnte nicht gespeichert werden.“
- Beleg: `U2/klick6-390.log`, `U4/verg-hell-390/01-speichern.png` + `log.txt`, `U5/klick/m-light-390-schaden3.png`, `m-light-390-dokument.png`.
- Fix: In Demo-Konten diese Knöpfe deaktivieren und einen Hinweis zeigen. Das Protokoll in `data-demo-erlaubt` hüllen. Fehlercode 42501 bzw. `demo_nur_lesen` auf den Demo-Text abbilden.
- Test: Komponenten-Test Demo → disabled; Action-Test mit `db.fehlerBei` und 42501 → Demo-Text. Ein Wächter sucht `onClick`-Aufrufe von Server-Actions in Komponenten mit `demo`-Prop.

**B55 · Demo-Mieter: Die Portal-Hülle hat keinen Sperr-Dialog, Export und Löschen enden ohne Erklärung (U5-04)**
- Ort: `app/(app)/layout.tsx:141-147`, `components/KontoVerwaltung.tsx:163`. Adresse `/konto`.
- Erwartet: Wie beim Vermieter ein Dialog, der die Demo-Grenze erklärt.
- Tatsächlich: Es öffnet sich ein Re-Auth-Dialog mit gesperrtem Feld. `/api/export/alles` leitet weiter über `/?demo=gesperrt&bereich=…` nach `/portal`, dabei geht `bereich` verloren. Beim Löschen fehlt ebenfalls jeder Hinweis.
- Beleg: `U5/klick/m-light-390-konto-export.png`, `…-konto-loeschen.png`, `U5/hol.mjs`.
- Fix: DemoSperre in der Portal-Hülle, Weiterleitung mit `bereich`, Text „In der Demo nicht verfügbar“. Test: `demoWege` erweitern.

**B56 · Mieterportal und Vorschau: „Ansehen/Herunterladen“ eines Dokuments ohne Datei führt auf eine Klartext-404 (I1-01)**
- Ort: `components/PortalAnsicht.tsx:246-247` (kein Guard), `app/(app)/archiv/[id]/datei/route.ts:21`. Adressen `/portal?tab=dokumente`, `/anliegen?tab=vorschau&mieter=f3fd40b4-…&portal=dokumente`.
- Eingaben: Demo-Zustellung `3eb163a4-…` an die Notiz `87e919dc-…` mit `datei_name = null`.
- Erwartet: Ohne Datei keine Knöpfe, wie in `tenants/[id]/page.tsx:286` (der Fix zu B23).
- Tatsächlich: HTTP 404 als Text „Keine Datei hinterlegt“.
- Beleg: `i1/shots/_portal_tab_dokumente-390-s01.png`, `i1/shots/_archiv_87e919dc_…-390-s01.png`, `i1/crawl-mieter.json`.
- Fix: Guard einbauen, Demo mit Datei seeden, Route liefert eine HTML-Seite. Test: kein `href …/datei` ohne `datei_name`. Bekannt: AUDIT-2026-10-01 B23, dort nur teilweise behoben.

### Darstellung und Bedienung
**B57 · Einstellungen: Die klebende Reiterleiste rutscht unter die Kopfleiste am Handy (U3-02)**
- Ort: `app/globals.css:1420` (`.settings-tabs { position: sticky; top: 0 }`) gegen `.mobile-bar` (0–59 px). Adresse `/einstellungen?tab=…` unter 860 px.
- Eingaben: `scrollTo(0, 900)`, `elementFromPoint` je Reiter, 390 und 768 px.
- Erwartet: Leiste sichtbar und klickbar.
- Tatsächlich: Bei 390 px liegen Profil, Bankkonten und Vertreter unter der Kopfleiste und sind nicht klickbar. Bei 768 px gilt das für alle sechs.
- Beleg: `U3/klick/390-hell-einst-sticky.png`, `768-hell-einst-sticky.png`, `U3/klick6.mjs`.
- Fix: `top: var(--mobile-bar-h, 60px)` im Handy-Layout. Test: CSS-Test.

**B58 · /verbrauch: „Noch kein Verbrauch erfasst“, obwohl 5 Einträge existieren (U3-07)**
- Ort: `app/(app)/verbrauch/page.tsx:35-42`, `components/lists/VerbrauchListe.tsx:31`.
- Eingaben: 5 Demo-Zeilen, alle 2025-12-31; der Filter steht auf 2026.
- Erwartet: Leerzustand „filter“ (Regel B27) oder als Vorgabe das jüngste Jahr mit Daten.
- Tatsächlich: Leerzustand „nichts“ mit dem Knopf „Verbrauch erfassen“.
- Beleg: `U3/hell-390/_verbrauch-s02.png`. Fix: Prop `gefiltert`. Test: nach dem Muster von auditPaket56.

**B59 · Landing-Menü: Der Tastaturfokus verlässt das offene Vollbild-Menü (U1-01)**
- Ort: `components/landing/QlxHeader.tsx:58-63, 70-80, 107`.
- Eingaben: 390 px, Menü öffnen, 14 × Tab.
- Erwartet: Verhalten als modaler Dialog nach WAI-ARIA (Fokus bleibt im Menü, Hintergrund `inert`).
- Tatsächlich: Mit Tab 13/14 landet der Fokus auf „Demo ansehen“ und „Alle Funktionen“ hinter dem Overlay. Dort ist er unsichtbar, und Enter löst `/api/demo` aus.
- Beleg: `U1/klick-390.log`, `U1/klick-hell-390/menu-offen.png`.
- Fix: `inert`, Fokus im Menü halten, `role=dialog`, `aria-modal`. Test: Playwright 20 × Tab.

**B60 · Tippziele unter 24 bzw. 44 px (U2-09, U1-07; bekannt AUDIT-2026-10-01 B33/C36)**
- Ort: Objektseite (Listen-× 28 × 20, 42 Stück; Notiz-× 20 × 20), Dashboard 1J/3J/5J/Max (25 px hoch), Sprungmarken 28 px, Aufklapper 17 px, Datumsfelder im Beleihungsordner 118 × 28 (25 Stück), „Raum entfernen“ im Protokoll 28 × 20, Checkboxen 13–17 px, Theme-Schalter 36 × 24. Außerdem `/login` („Rolle wechseln“ 99 × 17, „Passwort vergessen?“ 127 × 19), Fußzeile von `/anmelden` 17 px, BackLink 59 × 22 auf den Rechtsseiten, `.lp-mehr` 20 px, Einwilligungs-Checkbox 13 × 13.
- Erwartet: WCAG 2.2 AA 2.5.8 mindestens 24 × 24 px; die Prüfvorgabe sind 44 px.
- Tatsächlich: 176 Elemente unter 44 px im Inhaltsbereich bei 390 px.
- Beleg: `U2/tipp-390.json`, `U1/v2/hell-390/befund.json`, `hell-360/befund.json`.
- Fix: Mindesthöhe 44 px für `.btn` und Felder am Handy, Lösch-× als Fläche von 40 px oder mehr. Test: Regel im Designscan.

---

## 4. C-Befunde

| ID | Titel | Ort | Erwartet → Tatsächlich (Rechnung/Quelle) | Beleg | Fix |
|---|---|---|---|---|---|
| C1 | Achsentitel überdeckt Y-Beschriftung (U2-03, R1-10) | `components/BetragChart.tsx:71, 103, 152`; `/` Buchungssaldo | keine Überdeckung → Titel bei x 39–54, Ticks bei x 47–85 (390 px); die „4“ von 40 Tsd. ist verdeckt | `U2/klick/390-achse.png`, `r1/c2-3J.png` | padL vergrößern |
| C2 | Indexwert „5,9 % darunter“ mit falscher Bezugsgröße (U2-05) | `components/IndexwertKarte.tsx:18-19, 40` | (492.449 − 465.000)/492.449 = 5,6 % → angezeigt 5,9 % (geteilt durch 465.000) | `U2/hell-390/_properties_d560-s08.png` | durch den Indexwert teilen oder Satz umdrehen |
| C3 | Kontoauszug: falscher Plural, Monatsspalte erst nach Wischen (U2-06) | `components/KontoauszugAbgleich.tsx:136` | „1 Eingang“ → „1 Eingänge“; Tabelle 640 px breit im 316-px-Kasten | `U2/klick/390-ka-tabelle.png` | Plural, Kartenzeile unter 640 px |
| C4 | Demo-Leiste nennt „Bereiche mit Schloss“, es gibt keine (U2-10) | `components/DemoLeiste.tsx` | 0 × `.nav-gesperrt` | `U2/klick/01-drawer-offen.png` | Text ändern |
| C5 | „21 weitere Termine“ zählt Monatsüberschriften mit (U3-03) | `app/(app)/termine/page.tsx:521-533`, `components/ExpandableList.tsx:18` | 16 verborgen → 21; sichtbar 9 statt 12 | `U3/klick4.mjs`, `U3/hell-390/_termine-s02.png` | Einträge getrennt zählen |
| C6 | Anlage-V-Überschuss in `--gold-fill` als Schrift (U3-04) | `components/AnlageVExport.tsx:219, 326` | ≥ 4,5:1 → 2,21:1 bzw. 2,03:1 | `U3/hell-390/_steuer-s03.png` | `var(--gold)` |
| C7 | Kredit-Details: Zins + Tilgung = 891 bei Rate 890 (U3-06) | `components/KrediteListe.tsx:45-46` | 178.000 × 2,1 %/12 = 311,50 → 312 + 578 → angezeigt 312 + 579 | `U3/klick1-1440.log` | Tilgung aus dem gerundeten Zins |
| C8 | Link „Fahrplan“ auf /abschluss nicht als Link erkennbar (U4-05) | `app/(app)/abschluss/page.tsx:87` | Linkfarbe = Textfarbe rgb(115,115,115) | `U4/hell-390/_abschluss-s2.png` | Link-Stil |
| C9 | Strategie: Feld 45,5 px statt 40 px hoch (U4-06) | `app/globals.css:697-698` | — | `U4/misc/strategie-felder.png` | `align-content: start` |
| C10 | Objekt-Rechner belegt mit Dezimalpunkt vor (U4-07) | `components/kauf/ObjektRechner.tsx:110-111, 133-139` | „3,57“ → „3.57“; wer weitertippt, landet bei `zahlDe0('3.570')` = 3570 % | `tests/U4/parser.test.ts` | Komma vorbelegen |
| C11 | „ausschliesslich“ (U5-02) | `app/(app)/auftrag/[token]/page.tsx:125` | ß | `U5/gast/…-390-s03.png` | korrigieren |
| C12 | Umbruch mitten im Wort „Nebenkostenabrechnu|ng“ (U5-06) | `components/AnliegenPortal.tsx:184` | Umbruch an der Wortgrenze | `U5/mieter/…vorgang_06dd0ccd…-390-s01.png` | `hyphens: auto` |
| C13 | Überschrift „Zählerstände“ doppelt (U5-07) | `components/PortalAnsicht.tsx:289`, `ZaehlerPortal.tsx:47` | — | `U5/mieter/light-_portal_tab_zaehler-360-s01.png` | Kartenkopf umbenennen |
| C14 | Theme-Knopf zeigt im hellen Modus bis zur Hydration den Mond (U5-08) | `components/ThemeToggle.tsx:9, 57` | — | `U5/mieter/light-_portal-390-s01.png` | per CSS am `data-theme` |
| C15 | Seiten rechnen mit UTC-Datum statt `heuteBerlin()` (R1-06) | `properties/[id]/page.tsx:108, 122, 219`, `properties/page.tsx:44`, `jahresbericht/page.tsx:31`, `cashflow/page.tsx` | 01.10. 00:30 Berlin, Mietende 30.09. → Soll 0 → Objektseite zeigt 500 €, Dashboard 0 € | `tests/R1/grenz.test.ts` | überall `heuteBerlin()` |
| C16 | Objekt-Check: Grundstück nie vollständig, künftiger Mieter zählt als laufend (R1-07) | `lib/objektCheck.ts:28, 37-42` | Grundstück 4/4 → x/6 | `tests/R1/grenz.test.ts` | Fläche/Baujahr nur bei Gebäuden, `laeuftAm()` |
| C17 | Gerundete Objekt-Cashflows ergeben in Summe nicht das Dashboard (R1-08) | `properties/[id]/page.tsx` vs. `page.tsx:340` | Σ 1.547 gegen 1.548 (exakt 1.548,33); Kosten 923 gegen 922 | `r1/demo-rechnung.txt` | einheitlich runden |
| C18 | 3-%-AfA endet nach 33 Jahren bei 99 % (R2-09) | `lib/anlageV.ts:261` | § 7 Abs. 4 „bis zur vollen Absetzung“ → 240.000 gegen 237.600 | `tests/R2/grenzfaelle.test.ts` | Ende über den Restbuchwert |
| C19 | Kauf am 29.02.: Fristende einen Tag zu spät (R2-10, R6-06) | `lib/steuer/spekulation.ts:20-26`, `lib/steuer/anschaffungsnah.ts:57` | § 188 Abs. 3 BGB → steuerfrei ab 01.03.2026 statt 02.03.2026; 15-%-Fenster bis 28.02.2027 statt 01.03.2027 | `tests/R2/grenzfaelle.test.ts`, `tests/R6/r6.test.ts`, `R6src/bgb188.html` | Klemmung auf das Monatsende |
| C20 | Degressive AfA ohne Prüfung, ob sie zulässig ist (R2-11) | `lib/anlageV.ts:230` | § 7 Abs. 5a S. 1 (Baubeginn 01.10.2023–30.09.2029) → ohne Hinweis | `tests/R2/grenzfaelle.test.ts` | Hinweis |
| C21 | § 7b-Check ohne die zehnjährige Vermietungsbindung (R2-12) | `lib/steuer/afa.ts:137-175` | § 7b Abs. 2 S. 1 Nr. 3 | `r2/quellen/estg7b.html` | Prüfpunkt |
| C22 | CO2-Stufe ohne Rundung auf eine Nachkommastelle (R3-06) | `lib/co2.ts:87-88` | § 5 Abs. 1 S. 3: 11,96 → 12,0 → 10 % = 10 € → 0 € | `tests/R3/co2.test.ts` | runden |
| C23 | Vorauszahlungsvorschlag mit angebrochenen Monaten, auch bei beendetem Vertrag (R3-07) | `lib/nkVorjahr.ts:55-61`, `tenants/[id]/nk/page.tsx:274` | 559,07/(260/365 × 12) = 65,40 → 66 € → 63 €; Hoffmann (ausgezogen) erhält 228 €/Monat | `R3/nk-47b1e7fe-….html` | Tagesanteil; nur bei laufendem Vertrag |
| C24 | MFH-Hinweis beim Reihenhaus mit Mieterwechsel (R3-08) | `lib/umlage.ts:51-58` | nacheinander ≠ gleichzeitig | `R3/nk-47b1e7fe-….html` | gleichzeitige Verträge zählen |
| C25 | Verbrauch ohne Hauptzähler: die angekündigte Warnung fehlt (R3-09) | `lib/nkObjekt.ts:185-195`, `docs/zukunft/NK-NEU.md` | Warnung → keine | `tests/R3/nk.test.ts` | Warnung oder Doku anpassen |
| C26 | Verbilligte Vermietung: wird vor dem 66-%-Vergleich gerundet (R4-11) | `lib/steuer/verbilligt.ts:55-59` | 659,95/1.000 = 65,995 % < 66 % → „grün“ | `tests/R4/verb.test.ts`, `r4/quellen/estg_21.html` | ungerundet vergleichen |
| C27 | „Indexmiete prüfen“ bleibt auf dem ersten Jahrestag stehen (R4-12) | `lib/fristen.ts:137-149` | nächster Jahrestag → „1.1.2023 · vor 1.375 Tg.“ | `r4/termine.html` | fortschreiben |
| C28 | Gespeicherte Marktwerte altern mit dem Kalenderjahr; `tests/demoKandidaten.test.ts` wird am 01.01.2027 rot (R6-07) | `lib/kauf/marktwert.ts:91` | Baujahr 1995: 127.006 € (2026) gegen 125.995 € (2027) | `tests/R6/r6.test.ts` | Bewertungsjahr speichern / `setSystemTime` |
| C29 | „Kaufpreisfaktor — Jahresmieten bis zur Amortisation“ (R6-08) | `components/kauf/ObjektRechner.tsx:179` | Faktor = KP/Jahreskaltmiete, keine Amortisation (≈ 1/0,026 = 38 J.) | `R6src/vergleich.html` | „Kaufpreis in Jahreskaltmieten“ |
| C30 | Strategie: Nach einem Verkauf bleibt die Sparrate gleich, keine Vorfälligkeitsentschädigung (R6-09) | `lib/strategie.ts:337-347, 375-377` | Hinweis fehlt | `tests/R6/r6.test.ts` | Hinweis |
| C31 | Fliesen: Kleber und Fuge doppelt (R7-03) | `lib/sanierung/arbeiten.ts` (fliesen_verlegen), `auswertung.ts` | Daibau „inklusive Kleber und Verfugung“ → +98–147 € Kleber, +10–20 € Fuge | `R7src/daibau.html` | nicht addieren |
| C32 | `massDe('4 125')` = 4125 m (R7-04) | `lib/sanierung/eingabe.ts` | laut Kommentar 0 | `tests/R7/rechnung.test.ts` | nur Rand-Leerzeichen entfernen |
| C33 | Richtlinie BEG EM zitiert als „17. August 2026, BAnz 27.08.“, vorliegende Fassung „17. Juli 2026“ (R7-05) | `lib/sanierung/foerderung.ts:9-10`, `lib/kauf/foerderung.ts:7`, `docs/kauf/KfW-Foerderung-2026.md:7, 103` | Unstimmigkeit, Zahlen gleich | `R7src/begem.txt` Z.1-9 | im Bundesanzeiger nachsehen |
| C34 | Wärmezähler „seit 2014 bei Neuinstallationen“ (F1-06) | `lib/ratgeber.ts:283` | § 9 Abs. 2 S. 1 HeizkostenV gilt für alle Anlagen | `f1/q/heizkostenv___9.html` | streichen |
| C35 | 15-%-Kürzung mit 167 € statt 180 € (F1-07) | `lib/ratgeber.ts:308` | § 12 Abs. 1: 1.200 × 15 % = 180 → 1.116 × 15 % = 167 | `f1/q/heizkostenv___12.html` | 180 € |
| C36 | BFH-Datum 10.12.2025 statt 12.11.2025; Berlin „2026 gesenkt“ (F1-11) | `lib/ratgeber.ts:1334, 1341` | II R 25/24 u. a. vom 12.11.2025; Berlin 810 → 470 % zum 01.01.2025 | `f1/live_ratgeber_grundsteuer-….html` | korrigieren |
| C37 | Anlage-V-Aufteilung „seit VZ 2023“ statt 2021 (F1-12) | `lib/ratgeber.ts:753` | Haufe HI16702100, steuertipps.de | — | 2021 |
| C38 | Legionellen nach „§ 14b TrinkwV“ statt § 31 (F1-13) | `lib/termine.ts:96` | TrinkwV 2023 § 31 Abs. 2 Nr. 2 a | `f1/q/trinkwv_2023___31.html` | § 31 |
| C39 | § 559e fehlt im Mieterhöhungs-Ratgeber (F1-14) | `lib/ratgeber.ts:1091-1093` | 10 %, 0,50 €/m² in 6 Jahren | `f1/q/bgb___559e.html` | ergänzen |
| C40 | Frist der Steuererklärung 2026 fällt auf Samstag 31.07.2027 (F1-15) | `lib/fristen.ts:200-209` | § 108 Abs. 3 AO → Montag 02.08.2027 | `f1/q/ao_1977___108.html` | verschieben |
| C41 | Ratgeber-Kästen nennen den entfernten „Umlage-Assistent“ und die AfA-Übernahme „mit Restlaufzeit“; Siegel „Rechtsstand Juli 2026“ deckt veraltete Stellen (F1-16) | `lib/ratgeber.ts:32, 168, 722, 1294, 1368` | — | git `edff2a2` | Texte; Rechtsstand erst nach Prüfung |
| C42 | Kaution über drei Kaltmieten ohne Hinweis (F2-04) | `components/TenantForm.tsx:158`, `lib/actions/tenants.ts:42`, Portal, Steckbrief | § 551 Abs. 1 BGB: 3 × 700 = 2.100 → 3.500 € ohne Warnung | `tests/F2/f2.test.ts` | Hinweis |
| C43 | Erinnerung und Mahnung aus dem Generator nennen keinen Monat (F3-07) | `lib/dokumentVorlagen.ts:141-155` | § 286 bestimmte Aufforderung | `f3/pdf/brief-mahnung.pdf` | `{{monat}}` Pflicht |
| C44 | NK-PDF druckt einen internen Hinweis ins Anschriftfeld (F3-08) | `lib/pdf/adressfeld.ts:53`, `nkPdf.ts:182`, `lib/nk.ts:612` | Rückfall auf die Objektadresse → „(Anschrift fehlt - bitte im Profil ergänzen)“ | `f3/pdf/nk-2025-neumann.pdf` | Rückfall wie im Brief |
| C45 | Käufer-Selbstauskunft gibt Staatsangehörigkeit, Familienstand und Kinder an den Makler (F3-09) | `lib/pdf/kaeuferPdf.ts:109-112, 136` | Art. 5 Abs. 1 lit. c DSGVO | Quelltext | nur auf Wahl drucken |
| C46 | /vorlagen verspricht NK-Saldo und „beweissicher“ (F3-10) | `app/(pub)/vorlagen/page.tsx:28, 32` | § 5 UWG; Anschreiben ohne Saldo, Protokoll ohne Zählernummern | `f3/pdf/brief-nk-anschreiben.pdf`, `protokoll.pdf` | Text anpassen |
| C47 | /termine fehlt in Seitenleiste und Befehlspalette (I1-02) | `lib/nav.ts:24-80`, `components/ui/CommandPalette.tsx` | „kalender“ ergibt keinen Treffer | `i1/crawl-vermieter.json` | Ziel + Alias |
| C48 | Mieter- und Service-Konten ohne Hilfeweg (I1-03) | `app/(app)/layout.tsx:133-135`, `next.config.mjs:97` | `/hilfe` → `/portal` bzw. `/service`, kein mailto | `i1/bodies/mieter__konto.html` | `HILFE_MAILTO` in die Shell |
| C49 | Verwaiste Seite `/verbrauch/[id]/edit` (I1-04) | `app/(app)/verbrauch/[id]/edit/page.tsx` | 0 Verweise | `i1/links.json` | entfernen oder umleiten |
| C50 | Totes Ziel `/notizen` (I1-05) | `lib/actions/buchungen.ts:306, 315, 327` | Seite existiert nicht; Funktionen nur im Test benutzt | `i1/links.json` | entfernen oder auf `/archiv` |
| C51 | `/properties/[id]/nebenkosten` per Adresse auch bei ETW (I1-06) | `nebenkosten/page.tsx:33`, `lib/nkPositionen.ts:112-140` | nur MFH → V:200 bei ETW Leipzig Süd; die Folge auf Mieter-NK ist nur im Code abgeleitet | `i1/bodies/vermieter__properties_dbb0fe08_…nebenkosten.html` | `nkAmObjekt()` an beiden Stellen |
| C52 | `notFound()`/`redirect()` liefern HTTP 200 (Streaming) (I1-07) | `app/(app)/loading.tsx` | 404/307 → 200 mit Marker | `i1/probe.mjs` | Rauchtest wertet den Marker aus |
| C53 | Alt-Adressen `/bewerbungen`, `/einnahmen`, `/kosten` in der Demo gesperrt (I1-08) | `lib/demo.ts:69-110` | Ziel ist frei → Sperr-Dialog | `i1/crawl-vermieter.json` | exakt freigeben |
| C54 | „Passwort vergessen?“ zeigt eine englische Supabase-Meldung (U1-02) | `app/(app)/login/page.tsx:27-41, 334-349` | deutsch → „Unable to validate email address: invalid format“ | `U1/klick-hell-390/reset-abc.png` | vorher prüfen, `uebersetze()` |
| C55 | Meldung „Passwörter stimmen nicht überein“ bleibt nach Korrektur stehen (U1-03) | `login/page.tsx:438, 457` | — | `U1/registrieren-veraltete-meldung.png` | `setError(null)` |
| C56 | Öffentliche Strecke ohne eigene Fehlerseite (englische Next-Seite) (U1-04) | `app/(pub)/` ohne `error.tsx`, kein `global-error.tsx` | ChunkLoadError auf `/preise` → „This page couldn’t load“ | `U1/v2/dunkel-768/_preise-s01.png` | beide Dateien anlegen |
| C57 | Schrift unter 11 px (8 px bzw. 9,92 px) (U1-05) | `app/globals.css:2486-2490`, `components/BrandMark.tsx:22` | Regel aus dem Design-Audit | `U1/kopf-1440-unterzeile-8px.png` | ≥ 11 px oder Ausnahme festschreiben |
| C58 | Landing „Ein Link statt Aktenordner“ 3,74:1 (U1-06) | `app/globals.css:1687, 1767, 1769` | (0,857 + 0,05)/(0,193 + 0,05) = 3,74 < 4,5 | `U1/kontrast__lp_ordner_fuss.png` | helles Muted-Token |
| C59 | Kontrast der Brief-/NK-Vorschau 2,92:1, Badges 4,21–4,39:1 (U2-08) | Vorschau auf `/tenants/<id>/nk` und `/dokument`, Badges `/cashflow` | ≥ 4,5:1 | `U2/kontrast-hell.json` | dunkler |
| C60 | Login- und Registrierfelder ohne `autocomplete` (U1-08) | `login/page.tsx:423-441, 452-464, 484-503` | email/current-password/new-password | `U1/klick-390.log` | Attribute setzen |
| C61 | Aufklapper „Beim Start benachrichtigen“ lässt sich nicht schließen (U1-09) | `components/landing/StartBenachrichtigung.tsx:76-86` | Escape schließt → bleibt offen; `aria-expanded` steht fest auf false | `U1/klick-390.log` | Umschalter |

Für jeden C-Befund ist der Test eine Einheit oder ein Struktur-Wächter auf genau die genannte Regel. Mutationsprüfung wie in CLAUDE.md.

### 4a. Bekannte Punkte, weiter offen (nicht neu gezählt)

| Bekannt aus | Inhalt | Stand 07.10.2026 |
|---|---|---|
| AUDIT-2026-10-01 B18 | NK-Abrechnung (Altbestand) ohne Gesamtkosten (BGH VIII ZR 93/15) | live unverändert, alle 7 Demo-PDFs „Gesamtkosten —“ |
| AUDIT-2026-10-01 B26 | Demo sperrt Lese-Werkzeuge | weiter offen und größer als gemeldet: Steuerjahr (auch R2-08), AfA, Marktwert (Sackgasse), Verkauf, Suche, Palette, NK-Jahreswahl |
| AUDIT-2026-10-01 B34 | Mobiler Drawer: kein Escape, kein Schließen-Knopf, Fokus bleibt draußen | offen (U2-K1) |
| AUDIT-2026-10-01 C22 | Demo rendert Anlege-Formulare (`/cashflow/neu`, `/kredite/new`, `/verbrauch/new`, `/termine/<id>/edit`, Importe) | offen |
| AUDIT-2026-10-01 C25 | Demo-Darlehen in sich widersprüchlich | offen und breiter: Rate nach Formel 683/910/1.620/1.272 gegen eingetragen 890/940/1.480/1.180; Restschuld und Laufzeit passen ebenfalls nicht (R5-09) |
| AUDIT-2026-10-06-design:55 | Anlage V 2024 der Demo: Verlust −55.852 € ohne Hinweis „keine Buchungen“ | offen (R2-06); Ursache `components/AnlageVExport.tsx:263-265` |
| AUDIT-2026-10-01 C11, C13, C15, C35, C31, B17, B29, C23 | Soft-404, Canonical/og, Login ohne h1, `--muted` 4,35:1, AfA ohne Kaufnebenkosten, Hausgeld inkl. Rücklage, Reiterleiste `/anliegen`, Hoffmann-NK | jeweils unverändert offen |
| Verknüpfungs-Audit, Paket E | `lib/fahrplan.ts:145` „Übergabe“ führt auf ein leeres `/properties/new` statt auf `/abschluss` | offen |
| Verknüpfungs-Audit:153 | DATEV-Konten | unverändert |

Erledigt und bestätigt: AUDIT-2026-10-01 A2 (Kaution im Jahresbericht), A12 (og.png 200), B21 (`?tab=`), B31 (Hilfe vor dem Login), C20 (Excel 390 px), A9 (Mindest-Restnutzungsdauer).

---

## 5. Verworfen bei der Gegenprüfung

**Verworfen wurde kein A-Befund.** Alle 12 sind bestätigt. Vier wurden herabgestuft:

| ID | neu | Begründung (ein Satz) |
|---|---|---|
| R2-01 → B1 | B | Die Zeilennummern sind falsch, aber Bezeichnung und Betrag jeder Zeile stimmen, und die App rät ausdrücklich zur Gegenprüfung; eine falsche Zahl entsteht nur, wenn jemand allein nach Nummer überträgt. |
| R2-05 → B2 | B | Die Eingaben widersprechen sich (Kaufdatum ist das Anschaffungsdatum); der Mangel ist die fehlende Plausibilitätsprüfung, kein Rechenfehler bei stimmigen Eingaben. |
| R4-02 → B7 | B | Die Miete hat eine nach dem Kalender bestimmte Leistungszeit, der Verzug tritt nach § 286 Abs. 2 Nr. 1 ohne Mahnung ein; die verfrühte Erinnerung hat keine eigene Rechtsfolge, nur das Datum im Schreiben ist falsch. |
| R5-01 → B3 | B | Die Zinsschätzung ist im PDF und in der App als „geschätzt“ markiert und wird ausdrücklich als nicht maßgeblich bezeichnet; eine Steuerfolge tritt erst ein, wenn der Nutzer den gekennzeichneten Wert trotzdem übernimmt. |

---

## 6. Inventar (aus I1, Stand 07.10.2026)

112 Einträge: 77 Seiten und 35 Routen (`find app -name page.tsx -o -name route.ts`). Die Spalte Demo kommt aus
`demoDarfRoute`/`istOeffentlicheSeite`, geprüft mit Beispiel-ID. Nav bedeutet in `ALLE_ZIELE`, Weg n bedeutet Schritt in `KAUFWEG`.
Live: V = Demo-Vermieter, M = Mieter, S = Service, G = Gast; [R]/[404] = Streaming-Weiterleitung bzw. -notFound. Rohdaten:
`.scan/audit/I1.md`, `i1/crawl-*.json`, `i1/inventar-demo.json`.

| # | Adresse | Art | Bereich | Rolle | Einstieg | Demo | Nav/Weg | Reiter / Dialoge / Aufkl. / Formulare | Exporte/Dateien | Live |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | /abschluss | Seite | BuyImmo | Vermieter | Nav, WegKopf | frei | Weg 5 | – / – / 2 / 0 | Links /properties/new?aus=, /kredite/new?betrag= | V:200 G:→/login |
| 2 | /afa-assistent | Seite | BuyImmo | Vermieter | Nav, Objekt-Check ?objekt=, Steuer | frei | Nav | – / – / 0 / 0 | – | V:200 G:→/login |
| 3 | /angebot/[token] | Seite | Token | Firma (Gast) | Mail-Entwurf aus AngeboteEinholen | öff. | – | – / – / 0 / 1 | – | G:200 „Link nicht mehr gültig“ |
| 4 | /anliegen | Seite | MyImmo | Vermieter | Nav „Mieterportal“, Dashboard-Neuigkeiten, vorgangUrl | frei | Nav | tab=anliegen, bewerbungen, service, haus, vorschau*, vorschau-service* (*nur Demo), ?vorgang= / Detail / 2 / 21 | /archiv/…/datei, /kosten/…/rechnung | V:200 alle Reiter; M:→/portal S:→/service G:→/login |
| 5 | /anmelden | Seite | Auth | Gast | Login, CTA | öff. | – | Rollenwahl | – | V:200 G:200 |
| 6 | /archiv/[id]/datei | Route | MyImmo | Vermieter, Mieter | Archiv, Mieterseite, Portal, Beleihung, Makler | frei | – | – | PDF/Bild (dateiKopf) | 404 bei Notiz ohne Datei (B56), fremde ID 404 |
| 7 | /archiv | Seite | MyImmo | Vermieter | Nav, Objekt-/Mieterseite | frei | Nav | – / RowDialog / 1 / 3 | /archiv/…/datei | V:200 G:→/login |
| 8 | /aufbau | Seite | BuyImmo | Vermieter | Nav (Cockpit), Logo-Wechsel | frei | Nav | – | – | V:200 G:→/login |
| 9 | /auftrag/[token] | Seite | Token | Firma (Gast) | Mail-Entwurf aus Auftrag/Angebot | öff. | – | – / – / 0 / 1 | – | G:200; gültiger Demo-Token schreibt (B53) |
| 10 | /auth/callback | Route | Auth | Gast | Google-OAuth | öff. | – | – | – | nicht aufgerufen |
| 11 | /auth/passwort | Route | Auth | Gast | Reset-Mail | öff. | – | – | – | G:→/login?fehler=reset&grund=ohne-token |
| 12 | /auth/passwort-neu | Seite | Auth | Gast mit Nachweis | aus /auth/passwort | öff. | – | Formular | – | G:200 „Link nicht mehr gültig“ |
| 13 | /auth/signout | Route (POST) | Auth | alle | Abmelden-Knöpfe | öff. | – | – | – | nicht aufgerufen (B52) |
| 14 | /beleihung/[token]/datei/[key] | Route | Token | Bank | Bank-Link | öff. | – | – | Datei | G:404 (ungültig) |
| 15 | /beleihung/[token] | Seite | Token | Bank | Bank-Link (Mail) | öff. | – | Code, Rücklauf, Termin / 4 Formulare | Datei-Links | G:200 „Link abgelaufen oder ungültig“ |
| 16 | /bewerben/[token] | Seite | Token | Bewerber | Bewerbungs-Link | öff. | – | Formular | – | G:200 „Link nicht mehr gültig“ |
| 17 | /bewerbungen | Seite | MyImmo | Vermieter | Weiterleitung → /anliegen?tab=bewerbungen | gesperrt | – | – | – | V:→/?demo=gesperrt (C53) |
| 18 | /bewertung | Seite | BuyImmo | Vermieter | Nav (Marktwert-Schätzer) | frei | Nav | – | – | V:200 G:→/login |
| 19 | /cashflow/neu | Seite | MyImmo | Vermieter | Dashboard, /cashflow, Objektseite, NK-Seite | frei (C22) | – | 2 Formulare | /kosten/…/rechnung | V:200 |
| 20 | /cashflow | Seite | MyImmo | Vermieter | Nav „Ein- & Ausgaben“ | frei | Nav | ?typ=, jahr, prop, q / RowDialog / 2 / 4 | /api/export/buchungen (CSV), Belege | V:200 G:→/login |
| 21 | /einnahmen/[id]/edit | Seite | MyImmo | Vermieter | Dashboard „Letzte Buchungen“ | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt |
| 22 | /einnahmen/new | Seite | MyImmo | Vermieter | Objektseite, Palette | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt |
| 23 | /einnahmen | Seite | MyImmo | Vermieter | Weiterleitung → /cashflow?typ=einnahme | gesperrt | – | – | – | V:→/?demo=gesperrt (C53) |
| 24 | /einstellungen/import | Seite | MyImmo | Vermieter | /properties, Einstellungen | frei (C22) | – | CSV-Import | – | V:200 |
| 25 | /einstellungen | Seite | gemeinsam | Vermieter | Sidebar-Fuß, Palette | frei | – | tab=profil, bank, vertreter, abo*, sicherheit, recht, hilfe / ReAuth, 2FA, Tour / 0 / 7 | /api/export/alles, /api/export/buchungen | V:200 (B57), M:→/portal S:→/service |
| 26 | /einstellungen/vertreter/[id] | Route | MyImmo | Vermieter | VertreterPanel (Scan) | frei | – | – | Datei | fremde ID 404 |
| 27 | /fahrplan | Seite | BuyImmo | Vermieter | Nav (Werkzeuge) | frei | Nav | – | – | V:200 |
| 28 | /hilfe | Seite | gemeinsam | Vermieter | Einstellungen → Support, /support | frei | – | – | – | V:200; M:→/portal S:→/service (C48) |
| 29 | /jahresbericht | Seite | MyImmo | Vermieter | Nav | frei | Nav | – | /api/berichte/jahresbericht?jahr= | V:200 |
| 30 | /kauf | Seite | BuyImmo | Vermieter | Nav, Weg 3; ?sanierung= | frei | Weg 3 | Wizard / – / 6 / 1 | /api/kauf/kreditantrag (POST) | V:200 |
| 31 | /konto | Seite | Mieter/Service | Mieter, Service | Kopf von Portal und Service | frei | – | 3 Formulare | /api/export/alles | M:200 S:200 V:200[R→/einstellungen] (B55) |
| 32 | /kosten/[id]/edit | Seite | MyImmo | Vermieter | Dashboard „Letzte Buchungen“ | gesperrt | – | 2 Formulare | /kosten/…/rechnung | V:→/?demo=gesperrt |
| 33 | /kosten/[id]/rechnung | Route | MyImmo | Vermieter, Mieter | Buchungslisten, Portal | frei | – | – | Beleg | fremde ID 404 |
| 34 | /kosten/new | Seite | MyImmo | Vermieter | Objektseite, Palette | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt |
| 35 | /kosten | Seite | MyImmo | Vermieter | Weiterleitung → /cashflow?typ=ausgabe | gesperrt | – | – | – | V:→/?demo=gesperrt (C53) |
| 36 | /kredite/[id]/edit | Seite | MyImmo | Vermieter | Dashboard-Aufgabe, Objekt-Check | frei (C22) | – | 2 Formulare | – | V:200 |
| 37 | /kredite/new | Seite | MyImmo | Vermieter | /kredite, Objektseite, /abschluss | frei (C22) | – | 2 Formulare | – | V:200 |
| 38 | /kredite | Seite | MyImmo | Vermieter | Nav | frei | Nav | – / RowDialog „Details“ / 0 / 2 | – | V:200 |
| 39 | /login | Seite | Auth | Gast | Header, Gate | öff. | – | ?mfa, ?grund / 2 Formulare | – | V:200 G:200 |
| 40 | /makler/datei/[key] | Route | BuyImmo | Vermieter | MaklerOrdner | gesperrt | – | – | Datei | V:→/?demo=gesperrt |
| 41 | /makler | Seite | BuyImmo | Vermieter | Weg 4 | gesperrt | Weg 4 | – / RowDialog / 3 / 4 | Käufer-PDF, Makler-Link | V:→/?demo=gesperrt |
| 42 | /makler-link/[token]/datei/[key] | Route | Token | Makler | Makler-Link | öff. | – | – | Datei | G:404 (ungültig) |
| 43 | /makler-link/[token] | Seite | Token | Makler | Mail-Entwurf | öff. | – | Code, Rücklauf, Termin / 3 | Datei-Links | G:200 „Link abgelaufen oder ungültig“ |
| 44 | /mietkonto | Seite | MyImmo | Vermieter | Nav, Dashboard | frei | Nav | ?monat=, Reiter Kontoauszug / – / 2 / – | Mahnung, Erinnerung | V:200 |
| 45 | / | Seite | MyImmo / öffentlich | Vermieter, Gast | Nav, Logo | öff. | Nav | Grafik-Umschalter / – / 3 / 1 | – | V:200 G:200 S:→/service |
| 46 | /portal | Seite | Mieterportal | Mieter | Login-Weiche | frei | – | tab=wohnung, anliegen, zahlungen, dokumente, zaehler; ?vorgang= / – / 1 / 3 | /archiv/…/datei, /kosten/…/rechnung | M:200 alle Reiter; V:→/ S:→/service |
| 47 | /properties/[id]/beleihung/datei/[key] | Route | MyImmo | Vermieter | Beleihungsordner | frei | – | – | Datei | nicht geprüft |
| 48 | /properties/[id]/beleihung/deckblatt | Route | MyImmo | Vermieter | Beleihungsordner | frei | – | – | PDF | V:200 application/pdf |
| 49 | /properties/[id]/beleihung | Seite | MyImmo | Vermieter | Objektseite, Dashboard | frei | – | Bank-Link, Eingang, Termine / Dialoge / 1 / 3 | Deckblatt, Dateien | V:200 |
| 50 | /properties/[id]/edit | Seite | MyImmo | Vermieter | Objektseite, Anlage V, Objekt-Check | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt |
| 51 | /properties/[id]/nebenkosten | Seite | MyImmo | Vermieter | Objektseite (nur MFH), Mieter bearbeiten, NK-Seite | frei | – | ?jahr= / – / 1 / 1 | …/nebenkosten/pdf?jahr= | V:200 (auch ETW, C51) |
| 52 | /properties/[id]/nebenkosten/pdf | Route | MyImmo | Vermieter | NK-Objektseite | frei | – | – | PDF | V:200 application/pdf |
| 53 | /properties/[id] | Seite | MyImmo | Vermieter | /properties, Palette, Sidebar | frei | – | Anker, Objekt-Check / – / 4 / 4 | – | V:200; fremde ID 200[404] (C52) |
| 54 | /properties/[id]/umlage | Seite | MyImmo | Vermieter | Weiterleitung → …/nebenkosten | frei | – | – | – | V:200[R] |
| 55 | /properties/import | Seite | MyImmo | Vermieter | /properties, /properties/new | frei (C22) | – | KI-Import / 2 | /api/import-url (POST) | V:200 |
| 56 | /properties/new | Seite | MyImmo | Vermieter | /properties, Palette, /abschluss ?aus= | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt |
| 57 | /properties | Seite | gemeinsam | Vermieter | Nav | frei | Nav | Filter | – | V:200 M:→/portal |
| 58 | /sanierung | Seite | BuyImmo | Vermieter | Weg 2, /vergleich ?objekt= | frei | Weg 2 | Guide, Übersicht, Ergebnis / – / 4 / 1 | – | V:200 |
| 59 | /service | Seite | Service | Service-Partner | Login-Weiche | frei | – | Aufträge, Verlauf / 3 | – | S:200 V:→/ |
| 60 | /steuer | Seite | MyImmo | Vermieter | Nav | frei | Nav | Jahr / – / 1 / 0 | /api/export/datev, /api/berichte/anlage-v | V:200 M:→/portal |
| 61 | /strategie | Seite | BuyImmo | Vermieter | Nav, Cockpit | frei | Nav | Taktiken / – / 2 / 0 | – | V:200 |
| 62 | /tenants/[id]/dokument | Seite | MyImmo | Vermieter | Mieterseite, Mietkonto, Palette (?art=), NK-Seite | frei | – | art= (10 Briefarten) / 2 Formulare | …/dokument/pdf (POST) | V:200 |
| 63 | /tenants/[id]/dokument/pdf | Route (POST) | MyImmo | Vermieter | DocGenerator, BriefVersand | frei | – | – | PDF | nicht aufgerufen |
| 64 | /tenants/[id]/edit | Seite | MyImmo | Vermieter | Mieterseite, Mietkonto, NK-Seite ?jahr= | gesperrt | – | Positionen / 1 / 3 | – | V:→/?demo=gesperrt |
| 65 | /tenants/[id]/nk | Seite | MyImmo | Vermieter | Mieterseite, /termine, Dashboard, Palette | frei | – | ?jahr= / Zustell-Karte / 0 / 1 | …/nk/pdf?jahr= | V:200 |
| 66 | /tenants/[id]/nk/pdf | Route | MyImmo | Vermieter | NK-Seite | frei | – | – | PDF | V:200 application/pdf |
| 67 | /tenants/[id] | Seite | MyImmo | Vermieter | /tenants, Palette, Mietkonto, Termine | frei | – | Zustellung / 1 / 2 | /archiv/…/datei (mit Guard) | V:200; fremde ID 200[404] |
| 68 | /tenants/[id]/protokoll | Seite | MyImmo | Vermieter | Mieterseite | frei | – | 1 Formular | …/protokoll/pdf (POST) | V:200 (B54) |
| 69 | /tenants/[id]/protokoll/pdf | Route (POST) | MyImmo | Vermieter | UebergabeProtokoll | frei | – | – | PDF | nicht aufgerufen |
| 70 | /tenants/new | Seite | MyImmo | Vermieter | /tenants, Objekt-Check ?prop=&back=, Palette | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt |
| 71 | /tenants | Seite | MyImmo | Vermieter | Nav | frei | Nav | Filter | – | V:200 |
| 72 | /termine/[id]/edit | Seite | MyImmo | Vermieter | /termine (Stift) | frei (C22) | – | 2 Formulare | – | fremde ID V:200[404]; Demo ohne Termine |
| 73 | /termine/ical | Route | MyImmo | Vermieter | /termine | frei | – | – | iCal | V:200 text/calendar |
| 74 | /termine | Seite | MyImmo | Vermieter | Dashboard (2×), Mieterseite, Prüfpflichten; nicht in Nav/Palette (C47) | frei | – | ?ansicht=monat, monat, tag, erledigte / – / 0 / 4 | /termine/ical | V:200 |
| 75 | /verbrauch/[id]/edit | Seite | MyImmo | Vermieter | kein Link (C49) | frei (C22) | – | 2 Formulare | – | V:200 |
| 76 | /verbrauch/new | Seite | MyImmo | Vermieter | /verbrauch, Objektseite | frei (C22) | – | 2 Formulare | – | V:200 |
| 77 | /verbrauch | Seite | MyImmo | Vermieter | Nav | frei | Nav | – / RowDialog / 0 / 2 | Zählerfotos | V:200 (B58) |
| 78 | /vergleich | Seite | BuyImmo | Vermieter | Weg 1, /kauf?sanierung= | frei | Weg 1 | – / – / 5 / 0 | /sanierung?objekt= | V:200 |
| 79 | /verkauf | Seite | BuyImmo | Vermieter | Nav | frei | Nav | – | – | V:200 |
| 80 | /willkommen | Seite | Auth | Konto ohne Freischaltung | Layout-Gate | gesperrt | – | 2 Formulare | – | V:→/?demo=gesperrt G:→/login |
| 81 | /agb | Seite | öffentlich | alle | Login, Footer | öff. | – | – | – | 200 |
| 82 | /avv | Seite | öffentlich | alle | Login, Sidebar-Fuß | öff. | – | – | – | 200 |
| 83 | /datenschutz | Seite | öffentlich | alle | Fuß | öff. | – | – | – | 200 |
| 84 | /funktionen/[slug] | Seite | öffentlich | alle | /funktionen (4 Slugs) | öff. | – | CTA, Newsletter | – | 4/4 200; unbekannt echte 404 |
| 85 | /funktionen | Seite | öffentlich | alle | Header, Sitemap | öff. | – | – | – | 200 |
| 86 | /impressum | Seite | öffentlich | alle | Fuß | öff. | – | – | – | 200 |
| 87 | /preise | Seite | öffentlich | alle | Startseite (nur PREISE_SICHTBAR), Sitemap | öff. | – | FAQ / 1 / 1 | – | 200 (C56) |
| 88 | /ratgeber/[slug] | Seite | öffentlich | alle | /ratgeber, Funktionen, Querverweise | öff. | – | – | – | 17/17 200; unbekannt echte 404 |
| 89 | /ratgeber | Seite | öffentlich | alle | Header, Sitemap | öff. | – | – | – | 200 |
| 90 | /vision | Seite | öffentlich | alle | Startseite, Sitemap | öff. | – | – | – | 200 |
| 91 | /vorlagen | Seite | öffentlich | alle | Shell, Sitemap | öff. | – | Newsletter (nur brevoBereit) / 2 | – | 200 |
| 92 | /api/anliegen-datei/[id] | Route | API | Vermieter, Mieter | Anliegen-Detail | frei | – | – | Datei | fremde ID 404 |
| 93 | /api/auftrag-foto/[id] | Route | API | Vermieter, Service | AuftragVerlauf | frei | – | – | Bild | fremde ID 404 |
| 94 | /api/berichte/anlage-v | Route | API | Vermieter | /steuer | frei | – | – | PDF | V:200 |
| 95 | /api/berichte/jahresbericht | Route | API | Vermieter | /jahresbericht | frei | – | – | PDF | V:200 |
| 96 | /api/billing/webhook | Route (POST) | API | Paddle | – | gesperrt | – | – | – | nicht aufgerufen |
| 97 | /api/cron/bewertung | Route | API | Cron | GitHub Action | gesperrt | – | – | – | nicht aufgerufen |
| 98 | /api/cron/wert-refresh | Route | API | Cron | GitHub Action | gesperrt | – | – | – | nicht aufgerufen |
| 99 | /api/demo | Route | API | Gast | Startseite, Demo-Wege | frei | – | ?rolle, ?weg | – | bewusst nicht aufgerufen (Verstoß U1, siehe 1) |
| 100 | /api/encrypt-bankdaten | Route | API | Betreiber | manuell | gesperrt | – | – | – | nicht aufgerufen |
| 101 | /api/export/alles | Route | API | alle Rollen | Einstellungen, /konto | gesperrt | – | – | ZIP | V:→/?demo=gesperrt G:401 |
| 102 | /api/export/buchungen | Route | API | Vermieter | /cashflow, Einstellungen | frei | – | – | CSV | V:200 G:401 |
| 103 | /api/export/datev | Route | API | Vermieter | /steuer | frei | – | – | CSV | V:200 G:401 |
| 104 | /api/freigabe-eingang/[id] | Route | API | Vermieter | FreigabeEingang | frei | – | – | Datei | fremde ID 404 |
| 105 | /api/import | Route (POST) | API | Vermieter | Einstellungen/Import | gesperrt | – | – | – | nicht aufgerufen |
| 106 | /api/import-url | Route (POST) | API | Vermieter | Import, Kaufprüfung | gesperrt | – | – | – | nicht aufgerufen (Kosten) |
| 107 | /api/kauf/kreditantrag | Route (POST) | API | Vermieter | /kauf | frei | – | – | PDF | nicht aufgerufen |
| 108 | /api/newsletter/abmelden | Route | API | Gast | Mail-Link | gesperrt | – | – | – | G ohne Token:→/vorlagen?nl=fehler |
| 109 | /api/newsletter/bestaetigen | Route | API | Gast | Mail-Link | gesperrt | – | – | – | G ohne Token:→/vorlagen?nl=fehler |
| 110 | /api/newsletter | Route (POST) | API | Gast | Formulare | gesperrt | – | – | – | nicht aufgerufen |
| 111 | /api/nk-ocr | Route (POST) | API | Vermieter | NK-Seite | gesperrt | – | – | – | nicht aufgerufen (Kosten) |
| 112 | /api/zaehler-foto/[id] | Route | API | Vermieter, Mieter | /verbrauch, Portal | frei | – | – | Bild | fremde ID 404 |

**PDF-Erzeuger (`lib/pdf`):**
- docPdf → `/tenants/[id]/dokument/pdf`, `lib/actions/dokumente.ts`
- nkPdf → `/tenants/[id]/nk/pdf`, `/properties/[id]/nebenkosten/pdf`, NK-Zustellung
- protokollPdf → `/tenants/[id]/protokoll/pdf`
- berichtPdf → `/api/berichte/anlage-v`, `/api/berichte/jahresbericht`
- beleihungPdf → `…/beleihung/deckblatt`, `lib/actions/beleihung.ts`
- kaeuferPdf → `lib/actions/makler.ts`
- kreditantragPdf → `/api/kauf/kreditantrag`

CSV, DATEV und iCal: `/api/export/buchungen`, `/api/export/datev`, `/termine/ical`; ZIP über `/api/export/alles`.
Verwaiste Seiten: `/verbrauch/[id]/edit`. Tote Ziele: `/notizen`. Live wurden 459 Link-Ziele aus Vermieter-Seiten
geprüft, nur die Datei-Route aus B56 endete auf 404. Die Sitemap hat 27 URLs, alle liefern 200.

---

## 7. Rechenstellen-Verzeichnis und Doppelberechnungen

| Größe | Stelle | Ergebnis |
|---|---|---|
| Soll-Kaltmiete je Objekt | `lib/sollMiete.ts` `sollKaltmiete` | ✓ |
| Soll je Monat, Mietänderung | `lib/mietkonto.ts` `sollFuerMonat`/`vertragswerte`, `lib/sollAb.ts` | ✓ (anteilige Miete geprüft) |
| Fälligkeit | `dritterWerktag` | ohne Feiertage (B7) |
| überfällig | `mieteUeberfaellig` / `offeneMieten` / `lib/heute.ts` | drei Regeln (B13) |
| Teilzahlung | `TEILZAHLUNG_TOLERANZ` 1 € / `lib/mieterKonto.ts` 0,50 € | zwei Regeln (B11) |
| NK-Vorauszahlungen, Ø Kosten, Monats-Cashflow | `lib/cashflowKennzahl.ts` | Formel ✓; Fenster je Ort verschieden (B25), Rundung (C17) |
| Rendite | Dashboard / Liste / Objektseite | drei Formeln (B24) |
| Kaufpreisfaktor, Peterssche Formel | Objektseite | ✓ |
| Portfolio-Wert, Wertkurve, Wertzuwachs | `app/(app)/page.tsx:300`, `lib/wert/verlauf.ts` | Rückfall verschieden (B26) |
| Buchungssaldo-Grafik | `lib/zeitraum.ts` `aggregate` | ✓ |
| Schulden-Uhr, Getilgt-% | `lib/schuldenStand.ts`, `components/KrediteListe.tsx`, Objektseite | ✓; abbezahlte Kredite (B17), leere Restschuld (B18) |
| Beleihungsauslauf | `lib/beleihungsauslauf.ts` und `lib/pdf/beleihungPdf.ts:159` | zwei Regeln (B18) |
| Restschuld BuyImmo | `lib/kalk.ts` `berechneRestschuld` | = Annuitätenformel ✓ |
| Kreditfristen | `lib/fristen.ts` | Monatsende ✓; § 489 (B20) |
| Objekt-Check | `lib/objektCheck.ts` | C16 |
| Jahresbericht-Zeile | `lib/jahresberichtZeile.ts` | ohne Zeitgrenze (B3) |
| Anlage V | `lib/anlageV.ts` → Seite, PDF, CSV, Vergleich | A1, A2, A3, B1, B2, B3 |
| AfA-Satz nach Baujahr | `lib/anlageV.ts:18` und `lib/steuer/afa.ts:17` | doppelt, identisch |
| Degressive AfA | `lib/anlageV.ts:230-256` und Plan in `lib/steuer/afa.ts:50` | doppelt; A3 |
| Zinsschätzung | `lib/anlageV.ts:281` (Jahr) und `lib/jahresberichtZeile.ts:53` (× Monate) | doppelt, verschieden skaliert; B3 |
| 15-%-Grenze | `lib/steuer/anschaffungsnah.ts` | eine Regel, die Anlage V nutzt sie nicht (A1) |
| Spekulationsfrist | `lib/steuer/spekulation.ts` | C19 |
| § 82b / § 7b | `lib/steuer/afa.ts:192`, `:137` | nur Rechner (B49), C21 |
| DATEV | `lib/datev.ts` | Summen ✓ |
| Abo-Buchung | `lib/billing/aboBuchung.ts` + SQL | cent-genau ✓ |
| NK am Objekt | `lib/nkObjekt.ts` `verteileObjektKosten` | Fläche/Einheiten/MEA ✓; Personen A5; Verbrauch C25 |
| NK beim Mieter | `lib/nk.ts` `berechneNk` | ✓ außer hkvo (A6) |
| Vorauszahlung | `lib/nk.ts:147-215` | Betrag ✓, Beschriftung B6 |
| CO2 | `lib/co2.ts` | Tabelle und BEHG ✓; A4, C22 |
| § 35a | `lib/nk.ts:529-555` | ✓ |
| Vorauszahlungsvorschlag | `lib/nkVorjahr.ts:55` | C23 |
| Kontoauszug | `lib/kontoauszug.ts` | B14 |
| Verbilligte Vermietung | `lib/steuer/verbilligt.ts` | C26 |
| Grunderwerbsteuer, Kaufnebenkosten | `lib/kalk.ts:69-120` | ✓ (16 Länder, zwei Quellen) |
| Objekt-Kennzahlen | `lib/kauf/objektKennzahlen.ts` | ✓ (Demo 4/4) |
| EK-Ampel | `lib/kauf/machbarkeit.ts:110-123` | B31 |
| Ertragswert | `lib/bewertung/immowertv.ts` | B33 |
| Vergleich/Krone | `components/kauf/ObjektVergleich.tsx`, `lib/kauf/auswahl.ts` | B30 |
| Strategie | `lib/strategie.ts` | B29, C30 |
| Verkauf | `lib/verkauf.ts` | ✓ |
| Sanierung Flächen/Gebinde/Auswertung | `lib/sanierung/rechner.ts`, `auswertung.ts` | ✓; C31, C32, B37 |
| Förderung | `lib/sanierung/foerderung.ts`, `lib/kauf/foerderung.ts` | BAFA/iSFP/KfW 308/§ 35c ✓; B36 |

**Doppelberechnungen mit Vorschlag zur Zusammenführung:**
1. **Ø-Kosten und Cashflow:** Dashboard und Objektseite rechnen mit unterschiedlichen Fenstern und Rundungen. Vorschlag: `kostenSchnittJeObjekt()` als einzige Quelle; das Dashboard bildet nur die Summe.
2. **Rendite:** Drei Formeln. Vorschlag: `bruttoRendite(miete, kaufpreis, wert)` mit Basis-Beschriftung.
3. **Wert:** `wert ?? 0` im Dashboard gegen `wert ?? kaufpreis` in Liste und Objektseite. Vorschlag: `aktuellerWert(p)`.
4. **Stichtag:** `heuteBerlin()` gegen UTC an vier Seiten. Vorschlag: nur `heuteBerlin()`, dazu ein Wächter-Test gegen `new Date().toISOString().slice(0,10)` in `app/(app)`.
5. **„Laufender Vertrag“:** `sollMiete.laeuftAm` gegen `objektCheck.laeuft`. Vorschlag: nur `laeuftAm`.
6. **Kredit aktiv / Restschuld:** sieben Leser mit drei Null-Regeln, keine Zeitgrenze. Vorschlag: `kreditAktivImMonat()` + `restschuldVon()`.
7. **Beleihungsauslauf:** `lib/beleihungsauslauf.ts` gegen `beleihungPdf.ts`. Vorschlag: das PDF ruft die Lib auf.
8. **Zinsschätzung:** Anlage V (Jahr) und Jahresbericht (Monate). Vorschlag: eine Funktion `zinsImZeitraum(k, von, bis)`.
9. **AfA-Satz und degressive AfA:** doppelt in `anlageV.ts` und `steuer/afa.ts`. Vorschlag: `lib/steuer/afa.ts` ist die Quelle.
10. **Überfällig und Toleranz:** siehe B11 und B13. Vorschlag: ein Modul `lib/mietStatus.ts`.
11. **Bundesland-Auswahl:** dreimal gebaut, nur `NebenkostenRechner.tsx` ist korrekt. Vorschlag: eine Komponente `BundeslandWahl`.
12. **Getilgt-%:** KrediteListe, schuldenStand und Objektseite. Vorschlag: nur `schuldenStand`.
13. **Monatsindex-Helfer:** in `lib/cashflowKennzahl.ts` und `lib/zeitraum.ts` (gleiches Verhalten). Vorschlag: zusammenlegen.

---

## 8. Fachstand je Reiter und Ratgeber (F1)

| Reiter/Bereich | Rechtsgrundlage | Stand |
|---|---|---|
| NK-Abrechnung (Mieter/Objekt) | § 556, § 556a BGB, BetrKV | Fristen und Schlüssel ok; A5, A6, B18 (bekannt) |
| Heizkosten (HKVO) | §§ 7, 9b, 12 HeizkostenV | Code A6; Ratgeber B47, B48, C34, C35 |
| CO2-Aufteilung | CO2KostAufG, BEHG § 10 | Preis 2026 = 60 € im Korridor 55–65 ok; A4, C22 |
| Belegfreigabe im Portal | § 556 Abs. 4 BGB | Code ok; Ratgeber B46 |
| Kabel-TV | Wegfall der Umlage ab 07/2024 | ok (keine Kategorie) |
| Fristen Mieterhöhung | §§ 558, 557a/b BGB | B8 |
| Generator Mieterhöhung | § 558a BGB | A7 |
| Generator Kündigung | §§ 568, 573, 573c, 574b, 126 BGB | A8, B40 |
| Generator Modernisierung | §§ 555c, 555d, 559b BGB | B39 |
| Mietquittung | § 368 BGB | B38 |
| Wohnungsgeberbestätigung | § 19 BMG | B41 |
| Energieausweis-Frist | § 79 Abs. 3 GModG | ok |
| Legionellen | § 31 TrinkwV 2023 | C38 |
| Steuer / Anlage V | § 21 EStG, § 7, § 6 Abs. 1 Nr. 1a | A1–A3, B1–B4 |
| AfA-Assistent, § 7b, § 82b | §§ 7, 7b EStG, § 82b EStDV | Rechner ok; C21; B49 |
| Verbilligte Vermietung | § 21 Abs. 2 EStG | C26 |
| Kredite | § 489 BGB | B20 |
| Steuerfristen | § 149 AO, § 28 GrStG, § 108 AO | C40 |
| Kaution | § 551 BGB | C42, B16 |
| Bewerbung | DSGVO, DSK-OH V2.0 (01/2026) | B45 |
| Grunderwerbsteuer | Landesrecht (Bremen 5,5 % seit 01.07.2025, Thüringen 5,0 %) | ok |
| Ertragswert | ImmoWertV Anl. 3 | B33 |
| Förderung | BEG EM 2026, KfW 308, § 35c EStG | B36, C33 |
| Ratgeber NK Schritt für Schritt, Umlageschlüssel, Erste Vermietung, Mietvertrag-Klauseln, geerbte Wohnung, AfA, Software wechseln, NK-Fristen, 15-%-Falle | jeweils Normen laut F1 | ok |
| Ratgeber Belegeinsicht | § 556 Abs. 4 | B46 |
| Ratgeber Heizkosten | HeizkostenV | B47, B48, C34, C35 |
| Ratgeber Anlage V | — | C37 |
| Ratgeber § 82b | § 82b EStDV | Recht ok, Werbekasten B49 |
| Ratgeber Mieterhöhung | §§ 558–559e | C39 |
| Ratgeber Grundsteuer | BFH II R 25/24 | C36 |
| Ratgeber § 35a | BMF 09.11.2016 | B51 |
| Startseite, FAQ | § 5 UWG gegenüber Code/DSE | Stichproben ok |
| /funktionen, /vorlagen | § 5 UWG | A7, A8, B16, B39, B49, B50, C46 |
| Siegel „Rechtsstand Juli 2026“ | — | deckt veraltete Stellen ab (C41) |

---

## 9. Vermieter- und Mieterprobleme mit Abdeckung (F2)

Stufen: L = gelöst · LF = gelöst, aber falsch · T = teilweise · V = von der App verschärft · N = nicht abgedeckt. Die Zitate liegen im Volltext unter `.scan/audit/F2src/`.

**Vermieter (31):** Die Bürokratie der NK ist der Hauptgrund für Rückzug (26.000 Befragte, boerse-express) – T. Kosten über den Einnahmen bei jedem Achten (Haus & Grund 2025) – L. Mieterhöhungen werden unterlassen (über 60 %) – LF (A7, B8). Sanierungshemmnisse – T (B36). Wärmeplanung kennen nur 8,2 % – N. Mietrecht ändert sich ständig (ZDF) – T (Ratgeber-Funde). GEG-Kosten – T. Mietausfall und Streit – T (B7, B10). Mietnomaden, inoffiziell 15.000 Fälle – V (B45). Instandhaltung – T. Funktion verschwindet aus dem Basistarif (objego) – L (Bestandsschutz). Zusatzkäufe – T. Ausgaben nicht auf mehrere Objekte verteilbar – N (`BuchungForm.tsx:125`). Abrechnungsarten fehlen – T. Bankzuordnung fummelig – T (B14). Support – N, kein Code-Thema. Bankanbindung unbrauchbar (vermietet.de) – T (nur CSV). Doppelbuchungen – L. NK nicht erstellbar – T (ETW offen). Zuordnung durcheinander – L (`lib/kategorien.ts`). Kundenservice – N. Excel-Zahlendreher – L. Falsche Mietpartei – L. Werte manuell eintragen – T. Umlageschlüssel vergessen (Haufe) – T (B18 bekannt). Leerstand trägt der Vermieter – LF (A5). Instandhaltung nicht umlegbar – L. Belegeinsicht – L (Ratgeber B46). Abrechnungsfrist § 556 Abs. 3 – L. Zulässige Selbstauskunft (DSK) – V (B45). Kündigungsgründe § 573 Abs. 3 – V (A8).

**Mieter (24):** Betriebskosten sind das häufigste Beratungsthema (37,0 %, DMB 2023), jede zweite Abrechnung ist fehlerhaft (BMV), 16,4 % der Prozesse – T (A4–A6, B18). Wohnungsmängel 18,2 % – L (Schadensmeldung). Vertragsverletzungen inkl. Minderung 28,4 % – V (B15). Minderung kraft Gesetzes (test.de) – V (B15). Mängelanzeige mit Vorbehalt – T. Mieterhöhung 21,8 % vor Gericht – LF (A7, B44). Erhöhung an alle Mieter – V (B44). Mietspiegelwert benennen – LF (A7). Kappung und Sperrfrist – T. **Kaution 15,7 % vor Gericht – N** (nur Betrag und Status). Rückzahlung und Einbehalt – N. Verzinste Anlage – T. Höchstens 3 Kaltmieten – N (C42). Eigenbedarf 6,8 % – V (A8). Fristlose Kündigung 4,9 % – N (keine Vorlage). Verteilerschlüssel und Leerstand – LF (A5). Verwaltung in den NK – L. CO2-Anteil 3 % Kürzung – LF (A4). 15 % Kürzung HKVO – T. Datenpreisgabe an Plattformen – Portal L, Bewerbung V (B45). Mietschuldenfreiheitsbescheinigung – V (B45). Löschung der Bewerberdaten – T (B45).

**Am stärksten unterversorgt:** Kaution (Abrechnung, Zinsen, Rückzahlungsfrist), Mietminderung, mehrere
Vertragspartner, fristlose Kündigung.

---

## 10. Dokumentenprüfung je Dokument (F3) und Anwaltsliste

| Dokument | Form (Gesetz) | Ergebnis | Was ändern |
|---|---|---|---|
| Allgemeines Schreiben | frei | wirksam | Server-Route erzeugt auch leere Briefe (Design-Audit) |
| Mieterhöhung § 558 | Textform §§ 558a, 126b | **unwirksam** ohne Begründung (A7); ohne Erklärenden (B42); nur eine Person (B44) | Begründungsmittel Pflicht, Datumsprüfungen; Text zur Zustimmungsfrist (§ 558b Abs. 2) korrekt |
| Zahlungserinnerung | formfrei | wirksam | Monat (C43); Feiertage (B7) |
| Mahnung | formfrei, § 286 | angreifbar | „trotz vorheriger Erinnerung“ (B10); Monat (C43) |
| Kündigung (Vermieter) | Schriftform §§ 568, 126 | **unwirksam** per Mail/Portal/E-Signatur und ohne Grund (A8); Termin ungeprüft (B40) | Grund Pflicht, Frist rechnen, digital sperren, Widerspruchshinweis |
| Reparatur-/Modernisierungsankündigung | § 555a bzw. § 555c | Erhaltung wirksam; Modernisierung nicht § 555c-gerecht (B39) | eigene § 555c-Vorlage |
| NK-Anschreiben | – | wirksam | Werbetext „mit Saldo“ (C46) |
| NK-Abrechnung (Mieter und Objekt) | Zugang § 556 Abs. 3 | **formell unwirksam** ohne Gesamtkosten (B18 bekannt, live unverändert) | Gesamtkosten, Schlüssel, Anteilsrechnung; Zugang (B43); Anschriftfeld (C44) |
| Wohnungsgeberbestätigung | § 19 BMG | angreifbar (B41) | Personen, Eigentümer, Einzugsdatum |
| Mietbescheinigung | formfrei | wirksam | — |
| Mietquittung | § 368 BGB | riskant (B38) | Betrag + Monat Pflicht |
| Übergabeprotokoll | formfrei | wirksam, schwach | Zählernummern, alle Mieter (C46) |
| Anlage-V-Aufstellung / Jahresbericht | Hilfsmittel | Zahlen siehe A1–A3, B1–B4, B28 | „Keine Steuerberatung“ vorhanden |
| Kreditantrag | Selbstauskunft | wirksam; nicht verknüpft (B21) | SCHUFA-Einwilligung → Anwalt |
| Beleihungs-Deckblatt / Kennblatt / Mietaufstellung | Bankunterlagen | wirksam | Mieternamen an die Bank → Anwalt |
| Käufer-Selbstauskunft | freiwillig | wirksam | Datenminimierung (C45) |
| Versand per Mail | Textform möglich, Schriftform nie | Zugang muss der Vermieter beweisen | Kündigung sperren (A8) |
| Versand ins Portal | Textform strittig | Zugang nicht belegt (B43) | Hinweis, Abruf überwachen |

**Anwaltsliste (zusätzlich zu StBerG und § 34i, die schon auf der Liste stehen):**
1. Zugang eines im Mieterportal bereitgestellten PDFs gegenüber Verbrauchern: ab Bereitstellung, ab Hinweis-Mail oder ab Abruf? Reicht „gelesen und bestätigt“ als Nachweis? (§ 130 BGB; BGH VII ZR 895/21 betrifft nur Unternehmer.)
2. Ist ein Portal-PDF ein dauerhafter Datenträger im Sinne von § 126b, wenn der Zugang am 31.12. des Folgejahres endet?
3. Wird eine Kündigung mit falschem Termin zum nächstzulässigen Termin ausgelegt? Ist für die Verlängerung nach § 573c Abs. 1 S. 2 der Zugang oder die Beendigung maßgeblich?
4. Mehrere Mieter oder Vermieter: Müssen Mieterhöhung und Kündigung an alle bzw. von allen ausgehen? (B44)
5. Genügt für § 19 Abs. 1 BMG („schriftlich“) ein PDF mit Unterschriftsbild per Mail oder Portal?
6. Genügt für eine Mietquittung nach § 368 ein eingebettetes Unterschriftsbild?
7. Ist die vorformulierte SCHUFA-Einwilligung im Kreditantrag bestimmt genug (Art. 7 DSGVO)?
8. Welche Rechtsgrundlage trägt die Mietaufstellung mit Mieternamen an Bank bzw. Beleihungs-Link, und muss der Mieter informiert werden?
9. Wo liegt die Grenze nach RDG und § 5 UWG bei Vorlagen mit Paragrafen im Titel?
10. Rechtsgrundlage und zulässiger Umfang des Bewerbungslinks nach der DSK-Orientierungshilfe V2.0 (B45).
11. Formulierungen im Kaufweg an der § 34i-Grenze (B34), zusammen mit dem bestehenden § 34i-Punkt.

---

## 11. Fundament für Verlässlichkeit

**Referenzfälle als feste Tests** (jede Zahl mit Rechenweg im Test):
- Demo mit festem Stichtag (`demo_zuruecksetzen('2026-10-07')`) und Sollwerten: Dashboard 1.548/922/5.930/6.960/4.490, Saldo 1J 42.073,76, Max 72.928,20, Schulden 937.000/125.000/2.075, Jahresbericht Σ 2026 15.460. Nach Behebung von B27 werden diese Sollwerte angepasst.
- Anlage V: Kauf am 31.12./01.01./29.02., degressive AfA mit Novemberkauf über drei Jahre, 3 % bis zur vollen Absetzung, Startjahr ≠ Kaufjahr, 15-%-Grenze überschritten, „Selbst bewohnt“, Darlehen ab Oktober.
- NK: Demo Dresden 2025 (Krüger 1.494,31 / Berger 1.818,69 / Vermieter 24,00), Mieterwechsel am 1., 15. und Monatsletzten im Schaltjahr, Personenschlüssel mit fehlender Angabe, HKVO-Nutzerwechsel, CO2 im MFH, CO2 an den Stufengrenzen nach Rundung.
- Mietkonto: Fälligkeitskalender 2026–2030 mit bundesweiten Feiertagen, Staffel der Demo-Mieterin Schmidt, Minderung über drei Monate, Kontoauszug-Fallen (Nachnamen wie Monatsnamen, „Lang“, „Klein“, „Neu“).
- Kredite: ein vollständiger Bank-Tilgungsplan durch alle Verbraucher (kalk, schuldenStand, jahresZeile, anlageV, Cashflow), abbezahlt, leere Restschuld, leere Rate.
- BuyImmo: Strategie mit Stichtag Oktober, Vergleich verschieden großer Objekte, KfW-Beispiel 5 WE → 17.600 €, iSFP 40.000 € → 6.500 €.
- Dokumente: PDF-Golden-Test je Vorlage mit den Pflichtbestandteilen der jeweiligen Norm.

**Eine Rechenstelle je Zahl:** die 13 Zusammenführungen aus Abschnitt 7. Dazu eine Liste der Schriftform-Arten (Kündigung, Quittung, Wohnungsgeberbestätigung), die Versand und E-Signatur steuert.

**Plausibilitätsprüfungen zur Laufzeit** (Hinweis statt Zwang):
- Σ Objekt-Cashflows = Dashboard (±1 €); Kachel Portfolio-Wert = letzter Punkt der Wertkurve.
- NK je Position: Σ Mieter + Vermieter = Gesamt; Σ CO2-Gutschriften ≤ CO2-Kosten des Hauses.
- Kredit: Rate gegen K·(i+t)/12 (±15 %), Restschuld gegen die Annuitätenformel, Zinsbindung gegen Auszahlung (§ 489 Nr. 1/2).
- Kaution > 3 × Kaltmiete; Mieterhöhung „wirksam ab“ vor dem dritten Monat; § 558 bei Index/Staffel gesperrt.
- Wohnfläche < 10 oder > 2.000 m²; Raummaß > 30 m.
- 15-%-Wächter „überschritten“ → Erhaltung nicht übertragbar; Jahr ohne Buchungen → Hinweis statt Verlust.
- EK-Ampel nie grün bei EK < NK.

**Datenvollständigkeit:**
- Jede neue Tabelle mit Kaskade auf properties/mieter, die Demo-Daten trägt, gehört in `demo_seed` und in den Reset. Eine SQL-Probe nach dem Reset prüft Mindestzeilen je Tabelle.
- Die Demo braucht wiederkehrende Kosten in jedem Kalenderjahr, keine Kosten vor dem Kaufdatum, Zinsen aus der Restschuld, Darlehen aus Formeln.
- Je einen gültigen Bank-, Makler-, Bewerbungs- und Angebots-Link (nur lesend), eine Zustellung mit Datei, eine `auftrag_notiz` mit Foto und Termine. Ohne diese Daten bleiben ganze Wege ungeprüft.
- Mieterzeile: weitere Vertragspartner; Kaution mit Anlageort, Zinsen und Rückzahlung; Objekt: Gesamtzahl der WE im Gebäude.

**Prüfzyklus** (Einträge für `docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md`, nach Freigabe):
- Anlage-V-Vordruck jedes Jahr im September (Zeilen und Kennzahlen).
- ImmoWertV Anl. 3 jährlich zum 01.01. (Oberer Gutachterausschuss bzw. BMWSB).
- BEG EM zum 01.02.2027 (erste Absenkung) und in Q1 2027 (Wärmepumpe, WPB-Bonus); Bundesanzeiger-Fundstelle einmal klären.
- BEHG-Preis 2027 (Marktpreis/ETS2).
- DSK-Orientierungshilfe Selbstauskünfte jährlich.
- DMB-Prozessstatistik jährlich als Grundlage für die Prioritäten.
- Ratgeber-Rechtsstand halbjährlich; `RECHTSSTAND` erst nach dem Gegenlesen hochsetzen.
- § 489-Texte jährlich.
- Fernablesefrist 31.12.2026 (steht bereits drin).
- Werkzeug: Der nur lesende GET-Crawler (`i1/crawl.mjs`) läuft monatlich mit allen drei Rollen. Er schließt `/api/demo` und andere zustandsändernde GET-Routen aus und wertet Streaming-Marker aus. Der Darstellungslauf mit vier Breiten × zwei Themen läuft nach jedem Landing-PR mit höchstens vier parallelen Browsern und Ladekontrolle (CSS-Regeln > 200).
- `scripts/designscan/pruefe.mjs` scrollt mit `behavior: "smooth"` und liefert dadurch halbe Bildschirme. Das betrifft möglicherweise auch Aufnahmen des Design-Scans vom 06.10. Ein Fix ist nötig (`behavior: "instant"`).
- Ein Wächter-Test bindet jede Werbeaussage auf `/funktionen`, `/vorlagen` und in Ratgeber-Kästen an eine Code-Stelle (wie `VERTRAUEN`); B16, B49, B50 und C41 wären damit rot geworden.

---

## 12. Nicht geprüft und warum

| Was | Warum |
|---|---|
| Alle schreibenden Wege (Absenden, Speichern, Bestätigen, Zustellen, Registrierung, Reset-Mail, Newsletter) | nur Lesen erlaubt; Wirkung aus Code bzw. Funktionstext abgeleitet |
| POST-Routen (Dokument-/Protokoll-PDF, Kreditantrag, Importe, KI, Newsletter, Webhook, signout) | Schreiben, Kosten oder Abmeldung |
| `/api/demo`, Cron, `encrypt-bankdaten`, `/auth/callback` | Reset aller Sitzungen, Geheimnis, schreibend (beim Linkprüfer von U1 trotzdem fünfmal aufgerufen) |
| Gültige Bank-, Makler-, Bewerbungs- und Angebots-Links, Code-Formular | Demo hat 0 Zeilen, Anlegen gesperrt |
| Dateirouten mit echtem Inhalt, Beleg-Ansicht, Auftragsfotos | Demo ohne Belege, Fotos, Scans und Eingänge |
| Kreditantrag, Kennblatt, Mietaufstellung, Käufer-Selbstauskunft als erzeugte PDFs | Erzeugung schreibt bzw. braucht POST; nur Quelltext |
| 2FA-Schritt mit echter aal1-Sitzung, Google-Login, Reset-Links | kein Konto mit Faktor, externe Wege |
| Echte Telefone, Screenreader, iOS Safari, Wischgefühl, Druckansicht | nur Headless-Chromium |
| Kontrast vor Bild-, Glas- und Verlaufshintergründen | Messung nur auf deckenden Flächen |
| Amtlicher Anlage-V-Vordruck direkt vom BMF | 404 bzw. nicht auslesbar; Nachdruck (Barcode 2025AnlV) + ELSTER-Forum |
| DATEV-Formatdetails | Formatbeschreibung nicht abgerufen |
| Bundesanzeiger-Fundstelle BEG EM, R 21.5 EStR, VDI 2067 | nicht automatisch abrufbar |
| Kappungsgrenzen-Verordnungen, VPI-Indexmiete, Mietpreisbremse | keine Rechnung im Code |
| BGH VIII ZR 93/15 im Volltext, BetrKV § 2 Nr. 15 wörtlich | B18 bekannt; kein Rechenweg betroffen |
| Restwert bei Kombination § 7 Abs. 5a + § 7b | keine Primärquelle gefunden |
| GNotKG-Tabelle (2 % Notar/Grundbuch), Maklerquote, Liegenschaftszins 3,5 % | keine Primärquelle bzw. regional |
| Reddit, Trustpilot, Immoware24, Smartvermieten | Suche leer bzw. 403 |
| Echte Bank-CSV im Kontoauszug-Abgleich | keine echten Exporte |
| Echte Konten | nach Auftrag verboten |
| Tabellenvarianten über zwei Beispiele je Form hinaus (z. B. `/termine?monat=…`) | Crawler begrenzt |
| AfA-Wechseljahr bei 33⅓ Jahren (`lib/steuer/afa.ts:55`) | nur Vermutung ohne Primärquelle, nicht als Befund gewertet |

---

## 13. Vorschlag PR-Pakete (A zuerst)

| Paket | Inhalt | Umfang | Tests |
|---|---|---|---|
| **P1 Anlage V richtig** | A1, A2, A3, B2, B3 (Anlage-V-Teil), B4; Zusammenführung der Doppelberechnungen 8 und 9 | `lib/anlageV.ts`, `lib/steuer/afa.ts`, `berichtPdf.ts`, `steuer/page.tsx`, Route | Referenzfälle aus 11, je eine Mutation; Seite = PDF = CSV |
| **P2 NK richtig** | A4 (CO2 am Objekt oder Sperre im MFH), A5, A6, B5 (Demo-Reset, Migration im SQL-Editor), B6, C22, C25 | `lib/nk.ts`, `lib/nkObjekt.ts`, `lib/co2.ts`, Migration Reset | Demo Dresden, MFH-CO2, Personen, HKVO; SQL-Probe nach dem Reset |
| **P3 Kündigung und Mieterhöhung** | A7, A8, B40, B42, B44 (weitere Vertragspartner), Liste der Schriftform-Arten | `lib/dokumentVorlagen.ts`, `DocGenerator.tsx`, `BriefVersand.tsx`, `erzeugen.ts`, Mieterformular | Pflichtplatzhalter, Fristrechnung, Versand gesperrt; Anwaltsfragen 3–6 vorher stellen |
| **P4 Weitere Dokumente** | B38, B39, B41, B43, C43, C44, C45, C46 | Vorlagen, `nkPdf.ts`, `zustellung.ts`, `kaeuferPdf.ts`, `/vorlagen` | PDF-Golden-Tests je Art |
| **P5 Demo-Sicherheit** | B52 (`signOut` local), B53 (RPC), B54, B55, B56, C53, Bekannt B26/C22 | `DemoSperre`, `AutoLogout`, signout-Route, RPC-Migration, `DemoNurLesen`, Layout | Struktur-Test `signOut`; anon-RPC mit Demo-Token; Komponenten-Tests |
| **P6 Kredite mit Zeit** | B3 (Jahresbericht), B17, B18, B19, B20, B21, B22, B23, C7; Zusammenführungen 6, 7, 12 | `lib/kredit.ts` neu, Leser, `KrediteListe.tsx`, `lib/fristen.ts`, Actions | Bank-Tilgungsplan als Referenzfall |
| **P7 Mietkonto und Fristen** | B7, B8, B9, B10, B11, B12, B13, B14, B15, B16, C26, C27, C40, C42; Zusammenführung 10 | `lib/mietkonto.ts`, `lib/mietStatus.ts` neu, `lib/heute.ts`, `lib/fristen.ts`, `lib/kontoauszug.ts` | Fälligkeitskalender, vier Zeitzonen, Minderung |
| **P8 Portfolio-Kennzahlen** | B24, B25, B26, B28, C15, C16, C17, B27 (Demo-Daten, SQL-Editor); Zusammenführungen 1–5 | Dashboard, Objektseite, Liste, Jahresbericht, Reset | Σ Objekte = Dashboard, Kachel = Kurve, Stichtag-Wächter |
| **P9 BuyImmo** | B29, B30, B31, B32, B33, B34, B35, B36, B37, C10, C28–C33; Zusammenführung 11 | `lib/strategie.ts`, Vergleich, Machbarkeit, Bundesland-Komponente, ImmoWertV-Tabelle, Förderung, Sanierungseingabe | Referenzfälle BuyImmo, Wortlisten-Test § 34i |
| **P10 Ratgeber und Werbung** | B46–B51, C34–C39, C41; Werbe-Wächter | `lib/ratgeber.ts`, `lib/funktionen.ts`, `components/landing/data.tsx`, `lib/termine.ts` | Werbe-Wächter-Test, Normzitate-Liste |
| **P11 Bewerbung/DSGVO** | B45 (nach Anwaltsfrage 10) | `lib/bewerbungsDokumente.ts`, `BewerbungForm.tsx`, `bewerber.ts` | Negativliste |
| **P12 Darstellung und Bedienung** | B57, B58, B59, B60, C1–C6, C8, C9, C11–C14, C47–C52, C54–C61; Bekannt B34 | CSS, Komponenten, `error.tsx`, Nav | Designscan-Regeln (Tippziele, Kontrast, Sticky), Komponenten-Tests |
| **P13 Werkzeug** | Crawler-Sperrliste, Streaming-Marker im Rauchtest, `pruefe.mjs` mit `behavior: "instant"`, Inventar-Test (jede Seite hat einen Einstieg) | `scripts/`, `tests/` | — |

Für P1–P4 gilt: erst die Rechen- und Formfehler beheben, Werbetexte im selben PR anpassen, die Anwaltsfragen aus
Abschnitt 10 vor dem öffentlichen Start klären. P2 und P8 enthalten Migrationen, die laut CLAUDE.md wegen
`delete` bzw. Kaskaden im SQL-Editor auszuführen sind.
