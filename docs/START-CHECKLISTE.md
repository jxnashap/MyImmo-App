# Start-Checkliste — was vor dem Start noch ansteht

**Stand 04.09.2026.** Frisch gegen Code, Datenbank-Doku und die vorhandenen Dossiers
geprüft, nicht aus älteren Listen abgeschrieben — `docs/PROJEKT-STATUS.md` (31.07./28.08.)
führt inzwischen mindestens einen erledigten Punkt noch als offen (Passwortlänge, vom
Betreiber am 30.08. umgestellt).

Sortiert nach dem, was zuerst weh tut. **Was hier NICHT steht, ist bewusst nicht drin** —
der Abschnitt „Ausdrücklich nicht nötig" am Ende sagt, warum.

---

## 0. Die Tarif-Frage — kürzer als gedacht

Die Frage „was ist wo drin" ist **bereits entschieden und im Code hinterlegt**
(`lib/plan.ts`):

| Tarif | Einheiten | Enthält zusätzlich |
|---|---|---|
| Kostenlos | 1 | Objekt, Mieter, Buchungen, Dashboard, Termine, Verbrauch |
| MyImmo Privat | bis 5 | NK-Abrechnung als PDF · Steuer/Anlage V/ELSTER · Dokument-Generator & Archiv · Mieterportal |
| MyImmo Plus | bis 24 | Service-Aufträge & Firmenverzeichnis · KI-Import · alle Kalkulatoren · Beleihungsordner |
| MyImmo Business | ab 25 | Hausverwaltungs-Zugang (Mandate getrennt) |

Die Preisseite (`PLAENE` in `components/landing/data.tsx`) und der Code
(`FEATURE_AB_PLAN`) sagen **heute dasselbe** — nachgeprüft. Sie sind aber zwei getrennte
Quellen ohne Test dazwischen (siehe T1).

**Die eigentliche Lücke war eine andere — und ist seit 04.09.2026 geschlossen:**
`darfFeature()` und `einheitenLimit()` wurden an **keiner einzigen Stelle der App**
aufgerufen. Die Tarif-Logik war gebaut, getestet und nirgends angeschlossen;
`BILLING_ENFORCED=true` hätte kassiert, ohne zu beschränken.

Jetzt greifen die Schranken über **`lib/planGate.ts`** an neun Stellen: Anlage V,
Jahresbericht, DATEV, die drei KI-Routen, NK-PDF, Dokument-PDF, Mieter-Einladung und die
Objekt-Anlage (Einheiten-Limit).

**Ohne `BILLING_ENFORCED=true` sind sie inert — und zwar ohne Datenbankabfrage.** Sie
kosten im Early Access nichts und können nichts verändern. Nachgewiesen durch Tests und
am laufenden Server: 307/401/405 wie vorher, nirgends ein 402.

---

## A. Blockiert den ersten Euro

Ohne diese Punkte darf kein Bezahlvorgang starten. Reihenfolge aus
`docs/BEZAHLSYSTEM.md`, hier nur um den Stand ergänzt.

