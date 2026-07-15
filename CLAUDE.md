# MyImmo — Projektnotizen

## Arbeitsweise / Feedback-Stil (vom Nutzer gewünscht)
- Sei ein ehrlicher Sparring-Partner — kritisch, finde Schwachstellen und blinde Flecken.
- Nicht einfach zustimmen — erst prüfen, ob es stimmt.
- Die Wahrheit sagen, auch wenn sie unbequem ist; ruhig direkt, ohne Schönfärberei.
- Keine Floskeln („Großartige Frage!", „Du hast absolut recht!").
- Bei jeder Entscheidung des Nutzers zuerst die Risiken nennen, bevor zugestimmt wird.


## Offene Punkte / Merkliste

### Kostet Geld (Paid-Plan/Abo nötig)
- **„Sign in with Apple" nachrüsten, sobald die App in den iOS App Store geht.** Apple verlangt
  das, sobald ein anderer Social-Login (Google) angeboten wird. Braucht Apple-Developer-Programm
  (99 $/Jahr), App-ID/Services-ID/Key + Provider-Config in Supabase. Aktuell reine Web-App → noch nicht nötig.
- **Leaked Password Protection (Supabase)** aktivieren — Abgleich neuer/geänderter Passwörter gegen
  HaveIBeenPwned. **Nur im Supabase Pro-Plan** (~25 $/Monat); auf Free existiert der Toggle nicht.
  Nach Upgrade: Authentication → Sign In / Providers → Email → „Password Security". Kostenloser
  Teilersatz jetzt: Mindest-Passwortlänge/-anforderungen in denselben Email-Einstellungen erhöhen.
  (DB-Härtung sonst erledigt: FKs, RLS-Performance, Indizes, doppelte Policy entfernt.)

### Open Banking / Konto-Anbindung (geplant — Sandbox-first)
Entscheidungen aus der Planung (12.07.2026):
- **Nur Lesezugriff** (Kontoinformationsdienst/AISP) über einen **lizenzierten Anbieter** →
  keine eigene BaFin-Lizenz nötig. Kein Zahlungsverkehr.
- **Mehrere Bankverbindungen je Nutzer** (Sparkasse/Groß-/Direktbank via PSD2/XS2A, ~99 % Abdeckung).
- **Eingänge + Ausgaben**: Mieteingänge automatisch mit erwarteten Mieten abgleichen, wiederkehrende
  Ausgaben als Kostenvorschläge. Prinzip **„vorschlagen + per Klick bestätigen"** (keine stille
  Automatik); irrelevante/private Umsätze ausblendbar.
- **Datenschutz**: Umsätze verschlüsselt (App-Layer, wie IBANs) + RLS. PSD2 = alle 90 Tage
  Reauth (App erinnert). Hinweis: bei gemischt privat/geschäftlichem Konto separates Mietkonto empfehlen.
- **Anbieter**: **Enable Banking** (Start-Kandidat, EU-weit, kostenlose Self-Service-Sandbox +
  Restricted Production für eigene Konten). ⚠️ **GoCardless Bank Account Data (Nordigen) fällt weg**
  — Neuanmeldungen deaktiviert/wird abgewickelt (12.07.2026 geprüft). Deutsche BaFin-Alternative
  **finAPI** (Zugang aber verkaufsgebunden). NICHT das GoCardless-„Payments"-Produkt (Lastschrift) —
  falsches Produkt.
- **Voraussetzungen für Live**: Gewerbe (in Arbeit) + Anbietervertrag + AVV. Laufende Kosten je
  Konto/Monat → kostenpflichtiges **Add-on / Business-Tarif**.
- **Bau-Etappen**: (1) Tabellen `bankverbindungen` + `bank_umsaetze` (verschlüsselt, RLS);
  (2) Enable-Banking-Sandbox-Flow (Konto verbinden via JWT-Auth + Umsätze abrufen); (3) Abgleich-Engine +
  „bestätigen"-UI; (4) 90-Tage-Reauth-Erinnerung.
- **Enable-Banking-Auth**: registrierte „Application" (Sandbox) + selbst generiertes RSA-Schlüsselpaar
  (privater Key wird im Browser erzeugt, Dateiname = Application ID). API-Calls per JWT (RS256),
  Header `kid` = Application ID. **Benötigte Env (Vercel)**: `ENABLE_BANKING_APP_ID` +
  `ENABLE_BANKING_PRIVATE_KEY` (privater Schlüssel, wie DATA_ENCRYPTION_KEY behandeln — nie ins
  Repo/Logs). Redirect-URL bei der App-Registrierung: `<base>/api/banking/callback`.

