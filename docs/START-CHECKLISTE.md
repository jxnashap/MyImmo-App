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
| **T2** | Tests für `lib/actions/` — **begonnen 04.09.2026**, 15 von 35 Dateien | mittel | Siehe Kasten unten. Prüfstand steht, Verhaltenstests jeweils gegen absichtlich eingebaute Fehler geprüft. **Dabei VIER echte Fehler gefunden und behoben** (alle bei Zahlen oder Dubletten) plus **drei systematische Durchgänge** — Zahlen-Eingänge, Datei-Auslieferung, stille Schreibfehler —, die je einen Wächter-Test über ALLE 35 Dateien hinterlassen haben. Offen: 20 Dateien, ~1.755 Zeilen |
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

**Abgedeckt (15 Dateien, 275 Tests):**

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
| `zaehler.ts` | Zählerstand mit Tausendertrennzeichen, **drei Nachkommastellen für Gas/Wasser bleiben erhalten**, Arten- und Foto-Weißlisten, Differenz nur vorwärts, keine Doppelübernahme, Vormeldung nach Zählerart |
| `anliegen.ts` | Empfänger (Vermieter/Wohnung/Mieter) kommt aus `mieter_zugaenge`, **nie aus dem Formular**; Typ- und Status-Weißlisten; Anhänge werden **vor** dem Anlegen geprüft; Mieter bestätigt über `mieter_user_id`, Vermieter schlägt über `vermieter_id` vor |
| `bewerber.ts` | Steckbrief-Zahlen über `zahlDe()`, Slot- und Ausstattungs-Weißlisten, Freitext-Kappung, **DSGVO-Löschung trifft nur eigene, abgelehnte, ältere als 6 Monate**, Dokument-Download nur mit eigener `user_id`, E-Signatur nur als PNG |
| `bewerbenPublic.ts` | **Die einzige Action ohne Login.** IP-Bremse (greift vor der Token-Prüfung), Token-Format, Unterschrift nur als PNG-Data-URL, Datei-Weißliste (**kein SVG**), 6-MB-Grenze, Slot-Weißliste, Verschlüsselung der Nachweise, keine Interna in Fehlermeldungen |
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

**Geprüft, kein Befund (07.09.2026):** Die IP-Bremse der öffentlichen Bewerbung hängt an
`x-forwarded-for`. Laut Vercel-Dokumentation überschreibt Vercel diesen Header und leitet
externe Werte nicht weiter — ausdrücklich „to prevent spoofing"; Ausnahme nur bei
Enterprise-Trusted-Proxy. Der Wert ist dort also vertrauenswürdig. Steht als Kommentar im
Test, damit es niemand später „repariert".

**Dritter Fund (07.09.2026): Dezimalpunkt im öffentlichen Steckbrief.**
`aktualisiereBewerberLink` in `bewerber.ts` entfernte mit `.replace(/\./g, "")` **alle**
Punkte — ohne Ansehen der Stellung. Die Steckbrief-Felder sind **Textfelder** (geprüft in
`BewerbungenManager.tsx`), es kommt also an, was getippt wurde: aus „1200.50" wurden
**120.050 €**, aus „0.5" eine 5. Das steht anschließend öffentlich im Steckbrief, den jeder
Bewerber sieht. Behoben über `zahlDe()` — derselbe Helfer wie beim zweiten Fund; damit ist
die Regel aus `CLAUDE.md` jetzt an beiden Stellen umgesetzt, an denen sie verletzt war.

**Vierter Fund (07.09.2026): Zählerstand tausendfach daneben — und warum `zahlDe()`
hier NICHT die Lösung war.**
`meldeZaehlerstand` las den Stand mit `parseFloat(s.replace(",", "."))`. Das ersetzt nur
das **erste** Komma und lässt die Punkte stehen: aus „14.382,5" wurde **14,382**. Der Wert
wandert über die Übernahme als Differenz in die Verbrauchsbuchung und von dort in die
**Nebenkostenabrechnung des Mieters**. Das Feld ist ein Textfeld (`inputMode="decimal"`
steuert nur die Handy-Tastatur).

