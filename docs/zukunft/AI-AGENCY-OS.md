# AI Agency OS — Bewertung des Entwurfs v1.0 und Fahrplan

**Status:** Bewertung, 02.09.2026. Nichts gebaut, nichts entschieden.
**Gegenstand:** „AI AGENCY OS — Company Constitution & CEO Operating System, Version 1.0"
(29 Agenten, Governance, Task-Lifecycle, Audit-Gate) vom Betreiber.
Verwandt: [[FINANZKONZEPT]] · [[MARKETING]] · [[MASTERPLAN]] · [[PROJEKT-STATUS]] · [[BEZAHLSYSTEM]]

---

## 0. Urteil in fünf Sätzen

1. Die **Prinzipien** des Entwurfs (Abschnitte 3, 9, 10, 11, 17–22, 30, 33, 36) sind besser als
   das, was die meisten Firmen zu KI aufschreiben — die gehören fast wörtlich behalten.
2. Das **Organigramm** (Abschnitte 6–8) und die **Maschinerie** (12, 15, 32) widersprechen dem
   eigenen Kernsatz „Simplicity over complexity" und werden von niemandem gepflegt werden.
3. Der Entwurf enthält **keine einzige Zahl** über den Zustand des einzigen Geschäfts, das er
   steuern soll — und die Zahlen sagen etwas anderes als der Plan unterstellt.
4. Der Engpass der Firma ist **nicht Orchestrierungskapazität**, sondern eine geschlossene Kasse,
   fehlende Nachfrage-Evidenz und die begrenzten Wochenstunden eines einzelnen Menschen im
   Nebenerwerb. Ein 29-Agenten-Apparat beschleunigt genau die Achse, die nicht klemmt.
5. Empfehlung: **v0.2 mit sechs Rollen**, fünf gemessenen Zahlen, einem Budgetdeckel und einem
   Abbruchkriterium — und der Bau des Apparats erst *nach* der Kassenöffnung.

---

## 1. Die gemessene Ausgangslage

Am 02.09.2026 direkt gegen die Produktionsdatenbank gezählt (Aggregate, keine Personendaten).
Diese Zahlen standen bisher **in keinem** Dokument des Projekts.

| Kennzahl | Wert |
|---|---|
| Konten gesamt (`auth.users`) | 22 |
| davon Rollen-Konten (2 Mieter, 1 Service, 1 Hausverwaltung) | 4 |
| davon Demo- / Test- / eigene Konten | 3 |
| **Externe Vermieter-Konten** | **15** |
| davon: mindestens 1 Objekt angelegt | 8 |
| davon: mindestens 1 Mieter angelegt | 5 |
| davon: mehr als 2 Einnahme-Buchungen | 3 |
| davon: mehr als 2 Kosten-Buchungen | 2 |
| davon: jemals an einem **zweiten Tag** eingeloggt | 3 |
| Aktive Konten (Login in den letzten 30 Tagen) | 8 |
| **Abos (`abos`)** | **0** |
| **Newsletter-/Vorlagen-Anmeldungen** | **0** |
| Objekte / Mieter gesamt | 29 / 31 |
| Buchungen gesamt (Einnahmen / Kosten) | 725 / 524 |

Wichtig zur letzten Zeile: Der Löwenanteil der Buchungen liegt auf dem **eigenen Konto und dem
Demo-Datensatz**. Die Zahlen sehen nach Nutzung aus, sind aber überwiegend Eigenbestand.

**Registrierungsverlauf:** Juni 11, Juli 7, August 3, September 1. Keine Wachstumskurve —
eher Wellen aus dem persönlichen Umfeld.

### Der echte Trichter

```
15 externe Anmeldungen
 →  8 legen ein Objekt an        (53 %)
 →  5 legen einen Mieter an      (33 %)
 →  3 buchen mehr als beiläufig  (20 %)
 →  3 kommen ein zweites Mal     (20 %)
 →  0 zahlen                     (Kasse ist zu — strukturell, nicht Nutzerschuld)
```

### Und die Lücke darüber

