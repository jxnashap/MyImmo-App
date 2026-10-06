# Verknüpfungs-Audit 06.10.2026

**Auftrag (Betreiber):** „Keine neuen Funktionen — es soll jetzt mehr optimiert und verknüpft werden.“
**Frage:** Wo tippt ein Vermieter etwas zweimal, wo endet ein Weg in einer Sackgasse, wo liegen
Daten ungenutzt, wo rechnen zwei Stellen dieselbe Zahl verschieden?
**Vorgehen:** drei lesende Durchgänge (Anlegen · Geldkreislauf · Steuer/Schaden/Termine), die
schwersten Funde selbst im Code nachgeprüft, zwei davon zusätzlich an Live-Zählungen
(Kategorien, Kreditraten). Stand: Commit `c4b5f92` (main, 06.10.2026).

Kategorien: **DE** Doppel-Eingabe · **SG** Sackgasse · **UD** ungenutzte Daten · **DR** doppelte Rechnung.
Aufwand S/M/L.

---

## Paket A — still falsche Zahlen ✅ erledigt 06.10.2026

| # | Fund | Art | Lösung |
|---|---|---|---|
| A1 | Bearbeiten einer Ausgabe machte „Schuldzinsen“ still zur „Reparatur“ (Kategorie fehlte im Dialog; `<select>` zeigt sonst die erste Option). Acht verschiedene Kategorienlisten; Import-Kategorien (Müll, Gartenpflege, Kaltmiete) gingen beim Bearbeiten ebenso verloren. | DR | `lib/kategorien.ts` + `kategorieOptionen()` |
| A2 | Jahresbericht zählte die Kaution als Einnahme, Anlage V nicht. | DR | `lib/jahresberichtZeile.ts` |
| A3 | Dashboard zeigte Fristen, die in `/termine` ausgeblendet waren; der Link führte auf eine Seite ohne sie. | SG | gleicher `fristSchluessel` |
| A4 | Kredit ohne Monatsrate zählte mit 0 € (Cashflow zu hoch). Live: 0 von 12 Krediten betroffen; nur 2 von 11 Raten passen zur Annuitätenformel → **keine** Ersatzrate, sondern Pflichtfeld. | UD | `required` |
| A5 | Objekt „Vermietet“ legte eine Miet-Vorlage ohne Mieter/NK/Mietmonat an → Mietkonto „offen“, Doppelbuchung naheliegend. Live: 1 Vorlage. | DR | keine NEUE Vorlage; bestehende gepflegt |

## Paket B — eine Soll-Miete statt zwei (offen, größter Gewinn, M–L)

Gemeinsame Wurzel: Es fehlt „Soll ab Datum“. Mietkonto, Wächter und offene Mieten rechnen mit
`miet_zeitraeume`; Kacheln, Objektseite und Briefe mit den Feldern am Mieter.

- **B1 (DR)** Mieterhöhung im Mieterformular überschreibt `kaltmiete`/`nk_vorauszahlung` ohne
  Zeitraum → `sollFuerMonat` nimmt den neuen Wert für ALLE Monate (Nacherfassung, Rückstand
  rückwirkend falsch). `lib/actions/tenants.ts` (update), `lib/mietkonto.ts:131`.
- **B2 (DE)** Staffelplan erzeugt nur eine Frist, kein Soll (`lib/fristen.ts:101-121`).
- **B3 (SG)** NK-Anpassung § 560 Abs. 4 BGB endet im Brief, Soll bleibt (`components/NkVorjahrHilfe.tsx`).
- **B4 (DR)** Kacheln/Cashflow/Objektseite/Platzhalter `{miete}` aus den Mieterfeldern
  (`lib/sollMiete.ts`, `lib/cashflowKennzahl.ts`, `components/DocGenerator.tsx`).
- **B5 (DR)** Teilzahlung: Vermieter sieht „bezahlt“, Mieter „teilweise“ (`lib/mietkonto.ts`
  vs. `lib/mieterKonto.ts`).
- **B6 (DE)** Manuelle Einnahme: kein Mietmonat, kein NK-Anteil aus dem Vertrag, Objekt und
  Mieter getrennt gewählt (`components/BuchungForm.tsx`).
