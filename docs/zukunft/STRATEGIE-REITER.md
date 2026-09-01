# Strategie-Reiter — regelmäßig Immobilien erwerben

**Status:** Idee, notiert am 30.08.2026 (Nutzer). Nichts gebaut, nichts entschieden.

## Die Idee in einem Satz

Ein eigener Reiter, in dem ein Vermieter seine **Ankaufsstrategie** aufbaut und verfolgt:
Wann ist das nächste Objekt realistisch finanzierbar, was muss bis dahin passieren, und wie
weit ist er auf dem Weg dorthin?

Damit verschiebt sich der Charakter der App: Bisher **verwaltet** sie Bestand. Ein
Strategie-Reiter würde sie zum Werkzeug für **Wachstum** — das ist ein anderes Versprechen,
mit anderen Erwartungen und anderer Haftung.

---

## ⚠️ Risiken zuerst

### 1. Die Grenze zur Anlageberatung — das größte Thema
Eine Verwaltungssoftware sagt: „Deine Restschuld beträgt X." Ein Strategie-Reiter sagt
schnell: „Im März 2028 kannst du das nächste Objekt kaufen." Der zweite Satz ist eine
**Empfehlung zu einer Vermögensdisposition**.

Das ist derselbe Konflikt, der beim Finanzierungs-Assistenten schon bearbeitet wurde: Dort
wurde das Wording bereits neutralisiert und „Empfehlung" entfernt, und **§ 34i GewO steht
auf der Anwaltsliste** (`docs/compliance/AVV-STATUS.md`). Ein Strategie-Modul ist seiner
Natur nach beratender als alles bisher Gebaute.

**Konsequenz für den Entwurf:** Die Software rechnet und zeigt, sie rät nicht. Kein
„empfohlen", kein „du solltest", kein Ampel-Urteil über eine Kaufentscheidung. Stattdessen:
„Bei diesen Annahmen ergibt sich …" plus die Annahmen sichtbar daneben.

**Vor dem Bau zwingend anwaltlich klären** — zusammen mit § 34i und StBerG, nicht danach.
Ein fertiges Feature, das nachträglich umgeschrieben werden muss, ist teurer als eine Frage
vorab.

### 2. Scheingenauigkeit
Eine Prognose über zehn Jahre hängt an Zins, Mietentwicklung, Wertentwicklung und
Instandhaltung. Vier Unbekannte, multiplikativ. Eine Zahl wie „nächster Ankauf: 03/2028"
wirkt präzise und ist es nicht.

**Konsequenz:** Keine Punktprognose. Szenarien (vorsichtig / erwartet / günstig) oder eine
Spanne — und die Annahme, die das Ergebnis am stärksten bewegt, sichtbar an erster Stelle.
Lieber „zwischen Ende 2027 und Mitte 2029, am stärksten abhängig vom Zinsniveau" als ein
scharfes Datum.

### 3. Scope-Falle
Der Reiter berührt fast jedes vorhandene Modul: Cashflow, Kredite, Objektwerte, Beleihung,
Kauf-Assistent, Steuer. Genau solche Features werden nie fertig, weil sich immer noch etwas
anschließen lässt. Ohne eine harte erste Version mit klarer Grenze besser gar nicht anfangen.

### 4. Zielgruppe kleiner als der Bestand
MyImmo richtet sich an Privatvermieter mit wenigen Einheiten. Ein nennenswerter Teil davon
will **nicht** regelmäßig erwerben — geerbt, eine Wohnung, fertig. Der Reiter darf für die
nicht im Weg stehen (Navigation, Onboarding), sonst kostet er bei der Mehrheit Aufmerksamkeit
und bringt nichts.

---

## Was dafür spricht

- **Die Daten liegen schon da.** Der Reiter müsste wenig neu erheben, vor allem verknüpfen:

  | Baustein | Woher |
  |---|---|
  | Cashflow-Überschuss je Monat | `/cashflow`, `einnahmen` + `kosten` |
  | Restschuld, Zinsbindung, Volltilgung | `kredite`, `lib/kalk.ts` (monatlich gerechnet, gegen die Annuitätenformel geprüft) |
  | Objektwerte, Beleihungsauslauf | `properties.wert`, `bewertung_historie`, Beleihungsordner |
  | Kapitaldienstfähigkeit, Eigenkapital | Selbstauskunft aus dem Kauf-Assistenten |
  | Kaufnebenkosten je Bundesland | `components/kauf/ObjektRechner.tsx` |
  | Fördermittel | KfW-Logik, Stand 08/2026 |

- **Es ist der natürliche nächste Schritt nach dem Kauf-Assistenten.** Der beantwortet
  „lohnt sich *dieses* Objekt?". Offen bleibt „wann ist das *nächste* dran?".
- **Bindung.** Wer eine Strategie in der App führt, kommt monatlich wieder — nicht nur zur
  Nebenkostenabrechnung einmal im Jahr.

---

## Möglicher Inhalt — bewusst als Diskussionsgrundlage

**Stufe 1 (die kleinste sinnvolle Version):**
- Ein Ziel: „nächster Ankauf" mit Kaufpreisrahmen und Eigenkapitalbedarf
- Ist-Stand: verfügbares Eigenkapital, monatlicher Überschuss, freier Kapitaldienst
- Ein Balken: wie weit bin ich, und was fehlt in Euro
- Die drei Annahmen daneben, änderbar

**Stufe 2:**
- Zeitachse mit Zinsbindungs-Enden und Volltilgungspunkten je Kredit — die Termine, an denen
  sich die Finanzierungslage real ändert
- Beleihungsauslauf über alle Objekte (Beleihungsspielraum als Eigenkapitalquelle)
- Szenarien statt einer Zahl

**Stufe 3 (offen, ob sinnvoll):**
- Zielportfolio (Einheiten, Mieteinnahmen, Cashflow) mit Weg dorthin
- Verknüpfung mit dem Kauf-Assistenten: gefundenes Objekt gegen die Strategie prüfen

---

## Vor dem Bau zu klären

1. **Anwaltliche Freigabe** — § 34i GewO und die Abgrenzung zur Anlageberatung. Zusammen mit
   den bereits offenen Punkten, nicht separat.
2. **Kostenlos oder Tarifmerkmal?** Ein Wachstumswerkzeug ist ein plausibles Argument für den
   höheren Tarif — das gehört ins `docs/FINANZKONZEPT.md`, bevor gebaut wird
   (**Regel aus `CLAUDE.md`:** Änderungen am Geschäftsmodell im selben PR nachziehen).
3. **Wie ehrlich mit Unsicherheit?** Szenarien sind fachlich richtig und erklärungsbedürftig.
   Eine einzelne Zahl ist verständlich und irreführend. Das ist eine Produktentscheidung.
4. **Wo im Menü?** Die Navigation hat bereits rund 25 Einträge. Ein weiterer Reiter ist nicht
   gratis.

---

## Verwandte Dokumente
- [[FINANZKONZEPT]] — Finanzierungs-Assistent, Tarife, § 34i-Wording
- [[00 Kauf-Tool Übersicht]] — der Assistent, auf dem das aufsetzen würde
- [[MASTERPLAN]] — Roadmap-Einordnung
- [[OPEN-BANKING]] — anderes Zukunftsprojekt, gleiche Ablageform
