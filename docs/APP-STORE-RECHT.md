# App Store & Play Store — Rechtliche und formale Voraussetzungen

> **Stand: 29.08.2026.** Recherche mit Primärquellen (Apple Developer, Google Play Console Help,
> gesetze-im-internet.de, Bundesfachstelle Barrierefreiheit) plus **eigene Prüfung des
> MyImmo-Codes**. Belastbarkeit ist je Punkt markiert:
> **[gesichert]** = Primärquelle · **[belegt]** = seriöse Sekundärquelle · **[UNSICHER]** = nicht belastbar geklärt.
>
> ⚠️ Dies ist eine Recherche, **keine Rechtsberatung**. Die als „anwaltlich prüfen" markierten
> Punkte gehören vor den Launch zu einem Anwalt — so wie es `CLAUDE.md` (Repo-Wurzel) ohnehin vorsieht.

Verwandt: [[SEO]] · [[AVV-STATUS]] · [[BEZAHLSYSTEM]] · [[MASTERPLAN]] · [[PROJEKT-STATUS]]

---

## 0. Die Vorab-Frage, die alles andere blockiert

**Brauchen wir den Store-Launch jetzt überhaupt?**

Eine **PWA** („Zum Home-Bildschirm hinzufügen") umgeht sämtliche Anforderungen dieses Dokuments:
keine 99 €/Jahr, keine Trader-Verifizierung, keine 12 Tester, keine IAP-Frage, keine
Alterseinstufung, kein Sign in with Apple, keine Privacy Labels.

Dagegen: keine Store-Sichtbarkeit, schwächere iOS-Push-Unterstützung, geringere wahrgenommene
Seriosität.

➡️ **Einschätzung:** Solange MyImmo kein Geld verdient, ist Store-Präsenz **Marketing, keine
Notwendigkeit**. Der Store-Weg kostet 99 €/Jahr plus mehrere Wochen Arbeit. Diese Frage
gehört beantwortet, **bevor** Punkt 1 angefasst wird.

---

## 1. EU-Recht / Deutschland

### 1.1 DSA — gilt vermutlich JA (entgegen der Intuition)
Der DSA erfasst „Hosting" = jeder Dienst, der *„vom Nutzer bereitgestellte Informationen in
dessen Auftrag speichert"*. Das ist bewusst weit und schließt SaaS ein. **[belegt]**
<https://www.ypog.law/en/insight/digital-services-act>

**Für MyImmo:** Vermieter laden Belege, Dokumente und Mieterdaten hoch → wir speichern im
Auftrag. Das **Mieterportal** verschärft es: Ein Dritter (Mieter) greift auf Inhalte des
Vermieters zu — die klassische Hosting-Konstellation.

**Entwarnung:** MyImmo ist **keine „Online-Plattform"** (die verlangt zusätzlich *öffentliche
Verbreitung*). Die schweren Pflichten (Art. 20–28) entfallen; Kleinstunternehmen sind nach
Art. 19 ohnehin ausgenommen. **[gesichert]**

**Was als Hosting-Anbieter unserer Größe bleibt:**

| Pflicht | Artikel | Inhalt |
|---|---|---|
| Kontaktstelle für Nutzer | Art. 12 | elektronisch, direkt, **nicht rein automatisiert** (kein reiner Chatbot); Sprachen angeben |
| Kontaktstelle für Behörden | Art. 11 | separat benennen und veröffentlichen |
| AGB-Transparenz | Art. 14 | Angaben zu Moderation, Algorithmen, Beschwerdewegen |
| Melde-/Abhilfeverfahren | Art. 16 | elektronisches Meldeformular für rechtswidrige Inhalte |
| Begründung bei Sperrung | Art. 17 | „Statement of Reasons" an Betroffene |
| Transparenzbericht | Art. 15 | **entfällt** (< 50 MA, ≤ 10 Mio. €) |

*Kritische Einordnung:* Es gibt **keine höchstrichterliche Klärung**, ob ein reines
Verwaltungs-SaaS wirklich Hosting-Dienst ist. Die Literatur tendiert dazu, viele Anbieter
ignorieren es. Der Aufwand ist klein (Kontaktstelle + Formular + AGB-Klausel), das Risiko einer
Fehleinschätzung nicht → **im Zweifel umsetzen**.

