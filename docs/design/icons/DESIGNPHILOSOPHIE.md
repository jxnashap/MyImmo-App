# Gegossenes Gold — Designphilosophie für das MyImmo-App-Icon

## Der Satz

Ein Dach ist die älteste Form, die der Mensch gezeichnet hat, um „hier gehöre
ich hin" zu sagen. Eine Marke, die Eigentum verwaltet, braucht kein Bild von
einem Haus. Sie braucht **die Geste**, aus der ein Haus entsteht: zwei Linien,
die sich oben treffen.

## Form und Raum

Ein Icon ist kein kleines Plakat. Es ist ein **Siegel** — eine Form, die auch
dann noch trägt, wenn sie auf sieben Millimeter schrumpft und zwischen dreißig
anderen liegt. Deshalb regiert hier eine einzige Silhouette. Alles, was nicht
diese Silhouette stützt, wird gestrichen, nicht verkleinert. Komplexität
entsteht nicht durch mehr Elemente, sondern durch **die Präzision der wenigen** —
durch einen Winkel, der stimmt, eine Fase, die das Licht führt, eine
Aussparung, die ebenso viel sagt wie die Fläche daneben.

Der Rand bleibt leer. Das System beschneidet die Ecken selbst; wer dort etwas
platziert, verliert es. Die Ruhe um die Form ist kein ungenutzter Platz,
sondern der Sockel, auf dem sie steht.

## Farbe und Material

Gold ist keine Farbe, sondern ein Verhalten von Licht. Ein flacher gelber Ton
wirkt billig; erst der Verlauf von hellem Messing oben zu tiefem Bronzeton
unten lässt eine Fläche wie gegossenes Metall wirken. Die Steigerung bleibt
knapp — zwei, drei Nuancen, mehr nicht. Der Grund ist beinahe schwarz, aber
niemals reines Schwarz: ein Hauch Wärme darin, damit das Gold nicht wie
aufgeklebt aussieht, sondern wie eingelassen.

## Rhythmus und Maß

Jede Kante folgt einem Maß, das sich begründen lässt: die Dachneigung, die
Wandstärke, der Abstand zum Rand. Nichts steht dort, weil es „gut aussah".
Diese Strenge ist die eigentliche Arbeit — sie ist unsichtbar und trotzdem
spürbar, so wie man einem gut gesetzten Buchstaben ansieht, dass jemand ihn
tausendmal nachgezogen hat, bevor er stehen blieb.

## Was ausgelassen wird

Keine Schrift. Ein Wortzeichen, das bei 29 Pixeln zu einem grauen Fleck
zerfällt, schadet der Marke mehr, als es ihr nützt. Keine Schlagschatten,
keine Spiegelungen, keine vorgerundeten Ecken. Keine Effekte, die verbergen
sollen, dass die Form darunter nicht trägt.

## Der Anspruch

Das Ergebnis soll wirken, als hätte jemand über Wochen an vier Zeichnungen
gefeilt, der dieses Handwerk seit Jahren beherrscht: kompromisslos in der
Geometrie, zurückhaltend in der Wirkung, unverwechselbar auf den ersten Blick
und noch interessanter auf den zehnten. Ein Zeichen, das man erkennt, bevor
man es gelesen hat.

---

## Die vier Entwürfe

| | Entwurf | Idee |
|---|---|---|
| 1 | **Giebel-Monogramm** | Zwei Dachfirste bilden ein M. Haus und Initiale sind dieselbe Linie. |
| 2 | **Schlüssel im Giebel** | Massives Gold, das Schloss als Aussparung. Eigentum heißt: der Schlüssel. |
| 3 | **Drei Häuser** | Ein Portfolio, kein einzelnes Objekt. Tiefe über drei Goldstufen. |
| 4 | **Invers · Goldfeld** | Figur und Grund tauschen. Helle Kachel auf dunklem Homescreen. |

## Technischer Stand (geprüft)

Alle vier: 1024 × 1024 px, PNG, Modus RGB, **kein Alphakanal**, randabfallend
quadratisch (keine vorgerundeten Ecken — die Maske setzt iOS selbst), keine
Schrift, keine Schlagschatten außerhalb der Form, äußere 6 % frei von
tragender Grafik.

`kontaktbogen.png` zeigt alle vier mit der iOS-Superellipse in 256 / 120 / 87 /
58 / 40 px — den Größen, in denen das Icon wirklich erscheint.

Neu erzeugen: `python3 icons-bauen.py`, dann die SVG mit einem Browser auf
1024 px rastern und mit Pillow auf RGB flachlegen (Alphakanal entfernen).

## Warum das bisherige Logo so nicht einreichbar ist

`public/myimmo_logo_2048.png` ist RGBA mit 6,1 % transparenten Pixeln — den
vorgerundeten Ecken. Apple lehnt App-Icons mit Alphakanal ab. Zusätzlich
zerfällt das Wortzeichen „My Immo" unterhalb von etwa 120 px zu einem Fleck.
Als Logo für Website und Dokumente bleibt es gültig; als App-Icon nicht.

