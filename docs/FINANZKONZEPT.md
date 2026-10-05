# Finanzkonzept

> Zwei Ebenen unter „Finanz": **A) Geschäftsmodell/Monetarisierung** (was MyImmo kostet und
> einbringt) und **B) der Finanzierungs-Assistent** (App-Feature). Beide hier zusammengefasst.
> Bei Änderungen an einer der beiden: **diese Datei im selben PR mitaktualisieren** (Regel in `CLAUDE.md`).
> Stand: 30.09.2026 (Kostentabelle gegen die Anbieter-Preisseiten nachgezogen).
> Verwandt: [[MASTERPLAN]], [[BRIEFING]], **[[KOSTENMODELL]]** (Betriebskosten nach
> Nutzerzahl, durchgerechnet), [[BETEILIGUNG]], [[INVESTOR-GESPRAECH]].

---

## A) Geschäftsmodell / Monetarisierung

### Laufende Kosten (Betrieb)
⚠️ **Korrektur 30.09.2026:** Diese Tabelle führte Supabase als „Free" und Vercel als
„Hobby". Beide sind längst auf Pro (Supabase seit spätestens 08.09.2026 nachgewiesen,
Vercel seit 29.07.2026). Wer hier abliest, unterschätzt die laufenden Kosten — und
überschätzt zugleich, was noch zu tun ist.

| Posten | Heute (30.09.2026) | Ab Skalierung |
|---|---|---|
| Supabase | **Pro, 25 $/M** — inkl. 8 GB Disk, 250 GB Egress, 100.000 MAU | +0,125 $/GB Disk, +0,09 $/GB Egress |
| Vercel | **Pro, 20 $/M** — inkl. 1 TB Transfer, 10 Mio. CDN-Anfragen | +0,15 $/GB Transfer, +2 $/Mio. Anfragen |
| Domains (.de/.com/.store) | ~45 €/Jahr | unverändert |
| Anthropic API | pay-per-use (OCR/KI-Import) | ~4 ct je OCR-Aufruf, skaliert mit Nutzung |
| Brevo | Free (300 Mails/Tag) | ab ~9 $/M bei mehr Volumen |
| AWS Bedrock (optional) | aus | EU-KI-Verarbeitung, pay-per-use |
| Apple Developer | nicht gebucht | 99 $/Jahr ab iOS-Start |
| ~~Enable Banking~~ | **entfällt** — Open Banking am 29.08.2026 aus der App entfernt | erst bei Wiederaufbau |
| AVM (Marktwert) | — | **abgelehnt** (siehe unten) |

**Summe heute: rund 51 € im Monat.** Der Deckungspunkt liegt damit bei **sieben
zahlenden Kunden**. Vollständige Rechnung mit allen Annahmen und den Kosten bei
100 / 1.000 / 10.000 Nutzern: **[[KOSTENMODELL]]** (erzeugt aus
`scripts/gen-kostenmodell.mjs`).

### Einnahmen (geplant)
- **Abo-Modell** für Vermieter — Tarife wie auf `/preise` (Kostenlos · Privat 7,99 €/M bzw.
  79 €/J · Plus 12,99 €/M bzw. 129 €/J · Business auf Anfrage).
  Das früher hier genannte Banking-Add-on entfällt — das Feature ist am 29.08.2026
  aus der App entfernt worden.
- **Bezahlsystem GEBAUT, aber INAKTIV (24.07.2026):** Anbieter-Entscheidung = **Paddle als
  Merchant of Record** (Paddle verkauft im eigenen Namen, übernimmt EU-USt/Rechnungen/
  Steuer-Compliance; Gebühr ~5 % + 0,50 $ — bewusst teurer als Stripe ~2 %, dafür kein
  OSS-/USt-Aufwand beim Solo-Nebenerwerb). ⚠️ **Offen, am 30.09.2026 auf Paddles
  Preisseite gefunden:** Für Produkte **unter 10 $** verlangt Paddle eine
  Sonderkondition — der Einstiegstarif liegt bei 7,99 €. Vor dem Scharfschalten
  klären. Rechnerisch verliert ein Monatsabo zu 7,99 € rund **11 % an Paddle**
  (5 % + 0,50 $ Fixgebühr, zwölfmal im Jahr), ein Jahresabo zu 79 € nur **5,6 %**
  → Jahresabos aktiv bewerben. Umsetzung: Tabelle `abos` (RLS, nur Service-Role
  schreibt), Tarif-/Feature-Matrix `lib/plan.ts`, Paddle-Adapter `lib/billing/paddle.ts`,
  Webhook `/api/billing/webhook`, Abo-Tab in den Einstellungen. **Durchgesetzt wird erst mit
  Env `BILLING_ENFORCED=true`** — bis dahin Early Access (alles frei, wie auf /preise
  angekündigt). Aktivierungs-Checkliste: `docs/BEZAHLSYSTEM.md`.
  ⚠️ Steuerhinweis für den Steuerberater: Beim MoR-Modell ist **Paddle der Kunde**
  (B2B-Leistung an Paddle, Reverse-Charge) — relevant für die Kleinunternehmer-Frage.
