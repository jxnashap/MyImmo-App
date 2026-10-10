# 07 — Volatile Kennzahlen und Prüfzyklus

> **Alles hier altert.** Jede Zeile trägt Quelle, letzten Prüfstand und
> Prüfintervall. Wer eine Zahl benutzt, ohne auf das Datum zu sehen, benutzt
> vielleicht eine von gestern.

## Wie geprüft wird

1. **Beim Sessionstart** die Spalte „nächste Prüfung" gegen das heutige Datum
   halten. Fällige Zeilen abarbeiten, **bevor** die eigentliche Aufgabe beginnt.
2. **An der Quelle prüfen**, nicht aus dem Gedächtnis — Gesetzestext,
   Anbieterseite, Dashboard, eigene Messung.
3. **Ergebnis eintragen**, auch wenn sich nichts geändert hat: neues Datum,
   nächster Termin. „Unverändert" ist ein Prüfergebnis.
4. **Ändert sich ein Wert**, alle abhängigen Stellen mitziehen — Code, Tests,
   Dokumentation, PDF-Skripte. Die Spalte „Wo im Code" nennt sie.

## Gesetzlich / behördlich

| Größe | Wo im Code | Quelle | Geprüft | Intervall | Nächste Prüfung |
|---|---|---|---|---|---|
| **Zeilen der Anlage V je Steuerjahr** | `lib/steuer/anlageVZeilen.ts` (`ANLAGE_V_ZEILEN`), `tests/paketP14.test.ts` | Vordruck Anlage V des Jahres (amtlich, z. B. Nachdruck bei Buhl/Formular-Management-Server), Anleitung zur Anlage V | ✅ 10.10.2026 — 2024 und 2025 gleich belegt (Schuldzinsen 46–48, umgelegt 73–75, nicht umgelegt 76–78, Summe 83, Überschuss 85); 2026 noch ohne Vordruck → App zeigt keine Zeilennummern | jährlich, sobald der Vordruck erscheint (meist Jan./Feb.) | **01.02.2027** |
| **Grunderwerbsteuer je Bundesland** | `lib/kalk.ts` (`BUNDESLAENDER`) | Landesgesetze | 26.08.2026 | halbjährlich | **01.03.2027** |
| **KfW-308-Konditionen** | `lib/kauf/foerderung.ts`, `docs/kauf/KfW-Foerderung-2026.md`, `tests/foerderung.test.ts` | kfw.de Produktseite | ✅ 28.08.2026 — Höchstbeträge 140/160/180 Tsd. €, EH 85 EE auch per Einzelmaßnahmen; `KFW_STAND = "08/2026"` | jährlich | **01.08.2027** |
| **BEG: BAFA-Einzelmaßnahmen, KfW 458, KfW 261, KfW 159/455-B** | `lib/kauf/foerderung.ts` (`FOERDER_STAND`), `lib/sanierung/foerderung.ts`, `docs/kauf/KfW-Foerderung-2026.md`, `tests/sanierungFoerderung.test.ts` | Richtlinien BEG EM/WG (Bundesanzeiger), kfw.de „Anpassungen 2026“ + Produktseiten, bafa.de Gebäudehülle. **WebFetch geht dort, curl mit Browser-Kennung ebenfalls** | ✅ 05.10.2026 — **Reform zum 21.07.2026**: BAFA 15 %, Grenze 30/15/8 Tsd. € je WE (iSFP 60/30/15, +5 Pp nur darüber); KfW 458 Grund 30 %, Höchstkosten 28.000 € (1. WE), Effizienzbonus weg; 261 Tilgungszuschuss −10 Pp; 455-B ausgeschöpft | **feste Termine:** 01.02.2027 (458: Klimabonus −4 Pp, Höchstkosten −750 €), Q1 2027 (Wärmepumpe 15 % + Wertschöpfungsbonus, WPB-Bonus BAFA) | **01.02.2027** |
| **Gebäudemodernisierungsgesetz (GModG, vorher GEG)** — Nachrüstpflichten nach Eigentümerwechsel (§ 35 oberste Geschossdecke, § 69 Leitungen, Frist 2 Jahre), Energieausweis 10 Jahre (§ 79) | `lib/fristen.ts`, `docs/zukunft/SANIERUNGS-GUIDE.md` | gesetze-im-internet.de/geg/ (Titel „GModG“, G v. 23.07.2026, BGBl. 2026 I Nr. 226, in Kraft 29.07.2026) | ✅ 05.10.2026 — § 72 (Kessel-Austauschpflicht) **weggefallen** | weitere Stufen laut Sekundärquellen 01.01.2027/2028/2030 | **01.01.2027** |
| **Rauchwarnmelder-Pflicht je Land** (welche Räume) — Hinweistext im Sanierungs-Guide | `lib/sanierung/auswertung.ts` (Hinweis `rauchmelder`, Zählung Schlafen/Kind/Flur) | Landesbauordnungen; test.de 03.08.2023 (Sekundärquelle) | 05.10.2026 übernommen, **Änderungen nach 2023 nicht geprüft** — der Text sagt „Stand 2023“ | jährlich | **01.04.2027** |
| **§ 35c EStG** (Selbstnutzer, 20 %, max. 40.000 €) | `lib/kauf/foerderung.ts` | gesetze-im-internet.de § 35c + § 52 Abs. 35a | ✅ 05.10.2026 — unverändert, gilt für Maßnahmen bis 31.12.2029 | jährlich | **01.10.2027** |
| **Fernablesepflicht / § 5 HeizkostenV** | `lib/ratgeber.ts` (Artikel `heizkostenabrechnung-…`) | HeizkostenV | — | einmalig | **ab 01.01.2027 entschärfen** |
| **§ 82b EStG, AfA-Sätze** | `lib/steuer/` | EStG | — | jährlich zum Steuerjahr | **01.02.2027** |
| **Next.js-Hauptversion** | `package.json`, `next.config.*` | Release-Notes / EOL-Plan | ✅ 16.3.8 seit 30.09.2026 (Migration von 15, `package.json` geprüft 03.10.2026) | halbjährlich | **01.03.2027** |
| **Bewirtschaftungskosten ImmoWertV Anlage 3** (Verwaltung je Wohnung/ETW/Garage, Instandhaltung je m²/Garage) — Ertragswert in `/vergleich`, `/kauf`, `/bewertung` | `lib/bewertung/immowertv.ts` (`BEWIRTSCHAFTUNG_JE_JAHR`, eine Zeile je Jahr) | Fortschreibung nach Anlage 3 Nr. III (VPI Oktober des Vorjahres ÷ VPI Oktober 2001 = 77,1, Basis 2020); veröffentlicht vom Oberen Gutachterausschuss Brandenburg (`BewKo_<Jahr>.pdf`) und immobilien-wertermittlung.de — **beide abrufbar per curl** | ✅ 09.10.2026 — Tabelle 2021–2026 (2026: 367/439/48 €, 14,4 €/m², 108 €; VPI Okt. 2025 = 123,0). Fehlt ein Jahr, rechnet die App mit der letzten Zeile und sagt es in den Warnungen | jährlich, sobald der VPI Oktober erscheint (Mitte November) | **15.11.2026** (Zeile 2027) |
| **Notar-/Grundbuchpauschale (2 %)** | `lib/kalk.ts` | GNotKG, Marktüblichkeit | 26.08.2026 | jährlich | **01.09.2027** |
| **Maklerprovision (3,57 % Käuferanteil)** | `lib/kalk.ts`; auch Standard für Kauf- und Verkaufskosten in `lib/strategie.ts` | Marktüblichkeit, Teilungsgebot | 26.08.2026 | jährlich | **01.09.2027** |

