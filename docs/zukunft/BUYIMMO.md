# BuyImmo — zweiter Bereich neben MyImmo

**Stand:** 05.10.2026 · **Status:** gebaut: Umschalter, Navigation, Kommandozentrale (`/aufbau`),
Fahrplan (`/fahrplan`), Sanierungsrechner Stufe 1 (`/sanierung`, Material + Arbeitszeit).

## Die Entscheidung (Betreiber, 05.10.2026)

> „MyImmo als automatisierte Verwaltung und BuyImmo als aktive Kommandozentrale für den
> Immobilienaufbau." — gewechselt wird **oben links am Logo**.

- **MyImmo** = Verwaltung: Dashboard, Objekte, Mieter, Ein-/Ausgaben, Mieterportal,
  Mietkonto, Verbrauch, Kredite, Steuer, Jahresbericht, Archiv.
- **BuyImmo** = Bestandsaufbau: Kommandozentrale (`/aufbau`), Kauf-Assistent, Makler-Ordner,
  Verkauf-Assistent, Marktwert-Schätzer, AfA-Assistent. Geplant: Sanierungsrechner, Strategie.

### Zielgruppe, Tarif, Vision (Betreiber, 05.10.2026)

- **Tarif:** eigener Tarif **19,99 €/Monat** — offene Punkte (Überschneidung mit Plus!) in
  `docs/FINANZKONZEPT.md`. Noch nicht in `lib/plan.ts`.
- **Zielgruppe:** junge Leute, die „Bock auf Immobilien“ haben und einen Bestand aufbauen wollen.
  BuyImmo soll **leiten**: was brauche ich, welche Voraussetzungen, was muss ich beachten —
  „spielerisch einen Einblick geben, wie man Immobilien kauft“.
- **Vision:** Beleihungsordner an die Bank, die Bank weiß Bescheid — „im Urlaub einen Cocktail
  schlürfen und gleichzeitig eine Immobilie in Deutschland kaufen“. MyImmo verwaltet danach
  den Bestand automatisiert.

**Risiken dazu — vor jeder Werbung damit:**
1. **Nur ab 18.** Die AGB verlangen Volljährigkeit (`/agb`), Minderjährige können weder kaufen
   noch finanzieren. In Texten „junge Erwachsene“, nie „Jugendliche“; Werbung, die sich an
   Minderjährige richtet, ist ohnehin heikel (UWG). **Anwalt.**
2. **„Spielerisch“ + Kredit:** Junge, unerfahrene Käufer zu einem kreditfinanzierten Kauf zu
   führen, ist der Teil mit dem höchsten Haftungs- und Rufrisiko. Leiten heißt erklären und
   rechnen — nie „du kannst dir das leisten“ oder „kauf jetzt“ (§ 34i GewO, Anwaltsliste).
3. **„Vom Urlaub aus kaufen“ ist als Versprechen so nicht haltbar.** Der Kaufvertrag braucht den
   Notar — persönlich oder über einen Vertreter mit beglaubigter Vollmacht (§ 29 GBO). Ob eine
   Online-Beurkundung für Grundstückskäufe inzwischen möglich ist: **nicht geprüft**. Ehrlich und
   trotzdem stark: „fast alles von unterwegs — den Notartermin übernimmt dein Vertreter“; der
   Vertreter-Reiter mit Vollmacht existiert (Einstellungen → Vertreter). Werbung ohne diesen
   Zusatz wäre irreführend (§ 5 UWG).

### „Strategie“ heißt: Fahrplan, keine Empfehlung (gebaut 05.10.2026, Betreiber: „dann Fahrplan“)

