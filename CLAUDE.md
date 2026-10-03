# MyImmo — Projektnotizen

## Arbeitsweise / Feedback-Stil (vom Nutzer gewünscht)
- Sei ein ehrlicher Sparring-Partner — kritisch, finde Schwachstellen und blinde Flecken.
- Nicht einfach zustimmen — erst prüfen, ob es stimmt.
- Die Wahrheit sagen, auch wenn sie unbequem ist; ruhig direkt, ohne Schönfärberei.
- Keine Floskeln („Großartige Frage!", „Du hast absolut recht!").
- Bei jeder Entscheidung des Nutzers zuerst die Risiken nennen, bevor zugestimmt wird.


## Vault & Wissensspeicher (verbindlich)

- **`docs/VAULT-REGELN.md` — Aufnahmeschwelle für die Vault. JEDER Chat hält sich daran.**
  Kurzfassung: In `docs/` kommt nur, was (1) eine Entscheidung festhält, die sonst neu
  getroffen werden müsste, (2) einen Fehler mit Ursache und Gegenprüfung dokumentiert,
  (3) eine alternde Zahl/Frist/Vertragslage **mit Stand-Datum und Quelle** festhält,
  (4) eine Konvention verbindlich macht oder (5) einen Ist-Stand belegt, der sonst falsch
  eingeschätzt wird. **Nicht** hinein: Verlaufsprotokolle, Allgemeinwissen, Doppelungen,
  Vermutungen im Indikativ, Zwischenstände, Rohdaten.
  Vor dem Schreiben die vier Aufnahmefragen aus der Datei durchgehen.
- **`docs/app-entwicklung/` — wiederverwendbares App-Bau-Wissen** (Vorgehen, Code-Regeln,
  Design, Rechner, Anbindungen, Recht, volatile Kennzahlen, Fehlerkatalog).
  Ziel: aus einer Ideenskizze eine App bauen, ohne Entscheidungen und Fallstricke neu zu
  erarbeiten. Einstieg: `docs/app-entwicklung/00 App-Entwicklung Index.md`,
  Ablauf für neue Apps: `09 Neue App bauen.md`.
- **`docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md` — BEI JEDEM SESSIONSTART
  auf fällige Prüfungen sehen** (Steuersätze, Förderkonditionen, Anbieterverträge, Beispielzinsen,
  Marktdaten). Fällige Zeilen abarbeiten, bevor die eigentliche Aufgabe beginnt; das Ergebnis
  eintragen — auch „unverändert" ist ein Prüfergebnis.
- 💡 **IDEEN → Memory-Repo `jxnashap/memory`, Datei `02 - MyImmo/myimmoideen.md`** (Branch `main`).
  Nennt der Nutzer eine Idee zu MyImmo, wird sie DORT eingetragen (Datum, Status 💡, seine
  Worte, nicht bewerten). **Vor jedem eigenen Vorschlag dort nachsehen** — zurückgestellte
  und verworfene Ideen stehen mit Grund da. Zugriff: `add_repo` jxnashap/memory.
- **Neue Erkenntnisse gehören dorthin**, nicht in den Chatverlauf: Wer einen Fehler behebt,
  eine Anbindung klärt oder eine Konvention festlegt, trägt sie im selben PR nach.

## Offene Punkte / Merkliste

> **Vor dem Start: `docs/START-CHECKLISTE.md`** (04.09.2026) — alle offenen Punkte nach
> Dringlichkeit sortiert, frisch gegen den Code geprüft, mit einem Abschnitt „ausdrücklich
> NICHT nötig".
>
> ✅ **A5 erledigt (04.09.2026): Die Tarif-Schranken sind eingebaut.** Bis dahin war die
> Matrix in `lib/plan.ts` zwar vollständig, `darfFeature()` und `einheitenLimit()` wurden
> aber an NULL Stellen aufgerufen — `BILLING_ENFORCED=true` wäre wirkungslos gewesen.
> Jetzt greifen sie über **`lib/planGate.ts`** an 9 Stellen (Steuer-PDFs, DATEV, die drei
> KI-Routen, NK-PDF, Dokument-PDF, Mieter-Einladung, Objekt-Anlage).
> **Entscheidende Eigenschaft:** Ohne `BILLING_ENFORCED=true` kehren die Schranken sofort
> zurück — **ohne Datenbankabfrage**. Im Early Access kosten sie nichts und können nichts
> verändern; nachgewiesen durch Tests UND am laufenden Server (307/401/405 wie vorher,
> nirgends ein 402).
>
> ✅ **A9 erledigt (08.09.2026): Bestandsschutz ist automatisch.** Migration
> `20260908082914_bestandsschutz_automatisch.sql`: alle 22 Konten haben eine Zeile
> `plus/testphase/bestandsschutz`, jedes neue Konto bekommt sie per Trigger auf
> `auth.users`, solange `public.billing_einstellungen.bestandsschutz_offen = true`.
> Ohne `BILLING_ENFORCED=true` ist das wirkungslos (Schranken kehren vorher zurück, der
> Abo-Tab zeigt im Early Access die Early-Access-Karte). **Beim Scharfschalten:** den
> Schalter auf `false` setzen — vergessen ist ungefährlich (neue Konten bekämen Plus).
> Das frühere Termin-Skript `scripts/sql/bestandsschutz-vor-billing.sql` ist nur noch
> Kontrolle (A/C) und späteres Beenden (D). Zahlen und Begründung: `docs/START-CHECKLISTE.md`.
> **Merke außerdem:** `effektiverPlan()` wertet `gueltig_bis` NICHT aus — ein Abo endet
> allein über `status`.

### 👤 NUR DER BETREIBER — offene Punkte (Stand 10.09.2026)
Alles hier ist **kein Code**, sondern ein Dashboard, ein Anwalt oder ein Blick in einen
Browser. Ich kann es nicht erledigen und nicht prüfen. **In jeder Session kurz nachfragen,
ob etwas davon inzwischen erledigt ist** — dann hier abhaken statt es erneut vorzuschlagen.

**Dringend — ein Kernweg hängt daran:**
1. ~~**Supabase → Authentication → URL Configuration.**~~ ✅ **ERLEDIGT UND GEPRÜFT
   30.09.2026.** Site URL = `https://www.myimmoapp.de`; `…/auth/passwort` wird angenommen;
   ein Platzhalter für die eigene Domain existiert (`www.myimmoapp.de/irgendwas` wird
   angenommen); fremde Domains, `*.vercel.app`, Vercel-Vorschauen und `localhost` werden
   **verworfen** — kein gefährlicher Platzhalter.
   🔍 **Prüfverfahren (ohne Mail, ohne Dashboard):** `GET /auth/v1/authorize?provider=google
   &redirect_to=<ziel>` mit Header `apikey: <publishable key>` → die `state`-UUID aus der
   Google-Weiterleitung ist die ID einer Zeile in `auth.flow_state`; deren Spalte `referrer`
   ist das, was Supabase ANGENOMMEN hat. Ein verworfenes Ziel fällt auf die Site URL zurück —
   damit ist auch die Site URL auslesbar. Hinterlässt je Probe eine unvollendete
   `flow_state`-Zeile ohne Nutzer (verfällt; nicht löschen, kein Schreiben ins Auth-Schema).
