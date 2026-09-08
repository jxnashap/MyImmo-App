# Anwaltliche Anfrage: Steuerberatungsgesetz (StBerG) — Punkt A2 der Start-Checkliste

**Stand:** 08.09.2026 · **Status:** Anfrage fertig, Antwort offen · **Wer:** Betreiber → Rechtsanwalt (Steuerrecht/Berufsrecht)

> Dieses Dokument ist das, was MyImmo zur Frage beitragen kann: eine vollständige,
> ehrliche Beschreibung dessen, was die Software tut, welcher Wortlaut am Bildschirm
> steht, und die drei Fragen, auf die es ankommt. **Die Antwort kann nur der Anwalt
> geben.** Bis sie vorliegt, bleibt A2 offen — und A2 ist der Punkt, an dem ein
> Kernfeature fallen könnte, nicht ein Formfehler.

---

## 1. Warum die Frage überhaupt

MyImmo rechnet aus den Buchungen des Vermieters Zahlen, die in seiner Steuererklärung
landen. § 1 StBerG unterstellt die „geschäftsmäßige Hilfeleistung in Steuersachen" einem
Vorbehalt; §§ 3–4 nennen, wer sie leisten darf; § 5 verbietet sie allen anderen; § 6
nimmt bestimmte Tätigkeiten aus (u. a. Nr. 3 und Nr. 4). Die Frage ist, ob eine Software,
die **ohne menschliche Beurteilung des Einzelfalls** rechnet, überhaupt „Hilfeleistung"
des Anbieters ist — und wo die Grenze liegt, wenn die Software Wahlrechte darstellt.

MyImmo ist ein Einzelunternehmen ohne steuerberatende Befugnis. Es gibt keine
Beratung durch Menschen, keinen Chat mit Steuerbezug, keine individuelle Auskunft.

## 2. Was die Software genau tut — die vier betroffenen Funktionen

### 2.1 Anlage-V-Aufstellung (`/steuer`, PDF unter `/api/berichte/anlage-v`)
- Summiert je Kalenderjahr die vom Nutzer selbst erfassten Einnahmen (Miete, Nebenkosten,
  Umlagen) und Werbungskosten (Kategorien wie Hausgeld, Reparatur, Versicherung, Zinsen).
- Berechnet die **AfA** nach § 7 Abs. 4 EStG aus Kaufpreis, Gebäudeanteil und Baujahr
  (2 % / 2,5 % / 3 %), der Gebäudeanteil ist ein Nutzer-Eingabefeld mit Vorbelegung.
- Ordnet die Summen den **Zeilen der Anlage V** zu (Zeilennummern des amtlichen Formulars)
  und stellt sie als Tabelle dar.
- Es wird **nichts übermittelt** (kein ELSTER, keine Schnittstelle). Der Nutzer tippt
  die Zahlen selbst ab. Eine „ELSTER-Hilfe" zeigt nur, welche MyImmo-Zeile welcher
  ELSTER-Zeile entspricht.
- Wortlaut am Bildschirm: *„Hinweis: Diese Aufstellung ist eine Hilfestellung zur Anlage V
  und ersetzt keine Steuerberatung."* und *„Übertragungshilfe, keine Steuerberatung und
  keine amtliche Übermittlung."*

### 2.2 AfA-Assistent (`/afa-assistent`)
Vier Rechenblöcke, alle mit vom Nutzer eingegebenen Werten:
1. **AfA-Satz** nach Fertigstellungsjahr (§ 7 Abs. 4 EStG).
2. **Degressiv vs. linear** (§ 7 Abs. 5a EStG, Neubauten ab 10/2023): Beide Verläufe
   werden nebeneinander gerechnet und angezeigt. **Bewusst keine Empfehlung** — im Code
   steht dazu: *„§ 5 StBerG: rechnen und vergleichen ist erlaubt, empfehlen nicht.
   Deshalb Rechenbeispiel statt ‚Empfehlung' — die Entscheidung trifft der Nutzer."*
3. **§ 7b EStG** (Sonder-AfA Mietwohnungsneubau): Prüfung der Tatbestandsmerkmale
   (Baukostenobergrenze, Effizienzstandard, Bauantragsfenster) als Ja/Nein-Anzeige.
4. **§ 82b EStDV** — Verteilung größeren Erhaltungsaufwands auf 2–5 Jahre: Zeigt den
   Jahresbetrag je gewählter Laufzeit und, wenn der Nutzer einen Grenzsteuersatz eingibt,
   die rechnerische Steuerwirkung. **Die Laufzeit wählt der Nutzer** über ein Auswahlfeld.
   Dieser Block wurde in älteren Notizen „Optimierer" genannt; er optimiert nichts
   automatisch, sondern rechnet die vom Nutzer gewählte Variante.

### 2.3 DATEV-Export (`/api/export/datev`)
- Erzeugt aus den Buchungen eine **EXTF-Datei** (DATEV-Buchungsstapel) mit einer
  **festen SKR03-Standardzuordnung** (Kategorie → Konto), zur Übergabe an die Kanzlei.
- Wortlaut im Code: *„Kontenrahmen = SKR03-Standardvorlage (Kanzlei passt an) …
  Steuerkanzlei, die den Kontenrahmen final zuordnet. Keine Steuerberatung."*