### 1.2 P2B-Verordnung — NICHT anwendbar ✅
Gilt für Dienste, über die gewerbliche Nutzer **Verbrauchern** etwas anbieten. MyImmo vermittelt
nichts; die Mieter-Beziehung entsteht außerhalb. **[belegt]**
*Umgekehrt:* Apple und Google sind uns gegenüber P2B-pflichtig (30-Tage-Vorlauf bei
AGB-Änderungen, Begründung bei Kontosperrung) — eine **Schutzposition**, keine Pflicht.

### 1.3 BFSG — hier steckt das größte Missverständnis
In Kraft seit **28.06.2025**, Marktüberwachung (MLBF Magdeburg) arbeitet seit 26.09.2025.
**[gesichert]** <https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/FAQ/faq_node>

⚠️ **Die Annahme „B2B-SaaS, also nicht betroffen" ist bei MyImmo wahrscheinlich FALSCH.**
Vermietung ist nach st. Rspr. Vermögensverwaltung, kein Gewerbe — private Kleinvermieter werden
vielfach als **Verbraucher** behandelt. Die B2B-Ausnahme greift nur, wenn das Angebot *erkennbar
ausschließlich* an Unternehmer gerichtet ist. Unsere Zielgruppe heißt wörtlich „private
Vermieter". **[belegt]** <https://datenschutz-generator.de/bfsg-ratgeber/>

Auch **„kostenlos" schützt nicht**: Unentgeltliche Angebote können erfasst sein, wenn Daten als
Gegenleistung dienen — und Early Access ist ausdrücklich auf spätere Bezahlung angelegt.

✅ **Rettungsanker: Kleinstunternehmen-Ausnahme** — < 10 Beschäftigte **UND** ≤ 2 Mio. € Umsatz
→ befreit. MyImmo erfüllt das zweifelsfrei. **[gesichert]**

**Wäre die Ausnahme weg:** EN 301 549 → **WCAG 2.1 Level A + AA**, plus „Erklärung zur
Barrierefreiheit". Bußgeld bis **100.000 €** (§ 37 BFSG), Untersagung möglich. **[belegt]**

➡️ **Praktisches Risiko:** Die Ausnahme hängt an einer Schwelle, die wir bei Erfolg reißen.
**Wer erst bei 2 Mio. € Umsatz mit WCAG anfängt, baut die App zweimal.** Neue Bildschirme ab
jetzt AA-nah bauen ist billiger als eine spätere Sanierung.
**[UNSICHER]:** Ob eine wettbewerbsrechtliche Abmahnung über § 3a UWG möglich ist — dazu keine
Rechtsprechung gefunden.

### 1.4 §§ 327 ff. BGB — Aktualisierungspflicht
Gilt für Verbraucherverträge über digitale Produkte gegen Preis — **oder gegen
personenbezogene Daten** (§ 327 Abs. 3). Das kann sogar den kostenlosen Early Access erfassen.
**[gesichert]** <https://www.gesetze-im-internet.de/bgb/__327.html>

**§ 327f — Funktions- und Sicherheitsupdates sind Vertragspflicht**, nicht Kulanz; bei
Dauerschuldverhältnissen über die **gesamte Laufzeit**; Nutzer müssen darüber **informiert**
werden. Ansprüche verjähren nicht vor 12 Monaten nach Ende der Pflicht.

➡️ **Für uns konkret:** (a) Sicherheitsupdates schuldet man; (b) Release-Notes-Mail o. Ä. nötig;
(c) Features abkündigen ist eine **Änderung nach § 327r** — nur mit triftigem Grund,
Vorankündigung und ggf. Kündigungsrecht; (d) **veraltet die Anlage-V-Berechnung durch
Gesetzesänderung, ist die Aktualisierung geschuldet** — bei einem Steuer-Tool ein realer,
wiederkehrender Kostenblock.

### 1.5 Widerruf & Kündigungsbutton (erst mit Bezahlsystem)
**Widerruf digitale Inhalte:** Erlischt nur bei (1) ausdrücklicher Zustimmung zum vorzeitigen
Beginn, (2) Bestätigung der Kenntnis vom Verlust, (3) **Bestätigung auf dauerhaftem Datenträger
(E-Mail)** — eine reine In-App-Anzeige genügt regelmäßig nicht. **[belegt]**

**Entlastung:** Verkauft Apple/Google per IAP im eigenen Namen, ist der **Store**
Verbrauchervertragspartner. Bei **Paddle** (Merchant of Record) verlagert sich das ebenfalls.
Nur bei Direktverkauf über die eigene Website läge alles bei uns.

