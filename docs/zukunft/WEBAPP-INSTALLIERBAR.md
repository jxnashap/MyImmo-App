# Installierbare Web-App („Browser-Download“) — Plan und Datenrecht

> **Stand: 10.10.2026.** Idee von Jonas (Memory-Ideenliste, 10.10.2026: „Installierbare Webapp — MyImmo
> aus dem Browser heraus als App auf Startbildschirm/Desktop installieren, ohne App Store“).
> Belastbarkeit je Punkt: **[gesichert]** Primärquelle · **[belegt]** seriöse Sekundärquelle ·
> **[UNSICHER]** nicht belastbar geklärt. Recherche, **keine Rechtsberatung**.
>
> Verwandt: [[APP-STORE-RECHT]] (Stores: DSA, Apple 4.2/4.8, Play-Tester — hier nicht wiederholt) ·
> [[LAUNCH-FUNDAMENT]] Baustein **F4** (dort schon als Voraussetzung für Play/TWA geführt).

---

## 0. Was gemeint ist — und was nicht

**Gemeint:** eine **Progressive Web App (PWA)**. Der Nutzer installiert MyImmo aus dem Browser:
Chrome/Edge (Installieren-Symbol in der Adresszeile), Android („App installieren“), iPhone/iPad
(Safari → Teilen → „Zum Home-Bildschirm“). MyImmo öffnet dann wie eine App, im eigenen Fenster
ohne Browserleiste, mit Symbol auf dem Startbildschirm oder im Dock.

Es bleibt **dieselbe Web-App**. Es gibt keinen Store, keine Gebühren und keine Prüfung.
Jedes Deployment ist sofort beim Nutzer, Updates verteilt niemand.

**Nicht gemeint:**
- ein Desktop-Programm (Electron o. Ä.) — eigener Installer, Code-Signatur, eigener Update-Weg,
  kein Mehrwert gegenüber der PWA;
- der Datenexport (`/api/export/alles`) — gibt es schon;
- die Stores — bleiben Startstufe S3 ([[APP-STORE-RECHT]]). Die PWA ist dafür ohnehin
  Voraussetzung (Android-TWA baut auf Manifest und Service Worker auf, F4).

**Ist-Stand im Code (10.10.2026):** kein Web-App-Manifest, kein Service Worker, keine
Apple-Web-App-Angaben; nur `app/icon.svg`. Das große Kachel-Logo `public/myimmo_logo_2048.png`
liegt bereit.

---

## 1. Empfehlung

**Stufe 1 bauen: installierbar, aber ohne Inhalte auf dem Gerät.** Gespeichert werden nur:
- Manifest und Symbole;
- ein schlanker Service Worker, der Programmdateien (`/_next/static/…`, Schriften, Symbole) und
  eine Offline-Seite vorhält.

**Keine Mieter-, Objekt- oder Steuerdaten auf dem Gerät.** Damit bleibt die Datenschutzlage
fast unverändert (Abschnitt 3), und der Aufwand liegt bei 1–2 Tagen.

**Push-Nachrichten (Stufe 2) erst, wenn es Nutzer gibt** — mit Einwilligung, Datenschutz-Ziffer
und einer Anwaltsfrage.

**Offline-Lesen von Inhalten (Stufe 3) ist nicht empfohlen** (Abschnitt 3.2).

---

## 2. Stufen

### Stufe 1 — installierbar (≈ 1–2 Tage)