- Der Export ist ein Datenformat, keine Buchführung im Sinne des § 6 Nr. 4 StBerG —
  MyImmo bucht nichts, es exportiert, was der Nutzer erfasst hat.

### 2.4 Kleinere Rechenhilfen mit Steuerbezug
- **Anschaffungsnaher Aufwand** (§ 6 Abs. 1 Nr. 1a EStG): Wächter, der die 15-%-Grenze
  in den ersten drei Jahren mitzählt und **warnt**, wenn sie überschritten wird.
- **Verbilligte Vermietung** (§ 21 Abs. 2 EStG): Ampel 66 % / 50 % der ortsüblichen Miete
  aus Nutzereingaben.
- **Verkaufsrechner**: Spekulationsfrist (§ 23 EStG) als Datumsvergleich.
- Alle mit dem Hinweis *„Näherung, keine Steuerberatung"* bzw. *„Orientierungswerte ohne
  Gewähr und ersetzen keine Steuerberatung"*.

## 3. Was die Software NICHT tut
- Keine Übermittlung an Finanzbehörden.
- Keine Beantwortung individueller Fragen (kein Chat, keine E-Mail-Auskunft mit Steuerbezug).
- Keine Empfehlung zwischen Wahlrechten (degressiv/linear, § 82b-Laufzeit): Anzeige
  beider Rechenwege, Wahl beim Nutzer.
- Keine Prüfung, ob die Eingaben des Nutzers steuerlich zutreffen (z. B. ob eine
  Ausgabe wirklich Werbungskosten ist). Die Kategorien sind Nutzerwahl.
- Der KI-Einsatz (Anthropic) beschränkt sich auf das **Auslesen von Dokumenten**
  (Nebenkostenabrechnung, Exposé) — keine KI-Antworten zu Steuerfragen.

## 4. Die drei Fragen an den Anwalt

1. **Ist das Bereitstellen dieser Rechenfunktionen „geschäftsmäßige Hilfeleistung in
   Steuersachen" i. S. d. § 1 StBerG durch MyImmo** — oder ist es das Bereitstellen eines
   Werkzeugs, mit dem der Nutzer sich selbst hilft? Welche Rolle spielt, dass alle
   Eingaben vom Nutzer stammen und keine Einzelfallbeurteilung durch den Anbieter
   stattfindet?
2. **Wo liegt die Grenze bei Wahlrechten?** Reicht es, beide Varianten (degressiv/linear,
   § 82b 2–5 Jahre) mit Zahlen nebeneinanderzustellen, oder ist schon die Darstellung
   der Steuerwirkung („bei 42 % Grenzsteuersatz sparst du X") eine Empfehlung? Muss der
   Grenzsteuersatz-Block entfallen?
3. **Sind die Hinweistexte ausreichend und richtig platziert** („Hilfestellung, ersetzt
   keine Steuerberatung")? Braucht es einen einmal zu bestätigenden Hinweis beim ersten
   Aufruf von `/steuer`, einen Passus in den AGB, beides — oder ändert der Hinweis an der
   rechtlichen Einordnung nichts?

Zusatzfrage, falls die Antwort auf 1 „ja" lautet: Welche der vier Funktionen (2.1–2.4)
wären einzeln haltbar, welche nicht — damit die Entscheidung nicht „alles oder nichts" ist.

## 5. Was der Anwalt zum Nachsehen braucht
- Demo-Zugang: https://www.myimmoapp.de/api/demo (Nur-Lese-Konto mit Beispieldaten;
  `/steuer`, `/afa-assistent`, `/jahresbericht` sind dort erreichbar).
- Quelltext der Rechenlogik (rein, ohne Oberfläche): `lib/anlageV.ts`, `lib/steuer/afa.ts`,
  `lib/datev.ts`, `lib/verkauf.ts`.
- Bildschirm-Wortlaute: `components/AnlageVExport.tsx`, `components/ElsterHilfe.tsx`,
  `components/kalkulator/AfaAssistent.tsx`, `components/AnschaffungsnahWaechter.tsx`,
  `components/VerbilligtAmpel.tsx`.
- Gewerbeanmeldung (SaaS/digitale Dienstleistungen) — liegt beim Betreiber.

## 6. Was MyImmo bis zur Antwort tut — und was nicht
- **Bleibt:** alle vier Funktionen, unverändert. Sie sind seit Monaten live; ein
  vorsorgliches Abschalten ohne Befund wäre eine Entscheidung ohne Grundlage.
- **Bleibt:** kein Ausbau in Richtung Empfehlung, kein Steuer-Chat, keine Übermittlung.
- **Nicht ohne Antwort:** Bezahlung für den Tarif „Steuer" verlangen (Feature `steuer`
  in `lib/plan.ts`, ab Tarif Privat). Geld für eine Funktion zu nehmen, deren
  Zulässigkeit offen ist, verschärft die Lage — deshalb steht A2 vor dem Billing-Schalter.

## 7. Verwandte offene Punkte auf derselben Anwaltsliste
- **§ 34i GewO** (Finanzierungs-Assistent, Punkt A3) — Wording bereits neutralisiert.
- **AGB / Widerruf / AVV für Nutzer** (Punkt A1).
- Die Frage der namentlichen Autorenschaft der Ratgeber (zurückgestellt, `CLAUDE.md`).
