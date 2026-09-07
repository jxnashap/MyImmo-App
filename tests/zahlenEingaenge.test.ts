import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// WO WIRD EINE NUTZEREINGABE ZUR ZAHL? — die Bestandsaufnahme vom 07.09.2026.
//
// In dieser Session sind vier echte Fehler gefunden worden, und DREI davon waren
// derselbe: eine von Hand gebaute Zahlenlesart an einem TEXTfeld.
//
//   · service.ts   „1.000"    → 1        (Handwerker-Betrag → Kosten-Buchung)
//   · bewerber.ts  „1200.50"  → 120050   (öffentlicher Steckbrief)
//   · zaehler.ts   „14.382,5" → 14,382   (Verbrauch → NK-Abrechnung des Mieters)
//
// Danach wurden ALLE Stellen durchgegangen, an denen eine Zeichenkette zur Zahl
// wird — Server-Actions und Oberfläche. Ergebnis: kein weiterer Fund. Die
// Begründung je Stelle steht unten in `ERLAUBT`.
//
// DIESE DATEI IST DER GRUND, WARUM DER DURCHGANG ETWAS WERT IST: Sie hält den
// geprüften Stand fest. Kommt eine NEUE handgebaute Zahlenlesart in
// `lib/actions/` dazu, wird dieser Test rot — und zwingt zu der Frage, die
// dreimal falsch beantwortet war: **Hängt das an einem Zahlen- oder an einem
// Textfeld?**
//
// ENTSCHEIDUNGSHILFE FÜR NEUE FÄLLE
//   `type="number"`   → der Browser liefert immer die Standardnotation;
//                       `Number(s.replace(",", "."))` ist dort unbedenklich.
//   Textfeld, Geld    → `zahlDe()` aus `lib/zahl.ts` (zwei Nachkommastellen).
//   Textfeld, 3+ NKS  → `zahlDe()` NICHT verwenden (Zählerstände, m³) —
//                       siehe `parseStand` in `lib/actions/zaehler.ts`.

const ORDNER = "lib/actions";

/**
 * Bekannte, geprüfte Stellen: Datei → Begründung, warum die handgebaute Lesart
 * dort in Ordnung ist. Wer hier etwas einträgt, muss die Feldart geprüft haben.
 */
const ERLAUBT: Record<string, string> = {
  "bewertung.ts": "alle Zahlenfelder sind type=number (Bewertungs-Formular)",
  "buchungen.ts": "Betrag/Beträge kommen aus type=number-Feldern",
  "mietzeitraeume.ts": "Miet-Zeiträume: type=number, step=0.01 (MietZeitraeume.tsx)",
  "nkco2.ts": "NkCo2Panel.tsx: alle drei Zahlenfelder sind type=number (07.09.2026 geprüft)",
  "positions.ts": "PositionsManager: alle Zahlenfelder type=number (07.09.2026 geprüft)",
  "properties.ts": "Objekt-Formular: type=number",
  "tenants.ts": "Mieter-Formular: type=number (staffel_intervall wird als Text gelesen)",
  "termine.ts": "parseInt auf vorlauf_tage — Ganzzahl aus einem Auswahlfeld, kein Trennzeichen möglich",
  "wiederkehr.ts": "Vorlagen-Formular: type=number bzw. hidden",
  "zaehler.ts": "eigener parseStand() — Zählerstände haben DREI Nachkommastellen, zahlDe() wäre hier falsch",
};

/** Handgebaute Zahlenlesart erkennen (ohne Kommentarzeilen). */
function fundstellen(quelle: string): string[] {
  return quelle
    .split("\n")
    .filter((z) => !z.trim().startsWith("*") && !z.trim().startsWith("//"))
    .filter((z) => /replace\(\s*","\s*,\s*"\."\s*\)|parseFloat\(|parseInt\(/.test(z))
    .map((z) => z.trim());
}

describe("Zahlen aus Nutzereingaben — der geprüfte Stand", () => {
  const dateien = readdirSync(ORDNER).filter((n) => n.endsWith(".ts"));

  it("keine NEUE handgebaute Zahlenlesart in lib/actions/", () => {
    const neu = dateien.filter((n) => fundstellen(readFileSync(join(ORDNER, n), "utf8")).length > 0 && !(n in ERLAUBT));
    // Wird dieser Test rot: NICHT einfach in ERLAUBT eintragen. Erst nachsehen,
    // ob das zugehörige Eingabefeld ein Zahlen- oder ein Textfeld ist — genau
    // diese Frage war in drei Fällen falsch beantwortet.
    expect(neu).toEqual([]);
  });

  it("die Liste enthält keine Karteileichen", () => {
    // Eine Begründung für eine Stelle, die es nicht mehr gibt, täuscht Prüfung vor.
    const ohneFund = Object.keys(ERLAUBT).filter(
      (n) => !dateien.includes(n) || fundstellen(readFileSync(join(ORDNER, n), "utf8")).length === 0,
    );
    expect(ohneFund).toEqual([]);
  });

  it("jede erlaubte Stelle hat eine echte Begründung, keinen Platzhalter", () => {
    for (const [datei, grund] of Object.entries(ERLAUBT)) {
      expect(grund.length, datei).toBeGreaterThan(25);
      expect(grund.toLowerCase(), datei).not.toMatch(/todo|tbd|später|unklar|vermutlich/);
    }
  });
});

describe("Die drei reparierten Stellen bleiben repariert", () => {
  it("service.ts und bewerber.ts benutzen zahlDe()", async () => {
    for (const datei of ["service.ts", "bewerber.ts"]) {
      const s = readFileSync(join(ORDNER, datei), "utf8");
      expect(s, datei).toContain('from "@/lib/zahl"');
      expect(s, datei).toContain("zahlDe(");
    }
  });

  it("zaehler.ts benutzt zahlDe ausdrücklich NICHT", async () => {
    // Der Test steht hier, damit niemand die Datei „zur Vereinheitlichung"
    // auf zahlDe umstellt: Bei Gas- und Wasserzählern (drei Nachkommastellen)
    // würde aus 5123,456 m³ die Zahl 5.123.456.
    const s = readFileSync(join(ORDNER, "zaehler.ts"), "utf8");
    expect(s).not.toMatch(/import\s*\{[^}]*zahlDe/);
    expect(s).toContain("parseStand");
  });

  it("zahlDe() liest beide Schreibweisen richtig", async () => {
    const { zahlDe } = await import("@/lib/zahl");
    const faelle: [string, number | null][] = [
      ["1.000", 1000],
      ["1.234,56", 1234.56],
      ["1234.56", 1234.56],
      ["12.345", 12345],
      ["0.500", 0.5], // führende Null: ein halber Euro, nicht 500
      ["89 €", 89],
    ];
    for (const [ein, aus] of faelle) expect(zahlDe(ein), ein).toBe(aus);
  });
});
