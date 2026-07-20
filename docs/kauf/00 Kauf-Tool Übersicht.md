# Kauf-Tool — Übersicht

> Rechercheergebnisse (8-Agenten-Workflow, 20.07.2026) und Roadmap für das
> Kauf-/Finanzierungs-Werkzeug. Rechtlicher Rahmen: **§ 34i GewO** (rechnen &
> sortieren, keine Empfehlung/Vermittlung) + **StBerG** (keine Steuerberatung).
> Verwandt: [[FINANZKONZEPT]] (Abschnitt B), [[MASTERPLAN]], [[BRIEFING]].

## Der Kunden-Fahrplan (Kurzfassung)

ImmoScout → 3–5 Objekte → einpflegen → bewerten → vergleichen (Krone) →
Selbstauskunft → **Makler-Ordner** + **Bank-Ordner** → Finanzierung (2 grafische
Vorschläge) → Förder-Check (KfW/BAFA). Volle Version: [[Kunden-Guide]].

## Deliverables (recherchiert, seriöse Quellen)
- [[Kunden-Guide]] — Schritt-für-Schritt vom Inserat zu zwei Ordnern.
- [[Makler-Ordner]] — 6 Kern-Dokumente + Datensparsamkeit.
- [[Bank-Ordner]] — Person (Bonität) + Objekt (Sicherheit), Maximalliste.
- [[KfW-Foerderung-2026]] — Förderprogramme + „kommt in Frage, wenn …"-Matching.

## Umsetzungs-Roadmap (Scheiben)

**Scheibe 1 (gebaut, dieser PR — reine UI/Anzeige, keine DB):**
- `ObjektRechner.tsx` entzerrt: 5 Pflichtfelder immer sichtbar, Maklercourtage &
  Bewirtschaftung im Ausklapp-Menü „Optional: Ergebnis verfeinern"; zusätzlich
  ein **Provisionsfrei-Schnellschalter** in den Kernwerten (setzt Maklersatz 0).
- `FoerderCheck.tsx`: neutrale § 34i-Einordnung über der Trefferliste.
- `lib/kauf/foerderung.ts`: KfW-308-Korrektur (EH 85 EE, Einzelmaßnahmen ab 03.08.2026).
- `KaufAssistent.tsx`: aufklappbarer 6-Schritte-Kurzguide über dem Stepper,
  Förder-Wording „in Frage kommende Programme".

**Folge-Scheiben (geplant, größer):**
2. **KfW-Matching-Anzeige** je Treffer „kommt laut deinen Angaben in Frage, wenn …"
   mit sichtbaren Bedingungen (read-only, keine neue Persistenz).
3. **Zwei grafische Finanzierungsvorschläge** — gestapelter Balken
   (Eigenkapital + Darlehen + evtl. Förderkredit/-zuschuss = Gesamtinvestition),
   Szenario „solide" vs. „liquiditätsschonend", **optisch gleichwertig** (kein
   „empfohlen"), Disclaimer direkt am Balken. Quelle: `lib/kauf/darlehen.ts` +
   Selbstauskunft-EK + Fördercheck. Kein neuer Datenweg.
4. **Makler-Ordner** (NEU, größte Entwicklung, fasst als einzige die DB an):
   `lib/makler.ts` + `components/MaklerOrdner.tsx` spiegelbildlich zum bereits
   vorhandenen `BeleihungsOrdner`/`lib/beleihung.ts` (Bank-Ordner existiert schon!),
   neue Tabelle `makler_dokumente` (RLS + base64, App-Layer-Verschlüsselung für
   SCHUFA/Einkommen/Ausweis). Bank-Ordner nur als „Ordner 2" einbinden.

## Wichtigste Risiken (aus der Kritik)
- § 34i: Finanzierungsvorschläge nie als „der bessere"/„empfohlen" framen → beide
  Szenarien gleichwertig, Disclaimer am Balken.
- Beispielzinsen klar als Beispiel kennzeichnen („echten Zins nennt die Bank").
- KfW/BAFA-Konditionen veralten → sichtbares Stand-Datum + „vor Antrag prüfen".
- **Antrag VOR Vorhabenbeginn** (Kauf = vor Notarvertrag) ist der häufigste
  Förder-Killer → früh und prominent zeigen.
- Makler-Ordner sammelt hochsensible Daten → RLS + Verschlüsselung + UI-Datensparsamkeit.
