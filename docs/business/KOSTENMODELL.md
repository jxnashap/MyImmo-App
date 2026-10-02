# Kostenmodell MyImmo — was der Betrieb bei welcher Nutzerzahl kostet

> **Erzeugt aus `scripts/gen-kostenmodell.mjs` am 30.09.2026.** Zahlen nicht hier
> ändern, sondern im Skript — dann `node scripts/gen-kostenmodell.mjs`.
> Wechselkurs 1 USD = 0,88067 EUR (frankfurter.dev, 30.09.2026).

Dieses Dokument beantwortet eine Frage, die im Businessplan fehlt: **Was kostet
der Betrieb, wenn es läuft?** Jede Eingangsgröße steht unten einzeln und ist
angreifbar. Wer eine Annahme für falsch hält, ändert sie im Skript und sieht
sofort, was sie bewegt.

---

## 1. Die kurze Antwort

| Zahlende Nutzer | Konten gesamt | = Anteil aller dt. Vermieter | Infrastruktur/Monat | Netto-Umsatz/Monat | Deckung/Monat | Kosten je zahlendem Nutzer |
|---|---|---|---|---|---|---|
| 100 | 2.500 | 0,05 % | 52,47 € | 827,42 € | +774,95 € | 0,52 € |
| 500 | 12.500 | 0,23 % | 70,66 € | 4.137,10 € | +4.066,44 € | 0,14 € |
| 1.000 | 25.000 | 0,45 % | 83,63 € | 8.274,20 € | +8.190,57 € | 0,08 € |
| 5.000 | 125.000 | 2,27 % | 301,54 € | 41.371,02 € | +41.069,48 € | 0,06 € |
| 10.000 | 250.000 | 4,55 % | 726,01 € | 82.742,03 € | +82.016,02 € | 0,07 € |

> **Die dritte Spalte ist die Realitätsprobe.** Sie sagt, wie viele der rund
> 5,5 Mio. privaten Vermieter ein Konto angelegt haben müssten. Die Zeile mit
> 10.000 zahlenden Nutzern verlangt 4,5 % des
> Gesamtmarktes — das ist kein Planwert, sondern eine Obergrenzen-Rechnung.
> Der Businessplan-Zielwert für Jahr 3 (1.200 zahlend) entspricht
> 0,55 % und ist damit die einzige Zeile,
> die man ohne Marktführerschaft erreichen kann.

**Der Betrieb trägt sich ab rund 7 zahlenden Nutzern.**
Das ist die ehrliche Antwort auf „wie tief wird das Loch?" — und sie lautet:
**flach.** Nicht, weil das Geschäft leicht wäre, sondern weil die laufenden
Serverkosten in dieser Größenordnung schlicht klein sind. Die Spalte „Deckung"
ist **kein Gewinn** — Arbeitszeit, Recht, Steuerberatung, Support und Marketing
stehen nicht darin (Abschnitt 5).
Darunter ist die Differenz aus eigener Tasche zu tragen — bei null zahlenden
Nutzern sind das die Grundgebühren von rund **50,65 € im Monat**.

**Das Entscheidende an dieser Tabelle:** Die Kosten je zahlendem Nutzer *fallen*
mit der Größe (von 0,52 € auf 0,07 €), weil
die Grundgebühren fix sind. Das Geschäftsmodell skaliert also — der Engpass ist
nicht die Technik, sondern die Zahl der Nutzer.

---

## 2. Was an den Erlösen hängen bleibt (Paddle)

Paddle nimmt **5 % + 0,50 $ je Transaktion**. Die Fixgebühr
ist der Punkt, den man übersieht: Ein Monatsabo zahlt sie **zwölfmal im Jahr**.

| Tarif | Jahresumsatz | Transaktionen | Paddle-Gebühr | davon Anteil |
|---|---|---|---|---|
| Privat monatlich | 95,88 € | 12 | 10,08 € | 10,5 % |
| Privat jährlich | 79,00 € | 1 | 4,39 € | 5,6 % |
| Plus monatlich | 155,88 € | 12 | 13,08 € | 8,4 % |
| Plus jährlich | 129,00 € | 1 | 6,89 € | 5,3 % |

**Ein Monatsabo für 7,99 € verliert 10,5 % an Paddle, ein Jahresabo nur 5,6 %.**
Daraus folgt unmittelbar: **Jahresabos aktiv bewerben.** Sie senken nicht nur die
Abwanderung, sie sind auch strukturell billiger.

⚠️ **Offener Punkt:** Paddle schreibt auf der eigenen Preisseite, dass Produkte
**unter 10 $** eine Sonderkondition brauchen. Der Einstiegstarif liegt bei 7,99 €.
Das ist vor dem Scharfschalten zu klären — es kann die Zahlen oben verschlechtern.

Über den Tarifmix ergibt sich ein Umsatz von **107,78 € je zahlendem Nutzer und Jahr**
(Businessplan rechnet mit ~96 €), nach Paddle **99,29 €**.

---

## 3. Woraus die Infrastrukturkosten bestehen

| Zahlende | Supabase | Vercel | KI (OCR/Import) | Brevo | Summe $ | Summe € |
|---|---|---|---|---|---|---|
| 100 | 25,00 $ | 20,17 $ | 1,90 $ | 0,00 $ | 55,32 $ | 52,47 € |
| 500 | 28,38 $ | 20,85 $ | 9,50 $ | 9,00 $ | 75,98 $ | 70,66 € |
| 1.000 | 32,76 $ | 21,69 $ | 19,00 $ | 9,00 $ | 90,70 $ | 83,63 € |
| 5.000 | 86,97 $ | 129,92 $ | 95,00 $ | 18,00 $ | 338,14 $ | 301,54 € |
| 10.000 | 172,44 $ | 413,44 $ | 190,00 $ | 36,00 $ | 820,13 $ | 726,01 € |

