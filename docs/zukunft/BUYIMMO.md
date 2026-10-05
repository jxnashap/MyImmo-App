# BuyImmo — zweiter Bereich neben MyImmo

**Stand:** 05.10.2026 · **Status:** Grundgerüst gebaut (Umschalter, Navigation, Kommandozentrale),
Sanierungsrechner und Strategie offen.

## Die Entscheidung (Betreiber, 05.10.2026)

> „MyImmo als automatisierte Verwaltung und BuyImmo als aktive Kommandozentrale für den
> Immobilienaufbau." — gewechselt wird **oben links am Logo**.

- **MyImmo** = Verwaltung: Dashboard, Objekte, Mieter, Ein-/Ausgaben, Mieterportal,
  Mietkonto, Verbrauch, Kredite, Steuer, Jahresbericht, Archiv.
- **BuyImmo** = Bestandsaufbau: Kommandozentrale (`/aufbau`), Kauf-Assistent, Makler-Ordner,
  Verkauf-Assistent, Marktwert-Schätzer, AfA-Assistent. Geplant: Sanierungsrechner, Strategie.

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
| **Sanierungsrechner: nur Material (Eigenleistung) oder mit Handwerkerlohn?** | Lohn dominiert die Kosten; ein reiner Materialrechner („kg Spachtelmasse") ist genau, aber der kleinste Posten. Große Posten (Bad, Elektrik, Heizung, Fenster) nur als Spanne, nie als Einzelzahl. |
| **Preise** | Baumarktseiten auslesen ist verworfen (Nutzungsbedingungen, wie bei den Portalen). Start: eigene Preis- und Verbrauchstabelle mit Quelle und Stand-Datum, vom Nutzer überschreibbar, Eintrag in `07 Volatile Kennzahlen`. Partner-Produktdaten (Affiliate) **nicht geprüft** — erst klären, dann ggf. Werbekennzeichnung + Datenschutzerklärung. |
| **Ausmessen bei der Besichtigung** | Kenntnisstand, nicht am Gerät geprüft: Eine Web-App erreicht weder LiDAR (nur native iOS-App) noch Bluetooth-Laser in Safari. Start: Grundriss aus dem Exposé per KI, vor Ort von Hand korrigieren. Ohne Netz (Keller) speichert die App heute nicht. |
| **Strategie** | `STRATEGIE-REITER.md` — Anwalt zu § 34i GewO **vor** dem Bau; Szenarien statt einer Zahl. |
| **Ergebnis ist eine Schätzung** | Kein Kostenvoranschlag — dieselbe Grenze wie bei den Handwerker-Anfragen. |
| **Tarif** | Ist BuyImmo ein Plus-Merkmal? Dann `docs/FINANZKONZEPT.md` und `lib/plan.ts` im selben PR. |
| **Marke** | „BuyImmo" vor öffentlicher Nutzung auf Markenrecht und Domain prüfen (nicht geschehen). |
| **Demo** | Die Demo hat keine gespeicherten Kaufprüfungen → die Kommandozentrale zeigt dort einen Leerzustand. Beispiel-Kalkulationen bräuchten eine `demo_seed`-Kopie + Eintrag in der Reset-Funktion. |
