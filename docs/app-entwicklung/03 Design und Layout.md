# 03 — Design und Layout

## Die Marke festlegen, bevor gestaltet wird

Bei MyImmo: **Gold `#D4A847`** als einziges Markenzeichen, **Fraunces** (Serif,
Display) + **Outfit** (Sans, UI). Eine Akzentfarbe, zwei Schriften — mehr braucht
keine App. Semantische Farben (grün/amber/rot) sind **getrennt vom Akzent** und
zählen nicht als zweite Markenfarbe.

**Gewählte Richtung:** Fintech-hell (Stripe/N26 mit etwas Apple) mit echter
Neu-Anordnung der Layouts, nicht nur Umfärben. **Verworfen:** „Quiet-Luxury"-Ivory,
Neon-Bento. Verworfene Richtungen gehören dokumentiert — sonst werden sie
wieder vorgeschlagen.

## Token statt Literale

Farben leben **einmal** als CSS-Variablen in `app/globals.css`, Komponenten
greifen nur darauf zu. MyImmo führt Hell und Dunkel vollständig parallel:

```css
:root { --gold:#D4A847; --text:#F0EDE6; --bg:#0F0F0E; /* dunkel = Vorgabe */ }
[data-theme="light"] { --gold:#B8860B; --text:#1A1814; --bg:#F4F3EF; }
```

**Regel:** Keine Farbe darf ihre einzige Definition in einem Theme-Block haben.
Sonst rendert ein Theme Text der einen Palette auf dem Grund der anderen.

**Skalen begrenzen.** MyImmo hat drei Radien plus Pille — vorher standen fünf
Namen für drei Werte, zwei davon Karteileichen. Jede unnötige Stufe wird von
jemandem benutzt und zementiert.

## Zahlen im Layout

- `font-variant-numeric: tabular-nums` überall, wo Ziffern untereinander stehen.
- Deutsche Formatierung durchgängig: `toLocaleString("de-DE")`. Punkt =
  Tausender, Komma = Dezimal.
- Breite Inhalte (Tabellen, Code, Diagramme) bekommen **einen eigenen
  `overflow-x: auto`-Container**. Der Seitenkörper scrollt nie seitwärts.

## Formulare, die niemandem den Fokus stehlen

Aus einem echten Fehler dieses Projekts (siehe [[08 Fehlerkatalog]]):

**Beim Verlassen eines Feldes darf nie die umgebende DOM neu gebaut werden.**
Wer das tut, zerstört das gerade angeklickte Zielelement, bevor der Klick
ankommt — und ein erzwungener Fokus setzt den Cursor zurück ins alte Feld.
Ebenso brechen Klicks auf Reiter oder Knöpfe ab, wenn deren Element zwischen
`mousedown` und `mouseup` ersetzt wird.

**Richtig:** genau das eine Feld aktualisieren, Zähler und Reiter nur neu
beschriften. Vollständiger Neuaufbau nur bei Reiterwechsel und Zurücksetzen.
**Der Fokus gehört dem Nutzer, nicht dem Rendering.**

Weiter: Während des Tippens bleibt ein Feld neutral — eine Rückmeldung bei jeder
Ziffer („noch zu niedrig") ist Lärm. Geprüft wird beim Verlassen. Enter springt
ins nächste Feld.

## Dokumente und PDFs (verbindlich)

Vollständig in `CLAUDE.md` geregelt. Kern:
- Heller DIN-A4-Geschäftsbrief, Briefkopf `My`(Times) + `Immo`(Times-Italic,
  Gold `rgb(0.722,0.565,0.169)`) + „PRIVATES IMMOBILIEN-MANAGEMENT".
- **Goldener Trennstrich exakt mittig** (`x = A4.w / 2`).
- **Großzügiger Zeilenabstand** (`LH ≈ 15`, Absatz `GAP ≈ 9`).
- **Deckblatt** bei jedem mehrseitigen Dokument.
- Keine Magazin-Deckblätter, keine Vollflächen.

Vorlagen: `scripts/gen-avv-pdf.mjs`, `scripts/gen-businessplan-pdf.mjs`.
**Große Dokumente nie von Hand bauen** — der Businessplan entsteht per Skript
aus einer `SECTIONS`-Struktur in Sekunden.

## App-Icons — Plattformregeln sind keine Geschmacksfrage

**Harte Ablehnungsgründe bei Apple:**
- **Alphakanal** → Ablehnung. Das bestehende `myimmo_logo_2048.png` ist RGBA
  mit 6,1 % transparenten Pixeln (den vorgerundeten Ecken) und **so nicht
  einreichbar**.
- **Vorgerundete Ecken** → iOS legt seine eigene Maske (eine Superellipse, kein
  Rundrechteck) darüber. Randabfallend quadratisch liefern.
- **1024 × 1024**, sRGB, kein Schatten außerhalb der Fläche.

**Empfehlungen (kein Ablehnungsgrund, aber teuer):**
- **Wörter im Icon vermeiden.** Eine zweizeilige Wortmarke zerfällt unter etwa
  120 px. Ein **Zwei-Zeichen-Monogramm** als Logotype bleibt bis rund 58 px
  lesbar und ist zulässig.
- Bei 40 px bleibt von jedem Entwurf nur die Silhouette. Dichte, Neon und feine
  Raster verschwinden dort — das ist Physik, nicht Umsetzung.

**Prüfstand statt Bauchgefühl:** Jeden Entwurf mit der **echten iOS-Superellipse**
in 256/120/87/58/40 px rendern und ansehen. In diesem Projekt hat dieser
Kontaktbogen zwei Entwürfe gerettet, die bei 40 px als Bergkette bzw. als Raute
lasen statt als Haus.

**Schatten sind erlaubt** — innerhalb der Fläche. Verboten ist nur der Schatten
außerhalb, weil er mit der Systemmaske kollidiert. Tiefe entsteht aus zwei
Kanten (dunkle Oberkante, helle Unterlippe), nicht aus Farbe: Eine Farbe in fünf
Werten reicht für Prägung und Fase.

## Grafik-Pipeline (SVG → PNG)

Zwei Fallen, beide in diesem Projekt aufgetreten:

1. **Chrome rendert nicht auf voller Fensterhöhe.** Bei `--window-size=1024,1024`
   kamen nur ~937 px an; zwölf ausgelieferte Icons hatten einen 87 px hohen
   schwarzen Streifen. **Mit Reserve rendern, exakt beschneiden, danach messen.**
   Trick: Seitenhintergrund auf Magenta setzen — dann fällt Durchscheinen sofort auf.
2. **Verläufe in Bounding-Box-Einheiten verschwinden auf geraden Linien.** Eine
   senkrechte Linie hat eine null Pixel breite Box, der Verlauf wird ungültig,
   das Element **gar nicht gezeichnet**. Lösung: `gradientUnits="userSpaceOnUse"`.
   Gewinn nebenbei: eine gemeinsame Lichtrichtung für die ganze Zeichnung.

Ausliefern heißt messen: Größe, Modus (RGB ohne Alpha), Ecken deckend, Rand frei.