**Es gibt keine Trichter-Messung oberhalb der Registrierung.** `@vercel/analytics` ist nicht
installiert (nur `@vercel/speed-insights`), Vercel Web Analytics ist für das Projekt nicht
aktiviert (API antwortet mit 404). Wir wissen nicht, wie viele Menschen die Landing sehen,
welcher Ratgeber-Artikel trägt, und wo zwischen Besuch und Registrierung wie viele abspringen.

Das ist der schärfste Widerspruch zum Entwurf: Ein Dokument, das in Abschnitt 10 eine
**Evidenz-Hierarchie** definiert und „REAL DATA" auf Platz 1 setzt, wird für ein Produkt
geschrieben, für das keine Verhaltensdaten erhoben werden.

---

## 2. Risiken zuerst — was am Entwurf nicht trägt

### R1 · Der Entwurf verstößt gegen seinen eigenen Kernsatz
Abschnitt 2 sagt ausdrücklich, die Firma optimiere **nicht** auf „number of AI agents",
„complexity", „amount of documentation". Abschnitt 8 zählt dann 29 Agenten auf, Abschnitt 12
zwölf Task-Zustände, Abschnitt 15 sechs Memory-Ebenen und acht Memory-Typen, Abschnitt 17
fünf Berechtigungsstufen plus vier Schutzklassen.

Das ist kein Formfehler, sondern der Kern der Kritik: Das Dokument ist selbst das erste
Beispiel für „impressive-sounding analysis" und „activity without measurable progress".
Wer es ernst meint mit „Simplicity over complexity", muss beim eigenen Betriebssystem anfangen.

### R2 · Das Organigramm ist von einer Menschenfirma abgeschrieben
COO, CPO, CMO, CFO, getrennte Frontend- und Backend-Engineers — diese Rollen existieren in
echten Firmen, weil **Menschen** begrenzte Zeit haben, nicht weil die Aufgaben logisch trennbar
wären. Bei LLM-Agenten ist die knappe Ressource eine andere: **Kontextqualität, Werkzeugzugriff
und Überprüfbarkeit**. Ein Rollenschnitt, der diese drei nicht trennt, importiert die
Koordinationskosten einer Menschenorganisation, ohne ihren Nutzen mitzuimportieren.

Konkret an diesem Projekt:
- **Frontend- vs. Backend-Engineer**: MyImmo ist ein Next.js-Monolith mit Server Components und
  Server Actions. Derselbe PR fasst `app/`, `components/`, `lib/actions/` und eine Migration an.
  Die Trennung erzeugt eine Übergabe, wo vorher keine Naht war.
- **Social Media Manager, Performance Marketing**: [[MARKETING]] hat TikTok/Reels für die
  Zielgruppe (Ø 58 Jahre) begründet ausgeschlossen und Google Ads erst nach Kassenöffnung
  vorgesehen. Zwei Agenten ohne Arbeit — und Agenten ohne Arbeit erfinden sich welche.
- **Customer Success** bei 15 Konten und 3 Wiederkehrern: Das ist kein Prozess, das sind
  fünf Telefonate, die Jonas selbst führen sollte, weil das Gespräch die Information *ist*.

### R3 · A29 ist nicht unabhängig — jedenfalls nicht dort, wo es zählt
Abschnitt 10 sagt völlig richtig: „AI agreement is not independent real-world evidence."
Abschnitt 8/29 baut dann ein **Freigabe-Gate** auf genau diesem Mechanismus auf: Ein zweites
Sprachmodell prüft die Argumentation des ersten.

Zwei LLMs auf überlappenden Trainingskorpora, die denselben Kontext lesen, sind **korreliert**.
Ein solcher Auditor fängt Rechenfehler, Widersprüche und schwache Quellenlage — und genau das
ist wertvoll. Er fängt **nicht**, dass niemand für das Produkt zahlen will. Der einzige
unabhängige Auditor dieser Firma ist eine erfolgreiche Abbuchung.

