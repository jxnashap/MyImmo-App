# MyImmo — Briefing für neue Chats/Sessions (ZUERST LESEN)

> Zweck: Ein anderer Chat/eine neue Session versteht MyImmo in 5 Minuten.
> Reihenfolge zum Einlesen: **diese Datei → `CLAUDE.md` → `docs/PROJEKT-STATUS.md` → `docs/MASTERPLAN.md`**.
> Stand: 19.07.2026.

## Was ist MyImmo
Deutschsprachige **Immobilienverwaltung für private Vermieter** (SaaS). Objekte, Mieter,
Mietkonto, Ein-/Ausgaben, Nebenkostenabrechnung, Kredite, Steuer (Anlage V, AfA, DATEV),
Banking-Anbindung (geplant), Kauf-/Verkauf-/Marktwert-Kalkulatoren, Portfolio-Karte,
Wertentwicklung.

- **Live:** https://my-immo-app.vercel.app (Vercel, Auto-Deploy bei Merge nach `main`)
- **Repo:** `jxnashap/myimmo-app`
- **Arbeitsbranch (dieser Kontext):** `claude/magical-feynman-l8w9s5`

## Stack
Next.js 14 (App Router, Server Components + Server Actions) · TypeScript · Supabase
(Postgres + RLS, Projekt `kozhxrvyilkchjpcuwcm`, eu-central-1) · Vercel · vitest.
Kein Tailwind-Framework-Look — **eigenes CSS in `app/globals.css`** mit Klassen
(`.section`, `.btn`, `.kpi-card`, `.badge`, `.input`, `.nav-item`, …). Hell-/Dunkelmodus
über `[data-theme]`.

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
  (Platzhalter genügen) · `npx vitest run` (Tests decken nur lib-Purefunctions ab, ~183 Tests —
  keine Server-Action/RLS/E2E-Coverage).
- **PR-Workflow:** Branch → Build+Tests grün → commit → force-with-lease push → PR → **squash-merge**
  → Branch auf `origin/main` zurücksetzen → Live-URL nennen. Committer-Identität
  `noreply@anthropic.com`. Der Stop-Hook „Unverified commit" beim GitHub-Squash-Commit
  (`noreply@github.com`) ist ein **bekannter Fehlalarm** — gemergte Historie NICHT amenden.
- **Env-Vars (Vercel):** `NEXT_PUBLIC_SUPABASE_*`, `ANTHROPIC_API_KEY` (OCR/KI),
  `DATA_ENCRYPTION_KEY`. Optional Bedrock (EU-KI) `BEDROCK_*`; Enable Banking `ENABLE_BANKING_*`.

## Aktueller Stand (was existiert)
Voll funktionsfähige App mit: Dashboard, Immobilien (Liste/Detail/Edit), Mieter, Mietkonto,
Ein-/Ausgaben (+ CSV-Import, wiederkehrende Buchungen), Verbrauch, Kredite, Banking-Sandbox-
Grundgerüst, Steuer (Anlage V + ELSTER-Hilfe + DATEV-Export), AfA-Assistent, Archiv,
Jahresbericht, Kauf-/Verkauf-Assistent, Marktwert-Schätzer (ImmoWertV), Portfolio-Karte
(Leaflet, dark), Wertentwicklung (Eurostat-HPI-Fortschreibung), Onboarding-Tour,
Command-Palette (Cmd+K), collapsible Sidebar, Toast/Breadcrumbs.

**Zuletzt (diese Session):** großer **UX-/Effizienz-Scan** (8 Agenten) → 87 Vorschläge,
umgesetzt in Etappen 1–4 (Deep-Links, Prefills, Korrektheits-Fixes wie AfA-Warnung/
Wert-Fallback/Kredit-Tilgung, Feinschliff). Volle Vorschlagsliste + Restposten siehe unten.

## Offene Punkte / Entscheidungen (Merkliste)
- **Design-Überarbeitung** → bewusst **„zum Schluss"**. Gewählte Richtung: **Fintech-hell
  (Stripe/N26 + bisschen Apple)**, mit **echter Neu-Anordnung** (nicht nur umfärben), Gold
  bleibt Markenzeichen. Verworfen: „Quiet-Luxury"-Ivory und Neon-Bento. (Mockups nur als
  Artifacts, nicht im Code.)
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
Vercel Pro (AVV + kommerzielle Nutzung — mit dem angemeldeten Gewerbe jetzt dringlich),
Supabase-DPA signieren, AWS-Bedrock-/Enable-Banking-Keys, anwaltliche Prüfung (§34i GewO
Finanzierungs-Assistent, StBerG Steuer-Features, Nutzer-AVV, Impressum/Datenschutz).
✅ Gewerbe angemeldet (GewA 1 Bad Schwartau, bescheinigt 16.07.2026, Nebenerwerb, SaaS-Tätigkeit);
✅ Impressum/Datenschutz tragen die echten Daten und stimmen mit der Anmeldung überein (24.07.2026).
Nach Deploy einmalig `/api/encrypt-bankdaten` aufrufen (migriert Bankdaten).
Details: `docs/compliance/AVV-STATUS.md`.

## Wo mehr steht
- `CLAUDE.md` — Projekt-Regeln, Merkliste, Deployment, Env, DB.
- `docs/PROJEKT-STATUS.md` — Feature-Inventar (älter, aber ausführlich).
- `docs/MASTERPLAN.md` — Markt/Compliance/Steuer-Roadmap (u. a. §11 Finanzierungs-Assistent,
  §12 Portfolio-Wert-Quellen).
- `docs/compliance/AVV-STATUS.md` — DSGVO/AVV je Anbieter.
- `supabase/migrations/README.md` — Migrations-Regeln + Historie.