- Fundament zusätzlich vorhanden: Tabelle `einladungscodes` (rollen-gebunden, Ablauf,
  Einmal-Einlösung) + Signup-Trigger `handle_new_user_rolle` → um **Abo-Zugangscodes**
  erweiterbar (Code nur bei Erst-Registrierung).
- Rollen: normale Vermieter + Hausverwaltung (eigene Codes).

### Wichtigste Finanz-Entscheidungen
- **„Quasi kostenlos, weil absetzbar“ → ABGELEHNT (05.10.2026).** Absetzbar spart den
  Grenzsteuersatz, nicht den Betrag (7,99 € kosten bei 30 % netto ≈ 5,59 €, unter dem
  Grundfreibetrag 7,99 €); „kostenlos“ für ein Produkt mit Preis ist irreführend (§ 5 UWG).
  **Stattdessen:** bei den Preisen „Als Werbungskosten absetzbar — und automatisch gebucht“
  mit Rechenbeispiel (`lib/absetzbar.ts`, nur mit `PREISE_SICHTBAR`), und jede bezahlte
  Rechnung wird wirklich als Kosten „Verwaltung“ gebucht (`lib/billing/aboBuchung.ts`).
  Steueraussage in der Werbung → gehört zur StBerG-Anfrage an den Anwalt.
- **Bezahltes AVM (Sprengnetter/PriceHubble) → ABGELEHNT.** Vertriebsgebunden, laufende
  Kosten je Bewertung, AVV nötig. Code-seitig vorbereitet (Quellen-Stub), aber nicht angebunden.
- **Stattdessen: automatischer Wert-Refresh aus frei-legalen Quellen** — **MVP gebaut** (19.07.2026):
  geschützte Route `/api/cron/wert-refresh` + GitHub-Action-Cron (1. & 15., `.github/workflows/
  wert-refresh.yml`). Aktualisiert je Objekt den **geschätzten** Marktwert (`marktwert_aktuell` +
  Verlaufspunkt) per Häuserpreisindex-Fortschreibung (Eurostat), **ohne** den manuell gepflegten
  `wert` zu überschreiben (übernehmen per Klick). Scope über `OWNER_USER_ID`: gesetzt = nur dein
  Portfolio (MVP), weg = mandantenweit. Env: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
  Der Cron hält zusätzlich **regionale Eingaben best-effort frisch**: fehlende Koordinaten via
  Geocoding (Nominatim, out-of-the-box) und **Bodenrichtwert (BORIS)** — Letzterer nur, wenn per
  ENV konfiguriert (`VALUATION_BORIS_ENABLED=true` + `BORIS_ENDPOINT_URL`; deutscher BORIS hat
  keine einheitliche freie API, je Bundesland unterschiedlich). BRW fließt in die ImmoWertV-
  Bewertung der Objektseite ein, nicht in den Index-Headline-Wert. **Kein Portal-Scraping**
  (ImmoScout etc.) — ToS/Recht.
- **Kosten-Einpreisung:** Sobald AVM/Enable-Banking/AWS aktiv werden, sind das **wiederkehrende,
  mit der Nutzerzahl skalierende** Kosten → müssen ins Abo (z. B. „X Bewertungen/Monat inklusive",
  Rest kostenpflichtig; Ergebnisse cachen statt bei jedem Aufruf neu abrufen).

### Portfolio-Wert — Ausbaustufen
- **Stufe 1 (aktiv):** bundesweiter Häuserpreisindex (Eurostat/Destatis), Fortschreibung ab Kaufpreis.
- **Stufe 1b (geplant):** regional nach BBSR-Kreistypen. ⚠️ Kreistyp-Reihe seit 24.09.2025 nur noch
  als „Statistischer Bericht" (XLSX), **nicht mehr live per GENESIS-API**. Nutzer hat GENESIS-Token.
  Blocker: exakte Kreistyp-Indexwerte + amtliche PLZ→Kreistyp-Zuordnung sauber beschaffen (nicht raten).
- **Stufe 2:** kommerzielles AVM — **verworfen** (siehe oben).

---

## B) Finanzierungs-Assistent (App-Feature)