---

# Nachtrag: Neon-Serie (Entwürfe 5–8)

Auf Wunsch deutlich komplexer und leuchtend. Die Dichte entsteht **programmatisch**
— Raster, Fenster, Ringe, Fluchtlinien werden gerechnet, nicht von Hand gestreut.
Jede Leuchtröhre besteht aus vier Lagen: weiter Halo, mittlerer Schein, Körper,
heißer Kern.

| | Entwurf | Dichte |
|---|---|---|
| 5 | **Neon-Giebel im Raster** | Messgitter aus 64 Linien, Knotenpunkte, Horizontlinie |
| 6 | **Datenstadt** | Neun Baukörper, über 200 einzeln beleuchtete Fenster, Bodenreflex |
| 7 | **Isometrisches Drahtgitter** | Fluchtlinien-Boden, Horizontband, Haus als Drahtmodell |
| 8 | **Strahlenkranz** | 32 konzentrische Ringe, 72 Strahlen, Licht durch das Schloss |

## Der Zielkonflikt, offen benannt

Apple verlangt ein Icon, das bei 29 pt noch erkennbar ist. Neon und Dichte
arbeiten dagegen: Was bei 1024 px als feines Gitter fasziniert, ist bei 40 px
ein grauer Schleier. Die harten Ablehnungskriterien sind eingehalten — kein
Alphakanal, keine vorgerundeten Ecken, keine Schrift, 1024 × 1024. Die
Empfehlung „so einfach wie möglich" ist bewusst gedehnt.

Gemessene Kantenenergie nach Verkleinerung auf 40 px (höher = mehr erkennbare
Struktur): Strahlenkranz 23,9 · Datenstadt 20,2 · Neon-Raster 16,9 ·
Drahtgitter 16,6.

## Nach dem ersten Test überarbeitet

- **5**: Die Lichtschächte über den Firsten liefen in den Bereich, den iOS
  wegschneidet, und lasen sich klein als Antennen. Gestrichen.
- **7**: Die Dachfläche dominierte, die Wände waren dünne Linien — bei 40 px
  eine Raute statt eines Hauses. Dach und Wände erhöht, Wände als eigene Röhre,
  Boden zurückgenommen.
- **8**: Ringe und Strahlen waren zu schwach, die Dichte war nicht zu sehen.
  Deckkraft angehoben.

## Weiterer Vorbehalt

Für die App-Oberfläche wurde bewusst **Fintech-hell** gewählt (siehe CLAUDE.md).
Ein Neon-Icon setzt einen dunklen, technischen Ton, der dazu im Widerspruch
steht. Als Icon kann das reizvoll sein — ein Kontrast zur ruhigen App —, es
sollte aber eine bewusste Entscheidung sein, kein Versehen.

Neu erzeugen: `python3 icons-neon-bauen.py`

---

# Nachtrag: „MY" im Haus (Entwürfe 9–12), Graphitgrund

Grund ist jetzt Graphit statt Schwarz: Anthrazit in der Mitte, fast Schwarz zum
Rand. Das gibt dem Gold Tiefe, ohne dass die Kachel schwer wirkt.

## Der Kniff

Ein M besteht aus zwei Giebeln mit einem Tal dazwischen. **Dieses Tal ist
bereits das V eines Y — es fehlt nur der Stamm.** Ein einziger senkrechter
Strich vom Tal zum Boden macht aus dem M ein MY. Zwei Buchstaben, eine
Zeichnung, und beide sind gleichzeitig das Haus.

| | Entwurf | Lesart |
|---|---|---|
| 9 | **MY-Ligatur** | M ist der Giebel, der Stamm macht daraus das Y |
| 10 | **MY ausgespart** | Massiver Giebel, Buchstaben als Negativraum |
| 11 | **Y trägt das Haus** | Hauskontur mit Doppelgiebel, das Y als Stütze und Tür |
| 12 | **Neon-Ligatur** | Entwurf 9 als Leuchtröhre |

## Warum das die bessere Lösung ist als das alte Logo

Apple untersagt **Wörter** im Icon, nicht Buchstaben eines Logotypes. Das alte
`myimmo_logo_2048.png` trägt „My Immo" als Wortmarke — zwei Zeilen Serifenschrift,
die unterhalb von etwa 120 px zu einem Fleck zerfallen. „MY" als
Zwei-Zeichen-Monogramm bleibt bis 58 px lesbar und ist als Logotype zulässig.

## Nach dem Test überarbeitet

**10** las sich zuerst als Schild mit Deckel: Das Dach war zu flach, die
Buchstaben zu groß. Dach steiler, Wand höher, Schriftgrad kleiner — jetzt trägt
das Haus die Buchstaben und nicht umgekehrt.

Neu erzeugen: `python3 icons-my-bauen.py`
