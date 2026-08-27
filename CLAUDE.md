# MyImmo — Projektnotizen

## Arbeitsweise / Feedback-Stil (vom Nutzer gewünscht)
- Sei ein ehrlicher Sparring-Partner — kritisch, finde Schwachstellen und blinde Flecken.
- Nicht einfach zustimmen — erst prüfen, ob es stimmt.
- Die Wahrheit sagen, auch wenn sie unbequem ist; ruhig direkt, ohne Schönfärberei.
- Keine Floskeln („Großartige Frage!", „Du hast absolut recht!").
- Bei jeder Entscheidung des Nutzers zuerst die Risiken nennen, bevor zugestimmt wird.


## Offene Punkte / Merkliste

### ⏰ TERMINIERT — bei jeder Session prüfen, ob fällig
- **Ab 03.08.2026: KfW-308-Konditionen aktualisieren** (laut kfw.de werden die
  Förderhöchstbeträge angehoben; Sanierungsziel EH 85 EE dann auch per Einzelmaßnahmen
  erfüllbar). Zu ändern: `lib/kauf/foerderung.ts` (`kfw308Betrag()`, `bedingung`/`hinweis`
  von kfw308, `KFW_STAND`), `docs/kauf/KfW-Foerderung-2026.md`, Tests in
  `tests/foerderung.test.ts`. Neue Beträge vorher auf der KfW-308-Produktseite nachlesen.
  Danach diesen Eintrag entfernen.
