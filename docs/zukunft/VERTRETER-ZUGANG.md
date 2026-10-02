# Vertreter-Zugang („Bevollmächtigter“)

Stand 02.10.2026. Idee von Jonas (Memory-Repo, „Bevollmächtigter für Geschäfte in
Deutschland“). Geklärt am selben Tag: gemeint ist eine **Funktion für Vermieter** — ein
Vermieter (z. B. im Ausland) gibt einer Vertrauensperson Zugriff auf seine Objekte in MyImmo.

## ✅ Stand 02.10.2026: Vertreter als STAMMDATEN gebaut — nicht als Zugang

Präzisiert vom Betreiber am selben Tag: Der Fall ist der Vermieter im Ausland, der einen
Kreditantrag stellt; die Bank verlangt Originale, und bei der Unterschrift des Darlehens handelt
ein Vertreter in Deutschland. Gebraucht wird also zuerst ein **Reiter „Vertreter“ in den
Einstellungen** mit Name, Anschrift, Kontakt, Geburtsdaten und der Vollmacht (Art, Form,
Beglaubigung/Apostille, Gültigkeit, Widerruf, wo das Original liegt, Scan) — gebaut:
`lib/vertreter.ts` (Status + Hinweise, rein), `lib/actions/vertreter.ts`,
`components/VertreterPanel.tsx`, Datei-Route `/einstellungen/vertreter/[id]` (`dateiKopf()`),
Migration `20261002210000`, `tests/vertreter.test.ts`.
**Regeln:** MyImmo formuliert keine Vollmacht und beurteilt nicht, ob sie reicht — Hinweise
sagen „meist … nachfragen“; die einzige feste Aussage ist § 29 GBO (Grundbuch braucht
mindestens öffentliche Beglaubigung). Der Reiter sagt ausdrücklich, dass der Vertreter
**keinen Zugang** bekommt.
✅ **Gebaut am selben Tag (Folge-PR):** Im Kauf-Assistenten wählt man am Knopf „Kreditantrag“
optional einen Vertreter → das PDF bekommt Seite 3 „Bevollmächtigter Vertreter“ (Person,
Vollmacht, Umfang; **ohne Scan** — oft mit Ausweiskopie). Nur eigene Vertreter, widerrufene oder
abgelaufene Vollmachten lehnt die Route ab (`kreditVertreter()`). Dashboard: „Vollmacht läuft
ab“ (≤ 60 Tage) bzw. „abgelaufen“ (dringend) unter Termine & Aufgaben. **Nicht gebaut:** Vertreter
im Beleihungsordner (objektbezogen, öffentlicher Freigabe-Link — dort bewusst nicht ohne eigene
Entscheidung).

Der Rest dieser Datei beschreibt den späteren **App-Zugang** für eine Vertrauensperson — weiter
offen, weiter mit allen Risiken unten.

## Was es sein soll

Ein Vermieter lädt eine Person per E-Mail ein (dieselbe Adress-Bindung wie bei der
Mieter-Einladung). Die Person meldet sich mit eigenem Konto an und arbeitet in den Objekten des
Vermieters — mit Rechten, die der Vermieter festlegt, und einem Protokoll, wer was getan hat.
**Kein geteiltes Passwort.** Heute ist das der einzige Weg, und er ist der schlechteste
(keine 2FA je Person, kein Protokoll, kein Entzug ohne Passwortwechsel).

## Risiken

1. **Der größte Umbau seit dem Start.** Alle rund 47 Tabellen haben Regeln der Form
   `auth.uid() = user_id`, und viele Actions filtern zusätzlich auf `user_id = user.id`. Ein
   Vertreter braucht überall „oder ich bin für diesen Vermieter freigeschaltet“. Ein vergessener
   Filter ist entweder ein Datenleck oder eine Funktion, die für den Vertreter still nichts tut.
   → Erst an EINER Tabelle beweisen (Prototyp, zurückgerollte Transaktion), dann Tabelle für
   Tabelle, jede mit Test.
2. **Datenschutz:** Der Vertreter sieht Mieterdaten. Verantwortlich bleibt der Vermieter; er muss
   die Person zur Vertraulichkeit verpflichten. MyImmo muss das beim Einladen sagen (Hinweis +
   Bestätigung), nicht prüfen.
3. **Bankdaten und Steuer:** IBANs, Darlehensnummern und die Anlage V sind die sensibelsten
   Daten. Standard: **für Vertreter gesperrt**, nur ausdrücklich freischaltbar.
4. **Mieterkommunikation:** Schreibt der Vertreter im Vorgang, muss beim Mieter „im Auftrag des
   Vermieters“ stehen, nicht nur „Dein Vermieter“ — sonst täuscht der Verlauf.
5. **Unumkehrbares:** Konto löschen, Objekte löschen, Daten-Export bleiben dem Vermieter.

## Plan

1. **Konzept der Rechte** (mit Jonas): Stufen z. B. *Lesen* · *Vorgänge & Mieterkommunikation* ·
   *Buchen* · *Alles außer Bank/Steuer/Löschen*. Je Objekt oder für alle?
2. **Prototyp an einer Tabelle** (`anliegen` + `anliegen_ereignisse`), Tabelle `vertreter`
   (vermieter_id, user_id, email, rechte, objekte, seit, bis), Einladung über den vorhandenen
   Einladungscode-Weg mit Rolle `vertreter`. Nachweis als Vermieter/Vertreter/Fremder.
3. **Tabelle für Tabelle** ausrollen, `aktuellerNutzer()` um „für wen arbeite ich“ ergänzen
   (Kontowechsler oben in der App, wie bei Konten mit mehreren Firmen).
4. **Protokoll** (wer, was, wann) für Vertreter-Aktionen; der Vermieter sieht es.

**Gehört zusammen mit** dem vorgemerkten Business-Account (Team-Zugänge mit Rollen): Ein
Vertreter ist die erste Rolle davon. Einmal richtig bauen, nicht zweimal.

**Reihenfolge:** nach dem Mieterportal-Ausbau. Der Umbau berührt jede Tabelle — ihn
dazwischenzuschieben hieße, jede Portal-Funktion danach noch einmal anzufassen.
