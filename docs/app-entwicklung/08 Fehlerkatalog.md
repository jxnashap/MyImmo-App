# 08 — Fehlerkatalog

Echte Fehler aus diesem Projekt. Jeder mit **Symptom, Ursache, Gegenprüfung**.
Die Ursache ist der Teil, der zählt — Symptome wiederholen sich nie gleich.

## Rechnen

**Grunderwerbsteuer um Faktor 1000 verrechnet**
Ein Maschinenwert (`"0.035"` aus einer Auswahl) lief durch den deutschen
Zahlenparser. Der hielt den Punkt für ein Tausendertrennzeichen → 35 → 3500 %.
→ *Gegenprüfung:* Maschinenwerte nie durch den Nutzer-Parser. Test mit
Auswahlwerten aller Bundesländer.

**Kennzahl auf den falschen Nenner bezogen**
Nettorendite auf den Kaufpreis statt auf die Gesamtinvestition — die
Nebenkosten verschwinden lautlos, das Ergebnis sieht plausibel aus.
→ *Gegenprüfung:* Bezugsgröße im Test explizit prüfen, nicht nur den Wert.

**Gerundete Teilbeträge ergeben eine falsche Summe**
368 € Zins + 194 € Tilgung = 562 €, die Rate ist aber 561 €.
→ *Gegenprüfung:* Nach dem Runden die Summe gegen den ungerundeten Wert testen.

**Eine Aussage kippt durch eine Parameteränderung**
Nach Erhöhung des Eigenkapitalanteils von 10 auf 15 % stimmte der Satz
„einzige positive Eigenkapitalrendite" nicht mehr — ein Objekt rutschte ins Plus.
→ *Gegenprüfung:* Nach jeder Parameteränderung die **Rangfolge** neu prüfen und
alle Texte durchsuchen, die eine Rangaussage treffen.

## Oberfläche

**Fokus springt beim Feldwechsel zurück**
Der `blur`-Handler baute die ganze Karte neu auf. Damit wurde das gerade
angeklickte Zielfeld zerstört, bevor der Klick ankam — und ein erzwungener Fokus
setzte den Cursor ins alte Feld. Nach dem ersten Feld war keine Eingabe mehr
möglich.
→ *Gegenprüfung:* Klickfolge im Browser nachstellen (`mousedown` → `focus` →
`mouseup` → `click`) und `document.activeElement` prüfen.

**Klick auf einen Reiter kommt nie an**
Dieselbe Ursache: Wird das Element zwischen `mousedown` und `mouseup` neu
erzeugt, löst der Browser gar kein Klick-Ereignis aus.
→ *Gegenprüfung:* Nie DOM neu bauen, die der Nutzer gerade anklickt. Einmal
bauen, danach nur beschriften.

## Grafik

**Zwölf ausgelieferte Icons hatten einen 87 px schwarzen Streifen**
Chrome rendert bei `--window-size=1024,1024` nur rund 937 px Viewporthöhe. Der
Fehler war im Bild sichtbar, wurde aber nicht gemessen.
→ *Gegenprüfung:* Mit Reserve rendern, exakt beschneiden, danach **messen**:
Größe, Modus, Ecken deckend, unterste Zeilen nicht schwarz. Seitenhintergrund
auf Magenta setzen, dann fällt Durchscheinen sofort auf.

**Alle dünnen Linien unsichtbar**
Der Farbverlauf war in Bounding-Box-Einheiten definiert. Eine senkrechte Linie
hat eine null Pixel breite Box → Verlauf ungültig → Element wird **gar nicht**
gezeichnet.
→ *Gegenprüfung:* `gradientUnits="userSpaceOnUse"`. Nach dem Rendern Pixel an
der erwarteten Stelle abtasten.

**Pfad falsch, weil ein Punkt fehlte**
`… L646,306 L780,764` verband First und Sockel direkt statt über die Traufe —
der rechte Schenkel wurde eine Diagonale.
→ *Gegenprüfung:* Geometrie ansehen, nicht nur den Code lesen.

