# Gesprächsvorbereitung — Beteiligung / Beirat

> **Stand: 30.09.2026.** Alle Zahlen live aus Produktionsdatenbank, Code und
> Anbieter-Preisseiten geprüft, nicht aus dem Gedächtnis. Herkunft steht jeweils dabei.
> Ergänzt: [[KOSTENMODELL]] (Betriebskosten nach Nutzerzahl), [[BETEILIGUNG]]
> (Rechtsform und Anteilsstruktur), `MyImmo-Businessplan-2026-07.pdf`.

**Situation:** Erstes Gespräch. Gegenüber ist ein korrekter, zielstrebiger Mensch mit
sehr guten Kontakten. Er soll als **Beirat/Türöffner** einsteigen, Kontakte und
Mitarbeit einbringen und **später Kapital**, bis es läuft. Er fragt kritisch, aber
kaum technisch.

---

## 0. Die eine Regel für dieses Gespräch

**Jede schlechte Zahl kommt von dir, nicht von ihm.**

Ein korrekter Mensch prüft nach. Findet er selbst, dass es null zahlende Kunden gibt
oder dass der Businessplan ein Kapitel über ein entferntes Feature enthält, verlierst
du nicht das Argument — du verlierst die Glaubwürdigkeit für **alle** anderen
Aussagen. Legst du dieselbe Zahl selbst auf den Tisch, kaufst du dir damit Vertrauen
für die Punkte, die wirklich gut sind. Und davon gibt es genug.

---

## 1. Die Zahlen, die du auswendig können musst

### Was gebaut ist (gemessen 30.09.2026)

| | |
|---|---|
| Produktiv-Code | **51.849 Zeilen** in 430 Dateien |
| Tests | **1.228, alle grün** in 94 Dateien (13.356 Zeilen Testcode) |
| Seiten / Komponenten | 67 / 94 |
| Datenbanktabellen | **46, alle mit Zeilen-Sicherheit (RLS)** |
| Datenbank-Migrationen im Repo | 32 |
| PDF-Generatoren | 9 (NK-Abrechnung, Kreditantrag, Beleihung, Dokumente …) |
| Ratgeber-Artikel (SEO) | 19 + 4 Funktionsseiten |
| Entwicklungszeit | ~4 Monate, nebenberuflich, allein |

### Was davon Geld verdient

| | |
|---|---|
| Zahlende Kunden | **0** |
| Umsatz bisher | **0 €** |
| Bezahlsystem | gebaut, getestet, **abgeschaltet** (`BILLING_ENFORCED` nicht gesetzt) |
| Preise auf der Website | **unsichtbar** (`PREISE_SICHTBAR = false`) |

### Wer es benutzt

| | |
|---|---|
| Registrierte Konten | **22** |
| davon mit mindestens einem Objekt | 11 |
| Login in den letzten 30 Tagen | **4** |
| Login in den letzten 7 Tagen | 2 (einer davon das Demo-Konto) |
| Konten, die je wiederkamen | 9 von 22 |
| Letzte Buchung eines fremden Kontos | **28.07.2026** |
| Registrierung öffentlich möglich? | **Nein** — `REGISTRIERUNG_OFFEN = false`, Zugang nur mit persönlich vergebenem Code |

### Was der Betrieb kostet

| | |
|---|---|
| Heute (Grundgebühren) | **~51 € im Monat** (Supabase Pro, Vercel Pro, Domains) |
| Deckungspunkt | **7 zahlende Kunden** |
| Bei 1.000 zahlenden Kunden | 84 € Infrastruktur gegen 8.274 € Netto-Umsatz |
| Kosten je zahlendem Kunden | 0,52 € (bei 100) bis 0,07 € (bei 10.000) |

Herleitung und alle Annahmen: [[KOSTENMODELL]].

---

## 2. Die fünf Fragen, an denen es scheitern kann

### 2.1 „Wie viele zahlende Kunden hast du?"

**Null. Und keinen einzigen Euro Umsatz.**

Dann sofort weiter, ohne Pause — die Erklärung ist gut, aber nur wenn die Zahl
zuerst kommt:

