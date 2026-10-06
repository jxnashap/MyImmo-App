# Sanierungs-Guide (BuyImmo) — Plan

> **Stand 06.10.2026 · Status: Stufe A (Preiskatalog), B (Guide, Übersicht, Ergebnis) und C (Speichern, Vorlagen — Abschnitt 12) gebaut. C wirkt erst, wenn Jonas `supabase/migrations/20261006050000_sanierungsprojekte.sql` im SQL-Editor ausgeführt hat.** Auftrag von Jonas (wörtlich im
> Memory-Repo, `02 - MyImmo/myimmoideen.md`): ein geführter Ablauf, „Mischung Sanierungsrechner
> und Kauf-Assistent“ — Name, Adresse, Seite für Seite immer detaillierter; als Vorlage
> speicherbar; zusätzlich als Übersicht zum Ausfüllen; beim Wiedereinstieg nur die Seiten, auf
> denen noch etwas fehlt („auch wenn nur eine Zahl fehlt“). Ergebnis: Kostenaufstellung und
> Einkaufszettel, verbunden mit dem Kauf-Assistenten zu einer Gesamtauswertung, später gegen die
> Strategie abgeglichen. Unterscheidung „kostengünstig“ vs. „möglichst langlebig“.
>
> Grundlage: Sanierungsrechner Stufe 1 (`/sanierung`, `lib/sanierung/`, App-PR #418) —
> 10 Maßnahmen, 13 Materialien mit Quelle, Arbeitszeit mit Eigenleistung, Förderung, Übergabe an
> den Kauf-Assistenten. Der Entwurf liegt dort nur im Browser.

## 0. Entscheidungen (Jonas, 05.10.2026)

1. **Speichern und Vorlagen kommen**, aber erst nach dem Merge von #418. Die Tabelle legt Jonas
   im SQL-Editor an (Migration mit `on delete` läuft nicht über `apply_migration`).
2. **Fachbetrieb-Posten werden mitgerechnet, nicht ausgelassen** — auch ohne neutrale Quelle.
   Weg: Zustand wählen → Arbeiten ankreuzen → Kosten je Arbeit × Menge → der Nutzer kann den Wert
   ändern → zählt in die Endrechnung. (Risiken dazu: Abschnitt 1, Zeile 1; Umsetzung: Abschnitt 2a.)
3. **Erst Wohnungen** (Innenausbau); das Haus mit Gebäudehülle später.
4. **Handwerkerpreise auch für Maler, Boden, Fliesen**, wenn der Nutzer dort „Handwerker“ wählt:
   Preis je m² aus Quellen, überschreibbar — wie bei den Fachbetrieb-Posten. **Eigenleistung bleibt
   Stunden × eigener Satz.** Ändert die frühere Regel „BuyImmo schätzt keinen Lohn“ (BUYIMMO.md)
   für den Handwerker-Fall.
5. **Gekauftes Objekt nach MyImmo übernehmen** (Idee 05.10.2026, Abschnitt 11). Rückfrage
   „gekauft oder verkauft?“ beantwortet: **gekauft** („Gekaufte können übernommen werden“, Jonas
   05.10.2026).

## 1. Risiken zuerst

| # | Risiko | Was daraus folgt |
|---|---|---|
| 1 | **Fachbetrieb-Kosten ohne neutrale Quelle.** Strom-, Gas- und Trinkwasseranlagen darf nur ein eingetragener Installationsbetrieb errichten oder wesentlich ändern (Abschnitt 3) — dort gibt es keinen Einkaufszettel, sondern Kosten. Für Elektrik und Bad komplett gibt es nur Handwerker-/Vermittlungsportale als Quelle; deren Verzerrung (Richtung und Größe) ist unbekannt. Elektrik und Bad sind zugleich die größten Posten — eine falsche Spanne verschiebt Finanzierung und Rendite. | Entschieden: **mitrechnen** (Abschnitt 0). Gegenmittel: je Arbeit mindestens zwei Quellen, Spanne statt Zahl, Quelle + Stand sichtbar, jede Zeile überschreibbar, Zeile heißt „geschätzt — Angebot einholen“ (Anschluss an die Handwerker-Anfragen), und das Ergebnis nennt, **wie viel Prozent der Summe auf Portalpreisen beruht**. Prüfzyklus je Zeile. |
| 2 | **Preispflege wächst mit.** Heute 13 Materialien; mit zwei Qualitätsstufen und den Stufe-1-Gewerken grob geschätzt das Vier- bis Sechsfache. Jeder Preis altert. | Je Material eine **Spanne aus zwei Quellen** statt einzelner Produkte; Prüfung quartalsweise in `07 Volatile Kennzahlen`; jeder Preis vom Nutzer überschreibbar (gibt es schon). |
| 3 | **Scheingenauigkeit.** Je mehr Seiten, desto genauer *wirkt* das Ergebnis. | Ergebnis bleibt von–bis, mit eigener Zeile **Puffer für Unvorhergesehenes**; jede Annahme steht im Ergebnis, bis der Nutzer sie ersetzt. „Schätzung, kein Kostenvoranschlag“ bleibt. |
| 4 | **Asbest beim Rausreißen — und beim Drüberlegen.** In Gebäuden vor dem 31.10.1993 ist mit Asbest zu rechnen (Floor-Flex-Platten, Cushion-Vinyl, Bitumenkleber, Fliesenkleber, Spachtel). **Asbesthaltige Bodenbeläge fest zu überdecken ist auch privat verboten** (§ 11 Abs. 3 + 7 GefStoffV) — „Laminat drüber“ ist dann keine Lösung. | Baujahr wird früh abgefragt. Bei Baujahr vor 1993 und Altbelag „PVC/Platten“ oder „weiß nicht“: Rückbau als **Fachbetrieb mit Hinweis**, kein Überlegen vorgeschlagen, Hinweis auf die Informationspflicht gegenüber Handwerkern (§ 5a GefStoffV, Baujahr reicht). |
| 5 | **„Nur fehlende Seiten“ kann endlos nerven.** Ohne Unterschied Pflicht/optional und ohne „weiß ich nicht“ kommt der Nutzer nie zum Ergebnis. | Jede Seite erklärt ihre Pflichtfelder. Jedes Pflichtfeld kennt drei Zustände: leer · Wert · **„weiß ich nicht → Annahme“**. Eine Annahme macht die Seite *fertig*, steht aber im Ergebnis. |
| 6 | **Speichern und Vorlagen brauchen die Datenbank.** Typisch: Besichtigung am Handy, Auswertung am Rechner — Browser-Speicher reicht nicht. | Neue Tabelle → Migration, Zeile in `delete_own_account()`, Demo-Trigger + Policies, RLS. Eine Migration mit `on delete` läuft über den SQL-Editor des Betreibers. |
| 7 | **Strategie-Abgleich ist die § 34i-Grenze.** „Passt zu deiner Strategie → kaufen“ ist eine Empfehlung. | Abgleich nur gegen **eigene Kriterien des Nutzers** (z. B. „höchstens 60.000 € Eigenkapital“, „mindestens 4 % Rendite“) als erfüllt/nicht erfüllt. Kein Urteil über den Kauf. Vor dem Bau: Frage an den Anwalt (steht auf der Liste). |
| 8 | **Zwei Oberflächen (Guide + Übersicht) laufen auseinander**, wenn jede ihre eigenen Felder hat. | EIN Datenmodell, EINE Lückenfunktion, ZWEI Darstellungen — wie beim Mieterportal (`ladePortalDaten` + `PortalAnsicht`). |
| 9 | **Eigentumswohnung: Vieles gehört der Gemeinschaft.** Teile, die für Bestand oder Sicherheit des Gebäudes nötig sind, und gemeinschaftliche Anlagen sind kein Sondereigentum (§ 5 Abs. 2 WEG); Außenfenster sind nach BGH zwingend Gemeinschaftseigentum. Wer dort eigenmächtig instand setzt, bekommt die Kosten nachträglich nicht erstattet (BGH V ZR 254/17). Ein Guide, der bei einer ETW „Fenster tauschen“ als Kosten des Käufers rechnet, rechnet falsch — und übersieht das eigentliche Risiko: eine **Sonderumlage**. | Bei „Eigentumswohnung“ werden Fenster, Strangleitungen, zentrale Heizung und Wohnungseingangstür (Außenseite) **nicht** als eigene Kosten gerechnet, sondern als Prüfpunkt „Gemeinschaft: Protokolle, Erhaltungsrücklage, geplante Sonderumlagen“ — mit Hinweis, dass die Teilungserklärung die Kosten anders verteilen kann. Rechtsrat wird das nicht (Regel wie bei der Vollmacht: „meist … nachsehen“). |

## 2. Maßnahmenkatalog — was macht eine Wohnung oder ein Haus fertig

**„Gängigste zuerst“ lässt sich nicht mit einer Statistik belegen** — eine repräsentative
Erhebung, welche Maßnahmen beim Kauf oder Mieterwechsel anfallen, wurde nicht gefunden (nur
nicht-repräsentative Umfragen: Houzz 2023, 654 Nutzer; Dr. Klein 2023, Institut ungenannt).
Die Reihenfolge folgt deshalb dem, was bei **fast jeder** Wohnung anfällt (Wände, Boden), vor
dem, was nur **manche** betrifft (Bad, Türen, Technik) — und innerhalb davon der Abfolge auf der
Baustelle.

Legende: ✅ im Rechner gebaut · ➕ neu · 🔧 Fachbetrieb (kein Einkaufszettel)

### Stufe 1 — Wohnung, Innenausbau

| Gewerk | Maßnahmen | Wer | Mengenbasis | Material (Einkaufszettel) |
|---|---|---|---|---|
| Vorbereitung | ➕ Abdecken, Abkleben | selbst | Bodenfläche | Abdeckvlies/-folie, Malerkrepp |
| Rückbau | ➕ Tapete entfernen · ➕ Altbelag entfernen · ➕ Altfliesen abschlagen | selbst; **vor 1993 mit Verdacht 🔧** (Risiko 4) | Wand-/Bodenfläche | Tapetenlöser, Schaber |
| Wände & Decken | ✅ spachteln · ✅ grundieren · ✅ Raufaser · ✅ streichen · ➕ Vliestapete | selbst | Wand-/Deckenfläche | ✅ vorhanden |
| Boden | ➕ Ausgleichsmasse · ✅ Laminat · ✅ Vinyl · ➕ Fertigparkett · ➕ Parkett schleifen + versiegeln · ✅ Sockelleisten | selbst (Schleifmaschine leihen) | Bodenfläche, Umfang | ✅ + Ausgleichsmasse, Parkett, Lack/Öl |
| Bad (Fliesen) | ✅ Boden- und Wandfliesen · ➕ **Abdichtung in Dusche und über der Wanne** | selbst möglich | Fliesenflächen, Duschfläche | ✅ + Dichtschlämme, Dichtband, Ecken |
| Türen | ➕ Innentür komplett (Zarge + Blatt + Drücker) · ➕ nur Türblatt · ➕ lackieren | selbst möglich | Stückzahl, Maß | Tür-Set, Montageschaum, Drücker |
| Sanitär-Objekte | ➕ WC, Waschtisch, Armatur tauschen **an vorhandenen Anschlüssen** | selbst möglich (keine „wesentliche Veränderung“ — Lesart des Wortlauts, Abschnitt 3) | Stückzahl | Objekte, Eckventile, Silikon |
| Kleinelektrik | ➕ Schalter, Steckdosen, Leuchten | Voreinstellung 🔧 (Abschnitt 3: Instandhaltung ist nach NAV ausgenommen — trotzdem Strom) | Stückzahl | — |
| Sicherheit | ➕ **Rauchwarnmelder** (Pflicht in allen Ländern) | selbst | Schlafräume, Kinderzimmer, Flure als Rettungsweg (Berlin/Brandenburg: alle Aufenthaltsräume außer Küche) | Melder |
| Entsorgung | ➕ Container / Sperrmüll / Wertstoffhof | — | aus dem Rückbau → m³ | Richtwert je m³ (Quelle offen) |
| Abschluss | ➕ Grundreinigung | selbst | Wohnfläche | Reiniger |
| — | ➕ **Puffer für Unvorhergesehenes** | — | % der Summe | — |

### Stufe 2 — Fachbetrieb: der Zustand-Baukasten (Entscheidung 2)

Je Gewerk wählt der Nutzer einen **Zustand** anhand von Anzeichen, die man bei der Besichtigung
**sehen** kann (keine Diagnose — die macht der Fachbetrieb). Der Zustand **kreuzt Arbeiten vor**;
der Nutzer kann an- und abwählen. Jede Arbeit = Menge × Einheitspreis-Spanne → Kostenzeile.

| Gewerk | Anzeichen (sichtbar) | gut → vorgekreuzt | mittel → vorgekreuzt | schlecht → vorgekreuzt | Menge aus |
|---|---|---|---|---|---|
| Elektrik | Sicherungsautomaten oder Schraubsicherungen? FI-Schalter mit Prüftaste „T“ da? Steckdosen mit Schutzkontakt (Metallbügel)? Wenige Steckdosen, überall Mehrfachstecker? | nichts | FI nachrüsten · Schalter/Steckdosen tauschen · E-Check | Elektrik komplett erneuern (enthält laut Quelle den Sicherungskasten — Unterverteilung nicht zusätzlich) | Stückzahlen je Raum (Seite 9) bzw. Wohnfläche |
| Bad | Fliesen gerissen/hohl? Schimmel in Fugen? Braunes Wasser beim ersten Aufdrehen? Wanne/WC sehr alt? | nichts | WC, Waschtisch, Armaturen tauschen · Silikon | Bad komplett (inkl. Leitungen) · ggf. Wanne → Dusche | Badfläche (Seite 7), Stückzahl |
| Heizung (Wohnung) | Heizkörper alt/rostig? Thermostatköpfe fehlen? Etagenheizung — Alter laut Typenschild | nichts | Thermostatventile tauschen | Heizkörper tauschen · Heizungstausch (✅ Förderung) | Heizkörper je Raum |
| Fenster | Einfachverglasung? Verzogen, zieht? | nichts | Beschläge/Dichtungen | Fenster tauschen (✅ Förderung) | Fenster je Raum (Seite 7) |
| Türen | Türblätter beschädigt, Zargen schief? | nichts | lackieren | Innentür komplett | Türen je Raum |
| Küche | — (Wahl statt Zustand) | übernehmen | Fronten/Arbeitsplatte | neue Küche | laufende Meter |

**Bei Eigentumswohnung** (Risiko 9): Fenster, Strangleitungen, zentrale Heizung und Wohnungs-
eingangstür (außen) werden nicht als eigene Kosten gerechnet, sondern als Prüfpunkt der
Gemeinschaft.

**Mengen, die der Nutzer nicht weiß** (z. B. Steckdosen je Raum): Annahme je Raumtyp, im Ergebnis
als Annahme markiert — Seite bleibt „fertig“ (Risiko 5).

### 2a. Jede Kostenzeile weiß, woher sie kommt

| Feld | Bedeutung |
|---|---|
| Gewerk, Arbeit, Menge, Einheit | z. B. Elektrik · Steckdose tauschen · 14 · Stück |
| Preis von–bis | Einheitspreis-Spanne |
| **Herkunft** | `baumarkt` (Material, belegt) · `neutral` (Verbraucherzentrale, co2online, IWU …) · `portal` (Handwerker-/Vermittlungsportal) · `nutzer` (überschrieben) |
| Quelle, Stand | URL + Datum, sichtbar per Klick |
| überschrieben | fester Wert des Nutzers — ersetzt die Spanne, Herkunft wird `nutzer` |

Ergebnis: Summe von–bis über alle Zeilen; darunter **„davon geschätzt aus Portalpreisen: X %“**.
Fachbetrieb-Zeilen tragen „Angebot einholen“ (Link in die Handwerker-Anfragen).
**Einheitspreise — gebaut 05.10.2026 in `lib/sanierung/arbeiten.ts`** (Stufe A, 28 Arbeiten:
Elektrik, Bad, Heizung, Fenster, Türen, Küche, Maler, Boden, Fliesen, Entsorgung). Die Werte stehen
**nur dort** (je Quelle mit wörtlichem Zitat, URL, Stand, brutto/netto), nicht hier — sonst laufen
zwei Listen auseinander. `tests/sanierungArbeiten.test.ts` prüft, dass jede Zahl wörtlich in ihrem
Zitat steht (oder die Umrechnung benannt ist), dass jede Arbeit zwei unabhängige Quellen hat (oder
eine begründete Einzelquelle) und dass die Spanne alle Quellen umfasst; 18 Mutationen rot.
**Beste Quelle: BKI-Mittelwerte über schwaebisch-hall.de** (netto, „statistische Mittelwerte aus
ausgeschriebenen und abgerechneten Projekten“; für Einzelaufträge laut Fußnote eher mehr) — Maler,
Böden, Bad-Objekte, Fliesen-Abbruch.
**Beim Nachprüfen gefunden:** Die Zusammenfassung der Recherche lag mehrfach daneben —
„Fliesen-Demontage 350 €/m²“ (Seite: 65), „Abdichtung 16–45 €/m²“ (Seite: 25–45), „Laminat verlegen
20–45 € (Sanier.de)“ (auf der Seite nicht zu finden). Deshalb Regel 1 unten.
**Bewusst noch nicht im Katalog** (nur eine bestätigte Quelle): Wohnungseingangstür (bei ETW meist
Gemeinschaft), Abdichtung als Einzelposten, Thermostatventile, Trinkwasserleitungen je m².

**Regeln, die daraus folgen:**
1. **Kein Wert ungesehen in den Katalog.** Die Recherche lief über eine Zusammenfassung; eine Zahl
   war falsch gelesen (Fliesen-Demontage 350 statt 65 €/m²). Jede Zahl beim Eintragen auf der Seite
   selbst nachsehen.
2. **Abschreiber zählen als eine Quelle.** Wortgleiche Spannen zweier Portale sind keine Bestätigung.
3. **Alles in brutto.** Wer privat kauft, zahlt Umsatzsteuer. Netto-Angaben × 1,19 und in der Quelle
   vermerken; Angaben ohne brutto/netto als solche kennzeichnen.
4. **Ausreißer nicht mitteln**, sondern weglassen und begründen (z. B. Unterverteilung 4.000–5.000 €).
5. **Fortschreiben über den Destatis-Baupreisindex** (Instandhaltung Wohngebäude, Mai 2026 +5,6 % zum
   Vorjahr; ab KW 43/2026 nur noch über GENESIS-Online), Prüfzyklus halbjährlich.
6. **Region:** Portale nennen ±15–25 % (Großstadt teurer). Erst einmal nur als Hinweis an der
   Spanne, kein Regler — ein Regionalfaktor wäre eine weitere unbelegte Zahl.
7. **Stundensätze** (2026, Portale): Elektro ~50–85 € netto, SHK ~55–90 € netto (Fachverband SHK NRW
   Vollkostensatz 102,91 € netto), Maler/Fliesen/Boden ~40–75 € netto — nur als Hilfe beim Prüfen
   eines Angebots, nicht zur Berechnung (die läuft über Einheitspreise).

**Neutraler Baustein für die Zustandsskala:** ImmoWertV Anlage 2 (Modernisierungs-Punkteraster:
Bad, Leitungen, Heizung, Innenausbau, Fenster je bis zu 2 Punkte; „nicht modernisiert“ bis
„umfassend modernisiert“) — ohne Euro, aber eine amtliche Skala für „Zustand“.
**Neutrale €/m²-Richtwerte für den Innenausbau gibt es nicht frei** (Verbraucherzentrale, test.de,
co2online, BBSR, Destatis durchsucht); BKI wäre die belastbare Quelle, ist aber kostenpflichtig —
Lizenz für die Nutzung in einer App wäre vor einem Kauf zu prüfen.
Bestehende neutrale Werte: Heizungstausch (Verbraucherzentrale 2026: Luft-Wasser-Wärmepumpe Ø 36.000 €,
Gas 16.000 €, Elektrodirekt 11.000 €, inkl. Entsorgung + Anschluss, ohne neue Leitungen/Heizflächen) ·
Fenster (co2online 23.03.2026: 500–1.500 € je Standardfenster inkl. Einbau).

### Stufe 3 — Haus (später, Entscheidung 3)

| Gewerk | Hinweis |
|---|---|
| 🔧 Dach, Fassade/Dämmung, Keller, Außenanlagen | große Posten; Richtwerte erst mit Quelle |
| ➕ **Pflichten nach dem Kauf (GModG)** | **Oberste Geschossdecke dämmen** (§ 35 GModG, U-Wert ≤ 0,24) und **ungedämmte, zugängliche Heizungs-/Warmwasserleitungen in unbeheizten Räumen dämmen** (§ 69 GModG). Beim Haus mit höchstens zwei Wohnungen, das der Vorbesitzer am 01.02.2002 selbst bewohnt hat: **Frist zwei Jahre ab Eigentumsübergang**. Als **Pflicht-Posten mit Frist** in den Guide, nicht als Wahl. Ausnahme (§ 35 Abs. 4) bei Unwirtschaftlichkeit nur nennen, nicht prüfen. **Die 30-Jahre-Austauschpflicht für alte Kessel gibt es nicht mehr** (§ 72 GModG „weggefallen“). |

## 3. Belegte Fakten (abgerufen 05.10.2026)

| Fakt | Kernsatz / Wert | Quelle |
|---|---|---|
| **GEG heißt jetzt GModG** — Gebäudemodernisierungsgesetz, in Kraft 29.07.2026 (G v. 23.07.2026, BGBl. 2026 I Nr. 226) | Titel auf gesetze-im-internet.de: „Gebäudemodernisierungsgesetz - GModG“; § 72: „(weggefallen)“ | gesetze-im-internet.de/geg/__35.html, __69.html, __72.html — **am Originaltext selbst nachgesehen** |
| Nachrüstung oberste Geschossdecke | § 35 Abs. 1 (U ≤ 0,24 W/m²K); Abs. 3: Frist „zwei Jahre ab dem ersten Eigentumsübergang“ | wie oben; BBSR gmodg.bund.de; Verbraucherzentrale 21.08.2026 |
| Energieausweis | § 79 Abs. 3 GModG: „Gültigkeitsdauer von zehn Jahren“ — inhaltlich wie bisher, **nur der Gesetzesname in der App ist veraltet** | gesetze-im-internet.de/geg/__79.html — selbst nachgesehen |
| Asbestverbot | „Seit 31. Oktober 1993 … verboten“ | Umweltbundesamt (Stand 30.07.2024) |
| Informationspflicht vor Arbeiten | § 5a GefStoffV (seit 05.12.2024): Veranlasser übergibt vorliegende Informationen; bei Baujahr vor 1993 reicht das Baujahr; gilt auch für private Haushalte (Abs. 4) | gesetze-im-internet.de/gefstoffv_2010/__5a.html; BG BAU |
| Überdeckungsverbot | § 11 Abs. 3 GefStoffV: „feste Überdeckung oder Überbauung … asbesthaltigen Bodenbelägen“ verboten; Abs. 7: gilt auch für private Haushalte | gesetze-im-internet.de/gefstoffv_2010/__11.html |
| Typische Asbest-Bauteile | Floor-Flex, Cushion-Vinyl, Bitumenkleber, Fliesenkleber, Putze, Spachtel, Kitt | Verbraucherzentrale (25.03.2025) |
| PAK-Parkettkleber | „ca. bis in die 1960er Jahre“, Entfernen durch Fachfirma | Verbraucherzentrale NRW (13.07.2025) |
| Strom | NAV § 13 Abs. 2: nur eingetragenes Installationsunternehmen; „gilt Satz 4 nicht für Instandhaltungsarbeiten“ (außer Hausanschluss bis Zähler) | gesetze-im-internet.de/nav/__13.html |
| Trinkwasser | AVBWasserV § 12 Abs. 2: „Errichtung der Anlage und wesentliche Veränderungen“ nur eingetragenes Unternehmen | gesetze-im-internet.de/avbwasserv/__12.html |
| Gas | NDAV § 13 Abs. 2: „Arbeiten an der Anlage“ nur eingetragene Unternehmen | gesetze-im-internet.de/ndav/__13.html |
| Rauchwarnmelder | Pflicht in allen 16 Ländern, auch im Bestand (letzte Frist Sachsen 31.12.2023); Räume je Land leicht verschieden | test.de (03.08.2023), ista — **Änderungen nach 2023 nicht geprüft** |
| Eigentumswohnung | § 5 Abs. 2 WEG: Teile, „die für dessen Bestand oder Sicherheit erforderlich sind, sowie Anlagen und Einrichtungen, die dem gemeinschaftlichen Gebrauch … dienen, sind nicht Gegenstand des Sondereigentums“; Außenfenster zwingend Gemeinschaftseigentum; eigenmächtige Instandsetzung am Gemeinschaftseigentum wird nicht erstattet (BGH 14.06.2019, V ZR 254/17); Kostenabwälzung per Teilungserklärung nur bei eindeutiger Regelung (BGH 02.03.2012, V ZR 174/11) | gesetze-im-internet.de/woeigg/__5.html — selbst nachgesehen; Urteile über haufe.de, wohnen-im-eigentum.de (Sekundärquellen, Urteilstexte nicht eingesehen) |
| Badabdichtung | DIN 18534: Wände in Duschen und über Wannen W1-I, bodengleiche Duschen W2-I (Beispiele der Ausgabe 2017); **Neuausgabe Oktober 2025**, deren Beispiele nicht eingesehen (Norm kostenpflichtig) | haustec, Forum Verlag, bauprofessor — **teilweise belegt**; Norm, kein Gesetz |

## 4. „Kostengünstig“ oder „langlebig“ — als Rechnung

Je Material zwei Stufen. **Vergleichsmaß: Kosten je Jahr Nutzung** = Preis ÷ Nutzungsdauer.
Nutzungsdauern aus der **BBSR-Tabelle „Nutzungsdauern von Bauteilen“** (Datei vom 13.03.2026,
Stand 04.11.2025, nachhaltigesbauen.de) — Beispiele:

| Bauteil | günstig | langlebig |
|---|---|---|
| Wandfarbe (Nassabriebklasse) | Klasse ≥ 3: 10 Jahre | Klasse 1: 20 Jahre |
| Tapete | — | überstreichbar: 25 Jahre (nicht überstreichbar 18) |
| Laminat (Wohnen, schwimmend) | NK 31: 15 Jahre | NK 32–33: 20 Jahre |
| Vinyl/PVC | CV-Belag geklebt: 10 Jahre | PVC heterogen 20 / homogen 25 Jahre |
| Parkett | Mehrschicht < 3,5 mm Nutzschicht: 45 Jahre | ≥ 50 Jahre; Versiegelung Lack 15 / Öl 7 Jahre |
| Teppich (Wohnen) | Nadelvlies/Tufting: 10 Jahre | Webware: 20 Jahre |
| Fliesen, Innentüren | ≥ 50 Jahre | — |

**Grenzen, offen anzusagen:** Die Werte sind Durchschnitte für Lebenszyklus-Rechnungen, keine
Herstellergarantie. Die Laminat-Zeilen kamen laut Änderungshistorie **vom Herstellerverband
(EPLF)**. Für WC, Waschtisch, Armaturen, Schalter und Steckdosen gibt es dort **keine** Werte —
dort keine Langlebigkeits-Zahl. Eine amtliche deutsche „Lebensdauertabelle“ fürs Mietrecht gibt
es nicht (die oft zitierte ist schweizerisch und kostenpflichtig).
Standard wählt der Nutzer einmal fürs Projekt, je Gewerk überschreibbar — **Voreinstellung mit
Begründung, keine Empfehlung**.

## 5. Datenbedarf — was der Guide fragen muss

„Pflicht“ = ohne das Feld (oder eine Annahme) ist die Seite nicht fertig.

| Seite | Felder | Pflicht | Wofür |
|---|---|---|---|
| 1 Projekt | Name | ja | Liste, Vorlage |
| 2 Objekt | Adresse **oder** Kaufprüfung **oder** Bestandsobjekt wählen | nein | Verknüpfung, Gesamtauswertung |
| 3 Eckdaten | Wohnung/Haus · **Eigentumswohnung ja/nein** · Baujahr · Wohnfläche · Zimmerzahl | ja (Baujahr: „weiß ich nicht“ → wie vor 1993 behandeln) | Grobschätzung, Asbest-, GModG-Hinweise |
| 4 Ziel | Vermieten/selbst nutzen · günstig/langlebig · Budget (optional) | ja | Voreinstellungen, Strategie |
| 5 Arbeit | selbst / Handwerker / gemischt · Stundensatz | ja | Lohn, Eigenleistung |
| 6 Räume | Typ + Anzahl (Wohnen, Schlafen, Kind, Küche, Bad, WC, Flur, Abstell) | ja | Räume anlegen, Maßnahmen vorbelegen, Rauchmelder zählen |
| 7 Maße je Raum | Länge, Breite, Höhe, Fenster/Türen (Anzahl statt m²) | ja (Annahme: Wohnfläche verteilt) | Flächen |
| 8 Maßnahmen je Raum | vorbelegt nach Raumtyp, abwählbar | ja | Mengen |
| 9 Ist-Zustand je Raum | Tapete drauf? Altbelag welcher Art? Fliesenhöhe? Türen/Steckdosen Anzahl | je nach Maßnahme | Rückbau, Asbest-Prüfung, Stückzahlen |
| 10 Zustand je Gewerk | Elektrik, Bad, Heizung, Fenster, Türen, Küche: Zustand nach Anzeichen → vorgekreuzte Arbeiten, an-/abwählbar | ja (Zustand oder „weiß ich nicht“ → mittel als Annahme) | Fachbetrieb-Kostenzeilen |
| 11 Gebäude (nur Haus) | oberste Geschossdecke gedämmt? Leitungen im Keller gedämmt? Dach, Fassade | bei Haus ja | GModG-Pflichten, Richtwerte |
| 12 Abschluss | Entsorgung (Vorschlag aus dem Rückbau), Puffer % | ja (Vorschlag übernehmbar) | Summe |
| 13 Förderung | ✅ vorhanden | nein | Zuschuss |

**„Immer detaillierter“ als Rechenprinzip:** Nach Seite 6 gibt es schon eine **Grobschätzung** —
derselbe Rechner, nur mit angenommenen Räumen (Wohnfläche auf die Zimmer verteilt,
Standardhöhe). Jede weitere Seite ersetzt Annahmen durch echte Werte; die Spanne wird enger.
Keine zweite Rechenregel, keine €/m²-Pauschale ohne Quelle.

## 6. Guide, Übersicht und Wiedereinstieg

- **Ein Entwurf** (Erweiterung von `Entwurf` in `lib/sanierung/eingabe.ts`), **eine reine
  Funktion** `offeneSeiten(entwurf)` → Seiten mit fehlenden Pflichtfeldern (je Seite und je Raum),
  testbar ohne Oberfläche.
- **Guide**: eine Seite je Bildschirm, Weiter/Zurück, Fortschritt oben. Wiedereinstieg → nur durch
  `offeneSeiten()`; ist nichts offen, direkt zum Ergebnis.
- **Übersicht**: alle Seiten als Abschnitte (wie der heutige Rechner), offene markiert; Klick auf
  „fehlt“ öffnet den Guide an genau dieser Stelle.
- `AblaufStepper` (Kauf-/Verkauf-Assistent) ist ein Akkordeon, kein Seiten-Guide —
  wiederverwendbar ist die Fortschrittsanzeige, nicht die Seitenlogik.

## 7. Vorlagen und Speichern

1. **Projekt speichern** (fortsetzen, auf anderem Gerät öffnen).
2. **Als Vorlage speichern** = Projekt ohne Adresse und Maße, nur Entscheidungen (z. B.
   „Mieterwechsel: Wände weiß, Vinyl, Rauchmelder, 10 % Puffer“). Neues Projekt aus Vorlage →
   der Guide fragt nur noch Maße und Ist-Zustand.
3. Mitgelieferte Vorlagen (Mieterwechsel · Bad neu · Altbau-Wohnung komplett) — als Code.
Datenbank: eigene Tabelle (Arbeitsname `sanierungsprojekte`: `user_id`, `name`, `art`
projekt/vorlage, `daten` jsonb, `kalk_id` optional → Kaufprüfung). Nicht in `kalkulationen`
mischen — jede Kaufprüfungs-Liste müsste sonst filtern.

## 8. Ergebnis

- **Kostenaufstellung** je Gewerk und Raum: Material von–bis · Handwerkerlohn · Eigenleistung
  (Stunden, kein Geld) · Fachbetrieb (Richtwert oder „Angebot einholen“) · Entsorgung · Puffer ·
  darunter Förderung (nicht abgezogen — wie heute) · Pflicht-Posten mit Frist (GModG, Rauchmelder).
- **Einkaufszettel** nach Baumarkt-Abteilung (Farbe · Boden · Fliesen · Sanitär · Kleinteile),
  ganze Gebinde, Preis, abhakbar, teilbar/druckbar; daneben **Werkzeug** (kaufen oder leihen).
- **Reihenfolge der Arbeiten**: Abdecken → Rückbau/Entsorgung → Fachbetrieb-Rohinstallation →
  Spachteln → Abdichten + Fliesen → Grundieren/Tapezieren/Streichen → Boden → Türen →
  Endmontage → Rauchmelder → Reinigung.

## 9. Gesamtauswertung mit dem Kauf-Assistenten

Projekt hängt an einer Kaufprüfung (`kalk_id`). Auswertung = Kaufpreis + Nebenkosten + Sanierung
(ohne Eigenleistung, mit Puffer) → Finanzierung, Rendite, 15-%-Grenze — **über die bestehenden
Funktionen** (BUYIMMO.md, Regel 3). Neu wäre nur „Miete nach Sanierung“ (Eingabe, keine Schätzung).

## 10. Strategie-Abgleich (später)

Eigene Kriterien des Nutzers (Eigenkapital-Obergrenze, Mindest-Cashflow, Mindestrendite,
Sanierungsbudget) → je Kriterium erfüllt/nicht erfüllt. Kein „kaufen“, kein Ranking als
Empfehlung. **Vor dem Bau: § 34i GewO beim Anwalt** (`STRATEGIE-REITER.md`).

## 11. Nach dem Kauf: Objekt nach MyImmo übernehmen

**Heute:** Fahrplan-Schritt „Übergabe“ führt auf ein **leeres** `/properties/new`, obwohl die
Kaufprüfung (`kalkulationen.data`) Adresse, Kaufpreis, Fläche, Baujahr, Kaltmiete, Hausgeld und
Objekttyp schon kennt.

**Plan:** Knopf „Gekauft — nach MyImmo übernehmen“ an einer Kaufprüfung (Kauf-Assistent,
Kommandozentrale, Fahrplan-Schritt 9) → öffnet das **vorausgefüllte** Objektformular, gespeichert
wird erst nach Bestätigung. Danach trägt die Kaufprüfung „übernommen → Objekt“ und wird nicht
ein zweites Mal angeboten; das Sanierungsprojekt hängt am Objekt.

| Aus der Kaufprüfung | ins Objekt | Hinweis |
|---|---|---|
| Adresse, Fläche, Baujahr, Hausgeld, Typ (Wohnung/Haus) | gleichnamige Felder | direkt |
| Kaufpreis | Kaufpreis | **Planwert** — „mit dem Kaufvertrag abgleichen“ |
| Kaltmiete | Miete | Planwert; Mieter danach anlegen (bei vermietet gekauft) |
| Marktwert-Schätzung | Aktueller Wert | nur, wenn vorhanden |
| — | **Kaufdatum** | **muss der Nutzer eintragen** (Spekulationsfrist, AfA-Beginn, 15-%-Frist) |
| Finanzierung (Darlehen, Zins, Rate) | Vorschlag „Kredit anlegen“ | Vorschlag ≠ echter Vertrag → eigener Schritt mit Bestätigung |
| Sanierung | Verknüpfung zum Projekt | Steuer-Wächter (15-%-Grenze, 3 Jahre ab Anschaffung) bekommt das Kaufdatum und sieht die Planung |

**Risiken:** (1) Planwerte werden still zu Ist-Werten → nie ohne Bestätigungsformular speichern,
Planwert-Felder markiert. (2) Doppelte Übernahme → Markierung an der Kaufprüfung, serverseitig
geprüft. (3) Alte Kaufprüfungen ohne einzelne Felder → nur übernehmen, was da ist.
**Datenbank:** Verknüpfung Kaufprüfung → Objekt (Spalte oder Feld). Kommt mit in **dieselbe**
SQL-Datei wie Speichern/Vorlagen (Stufe C), damit Jonas einmal im SQL-Editor ausführt.

**🐞 Nebenbefund dabei (vor dem Bau klären):** Die AfA rechnet mit **Kaufpreis × Gebäudeanteil**
(`lib/anlageV.ts`, `afaBasis`) — **ohne Kaufnebenkosten**. Grunderwerbsteuer, Notar, Grundbuch und
Makler gehören anteilig zur Bemessungsgrundlage (Sekundärquellen übereinstimmend; Steuerrecht →
StBerG-Grenze beachten). Das Formular fragt nur „Kaufpreis“; ob Nutzer dort den Preis mit oder ohne
Nebenkosten eintragen, ist unbekannt — eine Änderung der Rechnung könnte bei manchen **doppelt
zählen**. Vorschlag: eigenes, optionales Feld „Kaufnebenkosten“ (leer = wie bisher), die Übernahme
füllt es aus `kaufnebenkosten()` (`lib/kalk.ts`), der Steuer-Wächter weist hin, wenn es fehlt.

## 12. Bauplan in Stufen

| Stufe | Inhalt | Braucht |
|---|---|---|
| A | ✅ **gebaut 05.10.2026:** Einheitspreise (`lib/sanierung/arbeiten.ts`), Zustand-Baukasten (`zustand.ts`), Kostenzeilen mit Herkunft und Portal-Anteil (`kostenzeilen.ts`), BBSR-Nutzungsdauern (`nutzungsdauer.ts`), Prüfzyklus-Zeilen. **Offen in A:** zweite Qualitätsstufe je Baumarkt-Material (neue Preise nötig) | — |
| B | ✅ **gebaut 05.10.2026** — siehe „Stufe B: was gebaut ist“ unten | nichts in der DB (Browser-Entwurf wie heute) |
| C | ✅ **gebaut 06.10.2026** — siehe „Stufe C: was gebaut ist“ unten; **SQL führt Jonas im SQL-Editor aus** | Migration `20261006050000` (Kaskade auf `auth.users`, Demo-Sperre) |
| D | Gesamtauswertung mit Kaufprüfung (`kalk_id`) | Stufe C |
| E | Haus (Gebäudehülle, GModG-Pflichten als Posten mit Frist) | Entscheidung 3: später |
| F | Strategie-Abgleich | Anwalt (§ 34i) |

**Nebenbefund (gleiche Recherche):** Die App nennt „§ 79 GEG“ (Energieausweis-Frist,
`lib/fristen.ts`, `components/PropertyForm.tsx`, `lib/types.ts`) — inhaltlich richtig, Name
veraltet → „§ 79 GModG“.

### Stufe B: was gebaut ist (05.10.2026)

- **EIN Entwurf, drei Ansichten** (`/sanierung`): Schritt für Schritt · Übersicht · Ergebnis.
  `?ansicht=uebersicht|ergebnis` öffnet direkt. Seiten: `components/sanierung/GuideSeiten.tsx`
  (eine Darstellung je Seite für Guide UND Übersicht), Ergebnis: `GuideErgebnis.tsx`.
- **`offeneSeiten()`** (`lib/sanierung/guide.ts`) ist die EINE Lückenfunktion. Wiedereinstieg mit
  angefangenem Entwurf → nur offene Seiten (auch eine, die erst durch neue Räume nötig wurde);
  nichts offen → „Alles ausgefüllt“. „Weiß ich nicht“/„noch nicht gemessen“ machen eine Seite fertig;
  vorgeschlagene Maßnahmen erst, wenn gesehen.
- **Auswertung** (`lib/sanierung/auswertung.ts`): Grobschätzung **ab den Räumen** (ohne Räume keine
  Summe aus dem Nichts) — nicht gemessene Räume teilen sich die Restfläche, quadratisch, 2,50 m.
  Annahmen gehen in die vorsichtige Richtung (Zustand offen = mittel, Wer offen = Handwerker,
  Tapete/Wandfliesen unbekannt = muss runter, Baujahr offen = vor 1993) und stehen alle im Ergebnis.
- **Handwerker** (Entscheidung 4): Maler je m² inkl. Material (Material fällt weg; Raufaser
  „tapezieren und streichen“ in einer Zeile), Boden/Fliesen nur Arbeit (Material bleibt).
- **Ausschlüsse gegen Doppelzählung** (`ENTHALTEN_IN`): „Elektrik komplett“ enthält laut Quelle
  Sicherungskasten, Steckdosen und Schalter (dazu FI); „Bad komplett“ ersetzt Fliesen im Bad und die
  Ausstattung. **Dabei gefunden:** Stufe A kreuzte bei „schlecht“ Elektrik komplett UND
  Unterverteilung an (doppelt) — in #423 korrigiert.
- **Ohne belegten Preis keine Zahl:** Asbest (vor 1993, PVC/Platten oder unbekannt) und PAK-Parkett-
  kleber (vor 1970) sind offene Posten „nicht in der Summe“; Rauchwarnmelder stehen mit Anzahl, aber
  „Preis offen“ auf dem Einkaufszettel (Produktseiten nur per JavaScript lesbar, kein zweiter Beleg);
  Abdichtung (DIN 18534) als Hinweis ohne Preis. **Puffer:** wählt der Nutzer (0/10/15/20 % oder
  eigener Wert) — für „15–20 %“ fand sich nur ein Zitat in Sekundärquellen, keine Primärquelle der
  Verbraucherzentrale.
- **Förderung:** Fenster und Wärmepumpe aus „Technik“ zählen automatisch in die Zuschuss-Schätzung
  (von–bis), nie von der Summe abgezogen. Nutzung wird einmal gefragt (Seite „Ziel“).
- **Bewusst noch nicht:** „günstig oder langlebig“ (braucht die zweite Preisstufe je Material aus
  Stufe A — eine Frage, die nichts bewirkt, wäre irreführend); Zimmerzahl (die Räume-Seite zählt);
  Haus (Stufe E); Speichern/Vorlagen (Stufe C, SQL).
- Tests: `tests/sanierungGuide.test.ts` (42 Tests, 34 Mutationen rot), im Browser durchgeklickt
  (1440 und 390 px, lokaler Server mit Demo-Sitzung).

### Stufe C: was gebaut ist (06.10.2026)

- **Tabelle `sanierungsprojekte`** (Migration `20261006050000`, **im SQL-Editor**, idempotent): `art`
  projekt/vorlage, `daten` jsonb (≤ 256 KB in der DB, die App bremst bei 200 KB), `kalk_id`/`prop_id`
  für Stufe D und Abschnitt 11 (Policy: nur auf EIGENE Zeilen), höchstens **200 Zeilen je Konto**
  (Trigger, Fehlercode 54000), Kaskade auf `auth.users`, Demo weder lesen noch schreiben (Policy +
  Anweisungs-Trigger). Dieselbe Datei legt `kalkulationen.uebernommen_prop_id` an (Abschnitt 11, nur
  eigenes Objekt, höchstens einmal). Lokal in PostgreSQL 16 mit Stubs geprüft (16 Fälle).
- **Actions** `lib/actions/sanierungsprojekte.ts`: Was gespeichert wird, prüfen dieselben Funktionen
  wie beim Laden aus dem Browser (`entwurfAus`, `vorlageAus`) — ein Aufruf am Formular vorbei speichert
  nichts Fremdes. **Zwei Geräte:** Überschrieben wird nur gegen den bekannten `updated_at`; hat ein
  anderes Gerät inzwischen gespeichert → `konflikt` mit drei Wegen (neueren Stand laden · als Kopie ·
  trotzdem überschreiben). Fehlt die Tabelle noch (`PGRST205`/`42P01`), sagt die Leiste „kommt in
  Kürze“, statt einen kaputten Knopf zu zeigen.
- **Projektleiste** (`components/sanierung/ProjektLeiste.tsx`): Speichern · Neu · „Projekte &
  Vorlagen“. Bevor ein Entwurf ersetzt wird, fragt sie, wenn Ungespeichertes verloren ginge. Welches
  Projekt offen ist, merkt sich der Browser (`buyimmo:sanierung-projekt`). Demo: kein Speichern, die
  mitgelieferten Vorlagen gehen trotzdem (sie stehen im Code).
- **Vorlage = Entscheidungen, nie die Wohnung** (`lib/sanierung/projekte.ts`): Maßnahmen je Raumart
  (die des ERSTEN Raums dieser Art — eine Vereinigung schlüge in jedem Raum alles vor), Technik **nur
  wo etwas angekreuzt ist**, wer arbeitet, Entsorgung, Puffer, Ziel, eigene Materialpreise. Nicht:
  Name, Adresse, Baujahr, ETW, Wohnfläche, Räume/Maße, Ist-Zustand, Mengen, Angebote, eigene Posten,
  Stunden, Förderangaben. **Warum Technik ohne Kreuz nicht mitkommt:** „gut, nichts zu tun“ ist eine
  Aussage über die alte Wohnung — übernommen stünde bei der nächsten „Automaten und FI vorhanden“,
  ohne dass jemand nachgesehen hat.
- **Neues Projekt aus Vorlage:** Der Entwurf bekommt `vorschlagJeTyp`; neue Räume übernehmen ihn
  (`vorschlagFuer()`), müssen aber auf „Maßnahmen“ angesehen werden. `[]` heißt „nichts
  vorschlagen“. Der Guide startet mit nur den offenen Seiten.
- **Mitgelieferte Vorlagen** (Mieterwechsel · Bad neu · Altbau-Wohnung komplett): Vorschläge ohne
  Puffer, ohne „wer“, ohne Preise — dafür gibt es keine Quelle. „Altbau komplett“ legt Elektrik, Bad
  und Türen fest und fragt Heizung, Fenster, Küche ab (Fenster sind bei der ETW Gemeinschaft).
- **Dabei gefunden und behoben:** `entwurfAus()` übernahm Materialpreise unter JEDEM Schlüssel — ein
  gespeicherter Entwurf hätte beliebig wachsen können. Jetzt nur Materialien aus dem Katalog.
- Tests: `tests/sanierungProjekte.test.ts` + `tests/actionsSanierungsprojekte.test.ts` (49 Tests,
  35 Mutationen rot). Im Browser (1440/390 px, Demo-Sitzung): Leiste, Rückfrage, Vorlage → Räume mit
  Vorschlag. **Nicht im Browser geprüft:** Speichern, Liste, Konflikt — die Tabelle existiert live erst
  nach dem SQL, und die Sitzung hier ist das Demo-Konto. Nach dem SQL: Live-Prüfung in einer
  zurückgerollten Transaktion als Rolle `authenticated`.

### Umbau 06.10.2026: Lern-App und Besichtigung je Kandidat
Der Guide ist Schritt 2 des Kaufwegs („Besichtigen & Sanieren“, [[BUYIMMO-WEG]]). Zwei Änderungen:
(1) **Lern-App:** Eine Auswahl, die eine Seite fertig macht, führt nach 450 ms von selbst weiter
(`autoWeiter()`, nur `eckdaten`/`ziel`/`arbeit`/`abschluss`, nie beim Korrigieren); in Textfeldern
ist Enter = Weiter. (2) **Je Kandidat:** `/sanierung?objekt=<id>` übernimmt Name, Adresse, Fläche,
Baujahr und Ziel aus der eigenen Kaufprüfung, `Entwurf.kaufObjekt` merkt sich den Kandidaten, die
Summe geht an genau ihn zurück (`/vergleich?sanierung=…&objekt=…`). Damit ist Abschnitt 9
(„Projekt hängt an einer Kaufprüfung“) für den Browser-Entwurf umgesetzt; gespeicherte Projekte
tragen den Bezug im Entwurf, die Spalte `kalk_id` wird noch nicht geschrieben.
Tests: `tests/umbauBuyImmo.test.ts`.