| # | Was | Wer | Anmerkung |
|---|---|---|---|
| **A1** | **AGB + Widerrufsbelehrung anwaltlich freigeben** | Anwalt | Fernabsatz, digitale Leistung, Erlöschen des Widerrufsrechts. Die Texte stehen (167 Zeilen), geprüft hat sie niemand |
| **A2** | **StBerG § 1–5 klären** (Anlage V, § 82b-Optimierer, DATEV-Export) | Anwalt | **Der gewichtigste Punkt der ganzen Liste.** Kein Formfehler, sondern die Frage, ob ein Kernfeature bleiben darf |
| **A3** | **§ 34i GewO klären** (Finanzierungs-Assistent) | Anwalt | Wording ist bereits neutralisiert, Gewerbeanmeldung deckt keine Darlehensvermittlung — vermutlich unkritisch, aber ungeprüft |
| **A4** | Paddle: Konto, Produkte/Preise, Webhook, Env, Sandbox-Test | Betreiber | Schritte 3–7 in `docs/BEZAHLSYSTEM.md`. Gewerbe-Verifizierung dauert Tage — früh anfangen |
| ~~**A5**~~ | ~~Feature-Gates in die Server-Actions einbauen~~ | — | ✅ **erledigt 04.09.2026.** `lib/planGate.ts`, eingebaut an 9 Stellen. Ohne `BILLING_ENFORCED=true` inert **ohne Datenbankabfrage** — am laufenden Server nachgewiesen. **Beim Scharfschalten beachten: A9** |
| **A6** | Datenschutzerklärung um den Paddle-Passus ergänzen | Betreiber | Pflicht **vor** dem ersten Checkout — Paddle ist eigener Verantwortlicher für die Zahlungsdaten |
| **A7** | `PREISE_SICHTBAR = true` + Early-Access-Banner von `/preise` nehmen | Entwicklung | Ein Schalter in `lib/preise.ts`, steuert /preise, Preis-Teaser, Menüpunkt, Sitemap und FAQ in einem |
| **A8** | Bestandsnutzer vorab informieren | Betreiber | Fairness und AGB-Änderungsfrist. Niemand wird automatisch kostenpflichtig |
| **A9** | **Bestandsschutz anlegen, bevor der Schalter umgelegt wird** | Betreiber | **Am 04.09.2026 in der Produktionsdatenbank nachgemessen — nicht geschätzt.** Siehe Kasten unten. Skript liegt fertig: `scripts/sql/bestandsschutz-vor-billing.sql` |

### A9 im Detail — der Schalter sperrt heute die eigenen Nutzer aus

Die Tabelle `abos` ist **leer**. `getAbo()` liefert für ein Konto ohne Zeile `null`, und
`effektiverPlan(null)` ist `"kostenlos"` — also **eine Einheit** und keine der Funktionen
ab Privat (NK-PDF, Steuer/Anlage V, Dokument-Generator, Mieterportal).

Stand 04.09.2026, live abgefragt:

| | |
|---|---|
| Zeilen in `abos` | **0** |
| Konten insgesamt | 22 |
| davon mit Objekten | 11 (36 Einheiten) |
| **würden sofort gesperrt** (über 1 Einheit) | **5** |
| davon auch über dem Privat-Limit (5) | 4 |
| größtes Konto | 8 Einheiten |

`BILLING_ENFORCED=true` würde damit **alle 22 Konten auf Kostenlos setzen — auch das des
Betreibers** — und fünf davon auf der Stelle über ihr Limit heben. Ohne Vorwarnung und
ohne dass jemand etwas falsch gemacht hätte.

**Gegenmittel:** `scripts/sql/bestandsschutz-vor-billing.sql` (Abschnitt A ansehen,
B ausführen, C gegenprüfen, **dann erst** den Schalter). Es vergibt „Plus" mit
`provider = 'bestandsschutz'` und `status = 'testphase'` — erkennbar als das, was es ist,
und nicht mit einem Paddle-Abo zu verwechseln.

**Zwei Dinge, die man dabei falsch machen kann:**
1. **Zu früh ausführen.** Das Skript versorgt die Konten, die es vorfindet. Wer es Wochen
   vorher laufen lässt, lässt jedes danach angelegte Konto ungeschützt.
2. **Auf `gueltig_bis` vertrauen.** `effektiverPlan()` wertet die Spalte **nicht** aus
   (geprüft) — maßgeblich ist allein `status`. Der Bestandsschutz endet erst, wenn jemand
   ihn aktiv beendet (Abschnitt D des Skripts). Das ist Absicht.

Das Demo-Konto ist damit **mit**versorgt — und darauf angewiesen: Die Dokument-PDF-Route
ist seine einzige erlaubte Schreib-/Erzeugungsfunktion; auf „Kostenlos" liefe sie in die
Tarif-Schranke, und das Schaustück könnte sein wichtigstes Dokument nicht mehr zeigen.

---

## B. Blockiert die breite Öffnung (auch ohne Bezahlung)

Sobald mehr als eine Handvoll Vermieter echte Mieterdaten erfassen.