> Das Bezahlsystem ist vollständig gebaut — Tarifmatrix, Zahlungsanbieter-Anbindung,
> Webhook, Abo-Verwaltung, Tarif-Schranken an neun Stellen im Code. Es ist bewusst
> abgeschaltet. Vor dem ersten Euro fehlen drei Dinge: die anwaltliche Freigabe von
> AGB und Widerrufsbelehrung, eine geklärte Kondition beim Zahlungsanbieter für
> Produkte unter 10 $ — und ein bewiesener Grund, warum jemand zahlen sollte. Den
> dritten Punkt kann ich nicht kaufen, den muss ich mir holen. Deshalb sitze ich hier.

**Warum das trägt:** Es ist im Code nachprüfbar (`BILLING_ENFORCED`, `lib/planGate.ts`),
es benennt den schwächsten Punkt selbst, und es macht aus der Lücke den Grund für
das Gespräch.

**Was du NICHT sagen darfst:** „Wir sind noch in der Beta." Das ist eine Ausrede.
„Ich habe die Tür bewusst zugelassen, bis X erledigt ist" ist eine Entscheidung.

---

### 2.2 „Es ist seit Juni live. Warum benutzt es niemand?"

**Weil niemand hineinkommt.**

> Die Registrierung ist seit dem ersten Tag durch einen Zugangscode gesperrt, und
> die Preise sind auf der Website ausgeblendet. Beides steht so im Code. Die 22
> Konten sind Leute, denen ich persönlich einen Code gegeben habe — das ist keine
> Marktreaktion, das ist meine Kontaktliste. Es gab nie einen Test, ob der Markt
> das Produkt will.

Und dann der ehrliche Zusatz, den er sonst selbst findet:

> Von diesen 22 sind nur 4 im letzten Monat wiedergekommen. Auch bei einer geschlossenen
> Beta ist das schwach. Ich weiß nicht, ob sie nicht wollten oder ob das Produkt sie
> verloren hat — **ich habe es nie gefragt.** Das ist mein Fehler, und es ist die
> erste Sache, die ich mit dir anders machen will.

**Warum das trägt:** Ein zielstrebiger Mensch verzeiht ein Versäumnis, das man
benennt und für das man einen Plan hat. Er verzeiht keine Schönfärberei.

---

### 2.3 „Was ist die Firma wert? Wofür bekomme ich Anteile?"

**Es gibt keine Firma.** MyImmo ist ein Einzelunternehmen — und ein Einzelunternehmen
hat keine Anteile. Es gibt rechtlich nichts, was man übertragen könnte.

Das ist kein Nebensatz, das ist das Zentrum des Gesprächs. Vollständige Behandlung
mit den drei möglichen Wegen: [[BETEILIGUNG]]. Die Kurzfassung für den Abend:

> Anteile im Rechtssinn kann ich dir heute nicht geben, weil MyImmo ein
> Einzelunternehmen ist. Das lässt sich lösen — aber nicht per Handschlag, und
> welcher Weg richtig ist, hängt davon ab, was wir zusammen vorhaben. Was ich dir
> heute schon anbieten kann, ist eine **virtuelle Beteiligung**: ein Vertrag, der
> dir wirtschaftlich denselben Anteil am Erfolg gibt wie echte Anteile, ohne dass
> wir dafür eine Gesellschaft gründen müssen. Wenn es läuft, wandeln wir sie in
> echte Anteile um.

**Zur Bewertung** — er wird fragen, was es wert ist. Die ehrliche Antwort:

> Bei null Umsatz gibt es keinen berechenbaren Wert. Was ich beziffern kann, sind
> die **Wiederbeschaffungskosten**: 52.000 Zeilen Produktivcode plus 13.000 Zeilen
> Tests, 46 Tabellen, 9 PDF-Generatoren, deutsche Steuer- und Mietrechtslogik. Eine
> Agentur würde für diesen Funktionsumfang im Bereich von 1.500 bis 3.000 Stunden
> anbieten; bei 120 € die Stunde sind das 180.000 bis 360.000 €.
>
> Und jetzt das Gegenargument, bevor du es machst: **Wiederbeschaffungskosten sind
> kein Marktwert.** Software ohne Kunden ist am Markt fast nichts wert. Was hier
> steht, ist nicht „die Firma ist 300.000 € wert", sondern: „ein Investor, der
> dasselbe von Null bauen lässt, zahlt so viel und braucht ein Jahr." Der Wert
> entsteht erst durch das, was du mitbringst.

