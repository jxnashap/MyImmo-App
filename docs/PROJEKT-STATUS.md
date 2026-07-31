# MyImmo — Projekt-Status (Übergabe für neue Sessions)

**Stand: 31.07.2026.** Diese Fassung ist eine **vollständige Prüfung gegen Code, Datenbank
und Live-Seite**, nicht die Fortschreibung der alten Liste. Anlass: Mehrere Einträge standen
als offen, obwohl sie längst gebaut waren. Eine Liste, der man nicht trauen kann, ist
schlechter als keine.

Ergänzt `CLAUDE.md` (Arbeitsweise, Merkliste, Deployment), `docs/MASTERPLAN.md`
(Markt/Compliance) und `docs/MARKETING.md` (Kampagnen, Redaktionsplan).

---

## 0. Korrekturen gegenüber der Fassung vom 16.07.2026

| Was | Stand bisher | Tatsächlich (31.07.2026 geprüft) |
|---|---|---|
| **Onboarding-Tour** | Backlog | ✅ fertig — `components/OnboardingTour.tsx`, im Root-Layout, aus den Einstellungen neu startbar |
| **Open Banking Etappe 3–4** | Backlog / „teilweise" | ✅ **Code vollständig**: `starteAutorisierung`, `erstelleSession`, `holeKontoDetails`, `holeTransaktionen`, Callback-Route, `/banking`, Abgleich-Engine, 90-Tage-Reauth-Frist. Inaktiv ohne Env, **ohne Tests**, nie end-to-end gelaufen |
| **`kredite.darlnr` / `mieter.kaution_bank` verschlüsseln** | Backlog | ✅ erledigt (18.07.) |
| **Supabase-DPA** | „geparkt" | ✅ signiert (24.07.) |
| **Vercel Pro** | offen | ✅ aktiv (29.07.) |
| **Ratgeber** | 5 Artikel | 17 Artikel + 4 Funktions-Landingpages |
| **Tests** | 123 | 427 |
| **Live-URL** | `my-immo-app.vercel.app` | **`www.myimmoapp.de`** |
| **Stop-Hook „Unverified"** | „Fehlalarm" | Ursache war der eigene Ablauf: lokal auf `origin/main` zurückgesetzt, ohne `origin/<branch>` mitzuziehen — GitHubs Merge-Commit blieb im Vergleich stehen |

---

## 1. Kennzahlen (gezählt 31.07.2026)

| | |
|---|---|
| Seiten (`page.tsx`) | 66 |
| API-Routen | 20 |
| Komponenten | 85 |
| Tests | **427 in 39 Dateien, alle grün** |
| Migrationen im Repo | 18 |
| Tabellen in Postgres | **46, alle mit RLS** |
| Ratgeber-Artikel / Funktionsseiten | 17 / 4 |
| `loading.tsx` | 12 von 66 Seiten |

## Was ist MyImmo?
Deutschsprachige Immobilienverwaltungs-SaaS für **private Vermieter (1–24 Einheiten)**,
denen Profi-Hausverwaltungssoftware zu teuer/komplex und Excel zu fehleranfällig ist.
Positionierung: **Automatik + Beweissicherung + Steuer-Wächter** statt Enterprise-Featurebreite.

## Stack & Betrieb
- **Next.js 14 App Router** (TypeScript, Server Actions, Server Components), vitest (`tests/`, 427 grün).
- **Supabase** `kozhxrvyilkchjpcuwcm` (eu-central-1): Postgres + Auth (E-Mail, Google), RLS auf allen 46 Tabellen.
  Dateien als **Base64 in Tabellenspalten** (kein Storage-Bucket).
- **Vercel** (Plan **Pro**, Repo `jxnashap/myimmo-app`, Branch `main` → Auto-Deploy).
  Live: **https://www.myimmoapp.de** (Apex leitet auf www; `my-immo-app.vercel.app` nur noch Fallback).
