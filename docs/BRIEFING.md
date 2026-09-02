# MyImmo — Briefing für neue Chats/Sessions (ZUERST LESEN)

> Zweck: Ein anderer Chat/eine neue Session versteht MyImmo in 5 Minuten.
> Reihenfolge zum Einlesen: **diese Datei → `CLAUDE.md` → `docs/PROJEKT-STATUS.md` → `docs/MASTERPLAN.md`**.
> Stand: 28.08.2026.

## Was ist MyImmo
Deutschsprachige **Immobilienverwaltung für private Vermieter** (SaaS). Objekte, Mieter,
Mietkonto, Ein-/Ausgaben, Nebenkostenabrechnung, Kredite, Steuer (Anlage V, AfA, DATEV),
Kauf-/Verkauf-/Marktwert-Kalkulatoren, Portfolio-Karte,
Wertentwicklung.

- **Live:** https://www.myimmoapp.de (eigene Domain; Vercel, Auto-Deploy bei Merge nach `main`)
- **Repo:** `jxnashap/myimmo-app`
- **Arbeitsbranch (dieser Kontext):** `claude/magical-feynman-l8w9s5`

## Stack
Next.js 14 (App Router, Server Components + Server Actions) · TypeScript · Supabase
(Postgres + RLS, Projekt `kozhxrvyilkchjpcuwcm`, eu-central-1) · Vercel · vitest.
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
  (Platzhalter genügen) · `npx vitest run` (**552 Tests in 53 Dateien**, nachgezählt 02.09.2026, decken im Wesentlichen
  lib-Purefunctions ab — keine Coverage für `components/`, `lib/actions/`, `lib/pdf/`, RLS oder E2E).
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

**Zuletzt (August 2026):** Landing im Quiet-Luxury-Stil, App-Redesign „Frosted Paper",
**Bewerbungs-Dokumente im Mieterportal** (verschlüsselte Slot-Uploads + DSGVO-Aufräumen +
Objekt-Steckbrief auf der Bewerbungsseite), großer **UX-Audit** (100 Screenshots über 40 Routen,
Pakete A–C umgesetzt: mobile Geldspalten/Scroll-Container, Zahlenformate, Farbsemantik,
Fristenlogik, Leerzustände), Datenschutz-Passus für den Vorlagen-Verteiler.

## Offene Punkte / Entscheidungen (Merkliste)
- **Design- & Layout-Überarbeitung** — **Runde 1 umgesetzt (20.08.2026)**: „Frosted Paper"
  (shadcn-artig monochrom-hell), Gold `#D4A847` als schmaler Akzent, **Geist statt Outfit**
  als UI-Schrift (Fraunces+Outfit bleiben nur noch auf der Landing). Dokument-/PDF-Design
  unverändert. **Offen (Runde 2):** echte Neu-Anordnung einzelner Layouts, 11px-Texte auf 12px,
  lange Mobilseiten brauchen Binnennavigation.
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
AWS-Bedrock-Keys, Brevo-AVV, Supabase-Mindestpasswortlänge auf 8,
anwaltliche Prüfung (§34i GewO Finanzierungs-Assistent, StBerG Steuer-Features,
Nutzer-AVV, Impressum/Datenschutz/AGB).
✅ Vercel Pro seit 29.07.2026 (AVV greift über die ToS, kommerzielle Nutzung erlaubt).
✅ Gewerbe angemeldet (GewA 1 Bad Schwartau, bescheinigt 16.07.2026, Nebenerwerb, SaaS-Tätigkeit);
✅ Impressum/Datenschutz tragen die echten Daten und stimmen mit der Anmeldung überein (24.07.2026).
Nach Deploy einmalig `/api/encrypt-bankdaten` aufrufen (migriert Bankdaten).
Details: `docs/compliance/AVV-STATUS.md`.

## Wo mehr steht
- `CLAUDE.md` — Projekt-Regeln, Merkliste, Deployment, Env, DB.
- `docs/PROJEKT-STATUS.md` — vollständiges Feature-Inventar + Kennzahlen (Stand 28.08.2026).
  **Vor jeder Aussage „das fehlt noch" dort nachsehen.**
- `docs/MASTERPLAN.md` — Markt/Compliance/Steuer-Roadmap (u. a. §11 Finanzierungs-Assistent,
  §12 Portfolio-Wert-Quellen).
- `docs/compliance/AVV-STATUS.md` — DSGVO/AVV je Anbieter.
- `supabase/migrations/README.md` — Migrations-Regeln + Historie.
