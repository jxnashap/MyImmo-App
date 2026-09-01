# MyImmo — Projektnotizen

## Arbeitsweise / Feedback-Stil (vom Nutzer gewünscht)
- Sei ein ehrlicher Sparring-Partner — kritisch, finde Schwachstellen und blinde Flecken.
- Nicht einfach zustimmen — erst prüfen, ob es stimmt.
- Die Wahrheit sagen, auch wenn sie unbequem ist; ruhig direkt, ohne Schönfärberei.
- Keine Floskeln („Großartige Frage!", „Du hast absolut recht!").
- Bei jeder Entscheidung des Nutzers zuerst die Risiken nennen, bevor zugestimmt wird.


## Offene Punkte / Merkliste

### ⏰ TERMINIERT — bei jeder Session prüfen, ob fällig
- ~~**Ab 03.08.2026: KfW-308-Konditionen aktualisieren**~~ ✅ **erledigt 28.08.2026**
  (gegen die KfW-308-Produktseite geprüft): Höchstbeträge **140.000 / 160.000 / 180.000 €**
  (1 / 2 / 3+ Kinder, vorher 100/125/150 Tsd.), Sanierungsziel EH 85 EE bzw. Denkmal EE
  jetzt auch über **kombinierte Einzelmaßnahmen** (Heizung ≥ 65 % EE, Fenster, Fassade, Dach)
  erfüllbar; Einkommensgrenze unverändert. `KFW_STAND = "08/2026"`.
  **Regel für künftige Fälle:** Konditionen nicht raten und nicht auf Zulieferung warten —
  die Produktseite per WebFetch lesen und mit einer zweiten Quelle gegenprüfen.
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

### Open Banking / Konto-Anbindung — ZURÜCKGESTELLT (29.08.2026)
Das Feature war fertig gebaut, aber nie live (nie end-to-end gelaufen) und verursacht im
echten Betrieb laufende Kosten je Konto/Monat. **Am 29.08.2026 komplett aus der App entfernt**
und als Zukunftsprojekt gesichert: **`docs/zukunft/OPEN-BANKING.md`** (Konzept, Entscheidungen,
Env, Wiederherstellungsweg). Der vollständige Code liegt in der Git-Historie bis Commit `85feb98`;
die DB-Tabellen (`bankverbindungen`, `bank_umsaetze`, `bank_auth_anfragen`) und `abos.banking_addon`
wurden per Migration `20260829120000` gedroppt. Wieder aufbauen, sobald das Produkt Geld verdient
(dann als bezahltes Add-on über einen lizenzierten AISP wie Enable Banking).

### Registrierung — Ablauf (Stand 31.08.2026)
1. E-Mail, Passwort (2×), **Zugangscode**, Zustimmung → der Code wird serverseitig geprüft
   UND die Freischaltung vorgemerkt (`bereiteRegistrierungVor`, Tabelle
   `registrierung_freigaben`, 14 Tage gültig).
2. Bestätigungsmail anklicken.
3. Einmal mit E-Mail + Passwort anmelden → das Layout-Gate löst die Vormerkung per
   `freischaltung_nachholen()` ein. **Der Code wird NICHT erneut abgefragt.**

`/willkommen` bleibt als Rückfallweg: Google-Registrierung (dort gibt es keinen Code-Schritt),
Mieter/Handwerker mit Einladungscode, abgelaufene oder fehlende Vormerkung.
**Zwei Fehler, die dort steckten** (gemeldet 31.08.2026) — nicht wieder einbauen:
- Das Gate schrieb den Code vor der Prüfung in **Großbuchstaben**. Der Beta-Code enthält
  Klein-/Großbuchstaben, Ziffern und Sonderzeichen, der Vergleich ist exakt → derselbe Code,
  der bei der Registrierung ging, war hier zwangsläufig falsch. Großschreibung gilt **nur**
  für Einladungscodes (Format `MI-XXXX-XXXX`).
- Bei der Registrierung wurde der Code nur geprüft, nie gespeichert → das Gate fragte
  überhaupt erst ein zweites Mal.
**Nicht über `signUp`-Metadaten lösen:** `raw_user_meta_data` kommt vom Client und ist frei
setzbar — ein Trigger, der darauf vertraut, wäre eine Hintertür am Zugangscode vorbei.