**Kündigungsbutton § 312k BGB — Rechtsprechung hat sich verschärft [belegt]:**
- **BGH 22.05.2025 (I ZR 161/24):** greift auch bei **Einmalzahlung** mit fortlaufender Leistung
- **OLG Köln 10.01.2025 / OLG Nürnberg 30.07.2024:** muss **ohne Login** dauerhaft erreichbar sein
- **OLG Hamburg 26.09.2024:** „Kündigungsabsicht abschicken" genügt nicht
- **BGH 16.07.2026:** Auf der Bestätigungsseite **nur** Formular und Bestätigungsbutton —
  Hinweise auf Alternativen sind unzulässig, selbst wenn sachlich vorteilhaft
- **Sanktion:** fehlt/versagt er, kann jederzeit **fristlos** gekündigt werden (§ 312k Abs. 6)

### 1.6 DSGVO-Besonderheiten für Apps
- **Nutzer-AVV (Art. 28)** bleibt der Kernpunkt — Vermieter = Verantwortlicher, wir =
  Auftragsverarbeiter. Steht seit Langem offen (siehe [[AVV-STATUS]]).
- **ATT (App Tracking Transparency):** nur bei app-übergreifendem Tracking/IDFA nötig → für eine
  Verwaltungs-App **nicht erforderlich**. ATT und DSGVO-Consent sind **kumulativ**, nicht
  alternativ. **[belegt]**
- **Privacy Manifest (`PrivacyInfo.xcprivacy`):** seit Frühjahr 2024 Pflicht für jede App **und
  jedes SDK** — erhobene Datentypen, Zweck, Verknüpfung, Tracking; „Required Reason APIs"
  begründen. **[gesichert]**
- ⚠️ **Häufigster Fallstrick:** Privacy-Angaben im Store müssen **inhaltlich zur
  Datenschutzerklärung passen**. Widersprüche sind zugleich Rejection-Grund und
  Beschwerde-Aufhänger.

### 1.7 Impressum (§ 5 DDG)
Pflicht **auch für Apps**: Name, **ladungsfähige Anschrift** (kein Postfach), E-Mail, zweiter
schneller Kontaktweg. Muss an **zwei** Stellen stehen: **in der App** (Faustregel „zwei Klicks",
ständig verfügbar) **und** auf der Store-Produktseite. **[belegt]**
<https://www.gesetze-im-internet.de/ddg/__5.html>

---

## 2. Apple App Store

### 2.1 Developer Program
| Punkt | Wert |
|---|---|
| Gebühr | **99 €/Jahr** (wiederkehrend) |
| D-U-N-S bei *Individual* | **nicht nötig** |
| Voraussetzungen | Apple Account mit **2FA**, Volljährigkeit, Zahlungsmittel |
| Dauer | typ. 24–48 h, teils bis 2 Wochen |
**[gesichert]** <https://developer.apple.com/help/account/membership/program-enrollment>

⚠️ **Vor der Anmeldung entscheiden:** Als *Individual* erscheint im Store **der eigene Name**,
nicht „MyImmo". Für den Anzeigenamen „MyImmo" braucht es einen **Organization-Account mit
D-U-N-S**. Der Wechsel Individual → Organization ist nachträglich mühsam. **[belegt]**

### 2.2 Trader-Status (DSA Art. 30/31) — Pflicht, auch bei kostenlosen Apps
Anzugeben: Anschrift **oder Postfach**, Telefon, E-Mail, Zahlungskontodaten + Zertifizierung +
**Nachweisdokument** (die **Gewerbeanmeldung passt**). Verifizierung per 2FA-Code und
Dokumenten-Review. **Ohne Trader-Angaben keine EU-Distribution.** **[gesichert]**
<https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/>

⚠️ **Datenschutz-Realität:** Diese Daten stehen **öffentlich auf der Store-Seite**. Bei einer
Privatadresse ist das ein echtes Problem → Apple erlaubt ein **Postfach**. Für § 5 DDG bleibt
aber die **ladungsfähige Anschrift** Pflicht. Beide Anforderungen sind nicht identisch.

Sich als „Non-Trader" einzustufen wäre bei uns **falsch** (Gewerbeanmeldung, geplante
Monetarisierung) und ein Verstoß gegen die Entwicklervereinbarung.

### 2.3 Review Guidelines — die kritischen Punkte

**4.2 Minimum Functionality — größtes Ablehnungsrisiko [gesichert]**
> „Your app should include features, content, and UI that elevate it beyond a repackaged website."