Zweites, praktisches Problem: **Wie läuft dieses Audit?** Wenn Jonas Text zwischen zwei
Oberflächen kopiert, ist das Gate der Engpass, nicht die Absicherung — bei jeder Aufgabe.
Ein Gate, das manuell läuft, läuft irgendwann gar nicht mehr; dann steht es im Dokument, aber
nicht in der Wirklichkeit. Genau der Fehler, der in [[PROJEKT-STATUS]] schon einmal teuer war
(„Eine Liste, der man nicht trauen kann, ist schlechter als keine").

### R4 · Der Engpass ist nicht Orchestrierung
Der Apparat erhöht **Output pro Zeiteinheit**. MyImmo hat aber bereits:
66 Seiten, 430 TypeScript-Dateien, 439 Tests, 19 Ratgeber-Artikel, 8 PDF-Generatoren,
Mieterportal, Serviceportal, Kauf-Assistent, Marktwert-Engine, DATEV-Export, Demo-Modus.

Dem gegenüber: **8 Menschen, die je ein Objekt angelegt haben.** Das Verhältnis von gebauter
Funktion zu belegter Nachfrage ist bereits jetzt sehr weit auseinander. Mehr Bau-Kapazität
vergrößert diese Schere — plus Wartungsfläche, Rechtsfläche und Supportfläche.

Das ist nicht theoretisch: [[OPEN-BANKING]] wurde fertig gebaut und wieder ausgebaut, die
englische Fassung wurde nach 374-Dateien-Analyse verworfen. Beide Male hat die Firma Bauzeit
in Funktionen gesteckt, die kein gemessener Nutzer verlangt hat. Der Entwurf enthält in
Abschnitt 21 und 30 exakt die Regeln, die das verhindert hätten — sie sind der wertvollste
Teil des Dokuments und stehen im Widerspruch zum Rest, der Kapazität aufbaut.

### R5 · Der einzige Mensch kommt im Organigramm nicht als Ressource vor
Jonas steht als „Final Authority" oben — aber alle Genehmigungspfade (HIGH, CRITICAL,
WAITING_APPROVAL, A29-Eskalation, CEO Decision Report) enden bei **einer** Person, die das
Gewerbe im **Nebenerwerb** betreibt. Der Entwurf modelliert 29 Zulieferer und keinen
Durchsatz des Flaschenhalses.

Fehlt vollständig: Wie viele Stunden pro Woche stehen zur Verfügung? Wie viele Entscheidungen
verträgt das? Was passiert mit Aufgaben, die drei Tage auf Freigabe warten? Ohne diese Größe
ist jede Kapazitätsplanung Fiktion — und die realen Blocker (siehe R10) sind seit Wochen
genau die, die nur Jonas erledigen kann.

### R6 · Finanzdisziplin ohne eine einzige Zahl
Abschnitt 20 verlangt MAX TOKENS, MAX COST, MAX RUNTIME, MAX TOOL CALLS — und nennt keinen
Wert. Abschnitt 25 setzt einen CFO ein, der Runway, Burn und CAC verfolgen soll; keine dieser
Größen ist heute erhoben.

Der Apparat selbst ist die derzeit größte Kostenposition, die er verwalten soll: Ein Vorgang,
der durch Team-Bildung, mehrere Agenten, Audit und Revisionsschleife läuft, kostet ein
Vielfaches desselben Ergebnisses in einer Sitzung. Bei 0 € Umsatz ist das Geld, das aus einem
Nebenerwerbs-Budget kommt. **Ohne echten Deckel ist „Financial Discipline" eine Überschrift.**

### R7 · Zwei Governance-Systeme nebeneinander
Es gibt bereits ein funktionierendes Betriebssystem in diesem Projekt: `CLAUDE.md`
(verbindliche Regeln, Merkliste, terminierte Wiedervorlagen), der PR-Workflow
(Branch → Build+Tests → PR → Squash-Merge → Live-URL), die Migrationsregel, RLS,
App-Layer-Verschlüsselung, CI, der `docs/`-Vault als Gedächtnis.

Der Entwurf ignoriert das und spezifiziert daneben ein zweites (Abschnitt 15 „Memory System",
Abschnitt 12 Task-Lifecycle, Abschnitt 32 Architektur). Zwei Systeme heißt: eines wird
gepflegt, das andere wird zur Lüge. Die v0.2 muss `CLAUDE.md` **erweitern**, nicht überbauen.