### Zukunftsideen (notiert, nicht gebaut)
- **Englische Fassung / Auslandsmarkt — BEWUSST ZURÜCKGESTELLT (01.09.2026).**
  Frage des Nutzers: zwei Websites, eine deutsch, eine englisch (auf `myimmoapp.com`).
  **Entscheidung: nein, `.de` bleibt vorerst allein; `.com` bleibt Weiterleitung.**
  Erst wenn der deutsche Markt Geld einbringt, wird über Expansion entschieden.
  **`myimmoapp.com` deshalb NICHT auslaufen lassen** — die Domain trägt den eigenen
  Markennamen und ist bis dahin indexiert; ein Rückkauf beim Expandieren kostet ein
  Vielfaches der Verlängerungsgebühr.
  **Warum nicht jetzt** (Analyse vom 01.09.2026): MyImmo ist keine deutschsprachige
  Software, sondern deutsches Recht in Softwareform (Anlage V, § 558a BGB, BetrKV,
  HeizkostenV, Mietspiegel, Grundsteuer, § 82b EStDV, DATEV, KfW). Eine Übersetzung
  öffnet keinen neuen Markt, nur denselben Markt für Expats in Deutschland. Die
  erzeugten Dokumente müssten ohnehin deutsch bleiben (Formzwang, Empfänger sind
  deutsche Mieter), ebenso Impressum/AGB/Datenschutz. Aufwand: 374 Dateien,
  ~48.400 Zeilen mit **fest im Code stehenden** deutschen Texten (keinerlei i18n,
  kein next-intl), 8 PDF-Generatoren, ~106 KB Ratgeber-Text → aus 19 Artikeln würden
  38, die alle auf Rechtsstand zu halten wären.
  **Wenn doch, dann in dieser Reihenfolge:** (1) nur die Marketing-Oberfläche unter
  `www.myimmoapp.de/en/` + `hreflang`, App und Ratgeber bleiben deutsch → in der
  Search Console messen, ob englische Nachfrage überhaupt existiert; (2) erst danach
  App-i18n, und zwar mit Sprachdateien statt Textkopien.
  **Wichtig für die spätere Entscheidung:** Eine reine SPRACHversion gehört ins
  Unterverzeichnis derselben Domain (eine Domain, eine Autorität). Eine eigene Domain
  lohnt erst, wenn ein Land ein eigenes PRODUKT bekommt (z. B. österreichisches
  Mietrecht) — nicht für eine übersetzte Oberfläche.
- **Strategie-Reiter: regelmäßig Immobilien erwerben** (Idee des Nutzers, 30.08.2026).
  Konzept, Risiken und Fahrplan: **`docs/zukunft/STRATEGIE-REITER.md`**.
  Kurz: Ein eigener Bereich, in dem der Vermieter seine Ankaufsstrategie führt — wann ist das
  nächste Objekt finanzierbar, was fehlt bis dahin. Die Daten liegen fast alle schon vor
  (Cashflow, Kredite/Restschuld, Objektwerte, Beleihung, Selbstauskunft, Kaufnebenkosten).
  **Größtes Risiko: die Grenze zur Anlageberatung.** „Im März 2028 kannst du kaufen" ist eine
  Empfehlung zu einer Vermögensdisposition — § 34i GewO steht ohnehin auf der Anwaltsliste,
  dieser Punkt gehört dort mit hinein, VOR dem Bau. Zweites Risiko: Zehnjahresprognosen sind
  Scheingenauigkeit (Zins, Miete, Wert, Instandhaltung) → Szenarien statt einer Zahl.
  Vor dem Bau außerdem klären: kostenlos oder Tarifmerkmal (dann `docs/FINANZKONZEPT.md`
  im selben PR mitziehen).

