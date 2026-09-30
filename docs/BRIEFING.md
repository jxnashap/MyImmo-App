# MyImmo — Briefing für neue Chats/Sessions (ZUERST LESEN)

> Zweck: Ein anderer Chat/eine neue Session versteht MyImmo in 5 Minuten.
> Reihenfolge zum Einlesen: **diese Datei → `CLAUDE.md` → `docs/PROJEKT-STATUS.md` → `docs/MASTERPLAN.md`**.
> Stand: **30.09.2026**.

## Was ist MyImmo
Deutschsprachige **Immobilienverwaltung für private Vermieter** (SaaS). Objekte, Mieter,
Mietkonto, Ein-/Ausgaben, Nebenkostenabrechnung, Kredite, Steuer (Anlage V, AfA, DATEV),
Kauf-/Verkauf-/Marktwert-Kalkulatoren, Portfolio-Karte,
Wertentwicklung.

- **Live:** https://www.myimmoapp.de (eigene Domain; Vercel, Auto-Deploy bei Merge nach `main`)
- **Repo:** `jxnashap/myimmo-app`
- **Arbeitsbranch (dieser Kontext):** `claude/magical-feynman-l8w9s5`

## Stack
**Next.js 16.3.8 / React 19.2.8** (App Router, Server Components + Server Actions,
Turbopack) · TypeScript · Supabase (Postgres + RLS, Projekt `kozhxrvyilkchjpcuwcm`,
**Pro-Plan**, eu-central-1) · Vercel (**Pro**, Funktionen in Frankfurt) · vitest · ESLint.
**Folgen der Next-16-Migration (30.09.2026):** `middleware.ts` heißt jetzt **`proxy.ts`**
(Funktion `proxy`, Laufzeit Node) — „Middleware" in Kommentaren meint diese Datei. Jedes
`<html>` trägt `data-scroll-behavior="smooth"`. `npm run lint` = `eslint .`
(`eslint.config.mjs`); der erste Lauf überhaupt ergab **93 Fehler / 39 Warnungen** (jetzt 86) —
Altlast, blockiert den Build nicht. Rückfall: Vercel Instant Rollback auf
`dpl_LRgMzU1c5Kb47uKKjht63FFQCaLp` (letzter Next-15-Stand).
**Den Nutzer auf Server-Seiten über `aktuellerNutzer()`** (`lib/supabase/nutzer.ts`,
React `cache`, bleibt `getUser()`) holen, nicht über ein eigenes `supabase.auth.getUser()`.
**Folge der Next-15-Migration (01.09.2026), leicht zu übersehen:** `createClient()` aus
`lib/supabase/server.ts` ist **async** — neue Aufrufstellen brauchen `await createClient()`.
Ebenso `besucherIp()` und `basisUrl()` (jetzt `lib/net/basisUrl.ts`). Route-Dateien dürfen
nur noch HTTP-Methoden + Segment-Konfig exportieren. React 19: `useRef` braucht einen Startwert.
Kein Tailwind-Framework-Look — **eigenes CSS in `app/globals.css`** mit Klassen
(`.section`, `.btn`, `.kpi-card`, `.badge`, `.input`, `.nav-item`, …). App-Design
**„Frosted Paper"** (seit 20.08.2026): **hell ist Default**, Dunkelmodus als achromatische
Umkehrung über `[data-theme="dark"]`. UI-Schrift **Geist** (selbst gehostet,
`public/fonts/geist-variable.woff2`). Die Landing hat ihre eigene Palette
(`.lp`/`.lp3`, `--l-*`, Fraunces + Outfit) und ist per Token-Freeze davon entkoppelt.

## Wichtige Konventionen (unbedingt beachten)
- **Arbeitsweise (vom Nutzer gewünscht):** ehrlicher Sparringspartner, kritisch, Risiken
  ZUERST nennen, keine Floskeln, Deutsch. Wahrheit auch wenn unbequem.