Ein geführter Weg zum ersten bzw. nächsten Objekt — **allgemeines Wissen + eigene Zahlen +
Fortschritt**, ohne Urteil über die Person:
Eigenkapital & Schufa → Selbstauskunft → Finanzierungsbestätigung → Suche & Besichtigung
(Sanierungsrechner) → Kaufprüfung → Beleihungsordner an die Bank → Notar (selbst oder Vertreter)
→ Übergabe → Objekt in MyImmo. Jeder Schritt erklärt, was nötig ist, und zeigt, was schon
erledigt ist (aus den vorhandenen Daten). **Nicht:** „Mit deinem Einkommen kannst du X € kaufen“
— das ist Darlehensberatung und bleibt draußen, bis der Anwalt § 34i geklärt hat.

**Umsetzung:** `lib/fahrplan.ts` (neun Schritte, Status NUR wo die App es aus den Daten weiß:
Selbstauskunft, Finanzierungsbestätigung, Makler-Ordner, Kaufprüfungen; Vertreter und Bestand als
Hinweis; Besichtigung und Notar ohne Haken), darüber der Kaufnebenkosten-Rechner
(`components/NebenkostenRechner.tsx`) mit **derselben Regel wie der Kauf-Rechner**
(`kaufnebenkosten()`/`kaufnebenkostenSatz()` in `lib/kalk.ts` — vorher stand die 2-%-Pauschale
direkt in `ObjektRechner.tsx`). Daten über `lib/aufbauDaten.ts` (ein Lader für Kommandozentrale
und Fahrplan). `tests/fahrplan.test.ts` sucht nach Empfehlungs-Formulierungen („empfehl“,
„solltest“, „kannst dir … leisten“) und prüft, dass jedes Ziel eine echte Seite ist.

### Sanierungsrechner Stufe 1 (gebaut 05.10.2026)

Räume (Länge, Breite, Höhe, Fenster/Türen) → Flächen → Maßnahmen (spachteln, grundieren,
tapezieren, Wände/Decke streichen, Laminat, Vinyl) → Material **von–bis** → ganze Gebinde über
**alle** Räume gerundet → Kosten. Arbeitszeit = Stunden × Satz, den der Nutzer einträgt; eigene
Posten (z. B. Bad laut Angebot). Preise je Gebinde überschreibbar. `lib/sanierung/` (Katalog als
Parameter), `tests/sanierung.test.ts`. **Preise:** `lib/sanierung/katalog.ts`, je Material Quelle
und zweite Quelle (OBI/toom/Globus), Verbrauch aus Herstellerblättern; Prüfzyklus in
`07 Volatile Kennzahlen`. **Grenzen:** Wandfarbe nur für glatten Untergrund (Alpina beziffert
Raufaser nicht); Spachtel-Schichtdicke 0,5–1 mm ist eine Annahme; Verschnitt ist eine Annahme.
**Entwurf nur im Browser** — kein Speichern ins Konto (eine neue Tabelle bräuchte
`delete_own_account()`/Kaskade, und Migrationen mit `delete`/`on delete` laufen über
`apply_migration` in den Bestätigungsdialog → Betreiber im SQL-Editor).
**Demo:** Sanierungs- und Nebenkostenrechner sind bedienbar (`data-demo-erlaubt`) — sie schreiben
nichts in die Datenbank; ein Test hält fest, dass sie keine Server-Action aufrufen.
**Fliesen (gebaut 05.10.2026, „erstmal ausbauen“):** „Boden fliesen“ (Fliese, Flexkleber, Fugenmörtel,
Silikon über den Umfang) und „Wände fliesen“ bis zu einer **Fliesenhöhe je Raum** (leer = bis zur
Decke). **Die geflieste Wand wird von Spachteln, Tapezieren und Streichen abgezogen** — sonst wäre
dieselbe Fläche gefliest UND gestrichen. Öffnungen zählen anteilig zur Fliesenhöhe (Näherung:
gleichmäßig über die Höhe verteilt). Verschnitt Fliese 10–15 % ist eine Annahme. Der Fliesenpreis
schwankt je Fliese stark — der Katalogwert ist eine einfache Standardfliese, die Oberfläche bittet
um den eigenen Preis.

