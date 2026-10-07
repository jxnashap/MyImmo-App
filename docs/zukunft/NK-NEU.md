# Nebenkostenabrechnung neu: Positionen je Objekt (Plan, 07.10.2026)

**Auftrag (Jonas, 07.10.2026):** „Informiere dich ausgiebig über die Nebenkostenabrechnung … Was bekommt
man von den Hausverwaltern? … Wenn man alles selber ablesen muss … Mehrfamilienhaus … Wie teilt man es
auf? … Das muss man jetzt ewig suchen bei Bearbeiten vom Mieter. Da müssen wir nochmal anders ran.“
Nachgefragt: „Könnte man die Umlageposition dann pro Objekt machen?“ — **Entscheidung: ja.**
Für die ETW: „Von der Hausverwaltung kommt alles schon aufgeteilt — man trägt nur noch seine eigenen
Kosten ein (Grundsteuer, ggf. Niederschlagsgebühr); die könnten voreingestellt sein.“

## Ist-Stand (Code, geprüft 07.10.2026)

- Positionen liegen **je Mieter** (`mieter_positionen`), nicht je Objekt. Bearbeiten nur unter „Mieter
  bearbeiten“, unter dem Stammdatenformular. Bei n Wohnungen wird jede Kostenart n-mal getippt, samt
  Gesamtfläche/Gesamtverbrauch je Zeile.
- Der Verteiler (`/properties/[id]/umlage`) hat kein Gedächtnis (startet leer), kennt nur Fläche/gleich,
  keine Heizkosten, und schreibt nur den fertigen Anteil je Mieter — **die Gesamtkosten fehlen danach im
  Brief** (BGH-Pflichtangabe). Verteilte und manuelle Positionen können sich doppeln.
- Schlüssel „Personen/Einheit“ rechnen nichts (nur `aufteilung` zählt), MEA gibt es nicht.
- Zählerstände aus dem Portal werden nur angezeigt, nicht übernommen.
- **Stufe 0 behoben (07.10.2026, `tests/nkStufe0.test.ts`):** PDF lud vier Spalten weniger als die
  Vorschau (Fläche/HeizkostenV fielen im PDF auf „Tage“ zurück, § 35a fehlte) → `NK_POSITION_SPALTEN`;
  Verteiler-KI-Import las `betrag` statt `gesamt` (alle Beträge leer); KI-Import beim Mieter schrieb
  `aufteilung: null` in eine NOT-NULL-Spalte; Link „Positionen bearbeiten“ mit Jahr von der NK-Seite.

## Rechtslage (Stand 07.10.2026; gesetze-im-internet.de war nicht erreichbar, gelesen über dejure/buzer)

- **ETW:** Verwalter liefert Jahresabrechnung/Einzelabrechnung, Wirtschaftsplan, Vermögensbericht
  (§ 28 WEG). Ausweis „umlagefähig“ ist üblich, gesetzliche Pflicht nicht belegt — Aussortieren bleibt
  beim Vermieter. **Nie umlagefähig:** Verwaltervergütung, Erhaltungsrücklage, Instandhaltung,
  Kontoführung der WEG, Rauchmelder-MIETE (BGH 11.05.2022, VIII ZR 379/20; Wartung ja). Grundsteuer
  aus dem eigenen Bescheid der Wohnung (BGH 17.04.2013, VIII ZR 252/12). Schlüssel: ohne Vereinbarung
  der WEG-Maßstab (meist MEA, § 556a Abs. 3 BGB), bei „Wohnfläche“ im Mietvertrag umrechnen.
  **12-Monats-Frist gilt auch ohne WEG-Abrechnung** (BGH 25.01.2017, VIII ZR 249/15) — Nachforderung
  danach nur mit nachgewiesenem eigenem Bemühen beim Verwalter.
- **MFH selbst:** 17 Kostenarten § 2 BetrKV; „sonstige“ nur einzeln im Mietvertrag (BGH VIII ZR 167/03).
  Kabel-TV-Entgelt seit 01.07.2024 nicht mehr umlagefähig (Glasfaserbereitstellung ≤ 60 €/Jahr bleibt).
  Standardschlüssel Wohnfläche, erfasster Verbrauch nach Verbrauch (§ 556a Abs. 1). **Leerstand trägt der
  Vermieter** (BGH VIII ZR 159/05). Hauswart: Reparatur-/Verwaltungsanteil herausrechnen.
