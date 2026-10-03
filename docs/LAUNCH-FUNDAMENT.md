# Launch-Fundament: was vor dem Start stehen muss, damit danach skaliert wird

**Stand 03.10.2026.** Grundlage:
- der Ist-Stand, gemessen an Datenbank, Live-Seite und Code am 03.10.2026;
- eine Web-Recherche vom selben Tag, deren Quellen bei jeder Zahl stehen;
- die beiden wichtigsten Store-Regeln, selbst an der Quelle nachgelesen.

Löst ab: Memory `02 - MyImmo/MyImmo-Launchplan-90-Tage.md` (20.07.–20.10.2026), siehe Abschnitt 1.

Verwandt:
- `[[MARKETING]]`: Kanäle, Kampagnen, Redaktionsplan
- `[[SEO]]`
- `[[START-CHECKLISTE]]`: Rechts- und Bezahl-Blocker A/B
- `[[BEZAHLSYSTEM]]`
- `[[APP-STORE-RECHT]]`
- `[[FEEDBACK-BEWERTUNG-2026-10]]`
- `docs/marketing/INSTAGRAM.md`
- `[[MARKETINGPLAN]]`: der Marketingplan mit Zeit, Ablauf und Zuständigkeit

---

## 0. Kurzurteil, die Risiken zuerst

1. **Der bisherige Launchplan ist an der Ausführung gescheitert, nicht am Wissen.** Seine
   Phase 0 (bis 03.08.) verlangte drei Dinge:
   - eine Warteliste: Sie hat heute **0 Einträge**, weil die Brevo-Zugangsdaten in Vercel fehlen und die Formulare deshalb ausgeblendet sind;
   - den Play-Store-Test: Der Zähler ist laut Memory **nie gestartet**;
   - die Anfrage an den Anwalt: **nicht abgeschickt**, und davon hängen A1–A3 und B1 ab.

   Alle drei sind Betreiber-Aufgaben mit Wartezeit. Weitere Recherche hätte keine davon
   beschleunigt. **Dieses Dokument ändert daran nur etwas, wenn Abschnitt 6 abgearbeitet wird.**
2. **„Erst das Fundament, danach nur noch skalieren“ stimmt nur zur Hälfte.**
   - **Vorab bauen lassen sich:** die Wartezeiten (Abschnitt 3), eine eigene Reichweite (die E-Mail-Liste), die Messung, die Aktivierung in der App und eine Maschine, die Inhalte erzeugt.
   - **Vorab nicht bauen lässt sich der Beleg, dass ein Kanal Kunden bringt.** Skalieren heißt, Geld oder Zeit in einen Kanal zu stecken, der nachweislich konvertiert. Diesen Nachweis gibt es erst mit echten Nutzern.

   Wer vor dem Start Anzeigen, ein Empfehlungsprogramm oder fünf Social-Media-Kanäle
   aufbaut, baut auf Annahmen.
