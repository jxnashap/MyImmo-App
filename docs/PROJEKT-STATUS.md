# MyImmo — Projekt-Status (Übergabe für neue Sessions)

**Stand: 30.09.2026.** Basis ist die vollständige Prüfung gegen Code, Datenbank und
Live-Seite vom 31.07.2026; nachgezogen am 28.08.2026 und am **30.09.2026** (Kennzahlen neu
gezählt, Tabellenzahl live abgefragt, Abschnitte 3 und 4 gegen den Code geprüft, September
ergänzt). Anlass der ersten Neufassung: Mehrere Einträge standen als offen, obwohl sie
längst gebaut waren. Eine Liste, der man nicht trauen kann, ist schlechter als keine.

Ergänzt `CLAUDE.md` (Arbeitsweise, Merkliste, Deployment), `docs/MASTERPLAN.md`
(Markt/Compliance) und `docs/MARKETING.md` (Kampagnen, Redaktionsplan).

---

## 0. Korrekturen gegenüber der Fassung vom 16.07.2026

| Was | Stand bisher | Tatsächlich (31.07.2026 geprüft) |
|---|---|---|
| **Onboarding-Tour** | Backlog | ✅ fertig — `components/OnboardingTour.tsx`, im Root-Layout, aus den Einstellungen neu startbar |
| **Open Banking** | zurückgestellt | ⏸️ **Am 29.08.2026 komplett entfernt** — nie live, laufende Kosten. Gesichert unter `docs/zukunft/OPEN-BANKING.md`, Code bis Commit `85feb98` |
| **`kredite.darlnr` / `mieter.kaution_bank` verschlüsseln** | Backlog | ✅ erledigt (18.07.) |
| **Supabase-DPA** | „geparkt" | ✅ signiert (24.07.) |
| **Vercel Pro** | offen | ✅ aktiv (29.07.) |
| **Ratgeber** | 5 Artikel | 17 Artikel + 4 Funktions-Landingpages |
| **Tests** | 123 | 439 |
| **Live-URL** | `my-immo-app.vercel.app` | **`www.myimmoapp.de`** |
| **Stop-Hook „Unverified"** | „Fehlalarm" | Ursache war der eigene Ablauf: lokal auf `origin/main` zurückgesetzt, ohne `origin/<branch>` mitzuziehen — GitHubs Merge-Commit blieb im Vergleich stehen |

### Korrekturen gegenüber der Fassung vom 28.08.2026 (geprüft 30.09.2026)

| Was | Stand bisher | Tatsächlich |
|---|---|---|
| **Stack** | Next.js 14 | **Next.js 16.3.8 / React 19.2.8** (Migrationen 01.09. und 30.09.) |
| **2FA** | „existiert nicht" | ✅ TOTP + acht Wiederherstellungscodes, frische Anmeldung vor Export/Löschung/Bank-Freigabe (08.09.) |
| **Tests für Actions** | „keine Abdeckung" | ✅ alle 36 Action-Dateien und 20 API-Routen über `tests/stubs/actionHarness.ts` |
| **`loading.tsx`** | 12 von 66 | 50 von 67 |
| **Supabase-Mindestpasswortlänge** | offen (B1) | ✅ 8 Zeichen (30.08.) |
| **Supabase-Plan** | „Free, Leak-Schutz wirkungslos" (B9) | **Pro** — Leak-Schutz ist enthalten und seit 09.09. an, **Wirkung ungeprüft** |
| **Supabase-URL-Konfiguration** | — | ✅ am 30.09. ohne Mail geprüft (Site URL `www.myimmoapp.de`, fremde Ziele verworfen) |

---

## 1. Kennzahlen (nachgezählt 30.09.2026)

| | |
|---|---|
| Seiten (`page.tsx`) | 67 |
| API-Routen (eigene Endpunkte) | 20 |
| Komponenten (`.tsx` in `components/`) | 127 |
| Tests | **1.331 in 101 Dateien, alle grün** |
| Migrationen im Repo | 37 |
| Tabellen in Postgres | **47, alle mit RLS** (live abgefragt) |
| Ratgeber-Artikel / Funktionsseiten | 19 / 6 |
| `loading.tsx` | 50 von 67 Seiten |
| Lint (30.09.) | 86 Fehler, 39 Warnungen — Altlast, blockiert nichts (erster Lauf: 93) |

