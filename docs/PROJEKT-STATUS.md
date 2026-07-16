# MyImmo — Projekt-Status (Übergabe für neue Sessions)

Stand: 16.07.2026 · Ergänzt `CLAUDE.md` (Arbeitsweise, Merkliste, Deployment) und
`docs/MASTERPLAN.md` (Markt/Compliance/Roadmap-Recherche 15.07.2026).

## Was ist MyImmo?
Deutschsprachige Immobilienverwaltungs-SaaS für **private Vermieter (1–24 Einheiten)**,
denen Profi-Hausverwaltungssoftware zu teuer/komplex und Excel zu fehleranfällig ist.
Positionierung: **Automatik + Beweissicherung + Steuer-Wächter** statt Enterprise-Featurebreite.

## Stack & Betrieb
- **Next.js 14 App Router** (TypeScript, Server Actions, Server Components), vitest (`tests/`, 123 grün).
- **Supabase** `kozhxrvyilkchjpcuwcm` (eu-central-1): Postgres + Auth (E-Mail, Google), RLS auf allen Tabellen.
  Dateien als **Base64 in Tabellenspalten** (kein Storage-Bucket).
- **Vercel** (Repo `jxnashap/myimmo-app`, Branch `main` → Auto-Deploy). Live: **https://my-immo-app.vercel.app**
- Env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `ANTHROPIC_API_KEY` (OCR/KI-Import),
  `DATA_ENCRYPTION_KEY` (AES-256-GCM App-Layer-Verschlüsselung, `lib/crypto/secure.ts` — Verlust = Bankdaten weg).
- Workflow: Feature-Branch `claude/…` → PR → **Squash-Merge** → Branch auf `origin/main` zurücksetzen.
  Nach jedem Merge Live-URL erwähnen. Design: Dark-UI mit Gold (`--gold`), Landing hell (`.lp3`, `--l-*`-Variablen).

## Rollen (lib/rolle.ts, Zugang per Einladungscode)
| Rolle | Zugang | Oberfläche |
|---|---|---|
| **Vermieter** | Standard (kein Eintrag in `nutzer_rollen`) | volle App |
| **Hausverwaltung** | Beta-Code | volle App (wie Vermieter, Mandate getrennt — Business-Tarif geplant) |
| **Mieter** | Code des Vermieters (`mieter_zugaenge`) | `/portal` (schlanke Shell) |
| **Service/Hausmeister** | `SV-`Code (`service_zugaenge`) | `/service` (schlanke Shell) |

## Enthaltene Funktionen (Vermieter-App)

### Verwaltung & Buchhaltung
- **Objekte** (Kartengrid, Detailseite mit Kennzahlen/Rendite, Marktwert-Karte mit Bewertung,
  Energieausweis-Frist, CO₂-Kostenaufteilung nach CO2KostAufG-Stufenmodell).
- **Mieter** (Detailseite: Vertrag/Staffel-/Indexmiete mit Staffelplan, Kaution + Status,
  IBAN verschlüsselt, Miet-Zeiträume je Periode, Verbilligt-Ampel §21 II, Portal-Einladung, Dokumente).
- **Einnahmen/Kosten/Kredite/Verbrauch** mit Anlegen/Bearbeiten/Löschen, Rechnungs-Upload bei Kosten,
  wiederkehrende Buchungen; **Mietkonto** (Soll/Ist-Abgleich je Monat, `soll_monat`-Zuordnung, Bestätigungs-UI).
- **Cashflow-Übersicht**, Dashboard mit Fristen/Refinanz-Kalender.
- **CSV-Import** (Einstellungen → Daten & Recht): Parser mit deutschem Zahlen-/Datumsformat,
  Auto-Mapping per Synonymen (Zwei-Pass exakt→Präfix), 3-Schritt-Assistent, Batch-Insert.
- **Datenexport**: Komplett-ZIP + Buchungen-CSV (nur unter Daten & Recht).

### Banking (Etappe 1–2 fertig, 3–4 teilweise)
- Tabellen `bankverbindungen` + `bank_umsaetze` (App-Layer-verschlüsselt, RLS).
- **Abgleich-Engine** `lib/banking/abgleich.ts`: Miet-/Kostenvorschläge aus Umsätzen,
  liest Soll-Monat aus dem Verwendungszweck („Miete Juli", „07/2026", Jahres-Rollover),
  Prinzip **vorschlagen + per Klick bestätigen**. 90-Tage-PSD2-Reauth-Erinnerung (Termine + Dashboard).
- **Offen:** echter Enable-Banking-Sandbox-Flow (Konto verbinden, Umsätze abrufen). Details in CLAUDE.md.

