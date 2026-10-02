# Handwerker-Anfragen und Handwerkerportal

Stand 02.10.2026. Idee von Jonas (Memory-Repo `02 - MyImmo/myimmoideen.md`, „Handwerkerportal
mit Provision“), im Gespräch am selben Tag zu einem Plan gemacht.

## Entscheidungen (Betreiber, 02.10.2026)

| Frage | Entscheidung | Warum |
|---|---|---|
| Wer erstellt den Kostenvoranschlag? | **MyImmo baut die Anfrage, der Handwerker bietet.** | Ein Kostenvoranschlag ist das Angebot des Handwerkers. Setzt MyImmo selbst Preise, haftet es für Zahlen, die es nicht kennt. |
| Wer wählt den Handwerker? | **Der Vermieter; der Mieter schlägt vor.** | Instandhaltung ist Pflicht des Vermieters (§ 535 BGB), er bezahlt. Der Mieter beauftragt selbst nur im Notfall oder Verzug (§ 536a Abs. 2 BGB). |
| Wie verdient MyImmo? | **Offen — erst nach Stufe 1 entscheiden.** | Ohne Vermieter und Handwerker gibt es nichts zu bepreisen. |

## Risiken (vor jeder Stufe lesen)

1. **Henne-Ei-Problem:** Es gibt noch keine echten Vermieter. Ein regionales Verzeichnis ist ohne
   Dichte leer — ein leeres Portal schadet mehr als keins. Deshalb Stufe 2 erst bei Dichte.
2. **Provision auf den Auftragswert ist kaum durchsetzbar:** Nach dem ersten Kontakt macht man
   das nächste Mal direkt aus. Sie einzuziehen hieße, Geld der Kunden anzufassen
   (Zahlungsdiensteaufsicht, ZAG). Durchsetzbar: Abo oder Gebühr je angenommener Anfrage, vom
   Handwerker bezahlt.
3. **Plattformrecht ab Stufe 2:** P2B-Verordnung (EU 2019/1150: eigene AGB für Handwerker,
   offengelegte Rangfolge), Digital Services Act (Nachverfolgbarkeit der Anbieter), UWG
   (eine bezahlte Platzierung muss als solche erkennbar sein). Die Gewerbeanmeldung deckt heute
   nur Software ab. → Anwaltsliste, **vor** Stufe 2.
4. **Datenschutz:** Fotos, Beschreibung und Adresse aus dem Anliegen an einen fremden Handwerker
   sind eine Übermittlung personenbezogener Daten. Verantwortlich ist der Vermieter; MyImmo
   übermittelt nur auf seine Auslösung, und nur die Anhänge, die er auswählt.
5. **Neutralität:** Verdient MyImmo an Handwerkern, darf es sie dem Vermieter nicht als „beste
   Wahl“ empfehlen, ohne das offenzulegen.

## Stufe 1 — „Angebote einholen“ (ohne Verzeichnis, ohne Erlöse)

Baut auf den beiden Fundamenten auf (Zustellung, Vorgänge mit Verlauf) und auf dem, was es
schon gibt: Firmenliste je Vermieter (`firmen`), Aufträge mit öffentlichem Link
(`auftraege.public_token`, `auftrag_public_rueckmeldung`), Anliegen mit Dateien.

1. Im Vorgang (Vermieter-Seite): **„Angebote einholen“** → eine oder mehrere Firmen aus der
   eigenen Liste wählen (der Mieter-Vorschlag steht oben, falls es einen gibt).
2. MyImmo **baut die Anfrage**: Titel, Beschreibung aus dem Anliegen, Objektadresse,
   Terminwünsche, ausgewählte Fotos. **Der Vermieter bearbeitet den Text**, bevor etwas rausgeht.
3. Versand: mit Brevo als E-Mail mit Link; ohne Brevo fertiger Text zum Kopieren (wie heute bei
   der Mieter-Einladung). Mieter-Name und Telefon gehen **nicht** mit, bis der Vermieter beauftragt.
4. Die Firma antwortet über den Link mit **Betrag, frühestem Termin und Angebots-PDF**.
5. Im Verlauf erscheinen die Angebote nebeneinander; **„Beauftragen“** macht daraus einen Auftrag
   (der Verlauf schreibt „Ein Handwerker wurde beauftragt“ schon heute mit).
6. Kommt mit der **Kostengrenze** aus dem Mieterportal-Plan: Angebote bis X € kann der Vermieter
   vorab freigeben.

✅ **Gebaut 02.10.2026** (Migration `20261002200000`, `lib/angebote.ts`, `lib/actions/angebote.ts`,
`components/AngeboteEinholen.tsx`, öffentliche Seite `/angebot/[token]`, `tests/angebote.test.ts`):
Punkte 1, 2, 4 (ohne PDF — Betrag, Termin, Text), 5, 6 (Badge „innerhalb deiner Kostengrenze“;
die automatische Freigabe gilt nur für Hausmeister-Anträge). **Abweichungen, bewusst:** Versand
NICHT über Brevo, sondern je Firma Mail-Entwurf (`mailto:`) + Link zum Kopieren — der Vermieter
schreibt aus seinem eigenen Postfach, und Brevo ist noch nicht eingerichtet. Keine Fotos in der
Anfrage (Anliegen-Dateien sind Mieterdaten; erst mit eigener Auswahl nachrüsten). Beauftragen legt
einen Auftrag OHNE Service-Konto an (`service_user_id` null, `firma_id` gesetzt) und liefert den
bekannten Link `/auftrag/<token>`; die übrigen offenen Anfragen werden „nicht gewählt“.
**Nicht gebaut:** Mail an den Vermieter bei neuem Angebot (er sieht es im Vorgang), Mieter-
Vorschlag „Ich kenne einen Handwerker“. **Regel: Die Anfrage-Tabelle hat keine Mieter-Spalte —
so bleibt es; Mieter-Kontakt geht nur beim Beauftragen und nur mit Haken.**

Mieter-Seite: Bei einer Schadensmeldung optional „Ich kenne einen Handwerker“ (Name, Kontakt) —
ein Vorschlag, keine Beauftragung.

## Stufe 2 — Regionales Verzeichnis (erst bei Dichte)

Bedingung: grob 50+ aktive Vermieter in einer Region **und** die Anwaltsprüfung aus Risiko 3.
Handwerker legen sich selbst ein Service-Konto mit Profil an (Gewerke, PLZ-Umkreis,
Nachweise wie Handwerksrolle/Installateurverzeichnis). Ein Vermieter findet sie bei „Angebote
einholen“ zusätzlich zur eigenen Liste. Rangfolge offen und erklärt (P2B).

## Stufe 3 — Erlöse (Entscheidung offen)

Kandidaten: Abo für Handwerker (Sichtbarkeit), Gebühr je angenommener Anfrage. Provision auf den
Auftragswert nur mit Rechnungsabwicklung über einen lizenzierten Zahlungsdienst — siehe Risiko 2.
Bei Entscheidung `docs/FINANZKONZEPT.md` im selben PR mitziehen.