- **Heizung:** 50–70 % nach Verbrauch (§§ 7, 8 HeizkostenV), Selbstabrechnung erlaubt; Fernablesbarkeit
  für Bestandsgeräte bis **31.12.2026**, sonst Kürzung 3 % (§ 12); Ausnahme § 2 (≤ 2 Wohnungen, eine
  selbst bewohnt). Brennstoff nach Verbrauch, nicht Abfluss (BGH VIII ZR 156/11). Eichung Wasser- und
  Wärmezähler 6 Jahre (MessEV seit 2021). Zwischenablesung beim Wechsel zahlt der Vermieter (BGH VIII ZR 19/07).
- **Formell** (BGH 20.01.2016, VIII ZR 93/15): Gesamtkosten, Schlüssel, Anteil, Vorauszahlungen.
  Belegeinsicht seit 01.01.2025 auch elektronisch (§ 556 Abs. 4 S. 2 BGB).
- **Unsicher, nicht belegt:** Ausweispflicht des Verwalters; Aktualität BMF-Schreiben § 35a (2016);
  landesrechtliche Kaltwasserzähler-Pflicht.

## Plan

**Leitidee:** Eine Abrechnung **je Objekt und Jahr** („Nebenkosten 2025“ am Objekt). Jede Kostenart steht
EINMAL mit Gesamtbetrag; der Schlüssel hängt an der Kostenart (am Objekt voreingestellt); die App
verteilt auf die Mieter. „Mieter bearbeiten“ verliert die Positionen; die Mieterseite zeigt den Anteil.

1. ✅ **Stufe 1 gebaut 07.10.2026 (siehe unten) — Abrechnung je Objekt (MFH):** Kostenliste (Vorschläge aus Buchungen, Vorjahr, KI-Import);
   Schlüssel Fläche / Personen / Einheiten / MEA / Verbrauch / „Betrag je Wohnung“; Belegungstage aus
   Mietbeginn/-ende, Leerstand automatisch beim Vermieter; Übersicht Position × Mieter; alle Abrechnungen
   auf einmal. Bestehende `mieter_positionen` bleiben als Altbestand lesbar (alte Jahre nachvollziehbar).
2. **Stufe 2 — Zähler je Wohnung:** Anfangs-/Endstand, vorbefüllt aus Portal-Meldungen, Eichablauf;
   Heizkosten zuerst als „Betrag je Wohnung vom Messdienst“, danach HeizkostenV 50–70 % selbst.
3. **Stufe 3 — ETW:** Einzelabrechnung der Hausverwaltung hochladen; die App übernimmt **„Ihr Anteil“**
   je Zeile (schon aufgeteilt) und schlägt umlagefähig ja/nein vor — Verwaltung, Rücklage, Instandhaltung,
   Rauchmelder-Miete fest gesperrt. **Eigene Kosten** als eigene Zeilen, **voreingestellt** aus Buchungen
   bzw. Vorjahr: Grundsteuer (eigener Bescheid), ggf. Niederschlagswasser oder Versicherung, wenn nicht
   im Hausgeld. MEA-Schlüssel mit Hinweis, wenn der Mietvertrag „Wohnfläche“ sagt. Fristwächter mit
   dokumentierter Erinnerung an den Verwalter.
4. **Stufe 4 — Prüfungen:** Kabel/Rauchmelder-Miete, „sonstige“ nur mit Vertragsgrundlage, § 35a auf dem
   Bildschirm, Belegeinsicht im Portal, Vorauszahlungsvorschlag.

**Risiken:** großer Umbau (Rechnung, PDF, Zustellung, Demo, Datenübergang mit zwei Wegen eine Zeit lang);
volle HeizkostenV-Eigenrechnung aufwendig; KI-Erkennung „umlagefähig“ an keiner echten
Hausgeldabrechnung geprüft — immer nur Vorschlag. **Niederschlagswasser** steht bei ETW meist schon im
Hausgeld (die WEG bekommt den Bescheid) — als eigene Kostenart nur, wo die Gemeinde den Eigentümer
direkt veranlagt; sonst doppelt.

## Stufe 1 — gebaut (07.10.2026)

**Wo:** `/properties/<id>/nebenkosten?jahr=` (Objektseite → „Nebenkosten öffnen“, nur bei mehreren
Mietparteien = `zeigeVerteiler`). Grundlagen (Gesamtwohnfläche, Einheiten, MEA gesamt; Personen und MEA je
Mieter), Kostenarten (je einmal mit Gesamtbetrag; Vorschläge aus Buchungen, „wie Vorjahr“, KI-Import mit
`gesamt`), Verteilung Position × Mieter mit Spalte „Vermieter“, Ergebnis je Mieter mit Vorauszahlung und
Saldo, „Alle als ein PDF“ (`/properties/<id>/nebenkosten/pdf`).