## Was ist MyImmo?
Deutschsprachige Immobilienverwaltungs-SaaS für **private Vermieter (1–24 Einheiten)**,
denen Profi-Hausverwaltungssoftware zu teuer/komplex und Excel zu fehleranfällig ist.
Positionierung: **Automatik + Beweissicherung + Steuer-Wächter** statt Enterprise-Featurebreite.

## Stack & Betrieb
- **Next.js 16.3.8 App Router, React 19.2.8** (TypeScript, Server Actions, Server Components,
  Turbopack), vitest (`tests/`, 1.331 grün), ESLint (`eslint.config.mjs`).
  **`proxy.ts` statt `middleware.ts`** (Next 16, Laufzeit Node). `createClient()` ist async.
  Rückfallpunkt Next 15: Vercel-Deployment `dpl_LRgMzU1c5Kb47uKKjht63FFQCaLp`.
- **Supabase** `kozhxrvyilkchjpcuwcm` (eu-central-1, **Pro**): Postgres + Auth (E-Mail, Google, TOTP-2FA), RLS auf allen 47 Tabellen.
  Dateien als **Base64 in Tabellenspalten** (kein Storage-Bucket).
- **Vercel** (Plan **Pro**, Repo `jxnashap/myimmo-app`, Branch `main` → Auto-Deploy).
  Live: **https://www.myimmoapp.de** (Apex leitet auf www; `my-immo-app.vercel.app` nur noch Fallback).
