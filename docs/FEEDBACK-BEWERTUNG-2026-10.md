# Bewertung des externen Feedbacks vom 01.10.2026 — und der Plan daraus

**Stand:** 01.10.2026 · **Methode:** wie im September ([[FEEDBACK-BEWERTUNG-2026-09]]).
Jede Behauptung wurde gegen die Live-Seite, den Code (`main` nach #376) und — neu — gegen
die **tatsächliche Nutzung** in der Datenbank geprüft (nur Zählungen, Demo-Konten
ausgenommen, keine Inhalte gelesen).

---

> ⚠️ **KORREKTUR (01.10.2026, Betreiber):** Die zehn Vermieter-Konten mit Objekt sind
> **Testkonten** für die App-Funktionen, keine echten Nutzer. Die Zahlen in Abschnitt 2
> belegen deshalb **kein Nutzungsproblem**, sondern dass MyImmo **noch nicht gestartet** ist:
> Registrierung nur mit Beta-Code, keine öffentliche Anmeldung. Daraus folgt:
> - **„Fünf Vermieter persönlich begleiten“ (Phase 0) entfällt** — es gibt sie nicht.
> - Die Kernaussage bleibt, mit anderem Grund: Bank-Anbindung und KI sind jetzt zu früh,
>   weil es **noch keine echten Nutzer** gibt, deren Bedarf sie belegen könnten.
> - **Der Anfrageweg ist abgeschafft** (Entscheidung des Betreibers): Start-Knöpfe zeigen
>   „Coming soon“, nicht klickbar (`components/StartCta.tsx`); der Beta-Code bleibt im
>   Registrierformular. Phase 1 ist damit um diesen Punkt ergänzt.
> - Die erste echte Messung beginnt mit dem Start. Bis dahin sind die Zahlen in Abschnitt 2
>   ein Bild der Testdaten, kein Nutzerverhalten.

## 1. Kurzurteil

Das Feedback beschreibt die Seite **korrekt** (Zitate, Zielgruppe, Workflow, Bankpaket,
Steuer-Hinweis — alles live nachgelesen und gefunden). Seine Produktvision ist
schlüssig. **Sein Plan ist trotzdem der falsche für jetzt**, aus einem Grund, den es von
außen nicht sehen konnte:

> **MyImmo hat ein Nutzungsproblem, kein Funktionsproblem.**

Der Plan des Feedbacks heißt „mehr Automatisierung, dann KI“. Beides braucht als Rohstoff
**gepflegte Daten aktiver Nutzer** — und genau die fehlen.

## 2. Was das Feedback nicht wissen konnte — die Nutzungszahlen

| Größe (echte Konten, ohne Demo) | Wert |
|---|---|
| Konten | **21** |
| … davon mit mindestens einem Objekt | **10** |
| … davon mit Buchungen | **7** |
| Anmeldungen in den letzten 30 Tagen | **4** (dieselben 4 auch in 7 Tagen) |
| Neue Einnahmen-Buchungen in 30 Tagen, alle Konten zusammen | **7** |
| Objekte / Mieter / Kredite | 23 / 25 / 8 |
| Mieter mit Portal-Zugang | **1** |
| Anliegen / Service-Partner / Aufträge, gesamt | 8 / 1 / 3 |
| Objekte ohne Kaufdatum (30.09. gezählt) | 20 von 23 |

Was daraus folgt:

1. **Der „Killer-Workflow“ Mieter → Hausmeister → Vermieter → Handwerker ist bei echten
   Nutzern so gut wie unbenutzt** (1 Mieter im Portal, 1 Service-Partner). Das Feedback
   nennt ihn „das größte Potenzial“ — das ist eine **Hypothese**, kein Befund. Er kann
   trotzdem der Differenzierer sein; belegt ist es nicht.
2. **Laufende Nutzung findet kaum statt** (7 Buchungen in 30 Tagen über alle Konten).
   Eine Bankanbindung, die „Miete eingegangen?“ automatisch beantwortet, hätte heute
   **niemanden**, für den sie es täte.
3. **Die Daten sind lückenhaft.** Eine KI, die „Wie steht mein Portfolio da?“ beantwortet,
   rechnet bei 20 von 23 Objekten ohne Kaufdatum — die AfA und jede Wertentwicklung sind
   dann falsch, und die KI sagt es mit Überzeugung.

## 3. Behauptung für Behauptung

| Feedback | Stimmt? | Bewertung |
|---|---|---|
| Zielgruppe 1–24 Einheiten ist klar | ✅ live (Hero, FAQ) | Richtig. Die vorgeschlagene Schärfung („mehr als ein paar Wohnungen, aber keine Hausverwaltung“) ist gut — **übernehmen**. |
| Workflow Mieter → … → Handwerker ist das Besondere | ✅ gebaut, ❌ ungenutzt | Siehe 2.1. Erst **mit echten Vermietern ausprobieren lassen**, dann ausbauen. |
| Objekt als Kern-Architektur | ✅ so gebaut | Richtig, und schon so umgesetzt. Kein Handlungsbedarf. |
| Bankanbindung als nächster großer Schritt | ⚠️ | **Widerspricht einer Entscheidung vom 29.08.2026:** Open Banking war fertig gebaut und wurde wegen laufender Kosten je Konto entfernt (`docs/zukunft/OPEN-BANKING.md`), „wieder aufbauen, sobald das Produkt Geld verdient“. Daran hat sich nichts geändert — es gibt noch keine Einnahmen. Dazu: Kontoinformationsdienste brauchen einen lizenzierten Anbieter (PSD2/AISP). **Billiger Zwischenschritt siehe Plan, Phase 3.** |
| „MyImmo AI“ als Copilot | ⚠️ | Die meisten Beispielfragen („offene Mieten“, „Zinsbindungen nächstes Jahr“, „fehlende Dokumente“, „auslaufende Verträge“) **beantwortet die App heute schon deterministisch** — `lib/heute.ts` (Fristen, offene Mieten, Datenlücken), `lib/fristen.ts`, `/termine`. Eine KI würde dieselben Zahlen nur umformulieren, mit Halluzinationsrisiko, Kosten je Frage und einer **Datenübermittlung an Anthropic (USA)**, solange Bedrock/Frankfurt nicht eingerichtet ist. „Welche Immobilie sollte ich mir ansehen?“ rückt an **Anlageberatung (§ 34i GewO)** heran — steht auf der Anwaltsliste. |
| Bankpaket „massiv ausbauen“ | ✅ existiert schon | Beleihungsordner mit Deckblatt, Selbstauskunft, Kreditantrag, Checkliste inkl. Grundbuchauszug und Energieausweis, Freigabelink für die Bank — **das Beschriebene ist weitgehend gebaut.** Lücke ist nicht die Funktion, sondern dass niemand sie nutzt. |
| „13+ Funktionen“ überzeugt nicht | ✅ live | Richtig: Funktionszahlen verkaufen Software, nicht Entlastung. **Ersetzen.** |
| Hero „Deine Immobilien. Ein System.“ | ⚠️ Geschmack | Klarer — aber **generischer**. Der heutige Hero trägt mit „Von überall.“ das einzige Merkmal, das kein Wettbewerber hat: die Gründergeschichte (vom Ausland aus verwalten, `/vision`). Vorschlag unten verbindet beides. Ohne Analyse-Tools (Datenschutz Ziffer 2: keine) **ist das nicht messbar** — es bleibt eine Urteilsentscheidung. |
| Eigener Vertrauensbereich | ✅ fehlt wirklich | Heute nur eine Kennzahl + FAQ. **Bauen — aber nur mit belegbaren Sätzen:** „🇪🇺 Datenhaltung in der EU“ wäre wieder die § 5-UWG-Falle vom 30.09. (Vercel und Anthropic sitzen in den USA). Richtig: „Datenbank in Frankfurt“. |
| Steuer-/Rechts-Review-Prozess | ✅ | Richtig und überfällig. Der konkrete Schritt liegt **seit Wochen fertig**: `docs/compliance/StBerG-ANFRAGE.md` an den Anwalt. Ohne diese Antwort sollte die Werbung mit Anlage V/ELSTER nicht lauter werden. |
| Wertentwicklung, Marktmiete, „Was wäre wenn“ | ⚠️ | Teilweise gebaut (Marktwert-Schätzer, Index-Fortschreibung). „Marktmiete“ braucht eine Datenquelle, die es kostenlos nicht verlässlich gibt; „Miete auf Marktniveau entwickeln“ stößt an § 558 BGB (Kappungsgrenze) und die Mietpreisbremse — **Scheingenauigkeit** mit Rechtsrisiko. Später, als Szenario, nicht als Zahl (wie in `docs/zukunft/STRATEGIE-REITER.md`). |
| Noten (9/10, 8,5/10 …) | — | Ohne Maßstab und ohne Nutzungsdaten **nicht belastbar**. Nicht weiterverwenden, etwa in Pitch oder Businessplan. |

**Selbst gefunden beim Prüfen:** Der Seitenfuß sagt „kein Abo“, die FAQ zwei Absätze
darüber „Das Geschäftsmodell ist ein faires Software-Abo“. Heute stimmt beides halb;
spätestens mit Bezahltarifen ist „kein Abo“ falsch.

## 4. Wo das Feedback recht hat — und ich es stärker sehe

**„Nicht 30 weitere Funktionen, sondern das Vorhandene verbinden“** ist der beste Satz des
Feedbacks. Ich würde ihn zuspitzen: *nicht verbinden, sondern **benutzt bekommen**.* Das
Produkt ist breit genug. Was fehlt, ist der Beleg, dass zehn Vermieter es jeden Monat
öffnen — und das Wissen, **wofür**.

## 5. Der Plan — nach Nutzen je Aufwand

### Phase 0 — Entscheidungen, die nur der Betreiber treffen kann (diese Woche, kein Code)
1. **Zugang:** Bleibt die Registrierung hinter dem Zugangscode? Jede Hürde vor dem ersten
   Login kostet bei 21 Konten mehr als jede fehlende Funktion. Risiko beim Öffnen:
   AGB/AVV sind nicht anwaltlich geprüft, Support läuft über eine Person.
2. **Fünf Vermieter persönlich begleiten.** Nicht mehr Nutzer, sondern die vorhandenen
   10 mit Objekt: Was hat sie gestoppt? Ein Gespräch je Konto schlägt jede Annahme hier —
   auch die des Feedbacks und meine.
3. **Anwalt:** StBerG-Anfrage abschicken (fertig), § 34i und AGB/AVV mitgeben. Davon hängt
   ab, wie laut Steuer und jede KI-Funktion beworben werden dürfen.
4. **2FA einmal durchspielen** (offener Punkt 6) — vor jeder Öffnung.

### Phase 1 — Startseite schärfen (≈ ½ Tag, sofort machbar)
- Hero-Vorschlag, der Zielgruppe UND Alleinstellung trägt:
  **„Deine Immobilien. Ein System. Von überall.“** — Unterzeile: „Für private Vermieter
  mit mehr als ein paar Wohnungen, aber ohne Hausverwaltung: Mieten, Nebenkosten,
  Anlage V, Kredite und dein Team — Mieter, Hausmeister, Handwerker — an einem Ort.“
- „13+ Funktionen“ ersetzen durch die Bereiche: *Portfolio · Mieter · Finanzen ·
  Nebenkosten · Steuer · Kredite · Service*.
- **Vertrauensabschnitt** „Deine Daten gehören dir“: Datenbank in Frankfurt ·
  Bankdaten zusätzlich verschlüsselt (AES-256-GCM) · Komplett-Export als ZIP · Konto
  jederzeit löschbar · kein Verkauf, keine Werbung · Zwei-Faktor-Anmeldung. Jeder Satz
  belegt (Datenschutzerklärung, `/api/export/alles`, `deleteAccount`, `ZweiFaktor`).
- Widerspruch „kein Abo“ ↔ „Software-Abo“ auflösen: im Fuß „derzeit kostenlos“.
- **Keine** KI- oder Bank-Versprechen auf die Startseite, solange es sie nicht gibt.

### Phase 2 — Aktivierung: von „angelegt“ zu „gepflegt“ (≈ 2–4 Tage)
Voraussetzung für alles Weitere — Automatisierung und KI rechnen nur mit gepflegten Daten.
- ✅ **(gebaut 02.10.2026, `lib/objektCheck.ts`)** **Objekt-Check je Objekt:** sichtbarer Fortschritt „8 von 10 Angaben“ (Kaufdatum,
  Kaufpreis, Mieter mit Mietbeginn, Kredit mit Auszahlung …) mit Direktlinks. Die
  Datenlücken-Erkennung existiert schon (`lib/heute.ts`, Art `stammdaten`); es fehlt die
  Darstellung als Ziel statt als Aufgabe ganz unten.
- **Monatlicher Rhythmus:** Eine E-Mail am 5. („2 Mieten offen, 1 Frist in 30 Tagen“) —
  der Inhalt ist `baueHeuteAufgaben()`, der Versand Brevo (AVV-Restpunkte vorher klären).
  Ohne einen Anlass, die App zu öffnen, öffnet sie niemand.
- **Messen ohne Analyse-Tools:** die Zahlen aus Abschnitt 2 monatlich aus der Datenbank
  ziehen (aktive Konten, Buchungen/Monat, Mieter im Portal). Ausgangswert: 4 / 7 / 1.

### Phase 3 — Automatisierung ohne Bank-Abo (≈ 3–5 Tage)
- ✅ **(gebaut 02.10.2026, `lib/kontoauszug.ts`, Mietkonto → „Kontoauszug abgleichen“; Datei bleibt im Browser)** **Kontoauszug-Abgleich per CSV-Datei:** Auszug aus dem Online-Banking hochladen →
  MyImmo schlägt je Zahlung vor, welche Soll-Miete sie ausgleicht (Betrag, Name, IBAN,
  Verwendungszweck) → bestätigen → gebucht im Mietkonto. Liefert 80 % von „Miete
  eingegangen?“ — **ohne AISP-Lizenz, ohne Kosten je Konto**, mit vorhandenen Bausteinen
  (`lib/importCsv.ts` parst bereits, das Mietkonto kennt das Soll).
- Erst wenn das **genutzt** wird **und** Einnahmen fließen: Open Banking nach
  `docs/zukunft/OPEN-BANKING.md` als bezahltes Zusatzmodul.

### Phase 4 — „Portfolio-Check“ statt KI-Chat (≈ 1 Woche, nach Phase 2)
- Eine Seite, die die Fragen des Feedbacks **regelbasiert** beantwortet: Cashflow letztes
  Jahr, Kosten über Vorjahr (je Kategorie ± X %), auslaufende Zinsbindungen, fehlende
  Dokumente je Objekt, Mieterhöhungs-Fristen. Jede Zahl nachrechenbar, keine Halluzination,
  keine Kosten je Frage.
- Eine Sprach-KI erst danach und nur als **Erklär-Schicht über berechneten Zahlen** — mit
  Bedrock in Frankfurt (Env vorbereitet, `lib/bedrock.ts`), Datenschutz-Text vorab, und nach
  der Anwaltsantwort zu § 34i.

### Phase 5 — später (wenn Phase 2–4 genutzt werden)
- Wertentwicklung/Marktmiete als **Szenarien**, nicht als Prognose.
- Strategie-Reiter (`docs/zukunft/STRATEGIE-REITER.md`) — erst nach § 34i-Klärung.
- Bezahltarife scharfschalten (`docs/BEZAHLSYSTEM.md`) — sobald 5–10 Konten regelmäßig
  aktiv sind; vorher fehlt die Grundlage für einen Preis.

## 6. Bewusst nicht jetzt
- **Bankanbindung (Open Banking)** — Entscheidung vom 29.08. steht, Phase 3 ist der Ersatz.
- **Freier KI-Chat** über den Bestand — Phase 4 zuerst.
- **„Betriebssystem für Vermieter“ als öffentliche Behauptung** — als innerer Leitstern gut,
  als Werbesatz bei 4 aktiven Konten ein Versprechen, das die App heute nicht einlöst.
- **Weitere Funktionen** ohne Nutzungsbeleg.

## 7. Risiken des Plans selbst
- Phase 0/2 sind Arbeit **ohne sichtbaren Fortschritt im Code** — das fühlt sich langsamer
  an, als es ist. Der Messwert in Abschnitt 2 ist der Fortschritt.
- Die Monatsmail ist der erste ungefragte Versand an Vermieter: Einwilligung bzw.
  Vertragsbezug klären, Abmeldelink, und Brevo-AVV-Restpunkte vorher schließen.
- Der CSV-Abgleich verarbeitet Kontoauszüge — auch fremde Zahlungen. Nur Treffer
  speichern, die Datei nicht aufbewahren, im Datenschutztext nennen.
