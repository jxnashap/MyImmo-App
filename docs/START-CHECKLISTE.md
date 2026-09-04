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
| **A9** | **Demo-Konto vor dem Scharfschalten versorgen** | Betreiber/Entwicklung | Die Dokument-PDF-Route ist die **einzige Ausnahme des Demo-Kontos**. Mit aktivem Billing hätte das Demo-Konto Tarif „Kostenlos" → die Ausnahme wäre tot. Entweder dem Demo-Konto eine Zeile in `abos` geben oder in der Route auf `istDemoKonto` prüfen. Der Hinweis steht als Kommentar in der Route |

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
| **T2** | Tests für `lib/actions/` und `components/` | mittel | 53 Testdateien, davon **eine** berührt `lib/actions`. Die Geschäftslogik ist praktisch ungetestet |
| **T3** | `loading.tsx` für die restlichen Seiten | klein, repetitiv | 12 von 66 Seiten haben eine |
| **T4** | Design Runde 2 der **App** (nicht der Website) | mittel | Die Website ist am 02.09. überarbeitet. In der App offen: 11px-Kleinsttexte auf 12px, Binnennavigation für lange Mobilseiten |
| **T5** | Abo-Zugangscode | klein | Fundament (`einladungscodes` + Signup-Trigger) steht. Mit Paddle-Checkout **nicht mehr zwingend** |

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
Alles Technische daneben ist überschaubar: Paddle einrichten, das Demo-Konto versorgen
(**A9**) und zwei Schalter umlegen. **A5 ist erledigt** — die Schranken warten nur noch
darauf, dass jemand `BILLING_ENFORCED=true` setzt.
