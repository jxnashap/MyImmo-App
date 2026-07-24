# Compliance-Nachweise der Auftragsverarbeiter (SOC 2 / ISO 27001)

> Sammlung der Sicherheits-Zertifizierungen unserer Prozessoren als Nachweis der
> sorgfältigen Auswahl (Art. 28 Abs. 1 DSGVO) und Ergänzung zu [[AVV-STATUS]] und
> `docs/TOM.md`. Geprüft an den offiziellen Trust-Portalen. **Stand: 24.07.2026.**
> Jährlich neu prüfen (mit dem TOM-Review).

## Übersicht

| Anbieter | Zertifizierungen (verifiziert) | Quelle | Geprüft am |
|---|---|---|---|
| **Supabase** (DB/Auth) | SOC 2, ISO/IEC 27001, HIPAA, GDPR-Programm | https://trust.supabase.com | 24.07.2026 |
| **Vercel** (Hosting) | SOC 2, ISO/IEC 27001, HIPAA, GDPR-Programm | https://security.vercel.com | 24.07.2026 |
| **Anthropic** (OCR/KI) | ISO 27001:2022, ISO/IEC 42001:2023, SOC 2 Type I & II, HIPAA-ready | https://privacy.claude.com/en/articles/10015870 (+ https://trust.anthropic.com) | 15.07.2026 |

## Hinweise

- **Vollständige SOC-2-Berichte sind NDA-geschützt** und nur über die Trust-Portale
  auf Anfrage erhältlich (Supabase/Vercel: „Request access"). Für unsere Dokumentation
  genügt der Nachweis der gültigen Zertifizierung; die Berichte selbst nur anfordern,
  wenn ein Kunde/Prüfer sie verlangt — Anfrage muss der **Betreiber** stellen (Firmen-
  E-Mail, NDA-Zustimmung).
- **trust.anthropic.com** rendert nur mit JavaScript — maßgeblich geprüft wurde die
  Zertifizierungsliste auf privacy.claude.com (siehe [[anthropic-dpa-archiv]]).
- Diese Nachweise ergänzen die abgeschlossenen AVVs: Supabase-DPA (signiert
  24.07.2026), Anthropic-DPA (automatisch via Commercial Terms, Volltext archiviert).
  Vercel folgt mit dem Pro-Upgrade.
