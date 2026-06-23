# MyImmo — Immobilien-Management für Privatvermieter

Next.js (App Router, TypeScript, Tailwind) + Supabase (Postgres, Auth, Storage).
Dieses Grundgerüst ist der Start für die neue, modulare Version von MyImmo.

## Vision (Phasenplan)

1. **Fundament** ← *du bist hier*: Datenmodell + Next.js-Gerüst + Auth + Portfolio-Übersicht
2. **Kernverwaltung**: Objekte, Einheiten, Mieter, Mietverträge anlegen & bearbeiten
3. **Dokumente**: Mahnung, Kündigung, Anschreiben als PDF generieren + an Mieter mailen
4. **Betriebskosten**: Abrechnung hochladen → OCR → Positionen pro Mieter → Nebenkostenabrechnung → mailen
5. **Bewertung**: Bodenrichtwerte + Marktdaten → laufende Neubewertung des Portfolios

## Schnellstart (lokal)

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen anlegen
cp .env.local.example .env.local
#    NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY eintragen
#    (Supabase Dashboard > Project Settings > API)
#    Projekt: kozhxrvyilkchjpcuwcm

# 3. Dev-Server starten
npm run dev
#    → http://localhost:3000
```

## Supabase

> ⚠️ Die Datenbank existiert bereits und enthält echte Daten (9 Objekte,
> 6 Mieter, Buchungen). **Kein Schema einspielen.** `supabase/schema.sql`
> ist veraltet; die tatsächliche Struktur steht in `supabase/schema-reference.sql`.

- **Tabellen**: `properties`, `mieter`, `einnahmen`, `kosten`, `kredite`,
  `verbrauch`, `notizen`, `termine`, `ibans`. Besitzspalte überall `user_id`.
- **RLS**: aktiv, Policy `auth.uid() = user_id` — jeder Vermieter sieht nur
  seine eigenen Daten. Diese App setzt beim Anlegen `user_id` automatisch.
- **Auth**: E-Mail-Login ist aktiv (`/login`).

## Deploy auf Vercel

1. Code in ein GitHub-Repo pushen.
2. Auf https://vercel.com das Repo importieren (Framework wird automatisch als
   Next.js erkannt).
3. Die drei `NEXT_PUBLIC_*`-Variablen unter **Settings > Environment Variables**
   eintragen.
4. Jeder Push auf `main` deployt automatisch.

## Projektstruktur

```
app/
  layout.tsx              Layout + Navigation + Abmelden
  page.tsx                Portfolio-Übersicht
  login/page.tsx          Login / Registrierung
  auth/signout/route.ts   Logout
  properties/             Objekte: Liste, /new, /[id]/edit
  tenants/                Mieter:  Liste, /new, /[id]/edit
  globals.css
components/
  PropertyForm.tsx        Objekt-Formular
  TenantForm.tsx          Mieter-Formular
lib/
  supabase/client.ts      Supabase-Client (Browser)
  supabase/server.ts      Supabase-Client (Server)
  actions/properties.ts   Server Actions (create/update/delete)
  actions/tenants.ts      Server Actions (create/update/delete)
  types.ts                TypeScript-Typen (= echtes Schema)
middleware.ts             Session-Refresh
supabase/
  schema-reference.sql    Doku des bestehenden Schemas (nicht ausführen)
```

## Datenmodell (Kurzüberblick)

`properties` (Objekt) ← `mieter` (über `prop_id`)
`einnahmen` · `kosten` · `kredite` · `verbrauch` · `notizen` · `termine` · `ibans`
(alle mit `prop_id` → `properties.id`)

Jede Zeile gehört genau einem Vermieter (`user_id = auth.uid()`),
abgesichert per Row-Level-Security.

## Fertig

- ✅ Login / Registrierung (Supabase Auth)
- ✅ Portfolio-Übersicht (Gesamtwert, Soll-Miete)
- ✅ Objekte: anlegen, bearbeiten, löschen
- ✅ **Objekt-Detailseite** im alten Look: KPIs, Kennzahlen (Preis/m², Faktor,
  Bruttomietrendite), Mieter, Finanzierung/Kredite, Cashflow, Jahresübersicht
- ✅ Mieter: anlegen, bearbeiten, löschen (mit Objekt-Zuordnung)
- ✅ **Umlagepositionen pro Mieter**: individuelle Positionen (Müll, Abwasser,
  Grundsteuer …) je Mieter, mit Umlageschlüssel und Umlagefähigkeit

### Neue Tabelle (additiv, bereits angelegt)

`mieter_positionen` — id, user_id, mieter_id → mieter, bezeichnung, betrag,
umlageschluessel, jahr, umlagefaehig, created_at. RLS: `auth.uid() = user_id`.
Per Migration `add_mieter_positionen` angewendet — bestehende Daten unberührt.

## Nächste Schritte

- Aus den Umlagepositionen die fertige **Nebenkostenabrechnung** je Mieter (PDF)
- Dokumentengenerator (Mahnung, Kündigung, Anschreiben) + Mailversand
- Betriebskosten-Upload + OCR → Positionen automatisch vorbefüllen
- Laufende Bewertung (Bodenrichtwerte / Marktdaten)

> Hinweis zur Bewertung: Bodenrichtwerte gibt es offiziell über die
> BORIS-Portale der Bundesländer. Vergleichspreise aus Immobilienportalen
> sind nicht frei/legal per API verfügbar — diese Phase bewusst später planen.