### Steuer (Phase B + D fertig)
- **Anlage V**-Berechnung + Export je Objekt (`lib/anlageV.ts`), **DATEV-EXTF-Export** (SKR03, `lib/datev.ts`).
- **Steuer-Wächter:** 15%-Grenze anschaffungsnaher Aufwand §6 Ia (Objektseite),
  Spekulationsfrist §23 (Fristen nach §187/188 BGB: Jahrestag noch steuerpflichtig),
  Verbilligt-Ampel §21 II (66/50 %, Stellplatz bewusst außen vor).
- **AfA-Assistent** (`/afa-assistent`): Satz nach Baujahr, degressiv vs. linear mit optimalem
  Wechseljahr, §7b-Prüfung, §82b-Verteilung, Kaufpreisaufteilung Gebäude/Grund.
- **§35a-Ausweis** in der NK-Abrechnung (Lohnanteile, haushaltsnah/Handwerker) — betrifft die
  MIETER-Seite (Vermieter selbst = Werbungskosten §9, nicht §35a!).

### Dokumente & Abrechnung
- **NK-Abrechnung** je Mieter/Jahr: Positionen (PositionsManager) mit Umlageschlüsseln inkl.
  **HKVO-Heizkostenaufteilung** (30–50 % Grundkosten nach Fläche + Verbrauch), Umlage-Assistent
  (cent-genau, OCR-Import der Hausverwaltungs-Abrechnung), §35a-Block, CO₂-Block, PDF + „zustellen" ins Mieterportal.
