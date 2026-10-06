# BuyImmo — der Weg zum Kauf (Umbau 06.10.2026)

**Status:** gebaut am 06.10.2026 (Branch `claude/gifted-clarke-6d08pd`). Vorgabe des Betreibers,
sinngemäß: Ein kompletter Anfänger soll Schritt für Schritt zum Kauf geführt werden — „dass es so in
der Reihenfolge links auch in den Reitern ist“. Am Anfang Objekte vergleichen (Anzeigen, Makler,
Websuche, etwa fünf Kandidaten durchrechnen), bei der Besichtigung den Sanierungsrechner „wie eine
Lern-App“ durchklicken bis zur Endsumme, danach die Finanzierung. Oben Cockpit, darunter Strategie:
„stammbaumartig“ Kaufziele für das nächste Jahrzehnt mit wählbaren Taktiken.

Gehört zu [[BUYIMMO]]. Grenzen der Strategie: [[STRATEGIE-REITER]]. Guide: [[SANIERUNGS-GUIDE]].

---

## ⚠️ Risiken zuerst

1. **Die Strategie ist gebaut, bevor der Anwalt § 34i GewO geklärt hat.** `STRATEGIE-REITER.md`
   verlangte die Klärung *vor* dem Bau; der Betreiber hat den Bau ausdrücklich beauftragt. Gebaut
   ist deshalb nur ein **Rechner**: Der Nutzer legt Käufe und Taktik fest, die Seite rechnet nach
   *seinen* Annahmen, ob das Eigenkapital reicht. Keine Rangfolge der Taktiken, jede mit ihren
   Risiken, kein „du kannst kaufen“, ein Hinweis „keine Anlage- oder Finanzierungsberatung“, ein
   Test sucht Empfehlungs-Formulierungen. **Vor dem öffentlichen Start bleibt die Anwaltsfrage
   offen** — besonders für Beleihung und Verkauf als Taktik.
2. **Scheingenauigkeit.** Zehn Jahre hängen an Zins, Miete, Wert und Kosten. Gegenmittel: zweites
   Szenario „vorsichtig“ (Zins +1 Prozentpunkt, keine Wertsteigerung) neben jedem Ergebnis,
   Wertentwicklung standardmäßig 0 %, Ergebnisse als „rechnerisch gedeckt“, nie als Zusage.
   **Nicht gerechnet:** Steuern, Mietsteigerung, Instandhaltung über die Bewirtschaftungspauschale
   hinaus, Anschlussfinanzierung, Einkommen und Bonität.
3. **Reihenfolge gegen die Praxis.** Der Betreiber will erst besichtigen, dann finanzieren. Makler
   fragen oft schon vor dem Termin nach einer Finanzierungsbestätigung. Der Weg bleibt so, Schritt 2
   sagt es unter „Worauf du achten musst“.
4. **Der Strategie-Plan liegt nur im Browser** (`localStorage`, Schlüssel `buyimmo:strategie`).
   Gerätewechsel oder gelöschte Website-Daten = Plan weg. Bewusst so, weil eine Tabelle eine
   Migration im SQL-Editor bräuchte; nachrüsten, wenn Nutzer Pläne behalten wollen.
5. **Lern-App-Weiter kann überraschen.** Die Seite wechselt nach einer Auswahl von selbst. Deshalb
   eng begrenzt (Regeln unten); im Browser am Handy geprüft, nicht auf einem echten Telefon.
6. ~~**Demo zeigt Schritt 1 leer.**~~ ✅ **Seit 06.10.2026 vier Beispiel-Kandidaten** (Ja des
   Betreibers; Migration `20261006064806`). Ihre Kennzahlen kommen aus `lib/kauf/objektKennzahlen.ts`
   — der Rechnung, die der Objekt-Rechner seitdem selbst benutzt; `tests/demoKandidaten.test.ts`
   rechnet jede Zeile nach. **Nicht im Demo-Reset:** `kalkulationen` steht nicht in dessen
   Tabellenliste, die Demo kann nicht schreiben — die Zeilen bleiben stehen. Kommt `kalkulationen` je
   in den Reset, braucht es vorher eine `demo_seed`-Kopie. Schritt 4 (`/makler`) ist in der Demo gesperrt (Entscheidung von
   früher, keine Beispieldaten) — in der Seitenleiste steht deshalb mitten im Weg ein Schloss.