| # | Was | Wer | Anmerkung |
|---|---|---|---|
| **B1** | **Impressum, Datenschutz, AGB und AVV anwaltlich prüfen** | Anwalt | Alle vier existieren und sind inhaltlich abgeglichen. Im Impressum steht im Code selbst: „Vor Produktivbetrieb rechtlich prüfen lassen" |
| **B2** | **Brevo-AVV** im Konto abschließen | Betreiber | Der DPA gilt ohne Unterschrift (wörtlich belegt), aber die **Firmendaten im Konto lauten auf die falsche Partei** — sonst geht der Vertrag ins Leere. Dazu: Zustelladresse für die 10-Werktage-Ankündigungen prüfen |
| **B3** | Verarbeitungsverzeichnis + TOM: Platzhalter füllen | Betreiber | `docs/dsgvo.md` und `docs/TOM.md` stehen, TOM ist als **Entwurf** markiert. U. a. 2FA auf den Admin-Zugängen bestätigen |
| **B4** | Support-Kanal mit zugesagter Reaktionszeit | Betreiber | Die 24-h-Zusage steht auf `/hilfe` **und** muss zu den AGB passen |
| **B5** | Stichprobe: meldet sich ein Altkonto mit kurzem Passwort noch an? | Betreiber | Die 8-Zeichen-Regel gilt für neue/geänderte Passwörter, nicht rückwirkend |

---

## C. Kostet Geld, verbessert die Sicherheit

| # | Was | Preis | Anmerkung |
|---|---|---|---|
| **C1** | Supabase Pro für Leaked Password Protection | ~25 $/Monat | Auf Free ist der Schalter **sichtbar, aber wirkungslos** — am 29.07. empirisch belegt. Wer ihn dort umlegt, hält den Schutz für aktiv |
| **C2** | 2FA für Nutzerkonten | Entwicklungszeit | Existiert nicht — heute erneut geprüft, kein Treffer im Code. Bei Bank- und Mieterdaten ein spürbares Argument |

---

## T. Technische Kleinigkeiten (keine Startblocker)

| # | Was | Aufwand | Anmerkung |
|---|---|---|---|
| **T1** | Test, der `PLAENE` (Preisseite) gegen `FEATURE_AB_PLAN` (Code) prüft | klein | Zwei Quellen für dieselbe Aussage. Heute stimmen sie überein — nichts hält sie synchron. Fällt sonst erst auf, wenn ein zahlender Kunde etwas nicht bekommt, das die Preisseite versprach |
| **T2** | Tests für `lib/actions/` — **begonnen 04.09.2026**, 11 von 29 Dateien | mittel | Siehe Kasten unten. Prüfstand steht, 195 Verhaltenstests, jeder gegen absichtlich eingebaute Fehler geprüft. **Dabei ZWEI echte Fehler gefunden und behoben** (doppelte Mieteinnahmen · Tausenderpunkt in Handwerker-Beträgen). Offen: 18 Dateien, ~2.500 Zeilen |
| **T3** | `loading.tsx` für die restlichen Seiten | klein, repetitiv | 12 von 66 Seiten haben eine |
| **T4** | Design Runde 2 der **App** (nicht der Website) | mittel | Die Website ist am 02.09. überarbeitet. In der App offen: 11px-Kleinsttexte auf 12px, Binnennavigation für lange Mobilseiten |
| **T5** | Abo-Zugangscode | klein | Fundament (`einladungscodes` + Signup-Trigger) steht. Mit Paddle-Checkout **nicht mehr zwingend** |

### T2 im Detail — Stand 04.09.2026

**Der Ausgangsbefund war schärfer als „eine Testdatei berührt `lib/actions`":
KEINE Testdatei hat `lib/actions` jemals ausgeführt.** `tests/registrierung.test.ts`
liest die Action per `readFileSync` und sucht Zeichenketten darin. Das hält eine
Schreibweise fest, nicht ein Verhalten — solche Tests bleiben grün, wenn die Logik
darunter umgebaut wird.

