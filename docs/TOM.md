# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) — MyImmo

**Entwurf** (Stand 15.07.2026). Dient zugleich als Anlage „TOMs" zum Nutzer-AVV (`/avv`).
Jährlich überprüfen und Änderungshistorie pflegen.

## 1. Vertraulichkeit

**Zutritts-/Zugangskontrolle (Infrastruktur):** Kein eigener Serverbetrieb — Hosting bei
Vercel und Supabase (AWS eu-central-1, Frankfurt) mit deren zertifizierten Rechenzentrums-
kontrollen (SOC 2 / ISO 27001, Nachweise im Compliance-Ordner). Admin-Zugänge des Betreibers
mit starken Passwörtern + 2FA [aktivieren und hier bestätigen].

**Zugangskontrolle (App):** Authentifizierung über Supabase Auth (E-Mail/Passwort mit
Hashing, Google OAuth); Session-Cookies HttpOnly; Beta-/Einladungscodes für die Registrierung
(rollengebunden, Ablauf, Einmal-Einlösung).

**Zugriffskontrolle (Daten):** **Row Level Security (RLS) auf allen Tabellen** — jeder Nutzer
sieht ausschließlich eigene Datensätze; Rollen-Trennung Vermieter/Mieter/Service/Hausverwaltung;
Mieterportal nur mit expliziten Freigaben (`mieter_freigabe`).

**Pseudonymisierung/Verschlüsselung:** Transportverschlüsselung TLS überall.
**App-Layer-Verschlüsselung (AES-256-GCM)** für besonders sensible Felder — IBAN/Kontoinhaber
(`ibans`), Bankverbindungs-IBAN sowie Gegenpartei/Verwendungszweck der Bankumsätze; Schlüssel
(`DATA_ENCRYPTION_KEY`) liegt ausschließlich als Vercel-Umgebungsvariable, **nicht** in der
Datenbank → schützt auch gegen DB-Leak/Insider. Dubletten-Prüfung über Blind-Index (HMAC)
statt Klartext. Datenbank-seitige Verschlüsselung at rest durch Supabase/AWS.

## 2. Integrität

- Weitergabekontrolle: Datenabruf nur über die App-API mit Session; Bank-Freigabelinks
  zeitlich begrenzt, widerrufbar, nur ausgewählte Dokumente.
- Eingabekontrolle: Zeitstempel (`created_at`) auf allen Tabellen; Änderungen nur durch den
  authentifizierten Eigentümer (RLS); serverseitige Validierung + Idempotenz-Prüfungen bei
  Buchungen (Schutz vor Doppel-Einträgen).
- KI-Ergebnisse werden nie automatisch übernommen — Prinzip „vorschlagen + bestätigen".

## 3. Verfügbarkeit und Belastbarkeit

- Managed-Infrastruktur mit automatischen Backups (Supabase: tägliche Backups; Aufbewahrung
  planabhängig) und Multi-AZ-Betrieb (AWS Frankfurt).
- Wiederherstellung: über Supabase-Backups; [Restore-Test dokumentieren].
- Kein Single-Server-Risiko; Vercel-CDN-Auslieferung.

## 4. Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d)

- Supabase Security Advisors (Linter) regelmäßig prüfen; Abhängigkeits-Updates.
- Jährliche Überprüfung dieses Dokuments + der Subprozessoren-Nachweise
  (trust.supabase.io, vercel.com/docs/security/compliance, trust.anthropic.com).
- Datenpannen-Prozess: Bewertung → ggf. Meldung an Aufsichtsbehörde binnen 72 h (Art. 33),
  Information betroffener Auftraggeber „unverzüglich" gemäß Nutzer-AVV.

## 5. Auftragskontrolle (Subprozessoren)

Verträge nach Art. 28 mit: Supabase (DPA signiert am [Datum]), Vercel (DPA via Pro-Plan seit
[Datum]), Anthropic (DPA via Commercial Terms, archiviert am [Datum]), Enable Banking
(vor Banking-Live). Subprozessorenliste im Nutzer-AVV; Änderungen mit Ankündigung +
Widerspruchsrecht.

## 6. Datenminimierung / Löschkonzept

- Dateien (Belege/Dokumente) liegen nutzergebunden in der DB und werden mit dem Datensatz
  bzw. Konto gelöscht (CASCADE); Bankverbindung löschen entfernt zugehörige Umsätze.
- Export-/Rückgabemöglichkeit vor Kontolöschung (AVV lit. g) — [CSV/JSON-Export bereitstellen].
- PSD2: Bank-Freigaben laufen automatisch nach max. 90 Tagen ab.

*Änderungshistorie: 15.07.2026 Erstfassung (Entwurf).*