## Anbieter / Verträge

| Punkt | Stand | Geprüft | Intervall | Nächste Prüfung |
|---|---|---|---|---|
| **Brevo-AVV** (Anlage 2 der ToS) | 🟨 halb — DPA archiviert, Subprozessoren ausgewertet, Datenschutzerklärung angeglichen. **Offen (nur im Konto, Betreiber):** Rechtsdokumente prüfen, Firmendaten auf die Gewerbeanmeldung bringen. 03.10.2026: unverändert offen (Betreiberpunkt, von hier nicht prüfbar) | 03.10.2026 | bis erledigt: monatlich | **01.11.2026** |
| **Supabase-DPA** | ✅ signiert (PandaDoc) | 24.07.2026 | jährlich | 24.07.2027 |
| **Vercel-AVV** | ✅ automatisch über ToS (Pro) | 29.07.2026 | bei Plan-Wechsel | — |
| **Anthropic-DPA** | ✅ archiviert, **SCC, kein DPF** | 15.07.2026 | jährlich | 15.07.2027 |
| ~~**Enable Banking** (AISP)~~ | ❌ **entfällt** — Open Banking am 29.08.2026 komplett aus der App entfernt (Code, Tabellen, Add-on). Erst mit Wiederaufbau wieder relevant | 29.08.2026 | — | — |
| **Anbieter existiert noch?** | GoCardless/Nordigen ist weggefallen — Muster für jede Anbieterwahl | 12.07.2026 | halbjährlich | **01.01.2027** |