---

## Entscheidungen

### Fünf Schritte, eine Liste
`lib/kaufweg.ts` → `KAUFWEG`: **1 Objekte vergleichen** `/vergleich` · **2 Besichtigen & Sanieren**
`/sanierung` · **3 Finanzierung** `/kauf` · **4 Angebot & Unterlagen** `/makler` · **5 Notar &
Übergabe** `/abschluss`. Daraus entstehen Seitenleiste (`WEG` in `lib/nav.ts`, Nummern statt
Symbole), Schritt-Kopf jeder Seite (`components/aufbau/WegKopf.tsx`: Punkte 1–5, ein Satz, „Weiter:“,
eingeklappt „Worauf du in diesem Schritt achten musst“), das Cockpit und die Gruppen des Fahrplans.
Jede Fahrplan-Station hängt an genau einem Schritt (`stationen`); der Stand eines Schritts kommt nur
aus Daten (`schrittStand`), reine Hinweise zählen nicht.
Seitenleiste in BuyImmo: **Überblick** (Cockpit, Strategie) → **Dein Weg zum Kauf** (1–5) →
**Werkzeuge** (Fahrplan, Marktwert, AfA, Verkauf).

### Adressen
Neu: `/vergleich`, `/strategie`, `/abschluss`. **Bestehende Adressen bleiben** (Regel aus
`BUYIMMO.md`); `/kauf` heißt jetzt „Finanzierung“, alte Links `/kauf?sanierung=…` leiten auf den
Vergleich um. `/aufbau` heißt „Cockpit“.

### Vergleich auf der Seite statt im Fenster
Der Objekt-Rechner steht auf `/vergleich`, darunter die Tabelle (`components/kauf/ObjektVergleich.tsx`,
höchstens fünf nebeneinander, Auswahl bei mehr). Grün = bester Wert der Zeile, die Krone zählt nur
Bestwerte; Gesamtinvestition und Sanierung werden angezeigt, nicht gezählt. Je Kandidat
„Besichtigen“ und „Für die Finanzierung wählen“ (dieselbe Browser-Auswahl wie vorher, die der
Kauf-Assistent liest).

### Besichtigung gehört zu einem Kandidaten
`/sanierung?objekt=<id>` lädt die **eigene** Kaufprüfung (Filter auf `user_id`, nur echte UUID) und
legt einen Entwurf an, der Name, Adresse, Wohnfläche, Baujahr (nur vierstellig) und Ziel übernimmt
(`kaufpruefungStart()` in `lib/sanierung/uebergabe.ts`); der Guide fragt nur noch, was fehlt.
Der Entwurf merkt sich den Kandidaten (`Entwurf.kaufObjekt`); das Ergebnis führt mit der Summe
zurück zu **genau diesem** Kandidaten (`/vergleich?sanierung=…&objekt=…`). Eine Vorlage nimmt den
Kandidaten nicht mit. Liegt schon ein anderer Entwurf im Browser, fragt die Seite, statt ihn zu
überschreiben.

### Guide wie eine Lern-App
`autoWeiter()` in `lib/sanierung/guide.ts`: Nach einer **Auswahl** (Radio) geht es nach 450 ms von
selbst weiter — nur auf `eckdaten`, `ziel`, `arbeit`, `abschluss`, nur wenn diese Auswahl die Seite
**von unvollständig auf vollständig** bringt, nie beim Korrigieren einer fertigen Seite und nie auf
Seiten, die nach einer Wahl etwas aufklappen. In Textfeldern ist **Enter = Weiter** (die Seite ist
ein Formular, der Weiter-Knopf `type="submit"`, jeder andere Knopf `type="button"`).