| Baustein | Inhalt | Achtung |
|---|---|---|
| **Manifest** `app/manifest.ts` | `name` „MyImmo“, `short_name`, `id`, `start_url` `/`, `scope` `/`, `display: standalone`, Farben aus den Tokens, Symbole 192/512 + `maskable` (aus `myimmo_logo_2048.png`) | Muss **ohne Anmeldung** abrufbar sein → in `lib/oeffentlich.ts` und am 2FA-Gate vorbei (`mfaAusgenommen`) |
| **Apple-Angaben** | `apple-touch-icon` 180 px, `appleWebApp` (Titel, Statusleiste) in den Root-Layouts | iPhone kennt keinen Installations-Dialog |
| **Service Worker** `public/sw.js` | Cache **nur** für unveränderliche Programmdateien (`/_next/static/*` mit Hash im Namen, `/fonts/*`, Symbole) und eine statische Offline-Seite. HTML, `/api/*`, Supabase, Belege und Dateien **nie** cachen, sondern immer Netz | HTML enthält Daten **und** die CSP-Nonce je Anfrage — ein gecachtes HTML wäre doppelt falsch |
| **Registrierung** | **nur im angemeldeten App-Bereich** (Vermieter, Mieterportal, Service), nicht auf der Startseite und den Ratgebern | Hält Besucher der Werbeseiten aus jeder Speicher-Frage heraus (3.1) |
| **CSP** (`proxy.ts`) | `worker-src 'self'` und `manifest-src 'self'` ausdrücklich setzen | Fällt heute auf `default-src 'self'` zurück, besser ausdrücklich |
| **Update-Weg** | neue Version → Hinweis „Neue Version — neu laden“; `sw.js` mit `Cache-Control: no-cache`; **Notschalter**: eine `sw.js`, die sich selbst abmeldet | Ein fehlerhafter Service Worker kann Nutzer auf einer alten Version festhalten (§ 327f BGB, Abschnitt 3.7) |
| **Abmelden** | Abmelde-Weg leert den Programm-Cache (`Clear-Site-Data: "cache"`) | Nicht `"storage"` — das löschte auch Hell/Dunkel und Rechner-Entwürfe |
| **Hinweis „Als App installieren“** | ruhig in Einstellungen und `/hilfe`; Chromium über `beforeinstallprompt`, iPhone als Bild-Anleitung | Kein Banner auf der Startseite („ruhiger“ ist die Vorgabe) |
| **Datenschutz Ziffer 6 + AVV-TOM** | ein Satz: Programmdateien im Gerät, keine Inhalte (Abschnitt 3.1, 3.3) | Gleiche PR wie der Code |
| **Prüfung** | Tests: Manifest, Gate-Ausnahmen, CSP, keine Cache-Regel für HTML/API. **Betreiber:** Installation auf echtem iPhone und Android, Abmelden, Update | Chromium in der Cloud-Umgebung erreicht die Live-Seite nicht vollständig — Gerätetest bleibt beim Betreiber |

### Stufe 2 — Push-Nachrichten (≈ 2–3 Tage + Anwaltsfrage)

Anlässe, die es heute schon als Hinweis-Mail gibt (`lib/benachrichtigung.ts`): neue Nachricht im
Portal, Termin, Zustellung, Miete überfällig, Frist.

- **Einwilligung:** Der Browser-Dialog ist nur die Technik. Zusätzlich braucht es einen eigenen
  Schalter in den Einstellungen mit Zweck und Widerruf.