*Praxis (belegt, nicht offiziell):* Reviewer schalten das Gerät in den **Flugmodus** — zeigt die
App dann eine weiße Seite oder einen Browserfehler, gilt sie als Web-Wrapper.

**3.1.1 In-App Purchase** — hier liegt das Paddle-Problem. **3.1.3(c) Enterprise** hilft
**nicht**: „Consumer, single user, or family sales must use in-app purchase" — private Vermieter
sind Einzelnutzer.

✅ **3.1.3(f) Free Stand-alone Apps — der gangbare Weg [gesichert]**
> „Free apps acting as a stand-alone companion to a paid web based tool […] do not need to use
> in-app purchase, **provided there is no purchasing inside the app, or calls to action for
> purchase outside of the app**."

➡️ Die App bleibt kostenlos und **vollständig kaufhinweisfrei** — kein Preis, kein Link, kein
„Upgrade"-Text, keine Tarif-Erwähnung. Bezahlt wird nur auf der Website.

**4.8 Sign in with Apple — Pflicht, weil wir Google-Login anbieten [gesichert]**
Ausnahme: *„Your app **exclusively** uses your company's own account setup"*.
➡️ **Zweiter, günstigerer Weg (in `CLAUDE.md` (Repo-Wurzel) bisher nicht notiert):** Google-Login **in der
iOS-App abschalten** (nur E-Mail/Passwort) → Ausnahme greift, Sign in with Apple entfällt.

**5.1.1(v) Account Deletion** — Pflicht seit 30.06.2022, **in der App**. Nur per E-Mail oder nur
auf der Website genügt nicht.

### 2.4 Externe Zahlungen & DMA — lohnt sich für uns nicht
Mit **External Purchase Link Entitlement** darf in der EU auf die eigene Website verlinkt werden.
Kosten (Apple EU-Konditionen seit Juni 2025): Initial Acquisition Fee **2 %** + Store Services
Fee **5 %** (Tier 1) oder **13 %** (Tier 2) + Core Technology Commission **5 %**
→ **ca. 12–20 %** *zusätzlich* zu Paddle. Die alte Core Technology Fee läuft zum 01.01.2026 aus.
**[belegt, keine Primärquelle]**

➡️ **Schlechter als 15 % IAP** (Small Business Program) und deutlich komplizierter.
**Der sinnvolle Weg bleibt 3.1.3(f).**
**[UNSICHER]:** Die Prozentsätze stammen aus Sekundärquellen; laufende DMA-Verfahren machen
Änderungen wahrscheinlich → **vor jeder Geldentscheidung Apples Primärseite lesen.**