### Zweck & rechtlicher Rahmen
Guided Kauf-/Finanzierungs-Rechner: Objekt durchrechnen → Vermietung/Eigennutzung →
Machbarkeit → Darlehens-Wunsch → Kreditantrag/Selbstauskunft-PDF für die Bank.
- **Erlaubnisfrei nach § 34i GewO** halten: **„rechnen & sortieren, du entscheidest selbst"** —
  **keine Produktempfehlung, keine Vermittlung.** Wording bereits neutralisiert („Empfehlung" entfernt).
- **Anwaltlich freizugeben** (offen, Betreiber): § 34i-Grenze final absichern.

### Bausteine (Etappen A–F, vorhanden)
- Objekt-Auswahl (bestes von mehreren) → Selbstauskunft/Haushaltsrechnung (verschlüsselt in DB)
  → Machbarkeits-Check (Ampel) → Darlehens-Wunsch-Wizard → Kreditantrag-PDF → Bankgespräch.
- Fahrplan-Details: [[MASTERPLAN]] §11. Rechenmodule: `lib/kauf/*`, `components/kauf/*`.

### Kauf-Tool-Ausbau (20.07.2026, 8-Agenten-Recherche → [[00 Kauf-Tool Übersicht]])
- **Scheibe 1 (gebaut):** ObjektRechner entzerrt (5 Pflichtfelder sichtbar, Makler/
  Bewirtschaftung im Ausklapp-Menü, Provisionsfrei-Schnellschalter), Fördercheck mit
  neutraler § 34i-Einordnung, KfW-308-Korrektur (EH 85 EE), aufklappbarer Kurz-Guide.
- **Scheibe 2+3 (gebaut):** KfW-Matching-Anzeige „kommt in Frage, wenn …" +
  „Antrag vor Vorhabensbeginn"-Hinweis (`foerderung.ts` `bedingung`-Feld,
  `FoerderCheck.tsx`); **zwei grafische Finanzierungsvorschläge**
  (`FinanzierungsVorschlaege.tsx`, gestapelter Balken EK + optional Förderkredit +
  Bankdarlehen, gleichwertig, § 34i-Disclaimer am Balken).
- **Scheibe 4 (gebaut):** **Makler-Ordner** — neue Tabelle `makler_dokumente`
  (user-scoped, RLS), `lib/makler.ts` (6 Kern-Dokumente) + `components/MaklerOrdner.tsx`
  (Checkliste, Upload, Abhaken, Fortschritts-Ring, Datensparsamkeits-Warnungen),
  `/makler` + geschützte Datei-Route, aus dem Kauf-Assistenten verlinkt. Bank-Ordner =
  vorhandener `BeleihungsOrdner` (objektbezogen).
- **Scheibe 5 (gebaut):** Härtung — `datei_data` in Makler- UND Bank-Ordner wird
  beim Upload/Erzeugen AES-256-GCM-verschlüsselt (wenn `DATA_ENCRYPTION_KEY` gesetzt),
  Datei-Routen entschlüsseln tolerant (Altbestand bleibt lesbar). Plus Auto-Käufer-
  Selbstauskunft-PDF (`lib/pdf/kaeuferPdf.ts`, nur Aggregate) mit „Aus MyImmo erzeugen".
- **Scheibe 6 (gebaut):** Hausbewertung (Objekttyp Wohnung/Haus + Substanzwert-Block
  Bodenwert/Gebäudesachwert via ImmoWertV-Engine `lib/kauf/hausbewertung.ts`),
  **KfW-Förderkredit automatisch in der Finanzierungsgrafik** (`foerderKredit`/
  `foerderKredite`, Höchstgrenzen, zvE-Guard, 1-WE, entfernbar, § 34i-neutral —
  Wording anwaltlich freizugeben), Selbstauskunft-Feld `zveHaushaltJahr`, plus
  spielerische Micro-UX (Belastbarkeits-Ring, progressive Kacheln, Meilenstein-Badges,
  Animationen mit reduced-motion-Guard).
- Recherchierte Deliverables als Vault-Notizen: [[Kunden-Guide]], [[Makler-Ordner]],
  [[Bank-Ordner]], [[KfW-Foerderung-2026]].

### Verwandte Steuer-/Rechenlogik (StBerG-sensibel)
Anlage-V-Berechnung, § 82b-Optimierer, AfA-Assistent, DATEV-Export — **Grenze zur unerlaubten
Steuerberatung** anwaltlich freigeben (offen, Betreiber). Alles als „Näherung, keine Steuerberatung"
ausgewiesen.

### Offene UX-Punkte (aus dem Scan)
- „Einzelobjekt in die Finanzierung übernehmen" (Rückkanal), Verkauf-Bewertung einbetten,
  AfA-Ergebnis ans Objekt zurückschreiben. → eigene PRs mit Preview.
