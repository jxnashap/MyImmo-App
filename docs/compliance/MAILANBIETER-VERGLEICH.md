# Mailanbieter: Brevo oder ein deutscher Anbieter?

Stand: 06.10.2026 · Anlass: Der Betreiber hält Brevo für DSGVO-bedenklich (Drittland-Weitergabe über
Brevos Unterauftragsverarbeiter, siehe [[AVV-STATUS]]). **Noch nicht entschieden.**
Preise und Vertragslagen altern — vor der Entscheidung die Zeilen mit Quelle erneut prüfen.

## Was MyImmo von einem Mailanbieter braucht

1. **Einzelmails** aus der App: Double-Opt-in-Bestätigung (Warteliste/Vorlagen), Mieter-Einladung,
   Hinweis-Mails (`lib/benachrichtigung.ts`). Heute über die Brevo-HTTP-Schnittstelle, **nur in
   einer Datei** (`lib/mail/brevo.ts`) — ein Wechsel tauscht diese Datei, nicht die Aufrufer.
2. **Kontaktliste** für die Startankündigung — optional. Den Einwilligungsnachweis führt MyImmo
   selbst (`newsletter_anmeldungen`), der Anbieter muss kein eigenes Double-Opt-in machen.
3. **Möglichst auch SMTP für Supabase Auth** (Registrierung bestätigen, Passwort vergessen).
   Offen: Ob in Supabase ein eigener SMTP eingetragen ist, ist nicht geprüft. Der eingebaute
   Supabase-Versand ist nach eigener Kenntnis nur für Tests gedacht (geringe Menge je Stunde,
   nur an Team-Adressen) — **nicht belegt, im Dashboard nachsehen** (Authentication → Emails → SMTP).

## Vergleich (Stand 06.10.2026)

| | **Brevo** (heute) | **rapidmail** | **CleverReach** | **MailBridge** |
|---|---|---|---|---|
| Firma | Sendinblue SAS, Paris | Positive Group Deutschland GmbH, Freiburg | CleverReach GmbH & Co. KG, Rastede | LOGIN SystemHaus GmbH, Wiesbaden |
| Server | EU | Deutschland | Deutschland **und Irland** (AWS) — Werbeaussage „nur Deutschland" stimmt laut eigenem AVV nicht | Deutschland (Nürnberg, Falkenstein) |
| Drittland über Unterauftragsverarbeiter | **ja**: Datadog, Zendesk, Convrrt (USA), Support Indien — SCCs | laut Zweitquelle **keine US-Firma** (Gleap AT, Scoria Labs DE, uvensys DE); **amtliche Liste erst nach Registrierung im AVV** | **ja**: Amazon Web Services, Inc. speichert und verarbeitet die Auftragsdaten (Irland, Deutschland); USA über **EU-U.S. Data Privacy Framework** (AVV-Muster 5.2, im Volltext gelesen) | nicht angegeben, AVV auf der Seite nicht erwähnt |
| Einzelmails per **HTTP-API** | ja | **nein** — Transaktionsmails nur per **SMTP** (API v3 liest sie nur aus) | nein — SMTP-Relay, keine REST-API für Einzelmails | nein — nur SMTP |
| Kontakte per API mit Double-Opt-in | ja | ja (`send_activationmail`) | ja | nein |
| Preis kleiner Umfang | 300 Mails/Tag frei | **bis 1.000 Transaktionsmails/Monat frei**, darüber ab 59 €/Monat (bis 50.000); Freischaltung **auf Anfrage beim Support**; Newsletter „Essential" ab 15 €/Monat (500 Empfänger) | Lite frei (250 Empfänger, 1.000 Mails/Monat), Basic ab 15 € | ab 4,90 €/Monat (500 Mails), 2,90 € je weitere 1.000 |

**Ergebnis:** Nur **rapidmail** erfüllt „deutsche Firma, Server in Deutschland, keine US-Unterauftragsverarbeiter"
— Letzteres aber nur über eine Zweitquelle belegt. **CleverReach ist beim Drittland-Punkt nicht besser
als Brevo** (AWS Inc.). MailBridge ist ein reines SMTP-Relais ohne sichtbaren AVV.

## Was ein Wechsel zu rapidmail kostet

- **SMTP statt HTTP:** Aus Vercel-Funktionen per SMTP senden braucht einen SMTP-Client (z. B.
  `nodemailer`). Neue Abhängigkeit — `npm install` ist in der Remote-Umgebung nur teilweise
  verlässlich (CLAUDE.md, „Sicherheit der Abhängigkeiten"); Lockdatei danach auf verlorene Pakete
  prüfen. Ob Vercel ausgehend Port 587 zulässt: vor dem Umbau mit einer Probemail testen.
- **Vorteil:** Derselbe SMTP-Zugang kann in Supabase für die Anmelde-Mails eingetragen werden —
  ein Anbieter, ein AVV, eine DNS-Einrichtung.
- `/datenschutz` Ziffern 3 g, 4, 5 (Brevo raus, rapidmail rein), [[AVV-STATUS]], SPF/DKIM für
  myimmoapp.de, `brevoBereit()` → anbieterneutral.

## Vor einer Entscheidung zu klären (nur mit Konto/Anfrage)

1. rapidmail: Unterauftragsverarbeiter-Liste im AVV nach Registrierung **selbst lesen** (die Zweitquelle ersetzt das nicht).
2. rapidmail: Gelten die 1.000 freien Transaktionsmails ohne bezahlten Tarif? Wie schnell schaltet der Support frei?
3. Supabase: Ist ein eigener SMTP eingetragen (siehe oben)?

## Quellen (abgerufen 06.10.2026)

- rapidmail Transaktionsmails: https://www.rapidmail.de/funktionen-transaktionsmails-versenden
- rapidmail API v3 (Transaktionsmails nur lesend; Empfänger mit `send_activationmail`):
  https://github.com/rapidmail/rapidmail-apiv3-client-php/tree/master/docs
- rapidmail Unterauftragsverarbeiter (Zweitquelle): https://euvetted.com/de/p/rapidmail
- CleverReach AVV-Muster 5.2 mit Unterauftragsverarbeitern (Primärquelle, gelesen): https://eu2.cleverreach.com/assets/dpa/5.2_de_example.pdf
- CleverReach Preise/SMTP: https://newsletter-tools.de/testberichte/cleverreach.html
- MailBridge: https://mailbridge.email/
- Übersicht europäischer Anbieter: https://european-alternatives.eu/category/transactional-email-service
- Brevo-Unterauftragsverarbeiter: [[brevo-dpa-archiv]]