**Rechnung `lib/nkObjekt.ts` → `verteileObjektKosten()`** — cent-genau, Anteile + Vermieter = Gesamtbetrag:
- Fläche: m² × Tage ÷ (Gesamtfläche × Jahrestage) · Einheiten: Tage ÷ (Einheiten × Jahrestage) ·
  MEA: MEA × Tage ÷ (MEA gesamt × Jahrestage). **Nenner = ganzes Haus, ganzes Jahr** → Leerstand beim Vermieter.
- Personen: Personentage; eine leere Wohnung zählt mit EINER Person (Vermieter). Ohne Einheitenzahl keine
  Verteilung. **Entscheidung ohne Rechtsbeleg** — vorsichtige Lesart, damit Leerstand nie bei Mietern landet.
- Verbrauch: gemessen, ohne Tage-Faktor, Nenner = Hauptzähler (leer = Summe der Wohnungen, dann Warnung).
- Betrag je Wohnung („direkt“): genau der eingetragene Betrag (Messdienst), Rest beim Vermieter; Summe über
  dem Gesamtbetrag → nicht verteilt.
- Fehlt eine Angabe: NICHT verteilen, Warnung — nie still auf „Tage“ ausweichen (der Altbestand tat das).

**EINE Quelle für jede Abrechnung: `lib/nkPositionen.ts` → `ladeNkPositionen()`** (NK-Seite, PDF,
Beleihungs-Mappe). Kosten am Objekt für das Jahr vorhanden → nur diese (Aufteilung `objekt` in `lib/nk.ts`:
Gesamtbetrag als `basis`, Anteil fertig); sonst `mieter_positionen` (Altbestand). **Nie gemischt.**

**Übergang:** Migration `20261007090000` läuft im SQL-Editor. Bis dahin: Objektseite zeigt „kommt in Kürze“,
der alte Verteiler bleibt erreichbar, alle Abrechnungen rechnen wie bisher. Danach leitet `/umlage` auf
`/nebenkosten` um (`nkAmObjekt()`), „Mieter bearbeiten“ zeigt beim MFH nur noch den Weg zum Objekt und die
alten Positionen als aufklappbaren Altbestand. ✅ **Migration live (07.10.2026), alter Verteiler entfernt**
(`UmlageAssistent.tsx`, `lib/actions/umlage.ts`, `berechneUmlage`); `/umlage` leitet auf `/nebenkosten`.
Die RPC `umlage_positionen_ersetzen` liegt noch in der Datenbank, ungenutzt — beim nächsten SQL-Editor-Lauf
mit entfernen.

**Demo:** „Zweifamilienhaus Dresden“ hat Kosten mit jedem Schlüssel und CO₂. ⚠️ Die erste Fassung
(`20261007113957`, „nicht im Reset“) war falsch — die Kaskade löschte sie beim nächsten Demo-Start. Seit
`20261007210000` legt `demo_nk_nachfuellen()` beide Tabellen nach jedem Demo-Reset wieder an; das Jahr wandert mit.
Live geprüft: Seite bei 360/390 px, Abrechnung Krüger 1.494,31 € / Guthaben 305,69 € (von Hand
nachgerechnet), Einzel-PDF 2 Seiten (Gruß mit § 35a-Block auf Seite 2), Sammel-PDF 4 Seiten.

**Nicht in Stufe 1:** CO₂-Aufteilung am Objekt
(bleibt je Mieter), Zähler aus dem Portal (Stufe 2), ETW (Stufe 3), Einzelobjekte (bleiben beim Mieter).
`tests/nkObjekt.test.ts`, 14 Mutationen rot.

## Gesamtprüfung 07.10.2026 — Paket P2 (behoben)

- **CO₂ im MFH am Objekt** (`nk_objekt_jahr.co2_*`, `co2AmObjekt()` in `lib/nkObjekt.ts`): Stufe aus dem
  Gebäude je m² Gesamtfläche (§ 5 Abs. 1 CO2KostAufG, auf eine Nachkommastelle), Vermieteranteil einmal,
  verteilt nach Heizkostenanteil (§ 7 Abs. 1); ohne Heizkosten am Objekt nach Wohnfläche × Tagen mit Hinweis.
  `nkCo2Argumente()` (lib/nkPositionen.ts) ist die EINE Regel für Seite, PDF, Beleihungs-Mappe, Objektseite.
- Personenschlüssel: Mieter ohne Personenzahl zählen mit 1 Person beim Vermieter (vorher trug der andere
  Mieter ihren Anteil).
- HKVO-Altbestand: Grundkosten zeitanteilig (§ 9b HeizkostenV).
- Verbrauch ohne Hauptzähler: Warnung.