- **Migrationen:** jede Schemaänderung via `apply_migration` **UND** als Datei
  `supabase/migrations/<version>_<name>.sql` im selben PR. Kein DDL über `execute_sql`.
  Regeln/Index: `supabase/migrations/README.md`.
- **Verschlüsselung:** Bankdaten (IBAN/Inhaber, `kredite.darlnr`, `mieter.kaution_bank`) sind
  **App-Layer-verschlüsselt** (AES-256-GCM, `lib/crypto/secure.ts`). Schlüssel = Vercel-Env
  `DATA_ENCRYPTION_KEY` (NIE ins Repo/Logs; Verlust = Bankdaten weg). Blind-Index für Dubletten.
- **Dateien** (Belege/Archiv) werden **als Base64 in Tabellenspalten** gespeichert — kein
  Storage-Bucket. In Listen NIE `select("*")` auf `kosten` (Blob!) → `KOSTEN_SPALTEN` nutzen.
- **Build/Test:** `NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build`
  (Platzhalter genügen) · `npx vitest run` — **1.331 Tests in 101 Dateien** (Stand 30.09.2026).
  **Nicht mehr nur Purefunctions:** Alle **36 Action-Dateien** und die **20 API-Routen** sind
  abgedeckt (Prüfstand `tests/stubs/actionHarness.ts`; `mfa.ts` über `tests/zweiFaktor.test.ts`). Weiterhin ohne Abdeckung:
  `components/`, `lib/pdf/`, RLS-Policies.
- 🔥 **`npm run rauchtest`** — 16 Wege gegen die LAUFENDE App (nur lesend, Demo-Konto).
  Der einzige Test, der je eine Seite ausliefert. **Nicht bei jedem Push** (setzt den
  geteilten Demo-Bestand zurück). Grenzen und Fallstricke: `CLAUDE.md`.
- 🧪 **Regel, die hier alles trägt: Einen neuen Test erst glauben, wenn er gegen einen
  absichtlich eingebauten Fehler ROT wird.** Mehrere grüne Tests haben sich so als wertlos
  erwiesen — und zwei Wächter als blind.
- ⚠️ **`npx vitest run | tail` verschluckt den Exit-Code** — so ist #317 mit rotem Test
  durchgegangen. Vor einem Commit: `npx vitest run > datei; echo $?`.
- ⚠️ **`npm install` läuft in der Remote-Umgebung nur TEILWEISE** (seit 30.09.2026: `next@16`,
  ESLint, `undici` gingen; `npm audit fix` und `vitest@4.1.11` scheitern weiter am
  Arborist-Fehler `edgesOut`). Nach jeder Installation die Paketzahl der Lockdatei
  vorher/nachher vergleichen. **Nie `--legacy-peer-deps`** — warf einmal 70 Pakete raus.
  Achtung: `NEXT_PUBLIC_*` wird zur **Build-Zeit** eingebacken — `.env.local` muss VOR
  `npm run build` existieren, sonst zeigt der Client nur „Etwas ist schiefgelaufen".
- **PR-Workflow:** Branch → Build+Tests grün → commit → force-with-lease push → PR → **squash-merge**
  → Branch auf `origin/main` zurücksetzen → Live-URL nennen. Committer-Identität
  `noreply@anthropic.com`. Der Stop-Hook „Unverified commit" beim GitHub-Squash-Commit
  (`noreply@github.com`) ist ein **bekannter Fehlalarm** — gemergte Historie NICHT amenden.
- **Env-Vars (Vercel):** `NEXT_PUBLIC_SUPABASE_*`, `ANTHROPIC_API_KEY` (OCR/KI),
  `DATA_ENCRYPTION_KEY`. Optional Bedrock (EU-KI) `BEDROCK_*`.