### Sonstiges (kein Geld)
- **Demo-Konto ist seit 30.08.2026 NUR-LESEN.** Vorgabe des Betreibers: Schaustück, kein
  Sandkasten. Drei Ebenen, alle drei nötig (Begründung in `lib/demo.ts`):
  (1) **Datenbank** — restriktive RLS-Policies verweigern dem Demo-Konto jedes
  INSERT/UPDATE/DELETE (Migration `20260830150000_demo_nur_lesen.sql`, Funktion
  `public.ist_demo_nutzer()`). (2) **Routen** — `demoDarfRoute` sperrt NK-Rechner,
  Protokoll, alle Bearbeiten-Formulare und **alle API-Routen außer `/api/demo`**;
  die Middleware weist jetzt jede Methode ab, nicht nur GET. (3) **Oberfläche** —
  `components/DemoNurLesen.tsx` macht Felder schreibgeschützt und Speichern-Knöpfe inaktiv.
  **Warum Ebene 3 trotz Ebene 1 nötig ist:** Ein per RLS blockiertes UPDATE/DELETE wirft
  KEINEN Fehler, es trifft null Zeilen — der Besucher hielte Ungespeichertes für gespeichert.
  **Einzige Ausnahme:** das Mieterhöhungs-Dokument samt PDF (`data-demo-erlaubt` im
  `DocGenerator`) — gespeichert wird dabei nichts.
  **Beim Anlegen einer neuen Tabelle** greifen die Policies NICHT automatisch; die Migration
  dann erneut ausführen (sie ist idempotent).
- **ZURÜCKGESTELLT (30.08.2026, Entscheidung des Nutzers): Namentliche Autorenschaft der
  Ratgeber.** Im Article-Markup steht derzeit `author: Organization "MyImmo"` — bei
  Steuer- und Mietrechtsthemen (YMYL) das schwächste denkbare Vertrauenssignal und die
  größte verbliebene E-E-A-T-Lücke (Details: `docs/SEO.md`, Punkt 5).
  Umsetzung wäre: sichtbare Autorenzeile · `author: Person` mit Verweis auf eine
  Autorenseite · Autorenseite mit `ProfilePage`-Markup (wer, warum qualifiziert, seit wann,
  erreichbar). Qualifikation hier nicht akademisch, sondern praktisch: selbst Vermieter,
  hat die Software für den eigenen Bedarf gebaut.
  **Vor der Umsetzung zwingend zu klären — nicht überspringen:** Wer die Artikel
  namentlich zeichnet, behauptet, sie geschrieben oder inhaltlich verantwortet zu haben.
  Die 19 Ratgeber sind KI-gestützt entstanden. Solange nicht geklärt ist, dass der Namens-
  geber sie fachlich geprüft hat, ist die Zeile eine Falschangabe — ausgerechnet dort, wo
  Vertrauen der ganze Zweck ist. Ehrlicher Mittelweg, falls das zu weit geht:
  „Fachlich geprüft von …" statt „Von …".
  Weitere Risiken: Name dauerhaft öffentlich und indexiert unter Steueraussagen (die
  Anschrift steht als Einzelunternehmer ohnehin im Impressum, die Zusatzpreisgabe ist also
  kleiner als sie wirkt); namentliche Zeichnung liest sich näher an Beratung → läuft auf
  der StBerG-Anwaltsliste mit. Und: E-E-A-T ist kein schaltbares Ranking-Signal, das hier
  beseitigt eine bekannte Schwäche, es garantiert keine Platzierung.
- ~~**Mindest-Passwortlänge in Supabase auf 8 setzen**~~ ✅ **erledigt 30.08.2026** (vom Nutzer
  im Dashboard umgestellt). App und Supabase verlangen jetzt beide 8 Zeichen; vorher griff nur
  die App-Prüfung (`lib/passwort.ts`), wer die Auth-API direkt ansprach, kam mit 6 durch.
  **Noch offen (nur Betreiber, kleine Sache):** stichprobenhaft prüfen, ob sich ein bestehendes
  Konto mit kürzerem Passwort weiterhin anmelden kann — die Regel gilt für NEUE/geänderte
  Passwörter, nicht rückwirkend.