- **B7 (DR)** Wiederkehrende Vorlage „Miete“ bucht fest, ohne NK-Anteil/Mietmonat (`lib/actions/wiederkehr.ts`).

**Risiko:** Eingriff ins Mietkonto. Vor dem Bau gegen echte Verläufe testen (Nacherfassung darf
keine falschen offenen Posten erzeugen).

## Paket C — NK-Kreislauf (offen, L)

- **C1 (DE)** Gebuchte umlagefähige Kosten werden in Verteiler/Positionen neu getippt — kein
  NK-Pfad liest `kosten` (`app/(app)/tenants/[id]/nk/page.tsx`, `components/UmlageAssistent.tsx`).
- **C2 (UD)** Übernommene Zählerstände landen in `verbrauch` ohne Mieter und erreichen die
  Abrechnung nie (`lib/actions/zaehler.ts`, `lib/nk.ts` nutzt `verbrauch_mieter`).
- **C3 (SG)** Nachzahlung/Guthaben wird weder offener Posten noch Buchung; Frist „NK zustellen“
  bleibt nach der Zustellung dringend; Auszug im Vorjahr → gar keine Frist (`lib/fristen.ts:80-95`).
- **C4 (DE)** Lohnanteil eines Auftrags nur als Notiztext; Buchungsdatum = Übernahmetag statt
  Rechnungstag (`lib/actions/service.ts`).

## Paket D — Wege und Links (offen, je S)

- Fristen verlinken pauschal `/termine`, nie das Ziel (Mieter-NK, Brief, Kredit) — `lib/heute.ts`.
- Anliegen-Aufgabe → `/anliegen` statt `vorgangUrl(id)`; Zählermeldung → `/verbrauch` pauschal.
- Objekt-Check „Mieter anlegen“ ohne `?prop=`/`back` (`lib/objektCheck.ts`).
- Mieterformular übernimmt Fläche/Miete des Objekts nicht (`app/(app)/tenants/new/page.tsx`).
- „Gebäudeanteil fehlt“ → Formular statt AfA-Assistent (der kein `?objekt=` annimmt).
- Mahnung „per Mail“ hinterlässt nichts (kein Archiv-Eintrag, kein Datum).
- Tour/Start-Checkliste ohne Darlehen; Import-Hinweis verlinkt eine Seite ohne Import.
- CSV-Import legt jedes Objekt als „Vermietet“ an, ohne Hausgeld-Vorlage (`lib/actions/importDaten.ts`).
- Vollmacht-Fristen nur auf dem Dashboard, nicht in `/termine`.
- Kontoauszug-Abgleich: Abbuchungen und fremde Eingänge ohne Weg zur Buchung.
- Beleihungsauslauf doppelt: Formularfeld UND berechnet (`app/(app)/kredite/new`, `lib/beleihungsauslauf.ts`).

## Paket E — BuyImmo → MyImmo (offen, M–L)

- Gekauftes Objekt wird neu getippt; `kalkulationen.uebernommen_prop_id` existiert, ungenutzt
  (`lib/fahrplan.ts:145` → leeres `/properties/new`).
- Finanzierungswunsch nur im Browser (`components/kauf/DarlehenWizard.tsx`) — nie ein Kredit.
- Exposé-KI-Import doppelt (`ImportWizard` und `KalkImport`).

## Nicht ohne Betreiber bzw. Anwalt

- Kaufnebenkosten in die AfA-Basis (steuerliche Entscheidung; `docs/zukunft/SANIERUNGS-GUIDE.md` §11).
- DATEV-Konten (Schuldzinsen auf 4900, Hausgeld auf 4260, NK-Anteil nicht getrennt) — Kanzlei/StBerG.
- Zinsen aus Tilgungsplan statt „Restschuld × Zins“ — ohne Sondertilgungen Scheingenauigkeit.
- Firma meldet Rechnung über ihren Link — wäre ein neuer Upload für Fremde (Eingang), eher neue Funktion.

## Geprüft und in Ordnung

Anlage-V-Seite und -PDF über dieselbe `berechneAnlageV`; Jahresbericht-Seite und -PDF über
`jahresZeile()`; gebuchte NK-Vorauszahlungen (`nk_anteil`) fließen in die NK-Abrechnung
(`lib/nkDaten.ts`); ein erledigter Auftrag schreibt in den Verlauf des Anliegens (Trigger).
