# 01 — Vorgehen von der Idee zur Live-App

Die Reihenfolge ist nicht beliebig. Jede Etappe erzeugt Artefakte, auf die die
nächste sich stützt. Wer sie tauscht, macht Arbeit doppelt.

## Etappe 0 — Verstehen, bevor gebaut wird

**Ergebnis: ein Satz, wer die App benutzt und welches Problem verschwindet.**

Konkret zu klären, bevor eine Zeile Code entsteht:
- **Wer zahlt** und wer benutzt — bei MyImmo der Vermieter, aber Mieter und
  Dienstleister bekommen eigene Rollen mit eigenen Rechten. Rollen früh
  festlegen, sie bestimmen das Datenmodell und die RLS.
- **Welche Daten sind heikel** — bei MyImmo Mieterdaten (fremde
  personenbezogene Daten!) und Bankverbindungen. Das entscheidet über
  Verschlüsselung, AVV-Pflicht und Löschkonzept, nicht die Optik.
- **Wo verläuft die Berufsrechtsgrenze** — siehe [[06 Recht und Compliance]].
  Bei MyImmo: § 34i GewO (Finanzierung) und StBerG (Steuer). Das ändert
  Wortwahl und Funktionsumfang, nicht nur einen Haftungshinweis.
- **Was ist der kleinste Nutzen, der schon trägt** — die App muss ab dem ersten
  Objekt nützlich sein, nicht erst ab dem zehnten.

**Risiko zuerst:** Der häufigste Fehler ist, mit dem Datenmodell zu beginnen.
Das Datenmodell folgt aus den Rollen und den Rechten, nicht umgekehrt.

## Etappe 1 — Fundament

**Ergebnis: leere App, die deployt, mit Auth und einer geschützten Tabelle.**

1. Next.js 15 App Router, TypeScript, Tailwind nur als Basis (Komponenten
   nutzen eigene Klassen, siehe [[03 Design und Layout]]).
2. Supabase-Projekt in **eu-central-1** (Datenschutz: EU-Verarbeitung).
3. **Eine** Tabelle mit RLS anlegen und die Policy testen — mit einem zweiten
   Konto, nicht theoretisch.
4. Vercel verbinden, `main` → automatischer Deploy.
5. Env-Variablen dokumentieren, **bevor** sie gebraucht werden (siehe
   [[05 Anbindungen und Vertraege]]).

**Prüfpunkt:** Ein zweites Konto darf die Daten des ersten nicht sehen. Wer das
nicht mit zwei echten Konten prüft, hat es nicht geprüft.

## Etappe 2 — Datenmodell und Zugriffskontrolle

**Ergebnis: Schema im Repo, RLS für jede Tabelle, Migrationsregel etabliert.**

- **Jede Tabelle bekommt RLS**, auch die scheinbar harmlose. In MyImmo liegen
  78 Policies über 42 Tabellen.
- **Migrationen sind Pflicht** — siehe [[02 Code-Regeln und Architektur]].
  In MyImmo existierten Fundament-Tabellen und **sämtliche RLS-Policies**
  monatelang nur in der Datenbank, nicht im Repo. Die Zugriffskontrolle war
  damit weder reviewbar noch reproduzierbar. Repariert per Baseline-Snapshot.
- **Löschkonzept mitdenken** (Art. 17 DSGVO): Was passiert mit den Daten eines
  Mieters, wenn der Vermieter sein Konto löscht? In MyImmo eine eigene
  Migration (`kontoloeschung_vollstaendig`) plus `lib/loeschUmfang.ts`.

## Etappe 3 — Rechenkern

**Ergebnis: reine Funktionen mit Tests, ohne jede UI.**

Der Rechenkern kommt **vor** der Oberfläche. Er ist das, was die App wertvoll
macht, und das Einzige, was still falsch sein kann. Regeln: [[04 Rechner und Kalkulatoren]].

## Etappe 4 — Oberfläche

**Ergebnis: Seiten, die den Rechenkern bedienen.**

Erst jetzt Layout. Wer vorher gestaltet, gestaltet um Zahlen herum, die sich
noch ändern.

## Etappe 5 — Dokumente und Export

**Ergebnis: PDF/CSV/DATEV im verbindlichen Dokument-Stil.**

Bei MyImmo ist der Dokument-Stil in `CLAUDE.md` verbindlich geregelt und in
`lib/pdf/docPdf.ts` implementiert. Vorlagen zum Wiederverwenden liegen in
`scripts/gen-avv-pdf.mjs` und `scripts/gen-businessplan-pdf.mjs`.

## Etappe 6 — Anbindungen

**Ergebnis: externe Dienste angebunden, Verträge geschlossen.**

Reihenfolge: **Vertrag und AVV zuerst, Code danach.** Bei MyImmo wurde Open
Banking komplett gebaut (Etappen 1–4), bevor Anbietervertrag und AVV standen —
der Code liegt seitdem inaktiv da. Nicht falsch, aber gebundenes Kapital.

## Etappe 7 — Recht, Zahlung, Start

**Ergebnis: Impressum, Datenschutz, AGB, Bezahlsystem — anwaltlich geprüft.**

Das ist keine Formalie am Ende, sondern der Punkt, an dem eine Idee zum
Unternehmen wird. Details: [[06 Recht und Compliance]].

## Etappe 8 — Betrieb

- **Cron/Jobs** über GitHub Actions gegen eine geschützte API-Route
  (`CRON_SECRET` in beiden Systemen identisch).
- **Fristen** als eigenes Modul (`lib/fristen.ts`), nicht verstreut.
- **Prüfzyklus** für alternde Daten: [[07 Volatile Kennzahlen und Pruefzyklus]].
