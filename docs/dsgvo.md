# DSGVO-Compliance-Dokumentation — MyImmo

> **Status:** interner Entwurf. Vor Produktivgang von einer Datenschutz-Fachkraft/Anwalt
> prüfen lassen. Platzhalter `[…]` mit echten Daten füllen.
> Stand der letzten technischen Prüfung: 2026-06-25.

Dieses Dokument bündelt die organisatorischen DSGVO-Nachweise für MyImmo. Es ergänzt die
nutzerseitigen Dokumente unter `/datenschutz`, `/impressum` und `/avv`.

---

## 1. Rollen & Rechtsgrundlagen

### Rollenklärung
- **Nutzer (Vermieter)** = **Verantwortlicher** für die von ihm erfassten **Mieterdaten**
  (Art. 4 Nr. 7 DSGVO).
- **MyImmo / [Betreiber]** = **Auftragsverarbeiter** für diese Mieterdaten (Art. 28 DSGVO).
- Für die **Kontodaten des Nutzers selbst** (E-Mail, Login, Vermieterprofil) ist MyImmo
  **eigener Verantwortlicher**.

### Rechtsgrundlagen je Verarbeitung (Art. 6 DSGVO)
| Verarbeitung | Rechtsgrundlage |
|---|---|
| Konto/Authentifizierung, Bereitstellung der App | Art. 6 (1) b — Vertrag |
| Verarbeitung der Mieterdaten im Auftrag des Vermieters | Art. 28 (Auftragsverarbeitung); Rechtsgrund liegt beim Vermieter (i. d. R. Art. 6 (1) b/f) |
| Betrieb, Sicherheit, Missbrauchsabwehr | Art. 6 (1) f — berechtigtes Interesse |
| Optionaler KI-Import (Anthropic), Google-Login | Art. 6 (1) b bzw. Einwilligung (a) |

---

## 2. Verzeichnis von Verarbeitungstätigkeiten (Art. 30)

**Verantwortlicher:** [Name, Anschrift, Kontakt] · **DSB:** [falls benannt]

| Tätigkeit | Betroffene | Datenkategorien | Empfänger | Speicherdauer |
|---|---|---|---|---|
| Nutzerkonto & Auth | Vermieter | E-Mail, PW-Hash, Google-ID | Supabase | bis Kontolöschung |
| Vermieterprofil | Vermieter | Name, Anschrift, E-Mail, Tel., IBAN | Supabase | bis Kontolöschung |
| Objekt-/Finanzverwaltung | Vermieter | Immobilien, Einnahmen, Kosten, Kredite, Verbrauch, Termine | Supabase | bis Kontolöschung |
| Mieterverwaltung | Mieter (Dritte) | Name, Kontakt, Anschrift, Mietverhältnis, Miet-/Kautionsdaten, Notizen | Supabase | bis Löschung durch Vermieter / Kontolöschung |
| Dokumentenerstellung & Belege | Vermieter, Mieter | hochgeladene/erzeugte Dokumente (Base64) | Supabase | bis Löschung |
| KI-Beleg-/Objekt-Import (optional) | Vermieter, Mieter | Inhalte hochgeladener Belege | Anthropic | nur zur Verarbeitung, keine Speicherung bei Anthropic |

**Drittlandtransfer:** Datenhaltung in der EU (Supabase eu-central-1, Frankfurt). Anthropic-API:
[Transfermechanismus/SCC im AVV prüfen].

---

## 3. Technische & organisatorische Maßnahmen (TOMs, Art. 32)

| Bereich | Maßnahme | Status |
|---|---|---|
| Verschlüsselung in transit | HTTPS/TLS erzwungen (Vercel + Supabase) | ✅ |
| Verschlüsselung at rest | Festplatten-Verschlüsselung (Supabase, AES-256) | ✅ |
| Zugriffskontrolle (Mandantentrennung) | Row Level Security je `user_id` auf allen Tabellen | ✅ |
| Authentifizierung | E-Mail/Passwort (bcrypt) + Google-OAuth | ✅ |
| Passwort-Härtung | Leaked-Password-Schutz (HIBP) | ⚠️ **im Supabase-Dashboard aktivieren** |
| 2-Faktor-Authentifizierung | optionale MFA | ⏳ Backlog |
| Funktions-Härtung | `SECURITY DEFINER` strikt auf `auth.uid()`, fixer `search_path` | ✅ |
| Backups | automatische tägliche Backups (Supabase-Plan abhängig) | [Plan prüfen] |
| Löschung | Self-Service-Kontolöschung (Art. 17) + Datenexport (Art. 20) | ✅ |
| Datensparsamkeit | nur für Vermietung/NK-Abrechnung benötigte Felder | ✅ (laufend prüfen) |