**Gebaut:** `tests/stubs/actionHarness.ts` — ersetzt `next/cache`, `next/navigation`
und die beiden Supabase-Clients, sonst nichts. Die Action läuft unverändert. `redirect()`
**wirft** in der Attrappe, wie in Next auch; ein stiller No-op würde Code nach einem
Redirect weiterlaufen lassen, der in Produktion nie erreicht wird.

**Der Punkt, der T2 überhaupt rechtfertigt — beim Testschreiben gefunden:**

`lib/actions/mietkonto.ts` baute die Obergrenze der Dubletten-Abfrage als
`` `${monat}-31` ``. **Den 31. gibt es im Februar, April, Juni, September und November
nicht.** PostgREST castet den Wert auf `date`, Postgres antwortet mit `22008` — und weil
der Fehler nicht ausgewertet wurde, kam die Abfrage still leer zurück. In **fünf von zwölf
Monaten** fielen damit alle Altzeilen ohne `soll_monat` aus dem Dublettenschutz, und die
Nacherfassung legte Mieteingänge ein zweites Mal an: **unbemerkt doppelte Mieteinnahmen in
Cashflow und Anlage V.** Gegen die Produktionsdatenbank nachgestellt, nicht vermutet.

Behoben: exklusive Obergrenze (erster Tag des Folgemonats) **und** die Abfragefehler werden
jetzt ausgewertet — schlägt die Prüfung fehl, wird gar nichts gebucht. Doppelt erfasste
Mieteinnahmen wandern in die Steuererklärung; eine Fehlermeldung kostet nur einen zweiten
Anlauf. Drei Tests sperren den Fehler.

**Abgedeckt (11 Dateien, 195 Tests):**

| Datei | Was abgesichert ist |
|---|---|
| `buchungen.ts` | Betrag > 0, Komma-Zahlen, NK-Anteil in Grenzen, Restschuld-Vorbelegung, verschlüsselte Darlehensnummer, Open-Redirect-Schutz, Upload-Grenzen und Pfadbildung |
| `properties.ts` | Einheiten-Schranke (Early Access + scharf), `notiz_import` wird nicht geleert, Koordinaten-Reset bei Adressänderung, Wert-Übernahmen |
| `freischaltung.ts` | Exakter Code-Vergleich, Vorrang von `BETA_CODE`, leere Env sperrt, Zustimmung, Zugriffsbremse, Vormerkung |
| `ibans.ts` | IBAN nie im Klartext, Blind-Index deterministisch, Prüfziffer, fehlender Schlüssel bricht **vor** dem ersten DB-Zugriff ab |
| `einladung.ts` | Codeformat ohne verwechselbare Zeichen, Mieter gehört dem Vermieter, eingelöste Codes bleiben |
| `umlage.ts` | Verteilung in EINER Transaktion, Flächen erst **nach** der Verteilung, keine Fläche wird mit 0 überschrieben, Flächen-Fehler wird gemeldet statt verschluckt, fremde Mieter-IDs laufen ins Leere |
| `mietkonto.ts` | Miet-Monat als Schlüssel (nicht Zahlungsdatum), Altzeilen ohne `soll_monat`, gültige Abfragegrenzen für **alle zwölf** Monate, kein Buchen bei fehlgeschlagener Prüfung |
| `positions.ts` | Weißliste der Aufteilungsarten, Vorjahr als Ziel des OCR-Imports, Gesamtkosten-vs-Wohnungsanteil, OCR-Updates nur am eigenen Mieter |
| `wiederkehr.ts` | Zyklus-Weißliste, Ende-vor-Start, **Dedup beim zweiten Klick**, richtige Zieltabelle je Art, alle Änderungen auf das eigene Konto eingeschränkt |
| `beleihung.ts` | Weißliste der Checklisten-Punkte, 8-MB-Grenze, Verschlüsselung sensibler Dateien, Freigabe-Links (Schlüsselfilter, 7/14/30 Tage, Widerruf statt Löschen) |
| `service.ts` | Der Handwerker kann sich **nichts selbst freigeben** (Antrag entsteht immer im Status `freigabe`), Zugehörigkeit von Partner/Mieter/Objekt/Firma, § 35a-Lohnanteil ≤ Gesamtbetrag, MIME-Weißliste, **keine doppelte Kostenübernahme** |