### Strategie: Rechner mit Stammbaum
`lib/strategie.ts` (rein) + `components/strategie/StrategiePlaner.tsx`. Bis zu zwölf Käufe in zehn
Jahren, je Kauf eine **Taktik**: aus Erspartem · nur Nebenkosten selbst · Vollfinanzierung ·
Beleihung eines Objekts · Verkauf eines Objekts. Beleihung und Verkauf nehmen Kapital aus einem
**früheren** Objekt (Bestand aus MyImmo oder früherer Kauf) — so entsteht der Stammbaum.
Rechenregeln: Käufe zu Jahresbeginn, am Jahresende Sparrate + (Miete × (1 − Bewirtschaftung) −
neue Raten), Tilgung über `berechneRestschuld`, Wert × (1 + Wertentwicklung). Beleihungs-Spielraum
= Wert × Grenze − Schulden des Objekts; das Beleihungsdarlehen wird eine echte Schuld dieses
Objekts. Verkauf = Wert × (1 − Verkaufskosten) − Schulden, mit Hinweis auf § 23 EStG unter zehn
Jahren. **Ein ungedeckter Kauf findet nicht statt** (Lücke in Euro); was auf ihm aufbaut, findet
seine Quelle nicht. Raten des heutigen Bestands stecken in der Sparrate, die der Nutzer einträgt —
gezählt werden nur neue Kredite.
**Standardannahmen** (alle änderbar): Zins = `beispielZins(15)` (Prüfzyklus), Tilgung 2 %,
Wertentwicklung 0 %, Bewirtschaftung 20 % (wie im Objekt-Rechner), Beleihungsgrenze 80 %
(`AUSLAUF_HOCH`), Grunderwerbsteuer je Bundesland, Makler und Verkaufskosten
`MAKLER_STANDARD_PROZENT` (Prüfzyklus). Erspartes startet mit dem Eigenkapital aus der
Selbstauskunft.

---

## Regeln

1. **`KAUFWEG` ist die eine Liste.** Ein neuer Schritt oder eine neue Station kommt dort hinein;
   Seitenleiste, Kopf, Cockpit und Fahrplan folgen. `tests/kaufweg.test.ts` prüft Reihenfolge,
   Seiten, Ladezustände, Demo-Freigabe und dass jede Station genau einem Schritt gehört.
2. **Jede Schritt-Seite trägt `<WegKopf schritt="…" />`.**
3. **Auto-Weiter nur nach den Regeln oben** — eine neue Seite kommt nicht in `AUTO_WEITER`, wenn
   sie nach einer Wahl etwas aufklappt oder ein Textfeld hat, das nach der Wahl noch fehlt.
4. **Die Strategie rät nicht.** Keine Rangfolge, kein Urteil über die Person; neue Texte laufen
   durch den Test auf Empfehlungs-Formulierungen.
5. **Die Kennzahlen einer Kaufprüfung rechnet nur `objektKennzahlen()`** (`lib/kauf/objektKennzahlen.ts`)
   — Objekt-Rechner und Demo-Kandidaten. Ein neues Eingabefeld des Rechners gehört auch in die
   Demo-Zeilen (der Test vergleicht die Feldliste mit `eingabenSnapshot()`).
6. **Die Krone steht in der Zeile „N Bestwerte“, nie vor dem Namen** — neben einem umbrochenen Namen
   rutschte sie an den linken Zellrand und sah aus, als gehöre sie zur Spalte davor (in der Demo gesehen).
7. **Der Rechner auf `/vergleich` darf am Handy nicht breiter werden als der Bildschirm:**
   Raster mit `minmax(0, 1fr)`, Felder mit `minWidth: 0` (im alten Fenster fiel das nie auf, auf der
   Seite schnitt es rechts ab — im Browser bei 390 px gesehen).

## Offen

| Punkt | Warum |
|---|---|
| Anwalt: § 34i GewO / Anlageberatung | Risiko 1 — vor dem öffentlichen Start |
| Strategie-Plan im Konto speichern | Risiko 4 — eigene Tabelle, Migration im SQL-Editor |
| Am echten Telefon prüfen | Lern-App-Weiter (Tempo 450 ms), Vergleichstabelle (waagerecht scrollbar) |