2. ~~**E-Mail-Vorlage „Reset Password" auf `token_hash` umstellen**~~ ✅ **erledigt 30.09.2026
   und durch Punkt 3 BELEGT** (Supabase-Log: `POST /verify` von unserem Server, Status 200).
   Falle dabei: Die Vorlage enthielt `{{ .ConfirmationURL }}` ZWEIMAL (Knopf + Ersatzlink
   „falls der Knopf nicht funktioniert"); zuerst war nur der Knopf umgestellt.
   Die eigene Vorlage (46 Zeilen, gestaltet) blieb erhalten; nur jedes `{{ .ConfirmationURL }}`
   wurde durch `{{ .SiteURL }}/auth/passwort?token_hash={{ .TokenHash }}&type=recovery`
   ersetzt. **Beweis erst durch Punkt 3.** Merkmal am Link der Mail: beginnt er mit
   `www.myimmoapp.de/auth/passwort?token_hash=`, greift die Vorlage; beginnt er mit
   `…supabase.co/auth/v1/verify`, ist es noch die alte.
3. ~~**„Passwort vergessen" testen**~~ ✅ **BELEGT 30.09.2026** durch einen echten Nutzer,
   in den Supabase-Auth-Logs nachverfolgt: `recover` → `verify` (token_hash, 200) →
   `PUT /user` 200 → `logout` 204 (globale Abmeldung greift). **Ob die Mail auf einem
   anderen Gerät geöffnet wurde, ist aus den Logs nicht zu sehen** (gleiche IP = gleiches
   Heimnetz). **Dabei gefunden und behoben:** Ein vom Leak-Schutz abgelehntes Passwort
   („12345678") ergab „Bitte fordere einen neuen Link an" — die Erkennung suchte
   `pwned|leaked`, Supabase schreibt „known to be weak". Der Tester forderte daraufhin
   unnötig einen neuen Link an. Jetzt `passwortAblehnung()` in `lib/passwort.ts` (Fehlercode
   zuerst, Text als Rückfall) an allen drei Stellen (Reset, Passwortwechsel, Registrierung),
   und die Leak-Regel steht VOR der Eingabe da (`PASSWORT_LECK_HINWEIS`).
   **Warum der Test grün war:** `tests/blockF.test.ts` benutzte eine AUSGEDACHTE
   Supabase-Meldung mit angehängtem „(pwned)". **Regel: Fremde Fehlertexte in Tests nur
   wörtlich aus einem echten Log übernehmen, nie formulieren.**
   Nebenbefund: 8 s nach dem erfolgreichen `verify` ein zweites mit 403 `otp_expired`
   (Doppel-Tipp oder Mail-Vorschau) — folgenlos, der erste war durch.

**Danach, in dieser Reihenfolge:**
4. ~~**Die zwei restlichen Passwort-Schalter**~~ ✅ **laut Betreiber seit Längerem an**
   (genauer Zeitpunkt unbekannt). **Belegt 30.09.2026:** „Passwort vergessen" läuft MIT den
   Schaltern durch (Supabase-Log 22:04 UTC: recover → verify 200 → PUT /user 200 → Anmeldung
   mit neuem Passwort 200) — die offene Frage, ob „Require current password" den Reset
   blockiert, ist damit beantwortet: **nein.** **Noch offen:** Passwortwechsel in den
   Einstellungen mit FALSCHEM altem Passwort muss scheitern (kein Log-Beleg bisher).
   **Falle beim Prüfen:** Aus fehlenden „reloading api"-Einträgen im Auth-Log auf „nicht
   gespeichert" zu schließen, war falsch — das Log belegt nur den abgefragten Zeitraum.
5. ~~**Leaked Password Protection: Gegenprobe.**~~ ✅ **WIRKT, belegt 30.09.2026** im
   Supabase-Log: sechsmal `PUT /user` 422 „Password is known to be weak" beim Reset-Test
   („12345678" u. a.), danach ein sicheres Passwort angenommen. Belegt am Passwort-SETZEN;
   für die Registrierung gilt dieselbe Server-Einstellung, dort nicht eigens probiert.
0. **Brevo-Zugang in Vercel eintragen (02.10.2026 gefunden, DRINGEND vor dem Start):**
   🟨 **03.10.2026: laut Betreiber eingetragen** (Projekt in Vercel 07:32 UTC geändert, danach
   neu deployt). **Falle:** Eine Env-Änderung wirkt erst mit dem NÄCHSTEN Deployment — der
   letzte Produktions-Build lag 3 Minuten davor, die Formulare blieben ausgeblendet.
   Merkmal ohne Mailversand: Erscheint auf `/vorlagen` ein E-Mail-Feld, ist `brevoBereit()` wahr.
   **Auch der Build danach (07:34) zeigte kein Formular** — der erste Eintrag kam in
   Production nicht an. **Ursache (Screenshot des Betreibers):** Im Feld **Value** von
   `BREVO_API_KEY` stand der NAME der zweiten Variable („BREVO_ABSENDER_EMAIL“) statt des
   Schlüssels, die zweite Variable fehlte ganz. Key = Name, Value = Inhalt; zwei getrennte
   Einträge. Das Projekt hat außerdem eine eigene Umgebung „claudeapi“ neben Production.
   Korrigiert 03.10.2026, danach neu gebaut → Formular sichtbar, erste Zeile in
   `newsletter_anmeldungen`. **Nächste Hürde (03.10.2026, OFFEN):** Brevo blockiert den
   Versand („API-Aufruf von unbekannter IP“) — Vercel-Funktionen haben keine feste IP.
   Lösung: Brevo → Sicherheit → Autorisierte IPs → Sperre aus (Risiko: Schlüssel gilt dann
   von überall; Rotation bei Verdacht) oder Vercel Static IPs (kostet). Betreiber:
   „machen wir später“. Bis dahin endet jede Anmeldung ohne Mail. **Regel: Nach jeder Env-Änderung neu bauen UND am
   Merkmal prüfen, nicht am Eintrag.**
   `BREVO_API_KEY` + `BREVO_ABSENDER_EMAIL` (in Brevo verifiziert, SPF/DKIM für
   myimmoapp.de), optional `BREVO_LIST_ID`, danach **neu deployen**. Ohne sie endete jede
   Anmeldung mit 503 „Versand gerade nicht verfügbar“ — `newsletter_anmeldungen` hatte
   **0 Zeilen, nie eine** (auch der Vorlagen-Verteiler hat also nie funktioniert). Seit
   02.10.2026 blenden Startseite, Unterseiten und `/vorlagen` die Formulare aus, solange
   `brevoBereit()` falsch ist — nach dem Eintragen erscheinen sie von selbst.
   **Danach testen:** eigene Adresse eintragen, Mail bestätigen → `/?nl=ok#bald`.
6. ~~**2FA einmal durchspielen**~~ ✅ **vom Betreiber durchgespielt 02.10.2026** (Login →
   Code → Weiterleitung mit dem Proxy-Gate funktioniert). Ebenso ✅ Passwortwechsel mit
   FALSCHEM altem Passwort scheitert (Punkt 4 damit vollständig) und ✅ Wischen auf dem
   echten Handy „klappt gut, so lassen“. Ursprünglicher Text: einrichten, abmelden, mit Code anmelden, „Handy nicht zur
   Hand?" mit einem Wiederherstellungscode. Die Logik ist getestet, der Ablauf nie.
   **Stand 01.10.2026: noch NICHT gemacht** (Betreiber bestätigt, bewusst auf der Liste
   gelassen). Seit Paket 4 (Proxy-Gate, `mi_faktor`) ist der Durchlauf wichtiger als vorher:
   Er ist der einzige Beleg, dass Login → Code → Weiterleitung mit dem neuen Gate zusammenspielt.

**Ohne Eile:**
7. **StBerG-Anfrage an den Anwalt** — `docs/compliance/StBerG-ANFRAGE.md` ist fertig.
8. ~~**Vercel-Log-Aufbewahrung**~~ ✅ **02.10.2026 (Betreiber):** Runtime-Logs auf Pro
   **1 Tag**, mit Observability Plus 30 Tage; Build-Logs unbegrenzt je Deployment.
   `/datenschutz` 3 d sagt jetzt „nach einem Tag“. **Wird Observability Plus gebucht,
   muss dort 30 Tage stehen.**
9. **11px → 12px: Token UMGESTELLT 02.10.2026** (`--text-xs: 12px`; `.tz-rest` gibt es seit 03.10.2026 nicht mehr — `/termine` hat keine feste Breite mehr).
   **Offen: Betreiber klickt durch** (Dashboard-Kacheln, Badges, Formular-Labels, Objektkarten,
   Termine, Briefvorschau, Befehlspalette) und meldet Umbrüche. Rückweg: eine Zeile in
   `app/globals.css`. Folge: `--text-xs` = `--text-sm` = 12px, die Stufe dazwischen entfällt.
10. **Brevo-Konto**: AVV-Restpunkte (neuere Fassung? Firmendaten? Empfängeradresse für
    Unterauftragsverarbeiter-Ankündigungen) — Details unter „AVV-Abschlussstand".
11. ~~**Altes kurzes Passwort**~~ — Betreiber 02.10.2026: „Nein“ (Bedeutung — „nicht
    nötig“ oder „meldet sich nicht an“ — nachzufragen; ohne echte Nutzer ohnehin folgenlos).

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
- ⚠️ **KORREKTUR 08.09.2026: Supabase ist auf PRO, nicht auf Free.** Live abgefragt
  (Organisation `wkxmbevawmmifleiggrs`, `plan: "pro"`). Der Eintrag hier behauptete
  seit dem 29.07.2026 das Gegenteil und hat zwei Punkte falsch eingeordnet:
  - **Leaked Password Protection kostet nichts mehr extra** — sie ist im bereits
    bezahlten Pro-Plan enthalten und steht laut Security-Advisor **aktuell auf AUS**.
    Damit ist das kein Geldpunkt mehr, sondern ein Ein-Klick-Schalter für den Betreiber:
    Authentication → Sign In / Providers → Email → „Password Security". **Danach die
    empirische Gegenprobe wiederholen** (Registrierung mit „Password123!" muss jetzt
    scheitern) — am 29.07.2026 ging sie durch, und ob das am Plan lag oder daran, dass
    der Schalter nicht gespeichert wurde, ist rückblickend nicht mehr feststellbar.
  - **Backups gibt es** (das war eine offene Frage aus der Feedback-Bewertung):
    Pro sichert **täglich, die letzten 7 Tage** sind im Dashboard unter Database →
    Backups abrufbar. Feinere Wiederherstellung (PITR, sekundengenau) ist ein Add-on
    für ~100 $/Monat bei 7 Tagen Aufbewahrung — **nicht nötig**, solange die Daten
    überschaubar sind und ein Tagesstand als Rückfall genügt.
  **Lehre daraus, ernster als die zwei Punkte:** Ein Plan-/Konto-Zustand ist eine
  Tatsache, die sich ändert, und stand hier sechs Wochen als Notiz. Solche Aussagen
  vor dem Weiterverwenden **nachfragen, nicht nachlesen** (`get_organization`).
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

### Passwort vergessen — Rückweg ins Konto (09.09.2026 gebaut)
**Vorher war der Weg eine Sackgasse:** `resetPasswordForEmail` zeigte auf `/login`, dort
wurde der Link nirgends eingelöst, und ein Formular für ein neues Passwort gab es in der
ganzen App nicht — `wechslePasswort` ist der einzige Weg zu einem neuen Passwort und
verlangt das **alte**, also genau das, was der Nutzer vergessen hat.
**Jetzt:** `/auth/passwort` (Route, löst ein) → `/auth/passwort-neu` (Formular).
- **Beide Linkformen bedient:** `token_hash` + `verifyOtp` **geräteübergreifend** (Reset am
  Rechner anstoßen, Mail am Handy öffnen ist der Normalfall) und `code` +
  `exchangeCodeForSession` (PKCE, nur **dasselbe Gerät** — der `code_verifier` liegt im
  anfordernden Browser). Die Standard-Vorlage liefert `code`; für den geräteübergreifenden
  Weg muss der Betreiber die **E-Mail-Vorlage** in Supabase auf `token_hash` umstellen.
- **Die Seite ist die Hintertür an `wechslePasswort` vorbei** — sie setzt ein Passwort ohne
  das alte. Deshalb reicht „ist angemeldet" NICHT: `lib/auth/resetNachweis.ts` stellt nach
  bestätigtem Token einen **kurzlebigen, signierten Nachweis** aus (5 min, httpOnly,
  an den Nutzer gebunden, Ablauf mitsigniert, zeitkonstanter Vergleich). Ohne ihn zeigt die
  Seite „Link nicht mehr gültig".
  **Warum eigener Nachweis statt `amr`:** Welchen Bezeichner Supabase für Recovery in `amr`
  setzt, ist nicht dokumentiert und hier nicht überprüfbar. Auf eine unbelegte Annahme
  lässt sich keine Schranke bauen — rät man falsch, ist die Seite für alle gesperrt oder
  für alle offen.
- **Liegt unter `/auth/`**, weil dieser Pfad in der Middleware öffentlich und vom
  2FA-Gate im Layout ausgenommen ist. Ein Konto mit Zwei-Faktor muss sein Passwort auch
  dann zurücksetzen können, wenn der zweite Faktor noch nicht bestätigt ist.
- **Nach dem Wechsel `signOut({ scope: "global" })`** — man setzt ein Passwort oft genau
  dann zurück, weil man fremden Zugriff vermutet; Supabase beendet fremde Sitzungen von
  sich aus **nicht**.
- ⚠️ **BETREIBER-SCHRITT, ohne den der Link ins Nichts führt:** `redirectTo` wirkt nur,
  wenn die URL **wörtlich** in der Redirect-URL-Weißliste steht (Authentication → URL
  Configuration). Fehlt sie, verwirft Supabase das Ziel stillschweigend und nimmt die
  **Site URL** — steht die auf `localhost`, landet der Nutzer im Nichts. Genau so am
  09.09.2026 gemeldet. Einzutragen: `https://www.myimmoapp.de/auth/passwort`; Site URL
  muss `https://www.myimmoapp.de` sein.
  **Der Code hängt seitdem nicht mehr daran:** Die **Middleware** fängt Recovery-Merkmale
  (`type=recovery&token_hash`, oder `code` auf `/` bzw. `/login`) ab und reicht sie an
  `/auth/passwort` weiter — samt Suchparametern. `/auth/` ist ausgenommen, sonst
  Endlosschleife und der Google-Callback (nutzt ebenfalls `code`) würde gekapert.
- 🔑 **Passwortwechsel prüft jetzt ZWEIFACH (09.09.2026), `lib/passwortWechsel.ts`:**
  (1) `signInWithPassword` mit dem alten Passwort — wirkt **sofort**, ohne Schalter, und
  erzeugt nebenbei eine sekundenfrische Sitzung (erfüllt „Secure password change").
  (2) **`current_password` im `updateUser`-Aufruf** — die einzige Prüfung, die
  **serverseitig** greift; sie wirkt, sobald „Require current password when updating"
  eingeschaltet ist, und schützt dann auch gegen einen direkten API-Aufruf **am Formular
  vorbei**. Nur (1) wäre umgehbar, nur (2) bis zum Umlegen des Schalters wirkungslos.
- 🚫 **Der `istGoogle`-Zweig in `wechslePasswort` ist WEG — nicht wieder einbauen.**
  Er übersprang die Bestätigung für Konten ohne Passwort. Mit dem Schalter „Require
  current password" hätte er still versagt: Ein Konto ohne Passwort kann keines
  mitschicken. Google-Konten bekommen stattdessen **`sendePasswortMail()`** (Einstellungen
  → Sicherheit und Mieter-/Service-Konto zeigen dort einen Knopf statt der Felder) — der
  Link erzeugt eine frische Sitzung und endet auf `/auth/passwort-neu`.
  🐞 **„Google-Konto" hieß bis 30.09.2026: `app_metadata.provider !== "email"`** — das ist
  der Anmeldeweg bei der ANLAGE und ändert sich nie. Ein am 26.06. über Google angelegtes
  Konto, das per „Passwort vergessen" ein Passwort bekam, konnte es danach nicht ändern
  („du meldest dich mit Google an"). Jetzt fragt die Seite die Datenbank:
  RPC **`konto_hat_passwort()`** (Migration `20260930212305`, nur `authenticated`, ja/nein
  für `auth.uid()`, in einer zurückgerollten Transaktion an drei Kontoarten geprüft) →
  `ohnePasswort()` in `lib/passwort.ts`; `provider` nur noch als Rückfall und für den
  2FA-Hinweis „gilt auch für Google". **Regel: Für „hat ein Passwort" nie `provider` oder
  `identities` nehmen** — ein per Reset gesetztes Passwort legt KEINE `email`-Identität an
  (live gesehen). `tests/kontoPasswort.test.ts`, drei Mutationen rot.
  **`RESET_ZIEL` in `lib/passwortWechsel.ts` ist die EINE Stelle für das Linkziel** —
  Login und Einstellungen hängen beide daran, damit sie nicht auseinanderlaufen.
- 📋 **Reihenfolge beim Scharfschalten der beiden übrigen Supabase-Schalter:**
  erst „Passwort vergessen" mit einer echten Mail beweisen → dann beide Schalter →
  **sofort danach erneut testen**. Die Supabase-Doku nennt **keine Ausnahme für Recovery**
  bei „Require current password"; es ist offen, ob der Schalter den Reset-Weg blockiert
  (`components/PasswortNeu.tsx` kann und darf kein altes Passwort mitschicken). Bricht er,
  geht dieser Schalter wieder aus — die Absicherung leisten dann (1) oben plus
  „Secure password change".
`tests/passwortReset.test.ts` + `tests/blockF.test.ts`, fünfzehn Mutationen geprüft.

### Zukunftsideen (notiert, nicht gebaut)
> **Vollständige Ideenliste mit Status: Memory-Repo `02 - MyImmo/myimmoideen.md`.**
> Die Einträge hier unten sind die ausführlichen Begründungen zu zwei davon.
- ✅ **Reiter per Wischen (01.10.2026, Wunsch des Betreibers) — GEBAUT, zweite Fassung
  am selben Tag („muss viel flüssiger sein").** Der INHALT folgt dem Finger, der
  Nachbar-Reiter gleitet daneben herein, beim Loslassen gleitet er zu Ende (260 ms,
  `--ease-out-stark`) oder schnappt zurück; ERST DANN `router.push` (Adresse zieht mit,
  „Zurück" bleibt heil). `lib/wischen.ts` (reine Entscheidung: weit ≥ ¼ Breite ODER schnell
  ≥ 0,5 px/ms ab 40 px; waagerecht ≥ 1,8× senkrecht; Achse ab 10 px festgelegt; Rand 28 px
  dem System überlassen; Gummiband ⅓ am Listenende; kein Umlauf) +
  `components/WischReiter.tsx` (`reiter: { href, label, inhalt? }[]`; `touch-action: pan-y`,
  der Browser scrollt senkrecht selbst; Eingabefelder, waagerecht scrollbare Bereiche und
  `data-kein-wischen` ausgenommen; Nachbarn `inert`; Rückfall-Timer, falls `transitionend`
  ausbleibt; bei `prefers-reduced-motion` kein Gleiten). **`/portal` bringt alle fünf
  Inhalte mit** (die Daten liegen ohnehin vor), **`/anliegen` nur den aktiven** — die
  Nachbarn gleiten als Platzhalter „wird geladen …" herein, bis der Server liefert (alle
  Reiter vorzuladen hieße ~8 Abfragen je Aufruf für die Ansichten). `tests/wischen.test.ts`.
  **Nicht auf einem echten Telefon geprüft** — Schwellen und Gefühl muss der Betreiber
  testen. Die Einstellungen haben kein Wischen; ihre Reiter sind Zustand, keine Links.
  **Dritte Fassung (gleicher Tag, Betreiber: Leiste dauert zu lange, Gleiten ruckartig, etwas
  langsamer):** Beim Ziehen KEIN React-Render je Fingerbewegung — der Versatz geht per Ref
  direkt ins `transform`; React setzt es nur in Ruhe und beim Gleiten (sonst überschriebe jeder
  Render den Finger). Gleiten 380 ms `cubic-bezier(0.22,1,0.36,1)` — bewusst über der
  300-ms-Regel, hier bewegt sich eine ganze Seite. **Leiste gekoppelt:** `WISCH_EREIGNIS`
  (`myimmo:wisch`, an `document`, `detail.href`) beim Start des Gleitens → `GlassLeiste`
  markiert den Ziel-Link sofort und rückt ihn in die Mitte, statt auf die Serverantwort zu warten.
  **Glas-Leiste zentriert (Vorgabe des Betreibers, gleicher Tag):** `components/GlassLeiste.tsx`
  + `lib/glasLeiste.ts` → der offene Reiter steht unter 860 px in der Mitte der Leiste — beim
  Laden sofort (`useLayoutEffect`, kein Sprung), bei jedem Wechsel weich; `tests/glasLeiste.test.ts`.
  🗺️ **Karte ENTFERNT (01.10.2026, Entscheidung des Betreibers: „Raus mit der Karte“).**
  Erst vom Dashboard (#367), dann auch `/karte`, `/api/karte/verorten`, `PortfolioKarte`,
  Leaflet (Paket + CSS), der Knopf auf `/properties`, der Demo-Pfad, der Rauchtest-Weg, CARTO
  aus der Datenschutzerklärung und „Karte mit allen Standorten“ von der Startseite (jetzt
  „Restschuld je Objekt auf einen Blick“ — steht so im Bild darüber). `tests/demoWege.test.ts`
  hält fest, dass nichts davon zurückkommt. **Davor am selben Tag (#375) gemessen und behoben,
  und das BLEIBT:** `lib/geocode.ts` ist die EINE Verortung (Marktwert-Schätzung + Wert-Cron):
  Nominatim antwortet unter Last mit **429**, die App hielt das für „nicht gefunden“ und fragte
  dieselbe Adresse immer wieder — laut Nutzungsregeln ein Sperrgrund. Jetzt `treffer/leer/
  gedrosselt`, Bereinigung („(EG)“ ließ die Suche leer laufen), strukturierter Zweitversuch,
  Ergebnis in `properties.geo_status`/`geo_versucht_am` (Migration `20261001200000`) — „nicht
  gefunden“ erst nach Adressänderung neu, „gedrosselt“ nach 6 h. Der **Cron verortet nur, wenn
  BORIS an ist** (sonst gingen Adressen ALLER Konten hinaus, ohne Abnehmer). Datenschutz
  Ziffer 3 h nennt Nominatim (UK, Angemessenheitsbeschluss bis 27.12.2031) und Jina AI (Audit
  B9). `tests/verortung.test.ts`. **Regel: Nie eine externe Anfrage wiederholen, deren Ergebnis
  schon bekannt ist; 429/5xx sind „später“, nicht „gibt es nicht“.**
  📋 **Kompakte Listen (03.10.2026, Betreiber: „nicht so viel Text, funktionell“):** `.listen-zeile`
  (eine Zeile je Eintrag, Titel mit Auslassung, Datum rechts, Chevron) für Anliegen (Vermieter
  + Portal, Detail über `?vorgang=<id>`), Dashboard-Neuigkeiten, „Termine & Aufgaben“ und
  `/termine`: Liste nach Monaten gruppiert (`.tz-gruppe`, Überfällig zuerst), Monatsansicht zeigt
  UNTER dem Raster die Termine des Monats bzw. des gewählten Tags. Bearbeiten/Löschen auf dem
  Desktop blass bis Hover. **Regel: Neue Listen nehmen `.listen-zeile`, keine Textblöcke.**
  **Lehre aus dem Umweg:** „Ja“ auf eine Liste mit mehreren Möglichkeiten ist keine Freigabe für
  die erste davon — vor einem größeren Umbau nachfragen, was gemeint ist.
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
- 🔐 **Mieterportal: Ausbau + sicherer Zustellweg — `docs/zukunft/MIETERPORTAL-AUSBAU.md`**
  (02.10.2026, Auftrag des Betreibers: „der Vermieter darf die NK-Abrechnung nicht versehentlich
  an die falsche Person senden“). **Kern:** Dokumente gehen heute an eine Mieter-ZEILE, nicht an
  eine Person; wer an der Zeile hängt, wechselt unbemerkt (Mieterwechsel in derselben Zeile),
  endet nie (kein Trennen, kein Ende bei Auszug) und ist für den Vermieter unsichtbar (nur
  „verbunden“, keine E-Mail). „Speichern & zustellen“ meldet Erfolg auch OHNE verbundenes Konto
  (§ 556 Abs. 3 BGB-Frist!). Plan: Paket S (S1 Tabelle `zustellungen` an `empfaenger_user_id`,
  S2 Zustell-Dialog mit harten Sperren, S3 E-Mail sichtbar + Trennen + Zugangsende …) VOR jedem
  Ausbau. ✅ **Schritt 1 gebaut 02.10.2026:** Einladung an eine E-Mail-Adresse gebunden
  (Doppeleingabe, Mail an genau diese Adresse, DB verknüpft nur bei gleicher BESTÄTIGTER Adresse
  — Migration `20261002100000`, in zurückgerollter Transaktion bewiesen); Mieterseite zeigt die
  verbundene Adresse + „Zugang trennen“ / „E-Mail ändern“ (= trennen + neu einladen); NK-Zustellen
  nur über eine Bestätigungskarte, serverseitig GESPERRT ohne verbundenes Konto oder bei Jahr
  außerhalb der Mietzeit (`lib/mieterZugang.ts` → `pruefeZustellung()`). **Regel: Ein neuer Weg,
  der etwas ins Mieterportal stellt, ruft `pruefeZustellung()` serverseitig.** Offen: S1 (Tabelle
  `zustellungen`). Einladungsmail braucht Brevo (Punkt 0).
  ✅ **Zugangsende gebaut 02.10.2026 (Betreiber: „bis 31.12.“ des Folgejahres):** Migration
  `20261002120000` — `mieter_zugang_aktiv()` ist die EINE Prüfung hinter sieben Regeln und beiden
  Portal-Sichten; Belege nur aus der eigenen Mietzeit (`mieter_beleg_sichtbar()`), Vorschau
  spiegelt das (`belegInMietzeit()` in `lib/portalDaten.ts`). **Regel: Eine neue Mieter-Regel
  oder -Sicht prüft `mieter_zugang_aktiv()`, nie nur `mieter_zugaenge`.** Policies per
  `ALTER POLICY` ändern — `DROP POLICY` lief über `apply_migration` in den Zeitüberlauf
  (Bestätigungsdialog, siehe Demo-Service-Reset), ohne etwas anzuwenden.
  ✅ **S1 gebaut 02.10.2026: Zustellung an eine PERSON** (Migrationen `20261002140000/141000`,
  `lib/zustellung.ts` = EINE Stelle für Lage + Zustellen, `lib/actions/zustellung.ts`). Der Mieter
  sieht ein Archiv-Dokument nur noch über eine eigene, aktive Zeile in `zustellungen`;
  `notizen.mieter_freigabe` entscheidet NICHTS mehr (nur noch Merkmal). Abruf setzt die
  Datei-Route (`zustellung_abgerufen`), „gelesen und bestätigt“ ist ein Klick, keine Unterschrift.
  **Regeln:** (1) Ein neuer Weg, der etwas ins Portal stellt, schreibt eine Zeile in
  `zustellungen` über `ladeZustellLage()` + `zustelle()` — nie einen Freigabe-Schalter.
  (2) Eine Policy auf `zustellungen` liest `notizen` nie direkt (42P17-Rekursion, im Nachweis
  passiert) — nur über eine SECURITY-DEFINER-Funktion. (3) Keine Fremdschlüssel mit `on delete`
  in Migrationen über `apply_migration` (Bestätigungsdialog). **Vereinbarter Ausbauplan,
  „KI im Portal“ (gemerkt, nicht jetzt) und Hausmeister/Minijob mit Risiken: Abschnitt 9 dort.**
  ✅ **Vorgänge mit Verlauf gebaut 02.10.2026** (Migration `20261002160000`, `lib/vorgang.ts`,
  `components/VorgangVerlauf.tsx` = EINE Darstellung für Portal, Vorschau und `/anliegen`).
  `anliegen.antwort` wird nicht mehr geschrieben (Altbestand übernommen); Nachrichten über
  `schreibeNachricht()` bzw. `bearbeiteAnliegen(…nachricht)`. **Regel: Status-, Termin- und
  Auftragsereignisse NIE aus der App schreiben — das tun die Trigger** (sonst doppelt); die App
  schreibt nur `art = 'nachricht'`. Trigger schreiben nur mit `auth.uid()` (Service-Role/Demo-Reset
  erzeugt keine Einträge).
  ✅ **Schritt 4 + 5 gebaut 02.10.2026:** Mieter-Startseite „Zu erledigen“ (`lib/mieterAufgaben.ts`,
  rein, aus den Portal-Daten) und geführte Schadensmeldung (`lib/schadensmeldung.ts` +
  `SchadenAssistent`) mit Notfall-Hinweis (`NotfallHinweis.tsx`). **Regel: In Notfall-Texten nie
  eine Telefonnummer außer 112** — Entstörungsdienste sind regional verschieden; ein Test hält es
  fest.
  ✅ **Schritt 3 gebaut 02.10.2026: Hinweis-Mails** (`lib/benachrichtigung.ts` → `benachrichtige(userId,
  art, bezug)`). **Regeln:** (1) Eine Hinweis-Mail nennt NIE Titel oder Inhalt — `benachrichtigungsMail`
  nimmt bewusst nur `(art, basis)`. (2) Die Adresse kommt aus dem Auth-Konto, nie vom Aufrufer.
  (3) Benachrichtigen erst NACH erfolgreichem Speichern, und ein Versandfehler lässt die Action nie
  scheitern. Abbestellen: `user_metadata.benachrichtigungen_aus`.
  ✅ **Schritt 6 gebaut 02.10.2026:** Mietkonto für den Mieter (`lib/mieterKonto.ts`, Sicht
  `miet_zeitraeume_portal`) — **Regel: Im Portal nie „Rückstand“/„schuldest“; Grundlage sind die
  Buchungen des Vermieters** (Test hält es fest). Mitteilungen (`zustellungen` art `mitteilung`,
  `gruppe`) und Gebäude-Infos (`gebaeude_infos`). **Falle:** Ein Prüf-SQL mit `update … set …` OHNE
  `where` lief über `execute_sql` in den Bestätigungsdialog (Zeitüberlauf) — immer mit WHERE prüfen.
  **Falle:** Eine „use server“-Datei darf NUR async-Funktionen exportieren (Konstanten brechen den
  Turbopack-Build, vitest merkt es nicht) — `tests/useServerExporte.test.ts` wacht jetzt darüber.
  Schritt 7 (Kostengrenze + Angebote) ist gebaut. ✅ **Paket S abgeschlossen 03.10.2026:** S4
  (Rückfrage „neuer Mieter?“ bei Namens-/Beginn-Änderung mit Portal-Konto, serverseitig
  erzwungen), S7 (Beleg-Freigabe nennt die Zahl der sehenden Konten), Vorschau nach
  Zugangsende — Details im Plan, Abschnitt 0. Nächster Portal-Schritt laut Plan:
  Vertreter-Zugang (eigenes Vorhaben).
  📋 **Listen statt Textwände (03.10.2026, Betreiber: „nicht so viel Text, Anliegen öffnen, eigene
  Seite“):** Vermieter-Liste (`/anliegen`) und Mieter-Liste (`/portal?tab=anliegen`) zeigen je
  Anliegen EINE Zeile (`.listen-zeile`: Titel, Mieter·Objekt bzw. Datum, höchstens ein Merkmal
  wie „Neue Nachricht“/„Termin wählen“, Status). Ein Klick öffnet `?vorgang=<id>` — beim
  Vermieter links Meldung + Verlauf + Antwort/Status, rechts Termin, Angebote, Weiterleiten; beim
  Mieter Meldung, Terminwahl, Verlauf mit Antwortfeld. Dashboard-Neuigkeiten einzeilig und mit
  Direktlink (`vorgangUrl()`), Mieter-Aufgaben ebenso (`MieterAufgabe.vorgang`). Merkmale und
  Adressen: `lib/anliegenListe.ts` (`tests/anliegenListe.test.ts`, vier Mutationen rot). Der
  Rauchtest öffnet jetzt auch die Detailansicht (`pruefeVorgang`). **Regel: Kein Verlauf und kein
  Formular in einer Liste — dafür gibt es die Detailansicht.** Gleicher Tag: auch „Termine &
  Aufgaben“ auf dem Dashboard als `.listen-zeile` (Titel, darunter Mieter/Objekt — viele Aufgaben
  heißen gleich, der Unterschied darf nicht hinter „…“ verschwinden; Fristdatum rechts, rot wenn
  dringend). `.heute-zeile` ist entfernt.
- 🔧 **Handwerker-Anfragen / Handwerkerportal — `docs/zukunft/HANDWERKER-ANFRAGEN.md`**
  (Idee Jonas, Plan 02.10.2026). Entschieden: MyImmo baut die ANFRAGE, der Handwerker bietet
  (kein eigener Kostenvoranschlag — Preishaftung); der VERMIETER wählt, der Mieter schlägt vor
  (§ 535/§ 536a BGB); Erlösmodell OFFEN. Stufe 1 „Angebote einholen“ mit der Kostengrenze;
  regionales Verzeichnis erst bei Dichte und nach Anwalt (P2B, DSA, UWG, Gewerbeanmeldung).
  ✅ **Stufe 1 + Kostengrenze gebaut 02.10.2026** (#394 + Folge-PR): Anfrage je Firma mit Link
  `/angebot/<token>` (öffentlich, 30 Tage, ≤ 3 Angebote), Mail-Entwurf statt Brevo, „Beauftragen“
  → Auftrag ohne Service-Konto. **Regel: Mieter-Kontakt nie in die Anfrage, nur beim Beauftragen
  mit Haken.**
- ✅ **Einstellungen → Vertreter (02.10.2026, Vorgabe des Betreibers):** Stammdaten einer
  Vertrauensperson + Vollmacht (Art, Form, Beglaubigung/Apostille, Gültigkeit, Widerruf, Original,
  Scan) für Bank/Notar/Darlehensunterschrift, wenn der Vermieter im Ausland ist. **KEIN App-Zugang.**
  `lib/vertreter.ts`, Migration `20261002210000`. **Regel: Hinweise zur Vollmacht nie als
  Rechtsrat formulieren („meist … nachfragen“); feste Aussage nur § 29 GBO.**
  Dazu: optional im **Kreditantrag-PDF** (Seite 3, ohne Scan, nur gültige Vollmacht) und als
  **Dashboard-Aufgabe**, wenn die Vollmacht in ≤ 60 Tagen abläuft oder abgelaufen ist.
- 🧰 **Ausbau-Paket 02.10.2026 (Recherche „stärkste Funktionen“, Betreiber: „mach 1 bis 6“)** —
  `tests/ausbauPaket.test.ts`: (1) **Steuer-Wächter** auf `/steuer` (15 %-Grenze + Spekulationsfrist
  für ALLE Objekte, `lib/steuer/waechter.ts`) und Anlage V **im Vergleich zum Vorjahr**;
  (2) **Objekt-Check** „x von y Angaben“ (`lib/objektCheck.ts`, nur was etwas berechnet; was nicht
  gilt, zählt nicht) auf Objektseite + Objektliste; (3) **NK aus dem Vorjahr übernehmen** (ohne
  Zählerstände/Lohnanteil) + **Vorauszahlungsvorschlag** § 560 Abs. 4 BGB (`lib/nkVorjahr.ts`);
  (4) Mahnung aus offenem Monat **gab es schon** (`RueckstandWaechter`) — nicht doppelt gebaut;
  (5) **Beleihungsauslauf + freie Grundschuld** je Objekt auf `/kredite` (`lib/beleihungsauslauf.ts`,
  Wert = Schätzung, ausdrücklich „keine Bankbewertung“); (6) Mietspiegel-Ampel fällt auf die
  Vergleichsmiete des Objekts zurück (`vergleichsmieteFuer`). Marktrecherche dazu: Wettbewerb
  läuft über Vertrauen (Preissprünge, Datenverlust), nicht über Funktionen.
- 🏦 **Kontoauszug-Abgleich per CSV (02.10.2026, Plan 01.10. Phase 3)** — Mietkonto → Reiter
  „Kontoauszug abgleichen“, `lib/kontoauszug.ts` + `components/KontoauszugAbgleich.tsx`.
  **Die Datei wird NUR im Browser gelesen** (enthält fremde Zahlungen); gebucht wird über
  `bestaetigeMehrere` (Dublettenschutz je Mietmonat). Kopfzeile per Spaltennamen gesucht
  (Sparkasse, DKB, ING, comdirect …; Vorspann übersprungen; UTF-8, sonst Windows-1252).
  **Regel: Betrag allein ist KEINE Zuordnung** — IBAN (+3), Nachname ≥ 3 Zeichen (+2), Betrag =
  offenes Soll (+2); ab 4 „sicher“ (vorausgewählt), 3 „Vorschlag“, Gleichstand zweier Mieter nie
  „sicher“. Mieter-IBAN geht nur als SHA-256 in den Browser (`ibanHash` in `lib/mietkontoDaten.ts`).
  **Nicht an echten Bank-Exporten geprüft** — Beispiel-CSVs in `tests/kontoauszug.test.ts` sind
  nachgebaut. Meldet ein Nutzer ein unbekanntes Format, die Spaltennamen in `ALIASE` ergänzen.
- 🔑 **Vertreter-Zugang („Bevollmächtigter“) — `docs/zukunft/VERTRETER-ZUGANG.md`** (Idee Jonas,
  geklärt 02.10.2026: Funktion für Vermieter, kein Betreiberthema). Eigene Anmeldung mit Rechten
  und Protokoll statt geteiltem Passwort; Bank/Steuer/Löschen standardmäßig gesperrt. Berührt
  alle RLS-Regeln → erst Prototyp an einer Tabelle, nach dem Mieterportal-Ausbau, zusammen mit
  den Team-Zugängen des Business-Accounts.
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
- **Demo-Konto ist NUR-LESEN (seit 30.08.2026) — und zeigt seit 30.09.2026 die Kaufgründe.**
  Vorgabe des Betreibers: Schaustück, kein Sandkasten. Drei Ebenen (Begründung `lib/demo.ts`):
  (1) **Datenbank** — seit 30.09.2026 ein BEFORE-**Anweisungs**-Trigger `demo_schreibsperre`
  auf jeder RLS-Tabelle (Migration `20260930150643`), der für das Demo-Konto einen FEHLER
  wirft. Die restriktiven Policies (`20260830150000`) bleiben als zweite Linie.
  **Warum der Trigger:** Die Policies filterten UPDATE/DELETE STILL weg (0 Zeilen, kein
  Fehler — nachgemessen) → jede Action meldete „gespeichert". **Warum Anweisungs- statt
  Zeilen-Trigger:** Ein Zeilen-Trigger feuert nie, weil die Policy keine Zeile durchlässt.
  **Warum SECURITY DEFINER:** `ist_demo_nutzer()` darf nur `authenticated`/`anon` — ohne
  DEFINER scheiterte die SERVICE-ROLE (Demo-Reset, Wert-Cron, Zugriffsbremse). In einer
  zurückgerollten Transaktion bewiesen: Demo wirft, fremdes Konto schreibt, Reset läuft.
  (2) **Routen** — `demoDarfRoute`. FREI: Dashboard, Objekte, Mieter, Ein-/Ausgaben, Kauf/
  Verkauf, **Mietkonto, Verbrauch, Kredite, Steuer, Jahresbericht, Termine, Marktwert,
  AfA, NK-Abrechnung, Übergabeprotokoll, seit Phase 3 auch Mieterportal und Archiv** +
  LESENDE API-Routen (Anlage-V-/Jahresbericht-PDF, DATEV, CSV, Kreditantrag, Datei-Ansicht).
  GESPERRT: Makler (keine Beispieldaten — leere Seite wirbt schlechter als der Sperr-Dialog),
  Anlegen/Bearbeiten,
  `/api/nk-ocr` + `/api/import-url` (**kosten je Aufruf Geld**), `/api/import`,
  `/api/export/alles`. (3) **Oberfläche** — `DemoNurLesen.tsx`; seit dem Trigger Höflichkeit,
  keine Sicherung mehr.
  **Öffentliche Seiten: `lib/oeffentlich.ts` ist die EINE Liste** für Middleware UND
  Klick-Abfang. Vorher stand sie nur in der Middleware → „Datenschutz" öffnete in der Demo
  den Sperr-Dialog.
  **Beim Anlegen einer neuen Tabelle** greifen Trigger UND Policies NICHT automatisch; beide
  Migrationen erneut ausführen (idempotent).
  **Koordinaten der 6 Demo-Objekte stehen fest im Schnappschuss** (`20260930150903`) —
  sonst geokodierte `/karte` bei jedem Besuch neu (Nominatim-Regeln).
- ⏳ **Demo-Daten laufen mit der Zeit mit (Phase 3, 30.09.2026, Migration `20260930154606`).**
  Vorher endeten alle Buchungen am 01.06.2026 → Ende September stand jeder Mieter als säumig
  da, und die Cashflow-Kennzahl schönte sich selbst (leere Monate senkten den Kostenschnitt).
  `demo_zuruecksetzen(p_heute)` schreibt beim Demo-Start FORT, statt zu verschieben:
  **Mieten aus dem Vormonat** (nur laufende Verträge — sonst zahlt eine geräumte Wohnung),
  **Kosten aus dem Vorjahresmonat** (saisonal), **ganze Jahre** verschoben, sobald eines
  vergangen ist (Anlage V bleibt ein volles Kalenderjahr — beim Verschieben um Monate
  hätte 2025 nur neun Monate gehabt), **eine Miete des laufenden Monats bleibt offen**
  (sonst zeigt die Aufgabenliste nichts). Anliegen und Zählermeldung werden tagesgenau auf
  heute gezogen. **Nachgewiesen** in einer zurückgerollten Transaktion an fünf simulierten
  Stichtagen bis 2028 — `p_heute` existiert genau dafür; `/api/demo` ruft ohne Argument.
  **Mitbehoben:** Das „Reihenhaus Halle" stand als vermietet (1.150 €), der Mieter war zum
  30.09.2025 ausgezogen → Phantom-Soll-Miete auf dem Dashboard. Jetzt Nachmieterin ab
  01.11.2025. Dashboard-Cashflow der Demo damit **+518 €** statt +711 € — niedriger, aber wahr.
  **Neue Tabelle in der Demo** braucht DREI Dinge: Trigger + Policies (zwei Migrationen
  erneut ausführen), eine `demo_seed`-Kopie UND einen Eintrag in `tabellen` der
  Reset-Funktion (Besitzspalte `vermieter_id` → auch in `besitz_vermieter`). Der Reset
  überträgt nur gemeinsame Spalten; eine neue Spalte in `public` bricht ihn nicht mehr.
  **KORRIGIERT 30.09.2026 (Migration `20260930162539`) — war KEIN Schönheitsfehler:** Die
  Mietbuchungen hießen „Warmmiete …", trugen einen NK-Anteil, der Betrag war aber ~Kaltmiete
  (Krüger 840 € mit 150 € NK → rechnerisch 690 € kalt). Das verfälschte Anlage V (Miete vs.
  Umlagen) und NK-Abrechnung, nicht nur Summen. Jetzt Betrag = Kalt + NK (+ Stellplatz) des
  Vertrags, NK-Anteil = Vorauszahlung. Dazu Kaufdaten (Steuer warnte „Kein
  Anschaffungsdatum") und Kredit-Auszahlungen, aufeinander abgestimmt.
  **Rauchtest-Weg `aktuell`** prüft live, dass eine Buchung vom 1. des laufenden Monats da ist.
- 🔕 **Zwei Wächter, die die Demo mitgebracht hat, gelten für die ganze App (30.09.2026):**
  `tests/toastTyp.test.ts` — **ein Fehler-Toast nennt seinen Typ**: `toast()` ist ohne
  zweites Argument „success", 24 Stellen zeigten Fehlschläge mit grünem Haken.
  `tests/aktionsAntwort.test.ts` — **keine verworfene Action-Antwort** (`await x();` als
  Anweisung) für Actions, die `{ error }` zurückgeben; und **werfende** Actions stehen in
  einem `try {` (sonst reicht React 19 den Fehler aus der Transition an die Fehlerseite
  weiter, oder er verpufft im onClick). Welche Action wirft, leitet der Test aus
  `lib/actions/` ab. **Fallstrick beim Bauen:** Die erste Fassung suchte das WORT `try` und
  wurde vom Kommentar „Ohne try/catch …" darüber getäuscht — dritte Wiederholung derselben
  Falle (Kommentare im Textmuster). **Das Konstrukt suchen, Kommentarzeilen auslassen.**
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
  Binnennavigation für lange Mobilseiten.
  **11px → 12px, Stand 08.09.2026 nachgemessen — die Notiz hier war zu klein gedacht:**
  Es gibt keinen zentralen Schalter, und „sukzessive" verdeckte 376 Einzelstellen.
  Von 399 Fundstellen „11px" sind viele **Abstände** (`padding: 11px 13px`, `top: -11px`),
  kein `font-size` — pauschales Ersetzen zerlegt Layouts. Echte Schriftgrößen:
  20 Regeln in `globals.css` und **356 inline `fontSize: 11` im JSX** von 30+ Komponenten.
  **Was gemacht ist:** Die 16 App-Regeln in `globals.css` hängen jetzt am Token
  **`--text-xs`** (die Landing ausdrücklich NICHT — Token-Freeze; `tests/landingLayout.test.ts`
  hält beides fest). Damit ist die Umstellung für die App-Oberfläche **eine Zeile**.
  **Was offen ist und warum:** Der Schalter steht bewusst noch auf 11px. Ein Pixel mehr
  kann in `.tz-rest` (feste Breite 84px), in Badges und in gesperrt gesetzten
  Großbuchstaben-Labels umbrechen — **das muss jemand ansehen**, kein Test findet es.
  Vorgehen: Token auf 12px, Seiten durchklicken, bei Bruch eine Zeile zurück.
  Die 356 Inline-Stellen brauchen je eine eigene Entscheidung; sie sind dichte
  Datenansichten, in denen 11px verteidigbar ist.
  (Die Chart-Gradients im Cashflow-Donut sind seit dem UX-Audit-Paket B abgelöst.)
- 📭 **Leerzustände: `components/Leer.tsx` (08.09.2026).** Für einen neuen Nutzer ist die
  leere Ansicht die HÄUFIGSTE Ansicht der App — am Anfang ist alles leer. Etwa die Hälfte
  der 20 Stellen war eine Sackgasse („Noch keine Daten", Ende).
  **Zwei Sorten leer, die nicht verwechselt werden dürfen:** `art="nichts"` (noch nichts
  angelegt → erklären + Knopf) und `art="filter"` (es GIBT Daten, nur passt keine zur
  Suche → **kein** Anlegen-Knopf; „Lege deine erste Buchung an" ist dort schlicht falsch).
  Genau diese Verwechslung steckte in `/termine`, wo `sichtbar` fünffach gefiltert wird.
  **Regel: Ein Leerzustand erklärt sich in einem Satz.** `text` ist im Baustein **nicht**
  optional; `tests/leerzustaende.test.ts` wird sonst rot. **Die Überschrift ist NICHT
  Pflicht** — acht Stellen haben einen guten Satz ohne `<h4>` und sind damit in Ordnung.
  Wo die Kopfzeile des Abschnitts schon einen „Hinzufügen"-Link hat (Objekt-Detailseite),
  bekommt der Leerzustand **keinen zweiten Knopf**, nur die Erklärung.
  🙈 **Der Wächter war zuerst selbst blind:** Er schnitt den Block bis zum ersten `</div>`
  — und hielt `<div className="empty-icon">📊</div>` für das Ende, wodurch der erklärende
  Satz dahinter nie gesehen wurde und eine tadellose Stelle als Sackgasse galt. Jetzt zählt
  er die Verschachtelung; eine Mutation hält das fest. **Dieselbe Falle wie bei
  `schreibFehler.test.ts` — Textmuster über JSX brauchen eine echte Klammerzählung.**
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
- **Businessplan (aktuell, als PDF): `docs/business/MyImmo-Businessplan-2026-09.pdf`.** Die Juli-Fassung daneben ist überholt (führte die entfernte Konto-Anbindung als gebaut) — nicht herausgeben. NICHT von
  Hand neu bauen — der komplette Plan wird per Skript erzeugt: **`node scripts/gen-businessplan-pdf.mjs`**
  (Sekunden). Inhalt/Zahlen/„Stand"-Datum nur in der `SECTIONS`-Struktur des Skripts anpassen, dann
  neu erzeugen. Titelseite trägt die Dokument-Wortmarke (My+Immo), Design = MyImmo-Dokument-Stil.
- **Masterplan (Markt/Compliance/Steuer-Features/Roadmap): `docs/MASTERPLAN.md`** (15.07.2026).
- **Onboarding-Briefing (aktuell, für neue Chats/Sessions ZUERST lesen): `docs/BRIEFING.md`**.
- 🔍 **Gesamt-Audit 01.10.2026: `docs/AUDIT-2026-10-01.md`** — sechs lesende Durchgänge (Links,
  öffentliche Strecke, UX, Browser, Zahlen, adversarial) über Website, App, Datenbank; jede
  A-Stelle selbst nachgeprüft. **12 A · 36 B · 40 C**, dedupliziert, mit PR-Paketen. Die vier
  schwersten: `konto_freischalten()` ist per REST ohne Code aufrufbar (A1); das 2FA-Gate liest
  die Faktorliste aus dem **Cookie** (A2) und Actions/Routen verlangen nur aal1 (A3); Mieter
  lesen per REST die ganze Objekt-/Mieterzeile (A4). Dazu: Early-Access-Weg endet am Code-Feld
  ohne Anfrageweg, AGB-Platzhalter live, werfende Formular-Actions, Dashboard-Aufgaben von
  Kreditfristen verdrängt, `og.png` hinter dem Login. **Bevor etwas davon als „offen" neu
  gefunden wird: dort nachsehen.** Lehren in Abschnitt 7 (u. a. `curl -I` täuscht beim
  Login-Gate; Cookie-Inhalte sind Nutzereingaben).
  ✅ **Paket 1 + 2 erledigt 01.10.2026** (Migration `20261001090000_audit_paket1_rechte`,
  `tests/auditPaket2.test.ts`): `konto_freischalten()`/`einladungscode_pruefen()` nur noch
  Service-Role — die Action `schalteKontoFrei` schreibt selbst per Admin-Client,
  `pruefeEinladungscode()` ersetzt den Browser-RPC-Aufruf (HMAC-Bremse statt IP-Klartext);
  Einladungscodes an den Aussteller gebunden; `vermieter_anfragen` Spaltenschutz; `og.png`/Logo
  öffentlich; Samstag kein Werktag (`dritterWerktag`); `/api/export` (JSON) GELÖSCHT;
  `flashUrl(url, msg, "error")` für Fehler-Flashes; `?tab=` in den Einstellungen; Sitemap ohne
  noindex-Seiten und ohne `lastModified` auf statischen Seiten.
  ✅ **Paket 3 erledigt 01.10.2026** (`tests/auditPaket3.test.ts`): `lib/preise.ts` hat jetzt
  `KONTAKT_EMAIL`, `EARLY_ACCESS_MAILTO`, `HILFE_MAILTO`, `EARLY_ACCESS_ZUSAGE` und
  **`ctaBeschriftung(wunsch)`** — JEDER Start-Knopf der öffentlichen Strecke läuft da durch
  (Ratgeber-Daten dürfen sich eine Beschriftung wünschen, gerendert wird `START_CTA`, solange
  `REGISTRIERUNG_OFFEN = false`; `tests/heute.test.ts` prüft alle (pub)-Seiten). `/anmelden`
  und das Code-Feld im Registrierformular zeigen den Anfrageweg (mailto + 24-h-Zusage);
  `/login`/`/anmelden` haben „Hilfe & Kontakt“. **Abmelde-Grund:** `AutoLogout` schickt
  `/login?grund=inaktiv&min=N` bzw. `geschlossen`, der Proxy setzt `grund=abgelaufen`, wenn
  ein `sb-…-auth-token`-Cookie da war, aber nicht mehr gilt; die Login-Seite erklärt alle drei.
  ✅ **Paket 4 erledigt 01.10.2026 — 2FA ernst** (`lib/auth/faktorNachweis.ts`,
  `aalStandAus()` in `lib/auth/sitzung.ts`, 10 neue Proxy-/2FA-Tests, neun Mutationen rot):
  **(A2)** Der Faktorstatus kommt nur noch vom SERVER — `aalStandAus(user.factors, token)`
  mit `user` aus `getUser()` und `aal` aus dem signierten Token. Layout (kein Zusatzaufruf,
  `aktuellerNutzer()` liefert `factors` mit) und `pruefeFrischeAnmeldung()` nutzen es.
  **Server-Code ruft `getAuthenticatorAssuranceLevel()` NIE mehr ohne JWT-Argument** — die
  Bibliothek liest dann `session.user.factors` aus dem Cookie, das der Browser schreibt; der
  Prüfstand wirft bei diesem Aufruf. **(A3)** `proxy.ts`: aal1-Sitzung auf jedem Pfad außer
  `mfaAusgenommen()` (`/login`, `/auth/*`, statische Dateien) → einmal `getUser()`; Konto mit
  bestätigtem Faktor → GET-Seite `/login?mfa=1&next=`, **POST/API 403 JSON `{ mfa: true }`**;
  kein Faktor → signierter Nachweis `mi_faktor` (HMAC über `DATA_ENCRYPTION_KEY`, an die
  Nutzer-ID gebunden, **10 min**) erspart die nächsten Nachfragen; positives Ergebnis wird nie
  gemerkt; Auth-Server-Fehler → fail-closed (`grund=abgelaufen`). **In Kauf genommen:** Eine
  fremde aal1-Sitzung mit frischem Nachweis läuft nach der Einrichtung eines Faktors bis zu
  10 min weiter. **Nicht gelöst (bewusst, zweiter Schritt):** der PostgREST-Direktweg — RLS
  kennt `aal` nicht; dafür bräuchte es Policies mit `auth.jwt()->>'aal'` auf 47 Tabellen.
  **(B3)** `<ZweiFaktor absichern={…}>` — Einrichten erst nach Re-Auth (`useReAuth` im
  `SicherheitPanel`). **Regel: `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` ist im
  Server-Code verboten; `aalStandAus(user.factors, session.access_token)` benutzen.**
  ✅ **Paket 5 + 6 erledigt 01.10.2026** (`tests/auditPaket56.test.ts`, sieben Mutationen rot):
  **(A4)** Migration `20261001120000_mieter_sicht_spalten`: Zeilen-Policies
  `properties_select_zugang`/`mieter_select_zugang` ENTFERNT; das Mieterportal liest die
  Sichten **`mieter_portal`** (16 Spalten des Mietverhältnisses — ohne `notiz`, `miethistorie`,
  `iban`, `kaution_bank`, `email`, `telefon`) und **`properties_portal`** (`id, bezeichnung,
  adresse, typ`). Sichten laufen als Eigentümer (kein `security_invoker`), filtern selbst über
  `mieter_zugaenge` auf `auth.uid()`, `security_barrier`. **Live als echter Mieter geprüft**
  (`set_config('role','authenticated')` + JWT-Claims, zurückgerollt): Tabellen 0 Zeilen, Sichten
  1, Tenant-Policies auf `einnahmen`/`anliegen` unverändert. **Regel: Ein Mieter liest nie eine
  Vermieter-Tabelle direkt — nur eine Sicht mit den Spalten, die das Portal zeigt.**
  **(A8)** `kreditFristen`: „Zinsbindung endet“ nur im letzten Jahr `warn`, „Anschlussfinanzierung
  vorbereiten“ erst 60 Tage vor dem Vorlauf-Zeitpunkt; das Dashboard zählt ALLE Aufgaben
  (`baueHeuteAufgaben(…, Infinity)`), zeigt die 6 wichtigsten und sagt „N Sachen · die 6
  wichtigsten hier“. **(A9)** `lib/kauf/marktwert.ts`: `RND_MINDESTANTEIL = 0.3` (24 Jahre) mit
  Hinweis in `unsicher` — Altbau 1911 ergab vorher 7.022 €. **(A10)** `heuteBerlin()` in
  `lib/zeitraum.ts` ist der EINE Stichtag; `aggregate()` nimmt ein ISO-Datum (Zahlen, keine
  Ortszeit), `BetragChart` bekommt `heute` als Prop — **Regel: In einer serverseitig
  gerenderten Client-Komponente nie `new Date()` für eine Darstellung; den Stichtag vom Server
  übergeben.** **(B24)** `.heute-zeile` wickelt < 560 px um (`.heute-label`). **(B27)** Die drei
  Buchungslisten und die Objektliste unterscheiden `gefiltert` (Filter anpassen) von „nichts“
  (anlegen); `BetragChart` ebenso (Buckets alle 0 ≠ keine Punkte). **(C30)** Dashboard und
  `/termine` laden `staffel_intervall/betrag/prozent/stufen` — die Staffel-Logik in
  `mieterFristen` lief vorher nie.
  🧑‍💼 **Demo-Mieter (01.10.2026) — das Mieterportal hat jetzt einen Rauchtest.** Bis dahin war
  `/portal` der einzige Nutzerbereich ohne jede automatische Prüfung (kein Mieter-Konto; die
  Audit-Agenten hatten die Reiterleiste mit CSS *nachgestellt*). Jetzt: zweites Demo-Konto
  **`demo.mieter@myimmo.test`** (`DEMO_MIETER_EMAIL` in `lib/demo.ts`, Passwort =
  `DEMO_PASSWORT`), angelegt von **`/api/demo?rolle=mieter`** per Service-Role (idempotent),
  nach JEDEM Reset per `demo_mieter_verknuepfen()` (Migration `20261001150000`) mit Sophie
  Berger (`f3fd40b4…`, Wohnung `d560ceb5…`) verknüpft — der Reset schreibt die Anliegen ohne
  `mieter_user_id` neu, die Verknüpfung hängt das Beispiel-Anliegen wieder um. `ist_demo_nutzer()`
  erkennt den Mieter über den signierten E-Mail-Claim (seine uid entsteht erst auf Vercel);
  `istDemoKonto()` kennt beide Adressen; `/portal` und `/konto` stehen in `ERLAUBTE_PRAEFIXE`;
  die Mieter-Shell zeigt `DemoNurLesen` + `DemoLeiste`. **Rauchtest:** zweite Anmeldung
  (2 von 6 je 300 s), prüft Wohnung/Anliegen/Zahlungen/Dokumente/Zähler, `/konto` und dass
  `/steuer` für den Mieter auf `/portal` endet. `tests/demoMieter.test.ts`, vier Mutationen rot.
  **Falle:** `mieter_zugaenge` gehört NICHT zum Reset — die Verknüpfung überlebt ihn; die
  Anliegen-Zuordnung nicht. Wer eine neue Mieter-Beispieltabelle anlegt, trägt sie in
  `demo_mieter_verknuepfen()` nach.
  👁️ **Mieterportal-Vorschau (01.10.2026, Wunsch des Betreibers):** Reiter „Vorschau
  Mieter-Sicht" unter `/anliegen?tab=vorschau&mieter=…&portal=…` — der Vermieter sieht das
  Portal mit den Augen eines eigenen Mieters, ohne zweites Konto. **EIN Lader, EINE
  Darstellung:** `lib/portalDaten.ts` → `ladePortalDaten(db, quelle)` und
  `components/PortalAnsicht.tsx`, benutzt von `/portal` UND der Vorschau. Die Filter, die
  beim Mieter die RLS übernimmt (nur Miete/Nebenkosten, nur `mieter_freigabe`, nur die
  Spalten der Sicht `MIETER_PORTAL_SPALTEN`), stehen AUSDRÜCKLICH in der Abfrage — beim
  Vermieter sind sie die einzige Schranke, sonst zeigt die Vorschau mehr als das Portal.
  Formulare laufen mit `nurLesen` (Platzhalter `VorschauHinweis`), Konto/Abmelden sind
  Attrappen. Anliegen und Zählerstände hängen am KONTO des Mieters — ohne Einladung zeigt
  die Vorschau sie (wahrheitsgemäß) leer und sagt es. `tests/portalVorschau.test.ts`,
  elf Mutationen rot; Rauchtest-Weg `portal-vorschau`. **Regel: Eine neue Portal-Abfrage
  kommt in `ladePortalDaten`, nie direkt in eine der beiden Seiten.** Die drei
  Portal-Komponenten stehen seitdem NICHT mehr in der Ausnahmeliste von
  `tests/demoWege.test.ts` — sie rendern jetzt auch beim (Demo-)Vermieter.
  🔧 **Demo-Service + „Ansichten nur in der Demo" (01.10.2026).** Drei verknüpfte
  Service-Konten (`DEMO_SERVICE_KONTEN` in `lib/demo.ts`, Hausmeister ist das
  Anmeldekonto, `/api/demo?rolle=service` → `/service`), angelegt und verknüpft VOR dem
  Reset über `demo_service_verknuepfen()` (gibt fehlende Konten zurück). **Warum vor dem
  Reset:** Der Trigger `auftraege_service_spaltenschutz` setzt `service_user_id`,
  `mieter_id`, `prop_id` … bei jedem UPDATE zurück, das nicht der Vermieter selbst
  macht — die Service-Role ist es nicht. Aufträge bekommen ihren Partner deshalb beim
  EINFÜGEN (Schnappschuss-Spalte `service_email`). Schnappschuss: 5 Firmen, 6 Aufträge,
  1 Firmen-Zusage (Migration `20261001180100`).
  ✅ **Reset angewendet (01.10.2026, Betreiber im SQL-Editor):** Migration
  `20261001180200_demo_service_reset.sql` — `apply_migration` lief auch MIT Betreiber in
  der Sitzung in den Timeout, weil der `delete`-Bestätigungsdialog der Supabase-
  Schnittstelle den Betreiber in der Cloud-Sitzung nicht erreichte (dreimal belegt, auch
  wenn `delete` nur im Funktionstext steht). **Nicht umgangen** (z. B. Schlüsselwort
  zerlegen) — die Schranke ist genau dafür da; Weg bei Wiederholung: Datei im SQL-Editor
  ausführen, danach `pg_get_functiondef` prüfen, README-Zeile „manuell im SQL-Editor".
  **Lehre:** Ein Timeout bei `apply_migration` ist kein Netzfehler, wenn die Anfrage
  `delete` enthält — erst nach `pg_stat_activity` sehen (nichts hing), dann den Inhalt
  eingrenzen (kleine Abfragen gingen, jede mit `delete` nicht). Der Rauchtest prüft seitdem
  Firmen („Heizung & Sanitär Böhm") und Aufträge („Dachrinne verstopft") in beiden Sichten.
  **Ansichten:** `ANSICHTEN_NUR_DEMO = true` + `ansichtenSichtbar(email)` in `lib/demo.ts`
  — „Ansicht Mieter" und „Ansicht Service" im Mieterportal NUR für Demo-Konten (Vorgabe des
  Betreibers), auch nicht per Adresse erreichbar. Service-Ansicht: `lib/servicePortalDaten.ts`
  + `components/ServicePortalAnsicht.tsx` (EIN Lader, EINE Darstellung für `/service` und
  die Ansicht). **Ausfüllen ja, Senden nein:** `AuftraegePortal vorschau` und
  `ServiceManager demo` — Formulare bedienbar (`data-demo-erlaubt`), Senden-Knopf aus mit
  `VORSCHAU_NICHT_GESENDET`. **Dabei gefunden:** Die Mieter-Auswahl der Vorschau war in der
  Demo gesperrt (DemoNurLesen schaltet JEDES `select` ab) → `data-demo-erlaubt` am Label.
  `tests/demoService.test.ts`, neun Mutationen rot (eine erst nach Nachschärfen).
  **Regel aus dem Audit: Eine
  SECURITY-DEFINER-RPC, die etwas freischaltet, darf nicht für `authenticated` ausführbar sein,
  wenn die Prüfung nur in der Action davor sitzt.**
- **Externes Feedback vom 01.10.2026 (Vision „Betriebssystem für private Vermieter“, Bank +
  KI): `docs/FEEDBACK-BEWERTUNG-2026-10.md`.** Kern: Die Seite beschreibt es richtig, der
  Plan passt nicht — **Nutzungsproblem, kein Funktionsproblem** (21 echte Konten, 4 in 30
  Tagen angemeldet, 7 neue Buchungen in 30 Tagen über alle, 1 Mieter im Portal). Plan:
  Phase 0 Betreiber-Entscheidungen (Zugang, 5 Vermieter begleiten, Anwalt) → Startseite
  schärfen → Aktivierung (Objekt-Check, Monatsmail) → CSV-Kontoauszug-Abgleich statt Open
  Banking → regelbasierter Portfolio-Check statt KI-Chat. **Vor neuen Funktionen dort nachsehen.**
  ⚠️ **KORREKTUR (Betreiber, gleicher Tag): Die 10 Vermieter-Konten mit Objekt sind
  TESTKONTEN.** Es gibt noch keine echten Nutzer — MyImmo ist nicht gestartet. „5 Vermieter
  begleiten“ entfällt; Bank/KI bleiben zu früh, jetzt mangels echter Nutzer.
  🚪 **Anfrageweg ABGESCHAFFT (01.10.2026, Vorgabe des Betreibers):** Jeder Start-Knopf der
  öffentlichen Strecke zeigt **„Coming soon“ — nicht klickbar** (`components/StartCta.tsx`,
  `.start-bald { pointer-events: none }`), kein mailto, keine 24-h-Zusage, kein Menüpunkt, in
  der Demo kein Knopf zur Registrierung. **Der Beta-Code bleibt im Registrierformular**;
  Testnutzer kommen über „Anmelden“. `REGISTRIERUNG_OFFEN = true` in `lib/preise.ts` stellt
  alles auf einmal zurück auf „Kostenlos starten“ als Link. `tests/auditPaket3.test.ts`.
  **Regel: Kein neuer Start-Knopf ohne `StartCta`.**
  📬 **„Beim Start benachrichtigen“ (01.10.2026, Vorgabe des Betreibers: „dezent“):**
  `components/landing/StartBenachrichtigung.tsx` — eine Textzeile im Schlussabschnitt
  (Startseite + `Shell`), Formular erst auf Klick, nur bei `!REGISTRIERUNG_OFFEN`. Läuft über den
  Vorlagen-Double-Opt-in mit `quelle: "start"`, aber mit EIGENEM Wortlaut
  (`EINWILLIGUNGSTEXT_START`, gespeichert wie angezeigt), eigener Mail und Rückweg `/?nl=…#bald`.
  **Beim Start:** Empfänger = `newsletter_anmeldungen` mit `quelle = 'start'`, bestätigt, nicht
  abgemeldet. Kein eigenes Brevo-Attribut (ein im Konto nicht angelegtes Attribut kann den Eintrag scheitern lassen) — segmentieren
  über die Datenbank. **Grenze:** Eine Adresse, die schon für Vorlagen bestätigt ist, bekommt
  „schon eingetragen“ und behält den Vorlagen-Wortlaut (eine Zeile je Adresse); die
  Startankündigung fällt dort unter „gelegentliche Hinweise für Vermieter“.
  ✅ **Phase 1 (Startseite) erledigt 01.10.2026:** Hero „Deine Immobilien. Ein System. Von überall.“
  (geschützte Leerzeichen, sonst „Ein / System.“ — im Browser gesehen), Kennzahl „1–24 Einheiten“
  statt „13+ Funktionen“, Abschnitt „Deine Daten gehören dir“ (`VERTRAUEN` in
  `components/LandingPage.tsx`, jeder Satz per `tests/startseite.test.ts` an seinen Code-Beleg
  gebunden), Fuß „derzeit kostenlos“ statt „kein Abo“.
- **Externes Feedback vom 08.09.2026, geprüft und mit Plan: `docs/FEEDBACK-BEWERTUNG-2026-09.md`.**
  Zwölf Behauptungen, elf gegen den Code bestätigt (Speed Insights vs. „keine Analyse-Tools",
  Platzhalter in der Datenschutzerklärung, Demo-Text widerspricht Nur-Lesen, „Fristen &
  Aufgaben" ist der LETZTE Dashboard-Abschnitt, keine 2FA, Auto-Abmeldung aus). Der Plan
  dort ist nach Nutzen je Stunde sortiert: erst der Sofort-PR (Wahrheitskorrekturen, < 3 h),
  dann 2FA, dann „Heute wichtig" nach oben. Nicht mit dem Dashboard-Umbau anfangen, solange
  die Datenschutzerklärung einen Platzhalter enthält.
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
  **Search-Console-Adressänderung: entfällt** (Betreiber, 01.09.2026). Die Property war
  durchgehend `.de`; `.store` war nie eine. Eine Adressänderung verschiebt Signale von einer
  alten verifizierten Property auf eine neue — hier gibt es nichts zu verschieben, weil
  `.store` nie eigene Inhalte oder Verlinkungen aufgebaut hat, sondern nur dieselbe App unter
  der falschen Adresse auslieferte. Die 308er führen den Index von allein zusammen; das
  dauert Wochen, mehr bewirkt eine Adressänderung auch nicht.
  **Damit ist das Domain-Thema vollständig abgeschlossen** — offen bleibt nur die Geduld.
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
- 🔑 **`revoke ... from anon, authenticated` allein wirkt im `public`-Schema NICHT** (08.09.2026
  am eigenen Leib erlebt). Supabase vergibt `EXECUTE` dort an die Rolle **PUBLIC**; anon und
  authenticated erben es von da. Nach jedem Revoke `proacl` nachsehen: Steht dort weiter ein
  Eintrag, der **mit `=` beginnt** (`=X/postgres`), hat der Revoke nichts bewirkt — es braucht
  zusätzlich `from public`. Migrationen `20260908122320` (wirkungslos) und `20260908122404`.
  Trigger-Funktionen dürfen bedenkenlos entzogen werden: Postgres prüft `EXECUTE` beim
  **Anlegen** des Triggers, nicht beim Auslösen (in einer zurückgerollten Transaktion mit
  einem Probe-Konto in `auth.users` nachgewiesen, statt es anzunehmen).
- 🕵️ **Zugriffsbremse speicherte IP-Adressen im Klartext — behoben 08.09.2026.**
  `darfWeiter()` gab die rohe Besucher-IP als Teil des Schlüssels an
  `rate_limit_pruefen`; in `zugriff_limit` lagen daraufhin **29 Zeilen, alle 29 mit
  IP im Klartext**, die älteste neun Tage alt — **gelöscht wurde nie** (`on conflict
  do update` setzt nur den Zähler zurück, die Zeile bleibt). Über
  `newsletter_adresse` wäre zusätzlich die **E-Mail-Adresse** so gelandet.
  Gefunden wurde das nicht durch Lesen, sondern durch Nachzählen in der Datenbank.
  **Jetzt:** `lib/net/bremse.ts` → `kennzeichen()` schickt nur noch einen HMAC
  (`blindIndex()` aus `lib/crypto/secure.ts`). **HMAC, nicht bloßes Hashen** — ein
  SHA-256 über eine IPv4 ist in Sekunden rückrechenbar, es gibt nur ~4 Mrd. davon.
  Fehlt `DATA_ENCRYPTION_KEY`, wird auf SHA-256 zurückgefallen (schwächer, aber die
  Bremse darf an einer fehlenden Env nicht scheitern) — **nie auf Klartext**.
  Dazu Migration `20260908143000`: Altbestand gelöscht, Zeilen älter als 24 h werden
  bei ~1 % der Aufrufe aufgeräumt (kein Cron, der unbemerkt ausfallen kann), und das
  Aufrufrecht ist `public, anon, authenticated` entzogen — die App ruft die Funktion
  ausschließlich über die Service-Role auf, ein angemeldeter Nutzer hätte sonst
  fremde Zähler hochtreiben und z. B. den Zugangscode-Versuch anderer blockieren
  können. **Nach dem Entzug live geprüft**, nicht angenommen: Rauchtest grün.
  **Regel: Was in `darfWeiter()` als Kennung hineingeht, ist personenbezogen —
  IP, E-Mail, Konto-ID. Es verlässt die App nur als HMAC.**
  `tests/zugriffsbremse.test.ts` wird sonst rot (fünf Mutationen geprüft).
- **Security-Advisor, Stand 08.09.2026 — was BEWUSST offen bleibt:** `billing_einstellungen`
  und `registrierung_freigaben` haben RLS an und **keine** Policy. Das ist Absicht und
  fail-closed: Beide werden ausschließlich von SECURITY-DEFINER-Funktionen gelesen, eine
  Policy würde den Zugang nur öffnen. Die 13+17 Meldungen zu SECURITY-DEFINER-Funktionen
  sind die öffentlichen Token-RPCs (`beleihung_public_*`, `bewerbung_*`, `einladungscode_*`) —
  die MÜSSEN von `anon` aufrufbar sein, das ist ihr Zweck; sie prüfen das Token selbst.

## Sicherheit der Abhängigkeiten
- ✅ **Next-16-Migration UMGESETZT (30.09.2026): Next 16.3.8, React 19.2.8.** Die hohe
  `postcss`-Meldung ist damit geschlossen; `npm audit` meldet nur noch 3 Befunde, **alle nur
  Entwicklung** (vitest < 4.1.11, `brace-expansion` im ESLint-Baum). Details:
  `docs/SICHERHEIT-ABHAENGIGKEITEN.md`, Abschnitt 30.09.2026.
  **Was sich im Code geändert hat:** (1) **`middleware.ts` heißt jetzt `proxy.ts`**, die
  Funktion `proxy` — Laufzeit Node statt Edge (für uns folgenlos: `btoa`/`crypto.randomUUID`
  gibt es dort, Funktion und Datenbank liegen in Frankfurt). Alle Verweise „Middleware" in
  Kommentaren meinen diese Datei. (2) **`data-scroll-behavior="smooth"` an jedem `<html>`**
  (beide Root-Layouts, sechs Stellen): `globals.css` setzt `scroll-behavior: smooth`, und
  Next 16 schaltet das beim Seitenwechsel NICHT mehr selbst ab — ohne das Attribut würde
  jeder Seitenwechsel sichtbar nach oben scrollen. (3) **Turbopack** baut jetzt (Standard,
  kein eigenes Webpack im Projekt). (4) **ESLint eigenständig** (`eslint.config.mjs`,
  `npm run lint` = `eslint .`).
  **Geprüft:** tsc, 1.331 Tests, Turbopack-Build; Routentabelle gegen Next 15 verglichen
  (keine Seite von statisch auf dynamisch gerutscht); lokaler Server gegen die Live-Seite:
  gleiche Weiterleitungen (Login, Recovery-Links, `/auth/callback`), gleiche Header, jedes
  Inline-Skript mit Nonce; im Browser alle öffentlichen Seiten hydriert, keine CSP-Fehler,
  weiche Navigation. Der angemeldete Teil nur über den Rauchtest nach dem Deploy (Chromium
  erreicht Supabase aus der Remote-Umgebung nicht).
  **Live nach dem Deploy (PR #347):** Rauchtest 16/16 grün; CSP-Nonce kommt weiter aus dem
  Proxy; TTFB unverändert im Rahmen der Streuung (min 393–480 ms, Median 533–621 ms);
  Seiten 5–6 KB kleiner. **Rückfall, falls nötig:** Vercel Instant Rollback auf den letzten
  Next-15-Stand `dpl_LRgMzU1c5Kb47uKKjht63FFQCaLp`.
  **Falle beim Prüfen (erneut):** `pkill -f "[n]ext start"` in DERSELBEN Befehlszeile wie
  `npx next start …` trifft die eigene Shell (Exit 144) — das Muster schützt nur, wenn der
  Text nicht woanders in der Zeile steht. Aufräumen und Starten in getrennte Aufrufe.
  🧹 **Lint-Altlast, erster Lauf überhaupt: 93 Fehler, 39 Warnungen** (552 Dateien).
  Größte Posten: `react/no-unescaped-entities` 40 (Anführungszeichen im JSX-Text, harmlos),
  `react-hooks/set-state-in-effect` 25, `@typescript-eslint/no-explicit-any` 12,
  `react-hooks/purity` 4. ✅ `react-hooks/static-components` 7 → 0 (30.09.2026, jetzt
  **86 Fehler**): `Block` (Bewerbungs-Steckbrief), `RLink` (Einstellungen) auf Modulebene,
  `DateiZeilen` (BewerbungForm) als Renderfunktion. **Kein echter Fehler dahinter** — die
  Steckbrief-Seite ist eine Server-Komponente, die beiden anderen ohne eigenen Zustand;
  es war Hygiene. **Regel: Komponenten nie innerhalb einer Komponente definieren.**
  Blockiert nichts (Next 16 lintet beim Build nicht mehr) — **als eigenes Vorhaben abarbeiten,
  nicht nebenbei.**
  ✅ **Abgebaut 03.10.2026: `npm run lint` = 0 Fehler, 0 Warnungen.** Anführungszeichen im
  JSX-Text anzeigegleich als `&quot;`; `any`-Casts entfernt (der Supabase-Client ist untypisiert,
  sie waren überflüssig); `Date.now()` im Render durch `heuteBerlin()`/Effekt ersetzt; Ref nicht
  mehr im Render geschrieben. **29 Stellen bewusst markiert, nicht umgebaut** (je mit Grund im
  Kommentar): 25× `set-state-in-effect` (Browserwert erst nach dem Mount lesen, Props→Bearbeitungs-
  stand, Zurücksetzen beim Öffnen), 1× synchrones `theme.js` (sonst Flackern), 3× harte
  Navigation (Abmelden, Freischaltung, Datei-Download). Unterstrich-Namen gelten als absichtlich
  unbenutzt (`eslint.config.mjs`). **Regel: Neuer Code hält `npm run lint` bei 0.**
- ✅ **Next-15-Migration UMGESETZT (01.09.2026): Next 15.5.25 / React 19.2.8.** Plan samt
  Umsetzungsbericht: **`docs/zukunft/NEXTJS-15-MIGRATION.md`**; Befundlage:
  **`docs/SICHERHEIT-ABHAENGIGKEITEN.md`**. Alle 21 next-Meldungen geschlossen (25 → 4).
  **Wichtigste Code-Folge:** `createClient()` aus `lib/supabase/server.ts` ist jetzt
  **async** — neue Aufrufstellen brauchen `await createClient()`. Ebenso `besucherIp()`
  und `basisUrl()` (jetzt `lib/net/basisUrl.ts`; Route-Dateien dürfen in Next 15 nur noch
  HTTP-Methoden + Segment-Konfig exportieren). React 19: `useRef` braucht einen Startwert.
  **Rückkehrpunkt: Branch `stand/vor-next15-2026-09-01`** (= letzter 14er-Stand, Commit
  `3ef7ccc`); Tags lässt der Git-Proxy der Remote-Umgebung nicht durch, deshalb ein Branch.
- 🔄 **Monatslauf 10.09.2026 — Befunde und Grenzen: `docs/SICHERHEIT-ABHAENGIGKEITEN.md`.**
  **osv-scanner ließ sich nicht installieren** (kein Go-Modul-Zugang in der Remote-Umgebung)
  → `npm audit`, dieselbe Advisory-Grundlage. **4 Meldungen, davon 1 hoch.**
- **`postcss` — jetzt HOCH, aber weiterhin nur Bauzeit.** Zwei der vier Meldungen sind
  inzwischen hoch eingestuft. **Nachgesehen statt fortgeschrieben:** Es liegen ZWEI postcss
  im Baum — das **direkte** (8.5.26) ist **sauber**, verwundbar ist nur Nexts fest gepinnte
  Kopie `node_modules/next/node_modules/postcss` (8.4.31). Erreichbar nur über CSS, das ein
  Angreifer bestimmt; **CSS-Uploads gibt es nicht** (geprüft). **KEIN npm-`override`.**
  **Neu:** `npm audit` nennt als Behebung **next@16.3.4** — die Next-16-Migration ist damit
  der einzige Weg, diese Meldung zu schließen.
- ⚠️ **Stand 30.09.2026: `npm install` geht wieder TEILWEISE** — `next@16`, ESLint und
  `undici` ließen sich installieren; `npm audit fix` und `vitest@4.1.11` scheitern weiter am
  selben Arborist-Fehler. Nach jeder Installation die Lockdatei auf verlorene Pakete prüfen
  (Paketzahl vorher/nachher). Historie:
- ⛔ **`npm install` funktioniert in der Remote-Umgebung NICHT** (10.09.2026):
  `Cannot read properties of null (reading 'edgesOut')` in Arborist `buildIdealTree` — bei
  jedem Weg, auch mit `--package-lock-only` und nach `rm -rf node_modules`. **Nur `npm ci`
  läuft.** Abhängigkeits-Updates gehen deshalb nur auf einem Rechner mit funktionierendem npm.
  **`--legacy-peer-deps` ist KEIN Ausweg:** Der Versuch ging durch, warf aber **70 Pakete
  aus der Lockdatei** (den ganzen eslint-Baum — `eslint` steht nirgends als Abhängigkeit und
  kam nur als Peer von `eslint-config-next` mit). Tests und Build blieben grün; aufgefallen
  wäre es erst auf Vercel. Wurde vollständig zurückgenommen.
  **Offen für den nächsten Rechner:** `npm install -D vitest@^4.1.11` (schließt
  `GHSA-82fw-gwwq-j7x9`, moderat, **nur Entwicklung** — wer Testcode bestimmt, hat ohnehin
  Schreibrechte am Repo).
- 🧹 ~~**`npm run lint` hat NIE gelint**~~ ✅ eingerichtet mit Next 16 (30.09.2026, siehe oben). Historie: (10.09.2026 gefunden). Es gibt keine
  ESLint-Konfiguration im Repo (kein `.eslintrc*`, kein `eslint.config.*`) — `next lint`
  startet deshalb den interaktiven Einrichtungsdialog. **Nicht nebenbei reparieren:**
  Next 16 entfernt `next lint`; die Einrichtung gehört als eigenständiges
  `eslint.config.mjs` in dieselbe Migration.
- **Scanner (kostenlos, ohne Konto):** `osv-scanner scan source --lockfile=package-lock.json`
  (`go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest`). Vor jedem größeren
  Release laufen lassen, mindestens monatlich. Neue Befunde in der genannten Datei bewerten,
  nicht nur die Zahl weiterreichen.

## Bewegung / Animationen (Regelwerk seit 02.09.2026)
- **Installiert: `emilkowalski/skills`** (`npx skills@latest add emilkowalski/skills`) —
  12 Skills in `.agents/skills/`, per Symlink in `.claude/skills/` eingehängt, MIT-Lizenz.
  Autor ist der Entwickler von Sonner und Vaul. Wichtigste für dieses Projekt:
  **`animate`** (baut Animationen, enthält die Werte-Tabellen), **`review-animations`**
  (prüft einen Diff), **`improve-animations`** (auditiert die Codebasis, schreibt Pläne —
  ändert ausdrücklich KEINEN Quellcode), **`apple-design`**, **`pick-ui-library`**.
- **Verbindliche Regeln, gegen die die App am 02.09.2026 geprüft wurde** (Details und
  Messwerte in `tests/landingLayout.test.ts`):
  kein `transition: all` · kein `scale(0)` als Eingang (stattdessen `scale(.9–.97)` +
  `opacity: 0`) · **nie `ease-in` auf UI** · UI-Dauern unter 300 ms · nur `transform`
  und `opacity` animieren · Hover-**Bewegung** nur hinter `@media (hover: hover) and
  (pointer: fine)` bzw. abgeschaltet in `@media (hover: none), (pointer: coarse)` ·
  `prefers-reduced-motion` gehört zur Animation, nicht als Nachtrag.
- **Fallstrick, der beim Bauen zugeschlagen hat:** Das Touch-Gate hat dieselbe Spezifität
  wie die Hover-Regeln — es muss deshalb **nach** ihnen in `globals.css` stehen, sonst ist
  es wirkungslos. Steht jetzt am Dateiende und ist per Test festgenagelt.
- **Bewusst NICHT geändert:** die bestehenden Easing-Tokens (`--ease-out: cubic-bezier(0,0,.2,1)`).
  Ein globales Token zu drehen ändert jede Animation der App auf einmal. Stattdessen gibt es
  seit Runde 2 **neue** Tokens `--ease-out-stark` (`cubic-bezier(0.23,1,0.32,1)`) und
  `--ease-in-out-stark` — eingesetzt auf der öffentlichen Strecke.
- **Runde 2 (02.09.2026, Auftrag „bessere Layouts und Animationen, modern, komplex, aber
  schnell"):** Recherche-Ergebnis war eindeutig — **CSS scroll-driven animations**
  (`animation-timeline: view()`, ~84 % Abdeckung, Chrome 115 / Safari 18 / Firefox 132)
  laufen außerhalb des Hauptthreads und ersetzen JS-Beobachter. Umgesetzt:
  (1) Einblendung der Abschnitte scroll-getrieben in CSS, hinter `@supports` und
  `prefers-reduced-motion: no-preference`; `Reveal.tsx` legt den IntersectionObserver
  **nur noch als Rückfall** an → Startseite **16 → 1 Beobachter** (gemessen).
  (2) **Druck-Feedback** `:active { scale(.97) }` auf den Marketing-Knöpfen — sie hatten keins.
  (3) **`@view-transition { navigation: auto }`** für Dokumentwechsel (220 ms, bei
  Reduced-Motion `none`). Greift bei Startseite ↔ Unterseite (Root-Layout-Wechsel = echter
  Dokumentwechsel); **innerhalb** der Pub-Strecke navigiert `<Link>` soft, dort bewusst nichts.
  Firefox ohne Cross-Document-VT fällt auf den normalen Wechsel zurück.
  **Zwei Fallstricke, im Browser erwischt:** Das Touch-Gate braucht `:hover:not(:active)`,
  weil Chrome bei Touch Hover **und** Active gleichzeitig setzt — ohne das erwürgt das Gate
  das Druck-Feedback. Und: Playwright-Locators/`networkidle` sind auf dieser Seite
  unzuverlässig; messen mit `document.querySelector` + 2,5 s Wartezeit, `:active`-Kaskade
  per `CSS.forcePseudoState` (synthetische Touch-Events setzen in Headless kein `:active`).

## Build / Test
- `npm run build` zum Verifizieren (braucht die NEXT_PUBLIC_SUPABASE_*-Variablen, Platzhalter genügen für den Build).
- 🟥 **CI braucht Node ≥ 22 (02.10.2026).** `@supabase/realtime-js` 2.108 verlangt natives
  WebSocket; unter Node 20 wirft schon `createServerClient()` → 19 Tests in
  `tests/proxyAnmeldung.test.ts` rot. `.github/workflows/ci.yml` stand auf Node 20 —
  **`main` war dadurch mindestens fünf Pushes lang rot (#382–#386), ohne dass es auffiel**,
  weil GitHub den Merge trotz roter CI zulässt. Behoben in #387 (Node 22). Produktion war
  nie betroffen (Vercel läuft nicht auf Node 20). **Regel: Nach jedem Merge den CI-Lauf auf
  `main` ansehen — „gemergt“ heißt nicht „grün“.**
- 🔥 **`npm run rauchtest` (08.09.2026): sechs Kernwege gegen die LAUFENDE App.**
  Bis dahin hatte kein einziger der 1.167 Tests je eine Seite ausgeliefert — ein
  kaputter Import in einer Server-Komponente oder eine 500er-Seite blieb grün.
  Läuft gegen die Produktion und meldet sich am Demo-Konto an; **nur lesend**.
  **Nicht bei jedem Push:** Der Demo-Einstieg SETZT DEN DEMO-BESTAND ZURÜCK (alle
  Besucher teilen ein Konto) und `/api/demo` bremst bei 6 Aufrufen je 300 s —
  deshalb meldet sich das Skript genau EINMAL an. Vor einem Release, nach einem
  Deploy, bei Verdacht.
  **Was er NICHT prüft:** alles, was erst im Browser passiert (JS-Ausnahmen,
  Hydration, Klick-Ziele, Layout). Der erste Entwurf war ein echter Browser-Lauf
  und ist daran gescheitert, dass Chromium in der Remote-Umgebung durch den
  Proxy keine TLS-Verbindung aufbaut — **kein Fehler der App**; wer den
  Browser-Lauf will, baut ihn auf einem Rechner mit normalem Netzzugang.
  🐞 **Der Test war beim ersten Lauf FALSCH GRÜN — die wichtigste Lehre daraus:**
  `/mietkonto` und `/steuer` sind in der Demo gesperrt und werden auf `/`
  umgeleitet. Das Dashboard enthält „Mietkonto" (Menü) und „€" — die Prüfung
  „Text kommt vor" war also erfüllt, ohne dass die Seite je geladen wurde.
  **Regel: Bei jeder HTTP-Prüfung zuerst feststellen, WO man gelandet ist
  (`endePfad`), erst dann den Inhalt ansehen.** Sonst prüft man die Menüleiste.
  **Und umgekehrt (30.09.2026, falsch ROT):** Die Kartenprüfung suchte `/nicht gefunden/`
  im ganzen HTML — der Ausdruck steckt im mitgeschickten Next-Code, nicht auf der Seite.
  **Regel: positiv prüfen, mit Sätzen, die NUR diese Seite schreibt** (dort: „N Objekte
  auf der Karte"; React trennt Textteile mit `<!-- -->`). Seit Phase 2 deckt der Test
  auch Steuer, Anlage-V-PDF, CSV, Mietkonto, NK, Kredite und Karte ab (13 Wege).
  **Ungeprüft bleiben** Mietkonto, Steuer, Mieterportal, Archiv, Verbrauch,
  Termine — die Demo gibt sie bewusst nicht frei. Der Weg `demo-grenze` deckt
  stattdessen ab, dass die Sperre hält (fällt sie weg, klickt ein Besucher in
  Bereichen herum, deren Speichern stumm an der RLS scheitert). Volle Abdeckung
  bräuchte ein eigenes leeres Vermieter-Konto als Rauchtest-Zugang.
- ⚠️ **`npx vitest run | tail` verschluckt den Exit-Code.** Der Status einer Pipeline ist
  der des LETZTEN Befehls. `vitest … | tail -3 && git commit` committet also auch bei
  roten Tests — so ist #317 mit einem roten Test durchgegangen (08.09.2026). Vor einem
  Commit: `npx vitest run > datei; echo $?` oder `set -o pipefail`.
- **Speed Insights entfernt (08.09.2026).** Die Datenschutzerklärung sagt „keine
  Analyse-Tools" — bis dahin lud `@vercel/speed-insights` in allen drei Layouts. Nicht
  wieder einbauen, ohne Ziffer 2 der Datenschutzerklärung zu ändern.
- **Server-Actions testen (seit 04.09.2026): `tests/stubs/actionHarness.ts`.**
  `fakeSupabase()` + `mockeNextUndSupabase()` ersetzen `next/cache`, `next/navigation`
  und die beiden Supabase-Clients — sonst nichts, die Action läuft unverändert.
  `fangeRedirect()` fängt das Redirect-Signal ab (die Attrappe **wirft**, wie Next auch).
  Muster: `vi.resetModules()` → mocken → `await import("@/lib/actions/…")`.
  Vorbilder: `tests/actionsBuchungen.test.ts`, `…Properties`, `…Freischaltung`, `…Bankdaten`.
  **Warum das nötig war:** Bis dahin hatte KEINE Testdatei `lib/actions` je ausgeführt —
  `tests/registrierung.test.ts` durchsucht Actions per `readFileSync` als Text. Solche
  Struktur-Tests halten eine Schreibweise fest, kein Verhalten.
  **Regel für neue Tests hier:** Einen neuen Action-Test erst glauben, wenn er gegen einen
  absichtlich eingebauten Fehler ROT wird. Alle 216 Tests dieser Dateien wurden so geprüft.
  **T2 abgeschlossen 08.09.2026: 35 von 35 Action-Dateien abgedeckt**, 1.068 Tests (`buchungen`, `properties`,
  `freischaltung`, `ibans`, `einladung`, `umlage`, `mietkonto`, `positions`, `wiederkehr`,
  `beleihung`, `service`, `bewerbenPublic`, `anliegen`, `bewerber`, `zaehler`,
  `termine`, `nkco2`, `bewertung`, `makler`, `beleihungPublic`, `archivFreigabe`,
  `importDaten`, `dokumente`, `archiv`, `account`, `billing`, `tenants`, `mietzeitraeume`,
  `einschaetzung`, `kalkulation`, `firmen`, `vermieter`, `dokumentVorlagen`, `selbstauskunft`,
  `vermieterAnfragen`).
  **Vorbild für neue Schreib-Actions: `archivFreigabe.ts`** — `.update().select().maybeSingle()`
  mit `error || !data`; damit fällt auch das RLS-Treffer-Null auf.
  **Warum die Mutationsprüfung nicht optional ist — Beispiel vom 07.09.2026:** Ein Test zur
  Slot-Weißliste in `bewerbenPublic` prüfte nur, DASS die RPC aufgerufen wird, nicht WOMIT.
  Er war grün und blieb grün, als die Weißliste testweise entfernt wurde. Erst die
  Mutation hat den wertlosen Test entlarvt.
- 🐞 **Beim Testschreiben gefunden und behoben (04.09.2026): doppelte Mieteinnahmen.**
  `lib/actions/mietkonto.ts` baute die Obergrenze der Dubletten-Abfrage als `` `${monat}-31` ``.
  **Den 31. gibt es im Februar, April, Juni, September und November nicht** — Postgres
  antwortet mit `22008`, und weil der Fehler nicht ausgewertet wurde, kam die Abfrage still
  leer zurück. In fünf von zwölf Monaten fiel damit der Dublettenschutz für Altzeilen ohne
  `soll_monat` aus → die Nacherfassung buchte Mieteingänge doppelt, unbemerkt in Cashflow
  UND Anlage V. Jetzt: exklusive Obergrenze (erster Tag des Folgemonats) und Abfragefehler
  brechen ab, statt still weiterzulaufen.
  **Zwei Regeln daraus:** (1) Ein Datum nie aus Textbausteinen zusammensetzen — Monatsenden
  unterscheiden sich; Bereichsgrenzen exklusiv über den Folgemonat bilden. (2) `error` aus
  einer Supabase-Abfrage nie wegdestrukturieren, wenn das Ergebnis eine Schutzfunktion
  speist — eine leere Antwort sieht dann aus wie „nichts gefunden".
  **Datenbestand geprüft (04.09.2026): NICHT eingetreten** — 377 Miet-Buchungen mit
  Mieterzuordnung, 0 Dubletten. (Eine erste Abfrage meldete 112 Gruppen; das war ein
  Fehler der Abfrage: `GROUP BY` fasst `NULL`-Mieter-IDs zu einer Gruppe zusammen.
  Bei solchen Auswertungen `mieter_id is not null` setzen.)
- 🐞 **Zweiter Fund beim Testschreiben (04.09.2026): Tausenderpunkt in Beträgen.**
  `parseBetrag` in `lib/actions/service.ts` las einen Punkt ohne Komma immer als
  Dezimaltrennzeichen — aus **„1.000" wurde ein Euro**, „12.345" ergab 12,35 (unter beiden
  Lesarten falsch). Der Betrag kommt vom Handwerker und wird per Klick zur Kosten-Buchung.
  **Behoben durch Wiederverwendung, nicht durch eine neue Regel:** `zahlDe()` aus
  `lib/zahl.ts` löst die deutsche Lesart bereits korrekt und feiner (führende Null →
  „0.500" bleibt ein halber Euro). `lib/importCsv.ts` hatte den Fall ebenfalls schon
  richtig.
  **Regel: Zahlen aus Nutzereingaben NIE selbst parsen — `zahlDe()` aus `lib/zahl.ts`
  benutzen.** Ein eigenes `String(v).replace(",", ".")` liest deutsche Tausenderpunkte
  falsch. (Die schlichten Varianten in `buchungen`/`properties`/`positions` u. a. hängen
  an Zahlenfeldern; wer dort ein Textfeld einführt, muss auf `zahlDe()` umstellen.)
- 🐞 **Dritter Fund (07.09.2026): Dezimalpunkt im öffentlichen Steckbrief.**
  `aktualisiereBewerberLink` in `lib/actions/bewerber.ts` entfernte mit
  `.replace(/\./g, "")` **alle** Punkte. Die Steckbrief-Felder sind **Textfelder**
  (`BewerbungenManager.tsx`, `feld()` mit `typ = "text"`) — aus „1200.50" wurden
  **120.050 €**, aus „0.5" eine 5, und das steht öffentlich im Steckbrief, den jeder
  Bewerber sieht. Ebenfalls über `zahlDe()` behoben. **Damit ist der genannte Fall
  „Textfeld statt Zahlenfeld" nicht mehr hypothetisch — er war schon da.**
- 🐞 **Vierter Fund (07.09.2026): Zählerstand tausendfach daneben — UND die Grenze der
  Regel oben.** `meldeZaehlerstand` in `lib/actions/zaehler.ts` las den Stand mit
  `parseFloat(s.replace(",", "."))`; das ersetzt nur das **erste** Komma und lässt Punkte
  stehen → aus „14.382,5" wurde 14,382. Der Wert geht über die Übernahme als Differenz in
  die Verbrauchsbuchung und damit in die **NK-Abrechnung des Mieters**.
  **WICHTIG — hier ist `zahlDe()` die FALSCHE Lösung:** Gas- und Wasserzähler haben regulär
  drei Nachkommastellen („5123.456" m³); `zahlDe()` deutet den Punkt vor drei Ziffern als
  Tausenderpunkt und macht daraus 5.123.456. Behoben wurde deshalb nur der eindeutige Fall
  (Komma vorhanden → Punkte sind Tausender) plus `Number` statt `parseFloat` (sonst wird
  „123abc" stillschweigend zu 123). „14.382" ohne Komma bleibt mehrdeutig und wird als
  Dezimalzahl gelesen — beim Zähler die häufigere Lesart.
  **Regel dazu: `zahlDe()` ist für GELDBETRÄGE gedacht (zwei Nachkommastellen). Für Größen
  mit drei oder mehr Nachkommastellen — Zählerstände, m³, kWh-Bruchteile — nicht verwenden.**
- ✅ **Systematischer Durchgang abgeschlossen (07.09.2026): alle Zahlen-Eingänge geprüft.**
  Weil drei der vier Funde derselbe Fehler waren, wurden **alle** Stellen durchgegangen, an
  denen eine Zeichenkette zur Zahl wird (33 in 26 Dateien, Server und Oberfläche), je Stelle
  gegen die Feldart geprüft. **Kein weiterer Fund.**
  **Festgehalten in `tests/zahlenEingaenge.test.ts`** — je erlaubter Stelle eine Begründung;
  eine NEUE handgebaute Lesart in `lib/actions/` macht den Test rot. Wird er rot: nicht
  eintragen, sondern erst die Feldart nachsehen.
  **Entscheidungshilfe:** `type="number"` → `Number(s.replace(",", "."))` unbedenklich ·
  Textfeld mit Geld → `zahlDe()` · Textfeld mit drei Nachkommastellen → eigener Parser
  (Vorbild `parseStand` in `zaehler.ts`).
- 🔒 **Hochgeladene Dateien werden über `lib/net/dateiKopf.ts` ausgeliefert (08.09.2026).**
  Sieben Routen gaben den gespeicherten `Content-Type` unverändert und standardmäßig
  **`inline`** zurück; vier Upload-Pfade (`beleihung`, `makler`, `buchungen`, `archiv`)
  haben **keine MIME-Weißliste**. Die CSP fing das nicht ganz auf: Sie ist zwar streng
  (`script-src 'self' 'nonce-…'`), aber **`'self'` erlaubt Skripte von JEDEM Pfad der
  eigenen Domain** — auch von einer hochgeladenen `.js`-Datei, ausgeliefert über ihre
  eigene Route mit selbst bestimmtem MIME-Typ.
  **Jetzt:** Nur PDF und Bilder gehen `inline`; alles andere wird als
  `application/octet-stream` zum Download gezwungen, immer mit `nosniff`, Dateiname
  bereinigt. **Gelöst an der AUSLIEFERUNG, nicht am Upload** — eine Weißliste beim
  Hochladen würde den Altbestand in der Datenbank nicht erfassen.
  **Regel: Eine neue Route, die eine gespeicherte Datei zurückgibt, benutzt `dateiKopf()`.**
  `tests/dateiAuslieferung.test.ts` wird sonst rot (es sucht nach `"Content-Type": x.mime`
  & Co. in allen `route.ts`).
  **Ehrlich zur Schwere:** Der Angreifer muss ein registrierter Vermieter sein und jemanden
  dazu bringen, seinen Freigabe-Link zu öffnen (`/beleihung/<token>/datei/<key>` ist die
  einzige dieser Routen ohne Login). Kein Selbstläufer — aber billig zu schließen.
- 🔇 **Dritter Durchgang (08.09.2026): stille Schreibfehler.** Von 128 Schreiboperationen
  in `lib/actions/` werteten **20** den `error` der Datenbank gar nicht aus und gaben
  danach bedingungslos `{ ok: true }` zurück. **Vier davon waren mehr als Kosmetik:**
  `widerrufeServiceCode` und `widerrufeEinladung` meldeten „widerrufen", während der
  Zugangscode weiter einlösbar blieb; `erzeugeEinladungscode` legte einen neuen Code an,
  ohne dass das Löschen des alten geprüft wurde (**zwei gültige Codes**); und
  `uebernimmAuftragAlsKosten` schrieb die `kosten_id` ungeprüft — ohne sie hält der Auftrag
  sich für unverbucht und erzeugt beim nächsten Klick eine **zweite Kosten-Buchung**
  (derselbe Doppelbuchungs-Fehler wie in `mietkonto.ts`, nur an anderer Stelle).
  **Zweite Hälfte desselben Fehlers — in der Oberfläche:** Alle DeleteButton-Stellen riefen
  `action={async () => { await x(); }}` auf und warfen die Rückgabe weg; der Knopf meldete
  anschließend „Gelöscht.". Serverseitig einen Fehler zurückzugeben nützt nichts, solange
  der Aufrufer ihn verwirft. Jetzt entscheidet **`lib/actionErgebnis.ts` → `actionFehler()`**
  an einer Stelle, und `DeleteButton` zeigt die Meldung an.
  **Regel: Jeder Schreibvorgang in `lib/actions/` wertet `error` aus, und jeder Aufrufer
  wertet die Rückgabe aus.** `tests/schreibFehler.test.ts` wird sonst rot.
  **Was NICHT gefunden wurde — ein Ergebnis, kein Nicht-Ergebnis:** Ein Schreibzugriff über
  Mandantengrenzen ist nicht möglich. Live gegen die Datenbank geprüft: alle **45 Tabellen**
  in `public` haben RLS aktiv, und jede Tabelle, in die nur über `.eq("id", …)` geschrieben
  wird, hat eine UPDATE/DELETE-Policy auf `auth.uid() = user_id` (bzw. `vermieter_id`).
  Die 38 Schreibzugriffe ohne eigenen Mandantenfilter sind dadurch abgesichert; in
  `deleteIban` und `deleteProperty` steht der Filter trotzdem jetzt ausdrücklich dabei.
  **Bewusst NICHT umgesetzt: „0 betroffene Zeilen" als Fehler zu werten.** Ein per RLS
  geblocktes UPDATE liefert keinen Fehler, sondern null Zeilen — das gilt aber genauso für
  ein doppelt ausgelöstes Löschen und für die Demo-Sperre. Daraus einen Fehler zu machen,
  würde harmlose Fälle zu Fehlermeldungen erheben.
- 🕳️ **Vierte Klasse (08.09.2026): Prüf-Abfragen, die fail-open scheitern.** Der dritte
  Durchgang sah nur SCHREIB-Vorgänge an. Eine Abfrage, deren LEERES Ergebnis „dann leg los"
  bedeutet, ist genauso gefährlich — eine fehlgeschlagene Abfrage kommt ebenfalls leer
  zurück. Von 40 Lese-Abfragen ohne Fehlerauswertung waren **elf** von dieser Sorte:
  `mietkonto.ts` (Einzelbuchung — der Fix vom 04.09. betraf nur die Nacherfassung),
  `nkco2.ts`, `wiederkehr.ts`, `properties.ts`, `termine.ts`, `bewertung.ts`, `zaehler.ts`,
  `importDaten.ts` (alle Mieter ohne Objekt), `dokumente.ts` (PDF ohne Objekt-Zuordnung),
  `mietzeitraeume.ts`, und — **die schwerste — `account.ts`: Konto gelöscht, Paddle bucht
  weiter**, obwohl der Kommentar darüber genau das ausschließt. Heute folgenlos (Billing
  inaktiv), aber `BILLING_ENFORCED=true` hätte den Fehler scharf gestellt.
  Folge jeweils: eine doppelte Buchung oder ein fehlender Verbrauch in der NK-Abrechnung.
  Alle behoben und mit Tests festgenagelt.
  **Regel: Wenn ein leeres Abfrageergebnis „darf ausgeführt werden" heißt, MUSS `error`
  ausgewertet werden.** Fail-closed (`if (!x) return …`) ist unbedenklich.
- 🙈 **Der Wächter war blind — und meldete Grün (08.09.2026).** `schreibFehler.test.ts`
  zählte Klammern im Rohtext. Die Kommentare `// 1)` … `// 5)` in `lib/actions/bewertung.ts`
  enthalten schließende Klammern ohne öffnende → die Klammertiefe rutschte ins Negative,
  es wurde keine einzige Anweisung erkannt, und die Datei galt als geprüft. Dahinter lagen
  **vier Schreibvorgänge ohne jede Fehlerauswertung**. Behoben in
  **`tests/stubs/tsAnweisungen.ts`** (Kommentare/Zeichenketten werden entfernt, bevor
  gezählt wird) plus einem Test, der beweist, dass der Erkenner hingesehen hat.
  **Regel: Ein Wächter, der nichts findet, muss belegen können, dass er gesucht hat** —
  mindestens über eine Mindestzahl gefundener Stellen und eine Plausibilitätsprüfung des
  Erkenners selbst.
- ⏱️ **`naechsteFaelligkeit` rechnete zeitzonenabhängig (08.09.2026 behoben).**
  `new Date("2026-03-15")` (UTC) gemischt mit `getDate()`/`setDate()` (Ortszeit) und
  `toISOString()` (wieder UTC). Gemessen: `TZ=Europe/Berlin` → 15.03. + 1 Monat = **14.04.**
  (Sommerzeitumstellung), `TZ=America/New_York` → 31.01. + 1 Monat = **01.03.** Vercel läuft
  in UTC, produktiv war es richtig — aber abhängig von einer Einstellung, die niemand hier
  verwaltet. **Regel: Kalenderrechnungen auf den Zahlen des ISO-Datums ausführen, nicht über
  `Date` mit Ortszeit-Zugriffen.** `tests/actionsTermine.test.ts` vergleicht vier Zonen.
- ⚠️ **Prüfstand-Falle: ohne `vi.resetModules()` liefert ein zweites `await import` im
  SELBEN Test das gecachte Modul** — es hängt noch an der ersten Attrappe, der frische `db`
  bleibt leer, und ein Test mit einer Schleife über mehrere Eingaben prüft nur den ersten
  Durchlauf. `resetModules()` steht deshalb jetzt in jedem `lade()`-Helfer.
- 🚪 **Fünfter Durchgang (08.09.2026): `app/api`.** 20 Routen, alle gelesen; 50 Tests, 31
  Mutationen rot; `schreibFehler.test.ts` bewacht jetzt auch die Routen.
  **Schwerster Fund:** `/api/export`, `/api/export/buchungen`, `/api/export/datev`,
  `/api/berichte/anlage-v`, `/api/berichte/jahresbericht` lasen `properties` & Co. ohne
  Nutzerfilter — die Policy `properties_select_zugang` gibt einem **Mieter** die komplette
  Objektzeile seiner Wohnung (Kaufpreis, Wert, Kaufdatum). `/api/export/alles` hatte das
  schon behoben, die fünf Geschwister nicht. **Regel: Jede Abfrage in einer API-Route
  filtert explizit auf `user_id` — RLS ist die zweite Linie, nicht die einzige — und
  Vermieter-Auswertungen prüfen `istVermieterKonto()` aus `lib/rolle.ts`.**
  Weitere Funde: Webhook-Reihenfolge fail-open; Cron `wert-refresh` mit drei stillen
  Service-Role-Schreibvorgängen und `?secret=` in der URL (entfernt — **Geheimnisse nie
  als Query-Parameter**, sie landen in Logs); Cron `bewertung` ohne `CRON_SECRET` **offen**
  (jetzt 503 — **Regel: fehlende Env = Route aus, nie Route offen**); Newsletter: Abgemeldete
  konnten sich nie wieder anmelden, Brevo-Ergebnis beim Abmelden ignoriert; `/api/import`
  ohne Mengenbremse; `encrypt-bankdaten` meldete „ok" bei ungelesenen Tabellen. Die
  GitHub-Action rief `my-immo-app.vercel.app` statt der kanonischen Domain.
  **Bewusst belassen:** `darfWeiter()` sperrt bei DB-Fehler (fail-closed), obwohl der
  Kommentar „durchlassen" sagt — sicherer, kostet Verfügbarkeit bei DB-Ausfall.
- 🎯 **„Heute wichtig" und drei Navigations-Gruppen (08.09.2026, Feedback Befund 7 + 8).**
  **REIHENFOLGE (08.09.2026 abends korrigiert, Vorgabe des Betreibers nach Live-Blick):**
  Kennzahlen und Verläufe ZUERST, „Termine & Aufgaben" ans ENDE der Seite. Das externe
  Feedback wollte das Gegenteil, #318/#320 hatten es so gebaut — am fertigen Dashboard
  gesehen war es falsch. `tests/heute.test.ts` hält es fest.
  **GEÄNDERT 02.10.2026 (eigene Idee des Betreibers):** Kennzahlen bleiben oben; darunter
  ein zweispaltiger Block — links Buchungssaldo (halb so breit), rechts **„Neuigkeiten aus dem
  Mieterportal“** (`lib/portalNeuigkeiten.ts`, letzte 14 Tage, nur was PASSIERT ist: Nachricht/
  Termin vom Mieter, bestätigte Zustellung, Angebot, Firmen-Rückmeldung, Freigabe-Antrag,
  Bewerbung — nie, was schon als Aufgabe dasteht) und darunter „Termine & Aufgaben“.
  Geblieben ist die Zusammenführung: vorher zwei Blöcke mit denselben Fristen, jetzt einer.
  **GEÄNDERT 03.10.2026 (Betreiber: „Grafik viel zu klein, alles soll zusammenpassen“):** Block
  `.dash-haupt` (1,45 : 1) — links Portfolio-Wertentwicklung UND Buchungssaldo übereinander, je
  260 px hoch; rechts Neuigkeiten, darunter Termine & Aufgaben (Fristdatum jetzt in der
  Unterzeile, sonst brach jede Zeile dreifach um). „Einnahmen vs. Ausgaben“ endet mit „Bleibt /
  Mo.“ (= Cashflow-Kachel). **Ursache der „zu kleinen Grafik“:** Beide Charts waren per viewBox
  gestreckte SVGs — Schrift ~6 px in der halben Spalte, ~18 px in voller Breite. Jetzt messen
  sie ihre Breite (`lib/hooks/useBreite.ts`) und zeichnen in echten Pixeln. **Regel: Kein
  Diagramm mehr mit `width: 100%; height: auto` auf einer festen viewBox.** Im Browser
  angesehen (1440/1180/390 px, lokaler Server mit Demo-Sitzung).
  **`lib/heute.ts` → `baueHeuteAufgaben()`** führt offene Mieten des laufenden Monats,
  offene Mieter-Anliegen, nicht übernommene Zählerstände und Fristen in EINER Liste
  zusammen — jede Zeile mit genau einem Ziel und einer Handlung. Reine Funktion, ohne
  Datenbank und ohne React, deshalb prüfbar (`tests/heute.test.ts`).
  Dringlichkeits-Uhren: Miete ab dem 5. des Monats, Anliegen nach 7 Tagen, Zählerstand
  nach 14, Fristen bei Überfälligkeit oder `warn`. Dringendes steht oben, auch wenn es
  später dran ist. **Datumsrechnung über `tageVor()` — `Date.UTC`, nie Ortszeit**
  (dieselbe Falle wie bei `naechsteFaelligkeit`).
  **Navigation: `lib/nav.ts` hat jetzt `VERWALTEN` / `ABRECHNEN` / `PLANEN`** (vorher elf
  gleichrangige Punkte unter „Verwaltung"). „Planen" ist ein `<details>` — eingeklappt,
  aber nicht versteckt, und automatisch offen, wenn man darin arbeitet. `ALLE_ZIELE` ist
  die Liste für die Command-Palette; `VERWALTUNG`/`KALKULATOR` sind Übergangsnamen.
  **Geführte Demo-Wege:** Weißliste `DEMO_ZIELE` in `lib/demo.ts` — `miete` → /mietkonto,
  `nk` → /tenants, `steuer` → /steuer, `schaden` → /anliegen. Die erste Fassung (08.09.)
  führte in gesperrte Bereiche; `tests/demoWege.test.ts` verlangt jetzt, dass jedes Ziel frei
  ist. Kein freier Pfad-Parameter (das
  wäre eine offene Weiterleitung auf der eigenen Domain).
- 🚪 **Demo: jeder Klick führt irgendwohin (30.09.2026, externes Review).** Die Demo war an
  den gelobten Stellen kaputt: Die Aufgabenliste des Dashboards verlinkte NUR auf gesperrte
  Bereiche, ebenso „Karte aktivieren", „+ Immobilie" und jede Zeile unter „Letzte
  Buchungen"; gesperrte Nav-Einträge waren stumme `<span>`s; der Banner versprach „alle
  Funktionen"; die KI-Formulare zeigten „Fehler beim Analysieren", weil die Middleware
  `fehler` statt `error` schickte. **Jetzt:** `components/DemoSperre.tsx` fängt JEDEN Link
  auf ein gesperrtes Ziel in der Capture-Phase ab und erklärt den Bereich im Dialog
  (Texte: `DEMO_BEREICHE` in `lib/demo.ts`); `DemoLeiste.tsx` hat Early-Access-Knopf und
  „Demo beenden" (beide melden zuerst ab — `/` zeigt einem angemeldeten Konto sonst nur
  das Dashboard). **Regel: Ein neuer Link, eine neue Aufgabenquelle oder ein neuer
  gesperrter Bereich braucht einen Eintrag in `DEMO_BEREICHE`** — `tests/demoWege.test.ts`
  rechnet gegen `demoDarfRoute` und wird sonst rot (elf Mutationen geprüft).
  **Der Vorgänger-Test prüfte nur, OB die Links auf der Startseite stehen** — und hielt
  damit drei Sackgassen fest. Ein Test, der eine Schreibweise prüft, schützt kein Verhalten.
  **Phase 2–5 erledigt 30.09.2026.**
- ⏱️ **Phase 5: Ladezeit GEMESSEN, nicht vermutet (30.09.2026, PR #338).** Live, Demo-Konto,
  TTFB je 10 Aufrufe, Messpunkt in den USA (Edge `iad1`, Funktion `fra1`):
  | Seite | vorher min/median | nachher min/median |
  |---|---|---|
  | `/` Dashboard | 573 / 785 ms | 444 / 711 ms |
  | `/einstellungen` | 523 / 743 ms | 414 / 596 ms |
  | `/tenants` | 545 / 709 ms | 402 / 568 ms |
  Untergrenze dynamische Seite ohne Anmeldung (`/login`): ~170–185 ms; statisch ~50 ms.
  **Befund, der die eigene Hypothese widerlegte:** Das Dashboard war NICHT langsamer als
  `/einstellungen`. Die Zeit steckte im gemeinsamen **Layout** (sieben Aufrufe
  hintereinander) → jetzt drei Stufen (getUser → Rolle+Freischaltung → vier Datenabfragen
  parallel). Gewinn ~110–140 ms (Minima), im Median kleiner als die Netzstreuung.
  Funktionen UND Datenbank liegen in Frankfurt — ein Regionen-Problem gibt es nicht.
  **Grenzen der Messung:** Aus Deutschland nicht messbar; die Edge-Middleware läuft beim
  Nutzer, ihr `getUser` geht von hier über den Atlantik → für deutsche Nutzer ist die Zeit
  eher kürzer. Browser-Zeit (JS, Hydration) nicht gemessen (Chromium kommt hier nicht durch
  den Proxy). Vercel-Observability liefert für das Projekt nichts (404).
  ✅ **(1) erledigt 30.09.2026:** `lib/supabase/nutzer.ts` → `aktuellerNutzer()` (React
  `cache`, gilt je Anfrage) in Layout + 11 Seiten; bleibt `getUser()`, nie `getSession()`
  (`tests/nutzerCache.test.ts`). **`/auth/passwort-neu` bewusst ausgenommen** (setzt ein
  Passwort ohne das alte). **Regel: Neue Server-Seiten holen den Nutzer über
  `aktuellerNutzer()`, nicht über ein eigenes `supabase.auth.getUser()`.**
  ✅ **(2) erledigt 30.09.2026: Proxy `getUser` → `getClaims`.** Anlass: In den Supabase-Logs
  erzeugte EIN Seitenaufruf ~40 `GET /user` in zwei Sekunden (Vorab-Laden der Links, je
  Anfrage Proxy + Layout). Das Projekt signiert bereits mit **ES256** (JWKS
  `kid 5b81f0f9…`, am echten Demo-Token nachgesehen) → Signatur wird lokal geprüft,
  Schlüsselsatz modulweit 10 min im Speicher. **In Kauf genommen:** Eine anderswo beendete
  Sitzung erkennt der Proxy erst bei Token-Ablauf (≤ 1 h) — die Datenbank (RLS) nimmt das
  Token bis dahin ohnehin an, die Seiten fragen über `aktuellerNutzer()` weiter beim
  Auth-Server. **Fail-closed:** fremde Signatur, abgelaufen, HS256 ohne Server-Bestätigung,
  Schlüsselsatz nicht erreichbar → nicht angemeldet. `tests/proxyAnmeldung.test.ts` mit
  ECHTEN ES256-Schlüsseln und der echten Bibliothek (nur das Netz ersetzt), 9 Tests,
  5 Mutationen rot — darunter **`allowExpired`**, das erst ein Test fing, der ein
  abgelaufenes Token mit gefälschtem `expires_at` im Cookie einreicht (das Cookie ist
  frei setzbar; ohne diesen Fall war die Ablaufprüfung ungetestet). Zusätzlich lokal
  gegen das echte Supabase: gültige Demo-Sitzung 200, Demo-Sperre greift, manipulierte
  Signatur → Login. **Regel: Im Proxy nie `getSession()`-Daten als Anmeldung werten —
  nur `getClaims()` (geprüft) oder `getUser()`.** Messskript-Muster: einmal `/api/demo`, dann N× GET mit Cookie, TTFB
  über `performance.now()` bis zu den Antwortköpfen; `x-vercel-id` zeigt Edge::Funktion.
- 📈 **Dashboard-Grafik: 1J · 3J · 5J · Max, monatsweise, Mieten im Mietmonat (30.09.2026,
  Vorgabe des Betreibers).** „1M" ist WEG — Miete kommt einmal im Monat, die Tagesansicht
  zeigte 29 leere Tage und einen Ausschlag. `lib/zeitraum.ts` rechnet jetzt ausschließlich
  auf den ZAHLEN des ISO-Datums (Monatsindex), nie mehr `new Date(iso)` + Ortszeit: Ein
  Monatserster („2026-03-01") rutschte westlich von UTC in den Vormonat — genau das Datum,
  an dem Mieten gebucht werden (Mutation M2 unter `TZ=America/New_York` belegt es).
  **Einnahmen zählen im Mietmonat** (`einnahmeDatum()`: `soll_monat` schlägt
  `buchungsdatum`) — sonst steht bei einer am 2. Februar gezahlten Januar-Miete der Januar
  leer und der Februar doppelt. Live-Bestand: 148 von 633 Einnahmen haben `soll_monat`,
  bisher 0 abweichend — der Fall ist also noch nicht eingetreten, aber die Nacherfassung
  erzeugt genau ihn. **„Max"** zeigt Monate, solange der Bestand ≤ 72 Monate ist
  (`MAX_MONATE_MONATSWEISE`), sonst Jahre; vorher immer Jahre → zwei Jahre Buchungen waren
  zwei Punkte. Vorausbuchungen nach dem laufenden Monat zählen nicht. Gespeicherte
  Altwahl „1M" im localStorage fällt über `istZeitraum()` auf „1J" zurück.
  `tests/zeitraum.test.ts`, 19 Tests, 5 Mutationen rot; M5 („Grundlinie zurück") ist
  gleichwertig — Buckets vor dem Zeitraum existieren nicht, `summen.has()` fängt es ohnehin.
- 🔁 **Zweite Review-Runde (30.09.2026), `tests/reviewRunde2.test.ts`, acht Mutationen:**
  (1) **Buchungssaldo-Diagramm** startete bei „12 Monate" beim Saldo ALLER früheren
  Buchungen (`lib/zeitraum.ts`, „Grundlinie") → Endwert 100.182 € passte zu nichts. Jetzt ab
  0 im Zeitraum; „Max" zeigt weiter seit Beginn. `/cashflow`-Kachel sagt „Ohne Tilgung ·
  Zinsen nur, soweit gebucht" (Tilgung ist gar keine Kostenkategorie).
  (2) **Kredit-Laufzeit:** Das Formular fragte „bis (Jahr)", ALLE 4 echten Nutzer trugen eine
  Dauer ein (live gezählt). Jetzt „Gesamtlaufzeit (Jahre)"; `lib/kreditLaufzeit.ts` zeigt
  Dauer („30 Jahre · bis 2051") UND Alt-Endjahre (≥ 1900 → „bis 2042") richtig an.
  (3) **Nacherfassung** startete beim ältesten Mietvertrag (Demo: 299 offene Monate; ein
  Vermieter mit Mietern seit 2015 sähe 600) → Voreinstellung jetzt Januar des Vorjahres
  (`standardStartNacherfassung` in `lib/mietkonto.ts`), früher wählbar wie bisher.
  (4) **„100 % Daten in der EU" auf der Startseite widersprach `/datenschutz`** (nennt USA:
  Vercel, Anthropic) → irreführend (§ 5 UWG). Überall ersetzt durch das Belegte: „Datenbank
  in Frankfurt". **Regel: Keine Werbeaussage, die der Datenschutzerklärung widerspricht.**
  (5) **Header 761–1.200 px:** Logo und Knöpfe überlappten bis 215 px, seit der CTA
  „Early-Access-Zugang anfragen" heißt. Gemessen in Chromium gegen **localhost** (das geht,
  nur externe Seiten nicht). Stufen: < 1.320 Kurzform `START_CTA_KURZ` + ohne Unterzeile,
  < 900 nur „Anmelden". Danach ≥ 46 px Abstand bis 1.920 px.
  **Fallstrick beim Messen:** Ein alter `next start` hielt Port 3100, der neue brach mit
  EADDRINUSE ab, und der alte lieferte HTML mit CSS-Verweisen aus dem gelöschten `.next` →
  unsinnige Messwerte. Und `pkill -f "next start …"` trifft die eigene Shell — Muster mit
  `[n]ext` schreiben.
  (6) **Roadmap** führte „Geführtes Onboarding" als GEPLANT, obwohl es seit Juli existiert.
  Jetzt Stufen „Umgesetzt / In Arbeit / Geplant"; „Umgesetzt" nur mit Komponente als Beleg.
  **Neue Pläne kommen erst hinein, wenn der Betreiber sie beschlossen hat.**
  **Nicht gemacht, braucht den Betreiber:** Gründer-Abschnitt (Inhalte), Kundenstimmen (es
  gibt keine echten — **niemals erfinden**).
- 🔎 **Echte Konten gegen die Demo-Fehler geprüft (30.09.2026), `tests/datenluecken.test.ts`,
  13 Mutationen.** Die Demo-Fehler waren DATEN-Fehler — dieselben Lücken fanden sich bei
  echten Nutzern (10 Konten, 23 Objekte; nur Zählungen ausgewertet, Demo ausgenommen):
  (1) **Soll-Miete:** Bei 6 Objekten wich das Objektfeld „Miete" von den laufenden Mietern
  ab; gegen die gebuchten Mieten stimmten 3× die Mieter, 0× das Objektfeld; eines hatte
  gar keine Objekt-Miete (Dashboard 0 €, obwohl 1.450 €/Monat eingingen). Dazu ein
  „Phantom-Soll" (nur beendete Mieter). **Regel jetzt `lib/sollMiete.ts` → `sollKaltmiete()`**
  für Dashboard, Objektseite UND Objektliste: laufende Mieter → deren Kaltmiete; nur
  beendete/künftige → 0; gar keine Mieter → Objektfeld. **Nie still:** Weichen Objektfeld
  und Mieter ab, zeigt die Objektseite beide Zahlen + Knopf „Objekt-Miete angleichen"
  (`gleicheObjektMieteAn`, rechnet serverseitig neu — kein Betrag vom Client). Grund: Ein
  Mehrfamilienhaus mit nur teilweise angelegten Mietern (echt: 2.080 € vs. 780 €) verlöre
  sonst ohne Hinweis Miete. Bewertung/Beleihung nutzen weiter das Objektfeld (Eingabe).
  (2) **Kaufdatum fehlte bei 20 von 23 Objekten** → AfA im Kaufjahr voll, Spekulationsfrist
  unbekannt; gewarnt wurde nur auf der Steuerseite. Jetzt EINE Sammel-Aufgabe in
  `baueHeuteAufgaben` (`ohneKaufdatum`, Art `stammdaten`, nie dringend, ans Ende) + Hinweis
  auf der Objektseite. Kein Pflichtfeld (Import kennt das Datum oft nicht).
  (3) **Umlagen fehlten (2 Konten, 332 Buchungen):** Mieten nur kalt gebucht, kein NK-Anteil,
  obwohl die Verträge NK-Vorauszahlungen haben — und umlagefähige Kosten als Werbungskosten
  → Überschuss zu niedrig. `berechneAnlageV(..., mieter)` + `nkSollImJahr()` → Hinweis, wenn
  gebuchte Umlagen < 50 % des Vertrags-Solls. Steuerseite UND Anlage-V-PDF übergeben die
  Verträge; ohne sie (alte Aufrufer) kein Hinweis. **Nur Hinweis, keine Datenänderung** —
  ob NK an den Vermieter gehen, weiß nur der Nutzer.
  **Nicht angefasst:** fremde Daten. Die App korrigiert nichts selbst, sie zeigt es an.
  **Zweiter Schub (gleicher Tag):** drei weitere stille Lücken, gleiches Muster (Sammel-
  Aufgabe `stammdaten` + Hinweis dort, wo die Lücke wirkt; Helfer `luecke()` in `lib/heute.ts`):
  **Mieter ohne Mietbeginn** (3) waren im Mietkonto UNSICHTBAR — `sollFuerMonat` liefert
  ohne Beginn nie ein Soll, also nie „offen", nie Nacherfassung; die Soll-Miete zählte sie
  aber. Jetzt nennt `/mietkonto` sie (`ladeMietkonto().ohneMietbeginn`).
  **Mieter ohne Objekt** (3): Ihre NK flossen in die Warmmiete, ihre Kaltmiete in keine
  Objekt-Miete → NK-Summe jetzt nur über Mieter mit Objekt.
  **Kredite ohne Auszahlungsdatum** (6 von 8): keine Frist fürs Sonderkündigungsrecht
  (§ 489 BGB, `lib/fristen.ts`) und kein Laufzeitende → Hinweis auf der Kreditkarte.
  **Test-Falle (N2):** Kein Test übergab LEERE Listen — genau das tut das Dashboard bei
  jedem gepflegten Konto; die Mutation hätte „Kaufdatum fehlt bei 0 Objekten" gezeigt.
  **Regel: Den Normalfall (alles in Ordnung) ausdrücklich testen, nicht nur die Lücke.**
- 🔂 **Dritte Review-Runde (30.09.2026), `tests/reviewRunde3.test.ts`, acht Mutationen:**
  (1) **Kacheln ließen sich nicht nachrechnen:** „Kaltmiete 5.930" − „Kosten 5.412" = 518,
  daneben „Cashflow +1.548" (Warmmiete). Die Einnahmen-Kachel heißt jetzt **„Warmmiete / Mo."**,
  Kaltmiete und Rendite stehen darunter → Warmmiete − Kosten = Cashflow, sichtbar.
  (2) **„+754,9 % seit Anschaffung"** war erster gegen letzten Punkt der Portfolio-Reihe —
  jeder Zukauf zählte als Wertsteigerung. Jetzt `wertzuwachsGgKaufpreis()` (lib/wert/verlauf.ts):
  Σ heutiger Wert gegen Σ Kaufpreis, nur Objekte mit BEIDEM → Demo **+11,9 % ggü. Kaufpreis**.
  (3) **Schuldzinsen doppelt abgezogen:** Die Anlage V rät, Zinsen als Kosten „Schuldzinsen"
  zu buchen; der Cashflow zieht aber die volle Kreditrate ab, die sie schon enthält.
  `laufendeKosten()` (lib/cashflowKennzahl.ts) nimmt sie vor dem Kostenschnitt heraus
  (Dashboard + Objektseite). Live noch nie eingetreten (0 Schuldzinsen-Buchungen).
  **Regel: Kosten, die in der Kreditrate stecken, gehören nie zusätzlich in „laufende Kosten".**
  (4) **Jahresbericht-PDF rechnete anders als die Seite** (Kopfkommentar behauptete
  „identisch"): Zinsen doppelt, Zinsanteil immer geschätzt. Beide jetzt über
  `jahresZeile()` in `lib/jahresberichtZeile.ts`.
  (5) **Demo ohne Zinsbuchungen** → Steuer zeigte „aus Restschuld hochgerechnet". Migration
  `20260930174605`: 4 Darlehen × 18 Monate im Schnappschuss, der Reset schreibt fort. Die
  Steuerseite zeigt standardmäßig das VORJAHR (`AnlageVExport`, `aktuell - 1`), das in der
  Demo immer voll gebucht ist.
  **Test-Falle, die M4 aufdeckte:** Gebuchte Zinsen = Schätzung (3.000 = 100.000 × 3 %) —
  der Test konnte „gebucht schlägt geschätzt" gar nicht unterscheiden. Testwerte so wählen,
  dass die zu unterscheidenden Wege VERSCHIEDENE Ergebnisse liefern.
- 💶 **Cashflow: EINE Rechnung, jede Zahl sagt, was sie ist (Phase 4, 30.09.2026).**
  `lib/cashflowKennzahl.ts` → `kostenSchnittMonat()` + `monatsCashflow()` + `cashflowFormel()`,
  benutzt von Dashboard UND Objektseite. **Drei Fehler, die dort steckten:**
  (1) Der Kostenschnitt war „letzte 12 Monate / 12" — ein Nutzer mit drei Monaten Buchungen
  sah ein VIERTEL seiner Kosten (Test rechnet es nach: 25 € statt 100 €), einer mit Lücke am
  Ende ebenfalls zu wenig. Jetzt: Fenster = letzte 12 Monate MIT Buchungen, geteilt durch
  die tatsächliche Monatszahl. **Nicht** durch „Monate mit Kosten" teilen — Grundsteuer
  fällt nur in 4 Monaten an, der Schnitt wäre dreifach zu hoch. Lücken MITTEN im Zeitraum
  bleiben ungelöst (bewusst).
  (2) Die **Objektseite** rechnete „Miete − Kreditrate" OHNE Kosten, obwohl die Übersicht
  darunter die Kosten als Posten führte; die Summe der Objekte ergab nicht das Dashboard.
  (3) Vier Zahlen hießen „Cashflow". Jetzt: Monats-Cashflow mit Formel an der Zahl;
  Dashboard-Verlauf und `/cashflow`-KPI heißen **„Buchungssaldo"**; „Einnahmen / Mo." heißt
  „Kaltmiete / Mo." (es ist die Soll-Miete, keine Buchung); Jahresbericht-Spalte mit Formel.
  **ENTSCHIEDEN 30.09.2026 (Betreiber): WARMmiete.** Monats-Cashflow = Soll-Kaltmiete +
  NK-Vorauszahlungen laufender Verträge (`nkVorauszahlungenMonat()`) − Kreditraten − Ø Kosten.
  Vorher zählte nur die Kaltmiete, abgezogen wurden aber ALLE Kosten inkl. umlagefähiger —
  Demo +518 € mit 4 von 6 Objekten rot, jetzt +1.548 €. **Die Steuer berührt das NICHT:**
  Anlage V rechnet aus Buchungen (`lib/anlageV.ts`: Betrag − `nk_anteil` → Zeile 9,
  `nk_anteil` → Zeile 13). **Rendite und Kaufpreisfaktor bleiben KALT** (Marktkonvention).
  Nicht enthalten: Stellplatzmieten außerhalb von Garagen-Objekten (Doppelzählung nicht
  auszuschließen) und NK-Nachzahlungen/-Erstattungen. `tests/cashflowKennzahl.test.ts`,
  16 Mutationen geprüft.
  **`START_CTA` in `lib/preise.ts`:** Solange `REGISTRIERUNG_OFFEN = false` (Zugangscode
  nötig), heißt der Knopf „Early-Access-Zugang anfragen" statt „Kostenlos starten". Ein
  Test hält fest, dass keine Landing-Datei die Beschriftung wieder hart einträgt.
- 🔐 **Zwei-Faktor-Anmeldung und frische Anmeldung (08.09.2026, Feedback Befund 5 + 6).**
  Supabase-MFA (TOTP) direkt Browser ↔ Supabase (`supabase.auth.mfa.*`); was Supabase nicht
  mitbringt, liegt in **`lib/actions/mfa.ts`**: acht Wiederherstellungscodes, nur SHA-256-Hash
  in `mfa_wiederherstellung`, Einlösen atomar (Update mit Filter, kein Lesen-dann-Schreiben),
  danach Faktor per Service-Role entfernt. **Nicht erzwungen, angeboten.** Bausteine:
  `components/ZweiFaktor.tsx` (Einstellungen → Sicherheit), `MfaAbfrage.tsx` (zweiter Schritt
  im Login), `ReAuthDialog.tsx` + `useReAuth()` (vor sensiblen Aktionen).
  **Layout-Sperre:** `app/(app)/layout.tsx` schickt aal1-Sitzungen mit 2FA-Pflicht nach
  `/login?mfa=1` — /login und /auth bleiben erreichbar, sonst käme niemand mehr hin.
  **Frische Anmeldung:** `lib/auth/frisch.ts` → `pruefeFrischeAnmeldung()` liest den
  `amr`-Zeitstempel aus dem JWT (`lib/auth/sitzung.ts`, reine Helfer, **fail-closed**: ohne
  `amr` ist nichts frisch) und verlangt aal2, wenn das Konto 2FA hat. Eingebaut in
  `deleteAccount`, `createFreigabe` (Bank-Link) und `/api/export/alles` (403).
  **Regel: Eine neue Aktion, die entschlüsselte Daten herausgibt oder etwas Unumkehrbares
  tut, ruft `pruefeFrischeAnmeldung()` und die Oberfläche `useReAuth()`.**
  **Demo-Konto:** Oberfläche sperrt die Einrichtung, `/api/demo` räumt Faktoren beim Start
  ab — ein Besucher, der dem geteilten Konto per API einen Faktor anhängt, sperrte sonst
  alle anderen aus.
  🐞 **2FA dauerhaft blockiert (30.09.2026, Supabase-Log):** Neunmal „A factor with the
  friendly name "MyImmo" … already exists". Die Aufräumschleife suchte unbestätigte Faktoren
  in `listFactors().totp` — dort liegen in supabase-js **nur bestätigte**
  (`GoTrueClient.js`, `_listFactors`: `if (factor.status === 'verified') data[type].push`).
  Wer die Einrichtung ohne „Abbrechen" verließ, kam nie wieder hinein. Jetzt
  `unbestaetigteTotp()` (`lib/auth/mfaFaktoren.ts`, über `.all`), aufgeräumt beim Laden UND
  vor jedem `enroll()`. `tests/mfaFaktoren.test.ts` prüft gegen die ECHTE Bibliothek (nur
  `getUser` ersetzt), vier Mutationen rot. **Regel: Bei `listFactors()` für unbestätigte
  Faktoren immer `.all` lesen.** Live lag genau ein solcher Rest (1 Konto) — er wird beim
  nächsten Öffnen von Einstellungen → Sicherheit automatisch entfernt.
  **Auto-Abmeldung:** Standard jetzt 30 Minuten (`STANDARD_MIN` in `AutoLogout.tsx`); wer
  „Aus“ gewählt hat, behält es.
  **Prüfstand:** `db.amrVorSekunden` (Alter der Anmeldung) und `db.aal` steuern die
  Frische; Standard ist „gerade eben, kein 2FA“ — bestehende Tests bleiben unberührt.
- **Prüfstand-Erweiterung (08.09.2026): `db.fehlerBei`.** `db.fehler` trifft JEDEN Zugriff,
  auch die Abfragen davor — eine Action, die vorher korrekt abbricht, erreicht die zu
  prüfende Stelle dann nie, und der Test wäre aus dem falschen Grund grün. `fehlerBei`
  setzt den Fehler gezielt (`"tabelle"` oder `"tabelle:op"`).
