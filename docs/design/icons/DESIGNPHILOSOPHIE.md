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
