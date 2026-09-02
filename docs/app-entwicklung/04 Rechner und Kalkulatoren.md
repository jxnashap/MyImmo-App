# 04 — Rechner und Kalkulatoren

Der heikelste Teil jeder App dieser Art. Ein falsches Layout sieht jeder, eine
falsche Zahl niemand — sie wird geglaubt und weiterverwendet.

## Grundregeln

1. **Reine Funktion in `lib/`, keine UI, keine Datenbank.** Eingaben rein,
   Ergebnis raus. Nur so testbar.
2. **Eine Quelle je Größe.** Es darf keine zweite, fest eingetippte Liste von
   Ergebnissen geben, die auseinanderlaufen kann. Wo eine Lösung dokumentiert
   wird, muss sie **gegen die Rechenlogik abgeglichen** werden, nicht daneben
   gepflegt.
3. **Jede Kennzahl bekommt einen Test** mit der Rechnung als Kommentar.
4. **Zwischenschritte sichtbar machen.** Wer nur das Endergebnis zeigt, kann
   Fehler nicht lokalisieren — weder im Test noch im Support.

## Zahlen richtig lesen (deutsche Eingaben)

Der teuerste Einzelfehler dieses Projekts: Die Grunderwerbsteuer wurde um
**Faktor 1000** verrechnet, weil ein Maschinenwert (`"0.035"`) durch den
deutschen Zahlenparser lief — der hielt den Punkt für ein Tausendertrennzeichen
und machte daraus 35, also 3500 %.

**Regeln:**
- **Maschinenwerte nie durch den Nutzer-Parser.** `Number(x)` für
  Auswahl-Werte, `zahlDe()` nur für Freitextfelder.
- Ein Parser für deutsche Eingaben muss beides können:
  ```
  "1.897"   → 1897     (Punkt = Tausender, weil genau 3 Ziffern folgen)
  "3,72"    → 3.72     (Komma = Dezimal)
  "3.72"    → 3.72     (Punkt = Dezimal, weil nicht 3 Ziffern folgen)
  "144.570" → 144570
  "− 113"   → -113     (typografisches Minus mitfangen)
  ```
- **Gegen echte Fälle testen**, nicht gegen Wunschformate.

## Bezugsgrößen benennen — der Nenner ist die halbe Kennzahl

Zwei Renditen können unterschiedliche Nenner haben und trotzdem beide richtig
sein. Bei MyImmo:

| Kennzahl | Zähler | Nenner |
|---|---|---|
| Bruttomietrendite | Jahreskaltmiete | **Kaufpreis** |
| Nettomietrendite | Jahreskaltmiete − 20 % Bewirtschaftung | **Gesamtinvestition** |

Der Sprung von brutto auf netto ändert **zwei Dinge gleichzeitig** — Abzug und
Nenner. Wer intuitiv „netto = brutto × 0,8" rechnet, landet daneben und hält die
richtige Zahl für falsch. **Das ist kein Rechenfehler, sondern ein
Erklärungsfehler:** Solche Doppelsprünge müssen in der Oberfläche zerlegt werden.

## Was in eine Kennzahl gehört und was nicht

- **Eigenkapitalrendite: nur Zinsen abziehen, nicht die Tilgung.** Tilgung ist
  kein Aufwand, sondern Vermögensaufbau. Das ist der häufigste Denkfehler bei
  Nutzern und in Fremdcode.
- **Negativer Cashflow ist kein K.-o.-Kriterium** — ein Teil der Rate zahlt man
  an sich selbst.
- **Pauschalen als Pauschalen kennzeichnen.** „20 % Bewirtschaftung" ist eine
  Annahme, kein Fakt. Wenn die echten nicht umlagefähigen Kosten die Pauschale
  fast aufbrauchen, gehört das gesagt.

## Annahmen sichtbar und einheitlich

Alle Sätze an **einer** Stelle (`lib/kalk.ts`): Grunderwerbsteuer je Bundesland,
Notar/Grundbuch, Makler, Bewirtschaftung. In der Oberfläche als Leiste anzeigen —
wer die Annahme nicht sieht, kann das Ergebnis nicht einordnen.

**Bundesland-Sätze sind volatil** → [[07 Volatile Kennzahlen und Pruefzyklus]].

## Berufsrechtsgrenze im Rechner

Ein Rechner darf rechnen und informieren, aber **nicht empfehlen**:
- **§ 34i GewO** (Immobiliardarlehensvermittlung): keine Empfehlung eines
  konkreten Bankprodukts. In MyImmo ist die Wortwahl neutralisiert, „Empfehlung"
  wurde entfernt, der Kommentar im Modul hält es fest.
- **StBerG § 1–5**: Steuerberechnungen (Anlage V, § 82b, DATEV-Export) sind
  grenznah und gehören anwaltlich freigegeben.
- **Wertermittlung ≠ Belastbarkeit der Eingaben.** MyImmo trennt beides
  ausdrücklich: Der „Belastbarkeits-Ring" misst nur die Vollständigkeit der
  Eingaben, nicht die Qualität des Objekts.

## Rundung

- Beträge auf volle Euro, Prozente auf zwei Nachkommastellen, Faktoren auf eine.
- **Erst am Ende runden**, nie zwischendurch weiterrechnen mit gerundeten Werten.
- Bei Aufteilungen prüfen, dass die Summe stimmt: 368 + 193 = 561, nicht
  368 + 194 = 562. Kaufmännisch gerundete Einzelwerte ergeben sonst eine falsche
  Summe.
- Für Nachweise **Dezimalarithmetik** statt Fließkomma verwenden.

## Prüfen, ob das Ergebnis überhaupt eindeutig ist

Wenn ein Rechner eine Rangfolge liefert (bestes Objekt, günstigste Variante),
muss die Rangfolge **eindeutig** sein — sonst gibt es keine überprüfbare
Antwort. Nach jeder Parameteränderung neu prüfen: In diesem Projekt kippte eine
Aussage („einzige positive Eigenkapitalrendite") allein dadurch, dass der
Eigenkapitalanteil von 10 auf 15 % geändert wurde.
