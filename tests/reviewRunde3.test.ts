import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { wertzuwachsGgKaufpreis, portfolioWertReihe, veraenderungProzent } from "@/lib/wert/verlauf";
import { laufendeKosten, kostenSchnittMonat, monatsCashflow } from "@/lib/cashflowKennzahl";
import { jahresZeile } from "@/lib/jahresberichtZeile";

// Dritte Review-Runde (30.09.2026).

// Die sechs Demo-Objekte (Kaufpreis, heutiger Wert, Kaufdatum).
const DEMO = [
  { kaufpreis: 245000, aktuellerWert: 289000, kaufdatum: "2021-03-15" },
  { kaufpreis: 268000, aktuellerWert: 305000, kaufdatum: "2020-12-01" },
  { kaufpreis: 185000, aktuellerWert: 205000, kaufdatum: "2025-02-01" },
  { kaufpreis: 320000, aktuellerWert: 335000, kaufdatum: "2023-08-15" },
  { kaufpreis: 410000, aktuellerWert: 465000, kaufdatum: "2019-06-01" },
  { kaufpreis: 215000, aktuellerWert: 239000, kaufdatum: "2017-10-01" },
];

describe("„seit Anschaffung“: Zukäufe sind kein Wertzuwachs", () => {
  it("die alte Rechnung ergab für die Demo +754,9 % — das war der Fehler", () => {
    const reihe = portfolioWertReihe(DEMO.map((o) => ({ ...o, heute: "2026-09-30" })));
    expect(veraenderungProzent(reihe)).toBe(754.9);
  });

  it("heutiger Wert gegen Kaufpreise: +11,9 %", () => {
    const r = wertzuwachsGgKaufpreis(DEMO)!;
    expect(r.kaufpreise).toBe(1643000);
    expect(r.wert).toBe(1838000);
    expect(r.prozent).toBe(11.9);
    expect(r.objekte).toBe(6);
  });

  it("ein Objekt ohne Kaufpreis bringt seinen Wert NICHT als Zuwachs ein", () => {
    const r = wertzuwachsGgKaufpreis([
      { kaufpreis: 100000, aktuellerWert: 110000 },
      { kaufpreis: null, aktuellerWert: 500000 },
      { kaufpreis: 200000, aktuellerWert: null },
    ])!;
    expect(r).toEqual({ prozent: 10, kaufpreise: 100000, wert: 110000, objekte: 1 });
  });

  it("ohne verwertbare Objekte keine Zahl", () => {
    expect(wertzuwachsGgKaufpreis([])).toBeNull();
    expect(wertzuwachsGgKaufpreis([{ kaufpreis: 0, aktuellerWert: 100 }])).toBeNull();
  });

  it("das Dashboard benutzt die neue Rechnung und sagt, wogegen es vergleicht", () => {
    const q = readFileSync("app/(app)/page.tsx", "utf8");
    expect(q).toMatch(/portfolioWertProzent = wertzuwachs\?\.prozent/);
    expect(q).not.toMatch(/veraenderungProzent\(portfolioWert\)/);
    expect(q).toContain("% ggü. Kaufpreis");
    expect(q).not.toContain("% seit Anschaffung");
  });
});