Positiv: Abschnitt 19 (Production Rule) beschreibt fast exakt den PR-Workflow, der schon läuft.
Das ist der Beleg, dass die guten Teile des Entwurfs bereits gelebte Praxis sind.

### R8 · Ungeklärt: Agentur oder Holding?
Der Name sagt **Agency** (Dienstleistung für Kunden). Die Mission in Abschnitt 2 sagt
„Build, operate and scale profitable digital businesses" — das ist eine **Holding / ein Venture
Studio** (eigene Produkte). Das sind zwei verschiedene Firmen mit gegenläufiger Ökonomie:

| | Agentur (Kundenarbeit) | Studio (eigene Produkte) |
|---|---|---|
| Cash | sofort, pro Auftrag | erst nach Produkt-Markt-Fit |
| Vermögensaufbau | keiner | der ganze Punkt |
| Zeitbindung | hoch, fremdbestimmt | hoch, selbstbestimmt |
| Risiko | Auslastung, Haftung ggü. Kunden | kein Umsatz |
| Compliance | AVV **als Auftragsverarbeiter**, Haftung | AVV gegenüber eigenen Nutzern |

Beide konkurrieren um **dieselben knappen Wochenstunden**. Solange das nicht entschieden ist,
zieht jede Woche in eine andere Richtung. Das ist die wichtigste offene Frage im ganzen Papier —
und sie steht nicht drin.

### R9 · Paperclip: real, aber jung
Geprüft am 02.09.2026: Paperclip existiert, ist Open Source (Node-Server + React-UI, Adapter
u. a. für Claude Code), erzwingt Agenten-Budgets und wurde **im März 2026 veröffentlicht** —
mit sehr schnellem Star-Wachstum. Ein halbes Jahr Reife, hoher Hype-Anteil.

Der Entwurf sagt selbst richtig: „Paperclip is an orchestration/control-plane component. It is
not the entire business operating system." Genau daran festhalten. Zusätzliche Punkte, die vor
einem Einsatz zu klären sind: eigener Server (Betriebs- und Update-Aufwand), Zugriff auf
Repo-/DB-Credentials durch eine dritte Komponente (Sicherheitsfläche), Datenschutz, und die
Abhängigkeit einer Governance-Schicht von einem sechs Monate alten Projekt.

Nüchtern: Das, was Paperclip liefern soll, existiert für diesen Anwendungsfall bereits ohne
neue Infrastruktur — Claude-Code-Subagenten, Skills, Hooks, GitHub Actions und `CLAUDE.md`.
Paperclip lohnt sich ab dem Punkt, an dem **mehrere Vorgänge gleichzeitig und unbeaufsichtigt**
laufen sollen. Der ist nicht erreicht.

### R10 · Was der Apparat nicht löst
Die tatsächlichen Blocker der Firma stehen seit Wochen in [[BEZAHLSYSTEM]] und [[MARKETING]]:

| Blocker | Löst ein Agent das? |
|---|---|
| AGB + Widerrufsbelehrung anwaltlich freigegeben | **Nein** — Anwalt, Geld |
| § 34i GewO (Finanzierungs-Assistent) freigeben | **Nein** — Anwalt |
| StBerG § 1–5 (Anlage V, § 82b, DATEV) freigeben | **Nein** — Anwalt |
| Nutzer-AVV (größte DSGVO-Lücke) | **Nein** — Anwalt |
| Paddle-Konto verifiziert | Nein — Betreiber, Identitätsprüfung |
| `BILLING_ENFORCED=true`, `PREISE_SICHTBAR` an | Ja, aber erst nach den vier Zeilen darüber |
| Nachfrage-Evidenz | **Nein** — echte Gespräche mit echten Vermietern |

Fünf von sieben Zeilen brauchen **einen Menschen und Geld**, keinen Agenten. Ein
Betriebssystem, das diese Zeilen nicht als oberste Priorität führt, optimiert am Problem vorbei.

---

## 3. Was gut ist und bleiben soll

Ehrlich und ohne Höflichkeit gesagt: Der Entwurf enthält vier Dinge, die in der Praxis selten
und hier bereits nachweisbar wertvoll sind.