## Eigene Einstellungen, die nachweislich nicht greifen

> **Am 30.09.2026 erneut nachgezogen.** Zwei Zeilen dieser Tabelle waren nach
> vier Wochen wieder überholt — das ist der Normalfall, nicht die Ausnahme.
> Deshalb steht hier ein Prüfdatum und kein Dauerbefund.

| Punkt | Befund | Geprüft | Nächste Prüfung |
|---|---|---|---|
| **Supabase Mindest-Passwortlänge** | ✅ vom Nutzer auf 8 gesetzt — App und Dashboard stimmen wieder überein | 30.08.2026 | jährlich → **01.09.2027** |
| **Leaked Password Protection** | ✅ **wirkt** — Supabase-Log 30.09.2026: sechsmal `PUT /user` 422 „Password is known to be weak“ beim Reset-Test, danach ein sicheres Passwort angenommen. Belegt am Passwort-Setzen; die Registrierung nutzt dieselbe Server-Einstellung | 30.09.2026 | halbjährlich → **01.04.2027** |
| **`NEXT_PUBLIC_BETA_CODE`** | nicht gesetzt (10 Bundles, 629 KB durchsucht) | 27.08.2026 | halbjährlich → **01.03.2027** |

## Preise und Pläne (verändern die Kalkulation)

| Posten | Stand | Geprüft | Nächste Prüfung |
|---|---|---|---|
| Vercel Pro | aktiv | 29.07.2026 | jährlich |
| Supabase Pro (~25 $/Monat) | **gebucht** — live abgefragt 08.09.2026 (`plan: "pro"`); die Zeile stand vorher falsch auf „nicht gebucht“ | 08.09.2026 | jährlich |
| Apple Developer (99 $/Jahr) | nicht gebucht | — | vor App-Store-Launch |
| **Apple-Provision EU** | IAP 26 % / 15 % (SBP, Abo ab Jahr 2) · Fremd-PSP 20 / 10 % · Web-Link 15 / 10 % · gilt seit 01.10.2026; iOS ohne IAP nur über 3.1.3(f) — `[[LAUNCH-FUNDAMENT]]` §5 | 03.10.2026 | halbjährlich | **01.04.2027** |
| **Google Play Testpflicht** | persönliches Konto: 12 Tester × 14 Tage ununterbrochen; Organisationskonto ausgenommen (D-U-N-S) | 03.10.2026 | halbjährlich | **01.04.2027** |
| Enable Banking je Konto/Monat | entfällt (Feature entfernt 29.08.2026) | 29.08.2026 | erst bei Wiederaufbau |