describe("Schuldzinsen werden nicht doppelt abgezogen", () => {
  const kosten = [
    { buchungsdatum: "2026-07-01", betrag: 300, kategorie: "Hausgeld / WEG" },
    { buchungsdatum: "2026-07-01", betrag: 800, kategorie: "Schuldzinsen" },
    { buchungsdatum: "2026-08-01", betrag: 300, kategorie: "Hausgeld / WEG" },
    { buchungsdatum: "2026-08-01", betrag: 800, kategorie: "Schuldzinsen" },
  ];

  it("laufendeKosten lässt nur die Schuldzinsen weg", () => {
    expect(laufendeKosten(kosten).map((k) => k.kategorie)).toEqual(["Hausgeld / WEG", "Hausgeld / WEG"]);
    expect(laufendeKosten([{ kategorie: null }, { kategorie: "Grundsteuer" }])).toHaveLength(2);
  });

  it("Monats-Cashflow: die Zinsen stecken schon in der Rate", () => {
    const schnitt = kostenSchnittMonat(laufendeKosten(kosten), kosten, "2026-08-15");
    expect(schnitt).toEqual({ betrag: 300, monate: 2 });
    // Rate 1.200 (davon 800 Zins) — Zins nicht ein zweites Mal abziehen.
    expect(monatsCashflow({ warmmiete: 2000, kreditraten: 1200, kostenSchnitt: schnitt.betrag })).toBe(500);
  });

  it("Dashboard und Objektseite filtern vor dem Schnitt", () => {
    for (const p of ["app/(app)/page.tsx", "app/(app)/properties/[id]/page.tsx"]) {
      expect(readFileSync(p, "utf8"), p).toMatch(/kostenSchnittMonat\(laufendeKosten\(kosten\), \[\.\.\.einnahmen, \.\.\.kosten\]/);
    }
  });
});

describe("Jahresbericht: Seite und PDF rechnen dasselbe", () => {
  const daten = {
    einnahmen: [{ prop_id: "a", buchungsdatum: "2025-03-01", betrag: 12000 }],
    kosten: [
      { prop_id: "a", buchungsdatum: "2025-03-01", betrag: 1200, kategorie: "Hausgeld / WEG" },
      // 2.800 gebucht — bewusst ≠ Schätzung 3.000, sonst ist „gebucht schlägt geschätzt" nicht prüfbar.
      { prop_id: "a", buchungsdatum: "2025-03-01", betrag: 2800, kategorie: "Schuldzinsen" },
      { prop_id: "b", buchungsdatum: "2025-03-01", betrag: 999, kategorie: "Hausgeld / WEG" },
      { prop_id: "a", buchungsdatum: "2024-03-01", betrag: 777, kategorie: "Hausgeld / WEG" },
    ],
    kredite: [{ prop_id: "a", restschuld: 100000, zinssatz: 3, monatsrate: 500 }],
  };

  it("gebuchte Zinsen: nicht in den laufenden Kosten, dafür als Zinsanteil", () => {
    const z = jahresZeile("a", 2025, 12, daten);
    expect(z).toEqual({ e: 12000, k: 1200, zins: 2800, zinsGeschaetzt: false, tilgung: 3200, cashflow: 4800 });
  });

  it("ohne gebuchte Zinsen: geschätzt und so gekennzeichnet", () => {
    const z = jahresZeile("a", 2025, 12, { ...daten, kosten: daten.kosten.filter((k) => k.kategorie !== "Schuldzinsen") });
    expect(z.zins).toBe(3000); // 100.000 × 3 % aus der heutigen Restschuld
    expect(z.zinsGeschaetzt).toBe(true);
    expect(z.cashflow).toBe(4800);
  });

  it("beide Stellen rufen die gemeinsame Funktion, keine rechnet selbst", () => {
    const seite = readFileSync("app/(app)/jahresbericht/page.tsx", "utf8");
    const pdf = readFileSync("app/api/berichte/jahresbericht/route.ts", "utf8");
    for (const [n, q] of [["Seite", seite], ["PDF", pdf]] as const) {
      expect(q, n).toMatch(/jahresZeile\(p\.id, /);
      expect(q, n).not.toMatch(/monatsrate \?\? 0\) \* monate/);
    }
  });
});

describe("Dashboard-Kacheln lassen sich nachrechnen", () => {
  const q = readFileSync("app/(app)/page.tsx", "utf8");
  it("die Einnahmen-Kachel zeigt die Warmmiete, mit der der Cashflow rechnet", () => {
    // Seit 03.10.2026 Felder einer Leiste (span statt div).
    expect(q).toMatch(/kpi-label">Warmmiete \/ Mo\.<\/span>\s*<span className="kpi-value">\{euro\(warmmiete\)\}/);
    expect(q).not.toMatch(/kpi-label">Kaltmiete \/ Mo\./);
  });
  it("Kosten-Kachel = Kreditraten + Ø Kosten, Cashflow = Warmmiete − dieselben Teile", () => {
    expect(q).toMatch(/const totalKosten = kreditRates \+ monatKosten;/);
    expect(q).toMatch(/monatsCashflow\(\{ warmmiete, kreditraten: kreditRates, kostenSchnitt: monatKosten \}\)/);
    // Demo nach dieser Runde: Warmmiete − Kosten-Kachel = Cashflow.
    expect(monatsCashflow({ warmmiete: 6960, kreditraten: 4490, kostenSchnitt: 922 })).toBe(6960 - (4490 + 922));
  });
  it("die Rendite bleibt kalt", () => {
    expect(q).toMatch(/bruttoRendite = totalWert > 0 \? \(\(totalMiete \* 12\)/);
  });
});