1. **Die Evidenz-Hierarchie (Abschnitt 10)** samt „Never present an assumption as a fact" und
   „AI agreement is not independent real-world evidence". Das ist der beste Absatz im Papier.
2. **Risikostufen mit gekoppelter Freigabe (11) und die Production Rule (19).** Deckt sich mit
   dem, was im Repo schon funktioniert — deshalb belastbar.
3. **Experiment vor Bau (21) und die Feature-Kette USER → PROBLEM → EVIDENCE → … (30).**
   Diese beiden Regeln hätten Open Banking und die englische Fassung vorher verhindert.
   Sie sind rückwirkend bereits bezahlt.
4. **„Autonomy must be earned through reliability" (33)** und die Trennung
   RECOMMENDATION ≠ AUTHORIZATION ≠ EXECUTION (18).

Diese Teile gehören fast wörtlich in v0.2.

---

## 4. Was ich anders machen würde — v0.2

### 4.1 Sechs Rollen statt 29

Eine Rolle verdient ihren Platz nur mit drei Eigenschaften: **eigener Kontext/Werkzeuge**,
**eine Entscheidung, die sie besitzt**, **ein messbarer Output**. Danach bleiben sechs übrig:

| Rolle | Besitzt die Entscheidung | Messbarer Output | Ersetzt aus v1.0 |
|---|---|---|---|
| **Betreiber (Jonas)** | Geld, Recht, Strategie, Marktkontakt | Freigaben, Kundengespräche | Owner |
| **Produkt & Evidenz** | *was gebaut und was gestrichen wird* | Trichterzahlen, Interview-Notizen, Kill-Listen | CPO, PM, UX-Research, Data Analyst, Customer Success, Market/Competitor Intel |
| **Bau** | *wie es technisch gelöst wird* | gemergte PRs, grüne Tests | CTO, Architect, FE, BE, AI, DevOps |
| **Sicherheit & Recht** | *Veto vor Produktion und vor Kundenkontakt* | Freigabe/Stopp mit Begründung | Security Engineer, Legal & Compliance |
| **Wachstum** | *Kanal und Inhalt* | Sichtbarkeit, Anmeldungen, Aktivierungsrate | CMO, SEO, Content, Social, Performance, CRO |
| **Auditor** | *nichts* — er urteilt, entscheidet nicht | schriftlicher Befund | A29 |

COO und Projektmanagement entfallen bewusst: Bei einem Menschen und sechs Rollen ist
Koordination keine Rolle, sondern eine Liste. Die existiert bereits (Merkliste in `CLAUDE.md`).
CFO entfällt als Rolle und wird zu **einer Zahl im Wochenbericht** (Ausgaben, siehe 4.3) —
solange es weder Umsatz noch Investitionen gibt, ist ein CFO-Agent Theater.

**Technische Umsetzung ohne neue Infrastruktur:** je Rolle eine Datei unter
`.claude/agents/*.md` (Subagent mit eigenem Prompt und eingeschränktem Werkzeugsatz) plus
je ein Skill für wiederkehrende Abläufe. Versioniert im Repo, damit die Rollen denselben
Review-Weg gehen wie Code. Das ist heute verfügbar, kostet keinen Server und keine Abhängigkeit.

### 4.2 Der Auditor, neu definiert
Nicht „zweite Meinung zur selben Argumentation", sondern **drei Prüffragen gegen die Wirklichkeit**:

1. Welche Aussage in diesem Vorgang ist eine Annahme, die als Tatsache formuliert wurde?
2. Welche gemessene Zahl widerspricht der Empfehlung — oder fehlt, obwohl sie beschaffbar wäre?
3. Was wäre das billigste Experiment, das diese Entscheidung überflüssig macht?

Ergebnis: PASS / REVISE / FAIL mit Begründung, ohne Weisungsrecht. **Pflicht nur bei HIGH und
CRITICAL** (Produktion, Geld, Recht, Außenkommunikation, Irreversibles) — nicht bei jedem
Vorgang, sonst verhungert der Durchsatz. Und: automatisiert auslösbar, sonst läuft es nicht.