**Eine Ersetzung traf viermal dieselbe Stelle**
Weil der eingefügte Block den Suchtext selbst enthielt, landete die Grundlinie
viermal in einem Entwurf und in dreien gar nicht.
→ *Gegenprüfung:* Bei wiederholten Ersetzungen pro Abschnitt arbeiten, danach
Vorkommen zählen.

## Eigene Prüfungen

**Eine Prüfung meldete „sauber", obwohl sie nichts geprüft hatte**
Das Suchmuster fand keine Skript-Dateien → null durchsucht → null Treffer → grün.
→ *Gegenprüfung:* Jede Prüfung meldet mit, **wie viel** sie geprüft hat. Null
untersuchte Einheiten sind ein Fehler, kein Erfolg.

**Ein Test, der auch die kaputte Fassung besteht**
→ *Gegenprüfung:* Nach jeder Behebung den Test gegen den alten Stand laufen
lassen und **prüfen, dass er dort durchfällt**.

**Fehlalarm durch eine zu grobe Schwelle**
Ein dunkler Bildentwurf wurde als „abgeschnitten" gemeldet, weil die
Helligkeitsschwelle nicht zwischen Gestaltung und Beschnitt unterschied.
→ *Gegenprüfung:* Bei einem Alarm erst prüfen, ob die **Prüfung** falsch liegt.

## Projektführung

**Punkte standen monatelang fälschlich als offen**
Onboarding-Tour und Open Banking Etappen 1–4 waren längst gebaut. Das hat zu
Fehleinschätzungen bei der Planung geführt. (Open Banking wurde am 29.08.2026
bewusst wieder entfernt — das entwertet den Fehler nicht, er lag davor.)
→ *Gegenprüfung:* Vor jeder Aussage „das fehlt noch" in
`docs/PROJEKT-STATUS.md` nachsehen. Erledigtes sofort umtragen.

**Der Wissensspeicher selbst wurde aus einem veralteten Baum geschrieben**
Die Notizen 00–10 entstanden am 01.09.2026 auf einem Arbeitsbranch, der
**56 Commits hinter `main`** lag. Ergebnis: Der Stack stand an vier Stellen als
Next.js 14 (main lief seit #293 auf 15.5.25), Open Banking galt als gebaut
(am 29.08.2026 entfernt), und von den drei als „überfällig" markierten Prüfungen
waren **zwei längst erledigt** (KfW-308 am 28.08., Supabase-Passwortlänge am
30.08.2026). Eine Notiz, die Erledigtes als offen meldet, richtet denselben
Schaden an wie eine, die Offenes als erledigt meldet — sie kostet die nächste
Session Arbeit an einem gelösten Problem.
→ *Gegenprüfung:* **Vor** dem Schreiben einer Vault-Notiz `git fetch` und gegen
den aktuellen Stand von `main` schreiben, nicht gegen den Arbeitsbaum. Jede
Behauptung über Code beim Schreiben am Pfad verifizieren (`ls`, `grep`), jede
Behauptung über einen Stand gegen `CLAUDE.md` und `docs/PROJEKT-STATUS.md` auf
`main`. Und: **die Vault gehört auf `main`**, nicht auf einen Themenbranch —
sonst findet die nächste Session sie nicht und schreibt sie ein zweites Mal.

**Schema existierte nur in der Datenbank**
Fundament-Tabellen und alle 78 RLS-Policies lagen nicht im Repo — die
Zugriffskontrolle war weder reviewbar noch reproduzierbar.
→ *Gegenprüfung:* Migrationsregel (zwei Schritte, immer beide). Baseline-Snapshot
gegen ein leeres PostgreSQL verifizieren.

**Ein Dashboard-Schalter wurde für wirksam gehalten**
→ *Gegenprüfung:* Sicherheitseinstellungen durch einen echten Versuch prüfen.

**Arbeit ging verloren, weil sie nicht gepusht war**
Sessions laufen in einem Container, der frisch geklont wird. Nicht Committetes
ist beim Sessionende weg.
→ *Gegenprüfung:* Was zählt, wird committet und gepusht — im selben Zug.
