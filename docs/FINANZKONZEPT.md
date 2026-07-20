# Finanzkonzept

> Zwei Ebenen unter „Finanz": **A) Geschäftsmodell/Monetarisierung** (was MyImmo kostet und
> einbringt) und **B) der Finanzierungs-Assistent** (App-Feature). Beide hier zusammengefasst.
> Bei Änderungen an einer der beiden: **diese Datei im selben PR mitaktualisieren** (Regel in `CLAUDE.md`).
> Stand: 19.07.2026. Verwandt: [[MASTERPLAN]], [[BRIEFING]].

---

## A) Geschäftsmodell / Monetarisierung

### Laufende Kosten (Betrieb)
| Posten | Heute | Ab Skalierung |
|---|---|---|
| Supabase | Free | **Pro ~25 $/M** (Leaked-PW-Schutz, DPA-Komfort) |
| Vercel | Hobby | **Pro 20 $/M** (kommerziell erlaubt, AVV, Cron) |
| Anthropic API | pay-per-use (OCR/KI-Import) | skaliert mit Nutzung |
| AWS Bedrock (optional) | aus | EU-KI-Verarbeitung, pay-per-use |
| Enable Banking (geplant) | Sandbox (frei) | **Add-on/Business je Konto/Monat** |
| AVM (Marktwert) | — | **abgelehnt** (siehe unten) |

### Einnahmen (geplant)
- **Abo-Modell** für Vermieter (Preis noch offen). Fundament vorhanden:
  Tabelle `einladungscodes` (rollen-gebunden, Ablauf, Einmal-Einlösung) + Signup-Trigger
  `handle_new_user_rolle` → um **Abo-Zugangscodes** erweiterbar (Code nur bei Erst-Registrierung).
- Rollen: normale Vermieter + Hausverwaltung (eigene Codes).

### Wichtigste Finanz-Entscheidungen
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