- **Design- & Layout-Überarbeitung der App — Runde 1 UMGESETZT (20.08.2026):**
  Neues App-Design **„Frosted Paper"** (shadcn/ui-artig monochrom-hell: Canvas `#f5f5f5`,
  weiße 24px-Karten auf Haarlinien `#e5e5e5`, Pillen-Radius 18px für alles Interaktive,
  Geist als UI-Schrift — selbst gehostet, SIL OFL, `public/fonts/geist-variable.woff2`).
  **Gold `#D4A847` bleibt als schmaler Markenakzent** (Primärknopf `--gold-fill`, Logo,
  aktive Zustände; Textstufe hell = `--gold` #9a7b24 wegen Kontrast). Rot nur destruktiv.
  Hell ist jetzt DEFAULT, Dunkelmodus = achromatische Umkehrung über `[data-theme="dark"]`
  (Logik gedreht — vorher war Dunkel Default). Die Landing ist per Token-Freeze im
  `.lp`-Scope auf ihrer Quiet-Luxury-Palette eingefroren; PDFs/Briefe unverändert.
  **Noch offen (Runde 2):** echte Neu-Anordnung einzelner Layouts (bisher v. a. Um-Tokenisierung),
  11px-Kleinsttexte sukzessive auf 12px, Binnennavigation für lange Mobilseiten.
  (Die Chart-Gradients im Cashflow-Donut sind seit dem UX-Audit-Paket B abgelöst.)
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
  🟨 **Brevo-AVV — am 30.08.2026 zur Hälfte erledigt.** Der DPA ist gelesen, ausgewertet und
  archiviert: `docs/compliance/brevo-dpa-archiv.md` + Volltext `brevo-dpa-2024-05-15.pdf`.
  Bestätigt: Er ist **Anlage 2 zu den Nutzungsbedingungen und gilt ohne Unterschrift** — das war
  vorher eine Vermutung, jetzt steht es wörtlich belegt da („execution of the General Terms and
  Conditions and the DPA constitutes execution"). Vertragspartner **Sendinblue SAS**, Paris;
  DPO **dpo@brevo.com**; SCCs Module Two, Recht Frankreichs, Gerichtsstand Paris; Datenpanne
  **72 h**; Löschung erst **100 Tage** nach Vertragsende; Unterauftragsverarbeiter-Änderungen
  **10 Werktage** vorher mit Widerspruchsrecht.
  **Dabei gefunden und korrigiert:** Die Datenschutzerklärung behauptete pauschal „Verarbeitung
  in der EU". Das stimmt für die Versanddaten, nicht für Brevos eigene Unterauftragsverarbeiter —
  Datadog protokolliert in den **USA**, Zendesk und Convrrt ebenfalls, Support und Wartung laufen
  über **Indien**. `/datenschutz` Ziffern 3 g, 4 und 5 entsprechend präzisiert.
  **Rest, nur im eingeloggten Brevo-Konto (Betreiber):** (1) Kontoname → Einstellungen →
  Rechtsdokumente: liegt dort eine neuere oder signierbare Fassung als 15.05.2024? (2) Firmendaten
  auf die Gewerbeanmeldung bringen (MyImmo, Einzelunternehmen, Bad Schwartau) — sonst lautet der
  Vertrag auf die falsche Partei. (3) Prüfen, an welche Adresse die Unterauftragsverarbeiter-
  Ankündigungen gehen; die 10-Werktage-Frist verfällt ungelesen.
  ✅ 28.08.2026: **Datenschutzerklärung um den Vorlagen-Verteiler ergänzt** — `/datenschutz`
  Ziffer 3 h (Double-Opt-in, Einwilligungsnachweis mit Zeitpunkt/IP/Wortlaut, Art. 6 Abs. 1
  lit. a + Art. 7 Abs. 1, Empfänger Brevo, Speicherdauer, Widerruf) + Brevo in der
  Subprozessoren-Liste (Ziffer 4). Der **AVV mit Brevo** bleibt offen (Punkte (1)–(4), (6), (7) oben).
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
  **Das Vercel-Projekt beantwortet aber MEHRERE Domains: `myimmoapp.store` UND `myimmoapp.com`
  lieferten bis 01.09.2026 dieselbe App aus (200)** — Google zeigte MyImmo daraufhin unter
  `.store`. Seit 01.09.2026 leiten beide dauerhaft auf `.de` (`next.config.mjs`, Liste
  `NEBENDOMAINS`, host-basierter Redirect mit Pfad-Erhalt). Das korrekte Canonical auf `.de`
  allein hatte NICHT gereicht: Canonical ist ein Hinweis, keine Anweisung.
  **Regel:** Kommt eine weitere Domain ins Vercel-Projekt, gehoert sie in `NEBENDOMAINS` —
  sonst liefert sie stillschweigend Duplikate aus.
  **Stand 01.09.2026 abends, live gemessen — ABGESCHLOSSEN, nicht weiter daran drehen:**
  `myimmoapp.store` leitet inzwischen auf **Vercel-Ebene** direkt auf `.de` um (Settings →
  Domains → Redirect). Bei `.com` läuft die Kette `myimmoapp.com` → 308 → `www.myimmoapp.com`
  → 308 → `.de`, wobei der letzte Schritt weiter über die **Code-Regel** geht. Das ist
  BEWUSST so belassen: Für Google ist die Sache erledigt (beide `.com`-Adressen enden
  permanent auf `.de`, zwei Hops sind unkritisch), der einzige Gewinn eines weiteren
  Umbaus wäre eine eingesparte Serverless-Ausführung auf einer Domain ohne Verkehr — dem
  steht das Risiko gegenüber, an einer laufenden Domain-Konfiguration weiterzuschrauben
  (beim Versuch wurde bereits der falsche von zwei `.com`-Einträgen erwischt).
  → **`NEBENDOMAINS` in `next.config.mjs` bleibt drin** und ist kein toter Code.
  **Noch offen (nur Betreiber):** in der Search Console die **Adressänderung** anstossen;
  der Indexwechsel dauert sonst Wochen.
  `my-immo-app.vercel.app` existiert nur noch als Vercel-Fallback — nirgends mehr verlinken;
  Sitemap/Robots/metadataBase zeigen auf www.myimmoapp.de).
- Gehostet auf **Vercel**, verbunden mit dem GitHub-Repo `jxnashap/myimmo-app` (Branch `main`).
- Ein Merge nach `main` löst automatisch einen neuen Vercel-Build/Deploy aus.
- **Wichtig:** Nach jedem Merge eines PR die Live-URL mitschicken/erwähnen, damit der Stand direkt geprüft werden kann.

### Benötigte Environment-Variablen (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
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

## Sicherheit der Abhängigkeiten
- ✅ **Next-15-Migration UMGESETZT (01.09.2026): Next 15.5.25 / React 19.2.8.** Plan samt
  Umsetzungsbericht: **`docs/zukunft/NEXTJS-15-MIGRATION.md`**; Befundlage:
  **`docs/SICHERHEIT-ABHAENGIGKEITEN.md`**. Alle 21 next-Meldungen geschlossen (25 → 4).
  **Wichtigste Code-Folge:** `createClient()` aus `lib/supabase/server.ts` ist jetzt
  **async** — neue Aufrufstellen brauchen `await createClient()`. Ebenso `besucherIp()`
  und `basisUrl()` (jetzt `lib/net/basisUrl.ts`; Route-Dateien dürfen in Next 15 nur noch
  HTTP-Methoden + Segment-Konfig exportieren). React 19: `useRef` braucht einen Startwert.
  **Rückkehrpunkt: Branch `stand/vor-next15-2026-09-01`** (= letzter 14er-Stand, Commit
  `3ef7ccc`); Tags lässt der Git-Proxy der Remote-Umgebung nicht durch, deshalb ein Branch.
- **Bewusst offen: 4 Meldungen zu `postcss` 8.4.31** — von Next selbst fest verdrahtet
  (auch in 15/16), reine Bauzeit-Exposition. KEIN npm-`override` setzen (verstellt Nexts
  CSS-Pipeline); beim nächsten Next-Update erneut prüfen.
- **Next 16 ist ein eigenes, späteres Vorhaben** — verlangt `middleware.ts` → `proxy.ts`
  (dort **kein Edge-Runtime**), Turbopack als Standard, Wegfall von `next lint`.
- **Scanner (kostenlos, ohne Konto):** `osv-scanner scan source --lockfile=package-lock.json`
  (`go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest`). Vor jedem größeren
  Release laufen lassen, mindestens monatlich. Neue Befunde in der genannten Datei bewerten,
  nicht nur die Zahl weiterreichen.

## Build / Test
- `npm run build` zum Verifizieren (braucht die NEXT_PUBLIC_SUPABASE_*-Variablen, Platzhalter genügen für den Build).