**Hier wäre der Reflex falsch gewesen:** `zahlDe()` deutet einen Punkt vor drei Ziffern als
Tausenderpunkt — bei Gas- und Wasserzählern mit drei Nachkommastellen („5123.456" m³)
würde daraus 5.123.456. Die Euro-Heuristik gilt für Zähler nicht. Behoben wurde deshalb nur
der **eindeutige** Fall (Komma vorhanden → Punkte sind Tausender), plus `Number` statt
`parseFloat`, damit „123abc" nicht stillschweigend zu 123 wird. Der Rest bleibt mehrdeutig
und ist als solcher dokumentiert.

### Systematischer Durchgang „Zahlen aus Nutzereingaben" (07.09.2026) — abgeschlossen

Drei der vier Funde waren **derselbe Fehler**: eine von Hand gebaute Zahlenlesart an einem
**Textfeld**. Statt weiter Datei für Datei zu testen, wurden deshalb **alle** Stellen
durchgegangen, an denen eine Zeichenkette zur Zahl wird — Server-Actions und Oberfläche,
maschinell erhoben und je Stelle gegen die Feldart geprüft.

| | |
|---|---|
| Umwandlungsstellen gesamt | 33 in 26 Dateien |
| Textfelder mit Zahl-Verdacht | 22 (maschinell), davon 5 echt |
| **weitere Funde** | **0** |

Die fünf echten Textfeld-Zahlen: Zählerstand (behoben), Handwerker-Betrag und Lohnanteil
(behoben), Selbstauskunft und Darlehens-Assistent (nutzten `zahlDe0()` bereits korrekt).
Die Beleihungs-Eingaben sind zwar Textfelder, werden aber **nie gerechnet** — sie gehen als
Text an die Bank.

**Damit der Durchgang etwas wert bleibt: `tests/zahlenEingaenge.test.ts`.** Der Test hält
den geprüften Stand fest — je erlaubter Stelle eine Begründung, warum die handgebaute
Lesart dort in Ordnung ist. Kommt eine **neue** dazu, wird er rot und erzwingt die Frage,
die dreimal falsch beantwortet war: Zahlen- oder Textfeld? Zusätzlich festgenagelt: die
drei reparierten Stellen bleiben repariert, und `zaehler.ts` wird **nicht**
„zur Vereinheitlichung" auf `zahlDe()` umgestellt.

### Zweiter Durchgang: Auslieferung hochgeladener Dateien (08.09.2026)

Nach demselben Muster wie bei den Zahlen — nicht Datei für Datei, sondern die Klasse als
Ganzes. **Sieben Routen** geben hochgeladene Dateien zurück; sie nahmen den gespeicherten
`Content-Type` unverändert und lieferten standardmäßig **`inline`** aus. Vier Upload-Pfade
(`beleihung`, `makler`, `buchungen`, `archiv`) haben **keine MIME-Weißliste**.

**Warum die CSP das nicht auffing:** Sie ist streng (`script-src 'self' 'nonce-…'`), ein
Inline-Skript wäre blockiert. Aber `'self'` erlaubt Skripte von **jedem Pfad der eigenen
Domain** — auch von einer hochgeladenen `.js`-Datei, ausgeliefert über ihre eigene Route
mit einem MIME-Typ, den der Hochladende bestimmt.

**Behoben an der Auslieferung** (`lib/net/dateiKopf.ts`), nicht am Upload: Eine Weißliste
beim Hochladen würde den Altbestand in der Datenbank nicht erfassen. Nur PDF und Bilder
gehen inline, alles andere wird zum Download gezwungen; `nosniff` immer, Dateiname
bereinigt.

**Schwere, ehrlich:** Der Angreifer muss ein registrierter Vermieter sein und jemanden dazu
bringen, seinen Freigabe-Link zu öffnen — `/beleihung/<token>/datei/<key>` ist die einzige
dieser Routen ohne Login. Kein Selbstläufer, aber der Schaden träfe eine fremde Sitzung auf
der eigenen Domain, und die Gegenmaßnahme kostet nichts.

### Dritter Durchgang: stille Schreibfehler (08.09.2026)

Dieselbe Bauart, dritte Klasse. Untersucht wurden **alle 128 Schreiboperationen** in
`lib/actions/` — auf zwei Fragen: Kann jemand über Mandantengrenzen hinweg schreiben?
Und: Wird ein fehlgeschlagener Schreibvorgang bemerkt?

**Frage 1 — kein Befund, und das ist ein Ergebnis.** 38 Schreibzugriffe schränken nur über
`.eq("id", …)` ein, ohne eigenen Mandantenfilter. Live gegen die Datenbank geprüft: **alle
45 Tabellen** in `public` haben RLS aktiv, und jede dieser Tabellen hat eine UPDATE/DELETE-
Policy auf `auth.uid() = user_id` bzw. `vermieter_id`. Ein Zugriff quer über Konten ist
damit nicht möglich. In `deleteIban` und `deleteProperty` steht der Filter trotzdem jetzt
ausdrücklich dabei — nicht wegen RLS, sondern weil eine fremde ID sonst ein stilles
Treffer-Null erzeugt, das wie ein Erfolg aussieht.

**Frage 2 — 20 Befunde.** So viele Schreiboperationen werteten den `error` gar nicht aus
und gaben danach bedingungslos `{ ok: true }` zurück. Vier davon sind mehr als Kosmetik:

| Stelle | Was der Nutzer sah | Was tatsächlich galt |
|---|---|---|
| `widerrufeServiceCode` | „widerrufen" | Der Zugangscode blieb einlösbar |
| `widerrufeEinladung` | „widerrufen" | dito, beim Mieter-Zugangscode |
| `erzeugeEinladungscode` | neuer Code da | Der alte wurde nicht gelöscht → **zwei gültige Codes** |
| `uebernimmAuftragAlsKosten` | „gebucht" | `kosten_id` nicht gesetzt → der nächste Klick legt eine **zweite Kosten-Buchung** an |

Der letzte Fall ist derselbe Doppelbuchungs-Fehler wie in `mietkonto.ts`, nur an anderer
Stelle — und er wäre in die Steuerauswertung gelaufen.

**Die zweite Hälfte steckte in der Oberfläche.** Alle DeleteButton-Stellen riefen die Action
als `action={async () => { await x(); }}` auf und warfen die Rückgabe weg; der Knopf meldete
danach „Gelöscht.". Serverseitig einen Fehler zurückzugeben nützt nichts, solange der
Aufrufer ihn verwirft. Die Entscheidung liegt jetzt in **`lib/actionErgebnis.ts` →
`actionFehler()`** — eine Stelle statt in jedem Aufrufer neu, und ohne DOM prüfbar.

**Bewusst NICHT umgesetzt: „0 betroffene Zeilen" als Fehler zu werten.** Ein per RLS
geblocktes UPDATE liefert keinen Fehler, sondern null Zeilen. Das gilt aber genauso für ein
doppelt ausgelöstes Löschen und für die Demo-Sperre, die genau so funktioniert. Daraus
einen Fehler zu machen, würde harmlose Fälle zu Fehlermeldungen erheben.

**Wächter: `tests/schreibFehler.test.ts`** — findet jede neue Schreiboperation ohne
Fehlerauswertung und jede Aufrufstelle, die die Rückgabe wegwirft. Alle Verhaltenstests
wurden gegen absichtlich eingebaute Fehler geprüft (11 Mutationen, alle rot).

### Paket A abgearbeitet: Termine, CO₂, Bewertung (08.09.2026)

Erstes von vier Paketen des restlichen T2 — nach Nutzen sortiert, nicht nach Dateigröße:
die drei Dateien, in denen sich verrechnen lässt. 47 neue Verhaltenstests, jeder gegen
absichtlich eingebaute Fehler geprüft (25 Mutationen, alle rot).

**Der schwerwiegendste Fund war der Wächter selbst.** `schreibFehler.test.ts` meldete
`lib/actions/bewertung.ts` als sauber — er hatte die Datei nie angesehen. Der Erkenner
zählte Klammern im Rohtext, und die Kommentare `// 1)` … `// 5)` in dieser Datei enthalten
schließende Klammern ohne öffnende. Die Klammertiefe rutschte ins Negative, es wurde keine
einzige Anweisung mehr erkannt, und der Test war grün. Dahinter lagen **vier Schreibvorgänge
ohne jede Fehlerauswertung**: der berechnete Marktwert, der Vergleichsangebots-Schnappschuss
(Löschen und Einfügen) und die Wert-Historie. Der Knopf meldete „Aktualisiert", während
nichts gespeichert war.
Behoben in `tests/stubs/tsAnweisungen.ts` (Kommentare und Zeichenketten werden entfernt,
bevor gezählt wird) **plus einem Test, der beweist, dass der Erkenner hingesehen hat**.
Merksatz: Ein Wächter, der still nichts findet, ist schlimmer als keiner.

**Vierte Fehlerklasse gefunden: Prüf-Abfragen, die fail-open scheitern.** Der dritte
Durchgang hatte nur SCHREIB-Vorgänge betrachtet. Eine Abfrage, deren LEERES Ergebnis
„dann leg los" bedeutet, ist genauso gefährlich — eine fehlgeschlagene Abfrage kommt
ebenfalls leer zurück. Von 40 Lese-Abfragen ohne Fehlerauswertung waren **sieben** von
dieser Sorte, alle behoben:

| Stelle | Was ohne die Prüfung passiert |
|---|---|
| `mietkonto.ts` (Einzelbuchung) | Mieteingang doppelt in Cashflow und Anlage V — der Fix vom 04.09. betraf nur die Nacherfassung |
| `nkco2.ts` | CO₂-Vermieteranteil doppelt in den Werbungskosten |
| `wiederkehr.ts` | Die Vorlage legt **alle** ihre Buchungen ein zweites Mal an |
| `properties.ts` | Zweite Miet-Vorlage → Miete doppelt im Cashflow |
| `termine.ts` | Folgetermin doppelt |
| `bewertung.ts` | Wert-Historie bekommt bei jedem Lauf denselben Wert erneut |
| `zaehler.ts` | Verbrauch eines ganzen Zeitraums fehlt dauerhaft in der NK-Abrechnung |

Die übrigen 33 Lese-Abfragen scheitern fail-closed (`if (!x) return …`) oder reichern nur
Anzeigetexte an; sie bleiben bewusst wie sie sind.

**Zwei weitere Funde in `termine.ts` / `lib/termine.ts`:**
- `updateTermin` hatte ein **kommentarloses `return`**, wenn Titel oder Datum fehlten —
  derselbe Fall, den `createTermin` zwanzig Zeilen darüber ausdrücklich als Fehler
  beschreibt („der Nutzer klickte ein zweites Mal"). Beim Bearbeiten stand er noch drin.
- `naechsteFaelligkeit` rechnete **zeitzonenabhängig**: `new Date("2026-03-15")` (UTC)
  gemischt mit `getDate()`/`setDate()` (Ortszeit) und `toISOString()` (wieder UTC).
  Gemessen: `TZ=Europe/Berlin` schob den 15.03. um einen Monat auf den **14.04.**
  (Sommerzeit), `TZ=America/New_York` den 31.01. auf den **01.03.** Auf Vercel läuft alles
  in UTC, produktiv war das Ergebnis richtig — es hing aber an einer Einstellung, die
  niemand hier verwaltet. Jetzt reine Kalenderarithmetik; ein Test vergleicht vier Zonen.

**Falle im Prüfstand, die dabei aufflog:** Ohne `vi.resetModules()` liefert ein zweites
`await import` in DEMSELBEN Test das gecachte Modul — es hängt noch an der ersten Attrappe,
und der frische `db` bleibt leer. Ein Test mit einer Schleife über mehrere Eingaben prüft
dann nur den ersten Durchlauf. `resetModules()` steht jetzt in jedem `lade()`-Helfer aller
15 Action-Testdateien; alle blieben grün, es war also nichts kaputt — aber es war Zufall.

### Paket B abgearbeitet: Fremdzugriff (08.09.2026)

`beleihungPublic.ts`, `archivFreigabe.ts`, `makler.ts` — 28 Verhaltenstests, 16 Mutationen,
alle rot. **Kein Codefund.** Das ist nach vier Durchgängen mit je einem Fund die erste
Runde ohne — und verdient eine Einordnung: Die drei Dateien sind klein, spät entstanden
und haben die Muster bereits, die die Funde anderswo vermissen ließen. `archivFreigabe.ts`
benutzt sogar das beste Muster der Codebasis: `.update().select().maybeSingle()` mit
`error || !data` — damit fällt auch das RLS-Treffer-Null auf, das sonst wie Erfolg aussieht.
Wer eine neue Schreib-Action baut, kopiert am besten von dort.

Festgehalten für `beleihungPublic.ts`: Die Bremse greift **vor** der Token-Prüfung (sonst
ließe sich der Token-Raum kostenlos abtasten), die Zeichen-Kappung (200/300/4000, je Eintrag
100) sitzt in der RPC, die Zeilen-Kappung (30) in der Action; ein DB-Fehler verrät nichts.
`makler.ts` ist der Zwilling von `beleihung.ts` — die Tests spiegeln das; einziger Unterschied
ist die Bindung an den Nutzer statt ans Objekt.

### Paket C abgearbeitet: Import und Bestand (08.09.2026)

`importDaten.ts`, `dokumente.ts`, `archiv.ts` — 31 Verhaltenstests, 21 Mutationen, alle rot.

**Die Hypothese „Teilerfolg als Erfolg gemeldet" hat sich NICHT bestätigt.** Der Import
schickt alle Zeilen in EINEM `insert(rows)`; Postgres führt eine Anweisung ganz oder gar
nicht aus. Scheitert Zeile drei, bleibt nichts stehen. Ein Test hält fest, dass es EIN
Aufruf bleibt — wer ihn in eine Schleife umbaut, wird rot.

**Zwei Funde, beide aus der vierten Klasse (fail-open-Abfragen):**
- `importDaten.ts`: Die Objektliste für die Mieter-Zuordnung wurde ohne Fehlerauswertung
  gelesen. Käme sie wegen eines Fehlers leer zurück, würden **alle Mieter ohne Objekt**
  angelegt — und „n ohne Objekt" sähe aus wie ein Namensproblem der Eingabe.
- `dokumente.ts`: Die Mieter-Abfrage vor dem Archivieren wertete den Fehler nicht aus
  und filterte nicht auf den Nutzer. Bei einem Abfragefehler landete das PDF **ohne
  Objekt-Zuordnung** im Archiv — unter dem Objekt nicht zu finden, aber „gespeichert".

Damit steht die vierte Klasse bei **neun** Fundstellen. `archiv.ts` bekam den
`user_id`-Filter für Bearbeiten/Löschen, wie die übrigen Actions.

**Geprüft, kein Befund:** Das Archiv-Bearbeitungsformular schickt alle fünf Felder mit —
der `notiz_import`-Fehler aus `properties.ts` (nicht mitgeschicktes Feld wird mit null
überschrieben) tritt hier nicht auf.

**Notiert, nicht geändert:** Importierte Objekte bekommen keine Miet-/Hausgeld-Vorlage
(`autoBuchungen` läuft nur in `createProperty`). Kein Fehler, aber eine Lücke im Produkt —
wer 20 Objekte importiert, muss 20 Vorlagen von Hand anlegen.

**Offen:** 11 Dateien, ~650 Zeilen — nach drei Durchgängen ohne bekanntes Zahlen-,
Datei- oder Schreibfehler-Risiko.
**Zahl am 08.09.2026 korrigiert:** Hier stand „14 von 29". Tatsächlich enthält
`lib/actions/` **35** Dateien, und 15 werden von Tests importiert — offen sind also **20**,
nicht 14. Die alte Zahl entstand daraus, dass Dateien, die nur beiläufig in einer anderen
Testdatei mitliefen, als abgedeckt gezählt wurden.
Als Nächstes **Paket D**, der Rest: `tenants.ts` (100), `einschaetzung.ts` (98),
`vermieterAnfragen.ts` (95), `mietzeitraeume.ts` (94), `account.ts` (74), `selbstauskunft.ts` (56),
`kalkulation.ts` (56), `firmen.ts` (50), `billing.ts` (48), `vermieter.ts` (38),
`dokumentVorlagen.ts` (37). Danach ist T2 geschlossen.
`components/` bleibt komplett offen — dafür bräuchte es eine DOM-Umgebung, die das Projekt
bisher nicht hat. (`actionFehler()` ist die Ausnahme: Die Logik wurde bewusst aus dem
Bauteil herausgezogen, damit sie ohne DOM prüfbar ist.)

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
