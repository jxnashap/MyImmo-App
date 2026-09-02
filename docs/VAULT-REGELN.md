# Vault-Regeln — was hier hineingehört und was nicht

> **Verbindlich für jeden Chat und jede Session.** Vor dem Schreiben in `docs/`
> diese Regeln lesen und befolgen. Sie stehen auch in `CLAUDE.md`, damit sie
> unabhängig vom Einstiegspunkt greifen.

## Der Zweck

Diese Vault ist ein **Arbeitsgedächtnis, kein Tagebuch**. Sie soll später
ermöglichen, aus einer Ideenskizze eine fertige App zu bauen, ohne dass
Entscheidungen, Verträge und Fallstricke noch einmal erarbeitet werden müssen.

Eine Vault, die alles sammelt, wird nicht gelesen. Eine, die nur das Belastbare
enthält, ersetzt Nachdenken. Der Unterschied ist die Aufnahmeschwelle.

## Was hineingehört

Ein Eintrag muss **mindestens eines** davon leisten:

1. **Eine Entscheidung festhalten, die sonst neu getroffen werden müsste.**
   Inklusive der verworfenen Alternativen und des Grundes.
   *Beispiel: „Enable Banking statt GoCardless, weil GoCardless Neuanmeldungen
   eingestellt hat (geprüft 12.07.2026)."*
2. **Einen Fehler beschreiben, der Geld, Zeit oder Vertrauen gekostet hat** —
   mit Ursache, nicht nur Symptom, und mit der Prüfung, die ihn künftig fängt.
3. **Eine Zahl, Frist oder Vertragslage dokumentieren**, die von außen kommt und
   sich ändern kann — immer mit **Stand-Datum und Quelle**.
4. **Eine Konvention verbindlich machen**, an die sich jeder künftige Chat halten
   soll (Code, Design, Dokumente, Recht).
5. **Einen Ist-Stand belegen**, der sonst falsch eingeschätzt wird
   („ist gebaut, aber inaktiv" ist eine der teuersten Verwechslungen).

## Was NICHT hineingehört

- **Verlaufsprotokolle.** Was in einer Session Schritt für Schritt passiert ist,
  steht im Git-Log. Die Vault trägt das Ergebnis.
- **Allgemeinwissen.** „React-Komponenten sollten klein sein" hilft niemandem.
  Nur was für DIESES Vorhaben spezifisch entschieden wurde.
- **Doppelungen.** Steht es schon woanders in der Vault, wird dort ergänzt und
  von hier verlinkt — nicht neu geschrieben. Zwei Fassungen derselben Regel
  laufen garantiert auseinander.
- **Vermutungen im Indikativ.** Ungeprüftes wird als ungeprüft gekennzeichnet
  („nicht verifiziert", „Annahme") oder bleibt draußen.
- **Zwischenstände.** Ein Punkt, der morgen anders ist, gehört in einen Task,
  nicht in die Vault.
- **Rohdaten und Anhänge.** Große Ausgaben, Screenshots, Exporte: in `scripts/`
  oder als Datei, in der Vault nur der Verweis.

## Wie ein Eintrag aussieht

- **Datum bei allem, was altern kann.** „Geprüft am TT.MM.JJJJ" ist Pflicht bei
  Zahlen, Preisen, Fristen, Vertragslagen und Anbieteraussagen.
- **Quelle nennen**, wenn die Aussage von außen kommt (Gesetz, Anbieterseite,
  Dashboard, eigene Messung).
- **Gemessen schlägt geschätzt.** Wo eine Zahl geprüft wurde, steht wie.
- **Risiko zuerst.** Bei jeder Entscheidung erst die Schwachstelle, dann die
  Begründung. Das ist die Arbeitsweise des Projekts, nicht nur ein Stilwunsch.
- **Erledigtes wird als erledigt markiert und der Eintrag entfernt oder
  durchgestrichen** — nicht stehen gelassen. Punkte, die monatelang fälschlich
  als offen geführt wurden, haben in diesem Projekt schon zu Fehlplanungen
  geführt (siehe Onboarding-Tour, Open Banking).

## Aufnahmeprüfung — vier Fragen vor dem Schreiben

1. Muss ein späterer Chat das wissen, um **nicht dieselbe Arbeit noch einmal**
   zu machen oder denselben Fehler zu wiederholen?
2. Steht es **noch nicht** in der Vault? (Erst suchen, dann schreiben.)
3. Ist es **belegt** — Messung, Dokument, Gesetzestext, Anbieterseite?
4. Wird es in sechs Monaten **noch stimmen** — und wenn nicht, steht ein
   Stand-Datum dran und ein Eintrag in `07 Volatile Kennzahlen und Prüfzyklus`?

Viermal ja → aufnehmen. Sonst → weglassen.

## Ort

| Inhalt | Datei |
|---|---|
| Verbindliche Projektregeln, Env, offene Punkte | `CLAUDE.md` (Repo-Wurzel) |
| Wiederverwendbares App-Bau-Wissen | `docs/app-entwicklung/` |
| Fachliche Doku zu MyImmo | `docs/` (Masterplan, Finanzkonzept, Projekt-Status …) |
| Compliance-Belege | `docs/compliance/` |
| Alles, was altern kann | zusätzlich in `docs/app-entwicklung/07 Volatile Kennzahlen und Prüfzyklus.md` |

## Pflege

Beim Anfassen einer Datei gilt: **veraltete Aussagen darin gleich korrigieren.**
Wer eine falsche Angabe stehen lässt, weil sie „nicht zum Auftrag gehört",
verlängert ihre Lebensdauer.