### 4.3 Die fünf Zahlen (Wochenbericht, sonst nichts)

| # | Zahl | Baseline 02.09.2026 |
|---|---|---|
| 1 | Besucher auf `www.myimmoapp.de` (7 Tage) | **nicht gemessen** — Analytics fehlt |
| 2 | Neue externe Vermieter-Konten (7 Tage) | ~1 |
| 3 | Aktivierungsrate (Konto → erstes Objekt) | 8/15 = 53 % |
| 4 | Rückkehrer (zweiter Tag innerhalb 14 Tagen) | 3/15 = 20 % |
| 5 | Zahlende Kunden / Ausgaben des Monats | 0 / nicht gemessen |

Zahl 4 ist die wichtigste Zahl der Firma und wurde bisher nie erhoben. Wenn 80 % nach dem
ersten Tag nicht wiederkommen, ist jede weitere Funktion und jeder weitere Artikel Aufwand
auf einem undichten Eimer.

### 4.4 Abbruchkriterien — der Entwurf fordert sie, hat aber keine
Abschnitt 36 sagt „If the evidence says STOP, stop." Ohne vorher definierte Schwelle wird
nie gestoppt, weil sich jede Zahl im Nachhinein erklären lässt. Vorschlag, vor dem Start zu
fixieren:

- **Aktivierung:** bleibt Zahl 3 über 8 Wochen unter 40 % → Onboarding ist das Problem, kein Bau
  neuer Funktionen, bis es behoben ist.
- **Bindung:** bleibt Zahl 4 über 8 Wochen unter 25 % → das Produkt löst kein wiederkehrendes
  Problem; Positionierung überprüfen statt Funktionen ergänzen.
- **Kasse:** 3 Monate nach `BILLING_ENFORCED=true` weniger als 10 zahlende Kunden →
  Go-to-Market ändern (Vergleichsportale, Kooperationen) oder Preis/Zielgruppe ändern.
- **Geld:** Ausgaben (API + Infrastruktur + Werkzeuge) überschreiten den Monatsdeckel →
  Stopp bis zur nächsten Periode, keine stille Fortsetzung.

### 4.5 Budgetdeckel
Ein fester Euro-Betrag pro Monat für API, Infrastruktur und Werkzeuge, vor Beginn festgelegt,
im Wochenbericht als Zahl 5 mitgeführt. Der Deckel ist die einzige Regel aus Abschnitt 20,
die ohne Zahl wertlos ist — und die einzige, die den Apparat davon abhält, sich selbst zu
finanzieren, bevor er etwas eingebracht hat.

---

## 5. Fahrplan

### Phase 0 — Messen und entscheiden (diese Woche, ~4 Stunden)
| # | Schritt | Wer | Ergebnis |
|---|---|---|---|
| 0.1 | `@vercel/analytics` einbauen, Web Analytics aktivieren | Bau | Zahl 1 existiert |
| 0.2 | Google Search Console verifizieren, Sitemap einreichen, Adressänderung `.store`/`.com` → `.de` | Betreiber | Sichtbarkeit messbar |
| 0.3 | SQL-Wochenbericht als Skript (`scripts/kennzahlen.mjs`) | Bau | Zahlen 2–4 auf Knopfdruck |
| 0.4 | Monatsdeckel in Euro festlegen | Betreiber | Zahl 5 hat eine Grenze |
| 0.5 | **Entscheidung Agentur vs. Studio** (R8) | Betreiber | eine Richtung statt zwei |
| 0.6 | Abbruchkriterien 4.4 schriftlich fixieren | Betreiber | Stopp ist möglich |