## Aktueller Stand (was existiert)
Voll funktionsfähige App mit: Dashboard, Immobilien (Liste/Detail/Edit), Mieter, Mietkonto,
Ein-/Ausgaben (+ CSV-Import, wiederkehrende Buchungen), Verbrauch, Kredite,
Steuer (Anlage V + ELSTER-Hilfe + DATEV-Export), AfA-Assistent, Archiv,
Jahresbericht, Kauf-/Verkauf-Assistent, Marktwert-Schätzer (ImmoWertV), Portfolio-Karte
(Leaflet, dark), Wertentwicklung (Eurostat-HPI-Fortschreibung), Onboarding-Tour,
Command-Palette (Cmd+K), collapsible Sidebar, Toast/Breadcrumbs.

Umfang (30.09.2026): **67 Seiten**, **20 API-Routen**, **36 Action-Dateien**,
**37 Migrationen**, **47 Tabellen (alle mit RLS)**, **19 Ratgeber-Artikel**.

**Zuletzt (August 2026):** Landing im Quiet-Luxury-Stil, App-Redesign „Frosted Paper",
**Bewerbungs-Dokumente im Mieterportal** (verschlüsselte Slot-Uploads + DSGVO-Aufräumen +
Objekt-Steckbrief auf der Bewerbungsseite), großer **UX-Audit** (100 Screenshots über 40 Routen,
Pakete A–C umgesetzt), Datenschutz-Passus für den Vorlagen-Verteiler.

### September 2026 — die zwei Wochen, die den Stand am stärksten verändert haben
- **Next-15-Migration** (01.09.) und **Domain-Konsolidierung**: `.store`/`.com` leiten
  dauerhaft auf `.de`. Beides abgeschlossen, nicht weiter daran drehen.
- **Animationen Runde 2** (02.09.): scroll-getriebene CSS-Animationen, Startseite von
  16 auf 1 IntersectionObserver.
- **Fünf systematische Durchgänge durch den Code** (04.–08.09.) mit echten Funden statt
  Aufräumkosmetik: doppelte Mieteinnahmen (Datum aus Textbausteinen), vier Fehler beim
  Lesen deutscher Zahlen, hochgeladene Dateien mit selbst bestimmtem MIME-Typ, 20 stille
  Schreibfehler, elf fail-open-Prüfabfragen, und in `app/api` fünf Routen, die einem
  **Mieter** Kaufpreis und Wert des Objekts preisgaben. Alle behoben und mit Tests
  festgenagelt. Details je Klasse in `CLAUDE.md`.
- **Kontoschutz** (08.09.): Zwei-Faktor (TOTP + acht Wiederherstellungscodes), „frische
  Anmeldung" vor Export/Löschung/Bank-Freigabe, Auto-Abmeldung standardmäßig 30 min.
- **Dashboard und Navigation** (08.09.): „Termine & Aufgaben" führt vier Quellen in einer
  Liste zusammen, Navigation in drei Gruppen. **Reihenfolge: Kennzahlen zuerst, Aufgaben
  ans Ende** — Vorgabe des Betreibers nach Live-Blick, nicht wieder umdrehen.
- **Qualität** (08.09.): Lade-Zustände für 37 Seiten, Leerzustände mit je einer nächsten
  Handlung, Rauchtest gegen die Produktion.
- **Zugriffsbremse speicherte IP-Adressen im Klartext** (08.09.) — gefunden durch Nachzählen
  in der Datenbank, nicht durch Lesen. Jetzt HMAC, Aufräumen nach 24 h.
- **„Passwort vergessen" war eine Sackgasse** (09.09.): Der Link wurde nirgends eingelöst,
  ein Formular für ein neues Passwort gab es in der ganzen App nicht. Gebaut — aber
  **noch nie mit einer echten Mail erfolgreich durchlaufen**. Die URL-Konfiguration ist
  seit 30.09. gesetzt und geprüft; die E-Mail-Vorlage laut Betreiber ebenfalls; offen ist der echte Test.