- **Dokument-Generator** (Mieter → „Dokument"): Briefe/Bescheinigungen mit Vorlagen-Editor + Platzhaltern —
  u. a. Mahnung, Zahlungserinnerung, **Wohnungsgeberbestätigung §19 BMG**, Mietbescheinigung,
  Mietquittung §368; optional E-Signatur eingebettet. **KEINEN separaten Generator dafür bauen — existiert hier!**
- **Übergabeprotokoll** (Einzug/Auszug, Zähler, Schlüssel, Räume) als PDF + Archiv.
- **Archiv** (Tabelle `notizen`): Kategorien, Datei-Route, Mieter-Freigabe-Toggle.
- **Jahresbericht**, Beleihungs-Unterlagen (öffentl. Token-Link für Bank), Bewerbungs-/Selbstauskunft-Links.

### Termine & Prüfpflichten
- **Termine-Seite**: eigene + abgeleitete Fristen (Mietende/Kündigung, NK-Frist §556 III,
  Mieterhöhung §558, Staffel/Index, Zinsbindung/Anschlussfinanzierung, §489-Sonderkündigung,
  Grundsteuer, ESt-Erklärung, Energieausweis, Bank-Reauth), Kategorien, iCal-Export,
  Erledigt-Haken → **wiederkehrende Termine legen automatisch die nächste Instanz an**.
- **Prüfpflichten-Katalog** (`PRUEF_KATALOG`, 15 Prüfarten mit Intervall + Rechtsgrundlage +
  „nur relevant wenn": Legionellen §14b TrinkwV, Rauchmelder DIN 14676, Schornsteinfeger,
  Aufzug BetrSichV, Winterdienst/Baumkontrolle, Feuerlöscher, DGUV V3, Rückstau, Spielplatz,
  Tore, Lüftung, WEG §24 …). **Prüfpflichten-Karte auf jeder Objektseite**: Abgleich Katalog ↔
  aktive Termine, Ein-Klick-Anlage, „Auftrag"-Brücke ins Service-Portal.

### Kalkulatoren
Roter Faden (Kauf-Kalkulation), Cockpit, Bankgespräch, KI-Objekt-Import (URL/Exposé → Anthropic).

### Mieterportal (`/portal`)
Wohnung/Vertragsdaten · **Anliegen** melden (Schaden/Frage/Dokument, max. 3 Anhänge à 4 MB) ·
Anfragen des Vermieters beantworten · **Zahlungen** (vom Vermieter bestätigte Buchungen, §368) ·
**Dokumente** (Freigaben + NK-Belegeinsicht §556 IV + anfordern) · **Zähler** melden (mit Foto).

### Service-Portal (`/service`) + Vermieter-Gegenseite (`/anliegen`, Tab „Service")
Verknüpfung per `SV-`Code · Vermieter vergibt **Aufträge** (Titel, Objekt, Termin, optional Mieter-Kontakt
als Opt-in-Link zur Terminabsprache) · Partner antwortet (angenommen/erledigt/abgelehnt) ·
Partner kann Aufträge **beantragen** (Vermieter gibt frei) · Firmenverzeichnis mit Gewerke-Katalog.

### Landing/SEO & Recht
- Landing (hell), `/funktionen`, `/preise`, `/vision`, **Ratgeber** (5 SEO-Artikel), **Vorlagen**,
  Sitemap + robots, Middleware-Public-Allowlist.
- **Impressum/Datenschutz/AVV/AGB mit echten Betreiberdaten gefüllt** (Jonas Scharp, MyImmo,
  Ludwig-Jahn-Straße 42, 23611 Bad Schwartau, info@myimmoapp.de — Gewerbe angemeldet 15.07.2026).
  ⚠️ anwaltliche Prüfung vor Bezahltarifen steht aus.
- Compliance-Doku: `docs/MASTERPLAN.md`, `docs/VERARBEITUNGSVERZEICHNIS.md`, `docs/TOM.md`,
  `docs/compliance/AVV-STATUS.md`, `anthropic-dpa-archiv.md` (DPA archiviert, Transfer via **SCCs, kein DPF**).

## Was noch kommt (Priorität aus Portal-Recherche 16.07.2026)

### Nächste Bauschritte (MUSS)
1. **Terminkoordination + Status-Tracking** (in Arbeit): Vermieter schlägt am Anliegen/Auftrag
   Termine vor, Mieter bestätigt per Klick; Bearbeitungsstand sichtbar → weniger Rückfragen,
   dokumentierter Zutritt (Rauchmelder/Reparatur).
2. **Auftrag „erledigt" → Kostenvorschlag**: Betrag, Lohnanteil, Gewerk→Kategorie, Objekt,
   Rechnungs-PDF als Anhang → per Klick in die Kostenerfassung. KEIN eigenes Rechnungsmodul (E-Rechnung §14 zu riskant).

### Danach (SOLLTE)
- Mieter-Stammdaten-Selbstpflege (Adresse/Bank/Personenzahl, Vermieter bestätigt).
- Mängelanzeige mit Fristüberwachung (§634a) + Objekt-/Anlagenakte; Abnahmeprotokoll §640 + Unterschrift.
- Anträge-Workflow (Untermiete §553, Haustier, Kündigung §573c mit Fristrechner).
- Kautions-Transparenz (§551) · Dokumenten-Hub/Hausordnung.
- **Chat-Threads** (ein `nachrichten`-Modell an Anliegen/Auftrag/Mietverhältnis): Mieter↔Management,
  Service↔Management, **Vermieter↔Hausverwaltung NUR über Chat** (kein Datenzugriff — Nutzer-Vorgabe).

### Größere Blöcke (Backlog)
- Open Banking Etappe 3–4: Enable-Banking-Sandbox-Flow (Env: `ENABLE_BANKING_APP_ID/PRIVATE_KEY`).
- Onboarding-Guide (durchklickbare Tour, überspringbar) · Phase E Monetarisierung (Abo-Zugangscodes
  auf `einladungscodes`-Fundament) · D4 E-Rechnungs-**Parser** (XRechnung/ZUGFeRD lesen) · D6 WEG-Modul ·
  Restverschlüsselung `kredite.darlnr`/`mieter.kaution_bank` · Mieterhöhungs-Assistent §558 (Rechtsrisiko!).

### Nur der Betreiber (kein Code)
- **Geschäftsadresse klären** → dann überall Adresse aktualisieren + **Supabase-DPA signieren** (geparkt, Anleitung in AVV-STATUS.md).
- Vercel Pro (aktiviert Vercel-DPA; Hobby verbietet kommerzielle Nutzung) · Supabase Pro (Leaked-Password-Schutz).
- AVV/AGB/Impressum/Datenschutz anwaltlich prüfen · OCR-Modell-ID vs. Anthropic-Retention dokumentieren.

## Bekannte Eigenheiten / Stolperfallen
- Stop-Hook meldet Squash-Merge-Commits (`noreply@github.com`) als „Unverified" — **Fehlalarm**, nicht amenden.
- `git checkout -B claude/… origin/main` nach jedem Merge; Push mit `--force-with-lease`.
- Landing-Seiten: niemals globale `--text/--bg3`-Variablen nutzen (brechen auf hellem `.lp3`) — nur `--l-*`.
- Service-Portal hat **keinen** RLS-Zugriff auf `properties`/`vermieter_profil` → Namen werden in `auftraege` denormalisiert.
- PDF-Texte durch `sanitize()` (Latin-1-Font); Dateien als Base64 in DB-Spalten.
- Vor jedem Neubau prüfen: Dokument-Generator (`lib/dokumentVorlagen.ts`), Fristen (`lib/fristen.ts`),
  Termin-System (`lib/termine.ts`) — vieles existiert schon, Doppelbau vermeiden.
