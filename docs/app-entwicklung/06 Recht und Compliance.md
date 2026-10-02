# 06 — Recht und Compliance

**Kein Rechtsrat.** Das hier ist der erarbeitete Stand dieses Projekts mit
Prüfdaten. Was anwaltlich freizugeben ist, ist als solches markiert.

## Die Reihenfolge

1. **Gewerbe anmelden**, bevor Verträge geschlossen werden. Die angemeldete
   **Tätigkeitsbeschreibung** entscheidet mit, was erlaubt ist. Bei MyImmo:
   „Entwicklung und Bereitstellung von Software (SaaS) sowie damit verbundene
   digitale Dienstleistungen" — das deckt **keine** Darlehensvermittlung, passt
   also zur § 34i-freien Ausrichtung.
2. **AVV mit jedem Auftragsverarbeiter** (Art. 28 DSGVO) — siehe
   [[05 Anbindungen und Vertraege]].
3. **Eigenen AVV für die Nutzer anbieten**, wenn sie über die App fremde
   personenbezogene Daten verarbeiten. Das war in MyImmo die größte Lücke:
   Vermieter sind Verantwortliche für Mieterdaten, MyImmo ist ihr
   Auftragsverarbeiter.
4. **Verarbeitungsverzeichnis** (Art. 30 Abs. 1 **und** 2) und **TOM-Doku**.
5. **Impressum und Datenschutz** gegen die Gewerbeanmeldung abgleichen —
   Geschäftsbezeichnung, Inhaber, Anschrift, Rechtsform müssen 1:1 stimmen.
6. **Anwaltliche Prüfung** von AGB, Widerruf, Nutzer-AVV, Impressum,
   Datenschutz und den berufsrechtlich grenznahen Funktionen.

## Berufsrechtliche Grenzen

- **§ 34i GewO** — Immobiliardarlehensvermittlung. Rechnen und informieren ist
  frei, das Empfehlen eines konkreten Produkts nicht. Konsequenz im Code:
  Wortwahl neutral, „Empfehlung" entfernt, im Modul kommentiert.
- **StBerG § 1–5** — Steuerberatung. Anlage-V-Berechnung, § 82b-Optimierer und
  DATEV-Export sind grenznah und gehören schriftlich freigegeben.
- **§ 34c GewO** — Wertermittlung. MyImmo trennt „geschätzter Marktwert" streng
  von „Belastbarkeit der Eingaben"; letzteres misst nur die Vollständigkeit.

## Datenschutz im Bau

- **Region EU wählen** (Supabase eu-central-1), nicht nachträglich migrieren.
- **Verschlüsselung dort, wo es weh tut**: IBAN, Kontoinhaber, Darlehensnummer,
  Kautionsbank. App-Layer, Schlüssel außerhalb der Datenbank.
- **Löschkonzept von Anfang an** (Art. 17): Was passiert mit den Daten Dritter,
  wenn der Hauptnutzer löscht? Eigene Migration plus Umfangsmodul.
- **Einwilligung ist zu dokumentieren**, nicht nur einzuholen — Zweck,
  Rechtsgrundlage, Empfänger, Speicherdauer, Widerruf. Ein Verteiler ohne diesen
  Passus in der Datenschutzerklärung verarbeitet Adressen ohne die
  vorgeschriebene Information.
- **Drittlandtransfer benennen**: SCC oder DPF — nicht raten. Anthropic nutzt
  **SCC, kein DPF** (geprüft 15.07.2026).

## Sicherheit: Schalter ≠ Wirkung

Der Supabase-Schalter „Leaked Password Protection" ist auf dem Free-Plan
**sichtbar, aber wirkungslos** — am 29.07.2026 empirisch geprüft: Eine
Registrierung mit dem millionenfach geleakten „Password123!" ging trotz
gesetztem Schalter durch. Wer ihn nur umlegt, hält den Schutz für aktiv.

Ebenso lief die Mindest-Passwortlänge auseinander: Die App verlangt 8 Zeichen,
Supabase stand auf 6 — „abc123" wurde am 29.07. und erneut am 31.07.2026
angenommen. Solange das auseinanderläuft, greift nur die App-Prüfung; wer die
Auth-API direkt anspricht, kommt mit 6 Zeichen durch.

**Regel: Jede Sicherheitseinstellung wird durch einen echten Versuch geprüft,
nicht durch einen Blick ins Dashboard.**

## Plattform-Auflagen

- **„Sign in with Apple"** ist Pflicht, sobald ein anderer Social-Login
  angeboten wird und die App in den iOS App Store geht. Braucht das
  Apple-Developer-Programm (99 $/Jahr).
- **App-Icon**: technische Vorgaben in [[03 Design und Layout]].