### 30.09.2026 — Demo als Prüfstand, dann die echten Konten (rund 20 PRs)
Ein externes Review der Demo hat Fehler aufgedeckt, die sich bei echten Konten wiederfanden.
Reihenfolge und Lehre: erst die Demo reparieren, dann **dieselben Fehlerklassen an den
echten Daten zählen** (nur Zählungen, nichts angesehen oder verändert).
- **Demo** (Phasen 1–5): Jeder Klick führt irgendwohin (`DemoSperre.tsx` erklärt gesperrte
  Bereiche), Schreibsperre per Datenbank-Trigger **laut** statt still, Beispieldaten laufen
  mit dem Datum mit, Mietbuchungen = Warmmiete laut Vertrag, Zinsbuchungen.
- **Cashflow — eine Rechnung, Warmmiete** (`lib/cashflowKennzahl.ts`), Entscheidung des
  Betreibers. Kacheln: Warmmiete − Kosten = Cashflow. Rendite bleibt kalt, die Steuer rechnet
  unabhängig aus Buchungen. Schuldzinsen werden nicht mehr doppelt abgezogen.
- **„+754,9 % seit Anschaffung"** zählte Zukäufe als Wertsteigerung → jetzt „ggü. Kaufpreis".
- **Jahresbericht** Seite und PDF rechnen über dieselbe Funktion (`lib/jahresberichtZeile.ts`).
- **Echte Konten:** Soll-Miete aus laufenden Mietern statt veraltetem Objektfeld
  (`lib/sollMiete.ts`, mit sichtbarer Abweichung), Hinweise auf fehlende Kaufdaten,
  Mietbeginne, Objekt-Zuordnungen, Auszahlungsdaten und fehlende Umlagen in der Anlage V.
  **Die App zeigt Lücken an, sie korrigiert nichts selbst.**
- **Ladezeit gemessen** (Phase 5): Das gemeinsame Layout war der Engpass, nicht das
  Dashboard → parallelisiert, Nutzerabfrage je Anfrage dedupliziert. Gewinn ~110–140 ms
  (Minima), im Median innerhalb der Netzstreuung — ehrlich: nicht sicher nachweisbar.
- **Next 16** (siehe Stack). Schließt die hohe `postcss`-Meldung; `npm audit` meldet nur
  noch 3 Befunde, alle nur Entwicklung.

## Offene Punkte / Entscheidungen (Merkliste)
- **Design- & Layout-Überarbeitung** — **Runde 1 umgesetzt (20.08.2026)**: „Frosted Paper"
  (shadcn-artig monochrom-hell), Gold `#D4A847` als schmaler Akzent, **Geist statt Outfit**
  als UI-Schrift (Fraunces+Outfit bleiben nur noch auf der Landing). Dokument-/PDF-Design
  unverändert. **Offen (Runde 2):** echte Neu-Anordnung einzelner Layouts, lange Mobilseiten
  brauchen Binnennavigation.
  **11px → 12px ist NICHT die kleine Aufgabe, als die es hier stand** (nachgemessen 08.09.):
  kein zentraler Schalter, 376 Einzelstellen, und viele der 399 Fundstellen sind Abstände
  statt Schriftgrößen. Die 16 App-Regeln in `globals.css` hängen jetzt am Token `--text-xs`
  (Landing ausdrücklich nicht) — die Umstellung ist damit **eine Zeile**, muss aber
  angesehen werden. Die 356 Inline-Stellen brauchen je eine eigene Entscheidung.
- **Portfolio-Wert Stufe 1b** (regional): Nutzer hat Destatis-GENESIS-Token. **Achtung:** die
  Kreistyp-Reihe ist seit 24.09.2025 aus der GENESIS-API in einen „Statistischen Bericht"
  (XLSX-Download) gewandert → nicht mehr live per API. Nutzer will **vollautomatische**
  PLZ→Kreistyp-Zuordnung. Blocker: exakte Kreistyp-Indexwerte + amtliche Zuordnungsdaten sauber
  beschaffen (nicht raten → sonst still falsche Werte).