- **Ab 01.01.2027: Ratgeber-Artikel zur Fernablesepflicht entschärfen.** Der Artikel
  `heizkostenabrechnung-50-70-regel-fernablesung` in `lib/ratgeber.ts` wirbt mit der
  ablaufenden Frist **31.12.2026** (§ 5 HeizkostenV). Ab 2027 ist die Frist Vergangenheit:
  Titel/Beschreibung entschärfen („Frist zum 31.12.2026" raus), Abschnitt auf „Pflicht
  besteht seit 2027" umschreiben, die 3-%-Kürzungsrechte (§ 12 HeizkostenV) stehen lassen —
  die bleiben relevant. Danach diesen Eintrag entfernen.

### Kostet Geld (Paid-Plan/Abo nötig)
- **Bezahlsystem (Paddle, Merchant of Record) — GEBAUT, aber INAKTIV (24.07.2026).**
  Tabelle `abos` + `lib/plan.ts` (Tarif-/Feature-Matrix) + `lib/billing/paddle.ts` +
  Webhook `/api/billing/webhook` + Abo-Tab in den Einstellungen. Durchgesetzt wird erst mit
  Env `BILLING_ENFORCED=true`; ohne Paddle-Env ist alles ein No-op (Early Access bleibt).
  **Die Tarife sind auf der Website ausgeblendet** — Schalter `PREISE_SICHTBAR` in
  `lib/preise.ts` (steuert /preise, Preis-Teaser der Startseite, Menüpunkt, Sitemap,
  Abo-Tab-Links und die preisbezogenen FAQ-Antworten in einem).
  **Aktivierungs-Checkliste: `docs/BEZAHLSYSTEM.md`** (Reihenfolge: Vercel Pro → AGB/Widerruf
  anwaltlich → Paddle-Konto/Preise/Webhook → Env → Sandbox-Test → `BILLING_ENFORCED=true` +
  /preise-Early-Access-Banner raus → Feature-Gates in den Actions). Steuerhinweis: MoR =
  Paddle ist der Kunde (Reverse-Charge) → bei Kleinunternehmer-Frage berücksichtigen.
- **Leaked Password Protection (Supabase) — braucht Supabase PRO** (~25 $/Monat).
  Abgleich neuer/geänderter Passwörter gegen HaveIBeenPwned. Der Toggle ist auf dem
  Free-Plan zwar SICHTBAR (Authentication → Sign In / Providers → Email → „Password
  Security"), greift aber nicht: Am 29.07.2026 empirisch geprüft — eine Registrierung
  mit dem millionenfach geleakten „Password123!" ging trotz gesetztem Schalter durch.
  Wer das nur im Dashboard umlegt, hält den Schutz für aktiv, obwohl er es nicht ist.
  Der Supabase-Security-Advisor meldet den Punkt entsprechend dauerhaft als offen.
  Kostenloser Teilersatz: Mindest-Passwortlänge erhöhen (siehe „Sonstiges").
- **„Sign in with Apple" nachrüsten, sobald die App in den iOS App Store geht.** Apple verlangt
  das, sobald ein anderer Social-Login (Google) angeboten wird. Braucht Apple-Developer-Programm
  (99 $/Jahr), App-ID/Services-ID/Key + Provider-Config in Supabase. Aktuell reine Web-App → noch nicht nötig.
- **App-Icon für den iOS App Store:** Das schwarze Kachel-Logo `public/myimmo_logo_2048.png`
  (2048×2048, goldenes Haus + Wortmarke) beim App-Store-Launch als App-Icon einspielen. Ist NICHT
  die Dokument-Wortmarke (die bleibt für PDFs/Briefe) — das PNG ist nur das App-/Store-Icon.

### Open Banking / Konto-Anbindung — CODE FERTIG, inaktiv ohne Env (Stand geprüft 31.07.2026)
⚠️ Stand bis 31.07.2026 hier als „geplant" geführt — falsch. **Etappen 1–4 sind gebaut:**
Tabellen `bankverbindungen`/`bank_umsaetze`, `lib/banking/enableBanking.ts` (Bankenliste,
Autorisierung, Session, Kontodetails, Transaktionen), `/api/banking/callback`, Seite `/banking`,
Abgleich-Engine `lib/banking/abgleich.ts`, 90-Tage-Reauth als Frist in `lib/fristen.ts`.
**Offen: Anbietervertrag + AVV, Sandbox-Durchlauf — und es gibt KEINE Tests dafür**
(einziger größerer Bereich ohne Abdeckung). Entscheidungen aus der Planung (12.07.2026):
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
- **Voraussetzungen für Live**: Gewerbe ✅ (GewA 1 Stadt Bad Schwartau, bescheinigt 16.07.2026,
  Beginn 15.07.2026, Nebenerwerb; Tätigkeit: „Entwicklung und Bereitstellung von Software (SaaS)
  sowie damit verbundene digitale Dienstleistungen; webbasierte Anwendung zur Immobilienverwaltung
  für private Vermieter") + Anbietervertrag + AVV. Laufende Kosten je
  Konto/Monat → kostenpflichtiges **Add-on / Business-Tarif**.
- ~~**Bau-Etappen** (1) Tabellen (2) Enable-Banking-Flow (3) Abgleich-Engine (4) Reauth-Erinnerung~~
  ✅ alle vier im Code umgesetzt (31.07.2026 geprüft). Was fehlt, ist der erste echte Durchlauf
  gegen die Sandbox — plus Tests.
- **Enable-Banking-Auth**: registrierte „Application" (Sandbox) + selbst generiertes RSA-Schlüsselpaar
  (privater Key wird im Browser erzeugt, Dateiname = Application ID). API-Calls per JWT (RS256),
  Header `kid` = Application ID. **Benötigte Env (Vercel)**: `ENABLE_BANKING_APP_ID` +
  `ENABLE_BANKING_PRIVATE_KEY` (privater Schlüssel, wie DATA_ENCRYPTION_KEY behandeln — nie ins
  Repo/Logs). Redirect-URL bei der App-Registrierung: `<base>/api/banking/callback`.

### Sonstiges (kein Geld)
- **Mindest-Passwortlänge in Supabase auf 8 setzen** (kostenlos, auch auf Free) — **am 31.07.2026 erneut geprüft, „abc123" wird weiterhin angenommen:**
  Dashboard → Authentication → Sign In / Providers → Email → „Password Security" →
  Minimum password length. Die App verlangt seit 29.07.2026 durchgängig 8 Zeichen
  (`lib/passwort.ts`), Supabase steht noch auf **6** — am 29.07. und erneut am 31.07.2026
  empirisch geprüft: eine Registrierung mit „abc123" wurde beide Male angenommen
  (Testkonto jeweils sofort gelöscht). Solange das auseinanderläuft, greift
  nur die App-Prüfung; wer die Auth-API direkt anspricht, kommt mit 6 Zeichen durch.
  Nur im Dashboard setzbar, nicht über API/MCP. **Nach dem Umstellen prüfen**, ob
  bestehende Konten mit kürzerem Passwort sich weiterhin anmelden können (die Regel
  gilt für NEUE/geänderte Passwörter, nicht rückwirkend).
- **Komplette Design- & Layout-Überarbeitung der App (VORHABEN, vor dem Marketing-Start):**
  Gewählte Richtung: **Fintech-hell (Stripe/N26 + etwas Apple)** mit **echter Neu-Anordnung**
  der Layouts (nicht nur Umfärben). Gold `#D4A847` bleibt das Markenzeichen, Fraunces+Outfit
  bleiben. Betrifft die App-UI (`app/globals.css` + Komponenten); das Dokument-/PDF-Design
  (siehe „Dokument-/PDF-Design") bleibt unverändert. Verworfen: „Quiet-Luxury"-Ivory, Neon-Bento.
  Sinnvolle Reihenfolge: Redesign VOR großem Marketing (Screenshots/Store-Assets/Ratgeber-Bilder
  sonst doppelt).
- ~~**Onboarding-Guide für neue Nutzer**~~ ✅ **ERLEDIGT** (Stand geprüft 31.07.2026):
  `components/OnboardingTour.tsx` — sechs Stationen (Objekt → Mieter → Ein-/Ausgaben →
  Mietkonto → Archiv → Steuer/Assistenten) mit Direktlinks. Öffnet sich automatisch,
  solange kein Objekt existiert und die Tour nie beendet wurde (`neuerNutzer` aus der
  Objektzahl im Root-Layout), ist überspringbar, merkt den Fortschritt und lässt sich über
  Einstellungen → „Einführungs-Tour" per Event neu starten. Der Eintrag stand hier zu lange
  als Vorhaben und hat zu einer Fehleinschätzung geführt.
- **Abo-Zugangscode (mit Bezahlsystem umsetzen):** Nach Abschluss/Bezahlung eines Abos erhält
  der Kunde einen individuellen Zugangscode (per E-Mail oder direkt in der App). Der Code ist
  abo-/rollenspezifisch (z. B. gilt ein Hausverwaltungs-Code nur für die Hausverwaltungs-
  Registrierung) und wird nur bei der ERST-Registrierung benötigt — danach normaler Login.
  Fundament existiert: Tabelle `einladungscodes` (rollen-gebunden, Ablauf, Einmal-Einlösung)
  + Signup-Trigger `handle_new_user_rolle` lassen sich um Abo-Codes erweitern.
- **AVV-Verträge (Art. 28 DSGVO)** — Recherche 15.07.2026 (Details: `docs/MASTERPLAN.md` + AVV-Dossier-PDF):
  Supabase = Dashboard→Org→Documents (PandaDoc, kostenlos, auch Free-Plan); Vercel = automatisch
  in ToS ab Pro-Plan → ✅ **erledigt (29.07.2026: Konto ist auf Pro)**; Anthropic = automatisch mit Commercial Terms wirksam (kein Training auf
  API-Daten, Kopie archivieren); Google = **kein AVV nötig** (OAuth-Login → eigenständig
  Verantwortlicher, nur Datenschutzerklärungs-Passus). **Größte Lücke: MyImmo muss den eigenen
  Nutzern einen AVV anbieten** (Vermieter = Verantwortliche für Mieterdaten) — /avv-Seite, AGB-
  Einbeziehung, anwaltlich prüfen. Plus Verarbeitungsverzeichnis Art. 30 Abs. 1+2 und TOM-Doku.
- **Businessplan (aktuell, als PDF): `docs/business/MyImmo-Businessplan-2026-07.pdf`.** NICHT von
  Hand neu bauen — der komplette Plan wird per Skript erzeugt: **`node scripts/gen-businessplan-pdf.mjs`**
  (Sekunden). Inhalt/Zahlen/„Stand"-Datum nur in der `SECTIONS`-Struktur des Skripts anpassen, dann
  neu erzeugen. Titelseite trägt die Dokument-Wortmarke (My+Immo), Design = MyImmo-Dokument-Stil.
- **Masterplan (Markt/Compliance/Steuer-Features/Roadmap): `docs/MASTERPLAN.md`** (15.07.2026).
- **Onboarding-Briefing (aktuell, für neue Chats/Sessions ZUERST lesen): `docs/BRIEFING.md`**.
- **Obsidian-Vault:** der Ordner `docs/` ist als Obsidian-Vault gedacht (Startseite `docs/00 Index.md`
  mit `[[Verlinkungen]]`). Nutzer öffnet `docs/` als Vault, `git pull` hält ihn aktuell.
- **Finanzkonzept: `docs/FINANZKONZEPT.md`** (Geschäftsmodell/Monetarisierung **und** Finanzierungs-
  Assistent). **REGEL: Bei jeder Änderung am Finanzkonzept/Geschäftsmodell diese Datei im selben PR
  mitaktualisieren.** Ebenso `docs/BRIEFING.md` bei größeren Stand-Änderungen aktuell halten.
- **Projekt-Status / Feature-Inventar: `docs/PROJEKT-STATUS.md`** — am **31.07.2026 vollständig
  gegen Code, Datenbank und Live-Seite geprüft**. Enthält Kennzahlen, was fertig ist, was gebaut
  aber inaktiv, was nur der Betreiber erledigen kann, und einen Abschnitt „was nicht verifizierbar
  war". **Vor jeder Aussage „das fehlt noch" dort nachsehen** — mehrere Punkte standen monatelang
  als offen, obwohl sie längst gebaut waren.
- **AVV-Abschlussstand: `docs/compliance/AVV-STATUS.md`** (Checkliste je Anbieter). Erledigt
  15.07.2026: **Anthropic-DPA archiviert** (`docs/compliance/anthropic-dpa-archiv.md`) + DPF
  geprüft → Anthropic nutzt **SCCs, kein DPF** (Transfer in Datenschutzerklärung als SCC ausweisen).
  ✅ 24.07.2026: **Supabase-DPA signiert** (PandaDoc; PDF + TIA in `docs/compliance/`).
  ⏳ **OFFEN — Brevo-AVV (Recherche 31.07.2026, Schritte stehen fest):** Bei Brevo ist der AVV
  **Anlage 2 („Annex 2 — Data Processing Agreement") zu den Nutzungsbedingungen** und gilt
  automatisch mit Vertragsschluss — in der Regel **keine gesonderte Unterschrift** (Muster wie
  Vercel/Anthropic, NICHT wie Supabase). Zu tun: (1) Konto → Kontoname oben rechts →
  Einstellungen → **Rechtsdokumente** prüfen, ob dort doch eine signierbare Fassung liegt;
  (2) **Firmendaten im Konto** auf die Gewerbeanmeldung bringen (MyImmo, Einzelunternehmen,
  Bad Schwartau) — sonst lautet der Vertrag auf die falsche Partei; (3) DPA-PDF mit Version und
  Abrufdatum archivieren (`docs/compliance/brevo-dpa-archiv.md`, Muster: Anthropic-Archiv);
  (4) Unterauftragsverarbeiter-Liste prüfen, Benachrichtigungsadresse muss gelesen werden
  (Widerspruchsrecht); (5) Transfer in der Datenschutzerklärung als **SCC** ausweisen (kein DPF);
  (6) Datenschutzkontakt **dpo@brevo.com** ins Verarbeitungsverzeichnis; (7) Eintrag in
  `docs/compliance/AVV-STATUS.md` (Sitz Frankreich, Verarbeitung EU).
  ⏳ **OFFEN — Datenschutzerklärung um den Vorlagen-Verteiler ergänzen:** Zweck, Rechtsgrundlage
  Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Empfänger Brevo, Speicherdauer, Widerrufsrecht.
  Ohne den Passus werden die Adressen ohne die vorgeschriebene Information verarbeitet.
  ✅ 29.07.2026: **Vercel auf Pro** → AVV greift automatisch über die ToS, kommerzielle
  Nutzung erlaubt. Noch offen (nur Betreiber): Nutzer-AVV anwaltlich prüfen. Anwaltsliste zusätzlich (19.07.2026):
  **§ 34i GewO** (Finanzierungs-Assistent Stufe 1 — Wording bereits neutralisiert, „Empfehlung"
  entfernt) und **StBerG § 1–5** (Anlage-V-Berechnung + § 82b-Optimierer + DATEV-Export —
  Grenze zur unerlaubten Steuerberatung schriftlich freigeben lassen).
- **Impressum/Datenschutz**: ✅ Abgleich mit der Gewerbeanmeldung erledigt (24.07.2026, GewA-1-
  Scan geprüft): Geschäftsbezeichnung „MyImmo", Inhaber, Anschrift, Telefon, E-Mail und
  „Einzelunternehmen, nicht im Handelsregister" stimmen 1:1. Noch offen (Betreiber): beide
  Seiten anwaltlich prüfen lassen. Hinweis: Die angemeldete Tätigkeit (SaaS/digitale
  Dienstleistungen) deckt KEINE Darlehensvermittlung — passt zur § 34i-freien Ausrichtung des
  Finanzierungs-Assistenten (nur rechnen/informieren).
  ✅ Vercel-Plan geklärt (29.07.2026): **Pro** — kommerzielle Nutzung erlaubt, AVV über die ToS.
- ~~**Optional (Härtung):** Spalten-Verschlüsselung für IBAN/Bankdaten.~~ ✅ Erledigt:
  App-Layer-Verschlüsselung (AES-256-GCM) für `ibans.iban`/`ibans.inhaber`, Schlüssel als
  Vercel-Env `DATA_ENCRYPTION_KEY` (NICHT in der DB → echter Schutz gegen DB-Leak/Insider).
  Blind-Index (`iban_bidx`) für Dublettenprüfung. `lib/crypto/secure.ts`. ✅ Auch erledigt
  (18.07.2026): `kredite.darlnr` + `mieter.kaution_bank` verschlüsselt (`lib/kreditData.ts`,
  Migration in `/api/encrypt-bankdaten` erweitert). Nach Deploy einmalig `/api/encrypt-bankdaten`
  aufrufen (migriert IBANs + Darlehensnummern + Kautions-Bank in einem Rutsch).

## Dokument-/PDF-Design (verbindlich)
- **Alle selbst erzeugten MyImmo-PDFs/Dokumente** (Verträge, Compliance-Ablagen, Deckblätter etc.)
  im **App-Dokument-Stil** setzen — wie die in-App-Generatoren (`lib/pdf/docPdf.ts`,
  `beleihungPdf.ts`, `nkPdf.ts`): heller DIN-A4-Geschäftsbrief, Briefkopf links `My`(Times)+`Immo`
  (Times-Italic, Gold `rgb(0.722,0.565,0.169)`) + „PRIVATES IMMOBILIEN-MANAGEMENT", Absenderblock
  rechts, goldener Trennstrich, goldene Abschnitts-Überschriften, dezente Creme-Hinweiskästen,
  Fußzeile „MyImmo / Seite x von n". **KEINE** Creme-/Vollflächen-Deckblätter im Magazin-Stil.
- **Verbindliche Detailregeln (vom Nutzer, „für alle Dokumente von MyImmo"):**
  1. **Goldener Trennstrich im Briefkopf mittig** — der kurze vertikale Goldstrich sitzt exakt
     auf der Blattmitte (`x = A4.w / 2`), NICHT nach links versetzt.
  2. **Großzügiger Zeilenabstand** — Fließtext mit `LH ≈ 15` und Absatzabstand `GAP ≈ 9`
     (nicht enger), damit die Seiten luftig/lesbar bleiben.
  3. **Deckblatt vorhanden** — jedes mehrseitige Dokument beginnt mit einer eigenen Titelseite
     im Dokument-Stil (voller Briefkopf, zentrierter Titel, kurzer Gold-Zierstrich,
     ggf. Parteien-Block + Entwurfs-/Status-Hinweis als Creme-Kasten), erst danach der Inhalt.
- Wiederverwendbare Vorlagen (pdf-lib, spiegeln den docPdf-Briefkopf; enthalten bereits mittigen
  Trennstrich, Deckblatt und den größeren Zeilenabstand als Referenz): `scripts/gen-avv-pdf.mjs`
  (Vertrag/Deckblatt) und `scripts/gen-businessplan-pdf.mjs` (mehrseitiges Dokument mit Titelseite,
  Inhaltsverzeichnis + Seitenzahlen, gold-Header-Tabellen, Creme-Kästen).
- Fremde Dokumente (z. B. Anthropic-DPA) dürfen deren Branding behalten.

## Deployment
- **Live-URL (Produktion): https://www.myimmoapp.de** (eigene Domain; Apex leitet auf www um.
  `my-immo-app.vercel.app` existiert nur noch als Vercel-Fallback — nirgends mehr verlinken;
  Sitemap/Robots/metadataBase zeigen auf www.myimmoapp.de).
- Gehostet auf **Vercel**, verbunden mit dem GitHub-Repo `jxnashap/myimmo-app` (Branch `main`).
- Ein Merge nach `main` löst automatisch einen neuen Vercel-Build/Deploy aus.
- **Wichtig:** Nach jedem Merge eines PR die Live-URL mitschicken/erwähnen, damit der Stand direkt geprüft werden kann.

### Benötigte Environment-Variablen (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BETA_CODE` — **der Zugangscode für die Registrierung als Vermieter/Hausverwaltung**
  (Early Access). Steht NUR in Vercel, nirgends im Repo. Nachsehen und ändern:
  Vercel → Projekt → Settings → Environment Variables → `BETA_CODE`; nach dem Ändern
  ist ein **Redeploy nötig**, sonst gilt weiter der alte Wert. Geprüft wird serverseitig
  in `lib/actions/freischaltung.ts` (`pruefeBetaCode`), mit Bremse: 8 Versuche je 15 Minuten
  und IP. Ist die Variable nicht gesetzt, schlägt JEDE Registrierung mit
  „Die Registrierung ist derzeit nicht freigeschaltet" fehl.
  ⚠️ Der Code kennt noch einen Rückfall auf `NEXT_PUBLIC_BETA_CODE` — diese Variante
  **niemals setzen**: Alles mit `NEXT_PUBLIC_`-Präfix landet im ausgelieferten JavaScript,
  der Code stünde dann für jeden im Quelltext. Am 27.08.2026 geprüft: In den 10 Bundles
  der Login-Seite (629 KB) taucht kein Beta-Code auf, die Variante ist also nicht gesetzt.
  NICHT zu verwechseln mit den **Einladungscodes** für Mieter/Dienstleister
  (`MI-XXXX-XXXX` / `SV-XXXX-XXXX`) — die stehen in der Tabelle `einladungscodes`,
  werden vom Vermieter in der App erzeugt und per RPC `einladungscode_pruefen` geprüft.
- `ANTHROPIC_API_KEY` — für OCR / KI-Import (NK-Abrechnung auslesen, Objekt-Import)
- `BREVO_API_KEY` + `BREVO_ABSENDER_EMAIL` — E-Mail-Versand (Vorlagen-Verteiler, Double-Opt-in).
  Optional `BREVO_ABSENDER_NAME` (Default „MyImmo") und `BREVO_LIST_ID` (ohne sie wird der
  bestätigte Kontakt zwar angelegt, aber in keine Liste einsortiert). Fehlt eine der beiden
  Pflicht-Env, antwortet `/api/newsletter` mit 503 statt einen Versand vorzutäuschen.
  Absenderadresse muss in Brevo verifiziert sein (SPF/DKIM für myimmoapp.de setzen).
  **AVV mit Brevo im Konto abschließen** (Sitz Frankreich, EU-Verarbeitung) und in
  `docs/compliance/AVV-STATUS.md` nachtragen.
- `DATA_ENCRYPTION_KEY` — 32 Byte base64 (`openssl rand -base64 32`) für die App-Layer-
  Verschlüsselung der Bankdaten (IBAN/Inhaber, `lib/crypto/secure.ts`). **Schlüsselverlust =
  Bankdaten unwiederbringlich weg** → sicher sichern (Passwortmanager), nie ins Repo/Logs.

#### Für den Auto-Wert-Refresh (Cron, `/api/cron/wert-refresh`)
- `CRON_SECRET` — beliebiges Geheimnis; schützt die Route. **Identisch** als GitHub-Repo-Secret
  hinterlegen (Settings → Secrets and variables → Actions), damit die Action `.github/workflows/
  wert-refresh.yml` die Route aufrufen darf.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Service-Role-Key (Dashboard → Project Settings → API).
  Nur serverseitig (`lib/supabase/admin.ts`), umgeht RLS → NIE in den Client/ins Repo/Logs.
- `OWNER_USER_ID` — optional. Gesetzt = nur DIESES Konto wird aktualisiert (MVP „dein Portfolio");
  weggelassen = alle Nutzer (mandantenweit). Deine `auth.users`-ID aus Supabase.
- Optional BORIS (Bodenrichtwert im Cron): `VALUATION_BORIS_ENABLED=true` + `BORIS_ENDPOINT_URL`
  (JSON-Endpunkt, der `{lat}`/`{lng}` akzeptiert und `{brw, stichtag?}` liefert). Ohne diese Env
  läuft der Cron trotzdem (nur Geocoding + Index); BRW bleibt dann leer/manuell.

### KI über AWS Frankfurt (Bedrock) statt Anthropic-USA — optional, für den AVV
Werden ALLE folgenden Env gesetzt, laufen OCR/KI-Import über **Amazon Bedrock in
eu-central-1 (AWS Frankfurt)** statt über die US-API — Verarbeitung bleibt in der EU
(kein Drittland-Transfer, AVV/DPA über AWS). Fehlt eine, läuft automatisch der direkte
Anthropic-Call (`ANTHROPIC_API_KEY`). Umschaltung in `lib/aiRoute.ts` → `lib/bedrock.ts`.
- `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY` — IAM-User mit Policy `bedrock:InvokeModel`.
- `BEDROCK_MODEL_ID` — Bedrock-/Inference-Profile-ID, z. B. `eu.anthropic.claude-sonnet-4-...-v1:0`
  (exakte ID in der Bedrock-Konsole → „Model catalog" der Region ablesen; EU nutzt `eu.`-Profile).
- `BEDROCK_REGION` — optional, Default `eu-central-1`. `BEDROCK_SESSION_TOKEN` — nur bei STS.
- **AWS-Setup**: Konto anlegen → Bedrock-Konsole in Frankfurt → „Model access" für das
  Claude-Modell anfordern (Freischaltung dauert teils Minuten) → IAM-User mit `bedrock:InvokeModel`
  → Keys als Vercel-Env. SigV4-Signierung ist gegen den AWS-Testvektor geprüft (`tests/bedrock.test.ts`),
  der echte End-to-End-Call ist aber erst nach dem AWS-Setup verifizierbar.

## Datenbank
- Supabase-Projekt `kozhxrvyilkchjpcuwcm` (Region eu-central-1).
- **Migrations-Regel (19.07.2026):** Jede Schemaänderung via `apply_migration` UND als Datei
  `supabase/migrations/<version>_<name>.sql` im selben PR committen (Regeln + Historie-Index:
  `supabase/migrations/README.md`). Kein DDL über `execute_sql`.
- Dateien (Belege, Archiv-Dokumente) werden als Base64 in Tabellenspalten gespeichert — **kein Storage-Bucket** nötig.

## Build / Test
- `npm run build` zum Verifizieren (braucht die NEXT_PUBLIC_SUPABASE_*-Variablen, Platzhalter genügen für den Build).