**Übergabe an den Kauf-Assistenten (gebaut 05.10.2026):** Knopf „… in den Kauf-Assistenten“
→ `/kauf?sanierung=<obere Spanne>` (`lib/sanierung/uebergabe.ts`: nur ganze Euro, 1 bis 10 Mio.,
sonst ignoriert) → der Objekt-Rechner öffnet in Schritt 1 mit dem Feld **„Sanierung / Renovierung“**.
Die Sanierung steckt jetzt in der **Gesamtinvestition** (damit in Nettorendite und Darlehensbedarf),
wird mit der Kaufprüfung gespeichert und bei der Wiedervorlage geladen. Darunter der **15-%-Hinweis**
vor dem Kauf: `anschaffungsnahVorKauf()` mit derselben Grenze wie der Steuer-Wächter
(`ANSCHAFFUNGSNAH_GRENZE`, Gebäudeanteil 80 %, brutto). `tests/sanierungUebergabe.test.ts`
rendert den Kauf-Rechner. **Vorher fehlte die Sanierung im Kauf-Rechner ganz** — wer renovieren
musste, sah eine zu hohe Nettorendite und einen zu kleinen Kreditbedarf.

### Verworfene Alternativen — mit Grund

| Weg | Warum nicht (jetzt) |
|---|---|
| **Eigenes Projekt** (neues Repo, eigene Datenbank) | Kauf, Verkauf, Beleihung, Makler-Ordner, Bewertung und Selbstauskunft gab es schon in MyImmo — sie wären doppelt entstanden. Dazu doppelte Pflege (Next-Upgrades, Audits, Rechtstexte, Demo) vor dem ersten echten Nutzer. Und der stärkste Nutzen ginge verloren: Kaufdaten und Sanierungskosten fließen ohne Export in Verwaltung und Steuer (15-%-Grenze, `lib/steuer/anschaffungsnah.ts`). |
| **Monorepo** (zwei Apps, gemeinsames Design-Paket) | Umbau der laufenden App (Pfade, Vercel, CI, ~1.900 Tests), bevor ein Nutzer da ist. Wird richtig, wenn BuyImmo eine eigene Zielgruppe bekommt, die MyImmo nie braucht, oder getrennt verkauft werden soll. |

**Kommt die Trennung später doch**, bleibt sie mechanisch, solange die Regeln unten gelten.

## Wie es gebaut ist

- **`lib/bereich.ts`** — der offene Bereich folgt **allein aus der Adresse** (kein Cookie, kein
  localStorage): Lesezeichen und „Zurück" funktionieren, Server und Browser rendern dieselbe
  Navigation. **Gemeinsame Seiten** (`GEMEINSAME_PFADE`: Einstellungen, Hilfe, Objekte)
  behalten den Bereich, aus dem man kam; beim ersten Aufruf ist es MyImmo.
- **`lib/nav.ts`** — vier Gruppen: `VERWALTEN` + `ABRECHNEN` (MyImmo), `AUFBAUEN` + `RECHNEN`
  (BuyImmo). Das frühere eingeklappte „Planen" ist aufgelöst.
- **`components/BereichWechsel.tsx`** — Wortmarke **Buy*Immo*** / **My*Immo*** mit Doppelpfeil und
  Bereichsname darunter. **Risiko, deshalb so gebaut:** Ein Logo allein erkennt kaum jemand als
  Schalter. Im eingeklappten Rail öffnet das Menü fest neben der Leiste (die Leiste schneidet
  seitlich ab).
- **`/aufbau` Kommandozentrale** — rechnet über `lib/aufbau.ts` **nur mit bestehenden Regeln**:
  Portfolio-Wert wie das Dashboard (Σ gepflegter Wert, kein Kaufpreis-Ersatz), Restschuld wie die
  Schulden-Uhr, freie Grundschuld wie `/kredite`; Eigenkapital = Wert − Restschuld. Fehlt ein
  Wert, zählen die Schulden trotzdem — das Eigenkapital ist dann zu niedrig und die Seite sagt es.
  Im Browser gegen die Demo geprüft: 1.838.000 € (= Dashboard) − 937.000 € (= `/kredite`).

