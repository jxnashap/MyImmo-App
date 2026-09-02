# 02 — Code-Regeln und Architektur

## Der Stack und warum

**Next.js 15 App Router · Supabase (Postgres, Auth, RLS) · Vercel · TypeScript ·
vitest.** Kein Storage-Bucket (Dateien als Base64 in Spalten), kein ORM, keine
eigene Backend-Schicht.

**Grenze:** Alles Langlaufende (Video, große Batches) und Echtzeit-Kollaboration
passt nicht. Bis dahin trägt der Stack und kostet fast nichts.

## Sprache

**Alles auf Deutsch** — Bezeichner, Kommentare, Commits, Fehlermeldungen.
`kaltmiete`, nicht `coldRent`. Das klingt ungewohnt und ist trotzdem richtig:
Die Fachbegriffe sind deutsch, die Übersetzung erzeugt nur Mehrdeutigkeit
(„Nebenkosten" ≠ „additional costs"). Ausnahme: etablierte Technikbegriffe.

## Schichten

```
app/            Seiten (Server Components) und API-Routen
components/     UI, Client Components nur wo nötig
lib/            Fachlogik — REIN, ohne DOM, ohne Supabase
lib/actions/    Server Actions (Schreiben, Auth-Prüfung)
lib/supabase/   Client/Server/Admin-Clients
supabase/       Migrationen
tests/          vitest gegen lib/
```

**Die wichtigste Regel:** `lib/` enthält reine Funktionen. Kein `document`, kein
Netzwerk, keine Datenbank. Nur so ist der Rechenkern testbar — 395 Testfälle in
MyImmo laufen ohne Datenbank und ohne Browser.

## Zugriffskontrolle gehört in die Datenbank

RLS auf **jeder** Tabelle. Die Server Action prüft zusätzlich `auth.getUser()`,
aber die Policy ist die Wahrheit. Wer die Kontrolle nur in die Anwendung legt,
verliert sie beim ersten direkten API-Zugriff.

**Muster einer Policy** (aus `supabase/migrations/`):

```sql
alter table public.selbstauskunft enable row level security;
create policy "selbstauskunft_select_own" on public.selbstauskunft
  for select using (auth.uid() = user_id);
-- je eine für insert / update / delete, nie eine Sammelpolicy für alles
```

**Prüfung:** Mit einem **zweiten echten Konto** gegenlesen. Eine Policy, die nur
gedanklich geprüft wurde, ist nicht geprüft.

## Migrationsregel (verbindlich)

Jede Schemaänderung läuft über **zwei Schritte, immer beide**:
1. `apply_migration` (Supabase MCP) — ausführen und versionieren
2. Dieselbe SQL als Datei `supabase/migrations/<version>_<name>.sql` **im selben
   PR** committen

**Kein DDL über `execute_sql`.** Sonst driften Datenbank und Repo auseinander —
in MyImmo lagen Fundament-Tabellen und alle 78 RLS-Policies monatelang nur in
der Datenbank. Repariert per idempotentem Baseline-Snapshot, der gegen ein
leeres PostgreSQL 16 verifiziert wurde.

## Server Actions

```ts
"use server";
export async function tuEtwas(...) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  // … RLS greift zusätzlich
  revalidatePath("/pfad");
}
```

- **Rückgabe statt Exception** bei erwartbaren Fehlern — die UI zeigt Text an.
- **Fehlermeldungen sagen, was zu tun ist.** Nicht „Ungültiger Code", sondern
  „Zugangscode stimmt nicht. MyImmo ist noch im Early Access — einen Code
  bekommst du unter kontakt@…". Ein Fehler ohne Ausweg ist eine Sackgasse.
- **Geheimnisse nie im Client.** Alles mit `NEXT_PUBLIC_`-Präfix landet im
  ausgelieferten JavaScript. In MyImmo wurde ein Zugangscode so einmal
  öffentlich; die Prüfung liegt seitdem serverseitig
  (`lib/actions/freischaltung.ts`) — mit Bremse: 8 Versuche je 15 Minuten und IP.

## Verschlüsselung sensibler Spalten

IBAN, Kontoinhaber, Darlehensnummer, Kautionsbank sind **App-Layer-verschlüsselt**
(AES-256-GCM, `lib/crypto/secure.ts`). Der Schlüssel liegt als Vercel-Env
`DATA_ENCRYPTION_KEY`, **nicht in der Datenbank** — sonst schützt er nicht gegen
ein Datenbank-Leak. Für Dublettenprüfung ein **Blind-Index** (`iban_bidx`).

**Risiko:** Schlüsselverlust = Daten unwiederbringlich weg. Gehört in einen
Passwortmanager, nie ins Repo oder in Logs.

## Kommentare

Kommentare erklären **warum**, nicht was. Der wertvollste Kommentartyp in diesem
Projekt beschreibt einen **behobenen Fehler**, damit ihn niemand zurückbaut:

```ts
// ACHTUNG: `bundesland` ist KEINE Nutzereingabe, sondern der Maschinenwert der
// Auswahl ("0.035" = 3,5 % Grunderwerbsteuer). Solche Werte gehoeren nicht in
// den deutschen Zahlenparser — der hielt den Punkt fuer ein Tausendertrennzeichen
// und machte aus 0,035 die Zahl 35, also 3500 % Grunderwerbsteuer.
```

## Tests

- **vitest gegen `lib/`.** 39 Dateien, 395 Fälle in MyImmo.
- **Jede Rechenfunktion wird getestet**, keine Ausnahme.
- **Der Test muss den Fehler finden können.** Ein Test, der auch auf der kaputten
  Fassung grün ist, beweist nichts. Nach jeder Fehlerbehebung: Test gegen den
  alten Stand laufen lassen und **prüfen, dass er dort durchfällt**.
- **Erwartungswerte im Test als Rechnung notieren**, nicht als nackte Zahl:
  ```ts
  // 300000*(0.038+0.02)/12 = 1450
  expect(Math.round(k.monatsrate)).toBe(1450);
  ```
- **Ohne Abdeckung wird es benannt.** Was keine Tests hat, steht in `CLAUDE.md`,
  statt verschwiegen zu werden. Stand 02.09.2026: 52 Testdateien, **544 Tests, alle
  grün** (`npm test`) — der bis dahin genannte Ausreißer Open Banking ist am
  29.08.2026 samt Code aus der App entfernt worden.

## Build

`npm run build` verifiziert. Braucht die `NEXT_PUBLIC_SUPABASE_*`-Variablen;
Platzhalter genügen.