**Warum das trägt:** Du nimmst ihm das stärkste Gegenargument aus der Hand, bevor
er es benutzt. Das ist bei einem korrekten Menschen mehr wert als jede große Zahl.

---

### 2.4 „Wer hat das gebaut? Und was, wenn dir etwas passiert?"

Beides kommt, und beides muss ehrlich beantwortet werden.

**Zur Entstehung:**

> Ich, allein, nebenberuflich, KI-gestützt. Das ist kein Makel, aber es ist auch
> keine Ausrede für schlechte Arbeit — deshalb belege ich es: 1.228 automatische
> Tests laufen grün, jede Datenbankänderung liegt als Migration im Repo, und die
> Projektdokumentation führt ein Verzeichnis echter gefundener Fehler mit Ursache
> und Gegenprüfung. Darunter Sachen wie doppelt gebuchte Mieteinnahmen in fünf von
> zwölf Monaten, weil ein Datum aus Textbausteinen gebaut wurde, oder Beträge, bei
> denen aus „1.000" ein Euro wurde. Gefunden, behoben, mit Tests festgenagelt.
> Wer nur behauptet, dass sein Code gut ist, hat keine solche Liste.

**Zum Ausfallrisiko — hier nicht relativieren:**

> Das ist mein größtes Risiko und ich kann es heute nicht wegreden. Außer mir hat
> noch nie jemand eine Zeile an diesem Code geändert. Wenn ich sechs Wochen ausfalle,
> steht die Weiterentwicklung. Der Betrieb läuft weiter — das Hosting ist
> vollautomatisch — aber es gibt keinen zweiten Menschen, der einen Fehler beheben
> könnte. Das gehört auf die Liste der Dinge, die sich mit deinem Einstieg ändern
> müssen, nicht auf die Liste der Dinge, die ich kleinrede.

---

### 2.5 „Warum sollte das jemand kaufen — es gibt doch objego und immocloud?"

Die Wettbewerbsfrage. Nicht über den Preis argumentieren, sondern über die Tiefe.

| Anbieter | Position | Angriffspunkt |
|---|---|---|
| **objego** | Gratis-Einstieg, sehr verbreitet | Preis je Einheit steigt linear; Nebenkostenabrechnung kostet extra |
| **immocloud** | funktionsstark, >15.000 Nutzer | teurer, auf ambitionierte/größere Vermieter zugeschnitten |
| **vermietet.de** | ImmoScout-Ökosystem | an einen Konzern gebunden |
| **Excel / Papier** | der eigentliche Marktführer | fehleranfällig, keine Automatik, kein NK-PDF |

> Der wahre Wettbewerber ist Excel, nicht objego. Und der Unterschied, den ich
> verteidigen kann, ist nicht Design — den kopiert jeder in drei Monaten. Es ist
> die Tiefe im **deutschen Recht**: Anlage V, DATEV-Export, § 82b-Verteilung,
> AfA, Heizkostenverordnung, CO₂-Kostenaufteilung nach Stufenmodell,
> § 35a-Ausweis, ImmoWertV-Bewertung, Prüfpflichten je Objekt. Das ist nicht
> schwer — es ist **teuer und langweilig**, und es veraltet jedes Jahr. Genau
> deshalb macht es kaum jemand vollständig.

**Ehrlicher Zusatz, den er sonst selbst formuliert:**

> Ein Burggraben ist das trotzdem nicht. ImmoScout könnte das bauen, wenn sie
> wollten. Mein Schutz ist nicht Unkopierbarkeit, sondern dass die Zielgruppe für
> einen Konzern zu klein und zu mühsam ist — und dass Wechselkosten hoch sind,
> sobald die Daten eines Vermieters erst einmal drin sind.

---

## 3. Vollständiger Fragenkatalog

### Markt und Nachfrage

