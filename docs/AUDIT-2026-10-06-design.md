# Design-/Layout-Scan 06.10.2026

**Auftrag (Betreiber):** „Komplett scannen mit 20 Agenten — Fokus Design und Layout, auf Mobile fällt
wirklich keine Zeile raus, keine Buchstaben falsch; Dokumente möglichst immer auf eine Seite mit
‚Mit freundlichen Grüßen‘.“

**Vorgehen:** 20 Bereiche (öffentliche Strecke 4, Vermieter-App 7, BuyImmo 2, Portal/Service 2, PDFs 3,
Texte im Code 2). Jeder Bereich renderte die LIVE-Seite mit den Demo-Konten bei 360 und 390 px (teils
768) und sah die Bildschirmaufnahmen an. Jeder Fund wurde von einem zweiten Agenten mit dem Auftrag
gegengeprüft, ihn zu widerlegen. **256 bestätigt (26 A · 103 B · 127 C), 10 verworfen.**
Danach behoben in 9 Dateigruppen mit je einem Gegenleser des Diffs, Rest von Hand.

## Werkzeug (wiederverwendbar)

`scripts/designscan/` — `login.mjs <rolle>` (eine Demo-Anmeldung je Rolle → `.scan/state-<rolle>.json`;
`/api/demo` bremst bei 6 Aufrufen je 300 s und setzt den Demo-Bestand zurück) und
`pruefe.mjs <rolle> <breite> <ordner> <pfad…>` (Aufnahmen je Bildschirmhöhe + JSON: Endpfad,
waagerechter Überlauf, Elemente rechts außerhalb, abgeschnittener Text, verdächtige Zeichen).
**Warum der Umweg über Node:** Chromium vertraut dem Proxy-Zertifikat der Remote-Umgebung nicht
(`ERR_CERT_AUTHORITY_INVALID`); Playwright holt deshalb jede Anfrage über `route.fetch()` (Node kennt
`NODE_EXTRA_CA_CERTS`). TLS-Prüfung bleibt an. **Weiterleitungen** löst `endAdresse()` in Node auf —
eine per `route.fulfill` durchgereichte 307 lädt der Browser am Routing vorbei und scheitert wieder am
Zertifikat. **Ganzseiten-Aufnahmen zeigen die Landing leer** (scroll-getriebene Einblendung) — deshalb
Aufnahmen je Bildschirmhöhe nach dem Scrollen.

## Regeln aus dem Scan (verbindlich)

- **Beträge brechen nie zwischen „€“ und Zahl:** `euro()` (lib/format.ts) und `fmtE()` (lib/kalk.ts)
  setzen ein geschütztes Leerzeichen; Betragszellen zusätzlich `whiteSpace: "nowrap"`.
  Im JSX-Text ist ` ` KEIN Escape — dort `&nbsp;` schreiben.
- **PDF-Text nur über `pdfText()` (lib/pdf/zeichen.ts).** WinAnsi kann „ “ – — … • €, aber nicht ı, ł, −,
  ≥. Vorher machte jede der acht sanitize()-Kopien daraus „?“ („Y?lmaz“, „Kreditrate ? Zins“).
- **Grußformel/Unterschrift nie allein auf einer Folgeseite:** Platzbedarf vor dem Schluss aus dem Inhalt
  rechnen, nicht pauschal reservieren (NK: 160 pt → 6 von 7 Demo-Abrechnungen zweiseitig mit nur dem Gruß
  auf Seite 2; Protokoll: 110 pt → Unterschriften allein). Muss umbrochen werden, geht der letzte
  Inhaltsblock mit.
- **Mietart nur über `normMietart()` (lib/mietart.ts)** — die Daten enthalten „Index“/„Standard“ groß;
  ein exakter Vergleich zeigte „Standard“, und Speichern setzte die Mietart still zurück.
- **Raster am Handy:** `minmax(0, 1fr)` bzw. `repeat(auto-fit, minmax(min(Xpx, 100%), 1fr))` — eine
  Mindestspalte breiter als die Karte schneidet rechts ab (Finanzierungsvorschläge, Service-Formular).
- **Keine Schrift unter 11 px** (inline 44 Stellen von 10/10,5 auf 11 angehoben; th 11 px).
- **Leerzustand nie in einer `td colSpan` einer breiten, scrollbaren Tabelle** — er wird über die volle
  Tabellenbreite zentriert und am Handy abgeschnitten (`/verbrauch`). Neue Listen rendern `<Leer>`
  außerhalb der Tabelle; für die Altlisten greift eine CSS-Regel (nicht im Browser bestätigt).

## Offen — braucht den Betreiber

- **Anrede „Sehr geehrte/r Vorname Nachname“** in Briefen/NK: „Guten Tag …“ oder ein Anrede-Feld am Mieter?
- **Einheitliches Betragsformat** (`€ 1.070` vs. `1.070,00 €`) und **Datumsformat** (`1.1.2022` vs. `23.05.2026`) app-weit.
- **Hinweiskasten „Entwurf …“ öffentlich auf /avv und /agb** — stehen lassen bis zur Anwaltsprüfung?
- **Begriffe in Rechtstexten** (Freigabe-Link/Freigabelink, Unterauftragsverarbeiter/Subprozessoren) — nicht ungefragt angeglichen.
- **Ratgeber siezen, die übrige Strecke duzt** — so lassen?
- **Kreditantrag mit Vertreter = 3 Seiten, die dritte fast leer** (Seitenaufteilung ist per Test festgehalten).
- **Leerer Platzhalter sperrt PDF/Archiv/Versand** (z. B. ohne Vermieterprofil) — gewollt? Server-Route sperrt nicht.
- **Demo-Anlage V 2024 mit Einnahmen 0 €** bei vollen Werbungskosten — Datenfehler im Demo-Reset (Migration nötig).

## Offen — klein, nicht im Browser bestätigt

Kartenköpfe („Alle →“ mal rechts, mal darunter), Theme-Schalter 36×24 px, Mietkonto-Reiter am Handy
(„Kontoauszug abgleichen“ wischbar), einheitliche Fehlerseiten der Token-Links, Großbuchstaben-Labels mit
Einheiten („(M²)“). **Alle Layout-Korrekturen sind nur am Code und an erzeugten PDFs geprüft** — nach dem
Deploy mit `scripts/designscan/` bei 360/390 px nachsehen.