3. **Die Warteliste verliert schnell an Wert.**
   - Bei unter 1 Monat Wartezeit registrieren sich etwa 50 % der Eingetragenen, bei über 3 Monaten unter 20 % ([Lenny's Newsletter, 01.03.2022](https://www.lennysnewsletter.com/p/what-is-good-waitlist-conversion); US-Startups, auf eine Zielgruppe mit Durchschnittsalter 58 nicht ohne Weiteres übertragbar).
   - Eine Warteliste mit offenem Ende ist deshalb schwach.
   - **Sie braucht einen Starttermin, der höchstens 4–8 Wochen entfernt ist.**
4. **Der Zeitpunkt spricht für einen baldigen Gratis-Start.**
   - Die Nebenkostenabrechnung für 2025 muss spätestens am **31.12.2026** beim Mieter sein (§ 556 Abs. 3 BGB).
   - Oktober bis Dezember ist damit die Zeit, in der die Zielgruppe aktiv nach einer Lösung sucht. Der Ratgeber zur Fernablesepflicht hat seinen Aufhänger zum selben Datum.
   - Wer erst im Januar öffnet, verpasst die Saison um ein Jahr.
   - **Dagegen steht B1:** Impressum, Datenschutz, AGB und AVV sind anwaltlich nicht geprüft. Das ist die eigentliche Entscheidung (Abschnitt 2).
5. **Die einzelne Handlung mit der größten Wirkung dauert 10 Minuten:** `BREVO_API_KEY` und
   `BREVO_ABSENDER_EMAIL` in Vercel eintragen und neu deployen. Danach erscheinen die Formulare
   „Beim Start benachrichtigen“ und Vorlagen von allein. Jeder Besucher, der bis dahin
   kommt, geht ohne Spur verloren.

---

## 1. Ist-Stand (gemessen 03.10.2026)

| Baustein | Stand | Beleg |
|---|---|---|
| Registrierung | ❌ geschlossen, Start-Knöpfe zeigen „Coming soon“ (8× auf der Startseite) | Live-Seite; `REGISTRIERUNG_OFFEN` in `lib/preise.ts` |
| Warteliste | ❌ **0 Einträge, noch nie einer** (`newsletter_anmeldungen`, gesamt und `quelle='start'`) | Datenbank |
| E-Mail-Versand | ❌ Brevo-Zugangsdaten fehlen; Formulare ausgeblendet, solange `brevoBereit()` falsch ist | `CLAUDE.md` Punkt 0 |
| Neue Konten (30 Tage) | 4, alles Testkonten (es gibt keine echten Nutzer) | Datenbank |
| Ratgeber | ✅ 19 Artikel, 4 Funktionsseiten, `/vorlagen` | `lib/ratgeber.ts`, `app/(pub)/` |
| Search Console | ✅ Property `.de` | `CLAUDE.md` Deployment |
| Analytics | keine, so zugesagt (Datenschutz Ziffer 2) | Code durchsucht |
| Web-App-Manifest / Service Worker | ❌ **fehlen**, die App ist nicht als PWA installierbar und kann nicht als TWA in den Play Store | `app/` ohne `manifest`, `public/` ohne `sw.js` / `.well-known` |
| Instagram | Konzept + 9 Bilder fertig seit 29.08.; **ob das Konto existiert und postet: unbekannt** | `docs/marketing/INSTAGRAM.md` |
| Vergleichsportale | Profiltexte fertig, **eingereicht: unbekannt** | `docs/marketing/portal-profile.md` |
| Anwalt (A1–A3, B1) | Anfragen fertig, **nicht abgeschickt** | `docs/compliance/StBerG-ANFRAGE.md`, Memory `Launch-Outreach-Vorlagen.md` |
| Paddle | gebaut, inaktiv; Konto/Verifizierung offen | `[[BEZAHLSYSTEM]]` |
| Google Play / Apple | kein Konto angelegt (laut Memory) | Memory `MEMORY.md`, Abschnitt „Offene Fäden“ |

---

## 2. Drei Startstufen statt eines Starttags

Der alte Plan hatte einen Termin für alles. Die Blocker sind aber verschieden lang. Die Stufen trennen das:

| Stufe | Was | Braucht vorher | Risiko, wenn zu früh |
|---|---|---|---|
| **S1: Gratis-Start im Web** | Registrierung offen, alles kostenlos (Early Access) | Brevo · B1 (Rechtstexte geprüft) · Support-Adresse mit Reaktionszeit (B4) · 2FA durchgespielt (✅ 02.10.) | Abmahnfähige Rechtstexte bei echten Mieterdaten; Support für eine Person |
| **S2: Bezahlstart (Web, Paddle)** | Preise sichtbar, `BILLING_ENFORCED=true` | A1–A4, A6–A8 · **5–10 Konten, die regelmäßig aktiv sind** (`[[FEEDBACK-BEWERTUNG-2026-10]]` Phase 5) | Preis ohne Nutzungsbeleg; Kündigungen nach dem ersten Monat |
| **S3: Stores** | Android per TWA, iOS als Begleit-App | S2 läuft, Abschnitt 5 | Apple-Ablehnung nach 4.2; Provision auf Abos |

**Empfehlung:** Die Warteliste sofort öffnen. S1 so früh im Oktober/November wie B1 es
erlaubt, und zwar **in Wellen über den vorhandenen Zugangscode:** Die Warteliste
bekommt den Code per Mail, Welle für Welle. Das kostet keinen Code und begrenzt den
Support. Erst danach `REGISTRIERUNG_OFFEN = true`.

**Was nur der Betreiber entscheiden kann:**
- Will er S1 ohne fertige Anwaltsprüfung starten, wenn sie sich zieht? Das ist ein bewusst eingegangenes Risiko.
- Oder verschiebt er auf Januar, dann ohne die Saison der Nebenkostenabrechnung?

Ich würde nicht ohne
Prüfung von Impressum und Datenschutz starten. Bei AGB/AVV ist eine Erstprüfung mit Nachbesserung
vertretbar, solange nichts kostet.

---

## 3. Uhren, die jetzt laufen müssen (Wartezeit, nicht Arbeitszeit)

| Uhr | Vorlauf | Wer | Fakten (Quelle, Stand) |
|---|---|---|---|
| **Anwalt** (B1, A1–A3) | Wochen | Betreiber | Kritischer Pfad für S1 **und** S2. Die Texte für die Anfrage liegen fertig vor |
| **Domain-/Inhaltsalter** | Monate bis Jahre | Claude + Betreiber | Nur **1,74 %** neuer Seiten kommen binnen eines Jahres in die Top 10; **72,9 %** der Top-10-Seiten sind älter als 3 Jahre ([Ahrefs, 15.05.2025](https://ahrefs.com/blog/how-long-does-it-take-to-rank-in-google-and-how-old-are-top-ranking-pages/)). Jeder Monat ohne neue Inhalte fehlt später |
| **Brevo** | 10 min + DNS (SPF/DKIM) | Betreiber | Siehe 0.5 |
| **Paddle-Verifizierung** | Tage | Betreiber | `[[BEZAHLSYSTEM]]` Schritt 3 |
| **Google Play, persönliches Konto** | ≥ 3–4 Wochen | Betreiber | **12 Tester, 14 Tage ununterbrochen** vor dem Zugang zur Produktion; wer aus- und wieder eintritt, setzt den Zähler zurück. Organisationskonten sind ausgenommen, brauchen aber eine D-U-N-S-Nummer ([Play Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), [13634885](https://support.google.com/googleplay/android-developer/answer/13634885), abgerufen 03.10.2026). Gerätenachweis per Android-Handy. **Vorher muss F4 gebaut sein**, sonst gibt es nichts zu testen |
| **Apple, Anmeldung** | Tage | Betreiber | **Ein Einzelunternehmer meldet sich als Privatperson an**, als Verkäufer steht dann der eigene Name. Organisationskonten gibt es nur für juristische Personen; „DBAs, fictitious businesses, trade names … are not accepted“ ([Apple Enroll](https://developer.apple.com/programs/enroll/), abgerufen 03.10.2026). Das Small Business Program muss man **beantragen** |
| **DSA-Händleradresse** | Entscheidung offen seit 02.08. | Betreiber | Anschrift, Telefon und E-Mail werden in **beiden** Stores öffentlich gezeigt ([Apple Help](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)). Ausgearbeitet: Memory `semantic/research/dsa-haendleradresse-app-stores` |
| **Haus & Grund, Ortsverein** | Monate | Betreiber | 945.000 Mitglieder ([H&G Bayern, 2025](https://www.hausundgrund.de/verband/bayern/aktuelles/zentralverbandstag-2025)). **Achtung: immocloud kooperiert bereits** mit H&G Kiel („EigenVerwaltungPlus“) und Frankfurt ([immocloud Presse](https://www.immocloud.de/presse/kooperation-haus-grund-kiel/)). Kiel ist für Bad Schwartau der naheliegende Verband und damit besetzt. Lübeck/Ostholstein vorher prüfen; ohne Unterscheidungsmerkmal kein Termin |
| **Social-Media-Namen sichern** | 1 Stunde | Betreiber | `@myimmoapp` o. ä. auf Instagram, LinkedIn, YouTube, Facebook belegen, **mit Impressums-Link** (§ 5 DDG gilt auch für geschäftliche Profile, höchstens 2 Klicks: [e-recht24](https://www.e-recht24.de/impressum/13078-impressum-auf-instagram.html)). Belegen heißt nicht bespielen |

---

## 4. Fundament, das gebaut wird (Code und Inhalte)

Alles hier kann Claude im Repo umsetzen. Jeder Punkt soll **nach** dem Start ohne Umbau
mitwachsen.

| # | Baustein | Warum vor dem Start | Aufwand |
|---|---|---|---|
| **F1** | **Messung auf dem Server, ohne Skript:** eine wöchentliche Zählung aus der eigenen Datenbank (Registrierungen, **Aktivierung = Objekt + Mieter + erste Buchung binnen 7 Tagen**, aktive Konten je Woche, Kohorten nach Startwoche, Herkunft per `quelle`/UTM, gespeichert bei der Registrierung) | Ohne Ausgangswert lässt sich nach dem Start nichts skalieren. Ein Durchschnittswert zum Vergleich: Aktivierung bei SaaS im Mittel 36 %, Median 30 % ([Lenny](https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate), Erhebungsdatum nicht belegt). Ohne Skript gibt es keinen Zugriff aufs Endgerät, keine Frage nach § 25 TDDDG und keinen Widerspruch zu „keine Analyse-Tools“ | 1–2 Tage |
| **F2** | **Aktivierungsstrecke:** Willkommens-Mails an Tag 0, 2 und 7 (Brevo, im Vertragsrahmen), dazu die Monatsmail aus `baueHeuteAufgaben()` | Einführungs-Tour und Objekt-Check gibt es schon; es fehlt ein Anlass, wiederzukommen | 1–2 Tage, braucht Brevo |
| **F3** | **Start in Wellen:** Mail an die Warteliste mit Zugangscode, je Welle eine Herkunftsmarke | Steuert die Support-Last; jede Welle wird eine Kohorte für F1 | ½ Tag |
| **F4** | **Web-App-Manifest + Service Worker + `/.well-known/assetlinks.json`** | Installierbar vom Startbildschirm, ohne Store. Voraussetzung für die TWA (Bubblewrap/PWABuilder erzeugen daraus das Paket für Play: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md)). Die Play-Uhr hängt daran | 1 Tag; CSP und Proxy beachten |
| **F5** | **Inhalte für die Saison:** Nebenkostenabrechnung 2025 (Frist 31.12.2026), Heizkosten/Fernablesung, „Abrechnung in X Minuten“ als Vorlage oder Rechner. Aus jedem Ratgeber ein Bild-Karussell per Skript | Die Saison ist jetzt, Rechner sind laut `[[SEO]]` Abschnitt 3 der stärkste verbleibende Hebel | laufend |
| **F6** | **Support-Grundstock:** `/hilfe` mit den 10 häufigsten Fragen, Antwortvorlagen, zugesagte Reaktionszeit passend zu den AGB | Die Zielgruppe ist im Schnitt 58 Jahre alt (IW-Vermieterreport 2026 via [BFW, 01.06.2026](https://www.bfw-newsroom.de/deutschland-immobilien-vermieterreport/)) und schreibt eher, als selbst zu suchen | ½ Tag |
| **F7** | **Belege sammeln, nicht erfinden:** nach der ersten fertigen Abrechnung ein Zitat erbitten, mit schriftlicher Einwilligung. Bis dahin keine Stimmen auf der Seite | Kundenstimmen werden **nie erfunden** (Regel in `CLAUDE.md`) | im Ablauf |

**Bewusst nicht in F1:** Vercel Web Analytics, Plausible, PostHog. DSK und EDSA
widersprechen sich bei skriptbasierter Messung ohne Cookies:
- Die DSK-Orientierungshilfe vom 15.11.2024 sieht das passive Empfangen nicht als Zugriff an ([PDF](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/publikationen/DSK/orientierungshilfen/2024_DSK-OH_Digitale-Dienste.pdf)).
- Die EDSA-Leitlinien 2/2023 (endgültig 16.10.2024) fassen den Begriff weiter ([EDPB](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)).
- Ein Urteil eines deutschen Gerichts gibt es nicht.
- Die Freistellung im Digital Omnibus ist nur ein Vorschlag (19.11.2025).

Außerdem müsste Ziffer 2 der Datenschutzerklärung geändert werden. F1 liefert die Kennzahlen,
die für die Entscheidung zählen, ohne diese Fragen.

---

## 5. Stores: die Fakten, die den Weg festlegen (nachgelesen 03.10.2026)

- **iOS-Weg ohne In-App-Kauf: 3.1.3(f), wörtlich:** *„Free apps acting as a stand-alone
  companion to a paid web based tool … do not need to use in-app purchase, provided there is
  no purchasing inside the app, or calls to action for purchase outside of the app.“*
  ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).
  Die iOS-App bleibt also kostenlos und zeigt keinen Preis, keinen Kaufknopf und keinen Link zur
  Preisseite. Abgerechnet wird nur im Web über Paddle. **Der andere Weg, 3.1.3(b),
  verlangt, dass ein Web-Abo zusätzlich als In-App-Kauf angeboten wird.** Dann zahlt man
  Apple-Provision.
- **EU-Provision ab 01.10.2026** ([Apple: Apps in the EU](https://developer.apple.com/support/apps-in-the-eu/)):

  | Bezahlweg | normal | Small Business Program bzw. Abo ab dem 2. Jahr |
  |---|---|---|
  | In-App-Kauf über Apple | 26 % | 15 % |
  | Fremder Zahlungsanbieter in der App | 20 % | 10 % |
  | Link zum Kauf im Web (Käufe binnen 7 Tagen) | 15 % | 10 % |

  Zum Vergleich Paddle im Web: 5 % + 0,50 $ (`docs/business/KOSTENMODELL.md`).
- **4.2 Mindestfunktion:** „beyond a repackaged website“. Eine reine Webview ist ein bekannter
  Ablehnungsgrund. Bevor iOS kommt, braucht die App etwas, das sie im Browser nicht kann:
  Push-Nachrichten, Kamera zum Belegscan, Face ID.
- **4.8 Anmeldedienste: Korrektur einer alten Notiz.** Apple verlangt nicht mehr
  ausdrücklich „Sign in with Apple“. Wer Google-Login anbietet, braucht **einen weiteren**
  Anmeldedienst, der nur Name und E-Mail erhebt, die E-Mail verbergen lässt und nicht für
  Werbung trackt. In der Praxis ist das trotzdem Sign in with Apple, denn kaum ein anderer Dienst
  erfüllt alle drei Bedingungen. Die Pflicht ist also dieselbe, nur die Begründung ist eine andere.
- **Android: Verifizierungspflicht ab 2027 weltweit**, auch für Apps außerhalb von Play.
  Play-Apps werden laut Google zu 99 % automatisch erfasst
  ([developer.android.com](https://developer.android.com/developer-verification)). Wer nur über
  Play verteilt, hat damit keinen zusätzlichen Schritt.

---

## 6. Betreiber-Liste in Reihenfolge

1. **Brevo** eintragen + SPF/DKIM für `myimmoapp.de` + neu deployen → eigene Adresse in die
   Warteliste eintragen und bestätigen (`/?nl=ok#bald`). *Bis dahin ist jede Reichweite verloren.*
2. **Anwalt anfragen**, mit allen vier Punkten in einer Mail (Memory `Launch-Outreach-Vorlagen.md` §2;
   das dort genannte Startdatum 20.10. durch das neue ersetzen).
3. **Entscheidung S1:** Gratis-Start in der Saison der Nebenkostenabrechnung, ja oder nein, und mit welchem Rechtsstand
   (Abschnitt 2).
4. **Social-Media-Namen belegen** (mit Impressums-Link). Instagram-Test: Läuft er? Die
   Auswertung nach 8 Wochen wäre um den **24.10.2026** fällig.
5. **Vergleichsportale:** die fertigen Texte einreichen, **sobald S1 offen ist** (ein Eintrag
   mit „Coming soon“ bringt nichts und kostet Bewertungen).
6. **Paddle-Konto** anlegen und verifizieren lassen (für S2, die Wartezeit läuft parallel).
7. **DSA-Adresse** festlegen (c/o oder Coworking), danach **Google-Play-Konto** und die Tester-Mail
   (20–25 Leute anschreiben, nicht 12). **Erst wenn F4 steht.**
8. **Haus & Grund Lübeck/Ostholstein:** prüfen, ob dort ein Wettbewerber schon Partner ist.

---

## 7. Nach dem Start: skalieren, aber erst ab Schwellenwerten

| Hebel | Erst wenn | Warum |
|---|---|---|
| Google Ads | S2 läuft und F1 zeigt Kosten je aktiviertem Konto | Vorher lassen sich die Kosten je Kunde nicht messen (`[[MARKETING]]` §1) |
| Empfehlungsprogramm | Aktivierung über dem Durchschnittswert und Konten, die nach 4 Wochen noch aktiv sind | Die Zahlen zur Wirkung stammen von Tool-Anbietern ([GrowSurf](https://growsurf.com/statistics/saas-referral-statistics/)), sind also interessengeleitet; wer nichts mag, empfiehlt nichts |
| Partner/Affiliate | S2 läuft | Vergleichswert: immocloud zahlt 6,50 € je Lead ([affiliate-marketing.de](https://www.affiliate-marketing.de/partnerprogramme/immocloud.de), abgerufen 03.10.2026) |
| Verbände (H&G, VermieterVerein) | Referenzkunden vorhanden | Verbände empfehlen nichts ohne Referenz; der Wettbewerb ist schon dort |
| Fachpresse | Eigene Zahlen oder ein Anlass (Frist, Rechtsänderung) | Ein Start allein ist für Haufe & Co. keine Geschichte |
| iOS/Android | S2 läuft, Abschnitt 5 | Stores sind ein Vertriebskanal, kein Beweis, dass das Produkt gebraucht wird |

---

## 8. Bewusst nicht

- **Product Hunt:** englischsprachig, technikaffines Publikum, für eine deutsche Nische ohne
  Wirkung ([Erfahrungsberichte](https://smollaunch.com/alternatives/product-hunt), keine harten Daten).
- **BetaList:** jede Einreichung kostet Geld ([FAQ](https://betalist.com/faq)) und erreicht dieselbe falsche Zielgruppe.
- **TikTok, eine eigene Facebook-Seite, fünf Kanäle gleichzeitig:** Ein Solo-Betrieb hält höchstens zwei durch.
- **Eine lange Warteliste ohne Termin** (siehe 0.3).
- **Neue Funktionen im Startfenster:** Das Produkt ist breit genug (`[[FEEDBACK-BEWERTUNG-2026-10]]`).

---

## 9. Offener Widerspruch zwischen zwei Quellen im Vault

Die beiden Quellen ordnen YouTube gegensätzlich ein:
- Memory `01 - Marketing/00 - Marketing.md` nennt **YouTube als Priorität 1**.
- `[[MARKETING]]` §2 sagt **„Podcast/YouTube: nein (jetzt)“**.

Beide sind vom Juli/August, keine nennt die andere. **Nicht auflösbar ohne den Betreiber.** Abwägung:
- **Für YouTube:** Seine Videos ranken auch in Google, und die Altersgruppe 50+ wächst in sozialen Medien
  am stärksten ([ARD/ZDF-Medienstudie 2025](https://www.media-perspektiven.de/fileadmin/user_upload/media-perspektiven/pdf/2025/MP_31_2025_ARD_ZDF-Medienstudie_Social_Media_zwischen_Wachstum_und_Saettigung_Nutzungsmuster_und_Plattformdynamiken_in_Deutschland.pdf)).
- **Dagegen:** Ein Video pro Woche neben einer Ausbildung ist der Posten, der als Erstes ausfällt.

Bis zur Entscheidung gilt die Repo-Fassung.

---

## Änderungshistorie

- **03.10.2026:** angelegt. Löst den 90-Tage-Plan aus dem Memory ab (dort als abgelöst markiert,
  er nannte noch Stripe statt Paddle und Capacitor als festen iOS-Weg).