| Frage | Kurzantwort |
|---|---|
| Wie groß ist der Markt? | ~5,5 Mio. private Vermieter in DE, ~60 % mit genau einer Einheit. Quelle: Businessplan Kap. 3. |
| Woher weißt du, dass sie zahlen? | **Weiß ich nicht.** Es hat nie jemand bezahlt. Das ist die erste zu beweisende Annahme. |
| Warum sollte jemand von Excel wechseln? | Nebenkostenabrechnung und Anlage V sind die zwei Jahres-Schmerzpunkte. Wer die automatisiert bekommt, spart ein Wochenende. |
| Wie kommst du an Nutzer? | Heute: gar nicht, die Tür ist zu. Geplant: SEO über 19 Ratgeber-Artikel, Vermieter-Communities, Haus-&-Grund-Umfeld. **Hier brauche ich dich.** |
| Was kostet ein Kunde in der Akquise? | Unbekannt — noch nie gemessen, keine Analytics installiert. |

### Geschäftsmodell und Zahlen

| Frage | Kurzantwort |
|---|---|
| Was kostet das Abo? | Privat 7,99 €/M bzw. 79 €/J; Plus 12,99 € bzw. 129 €/J; Business ab 29,99 €. |
| Was bleibt davon übrig? | Nach Zahlungsanbieter ~89 % beim Monatsabo, ~94 % beim Jahresabo. Details: [[KOSTENMODELL]] Abschnitt 2. |
| Ab wann trägt es sich? | **7 zahlende Kunden** decken die Serverkosten. Arbeitszeit und Recht nicht eingerechnet. |
| Was kostet es bei 10.000 Kunden? | 726 € Infrastruktur im Monat. Die Technik ist nicht der Engpass. |
| Wie hoch ist die Abwanderung? | Unbekannt. Es gibt keine Abo-Historie, weil es keine Abos gibt. |
| Wann fließt der erste Euro? | Nach anwaltlicher Freigabe + geklärter Zahlungsanbieter-Kondition. Beides Wochen, nicht Monate. |

### Zukunftsfähigkeit

| Frage | Kurzantwort |
|---|---|
| Was, wenn du keine Lust mehr hast? | Legitime Frage. Antwort gehört in den Vertrag (Vesting, Rückfall), nicht in eine Beteuerung. |
| Läuft es ohne dich weiter? | Der Betrieb ja, die Entwicklung nein. Einziger echter Engpass. |
| Ist der Code wartbar? | 1.228 Tests, 32 Migrationen im Repo, Dokumentation im selben Repo. Nachprüfbar auf GitHub. |
| Was ist mit iOS? | Nicht begonnen. Braucht Apple-Programm (99 $/J), „Sign in with Apple", In-App-Käufe (15–30 % Provision — **deutlich teurer als der Web-Kanal**). |
| Skaliert die Technik? | Bis in den vierstelligen Nutzerbereich ohne Umbau. Ein bekannter Umbaupunkt: Dateien liegen als Base64 in der Datenbank statt in einem Objektspeicher — wird teuer, wenn Belegarchive wirklich gefüllt werden. Gemessen liegen heute 15 Dateien mit 183 KB im System. |

### Recht und Risiko

| Frage | Kurzantwort |
|---|---|
| DSGVO? Ihr verarbeitet Mieterdaten! | EU-Hosting (Frankfurt), RLS auf allen 46 Tabellen, Bankdaten AES-256-verschlüsselt mit Schlüssel außerhalb der Datenbank, AVV mit Supabase signiert, Anthropic-DPA archiviert, Verarbeitungsverzeichnis und TOM-Dokumentation vorhanden. |
| Was fehlt noch rechtlich? | **Drei Dinge, alle beim Anwalt:** AGB/Widerruf vor dem Bezahlstart, der AVV, den MyImmo seinen eigenen Nutzern anbieten muss (Vermieter sind für Mieterdaten verantwortlich), und die Grenze zum Steuerberatungsgesetz für Anlage V und DATEV-Export. |
| Haftet ihr, wenn eine Abrechnung falsch ist? | Genau deshalb steht überall „Näherung, keine Steuerberatung". Muss anwaltlich bestätigt werden — steht auf der Liste. |
| Ist der Finanzierungsrechner erlaubnispflichtig? | Bewusst § 34i-frei gehalten: rechnen und informieren, keine Empfehlung, keine Vermittlung. Wording bereits neutralisiert, anwaltliche Freigabe offen. |

---

## 4. Was DU ihn fragen musst

