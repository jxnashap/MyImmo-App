# MyImmo — Immobilienverwaltung für private Vermieter

Live: **https://www.myimmoapp.de** · Status: Early Access (Registrierung nur mit Zugangscode),
öffentliche Demo auf der Startseite.

Zwei Bereiche in einer App und einem Konto, gewechselt am Logo oben links:

- **MyImmo** — die laufende Verwaltung: Objekte, Mieter, Mietkonto mit Soll/Ist,
  Ein- und Ausgaben, Kredite, Nebenkostenabrechnung, Anlage V und Jahresbericht,
  Briefe und PDFs, Termine und Fristen, Archiv. Dazu ein **Mieterportal**
  (Dokumente, Anliegen, Zählerstände) und ein **Service-Portal** für Hausmeister
  und Dienstleister.
- **BuyImmo** — der Weg zum nächsten Kauf: Objektvergleich, Besichtigung und
  Sanierungsrechner, Finanzierung, Makler- und Bank-Unterlagen per Freigabe-Link,
  Abschluss.

## Technik

- **Next.js 16** (App Router, Turbopack, `proxy.ts`) · **React 19** · TypeScript · Tailwind
- **Supabase** (Postgres mit Row-Level-Security auf allen Tabellen, Auth mit 2FA),
  Region Frankfurt
- **Vercel** — jeder Merge nach `main` deployt automatisch
- **vitest** für Tests, ESLint (`npm run lint` muss 0 Fehler melden)

## Lokal starten

Node **22** oder neuer (CI läuft auf Node 22; unter Node 20 scheitert der Supabase-Client).

```bash
npm ci
# .env.local anlegen mit mindestens:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev        # http://localhost:3000
```

Für `npm run build` genügen Platzhalter in den beiden Variablen. Welche weiteren
Variablen es gibt und wofür (Zugangscode, KI, Mailversand, Verschlüsselung, Cron),
steht in `CLAUDE.md` unter „Benötigte Environment-Variablen". Geheimnisse gehören
nur in Vercel bzw. `.env.local`, nie ins Repo.

## Prüfen

```bash
npx tsc --noEmit   # Typen
npm run lint       # muss 0 Fehler / 0 Warnungen melden
npm test           # alle Tests
npm run build      # Produktions-Build
npm run rauchtest  # Kernwege gegen die LIVE-App (setzt die Demo zurück, sparsam einsetzen)
```

## Aufbau

```
app/(pub)/      Öffentliche Unterseiten: Funktionen, Ratgeber, Vorlagen, Rechtsseiten
app/(app)/      App: Dashboard, Verwaltung, BuyImmo, Mieter- und Service-Portal, Login
app/api/        Exporte, PDFs, Cron, Webhooks, Datei-Auslieferung
components/     Oberfläche
lib/            Fachlogik — Rechnungen überwiegend als reine, getestete Funktionen
lib/actions/    Server Actions
proxy.ts        Anmeldung, 2FA-Gate, Demo-Sperren, Sicherheits-Header
supabase/migrations/   jede Schemaänderung als Datei (Regeln: README dort)
tests/          vitest
scripts/        PDF-Erzeugung, Rauchtest, Design-Scan
docs/           Projektwissen (als Obsidian-Vault nutzbar, Start: docs/00 Index.md)
```

## Weiterlesen

- **`CLAUDE.md`** — Arbeitsregeln, bekannte Fallen, offene Punkte, Deployment
- **`docs/BRIEFING.md`** — Kurzeinstieg in den Projektstand
- **`docs/PROJEKT-STATUS.md`** — was gebaut ist, was inaktiv, was nur der Betreiber erledigen kann
- **`supabase/migrations/README.md`** — Migrations-Regeln und Historie

`supabase/schema.sql` und `supabase/schema-reference.sql` sind alte Stände aus der
Anfangszeit und **nicht** maßgeblich — das Schema ergibt sich aus den Migrationen.
