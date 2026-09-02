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
| **Grunderwerbsteuer je Bundesland** | `lib/kalk.ts` (`BUNDESLAENDER`) | Landesgesetze | 26.08.2026 | halbjährlich | **01.03.2027** |
| **KfW-308-Konditionen** | `lib/kauf/foerderung.ts`, `docs/kauf/KfW-Foerderung-2026.md`, `tests/foerderung.test.ts` | kfw.de Produktseite | offen | **fällig seit 03.08.2026** | **überfällig** |
| **Fernablesepflicht / § 5 HeizkostenV** | `lib/ratgeber.ts` (Artikel `heizkostenabrechnung-…`) | HeizkostenV | — | einmalig | **ab 01.01.2027 entschärfen** |
| **§ 82b EStG, AfA-Sätze** | `lib/steuer/` | EStG | — | jährlich zum Steuerjahr | **01.02.2027** |
| **Notar-/Grundbuchpauschale (2 %)** | `lib/kalk.ts` | GNotKG, Marktüblichkeit | 26.08.2026 | jährlich | **01.09.2027** |
| **Maklerprovision (3,57 % Käuferanteil)** | `lib/kalk.ts` | Marktüblichkeit, Teilungsgebot | 26.08.2026 | jährlich | **01.09.2027** |

## Anbieter / Verträge

| Punkt | Stand | Geprüft | Intervall | Nächste Prüfung |
|---|---|---|---|---|
| **Brevo-AVV** (Anlage 2 der ToS) | ⏳ offen — Firmendaten im Konto anpassen, PDF archivieren | 31.07.2026 | bis erledigt: monatlich | **fällig** |
| **Supabase-DPA** | ✅ signiert (PandaDoc) | 24.07.2026 | jährlich | 24.07.2027 |
| **Vercel-AVV** | ✅ automatisch über ToS (Pro) | 29.07.2026 | bei Plan-Wechsel | — |
| **Anthropic-DPA** | ✅ archiviert, **SCC, kein DPF** | 15.07.2026 | jährlich | 15.07.2027 |
| **Enable Banking** (AISP) | Vertrag + AVV offen, Sandbox ungetestet | 31.07.2026 | quartalsweise | **01.10.2026** |
| **Anbieter existiert noch?** | GoCardless/Nordigen ist weggefallen | 12.07.2026 | halbjährlich | **01.01.2027** |

## Eigene Einstellungen, die nachweislich nicht greifen

| Punkt | Befund | Geprüft | Nächste Prüfung |
|---|---|---|---|
| **Supabase Mindest-Passwortlänge** | steht auf 6, App verlangt 8 — „abc123" wurde angenommen | 31.07.2026 | **fällig** |
| **Leaked Password Protection** | Schalter sichtbar, aber wirkungslos ohne Pro | 29.07.2026 | bei Plan-Wechsel |
| **`NEXT_PUBLIC_BETA_CODE`** | nicht gesetzt (10 Bundles, 629 KB durchsucht) | 27.08.2026 | halbjährlich → **01.03.2027** |

## Preise und Pläne (verändern die Kalkulation)

| Posten | Stand | Geprüft | Nächste Prüfung |
|---|---|---|---|
| Vercel Pro | aktiv | 29.07.2026 | jährlich |
| Supabase Pro (~25 $/Monat) | nicht gebucht | 29.07.2026 | bei Bedarf |
| Apple Developer (99 $/Jahr) | nicht gebucht | — | vor App-Store-Launch |
| Enable Banking je Konto/Monat | unbekannt | — | mit Vertrag |

## Marktdaten (Beispiel- und Schulungszahlen)

| Größe | Wert | Quelle | Geprüft | Intervall |
|---|---|---|---|---|
| Lübeck ETW ⌀ | ~3.559 €/m² (Spanne 2.407–4.712) | Portalauswertungen | 26.08.2026 | halbjährlich |
| Lübeck Häuser ⌀ | ~3.163 €/m² | dito | 26.08.2026 | halbjährlich |
| Lübeck Kaltmiete ⌀ | ~11,04 €/m² (einfache Lagen 9,87) | dito | 26.08.2026 | halbjährlich |
| Beispiel-Sollzins | 3,80 % p. a. | Marktüblichkeit | 26.08.2026 | **quartalsweise** |

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