## Marktdaten (Beispiel- und Schulungszahlen)

| Größe | Wert | Quelle | Geprüft | Intervall |
|---|---|---|---|---|
| Lübeck ETW ⌀ | ~3.559 €/m² (Spanne 2.407–4.712) | Portalauswertungen | 26.08.2026 | halbjährlich |
| Lübeck Häuser ⌀ | ~3.163 €/m² | dito | 26.08.2026 | halbjährlich |
| Lübeck Kaltmiete ⌀ | ~11,04 €/m² (einfache Lagen 9,87) | dito | 26.08.2026 | halbjährlich |
| Beispiel-Sollzins (`beispielZins()` in `lib/kauf/darlehen.ts`; auch Standardzins der Strategie `/strategie`) | 3,80 % p. a. | Marktüblichkeit | 26.08.2026 | **quartalsweise** → **26.11.2026** |
| Baumarktpreise + Materialverbrauch (Sanierungsrechner, `lib/sanierung/katalog.ts`) | 13 Materialien, z. B. Alpinaweiß 10 l 54,99 €, PCI Flexmörtel 25 kg 48,99 € | Produktseiten OBI/toom/Globus, Merkblätter Knauf/MEM/Alpina/Henkel/Erfurt/PCI/Lugato (URLs im Code); Hornbach/Bauhaus blockieren Abrufe. **OBI antwortet WebFetch mit 404** — `curl` mit Browser-User-Agent liefert die Seite, Preis im JSON-Feld `"price"`, ohne Streichpreis = `NO_STRIKE_PRICE` | 05.10.2026 | halbjährlich → **01.04.2027** |
| Handwerker- und Fachbetriebspreise (Sanierungs-Guide, `lib/sanierung/arbeiten.ts`) | 28 Arbeiten, z. B. FI nachrüsten 150–385 €, Bad komplett 900–3.500 €/m², Maler streichen 8–16 €/m² (brutto) | Portale (Blauarbeit, Aroundhome, AuftragsGlück, Angebots-Meister …) + BKI-Mittelwerte über schwaebisch-hall.de + co2online/Verbraucherzentrale; **jede Zahl wörtlich im Feld `zitat`**, ein Test prüft das. **MyHammer sperrt Abrufe (403).** Zusammenfassungen (WebFetch) lasen Zahlen falsch — nur `curl` + Volltext | 05.10.2026 | halbjährlich → **01.04.2027**; fortschreiben mit Destatis-Baupreisindex (ab KW 43/2026 nur GENESIS-Online) |
| Nutzungsdauern von Bauteilen (`lib/sanierung/nutzungsdauer.ts`) | 23 Bauteile, z. B. Laminat NK 31 15 J., NK 32/33 20 J., Anstrich Klasse 1 20 J. | BBSR-Datei `26.03.13_BBSR_Nutzungdsdauern.xlsx` (Werte-Stand 04.11.2025), nachhaltigesbauen.de | 05.10.2026 | jährlich → **01.10.2027** |

**Zinsen altern am schnellsten.** Ein Beispielzins, der zwei Jahre alt ist, macht
jede Beispielrechnung unglaubwürdig.

## Vorlagen, die mitwandern müssen

Ändert sich einer der obigen Werte, sind **immer** mitzuziehen:
- der Rechencode in `lib/`
- die zugehörigen Tests in `tests/`
- die Fachdoku in `docs/`
- die PDF-Skripte in `scripts/` (Businessplan, AVV)
- Schulungs-/Marketingmaterial mit Beispielrechnungen

**Prüfung:** Nach der Änderung eine Volltextsuche über den alten Wert. Bleibt ein
Treffer übrig, ist die Änderung unvollständig.