- Env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `ANTHROPIC_API_KEY` (OCR/KI-Import),
  `DATA_ENCRYPTION_KEY` (AES-256-GCM, `lib/crypto/secure.ts` — Verlust = Bankdaten weg),
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`; optional Brevo, Paddle, Bedrock.
- Workflow: Feature-Branch `claude/…` → PR → **Squash-Merge** → Branch auf `origin/main` zurücksetzen
  **und `origin/<branch>` mit force-with-lease nachziehen**. Nach jedem Merge Live-URL erwähnen.
  Design: **App-UI „Frosted Paper"** seit 20.08.2026 — hell ist Default (Canvas `#f5f5f5`,
  weiße 24px-Karten auf Haarlinien), Dunkelmodus als achromatische Umkehrung über
  `[data-theme="dark"]`; Gold nur noch als schmaler Akzent (`--gold` #9a7b24 für Text,
  `--gold-fill` #D4A847 für Flächen). UI-Schrift **Geist** (selbst gehostet).
  Die Landing hängt davon unabhängig an ihrer eigenen Palette (`.lp`/`.lp3`, `--l-*`,
  Fraunces + Outfit) — im `.lp`-Scope per Token-Freeze eingefroren.

## Rollen (lib/rolle.ts, Zugang per Einladungscode)
| Rolle | Zugang | Oberfläche |
|---|---|---|
| **Vermieter** | Standard (kein Eintrag in `nutzer_rollen`) | volle App |
| **Hausverwaltung** | Beta-Code | volle App (wie Vermieter, Mandate getrennt — Business-Tarif geplant) |
| **Mieter** | Code des Vermieters (`mieter_zugaenge`) | `/portal` (schlanke Shell) |
| **Service/Hausmeister** | `SV-`Code (`service_zugaenge`) | `/service` (schlanke Shell) |

## Enthaltene Funktionen (Vermieter-App)

### Verwaltung & Buchhaltung
- **Objekte** (Kartengrid, Detailseite mit Kennzahlen/Rendite, Marktwert-Karte mit Bewertung,
  Energieausweis-Frist, CO₂-Kostenaufteilung nach CO2KostAufG-Stufenmodell).
- **Mieter** (Detailseite: Vertrag/Staffel-/Indexmiete mit Staffelplan, Kaution + Status,
  IBAN verschlüsselt, Miet-Zeiträume je Periode, Verbilligt-Ampel §21 II, Portal-Einladung, Dokumente).
- **Einnahmen/Kosten/Kredite/Verbrauch** mit Anlegen/Bearbeiten/Löschen, Rechnungs-Upload bei Kosten,
  wiederkehrende Buchungen; **Mietkonto** (Soll/Ist-Abgleich je Monat, `soll_monat`-Zuordnung, Bestätigungs-UI).
- **Cashflow-Übersicht**, Dashboard mit Fristen/Refinanz-Kalender.
- **Monats-Cashflow — EINE Rechnung** (`lib/cashflowKennzahl.ts`, seit 30.09.2026) für Dashboard
  und Objektseite: **Warmmiete** (Soll-Kaltmiete + NK-Vorauszahlungen laufender Verträge)
  − Kreditraten − Ø laufende Kosten (letzte bis zu 12 Monate mit Buchungen, geteilt durch die
  tatsächliche Monatszahl; gebuchte Schuldzinsen herausgenommen, sie stecken in der Rate).
  Die Kacheln lassen sich nachrechnen: Warmmiete − Kosten = Cashflow. Rendite bleibt kalt.
  Die Steuer rechnet unabhängig davon aus Buchungen (`lib/anlageV.ts`).
- **Soll-Miete** (`lib/sollMiete.ts`): laufende Mieter schlagen das Objektfeld; weichen beide
  ab, zeigt die Objektseite beide Zahlen + „Objekt-Miete angleichen".
- **Wertzuwachs** „ggü. Kaufpreis" (`wertzuwachsGgKaufpreis`) statt der alten Reihe, die jeden
  Zukauf als Wertsteigerung zählte (Demo vorher +754,9 %, jetzt +11,9 %).
- **Jahresbericht**: Seite und PDF über `lib/jahresberichtZeile.ts` — vorher zog das PDF
  Zinsen doppelt ab.
- **Datenlücken-Hinweise** (`lib/heute.ts`, Art `stammdaten`): Objekte ohne Kaufdatum, Mieter
  ohne Mietbeginn oder ohne Objekt, Kredite ohne Auszahlungsdatum; in der Anlage V ein Hinweis,
  wenn gebuchte Umlagen < 50 % des Vertrags-Solls. **Die App korrigiert nichts selbst.**
- **CSV-Import** (Einstellungen → Daten & Recht): Parser mit deutschem Zahlen-/Datumsformat,
  Auto-Mapping per Synonymen (Zwei-Pass exakt→Präfix), 3-Schritt-Assistent, Batch-Insert.
- **Datenexport**: Komplett-ZIP + Buchungen-CSV + DATEV (nur unter Daten & Recht).

### Banking / Konto-Anbindung — ZURÜCKGESTELLT (29.08.2026)
Komplett aus der App entfernt (nie live gegangen; laufende Kosten je Konto). Gesichert als
Zukunftsprojekt: **`docs/zukunft/OPEN-BANKING.md`**. Code in der Git-Historie bis Commit
`85feb98`; DB-Tabellen + `abos.banking_addon` per Migration `20260829120000` gedroppt.
Wieder aufbauen, sobald das Produkt Geld verdient.

### Steuer (Phase B + D fertig)
- **Anlage V**-Berechnung + Export je Objekt (`lib/anlageV.ts`), **DATEV-EXTF-Export** (SKR03, `lib/datev.ts`).
- **Steuer-Wächter:** 15%-Grenze anschaffungsnaher Aufwand §6 Ia (Objektseite),
  Spekulationsfrist §23 (Fristen nach §187/188 BGB: Jahrestag noch steuerpflichtig),
  Verbilligt-Ampel §21 II (66/50 %, Stellplatz bewusst außen vor).
- **AfA-Assistent** (`/afa-assistent`): Satz nach Baujahr, degressiv vs. linear mit optimalem
  Wechseljahr, §7b-Prüfung, §82b-Verteilung, Kaufpreisaufteilung Gebäude/Grund.
- **§35a-Ausweis** in der NK-Abrechnung (Lohnanteile, haushaltsnah/Handwerker) — betrifft die
  MIETER-Seite (Vermieter selbst = Werbungskosten §9, nicht §35a!).

### Dokumente & Abrechnung
- **NK-Abrechnung** je Mieter/Jahr: Positionen (PositionsManager) mit Umlageschlüsseln inkl.
  **HKVO-Heizkostenaufteilung**, Umlage-Assistent (cent-genau, OCR-Import der
  Hausverwaltungs-Abrechnung), §35a-Block, CO₂-Block, PDF + „zustellen" ins Mieterportal.
- **Dokument-Generator** (Mieter → „Dokument"): Briefe/Bescheinigungen mit Vorlagen-Editor + Platzhaltern —
  u. a. Mahnung, Zahlungserinnerung, **Wohnungsgeberbestätigung §19 BMG**, Mietbescheinigung,
  Mietquittung §368; optional E-Signatur eingebettet. **KEINEN separaten Generator dafür bauen — existiert hier!**
- **Übergabeprotokoll** (Einzug/Auszug, Zähler, Schlüssel, Räume) als PDF + Archiv.
- **Archiv** (Tabelle `notizen`): Kategorien, Datei-Route, Mieter-Freigabe-Toggle.
- **Jahresbericht**, Beleihungs-Unterlagen (öffentl. Token-Link für Bank), Bewerbungs-/Selbstauskunft-Links.

### Termine & Prüfpflichten
- **Termine-Seite**: eigene + abgeleitete Fristen (Mietende/Kündigung, NK-Frist §556 III,
  Mieterhöhung §558, Staffel/Index, Zinsbindung/Anschlussfinanzierung, §489-Sonderkündigung,
  Grundsteuer, ESt-Erklärung, Energieausweis), Kategorien, iCal-Export,
  Erledigt-Haken → **wiederkehrende Termine legen automatisch die nächste Instanz an**.
  Abgeleitete Fristen sind **ausblendbar** (`frist_ausgeblendet`), kehren im Folgejahr zurück.
- **Prüfpflichten-Katalog** (`PRUEF_KATALOG`, 15 Prüfarten mit Intervall + Rechtsgrundlage +
  „nur relevant wenn": Legionellen §14b TrinkwV, Rauchmelder DIN 14676, Schornsteinfeger,
  Aufzug BetrSichV, Winterdienst/Baumkontrolle, Feuerlöscher, DGUV V3, Rückstau, Spielplatz,
  Tore, Lüftung, WEG §24 …). **Prüfpflichten-Karte auf jeder Objektseite**.

### Onboarding
- **Einführungs-Tour** (`components/OnboardingTour.tsx`): sechs Stationen (Objekt → Mieter →
  Ein-/Ausgaben → Mietkonto → Archiv → Steuer/Assistenten) mit Direktlinks. Öffnet sich
  automatisch, solange kein Objekt existiert und die Tour nie beendet wurde; überspringbar,
  merkt den Fortschritt, über Einstellungen neu startbar.

### BuyImmo — Bestandsaufbau (seit 05.10.2026)
Zweiter Bereich, gewechselt am Logo oben links. **Seit dem Umbau 06.10.2026 ein Weg in fünf
Schritten** (Seitenleiste nummeriert, Kopf auf jeder Schritt-Seite, `lib/kaufweg.ts`):
1 **Objekte vergleichen** `/vergleich` (Rechner + Tabelle, bis fünf nebeneinander) · 2 **Besichtigen
& Sanieren** `/sanierung` (Guide je Kandidat, Lern-App-Weiter) · 3 **Finanzierung** `/kauf` ·
4 **Angebot & Unterlagen** `/makler` · 5 **Notar & Übergabe** `/abschluss`. Darüber **Cockpit**
`/aufbau` (Bestand, Eigenkapital, freie Grundschuld, Stand der fünf Schritte, Kandidaten, Unterlagen)
und **Strategie** `/strategie` (Rechner: Käufe der nächsten zehn Jahre mit Taktik, Stammbaum,
vorsichtiges Szenario; Plan nur im Browser). Details `docs/zukunft/BUYIMMO-WEG.md`.
**Fahrplan** `/fahrplan` (neun Stationen nach den fünf Schritten gruppiert + Kaufnebenkosten-Rechner), **Sanierungsrechner** `/sanierung` (Material von–bis inkl.
Fliesen für Boden und Wand, Räume kopierbar, Arbeitszeit mit Eigenleistung, eigene Posten, geschätzter Zuschuss für
energetische Posten (BAFA/KfW 458, Stand BEG-Reform 21.07.2026); seit 05./06.10.2026 als Guide
(Schritt für Schritt · Übersicht · Ergebnis) mit Speichern ins Konto und Vorlagen — Speichern wirkt
erst nach der Migration `20261006050000` im SQL-Editor, bis dahin bleibt der Entwurf im Browser;
Betrag geht per Knopf in die Gesamtinvestition des Kauf-Assistenten) plus Kauf-/Verkauf-Assistent,
Makler-Ordner, Marktwert-Schätzer, AfA-Assistent. **Nicht gebaut:** Aufmaß per Grundriss-KI,
Tarif in `lib/plan.ts`. Details: `docs/zukunft/BUYIMMO.md`.

### Kalkulatoren
Roter Faden (Kauf-Kalkulation), Cockpit, Bankgespräch, KI-Objekt-Import (URL/Exposé/PDF → Anthropic).

**Zwei getrennte Importwege — nicht verwechseln:**
1. **Exposé-Import** (`/properties/import`): eine Verkaufsanzeige als PDF, Link oder Text →
   Objektfelder vorbefüllt.
2. **CSV-Import** (Einstellungen → Daten & Recht → Import, `lib/importCsv.ts` +
   `components/ImportAssistent.tsx`): Export aus **vermietet.de, objego oder Excel** →
   Spalten den MyImmo-Feldern zuordnen (Auto-Vorschlag über Synonyme) → Vorschau →
   bestätigen. Deckt **Objekte** (11 Felder) und **Mieter** (12 Felder) ab.
   Das ist Roadmap-Punkt C6 und war am 31.07.2026 in zwei Dokumenten fälschlich als
   fehlend geführt.

### Mieterportal (`/portal`)
Wohnung/Vertragsdaten · **Anliegen** melden (Schaden/Frage/Dokument, max. 3 Anhänge à 4 MB) ·
Anfragen des Vermieters beantworten · **Zahlungen** (vom Vermieter bestätigte Buchungen, §368) ·
**Dokumente** (Freigaben + NK-Belegeinsicht §556 IV + anfordern) · **Zähler** melden (mit Foto).

### Service-Portal (`/service`) + Vermieter-Gegenseite (`/anliegen`, Tab „Service")
Verknüpfung per `SV-`Code · Vermieter vergibt **Aufträge** (Titel, Objekt, Termin, optional Mieter-Kontakt
als Opt-in-Link zur Terminabsprache, Link läuft nach 90 Tagen ab) · Partner antwortet
(angenommen/erledigt/abgelehnt) · Partner kann Aufträge **beantragen** · Firmenverzeichnis.

### Landing/SEO & Recht
- Landing (hell), `/funktionen` **+ 4 Funktions-Landingpages** (Nebenkostenabrechnung,
  Steuer/Anlage V, Mietkonto, Termine & Fristen), `/preise`, `/vision`,
  **Ratgeber mit 17 Artikeln** (je mit Kurzcheck-Kasten), **Vorlagen**, Sitemap (29 Einträge)
  + robots, Middleware-Public-Allowlist.
- **Impressum/Datenschutz/AVV/AGB mit echten Betreiberdaten gefüllt**, Abgleich mit der
  Gewerbeanmeldung erledigt (24.07.). ⚠️ anwaltliche Prüfung steht aus.
- Compliance-Doku: `docs/MASTERPLAN.md`, `docs/VERARBEITUNGSVERZEICHNIS.md`, `docs/TOM.md`
  (beide **als Entwurf ausformuliert**, inhaltlich am echten System — offen sind nur noch
  wenige eckig-geklammerte Lücken: 5 in `TOM.md`, 1 im Verzeichnis), `docs/compliance/AVV-STATUS.md`,
  `anthropic-dpa-archiv.md` (Transfer via **SCCs, kein DPF**).
- **Marketing**: `docs/MARKETING.md` (Konzept, 4 Kampagnen), `docs/marketing/portal-profile.md`,
  `scripts/screenshots.mjs`.

---

## 2. Gebaut, aber absichtlich inaktiv

Ohne die jeweilige Env folgenlos — das ist gewollt und kein Fehler.

| Was | Schalter | Was noch fehlt |
|---|---|---|
| **Bezahlsystem (Paddle)** | `BILLING_ENFORCED=true` + `PREISE_SICHTBAR` (steht auf `false`) | Paddle-Konto verifizieren, AGB/Widerruf anwaltlich, Sandbox-Test, Feature-Gates in den Actions → `docs/BEZAHLSYSTEM.md` |
| **E-Mail-Verteiler (Brevo)** | `BREVO_API_KEY` + `BREVO_ABSENDER_EMAIL` | gemergt; **Datenschutz-Passus ✅ 28.08.2026**, Brevo-AVV im Konto weiterhin offen |

**DNS für Brevo ist fertig** (31.07. per DNS-Abfrage geprüft): `brevo-code`-TXT gesetzt,
DKIM `brevo1`/`brevo2._domainkey` zeigen auf Brevo, DMARC vorhanden. SPF enthält bewusst
keinen Brevo-Include — Brevo nutzt eigenen Return-Path und signiert per DKIM.

---

## 3. Offen — nur der Betreiber

**Aktuelle, nach Dringlichkeit sortierte Liste: `CLAUDE.md` → „👤 NUR DER BETREIBER" und
`docs/BETREIBER-CHECKLISTE.md`.** Stand 30.09.2026: nichts Dringendes mehr — „Passwort vergessen"
ist mit einem echten Nutzer durchgelaufen, der Leak-Schutz wirkt (beides im Supabase-Log belegt). Die Tabelle hier ist die ältere Compliance-Sicht.

| # | Was | Warum es zählt |
|---|---|---|
| B1 | ~~Supabase-Mindestpasswortlänge auf 8~~ | ✅ erledigt 30.08.2026 |
| B2 | AGB + Widerrufsbelehrung anwaltlich | Pflicht vor dem ersten Euro |
| B3 | Impressum/Datenschutz anwaltlich | Datenabgleich erledigt, Prüfung nicht |
| B4 | **Nutzer-AVV** (Vermieter = Verantwortliche für Mieterdaten) | größte Compliance-Lücke |
| B5 | StBerG-Freigabe (Anlage V, §82b, DATEV) und §34i GewO (Finanzierung) | Grenze zur unerlaubten Beratung |
| B6 | **Brevo-AVV** im Konto abschließen/archivieren | Datenschutz-Passus ist seit 28.08.2026 in `/datenschutz`; der AVV fehlt noch. Schritte stehen in `CLAUDE.md` |
| B7 | TOM + Verarbeitungsverzeichnis: die letzten geklammerten Lücken füllen | Texte stehen, 6 Stellen `[…]` offen (u. a. 2FA auf den Admin-Zugängen bestätigen) |
| B8 | Support-Kanal mit Reaktionszeit | Bewertungen sind das Ranking-Kriterium der Vergleichsportale |
| B9 | ~~Leaked Password Protection: Gegenprobe~~ | ✅ wirkt, im Supabase-Log belegt (30.09.2026) |

---

## 4. Offen — kann gebaut werden

| Was | Umfang | Anmerkung |
|---|---|---|
| **Lint-Altlast** | mittel | 86 Fehler / 39 Warnungen. `static-components` ist erledigt (kein echter Fehler dahinter); nächste Kandidaten `react-hooks/purity` (4) und `set-state-in-effect` (25) |
| **Design Runde 2** | mittel | Runde 1 („Frosted Paper") ist am 20.08.2026 umgesetzt. Offen: echte Neu-Anordnung einzelner Layouts statt reiner Um-Tokenisierung. 11px → 12px ist eine Zeile (`--text-xs`), muss aber angesehen werden |
| **Tests für Komponenten/PDF** | mittel | `components/`, `lib/pdf/` und RLS-Policies ohne Abdeckung (Actions und API-Routen sind abgedeckt) |
| **`vitest` ≥ 4.1.11** | klein | nur Entwicklung; `npm install` scheitert in der Remote-Umgebung an diesem Paket → anderer Rechner |
| Terminkoordination + Status-Tracking an Anliegen/Auftrag | mittel | war „in Arbeit" laut alter Fassung — Stand nicht abschließend geprüft |
| Auftrag „erledigt" → Kostenvorschlag | mittel | kein eigenes Rechnungsmodul (E-Rechnung §14 zu riskant) |
| Vorlagen-Gate | klein | erst wenn der Versand läuft |
| `loading.tsx` für 17 weitere Seiten | klein, repetitiv | 50 von 67 vorhanden |
| Abo-Zugangscode | klein | Fundament (`einladungscodes` + Signup-Trigger) steht |
| Mieterhöhungs-Assistent §558 | mittel | **Rechtsrisiko**; der Ratgeber-Artikel dazu existiert bereits |
| Mieter-Selbstpflege, Mängelanzeige §634a, Anträge-Workflow, Chat-Threads, WEG-Modul, E-Rechnungs-Parser | groß | Backlog unverändert |

---

## 5. Terminiert

- ✅ **03.08.2026 — KfW-308-Konditionen** am 28.08.2026 nachgezogen (140/160/180 Tsd. €,
  Einzelmaßnahmen als Alternative zum EH 85 EE; `KFW_STAND = "08/2026"`).
- **Ab 01.01.2027** — Ratgeber-Artikel zur Fernablesepflicht entschärfen

---

## 6. Was bei dieser Prüfung NICHT verifizierbar war

Damit hier nichts als sicher steht, was es nicht ist:

- **Ob die Brevo-Env in Vercel gesetzt ist** — Vercel-Anbindung lief ins Rate-Limit.
  Entscheidet, ob der Verteiler nach dem Merge wirklich sendet.
- **Echter Mailversand** — ohne Brevo-Schlüssel keine Aussage zur Zustellbarkeit.
- **Login-Pfad von `scripts/screenshots.mjs`** — braucht echte Zugangsdaten.
- **Stand der Terminkoordination** — als „in Arbeit" übernommen, nicht im Detail geprüft.
- **AVV-Stände bei Anbietern und Vercel-Plan** — aus früheren Sessions übernommen.
- **Nachtrag 30.09.2026:** Der angemeldete Teil der App ist nach der Next-16-Migration nur
  über den Rauchtest (16 Wege, Demo-Konto) live geprüft, nicht im Browser — Chromium kommt in
  der Remote-Umgebung nicht durch den Proxy. Echte Konten wurden nur über **Zählungen**
  ausgewertet, nie inhaltlich angesehen oder verändert.

---

## 7. Bekannte Eigenheiten / Stolperfallen
- `git checkout -B claude/… origin/main` nach jedem Merge; Push mit `--force-with-lease`.
  **Auch `origin/<branch>` nachziehen**, sonst meldet der Stop-Hook den Merge-Commit als „Unverified".
- Landing-Seiten: niemals globale `--text/--bg3`-Variablen nutzen (brechen auf hellem `.lp3`) — nur `--l-*`.
  Für goldenen **Text** `--l-gold-ink` verwenden; `--l-gold-dark` erreicht auf `--l-bg3` nur 4,10:1.
- Tailwind-Preflight entfernt Listenpunkte — bei neuen Textseiten `listStyle` setzen.
- Deutsche Anführungszeichen in TS-Strings: `„…"` mit **geschlossenem** Zeichen schreiben.
  Ein gerades `"` beendet den String mitten im Satz; `tsc` meldet es erst weiter unten.
- Service-Portal hat **keinen** RLS-Zugriff auf `properties`/`vermieter_profil` → Namen werden in `auftraege` denormalisiert.
- PDF-Texte durch `sanitize()` (Latin-1-Font); Dateien als Base64 in DB-Spalten.
- Vor jedem Neubau prüfen: Dokument-Generator (`lib/dokumentVorlagen.ts`), Fristen (`lib/fristen.ts`),
  Termin-System (`lib/termine.ts`) — vieles existiert schon, Doppelbau vermeiden.
- **Und diese Liste hier gegen den Code prüfen, bevor etwas als „offen" gilt.**
