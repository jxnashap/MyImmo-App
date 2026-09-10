# MyImmo — Briefing für neue Chats/Sessions (ZUERST LESEN)

> Zweck: Ein anderer Chat/eine neue Session versteht MyImmo in 5 Minuten.
> Reihenfolge zum Einlesen: **diese Datei → `CLAUDE.md` → `docs/PROJEKT-STATUS.md` → `docs/MASTERPLAN.md`**.
> Stand: **10.09.2026**.

## Was ist MyImmo
Deutschsprachige **Immobilienverwaltung für private Vermieter** (SaaS). Objekte, Mieter,
Mietkonto, Ein-/Ausgaben, Nebenkostenabrechnung, Kredite, Steuer (Anlage V, AfA, DATEV),
Kauf-/Verkauf-/Marktwert-Kalkulatoren, Portfolio-Karte,
Wertentwicklung.

- **Live:** https://www.myimmoapp.de (eigene Domain; Vercel, Auto-Deploy bei Merge nach `main`)
- **Repo:** `jxnashap/myimmo-app`
- **Arbeitsbranch (dieser Kontext):** `claude/magical-feynman-l8w9s5`

## Stack
**Next.js 15.5.25 / React 19.2.8** (App Router, Server Components + Server Actions) ·
TypeScript · Supabase (Postgres + RLS, Projekt `kozhxrvyilkchjpcuwcm`, **Pro-Plan**,
eu-central-1) · Vercel (**Pro**) · vitest.
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
  (Platzhalter genügen) · `npx vitest run` — **1.211 Tests in 93 Dateien** (Stand 10.09.2026).
  **Nicht mehr nur Purefunctions:** Alle **36 Action-Dateien** und die **20 API-Routen** sind
  abgedeckt (Prüfstand `tests/stubs/actionHarness.ts`; `mfa.ts` über `tests/zweiFaktor.test.ts`). Weiterhin ohne Abdeckung:
  `components/`, `lib/pdf/`, RLS-Policies.
- 🔥 **`npm run rauchtest`** — sechs Kernwege gegen die LAUFENDE App (nur lesend, Demo-Konto).
  Der einzige Test, der je eine Seite ausliefert. **Nicht bei jedem Push** (setzt den
  geteilten Demo-Bestand zurück). Grenzen und Fallstricke: `CLAUDE.md`.
- 🧪 **Regel, die hier alles trägt: Einen neuen Test erst glauben, wenn er gegen einen
  absichtlich eingebauten Fehler ROT wird.** Mehrere grüne Tests haben sich so als wertlos
  erwiesen — und zwei Wächter als blind.
- ⚠️ **`npx vitest run | tail` verschluckt den Exit-Code** — so ist #317 mit rotem Test
  durchgegangen. Vor einem Commit: `npx vitest run > datei; echo $?`.
- ⛔ **`npm install` läuft in der Remote-Umgebung NICHT** (Arborist-Fehler); nur `npm ci`.
  Abhängigkeits-Updates brauchen einen anderen Rechner.
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

Umfang (10.09.2026): **56 Seiten**, **20 API-Routen**, **36 Action-Dateien**,
**32 Migrationen**, **19 Ratgeber-Artikel**.

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
  **noch nie mit einer echten Mail erfolgreich durchlaufen**; es fehlen zwei Einstellungen
  im Supabase-Dashboard (`docs/BETREIBER-CHECKLISTE.md`, Punkte 1–3).

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
Die drei dringenden hängen alle am selben Kernweg: Supabase-URL-Konfiguration,
E-Mail-Vorlage auf `token_hash`, „Passwort vergessen" einmal echt testen.
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
- `docs/PROJEKT-STATUS.md` — Feature-Inventar + Kennzahlen. **Achtung: Stand 31.07.2026,
  also älter als dieses Briefing** — die September-Änderungen oben stehen dort noch nicht.
  **Vor jeder Aussage „das fehlt noch" trotzdem dort nachsehen**, aber gegen `CLAUDE.md`
  gegenprüfen.
- `docs/BETREIBER-CHECKLISTE.md` — was nur der Betreiber tun kann, mit Wortlauten.
- `docs/FEEDBACK-BEWERTUNG-2026-09.md` — externes Feedback vom 08.09., geprüft, mit Plan.
- `docs/SICHERHEIT-ABHAENGIGKEITEN.md` — Schwachstellen-Befunde und ihre Grenzen.
- `docs/MASTERPLAN.md` — Markt/Compliance/Steuer-Roadmap (u. a. §11 Finanzierungs-Assistent,
  §12 Portfolio-Wert-Quellen).
- `docs/compliance/AVV-STATUS.md` — DSGVO/AVV je Anbieter.
- `supabase/migrations/README.md` — Migrations-Regeln + Historie.