- **iPhone:** Push geht nur in der installierten Web-App und nur nach einer Nutzeraktion
  **[gesichert]** ([WebKit, 16.02.2023](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Inhalt wie bei den Hinweis-Mails: nie Titel oder Inhalt** („Neue Nachricht in MyImmo“).
- **Technik:** VAPID-Schlüssel als Env, Tabelle für Abos (Endpunkt, Schlüssel, Konto). Dazu gehören
  Kaskade auf `auth.users` oder `delete_own_account()`, `demo_schreibsperre`, Policies und eine
  Abmeldung je Gerät.

### Stufe 3 — Inhalte offline lesen (nicht empfohlen)

Etwa „letzte Objektliste ohne Netz“. Dagegen spricht 3.2. Nur auf ausdrücklichen Wunsch,
dann mit kurzer Ablaufzeit, verschlüsselt und mit Löschung beim Abmelden. Vorher eine eigene
Risikoabwägung schreiben.

---

## 3. Was rechtlich mit den Daten zu beachten ist

### 3.1 Speichern auf dem Gerät — § 25 TDDDG [gesichert]

Wortlaut (gesetze-im-internet.de, Abruf 10.10.2026):
- **Abs. 1:** Speichern oder Auslesen auf dem Endgerät nur mit Einwilligung.
- **Abs. 2 Nr. 2:** Ohne Einwilligung zulässig, wenn es „unbedingt erforderlich ist, damit der
  Anbieter … einen vom Nutzer **ausdrücklich gewünschten** digitalen Dienst zur Verfügung stellen
  kann“.

**Folgerung für Stufe 1:** Wer die App nutzt oder installiert, wünscht sie ausdrücklich. Programmdateien,
Offline-Seite und Manifest sind für diesen Dienst erforderlich. Das ist dieselbe Begründung, mit der
`/datenschutz` Ziffer 6 heute Sitzungs-Cookies und lokale Einstellungen erklärt (kein Cookie-Banner).

**Risiko:** Ein Service Worker für **alle** Besucher der Werbeseiten wäre schwerer zu begründen.
Deshalb gilt die Registrierung nur im App-Bereich.

**[UNSICHER]** Ob „schnelleres Laden“ allein als „unbedingt erforderlich“ gilt, ist nicht
entschieden. Wir stützen uns deshalb auf den gewünschten Dienst (App, Offline-Seite), nicht auf
Geschwindigkeit.

**Zu ändern:** `/datenschutz` Ziffer 6 bekommt einen Satz, etwa: „Wenn Sie MyImmo als App nutzen,
speichert Ihr Browser Programmdateien der App (keine Inhalte), damit sie startet und ohne Netz
einen Hinweis zeigt.“

### 3.2 Keine Inhalte auf dem Gerät — Art. 5 Abs. 1 c, Art. 25, Art. 32 DSGVO

MyImmo zeigt Mieterdaten:
- Namen, Anschriften, Mietkonto, entschlüsselte IBAN;
- Selbstauskünfte, Bewerbungsunterlagen, Ausweise im Makler-Ordner.

Lägen solche Seiten oder Dateien im Gerät-Cache:
- Ein **verlorenes oder geteiltes Gerät** wäre eine mögliche Datenpanne beim Vermieter
  (Art. 33/34 — er ist Verantwortlicher).
- **„Konto löschen“** (Art. 17) erreicht keine Kopie auf einem Gerät.
- Die **Zustellung ins Portal** setzt „abgerufen“ beim Abruf über die Datei-Route. Eine Kopie aus
  dem Cache unterliefe den Nachweis.

**Darum Regel für Stufe 1: HTML, API, Dateien und Supabase-Antworten nie cachen.** Ein Test sucht
im Service Worker nach Cache-Regeln für diese Pfade.

### 3.3 Rollen und AVV — Art. 28 DSGVO

Der Vermieter ist Verantwortlicher für die Daten seiner Mieter, MyImmo verarbeitet im Auftrag.
Das Gerät gehört dem Vermieter, aber **was die App dort ablegt, legt MyImmo fest**. Das ist eine
technische und organisatorische Maßnahme im Sinne von Art. 25/32.

**Zu ändern:** `lib/avvInhalt.ts` (TOM) und das AVV-PDF um einen Satz ergänzen: „Die App legt auf
Endgeräten nur Programmdateien ab, keine Inhalte.“ Das folgt aus der Regel in `CLAUDE.md`: neue
Funktion mit Daten Dritter → AVV mitziehen.

### 3.4 Mieterportal und Service-Partner als App

Für Mieter und Partner gilt dasselbe: Sie sind Betroffene, nicht Kunden. Ihre Geräte bekommen
ebenfalls nur Programmdateien. Das ist die Voraussetzung für die verwandte Idee „Mieterportal per
QR-Code als PWA“.

### 3.5 Push-Nachrichten (Stufe 2)

- **Einwilligung:** Browser- oder Systemberechtigung **und** eigener Schalter mit klarem Zweck.
  Die Rechtsgrundlage lässt Stufe 1 offen, sie gehört vor Stufe 2 auf die Anwaltsliste.
- **Datenfluss:** Die Nachricht läuft über den Push-Dienst des Browserherstellers
  (Apple, Google, Mozilla, Microsoft).
  - Der Inhalt ist Ende-zu-Ende verschlüsselt (RFC 8291, „Message Encryption for Web Push“).
  - Der Dienst sieht Endpunkt, Zeitpunkt und Größe **[belegt]**. Damit fließen **Metadaten in
    Drittländer**; die Datenschutzerklärung muss das nennen.
  - **[UNSICHER]** Ob der Push-Dienst eigener Verantwortlicher oder Empfänger ist → Anwaltsfrage.
- **Inhalt nie personenbezogen** — dieselbe Regel wie bei den Hinweis-Mails
  (`benachrichtigungsMail` nimmt bewusst nur Art und Basis).

### 3.6 Anmelden, Abmelden, geteilte Geräte

- **iPhone:** Die installierte Web-App hat einen eigenen Speicher, getrennt von Safari. Der Nutzer
  meldet sich dort neu an. Zwei-Faktor und frische Anmeldung (`pruefeFrischeAnmeldung`) gelten
  unverändert.
- **„Beim Schließen abmelden“** (`components/AutoLogout.tsx`) erkennt das Schließen über
  `sessionStorage`. Eine installierte App wird oft nur pausiert, nicht geschlossen → auf echten
  Geräten prüfen, sonst bleibt eine Sitzung offen, die der Nutzer für beendet hält.
- **Abmelden** leert den Programm-Cache (Stufe 1) und meldet ab Stufe 2 das Push-Abo dieses Geräts ab.

### 3.7 Pflichten, die mitwandern

- **Impressum und Datenschutz** (§ 5 DDG) müssen „ständig verfügbar“ sein. Im App-Fenster gibt
  es keine Browserleiste → Links in der App erreichbar machen (Einstellungen/Hilfe, höchstens
  zwei Klicks). Das ist schon in [[APP-STORE-RECHT]] 1.7 vermerkt.
- **Aktualisierung** (§§ 327f ff. BGB, sobald es zahlende Verbraucher gibt): Die PWA aktualisiert
  sich selbst. Der Service Worker darf das nicht verhindern (Update-Hinweis, Notschalter, Stufe 1).
- **Barrierefreiheit:** keine neue Lage. Das BFSG gilt für MyImmo als Kleinstunternehmen derzeit
  nicht ([[APP-STORE-RECHT]] 1.3).
- **Messen ohne Tracking:** Ob Leute die App installieren, lässt sich serverseitig an einem
  `start_url`-Merkmal zählen, ohne etwas im Browser zu speichern. Das folgt derselben Regel wie
  `lib/herkunft.ts`. Optional, kein Muss.

### 3.8 iPhone in der EU

Apple wollte Home-Bildschirm-Web-Apps in der EU mit iOS 17.4 abschalten (DMA) und hat das am
01.03.2024 zurückgenommen. Sie laufen weiter auf WebKit **[belegt]**
([TechCrunch](https://techcrunch.com/?p=2673309), [Quartz](https://qz.com/apple-iphone-web-home-screen-progressive-apps-eu-1851302006)).
Die Apple-Seite selbst war bei der Recherche nicht abrufbar. **Vor dem Bau nachsehen**, ob sich
daran seither etwas geändert hat.

---

## 4. Risiken, ehrlich

1. **Die Zielgruppe findet „Zum Home-Bildschirm“ auf dem iPhone nicht von selbst.**
   Der Altersschnitt liegt bei 58 Jahren ([[LAUNCH-FUNDAMENT]] F6). Ohne Bild-Anleitung in `/hilfe`
   bleibt die Funktion ungenutzt.
2. **Service Worker sind die häufigste Quelle für „hängt auf alter Version“.**
   Gegenmittel: nur gehashte Programmdateien cachen, kein HTML, Notschalter, Update-Hinweis.
3. **Gate und CSP:** Werden Manifest, Symbole oder `sw.js` von Proxy oder Login-Gate umgeleitet,
   scheitert die Installation still. → In `lib/oeffentlich.ts` und `mfaAusgenommen` aufnehmen, Test.
4. **Kein Gerätetest in der Cloud-Umgebung möglich** → der Betreiber prüft auf iPhone und Android.
5. **Push ist der eigentliche Mehrwert gegenüber dem Lesezeichen.** Ohne Stufe 2 ist die
   installierte App vor allem ein Symbol mit eigenem Fenster. Das ist nützlich, aber kein großer
   Sprung.

---

## 5. Reihenfolge und wer was tut

| Schritt | Wer | Abhängigkeit |
|---|---|---|
| Stufe 1 bauen (Abschnitt 2), Datenschutz Ziffer 6 + AVV-TOM im selben PR | Claude | — |
| Installieren, Abmelden, Update auf iPhone und Android testen | Betreiber | Stufe 1 live |
| Bild-Anleitung „Als App installieren“ in `/hilfe` | Claude, Bilder vom Betreiber | Gerätetest |
| Anwaltsfragen: Rechtsgrundlage Push, Einordnung der Push-Dienste | Betreiber | vor Stufe 2 |
| Stufe 2 (Push) | Claude | Anwalt; sinnvoll erst mit echten Nutzern |
| Stores (S3) | siehe [[APP-STORE-RECHT]] | Stufe 1 + Geschäftsentscheidung |

---

## Quellen (abgerufen 10.10.2026)

- § 25 TDDDG — <https://www.gesetze-im-internet.de/ttdsg/__25.html> **[gesichert]**
- WebKit: „Web Push for Web Apps on iOS and iPadOS“, 16.02.2023 —
  <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/> **[gesichert]**
- RFC 8291, Message Encryption for Web Push — <https://www.rfc-editor.org/rfc/rfc8291> **[gesichert]**
- Rücknahme der EU-Abschaltung 2024 — TechCrunch, Quartz (siehe 3.8) **[belegt]**
- Eigene Dokumente: [[APP-STORE-RECHT]], [[LAUNCH-FUNDAMENT]] (F4), `app/(pub)/datenschutz/page.tsx` Ziffer 6