Ein Beirat, der Anteile bekommt und keine Pflichten hat, ist ein schlechtes Geschäft.
Diese Fragen entscheiden, ob sich der Einstieg für dich lohnt — stelle sie im
ersten Gespräch, nicht im dritten.

1. **Welche Kontakte konkret?** Nicht „viele Leute in der Immobilienbranche", sondern:
   Welche Organisation, welche Person, wie viele Vermieter hängen daran?
   *Ein Kontakt zum Haus-&-Grund-Landesverband ist etwas völlig anderes als ein
   Makler, den er kennt.*
2. **Wie viel Zeit im Monat?** Eine Zahl, keine Bereitschaftserklärung.
3. **Was übernimmst du verbindlich?** Vertrieb? Erste Kundengespräche?
   Partnergespräche? Oder nur Vorstellungen?
4. **Ab wann Kapital, wie viel, wovon abhängig?** „Später, wenn es läuft" ist keine
   Zusage. Woran misst er „läuft"?
5. **Was passiert, wenn es nicht funktioniert?** Wie kommen wir auseinander, ohne
   dass die Freundschaft dabei draufgeht?

**Merke:** Kontakte sind kein Kapital. Eine Vorstellung ist einmalig, ein Anteil ist
für immer. Deshalb gehört beides aneinander gekoppelt — siehe [[BETEILIGUNG]].

---

## 5. Vor dem Termin unbedingt erledigen

| Was | Warum | Aufwand |
|---|---|---|
| **Businessplan korrigieren** | Kapitel 12 beschreibt die Bank-/Kontoanbindung als „größtenteils umgesetzt". Sie wurde am 29.08.2026 **komplett entfernt**. Drei weitere Stellen ebenso. Findet er das, prüft er alles nach. | Skript, 1 Stunde |
| **Demo-Konto selbst durchklicken** | Er wird es öffnen. Du musst wissen, was er sieht. | 20 Minuten |
| **Die 22-Nutzer-Folie bauen** | Die Zahl muss von dir kommen, mit der Code-Erklärung daneben. | 30 Minuten |
| **Eine Zahl nennen können** | Wie viel Prozent, wofür, mit welchem Vesting. Ohne das wirkst du unvorbereitet. | siehe [[BETEILIGUNG]] |

### Und was du NICHT tun solltest

- **Keine Anteile im ersten Gespräch zusagen.** Auch keine Größenordnung „so grob".
  Bei einem zielstrebigen Menschen ist eine genannte Zahl der neue Ausgangspunkt,
  und verhandelt wird nur noch nach oben.
- **Nicht ohne Schriftform zusammenarbeiten anfangen.** Wer gemeinsam ein Geschäft
  betreibt und Gewinne teilt, gründet nach deutschem Recht unter Umständen
  **ungewollt eine GbR — mit voller persönlicher Haftung für beide.** Das kann
  entstehen, ohne dass irgendjemand etwas unterschreibt. Details: [[BETEILIGUNG]].
- **Den Businessplan nicht in der Juli-Fassung herausgeben.**

---

## 6. Der rote Faden für das Gespräch

1. **Was gebaut ist** — die Zahlen aus Abschnitt 1, ruhig und ohne Superlative.
   Das Produkt ist der stärkste Teil und braucht keine Verkaufe.
2. **Was nicht funktioniert** — null Umsatz, 4 aktive Nutzer, Tür zu. Selbst sagen.
3. **Warum das so ist** — nachprüfbar im Code, keine Ausrede.
4. **Was die Zahlen zeigen, wenn es läuft** — Deckungspunkt 7 Kunden, Kosten je
   Kunde unter einem Euro. Das Modell trägt, sobald jemand da ist.
5. **Was fehlt** — Vertrieb, Zugang, die ersten hundert echten Nutzer.
6. **Was du von ihm willst** — konkret, mit Zeitangabe.
7. **Was er dafür bekommt** — Struktur, nicht Zahl (heute).

**Der Satz, auf den das Ganze hinausläuft:**

> Das Produkt ist fertiger als bei den meisten, die Geld einsammeln. Was fehlt, ist
> genau das, was du kannst. Ich brauche keinen Geldgeber — ich brauche jemanden, der
> die Tür aufmacht, und ich bin bereit, ihn dafür ernsthaft zu beteiligen.