- Env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `ANTHROPIC_API_KEY` (OCR/KI-Import),
  `DATA_ENCRYPTION_KEY` (AES-256-GCM, `lib/crypto/secure.ts` — Verlust = Bankdaten weg),
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`; optional Brevo, Paddle, Enable Banking, Bedrock.
- Workflow: Feature-Branch `claude/…` → PR → **Squash-Merge** → Branch auf `origin/main` zurücksetzen
  **und `origin/<branch>` mit force-with-lease nachziehen**. Nach jedem Merge Live-URL erwähnen.
  Design: Dark-UI mit Gold (`--gold`), Landing hell (`.lp3`, `--l-*`-Variablen).

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
- **CSV-Import** (Einstellungen → Daten & Recht): Parser mit deutschem Zahlen-/Datumsformat,
  Auto-Mapping per Synonymen (Zwei-Pass exakt→Präfix), 3-Schritt-Assistent, Batch-Insert.
- **Datenexport**: Komplett-ZIP + Buchungen-CSV + DATEV (nur unter Daten & Recht).

### Banking (Etappen 1–4 gebaut, inaktiv ohne Env)
- Tabellen `bankverbindungen` + `bank_umsaetze` (App-Layer-verschlüsselt, RLS).
- `lib/banking/enableBanking.ts`: Bankenliste, Autorisierung starten, Session tauschen,
  Kontodetails und **Transaktionen abrufen** (JWT/RS256, `kid` = Application ID).
- `/api/banking/callback` bindet den Rückweg über `bank_auth_anfragen` an den Nutzer.
- **Abgleich-Engine** `lib/banking/abgleich.ts`: Miet-/Kostenvorschläge aus Umsätzen,
  liest Soll-Monat aus dem Verwendungszweck („Miete Juli", „07/2026", Jahres-Rollover),
  Prinzip **vorschlagen + per Klick bestätigen**. 90-Tage-PSD2-Reauth als Frist.
- **Offen:** Anbietervertrag + AVV, Sandbox-Durchlauf, **Tests fehlen vollständig** —
  der einzige größere Bereich ohne jede Abdeckung.

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
  Grundsteuer, ESt-Erklärung, Energieausweis, Bank-Reauth), Kategorien, iCal-Export,
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
  (beide **existieren als Entwürfe**, Inhalte sind Platzhalter), `docs/compliance/AVV-STATUS.md`,
  `anthropic-dpa-archiv.md` (Transfer via **SCCs, kein DPF**).
- **Marketing**: `docs/MARKETING.md` (Konzept, 4 Kampagnen), `docs/marketing/portal-profile.md`,
  `scripts/screenshots.mjs`.

---

## 2. Gebaut, aber absichtlich inaktiv

Ohne die jeweilige Env folgenlos — das ist gewollt und kein Fehler.

| Was | Schalter | Was noch fehlt |
|---|---|---|
| **Bezahlsystem (Paddle)** | `BILLING_ENFORCED=true` + `PREISE_SICHTBAR` (steht auf `false`) | Paddle-Konto verifizieren, AGB/Widerruf anwaltlich, Sandbox-Test, Feature-Gates in den Actions → `docs/BEZAHLSYSTEM.md` |
| **Open Banking** | `ENABLE_BANKING_APP_ID` + `ENABLE_BANKING_PRIVATE_KEY` | Anbietervertrag + AVV, Sandbox-Durchlauf, Tests |
| **E-Mail-Verteiler (Brevo)** | `BREVO_API_KEY` + `BREVO_ABSENDER_EMAIL` | in PR #237; AVV + Datenschutz-Passus offen |

**DNS für Brevo ist fertig** (31.07. per DNS-Abfrage geprüft): `brevo-code`-TXT gesetzt,
DKIM `brevo1`/`brevo2._domainkey` zeigen auf Brevo, DMARC vorhanden. SPF enthält bewusst
keinen Brevo-Include — Brevo nutzt eigenen Return-Path und signiert per DKIM.

---

## 3. Offen — nur der Betreiber

| # | Was | Warum es zählt |
|---|---|---|
| B1 | **Supabase-Mindestpasswortlänge auf 8** | **Am 31.07.2026 erneut empirisch geprüft: „abc123" wurde angenommen.** App verlangt 8, Supabase steht auf 6 — wer die Auth-API direkt anspricht, kommt durch. Testkonto sofort gelöscht |
| B2 | AGB + Widerrufsbelehrung anwaltlich | Pflicht vor dem ersten Euro |
| B3 | Impressum/Datenschutz anwaltlich | Datenabgleich erledigt, Prüfung nicht |
| B4 | **Nutzer-AVV** (Vermieter = Verantwortliche für Mieterdaten) | größte Compliance-Lücke |
| B5 | StBerG-Freigabe (Anlage V, §82b, DATEV) und §34i GewO (Finanzierung) | Grenze zur unerlaubten Beratung |
| B6 | Brevo-AVV + Datenschutz-Passus für den Verteiler | Schritte stehen in `CLAUDE.md` |
| B7 | TOM + Verarbeitungsverzeichnis mit echten Daten füllen | Dokumente da, Inhalte Platzhalter |
| B8 | Support-Kanal mit Reaktionszeit | Bewertungen sind das Ranking-Kriterium der Vergleichsportale |
| B9 | Supabase Pro für Leaked Password Protection | auf Free ist der Schalter sichtbar, aber wirkungslos |

---

## 4. Offen — kann gebaut werden

| Was | Umfang | Anmerkung |
|---|---|---|
| **Layout-Redesign** (Fintech-hell) | groß | Sperrt Bilder, Store-Assets und bezahlte Reichweite, solange es aussteht |
| **Tests für Open Banking** | mittel | einziger größerer Bereich ohne Abdeckung |
| Terminkoordination + Status-Tracking an Anliegen/Auftrag | mittel | war „in Arbeit" laut alter Fassung — Stand nicht abschließend geprüft |
| Auftrag „erledigt" → Kostenvorschlag | mittel | kein eigenes Rechnungsmodul (E-Rechnung §14 zu riskant) |
| Vorlagen-Gate | klein | erst wenn der Versand läuft |
| **2FA** | mittel | existiert nicht — geprüft, kein Treffer im Code |
| `loading.tsx` für 54 weitere Seiten | klein, repetitiv | 12 von 66 vorhanden |
| Abo-Zugangscode | klein | Fundament (`einladungscodes` + Signup-Trigger) steht |
| Mieterhöhungs-Assistent §558 | mittel | **Rechtsrisiko**; der Ratgeber-Artikel dazu existiert bereits |
| Mieter-Selbstpflege, Mängelanzeige §634a, Anträge-Workflow, Chat-Threads, WEG-Modul, E-Rechnungs-Parser | groß | Backlog unverändert |

---

## 5. Terminiert

- **Ab 03.08.2026** — KfW-308-Konditionen aktualisieren (`lib/kauf/foerderung.ts`, Doku, Tests)
- **Ab 01.01.2027** — Ratgeber-Artikel zur Fernablesepflicht entschärfen

---

## 6. Was bei dieser Prüfung NICHT verifizierbar war

Damit hier nichts als sicher steht, was es nicht ist:

- **Ob die Brevo-Env in Vercel gesetzt ist** — Vercel-Anbindung lief ins Rate-Limit.
  Entscheidet, ob der Verteiler nach dem Merge wirklich sendet.
- **Echter Mailversand** — ohne Brevo-Schlüssel keine Aussage zur Zustellbarkeit.
- **Open Banking end-to-end** — Code vorhanden, ein Durchlauf hat nie stattgefunden.
- **Login-Pfad von `scripts/screenshots.mjs`** — braucht echte Zugangsdaten.
- **Stand der Terminkoordination** — als „in Arbeit" übernommen, nicht im Detail geprüft.
- **AVV-Stände bei Anbietern und Vercel-Plan** — aus früheren Sessions übernommen.

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
