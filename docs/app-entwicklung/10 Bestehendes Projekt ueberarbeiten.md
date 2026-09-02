# 10 — Bestehendes Projekt überarbeiten

> Anderer Ablauf als [[09 Neue App bauen]]. Beim Neubau bestimmt man die
> Reihenfolge. Bei einer Überarbeitung bestimmt der **Ist-Zustand** sie —
> und der ist selten so, wie er beschrieben wird.

## Regel null: erst messen, nichts anfassen

Kein Umbau, bevor der Ist-Stand belegt ist. Die häufigste Fehlerquelle ist nicht
schlechter Code, sondern eine **falsche Annahme darüber, was schon da ist**. In
MyImmo standen Funktionen monatelang als „fehlt noch", obwohl sie fertig waren —
und die RLS-Policies lagen nur in der Datenbank, nicht im Repo.

## Die Bestandsaufnahme

Erst diese neun Punkte belegen, mit Zahlen:

| # | Was | Wie belegt |
|---|---|---|
| 1 | **Umfang** | Dateien, Zeilen, Seiten, API-Routen zählen |
| 2 | **Testabdeckung** | Testdateien und -fälle zählen; welche Bereiche haben **keine** |
| 3 | **Zugriffskontrolle** | Hat **jede** Tabelle RLS? Mit zweitem Konto prüfen, nicht lesen |
| 4 | **Schema im Repo?** | Liegen alle Tabellen und Policies als Migration vor — oder nur in der Datenbank? |
| 5 | **Geheimnisse** | Steht etwas Sensibles mit `NEXT_PUBLIC_`-Präfix im Bundle? Ausgeliefertes JavaScript durchsuchen |
| 6 | **Rechenkern rein?** | Enthält die Fachlogik DOM, Netzwerk oder Datenbank — dann ist sie nicht testbar |
| 7 | **Zahlenformate** | Deutsche Eingaben korrekt geparst? Maschinenwerte am Nutzer-Parser vorbei? |
| 8 | **Themes** | Hat jede Farbe eine Definition außerhalb eines Theme-Blocks? |
| 9 | **Was ist gebaut, aber inaktiv** | Code, der ohne Env ein No-op ist — und ob das dokumentiert ist |

**Ergebnis:** eine Liste mit Befund, Beleg und Schweregrad. Erst danach planen.

## Priorisierung

Nicht nach Aufwand sortieren, sondern nach Schaden:

1. **Sicherheit** — fehlende RLS, Geheimnisse im Client, ungeschützte Routen.
   Alles andere wartet.
2. **Datenverlust** — fehlendes Löschkonzept, unverschlüsselte sensible Spalten,
   Schema nur in der Datenbank.
3. **Falsche Zahlen** — ungetesteter Rechenkern. Ein falscher Wert wird geglaubt.
4. **Bedienbarkeit** — Fokusfallen, Sackgassen, Fehlermeldungen ohne Ausweg.
5. **Optik** — zuletzt. Ein schönes Layout über einer kaputten Rechnung ist eine
   Verschlimmerung.

**Risiko zuerst benennen:** Wenn der Nutzer mit der Optik anfangen will, sagen,
was dadurch liegen bleibt — dann seine Entscheidung umsetzen.

## Umbau in Etappen, nie im Ganzen

- **Jede Etappe endet grün**: Build läuft, Tests laufen, App startet.
- **Kein Rewrite ohne Not.** Ein Neuschrieb wirft geprüftes Verhalten weg, das
  niemand mehr rekonstruieren kann. Umbauen schlägt ersetzen.
- **Rechenkern zuerst isolieren, dann testen, dann ändern.** Reihenfolge zählt:
  Wer ändert, bevor Tests da sind, hat keine Vergleichsbasis.
- **Charakterisierungstest vor der Änderung**: das aktuelle Verhalten
  festschreiben, auch wenn es fragwürdig ist. Erst danach korrigieren — dann
  zeigt der Test genau, was sich geändert hat.
- **Ein Thema je Commit.** Sicherheit und Umbenennung nicht mischen.

## Was ohne Not nicht angefasst wird

- Laufende Migrationen und produktive Daten
- Funktionierende Fachlogik ohne Testabdeckung — **erst Tests, dann anfassen**
- Fremde Branding-Dokumente
- Alles, was der Nutzer nicht beauftragt hat

## Abschluss

- **Befunde, die nicht behoben wurden, werden benannt** — mit Grund, nicht
  verschwiegen.
- **Neue Erkenntnisse in die Vault**, nach `docs/VAULT-REGELN.md`.
- **Alternde Werte** in [[07 Volatile Kennzahlen und Pruefzyklus]] eintragen.