---

## 4. Auftragsverarbeiter / Drittdienste

| Dienst | Zweck | Ort | AVV |
|---|---|---|---|
| **Supabase** | Datenbank, Auth, Hosting | EU (Frankfurt) | [AVV abschließen] |
| **Vercel** | App-Hosting/Auslieferung | EU/Global Edge | [AVV abschließen] |
| **Anthropic** | KI-Texterkennung (optional) | USA | [AVV + SCC prüfen] |
| **Google** | „Login mit Google" (optional) | USA | [AVV/Bedingungen prüfen] |

> Diese Liste bei jeder neuen Integration (E-Mail-Versand, Zahlungsanbieter, Analytics,
> Crash-Reporting) aktualisieren.

---

## 5. Betroffenenrechte — technische Umsetzung

| Recht | Umsetzung in MyImmo |
|---|---|
| Auskunft (Art. 15) | Datenexport `/api/export` (vollständiger JSON-Dump) |
| Berichtigung (Art. 16) | Bearbeiten-Funktion bei allen Entitäten |
| Löschung (Art. 17) | Self-Service-Kontolöschung (Einstellungen) → löscht alle Daten + Auth-User |
| Datenportabilität (Art. 20) | JSON-Export (maschinenlesbar) |
| Mieter-Löschung durch Vermieter | Mieter inkl. zugehöriger Daten löschbar |

**Backups & Löschung:** Bei Kontolöschung werden Produktivdaten sofort entfernt. In Backups
können Daten bis zum Ablauf des Backup-Zyklus fortbestehen; sie werden nicht wiederhergestellt
und mit Ablauf überschrieben. → [im Löschkonzept festhalten, Backup-Retention dokumentieren].

---

## 6. Lösch- & Aufbewahrungskonzept

- **Kontodaten:** Löschung bei Kontolöschung (sofort, Self-Service).
- **Mieterdaten:** Löschung durch den Vermieter (Verantwortlicher). **Empfehlung:** Mieterdaten
  nach Vertragsende + gesetzlicher Aufbewahrungsfrist löschen.
- **Offen / Backlog:** automatischer Lösch-Reminder oder Auto-Löschung nach Vertragsende
  (derzeit manuell — bewusst, um versehentlichen Datenverlust zu vermeiden).
- **Gesetzliche Aufbewahrung:** steuerlich relevante Belege ggf. 6–10 Jahre (AO/HGB) — bleiben
  unberührt.

---

## 7. Datenschutz-Folgenabschätzung (DSFA, Art. 35) — Kurzbewertung

- Verarbeitet werden u. a. Finanz-/Bankdaten und Daten Dritter (Mieter).
- **Keine** besonderen Kategorien (Art. 9) vorgesehen — am Notizfeld wird aktiv davor gewarnt.
- Keine systematische Überwachung, kein Scoring, kein großflächiges Profiling.
- **Vorläufige Einschätzung:** DSFA-Pflicht eher **nicht** einschlägig, da keine der
  Schwellen der Art.-35-(3)-Liste klar erfüllt ist. **Aber:** finale Bewertung durch
  Datenschutz-Fachkraft, sobald Nutzerzahl/Datenumfang wächst.

---

## 8. Offene juristische Punkte (kein Code)

- AVV mit Supabase, Vercel, Anthropic, Google abschließen.
- Nutzer-AVV (`/avv`) rechtlich finalisieren.
- AGB, Widerrufsbelehrung, Preisangaben (inkl. USt.) — sobald Abo-Modell steht.
- Impressum/Datenschutz mit echten Daten füllen und prüfen lassen.
- Leaked-Password-Schutz im Supabase-Dashboard aktivieren.