**Wie geprüft, dass die Tests etwas taugen:** In jede getestete Datei wurden nacheinander
Fehler eingebaut (Prüfung entfernt, Verschlüsselung ausgehängt, Großschreibung
wiederhergestellt, Schranke umgangen, …) — **jede einzelne Mutation wurde rot**. Ein Test,
der beim ersten Lauf grün ist und nie rot war, beweist nichts.

**Zweiter Fund (04.09.2026): Tausenderpunkte in Handwerker-Beträgen.**
`parseBetrag` in `service.ts` las einen Punkt ohne Komma immer als Dezimaltrennzeichen.
In einer deutschsprachigen App wurde damit aus **„1.000" ein Euro** statt tausend; bei
„12.345" war das Ergebnis (12,35) unter **beiden** Lesarten falsch. Der Betrag kommt vom
Handwerker und wird vom Vermieter per Klick zur Kosten-Buchung — der Fehler wäre in die
Steuerauswertung gelaufen, und zwar zu niedrig.
Behoben **nicht** mit einer neuen Regel, sondern über das bereits vorhandene
`zahlDe()` aus `lib/zahl.ts`: Dort ist die deutsche Lesart schon korrekt gelöst und
zusätzlich feiner (Ausnahme für führende Nullen, „0.500" bleibt ein halber Euro). Damit
eine Kopie dieser Logik weniger. `lib/importCsv.ts` hatte den Fall bereits richtig —
geprüft, nicht angefasst.

**Offen:** 18 Dateien, ~2.500 Zeilen. Die nächsten nach Nutzen: `bewerber.ts` (218 Z.),
`termine.ts` (212), `anliegen.ts` (189), `makler.ts` (177), `bewerbenPublic.ts` (157).
`components/` bleibt komplett offen — dafür bräuchte es eine DOM-Umgebung, die das Projekt
bisher nicht hat.

**Lehre aus dem Mietkonto-Fund:** Der Fehler steckte direkt unter einem Kommentar, der
dieselbe Fehlerklasse als behoben beschrieb. Ein Kommentar ist kein Nachweis — er hält
fest, was gemeint war, nicht was der Code tut.

---

## Terminiert

- **Ab 01.01.2027:** Ratgeber-Artikel zur Fernablesepflicht entschärfen — er wirbt mit
  der dann abgelaufenen Frist 31.12.2026 (Details in `CLAUDE.md`).

---

## Ausdrücklich NICHT nötig

Damit niemand sie versehentlich wieder aufmacht:

- **Search-Console-Adressänderung** — entfällt, `.store` war nie eine Property.
- **Weitere Arbeit an den Domain-Weiterleitungen** — abgeschlossen, bewusst so belassen.
- **Redesign der Unterseiten** — geprüft und verworfen: Sie haben ein bis zwei
  Abschnittsköpfe, nicht neun wie die Startseite. Dort gibt es keine Monotonie zu brechen.
- **Business-Tarif mit Checkout** — bewusst „auf Anfrage" per E-Mail.
- **Eigenes Rechnungsmodul** — bewusst nicht gebaut (E-Rechnung § 14 UStG zu riskant).
- **Open Banking** — zurückgestellt, Konzept in `docs/zukunft/OPEN-BANKING.md`.

---

## Die kürzeste ehrliche Antwort

Vor dem ersten Euro stehen **drei Anwaltsfragen** (A1–A3), davon ist **A2 (StBerG)** die
einzige, die im ungünstigen Fall ein Feature kostet und nicht nur einen Textbaustein.
Alles Technische daneben ist überschaubar: Paddle einrichten, den Bestandsschutz anlegen
(**A9**) und zwei Schalter umlegen. **A5 ist erledigt** — die Schranken warten nur noch
darauf, dass jemand `BILLING_ENFORCED=true` setzt.

Und genau darin liegt die verbliebene Falle: Der Schalter ist ein Einzeiler, seine Wirkung
ist es nicht. **A9 vorher erledigen**, sonst sperrt der erste Schritt Richtung Umsatz die
Nutzer aus, die bis dahin geblieben sind.