### Sonstiges (kein Geld)
- **Onboarding-Guide für neue Nutzer:** Nach der Registrierung ein kleiner, durchklickbarer
  Guide (Schritt-für-Schritt-Tour), der zeigt, wo man was einträgt und wie man die App benutzt —
  z. B. erstes Objekt anlegen → Mieter erfassen → Ein-/Ausgaben buchen → Mietkonto/Dokumente/Steuer.
  Überspringbar und später über die Einstellungen erneut startbar.
- **Abo-Zugangscode (mit Bezahlsystem umsetzen):** Nach Abschluss/Bezahlung eines Abos erhält
  der Kunde einen individuellen Zugangscode (per E-Mail oder direkt in der App). Der Code ist
  abo-/rollenspezifisch (z. B. gilt ein Hausverwaltungs-Code nur für die Hausverwaltungs-
  Registrierung) und wird nur bei der ERST-Registrierung benötigt — danach normaler Login.
  Fundament existiert: Tabelle `einladungscodes` (rollen-gebunden, Ablauf, Einmal-Einlösung)
  + Signup-Trigger `handle_new_user_rolle` lassen sich um Abo-Codes erweitern.
- **AVV-Verträge (Art. 28 DSGVO)** — Recherche 15.07.2026 (Details: `docs/MASTERPLAN.md` + AVV-Dossier-PDF):
  Supabase = Dashboard→Org→Documents (PandaDoc, kostenlos, auch Free-Plan); Vercel = automatisch
  in ToS, **gilt aber nur ab Pro-Plan (20 $/M)** → Upgrade nötig (Hobby verbietet zudem
  kommerzielle Nutzung); Anthropic = automatisch mit Commercial Terms wirksam (kein Training auf
  API-Daten, Kopie archivieren); Google = **kein AVV nötig** (OAuth-Login → eigenständig
  Verantwortlicher, nur Datenschutzerklärungs-Passus). **Größte Lücke: MyImmo muss den eigenen
  Nutzern einen AVV anbieten** (Vermieter = Verantwortliche für Mieterdaten) — /avv-Seite, AGB-
  Einbeziehung, anwaltlich prüfen. Plus Verarbeitungsverzeichnis Art. 30 Abs. 1+2 und TOM-Doku.
- **Masterplan (Markt/Compliance/Steuer-Features/Roadmap): `docs/MASTERPLAN.md`** (15.07.2026).
- **Impressum/Datenschutz**: Platzhalter in `app/impressum` + `app/datenschutz` mit echten Daten
  (Gewerbeanmeldung) füllen und rechtlich prüfen lassen.
- ~~**Optional (Härtung):** Spalten-Verschlüsselung für IBAN/Bankdaten.~~ ✅ Erledigt:
  App-Layer-Verschlüsselung (AES-256-GCM) für `ibans.iban`/`ibans.inhaber`, Schlüssel als
  Vercel-Env `DATA_ENCRYPTION_KEY` (NICHT in der DB → echter Schutz gegen DB-Leak/Insider).
  Blind-Index (`iban_bidx`) für Dublettenprüfung. `lib/crypto/secure.ts`. **Noch offen:**
  `kredite.darlnr`/`mieter.kaution_bank` (bewusst zunächst ausgelassen — Banknamen bzw. viele
  Touch-Points). Nach Deploy einmalig `/api/encrypt-bankdaten` aufrufen (Altzeilen migrieren).

## Deployment
- **Live-URL (Produktion): https://my-immo-app.vercel.app**
- Gehostet auf **Vercel**, verbunden mit dem GitHub-Repo `jxnashap/myimmo-app` (Branch `main`).
- Ein Merge nach `main` löst automatisch einen neuen Vercel-Build/Deploy aus.
- **Wichtig:** Nach jedem Merge eines PR die Live-URL mitschicken/erwähnen, damit der Stand direkt geprüft werden kann.

### Benötigte Environment-Variablen (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` — für OCR / KI-Import (NK-Abrechnung auslesen, Objekt-Import)
- `DATA_ENCRYPTION_KEY` — 32 Byte base64 (`openssl rand -base64 32`) für die App-Layer-
  Verschlüsselung der Bankdaten (IBAN/Inhaber, `lib/crypto/secure.ts`). **Schlüsselverlust =
  Bankdaten unwiederbringlich weg** → sicher sichern (Passwortmanager), nie ins Repo/Logs.

## Datenbank
- Supabase-Projekt `kozhxrvyilkchjpcuwcm` (Region eu-central-1).
- Dateien (Belege, Archiv-Dokumente) werden als Base64 in Tabellenspalten gespeichert — **kein Storage-Bucket** nötig.

## Build / Test
- `npm run build` zum Verifizieren (braucht die NEXT_PUBLIC_SUPABASE_*-Variablen, Platzhalter genügen für den Build).
