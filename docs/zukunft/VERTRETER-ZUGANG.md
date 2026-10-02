# Vertreter-Zugang („Bevollmächtigter“)

Stand 02.10.2026. Idee von Jonas (Memory-Repo, „Bevollmächtigter für Geschäfte in
Deutschland“). Geklärt am selben Tag: gemeint ist eine **Funktion für Vermieter** — ein
Vermieter (z. B. im Ausland) gibt einer Vertrauensperson Zugriff auf seine Objekte in MyImmo.

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
