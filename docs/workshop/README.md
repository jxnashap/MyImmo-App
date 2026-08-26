# Immobilien-Workshop — Unterrichtsmaterial

Fallstudie für den Unterricht: drei Objekte, zwei Entscheidungen.

| Datei | Für wen | Inhalt |
|---|---|---|
| `immobilien-workshop.html` | **Klasse** | Aufgabenblatt: Auftrag, Rahmendaten, drei Exposés, Formelblatt, leere Auswertungstabelle, Antwortfelder |
| `immobilien-workshop-loesung.html` | **nur Lehrkraft** | Ergebnistabelle, Rechenweg, beide Antworten mit Begründung, typische Fehler, Bewertungsraster (30 P.), Vertiefungsaufgaben |

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
Nebenkosten + 10 % des Kaufpreises, Sollzins 3,8 %, Anfangstilgung 2,0 %.

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
