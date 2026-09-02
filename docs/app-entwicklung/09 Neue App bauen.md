# 09 — Neue App bauen

> Ablauf für den Fall: **„Hier ist eine App-Idee, bau sie nach der Vault."**

## Was ich zuerst tue

1. **Diese Vault lesen** — mindestens [[02 Code-Regeln und Architektur]],
   [[04 Rechner und Kalkulatoren]], [[07 Volatile Kennzahlen und Pruefzyklus]],
   [[08 Fehlerkatalog]].
2. **Fällige Prüfungen aus 07 abarbeiten**, bevor gebaut wird. Eine App auf
   veralteten Sätzen ist ab dem ersten Tag falsch.
3. **Die Idee auf Etappe 0 herunterbrechen** ([[01 Vorgehen von der Idee zur Live-App]]):
   Wer benutzt, wer zahlt, welche Daten sind heikel, wo verläuft die
   Berufsrechtsgrenze, was ist der kleinste tragende Nutzen.

## Was ich dich frage — und nur das

Nur Fragen, deren Antwort die Arbeit **wirklich verändert**. Alles andere
entscheide ich nach der Vault und sage es dazu:

1. **Rollen** — wer außer dir benutzt die App, und was darf jede Rolle?
2. **Fremde personenbezogene Daten?** Wenn ja: eigener AVV, Löschkonzept,
   Verschlüsselung — das ändert Aufwand und Recht erheblich.
3. **Berufsrechtlich heikel?** Finanz-, Steuer-, Rechts-, Gesundheitsnähe.
4. **Soll Geld fließen** — und ab wann?
5. **Was ist der eine Satz**, an dem du merkst, dass die App funktioniert?

## Was ich ohne Nachfrage übernehme

- Stack: **Next.js 14 App Router · Supabase (eu-central-1) · Vercel ·
  TypeScript · vitest**
- **Deutsch** als Sprache im Code
- **RLS auf jeder Tabelle**, Migrationsregel (zwei Schritte, immer beide)
- **Reine Fachlogik in `lib/`**, Tests von Anfang an
- **Eine Akzentfarbe, zwei Schriften**, Token statt Literale, Hell und Dunkel
  vollständig
- **Deutsche Zahlenformate** und der geprüfte Parser
- **Keine Geheimnisse mit `NEXT_PUBLIC_`**
- **Env dokumentieren, bevor sie gebraucht wird**
- **Ehrlicher Abbruch statt stillem No-op** bei fehlender Konfiguration

## Reihenfolge, in der ich baue

| # | Etappe | Fertig, wenn … |
|---|---|---|
| 1 | Fundament | leere App deployt, Auth läuft, **zweites Konto sieht die Daten des ersten nicht** |
| 2 | Datenmodell + RLS | Schema im Repo, jede Tabelle mit Policy, Löschkonzept steht |
| 3 | Rechenkern | reine Funktionen, Tests grün, Erwartungswerte als Rechnung kommentiert |
| 4 | Oberfläche | bedient den Rechenkern, Fokus- und Tastaturführung geprüft |
| 5 | Dokumente | PDF/CSV im verbindlichen Dokument-Stil, per Skript erzeugt |
| 6 | Anbindungen | **Vertrag und AVV zuerst**, dann Code |
| 7 | Recht + Zahlung | Impressum, Datenschutz, AGB, Nutzer-AVV — anwaltlich zu prüfen markiert |
| 8 | Betrieb | Cron geschützt, Fristen zentral, Prüfzyklus eingetragen |

## Wie ich liefere

- **Gemessen, nicht behauptet.** Was ausgeliefert wird, wird geprüft — und die
  Prüfung meldet mit, wie viel sie geprüft hat.
- **Risiko zuerst.** Bei jeder Entscheidung erst die Schwachstelle, dann die
  Begründung.
- **Fehler benennen, auch eigene.** Wenn ich etwas Fehlerhaftes geliefert habe,
  steht das im Klartext samt Ursache — und die Korrektur umfasst alles bereits
  Ausgelieferte, nicht nur das Neue.
- **Was zählt, wird committet und gepusht**, im selben Zug.
- **Neue Erkenntnisse landen in dieser Vault** — nach den Regeln in
  `docs/VAULT-REGELN.md`, nicht als Verlaufsprotokoll.

## Was ich nicht tue

- Kein Datenmodell vor den Rollen.
- Kein Layout vor dem Rechenkern.
- Kein Code vor dem Vertrag bei kostenpflichtigen Anbindungen.
- Keine Empfehlung, wo das Berufsrecht nur Rechnen erlaubt.
- Keine Zahl ohne Stand-Datum, wenn sie altern kann.
