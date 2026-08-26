# Immobilien-Workshop — Unterrichtsmaterial

Fallstudie für den Unterricht: drei Objekte, zwei Entscheidungen.

| Datei | Für wen | Inhalt |
|---|---|---|
| `immobilien-workshop-online.html` | **Klasse, im Browser** | Interaktive Fassung: Reiter je Objekt, Eingabefelder mit sofortiger Prüfung und gezielten Fehlerhinweisen, Vergleichstabelle aus den eigenen Werten, Entscheidungspanel mit Auswertung |
| `immobilien-workshop.html` | **Klasse, auf Papier** | Aufgabenblatt: Auftrag, Rahmendaten, drei Exposés, Formelblatt, leere Auswertungstabelle, Antwortfelder |
| `immobilien-workshop-loesung.html` | **nur Lehrkraft** | Ergebnistabelle, Rechenweg, beide Antworten mit Begründung, typische Fehler, Bewertungsraster (30 P.), Vertiefungsaufgaben |

## Webadresse für die Klasse

    https://claude.ai/code/artifact/70a9c592-9fde-4132-ae06-c0e6cfef587f

⚠️ **Die Seite ist erst privat.** Damit die Klasse sie öffnen kann, muss sie einmal über das
Teilen-Menü auf der Seite freigegeben werden. Ohne diesen Schritt bekommen die Schüler
keinen Zugriff.

Die Eingaben jedes Schülers liegen nur in dessen eigenem Browser (`localStorage`) — sie
überstehen ein Neuladen, sind aber weder für andere Schüler noch für die Lehrkraft sichtbar.
Wer die Ergebnisse einsammeln will, braucht einen anderen Weg (Screenshot, mündlich).

⚠️ **Die Lösung steht im Quelltext.** Die Seite rechnet die Zielwerte aus den angezeigten
Objektdaten — wer die Entwicklerkonsole öffnet, kommt an die Ergebnisse. Für eine benotete
Klassenarbeit ist die Seite deshalb nicht geeignet, für Übung und Unterricht schon.

Beide Dateien sind **self-contained** (CSS inline, keine externen Requests, keine
Web-Fonts) — per Doppelklick offline lauffähig, per `Strg+P` sauber auf A4 druckbar.
Die Lösung liegt bewusst in einer **getrennten Datei**, nicht als aufklappbarer
Abschnitt im Aufgabenblatt.

## Die Aufgabe

1. **Welches Objekt hat die beste Mietrendite?** → Objekt **A** (Altbau-ETW Lübeck)
2. **Welches Objekt eignet sich am besten zur Eigennutzung?** → Objekt **C** (Reihenhaus Stockelsdorf)

Der didaktische Kern: A gewinnt Frage 1 in *jeder* Renditekennzahl und verliert Frage 2
deutlich (vermietet, Energieklasse F, leere Rücklage, beschlossene Sonderumlage).
Rendite und Wohnqualität sind zwei verschiedene Maßstäbe.

## Rechengrundlage

Die Formeln entsprechen **1:1 dem Objekt-Rechner der App**
(`components/kauf/ObjektRechner.tsx`), damit die Klasse in MyImmo nachrechnen kann:

- Nebenkostensatz = Grunderwerbsteuer + Maklerprovision + 2 % (Notar/Grundbuch)
- Bruttorendite = Jahreskaltmiete ÷ **Kaufpreis**
- Nettorendite = (Jahreskaltmiete − 20 % Bewirtschaftung) ÷ **Gesamtinvestition**
- Kaufpreisfaktor = Kaufpreis ÷ Jahreskaltmiete

Ergänzt um einen Finanzierungsblock (Eigenkapital, Annuität, Cashflow,
Eigenkapitalrendite), den die App selbst nicht ausweist.

Einheitliche Annahmen für alle drei Objekte: Schleswig-Holstein (GrESt 6,5 %),
Makler 3,57 %, Notar/Grundbuch 2 %, Bewirtschaftung 20 %, Eigenkapital = alle
Nebenkosten + 15 % des Kaufpreises, Sollzins 3,8 %, Anfangstilgung 2,0 %.

## Herkunft der Zahlen

**Mischform:** echte Marktdaten als Rahmen, Objektzahlen so gesetzt, dass die Aufgabe
eindeutig lösbar ist. Recherchiert im August 2026:

- Lübeck ETW ⌀ ca. 3.559 €/m² (Spanne ca. 2.407–4.712 €/m²), Häuser ⌀ ca. 3.163 €/m²
- Lübeck Kaltmiete ⌀ ca. 11,04 €/m² (einfache Lagen ca. 9,87 €/m²)

Alle drei Objekte liegen innerhalb dieser Spannen. Die Objekte selbst sind **konstruiert** —
keine realen Inserate, keine realen Adressen.

## Anpassen

Die Zahlen stehen direkt im HTML. Wer sie ändert, muss die Lösung neu durchrechnen —
das Skript dafür liegt nicht im Repo, die Formeln oben genügen aber. Beim Ändern
unbedingt prüfen, dass die Rangfolge **eindeutig** bleibt (sonst gibt es keine
korrigierbare Musterlösung).

Stand: August 2026.
