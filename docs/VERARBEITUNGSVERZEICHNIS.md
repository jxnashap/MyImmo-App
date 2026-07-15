# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) — MyImmo

**Entwurf** (Stand 15.07.2026) nach dem Muster des DSK-Kurzpapiers Nr. 1. Vor Produktivbetrieb
mit echten Betreiberdaten füllen und aktuell halten. Zwei Teile: **Teil A** = Verzeichnis als
Verantwortlicher (Art. 30 Abs. 1), **Teil B** = Verzeichnis als Auftragsverarbeiter der
Vermieter-Nutzer (Art. 30 Abs. 2).

## Stammangaben

| Feld | Angabe |
|---|---|
| Verantwortlicher / Auftragsverarbeiter | Jonas Scharp, einzelkaufmännisch tätig als MyImmo |
| Anschrift | Ludwig-Jahn-Straße 42, 23611 Bad Schwartau |
| Kontakt | info@myimmoapp.de, +49 174 9443943 |
| Datenschutzbeauftragter | nicht benannt — nicht erforderlich (§ 38 BDSG: < 20 Personen; Art. 37 DSGVO nicht einschlägig) |

---

## Teil A — Verzeichnis als Verantwortlicher (Art. 30 Abs. 1)

### A1 Nutzerkonten & Authentifizierung
- **Zweck:** Registrierung, Login (E-Mail/Passwort, Google OAuth), Kontoverwaltung, Rollen (Vermieter/Mieter/Service/Hausverwaltung).
- **Kategorien betroffener Personen:** Nutzer der App.
- **Datenkategorien:** E-Mail, Passwort-Hash, Name/Avatar (bei Google-Login), Rolle, Einladungscode-Bezug, Zeitstempel.
- **Empfänger:** Supabase (Auth/DB, Frankfurt), Vercel (Hosting), Google (nur bei OAuth — eigenständig Verantwortlicher).
- **Drittland:** USA (Vercel; Google LLC) — DPF bzw. SCCs; Supabase: SCCs + TIA.
- **Löschfristen:** mit Kontolöschung; Auth-Logs nach kurzer Frist automatisch.
- **TOMs:** siehe `docs/TOM.md`.

### A2 Vertrags- und Abrechnungsdaten (künftige Bezahl-Abos)
- **Zweck:** Abo-Verwaltung, Rechnungsstellung, gesetzliche Aufbewahrung.
- **Betroffene:** zahlende Nutzer. **Daten:** Vertragsdaten, Rechnungsdaten, Zahlungsstatus (Zahlungsabwickler wird bei Einführung ergänzt).
- **Löschfristen:** Rechnungen 8 Jahre (§ 14b UStG / § 147 AO n. F.).

### A3 Server-/Sicherheits-Logs
- **Zweck:** Betrieb, Stabilität, Missbrauchsabwehr. **Daten:** IP, Zeitstempel, URL, User-Agent.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f. **Löschung:** automatisch nach kurzer Frist (Vercel/Supabase-Standard).

### A4 Support-/Kontaktanfragen
- **Zweck:** Beantwortung von Anfragen. **Daten:** E-Mail, Inhalt. **Löschung:** nach Abschluss, spätestens [12 Monate].

---

## Teil B — Verzeichnis als Auftragsverarbeiter (Art. 30 Abs. 2)

Auftraggeber: die jeweiligen Vermieter-/Hausverwaltungs-Nutzer (Verantwortliche). Grundlage:
Nutzer-AVV (`/avv`), akzeptiert bei Registrierung.

### B1 Immobilien- und Mieterverwaltung (Kern)
- **Verarbeitung im Auftrag:** Speicherung/Verwaltung von Mieterdaten (Stammdaten, Kontakt,
  Mietvertragsdaten, Kaution, IBAN — verschlüsselt), Einnahmen/Kosten, Dokumente/Belege
  (Base64 in DB), Zählerstände, Übergabeprotokolle, Schriftverkehr-PDFs.
- **Betroffene:** Mieter, Mietinteressenten, Handwerker/Dienstleister der Auftraggeber.
- **Subauftragsverarbeiter:** Supabase (DB, Frankfurt), Vercel (Hosting/Auslieferung).
- **Drittland:** wie Teil A. **Löschung:** durch den Auftraggeber jederzeit; vollständige
  Löschung mit Kontolöschung (Rückgabe/Export vor Vertragsende möglich).

### B2 KI-Auswertung von Dokumenten (optional, nutzerinitiiert)
- **Verarbeitung im Auftrag:** OCR/Extraktion aus hochgeladenen NK-Abrechnungen und
  Exposés; Ergebnis wird dem Nutzer zur Bestätigung vorgeschlagen (keine automatisierte
  Entscheidung i. S. v. Art. 22).
- **Subauftragsverarbeiter:** Anthropic PBC (USA) — DPA mit SCCs; kein Modell-Training auf
  API-Daten; minimale Retention (Modellklasse der OCR-Route beachten).

### B3 Konto-Anbindung / Bank-Umsatzabgleich (optional, nutzerinitiiert)
- **Verarbeitung im Auftrag:** Lesender Abruf von Kontoumsätzen über den lizenzierten AISP
  Enable Banking Oy (FIN-FSA, EU); verschlüsselte Speicherung (AES-256-GCM) von
  Gegenpartei/Verwendungszweck; Abgleich-Vorschläge, Buchung nur nach Nutzer-Bestätigung.
- **Betroffene:** Zahlungsbeteiligte der Auftraggeber-Konten (v. a. Mieter).
- **Subauftragsverarbeiter:** Enable Banking Oy (EU), Supabase, Vercel.
- **Löschung:** mit Löschung der Bankverbindung (CASCADE) bzw. Kontolöschung.
- **Hinweis:** Vor Production-Betrieb DSFA-Schwellenprüfung dokumentieren (Ergebnisvermerk hier ablegen).

### B4 Mieterportal / Freigabelinks
- **Verarbeitung im Auftrag:** Bereitstellung von Dokumenten/Abrechnungen an Mieter des
  Auftraggebers; zeitlich begrenzte Bank-Freigabelinks (Beleihungsordner).
- **Betroffene:** Mieter; Bankmitarbeiter (Rückmeldedaten).

---

*Änderungshistorie: 15.07.2026 Erstfassung (Entwurf).*