### Was dahinter steckt

| Zahlende | Datenbank | Vercel-Transfer | Supabase-Egress | Funktionsaufrufe |
|---|---|---|---|---|
| 100 | 7,0 GB | 24,6 GB | 9,3 GB | 0,28 Mio. |
| 500 | 35,0 GB | 123,2 GB | 46,3 GB | 1,41 Mio. |
| 1.000 | 70,1 GB | 246,4 GB | 92,6 GB | 2,82 Mio. |
| 5.000 | 350,4 GB | 1.232,1 GB | 463,0 GB | 14,10 Mio. |
| 10.000 | 700,8 GB | 2.464,3 GB | 926,0 GB | 28,20 Mio. |

**Zwei Dinge, die man kennen muss:**

1. **Dateien liegen als Base64 in Postgres-Spalten, nicht in einem Objektspeicher.**
   Jeder Dokumentabruf zahlt deshalb **zweimal** Übertragung: einmal Supabase-Egress
   (Datenbank → Serverfunktion), einmal Vercel-Transfer (Funktion → Browser). Base64
   bläht die Datei zusätzlich um 33 % auf. Das ist heute folgenlos — **gemessen am
   30.09.2026 liegen ganze 15 Dateien mit zusammen 183 KB im System** —, wird aber zum
   größten Einzelposten, sobald Vermieter ihr Belegarchiv wirklich füllen.
   Gegenmittel (nicht gebaut): Umzug auf Supabase Storage, dort kostet das GB
   0,09 $ statt Datenbank-Disk zu 0,13 $ — und der doppelte
   Transfer entfällt.
2. **Gratis-Nutzer kosten Geld.** Bei 4 % Konversion stehen hinter
   1.000 zahlenden Nutzern 25.000 Konten. Sie erzeugen Speicher,
   Seitenaufrufe und Funktionsaufrufe, ohne etwas einzubringen. Im Businessplan
   taucht diese Zahl nirgends auf.

---

## 4. Alle Annahmen auf einen Blick

| Größe | Wert | Herkunft |
|---|---|---|
| Konversion Gratis → zahlend | 4 % | Businessplan-Annahme (3–5 %), **unbelegt** |
| Monatlich aktive Gratis-Konten | 35 % | Schätzung. **Gemessen sind es heute 18 %** (4 von 22) |
| DB je aktivem Portfolio | 0,40 MB | **gemessen** (4,03 MB Nutzdaten / 11 Portfolios) |
| Dokumente je zahlendem Konto/Jahr | 20 MB | Schätzung — **nie gemessen**, heute 183 KB im ganzen System |
| Seitenaufrufe je aktivem Konto/Monat | 120 | Schätzung — **keine Analytics installiert** |
| Übertragung je Seitenaufruf | 220 KB | Schätzung |
| KI-Aufrufe je zahlendem Konto/Jahr | 6 | Schätzung (NK-OCR + Import) |
| Token je KI-Aufruf | 9.000 ein / 2.000 aus | Aus dem Code (`max_tokens: 2500`), Eingabe geschätzt |

### Was daran ehrlicherweise unsicher ist

- **Die Seitenaufrufe sind geraten.** Speed Insights wurde am 08.09.2026 entfernt,
  weil die Datenschutzerklärung „keine Analyse-Tools" zusagt. Es gibt derzeit
  **keine Messung des Verkehrs**. Das ist die größte Lücke im Modell.
- **Die Dokumentmenge ist geraten.** Sie ist zugleich der Posten mit dem
  größten Hebel — verzehnfacht sie sich, verschiebt sich die Datenbankzeile
  deutlich.
- **Die Konversion ist geraten.** Sie stammt aus dem Businessplan und ist durch
  nichts belegt, weil noch nie jemand etwas bezahlt hat.

**Robust ist das Modell trotzdem in einer Hinsicht:** Selbst wenn sich die
variablen Posten verdoppeln, bleibt der Betrieb bei 1.000 zahlenden Nutzern
klar profitabel — weil die Grundgebühren mit rund 39,63 € den Löwenanteil
ausmachen und nicht mitwachsen.

---

## 5. Was NICHT in diesen Zahlen steckt

| Posten | Warum nicht | Größenordnung |
|---|---|---|
| Eigene Arbeitszeit | Bootstrapped, nicht eingepreist | bei 1.500 €/M kalkulatorisch = größter Posten überhaupt |
| Anwaltliche Prüfung | Einmalig, vor dem Bezahlstart fällig | 2.000–5.000 € |
| Steuerberatung | Ab Bezahlbetrieb nötig | 600–1.800 €/Jahr |
| Apple Developer Program | Erst beim iOS-Start | 99 $/Jahr |
| Apple In-App-Kauf-Provision | Erst beim iOS-Start | 15–30 % auf iOS-Abos — **deutlich teurer als Paddle** |
| Marketing | Der eigentliche Engpass | offen |
| Support | Skaliert mit Nutzern, heute null | offen |

**Der wichtigste Satz dieses Dokuments:** Die Infrastruktur ist nicht das Problem.
Bei 1.000 zahlenden Nutzern kostet sie 83,63 € im Monat gegen
8.274,20 € Netto-Umsatz. Das Geschäft entscheidet sich **nicht an den
Serverkosten, sondern daran, ob die Nutzer kommen und bleiben.**