### Phase 1 — Kasse öffnen und mit echten Menschen reden (2–6 Wochen)
| # | Schritt | Wer | Warum zuerst |
|---|---|---|---|
| 1.1 | **Ein** Anwaltsmandat für das ganze Paket: AGB + Widerruf, Impressum/Datenschutz, § 34i GewO, StBerG, Nutzer-AVV | Betreiber | Fünf Blocker, ein Termin, eine Rechnung. Die höchstwirksame Ausgabe der Firma. |
| 1.2 | Angebote einholen, bevor beauftragt wird (IT-/Wettbewerbsrecht, Festpreis) | Betreiber | Kostenrahmen vor Bindung |
| 1.3 | Paddle-Konto verifizieren, Sandbox-Kauf durchspielen | Betreiber | [[BEZAHLSYSTEM]] Schritt 3–5 |
| 1.4 | 5 Gespräche à 20 Minuten mit den 8 Konten, die ein Objekt angelegt haben | Betreiber | Warum kommen sie nicht wieder? Diese Antwort kann kein Agent liefern. Vorher Rechtsgrundlage/Widerspruch sauber klären. |
| 1.5 | Erst nach 1.1–1.3: `BILLING_ENFORCED=true`, `PREISE_SICHTBAR`, Feature-Gates | Bau + Betreiber | Kasse auf |
| 1.6 | Fehler aus 1.4 beheben — nur die genannten, keine neuen Funktionen | Bau | Eimer abdichten, bevor nachgefüllt wird |

**Keine neuen Produktfunktionen in Phase 1.** Das ist die unbequemste Zeile des Fahrplans und
die wichtigste.

### Phase 2 — Das Betriebssystem v0.2 bauen (parallel möglich, 1–2 Wochen)
| # | Schritt | Ergebnis |
|---|---|---|
| 2.1 | Constitution v0.2 schreiben: Prinzipien aus 3, 9, 10, 11, 18–22, 30, 33, 36 behalten; Organigramm auf sechs Rollen kürzen; als **Erweiterung von `CLAUDE.md`**, nicht daneben | ein System statt zwei |
| 2.2 | Sechs Rollen als `.claude/agents/*.md` mit eingeschränkten Werkzeugsätzen | ausführbar statt beschrieben |
| 2.3 | Auditor-Skill mit den drei Prüffragen aus 4.2, Pflicht bei HIGH/CRITICAL | Gate, das ohne Copy-Paste läuft |
| 2.4 | Wochenbericht automatisieren (GitHub Action, Muster: `wert-refresh.yml`) | fünf Zahlen kommen von selbst |
| 2.5 | Rückblick nach 4 Wochen: Hat der Apparat eine Entscheidung verbessert, die ohne ihn schlechter gewesen wäre? Wenn nein: kürzen. | das Betriebssystem unterliegt seinen eigenen Regeln |

### Phase 3 — Erst nach zahlenden Kunden
Vergleichsportale (trusted.de, softwareabc24), Google Ads mit messbarem CAC, Instagram-Test
auswerten oder beenden, Business-/Hausverwaltungs-Schiene, Paperclip **falls** dann mehrere
unbeaufsichtigte Vorgänge parallel laufen sollen, zweites Produkt oder Agenturschiene je nach
Entscheidung 0.5.

---

## 6. Offene Entscheidungen für den Betreiber

1. **Agentur oder Studio?** (R8) — bestimmt alles Weitere.
2. **Monatsdeckel in Euro** für API/Infrastruktur/Werkzeuge.
3. **Anwaltsbudget**: Wird das Paket 1.1 beauftragt? Ohne das bleibt die Kasse zu, und ohne
   Kasse ist jede Wachstumsarbeit unbezahlt.
4. **Abbruchkriterien** aus 4.4: gelten sie?
5. **Bauen-Stopp in Phase 1**: akzeptiert oder nicht?

---

## 7. Was bewusst NICHT gebaut wird

- Kein internes Dashboard (Abschnitt 32) — fünf Zahlen passen in eine Markdown-Datei.
- Kein eigenes Memory-Schema in PostgreSQL (Abschnitt 15) — `CLAUDE.md` + `docs/`-Vault +
  Git-Historie leisten das bereits und werden gepflegt.
- Kein n8n, solange kein Prozess existiert, der oft genug und stabil genug läuft, um
  Automatisierung zu verdienen (Abschnitt 4 des Entwurfs sagt das selbst).
- Keine 12 Task-Zustände — NEU / LÄUFT / WARTET AUF FREIGABE / FERTIG / VERWORFEN reichen.
- Kein Paperclip vor Phase 3.