### 2.5 Alterseinstufung
System am 24.07.2025 überarbeitet (neu: **13+, 16+, 18+**); seit **31.01.2026** blockiert Apple
Einreichungen ohne ausgefüllten Fragebogen. MyImmo dürfte **4+** sein — die Frage nach
„unbeschränktem Web-Zugriff" ist bei einer WebView-App aber sorgfältig zu beantworten
(falsches „Nein" = Rejection). **[gesichert]** <https://developer.apple.com/news/?id=ks775ehf>

---

## 3. Google Play

### 3.1 Konto & Gebühren
| Punkt | Wert |
|---|---|
| Registrierung | **25 USD einmalig** |
| Personal Account | Regierungs-Ausweis |
| Organization Account | **D-U-N-S** + Geschäftsdokumente |
**[gesichert]** <https://support.google.com/googleplay/android-developer/answer/6112435>

### 3.2 ⏳ Die 12-Tester-Regel — größter Zeitfresser
Persönliche Konten, die **nach dem 13.11.2023** angelegt wurden, müssen vor dem
Produktionszugang einen **geschlossenen Test mit ≥ 12 Testern über 14 zusammenhängende Tage**
fahren; seit 2026 prüft Google zusätzlich die **tatsächliche Nutzung**.
✅ **Organisationskonten mit eingetragener Rechtsperson sind ausgenommen.** **[gesichert]**
<https://support.google.com/googleplay/android-developer/answer/14151465>

➡️ Eine **D-U-N-S-Beantragung ist der einzige Schritt, der beide Stores gleichzeitig entlastet**
(Apple-Anzeigename „MyImmo" **und** möglicher Wegfall der 12 Tester).
**[UNSICHER]:** Ob Google ein deutsches Einzelunternehmen **ohne HR-Eintrag** als „registered
legal business entity" akzeptiert — die Gewerbeanmeldung sollte genügen, **keine offizielle
Bestätigung gefunden**. Vorab klären.

### 3.3 Kontolöschung — strenger als bei Apple
Zwei Wege nötig: **(1) In-App**-Löschung von Konto und Daten **und (2) eine öffentliche Web-URL**
(ohne App-Installation erreichbar), die auf der Store-Seite angezeigt wird. Durchsetzung seit
15.04.2024. **[gesichert]** <https://support.google.com/googleplay/android-developer/answer/13327111>

### 3.4 Data Safety
Pflichtformular: erhobene/geteilte Daten, Zwecke, Transportverschlüsselung, Löschmöglichkeit.
Muss zur Datenschutzerklärung passen. **[gesichert]**

### 3.5 Billing / DMA — ab 30.06.2026 neu **[gesichert, Google-Blog]**
- **Service Fee 10 %** auf die ersten 1 Mio. USD **und auf alle automatisch verlängernden Abos** —
  **unabhängig** von Billing-Weg (auch bei externen Links)
- **+5 % Billing Fee** nur bei Google Play Billing
- Zunächst US, UK, EWR
<https://android-developers.googleblog.com/2026/06/play-expanded-billing.html>

➡️ **10 % bei Google ist deutlich attraktiver als der Apple-Weg**, und externe Links sind seit
2026 ausdrücklich erlaubt. Bleibt die App kaufhinweisfrei, stellt sich die Frage gar nicht.
**[UNSICHER]:** Ob die 10 % auch bei rein **außerhalb** der App abgeschlossenen Web-Abos greifen —
aus dem Blogpost nicht eindeutig. Vor jeder Kalkulation die Play-Console-Gebührentabelle lesen.

### 3.6 Android Developer Verification
Zeitplan **[gesichert]**: 30.09.2026 Stichtag für BR/ID/SG/TH; **für Deutschland nur
„2027 and beyond"**, kein Datum veröffentlicht.
<https://developer.android.com/developer-verification>

---

## 4. PWA vs. nativer Wrapper

**Ein Capacitor/WebView-Wrapper ist einreichbar — aber nicht als bloßer URL-Loader.**
Google Play ist deutlich toleranter; bei **Apple** scheitern Wrapper an Guideline 4.2.

**Was MyImmo mindestens braucht [belegt aus Praxisberichten — Apple veröffentlicht bewusst
keine Checkliste]:**
1. **Nativer Offline-Zustand** — eigener Bildschirm statt Browserfehler
2. **Native Navigation** — echte Tab-Bar, native Übergänge
3. **Push-Benachrichtigungen** — bei uns naheliegend: Miete fällig, NK-Frist, Ablesetermin
4. **Native Gerätefähigkeiten** — **hier liegt unser stärkster Hebel: Kamera-Beleg-Scan**
   (die OCR-Pipeline existiert bereits), Share-Sheet, Face-ID-Sperre, Kalender-Integration
5. Keine sichtbaren Browser-Artefakte, kein Absprung nach Safari

➡️ **Einschätzung:** MyImmo hat es hier leichter als die meisten — Beleg-Scan und Fristen-Push
sind keine Feigenblätter, sondern echte Produktverbesserungen, die die 4.2-Hürde nebenbei nehmen.

---

## 5. Prüfung: Wie steht MyImmo da? (Code geprüft, 29.08.2026)

| Anforderung | Stand | Beleg |
|---|---|---|
| **Kontolöschung in der App** | ✅ **vorhanden** | `lib/actions/account.ts:29`, eingebunden in `SettingsView.tsx:774` |
| Öffentliche Lösch-URL (Google) | ❌ **fehlt** | keine Route gefunden |
| DSA-Kontaktstelle (Art. 11/12) | ❌ **fehlt** | nichts in `/impressum`, `/agb` |
| DSA-Meldeformular (Art. 16) | ❌ **fehlt** | — |
| AGB-Transparenz (Art. 14) | ❌ **offen** | Moderation/Beschwerdewege nicht geregelt |
| Nutzer-AVV (Art. 28 DSGVO) | ❌ **offen** | siehe [[AVV-STATUS]] |
| Impressum (Website) | ✅ vorhanden | mit Gewerbeanmeldung abgeglichen (24.07.2026) |
| Impressum **in der App** | ⚠️ prüfen | Footer-Link vorhanden, „zwei Klicks" im App-Kontext prüfen |
| Google-Login | ✅ vorhanden | `app/login/page.tsx:239` → **macht Sign in with Apple zur Pflicht** |
| Sign in with Apple | ❌ fehlt | oder Google-Login auf iOS abschalten |
| Kündigungsbutton § 312k | ❌ fehlt | erst mit Bezahlsystem nötig |
| Barrierefreiheit (WCAG 2.1 AA) | 🟡 auf dem Weg | Audits 08/2026: Labels, Fokusringe, Kontraste behoben |
| Privacy Manifest / Labels | ❌ n/a | erst mit nativer App |

---

## 6. Prioritätenliste

### Stufe A — ohnehin fällig, blockiert den Store
1. **Nutzer-AVV (Art. 28 DSGVO)** — steht seit Langem offen. Ein Store-Launch skaliert die
   Mieterdatenverarbeitung; ohne AVV ist das **das größte Einzelrisiko im Projekt**.
   → *anwaltlich prüfen*
2. **DSA-Pflichten umsetzen** — Kontaktstellen (Nutzer + Behörden, mit Sprachangabe),
   Meldeformular, AGB-Ergänzung. Kleiner Aufwand, reales Risiko. Muss **vor** der
   Store-Einreichung stehen, weil die Store-Seite darauf verweist.
3. **Öffentliche Lösch-URL** bauen (Google verlangt sie; die In-App-Löschung haben wir schon).
4. **BFSG-Position schriftlich festhalten:** Kleinstunternehmen-Ausnahme greift **derzeit**.
   Die Annahme „B2B, also nicht betroffen" ist falsch. Neue Bildschirme ab jetzt AA-nah bauen.

### Stufe B — lange Vorlaufzeiten, früh starten
5. **D-U-N-S beantragen** (kostenlos, 5–30 Werktage) — entlastet **beide** Stores.
   Vorher klären, ob Google die Gewerbeanmeldung akzeptiert.
6. **Apple Developer Program** (99 €/Jahr) + Trader-Verifizierung (**Postfach** für die
   öffentliche Anzeige erwägen).
7. **Google Play Console** (25 USD) + Trader-Status + Data Safety.

### Stufe C — Produkt/Technik
8. **Monetarisierung: Apple 3.1.3(f) wählen.** App kostenlos und **vollständig
   kaufhinweisfrei**. Dafür muss `PREISE_SICHTBAR` in `lib/preise.ts` **plattformabhängig**
   werden — heute ist der Schalter global.
9. **Guideline 4.2 absichern:** Kamera-Beleg-Scan, Fristen-Push, nativer Offline-Screen,
   native Tab-Navigation, Face-ID-Sperre.
10. **Sign in with Apple** — oder günstiger: Google-Login auf iOS abschalten.
11. **Privacy Manifest + Nutrition Labels + Data Safety** — wörtlich passend zu `/datenschutz`.
12. **Impressum in der App** (zwei Klicks) + Datenschutz-Link in App und Store-Metadaten.
13. **Alterseinstufungs-Fragebogen** (neues System).

### Stufe D — erst mit Bezahlsystem (siehe [[BEZAHLSYSTEM]])
14. **Kündigungsbutton § 312k** — ohne Login erreichbar, Bestätigungsseite **nur** Formular
    + Button (BGH 16.07.2026). Fehler = jederzeitiges fristloses Kündigungsrecht.
15. **Widerrufsbelehrung** mit korrektem Erlöschen (§ 356 Abs. 5): Zustimmung +
    Kenntnisbestätigung + **E-Mail-Bestätigung**.
16. **§ 327f dokumentieren** — Update-Zusage in die AGB, Nutzer über Updates informieren,
    Prozess für § 327r bei Feature-Abkündigungen.

---

## 7. Was NICHT belastbar geklärt ist

- Google-Play-Trader-Status: keine offizielle Hilfeseite mit Stichtag gefunden
- Google-Gebühren ab 30.06.2026: Tiers 2–4 unbeziffert; Geltung bei reinen Web-Abos unklar
- Apple-EU-DMA-Gebühren: nur Sekundärquellen; laufende Verfahren
- Developer Verification Deutschland: kein Datum
- BFSG: keine Rechtsprechung zur Verbrauchereigenschaft privater Vermieter; § 3a UWG offen
- DSA-Einordnung eines Verwaltungs-SaaS als Hosting-Dienst: Literaturmeinung, keine Rspr.
- Google-Akzeptanz eines Einzelunternehmens ohne HR-Eintrag für die 12-Tester-Befreiung

➡️ Für die Punkte **1, 4, 14, 15, 16** gilt wie in `CLAUDE.md` (Repo-Wurzel) festgehalten:
**anwaltlich prüfen lassen, nicht selbst entscheiden.**