## Regeln

1. **Eine neue BuyImmo-Seite kommt in `AUFBAUEN` oder `RECHNEN`** (`lib/nav.ts`) — der Bereich
   folgt dann von selbst. Eine Seite, die zu beiden gehört, kommt in `GEMEINSAME_PFADE`.
2. **Bestehende Adressen nie umbenennen** (`/kauf`, `/verkauf`, `/bewertung`, `/afa-assistent`,
   `/makler`) — Demo-Wege, Rauchtest, Lesezeichen und Verweise hängen daran.
3. **Keine Zahl in der Kommandozentrale mit eigener Regel.** Jede Größe, die es in MyImmo schon
   gibt, kommt aus derselben Funktion (`tests/aufbau.test.ts` hält Dashboard- und
   `/kredite`-Gleichheit fest).
4. **Keine Empfehlung.** „Du kannst kaufen", „empfohlen", Ampel über eine Kaufentscheidung — nein,
   solange § 34i GewO nicht anwaltlich geklärt ist (siehe `STRATEGIE-REITER.md`).
5. **Eigene Domain später** (z. B. `buyimmo.de`): per Host-Weiche im Proxy auf `/aufbau`;
   **nicht** in `NEBENDOMAINS` (`next.config.mjs`), sonst leitet sie auf `.de` um; in die
   Supabase-Weißliste für Weiterleitungen eintragen. Anmeldung gilt je Domain getrennt (Cookies).

## Offen — vor dem Bau zu klären

| Punkt | Warum er die Arbeit ändert |
|---|---|
| ~~Sanierungsrechner: Material oder Lohn?~~ | ✅ **Entschieden 05.10.2026:** Material, dazu ein Lohnrechner, in den der Nutzer Stunden und seinen Stundensatz selbst einträgt — BuyImmo schätzt keinen Lohn. Große Posten (Bad, Elektrik) trägt der Nutzer als eigene Posten ein. |
| **Preise** | Baumarktseiten auslesen ist verworfen (Nutzungsbedingungen, wie bei den Portalen). Start: eigene Preis- und Verbrauchstabelle mit Quelle und Stand-Datum, vom Nutzer überschreibbar, Eintrag in `07 Volatile Kennzahlen`. Partner-Produktdaten (Affiliate) **nicht geprüft** — erst klären, dann ggf. Werbekennzeichnung + Datenschutzerklärung. |
| **Ausmessen bei der Besichtigung** | Kenntnisstand, nicht am Gerät geprüft: Eine Web-App erreicht weder LiDAR (nur native iOS-App) noch Bluetooth-Laser in Safari. Start: Grundriss aus dem Exposé per KI, vor Ort von Hand korrigieren. Ohne Netz (Keller) speichert die App heute nicht. |
| **Strategie** | `STRATEGIE-REITER.md` — Anwalt zu § 34i GewO **vor** dem Bau; Szenarien statt einer Zahl. |
| **Ergebnis ist eine Schätzung** | Kein Kostenvoranschlag — dieselbe Grenze wie bei den Handwerker-Anfragen. |
| **Tarif** | 19,99 € entschieden; Abgrenzung zu Plus und Bündel offen — `docs/FINANZKONZEPT.md`. |
| **Marke** | „BuyImmo" vor öffentlicher Nutzung auf Markenrecht und Domain prüfen (nicht geschehen). |
| **Demo** | Die Demo hat keine gespeicherten Kaufprüfungen → die Kommandozentrale zeigt dort einen Leerzustand. Beispiel-Kalkulationen bräuchten eine `demo_seed`-Kopie + Eintrag in der Reset-Funktion. |