- **Bezahltes AVM (Sprengnetter/PriceHubble)** → **abgelehnt** (Kosten/Vertrag). Stattdessen
  Idee: **automatischer 2-Wochen-Refresh** aus frei-legalen Quellen (Destatis-Index + BORIS-
  Bodenrichtwerte) via GitHub-Action-Cron. **Offene Frage:** nur eigenes Portfolio vs.
  mandantensicher für alle Nutzer. (Kein Portal-Scraping — rechtlich/ToS.)
- ~~Restliche UX-Vorschläge~~ ✅ erledigt (PR #199, 22.07.2026): FilterBar-Freitextsuche
  (Cashflow + Mieter), Banking-Bulk-Ausblenden, Wiederkehrend „Alle offenen erzeugen",
  AfA-Gebäudeanteil ans Objekt, „Verkauf prüfen"-Button. Zähler-Bulk bewusst verworfen
  (Zähler werden digitalisiert; falls doch nötig → CSV-Import statt Maske).
- ~~InnoWeb-Website~~ ✅ vom Nutzer selbst fertiggestellt (23.07.2026) — kein offener Punkt mehr.

## Nur der Betreiber (kein Code)
**Vollständige Liste mit Wortlauten: `docs/BETREIBER-CHECKLISTE.md`** (elf Punkte,
nach Dringlichkeit). Kurzfassung steht in `CLAUDE.md` unter „👤 NUR DER BETREIBER".
**In jeder Session kurz nachfragen, was davon erledigt ist** — sonst wird es erneut
vorgeschlagen.
Dringend ist nur noch: „Passwort vergessen" einmal echt testen (Mail am Handy öffnen).
(✅ Supabase-URL-Konfiguration am 30.09.2026 gesetzt und ohne Mail geprüft; ✅ E-Mail-Vorlage
laut Betreiber am 30.09.2026 auf `token_hash` umgestellt — ungeprüft bis zum Test.)
Danach: die zwei restlichen Passwort-Schalter, Gegenprobe zum Leak-Schutz, 2FA durchspielen.
Ohne Eile: AWS-Bedrock-Keys, Brevo-AVV-Rest, anwaltliche Prüfung (§ 34i GewO, StBerG,
Nutzer-AVV, Impressum/Datenschutz/AGB).
✅ Supabase-Mindestpasswortlänge auf 8 (30.08.2026) · ✅ Leaked Password Protection
eingeschaltet (09.09.2026, **Wirkung noch ungeprüft**).
✅ Vercel Pro seit 29.07.2026 (AVV greift über die ToS, kommerzielle Nutzung erlaubt).
✅ Gewerbe angemeldet (GewA 1 Bad Schwartau, bescheinigt 16.07.2026, Nebenerwerb, SaaS-Tätigkeit);
✅ Impressum/Datenschutz tragen die echten Daten und stimmen mit der Anmeldung überein (24.07.2026).
Nach Deploy einmalig `/api/encrypt-bankdaten` aufrufen (migriert Bankdaten).
Details: `docs/compliance/AVV-STATUS.md`.

## Wo mehr steht
- `CLAUDE.md` — Projekt-Regeln, Merkliste, Deployment, Env, DB.
- `docs/PROJEKT-STATUS.md` — Feature-Inventar + Kennzahlen, Stand 30.09.2026.
  **Vor jeder Aussage „das fehlt noch" dort nachsehen** und gegen `CLAUDE.md` gegenprüfen.
- `docs/BETREIBER-CHECKLISTE.md` — was nur der Betreiber tun kann, mit Wortlauten.
- `docs/FEEDBACK-BEWERTUNG-2026-09.md` — externes Feedback vom 08.09., geprüft, mit Plan.
- `docs/SICHERHEIT-ABHAENGIGKEITEN.md` — Schwachstellen-Befunde und ihre Grenzen.
- `docs/MASTERPLAN.md` — Markt/Compliance/Steuer-Roadmap (u. a. §11 Finanzierungs-Assistent,
  §12 Portfolio-Wert-Quellen).
- `docs/compliance/AVV-STATUS.md` — DSGVO/AVV je Anbieter.
- `supabase/migrations/README.md` — Migrations-Regeln + Historie.
