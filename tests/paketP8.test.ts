// Gesamtprüfung P8 (09.10.2026): Portfolio-Kennzahlen.
// B24 eine Rendite · B25 Kostenschnitt je Objekt · B26 ein Wert · C17 einheitlich runden ·
// C15 Berliner Stichtag · C16 Objekt-Check · B28 Jahresbericht-PDF unterjährig · B27 Demo-Daten.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pdfZeilen } from "./stubs/pdfText";
import { aktuellerWert, bruttoRendite, bruttoRenditePortfolio, renditeBasisText } from "@/lib/portfolioKennzahlen";
import { objektMonat, portfolioMonat, cashflowFormel, type Buchung, type KostenBuchung } from "@/lib/cashflowKennzahl";
import { portfolioWertReihe } from "@/lib/wert/verlauf";
import { sortiereObjekte } from "@/lib/objektSortierung";
import { objektCheck } from "@/lib/objektCheck";
import { berichtMonate, unterjaehrigText } from "@/lib/jahresberichtZeile";
import { zeitstempelBerlin } from "@/lib/zeitraum";

const lies = (p: string) => readFileSync(p, "utf8");

/** Buchungen am 1. jedes Monats von `von` bis `bis` ("YYYY-MM"). */
function monatlich(von: string, bis: string, betrag: number, kategorie = "Hausgeld / WEG"): KostenBuchung[] {
  const [vj, vm] = von.split("-").map(Number);
  const [bj, bm] = bis.split("-").map(Number);
  const out: KostenBuchung[] = [];
  for (let i = vj * 12 + vm - 1; i <= bj * 12 + bm - 1; i++) {
    out.push({ buchungsdatum: `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, betrag, kategorie });
  }
  return out;
}

describe("B24 — eine Rendite für dasselbe Objekt", () => {
  // Leipzig Süd aus dem Audit: 880 € kalt, Kaufpreis 245.000 €, Wert 289.000 €.
  const sued = { kaufpreis: 245000, wert: 289000 };

  it("auf den Kaufpreis: 880 × 12 / 245.000 = 4,31 % (vorher Liste 3,65 % auf den Wert)", () => {
    const r = bruttoRendite(sued, 880)!;
    expect(r.basis).toBe("kaufpreis");
    expect(r.prozent).toBeCloseTo(4.31, 2);
  });

  it("ohne Kaufpreis auf den Wert, ohne beides keine Zahl, ohne Miete keine Zahl", () => {
    expect(bruttoRendite({ kaufpreis: null, wert: 240000 }, 1000)).toEqual({ prozent: 5, basis: "wert" });
    expect(bruttoRendite({ kaufpreis: null, wert: null }, 1000)).toBeNull();
    expect(bruttoRendite(sued, 0)).toBeNull();
  });

  it("Portfolio: Σ Jahreskaltmiete / Σ Kaufpreis — 71.160 / 1.643.000 = 4,33 %", () => {
    const r = bruttoRenditePortfolio([
      { kaufpreis: 1000000, wert: 1200000, obj_status: "Vermietet", kaltmieteMonat: 4000 },
      { kaufpreis: 643000, wert: 700000, obj_status: "Vermietet", kaltmieteMonat: 1930 },
    ])!;
    expect(r.prozent).toBeCloseTo((71160 / 1643000) * 100, 6);
    expect(r.basis).toBe("kaufpreis");
  });

  it("„Selbst bewohnt“ verdünnt die Rendite nicht; Leerstand schon", () => {
    const vermietet = { kaufpreis: 200000, wert: null, obj_status: "Vermietet", kaltmieteMonat: 1000 };
    const selbst = { kaufpreis: 300000, wert: null, obj_status: "Selbst bewohnt", kaltmieteMonat: 0 };
    const leer = { kaufpreis: 100000, wert: null, obj_status: "Leer", kaltmieteMonat: 0 };
    expect(bruttoRenditePortfolio([vermietet, selbst])!.prozent).toBeCloseTo(6, 6);
    expect(bruttoRenditePortfolio([vermietet, leer])!.prozent).toBeCloseTo(4, 6);
  });

  it("gemischte Basis wird benannt", () => {
    const r = bruttoRenditePortfolio([
      { kaufpreis: 200000, wert: null, kaltmieteMonat: 1000 },
      { kaufpreis: null, wert: 100000, kaltmieteMonat: 500 },
    ])!;
    expect(r.basis).toBe("gemischt");
    expect(renditeBasisText(r.basis)).toBe("auf Kaufpreis (teils Wert)");
    expect(renditeBasisText("kaufpreis")).toBe("auf Kaufpreis");
  });

  it("die Sortierung „Rendite“ folgt derselben Zahl wie die Anzeige", () => {
    // A: 6 % auf den Kaufpreis, 4 % auf den Wert · B: 5 % auf den Kaufpreis, 5 % auf den Wert.
    const a = { bezeichnung: "A", kaufpreis: 200000, wert: 300000, miete: 1000 };
    const b = { bezeichnung: "B", kaufpreis: 240000, wert: 240000, miete: 1000 };
    expect(sortiereObjekte([b, a], "rendite_desc").map((o) => o.bezeichnung)).toEqual(["A", "B"]);
  });

  it("Liste, Objektseite und Dashboard rufen die gemeinsame Regel", () => {
    expect(lies("app/(app)/properties/page.tsx")).toMatch(/const rendite = bruttoRendite\(p, p\.miete\);/);
    expect(lies("app/(app)/properties/page.tsx")).not.toMatch(/\(p\.miete \* 12\) \/ wert/);
    expect(lies("app/(app)/properties/[id]/page.tsx")).toMatch(/bruttoRendite\(p, miete\)/);
    // Dashboard gibt Kaufpreis UND Wert je Objekt weiter (Basis Kaufpreis) und die Soll-Kaltmiete.
    expect(lies("app/(app)/page.tsx")).toMatch(/bruttoRenditePortfolio\(\s*properties\.map\(\(p\) => \(\{ kaufpreis: p\.kaufpreis, wert: p\.wert, obj_status: p\.obj_status, kaltmieteMonat: sollJeObjekt\.get\(p\.id\) \?\? 0 \}\)\)/);
    expect(lies("app/(app)/page.tsx")).not.toMatch(/\/ totalWert\)/);
  });
});

describe("B26 — ein Wert: gepflegt, sonst Kaufpreis", () => {
  it("aktuellerWert", () => {
    expect(aktuellerWert({ wert: 300000, kaufpreis: 250000 })).toBe(300000);
    expect(aktuellerWert({ wert: null, kaufpreis: 200000 })).toBe(200000);
    expect(aktuellerWert({ wert: 0, kaufpreis: 200000 })).toBe(200000);
    expect(aktuellerWert({ wert: null, kaufpreis: null })).toBeNull();
  });

  it("Kachel = letzter Punkt der Wertkurve (auch für Objekte ohne Wert und ohne Kaufdatum)", () => {
    const objekte = [
      { wert: 300000, kaufpreis: 250000, kaufdatum: "2019-01-01" },
      { wert: null, kaufpreis: 200000, kaufdatum: "2021-05-01" },
      { wert: null, kaufpreis: 150000, kaufdatum: null },
    ];
    const kachel = objekte.reduce((s, p) => s + (aktuellerWert(p) ?? 0), 0);
    const kurve = portfolioWertReihe(objekte.map((p) => ({
      kaufpreis: p.kaufpreis, kaufdatum: p.kaufdatum, aktuellerWert: aktuellerWert(p), heute: "2026-10-09",
    })));
    expect(kachel).toBe(650000);
    expect(kurve[kurve.length - 1].marktwert).toBe(kachel);
  });

  it("Dashboard, Objektseite, Liste und Sortierung nehmen aktuellerWert()", () => {
    const dash = lies("app/(app)/page.tsx");
    expect(dash).toMatch(/const totalWert = properties\.reduce\(\(s, p\) => s \+ \(aktuellerWert\(p\) \?\? 0\), 0\);/);
    expect(dash).toMatch(/aktuellerWert: aktuellerWert\(p\),/);
    expect(lies("app/(app)/properties/[id]/page.tsx")).toMatch(/const wert = aktuellerWert\(p\) \?\? 0;/);
    expect(lies("app/(app)/properties/page.tsx")).toMatch(/const wert = aktuellerWert\(p\) \?\? 0;/);
    expect(lies("lib/objektSortierung.ts")).toMatch(/const wertVon = \(p: SortObjekt\) => aktuellerWert\(p\) \?\? 0;/);
  });
});

describe("B25 + C17 — je Objekt rechnen, das Dashboard summiert", () => {
  const H = "2026-10-09";

  it("Zukauf: 100 €/Monat seit einem Jahr + 300 €/Monat seit August = 400 € (vorher 175 €)", () => {
    const a = objektMonat({ kaltmiete: 0, nk: 0, raten: 0, kosten: monatlich("2025-11", "2026-10", 100), einnahmen: [], heuteIso: H });
    const b = objektMonat({ kaltmiete: 0, nk: 0, raten: 0, kosten: monatlich("2026-08", "2026-10", 300), einnahmen: [], heuteIso: H });
    const p = portfolioMonat([a, b]);
    expect(a.kosten).toBe(100);
    expect(b.kosten).toBe(300);
    expect(p.kosten).toBe(400);
    expect(p.schnitt).toEqual({ betrag: 400, monate: 12, monateMin: 3 });
    expect(cashflowFormel(p.schnitt)).toBe("Warmmiete − Kreditraten − Ø Kosten (je Objekt 3–12 Monate)");
  });

  it("gleiche Fenster: keine Spanne in der Formel", () => {
    const a = objektMonat({ kaltmiete: 0, nk: 0, raten: 0, kosten: monatlich("2025-11", "2026-10", 100), einnahmen: [], heuteIso: H });
    const p = portfolioMonat([a, a]);
    expect(p.schnitt.monateMin).toBeUndefined();
    expect(cashflowFormel(p.schnitt)).toBe("Warmmiete − Kreditraten − Ø Kosten (12 Monate)");
  });

  it("jeder Teil ganze Euro je Objekt — Σ Objektseiten = Dashboard, und Warmmiete − Kosten = Cashflow", () => {
    // Drei Objekte mit 307,40 € Ø-Kosten: je Objekt 307 €, Summe 921 € (gerundet über alles wären es 922 €).
    const teile = [0, 1, 2].map((i) =>
      objektMonat({
        kaltmiete: 880.4 + i, nk: 160.3, raten: 890.45,
        kosten: monatlich("2025-11", "2026-10", 307.4), einnahmen: [], heuteIso: H,
      }),
    );
    const p = portfolioMonat(teile);
    expect(teile.map((t) => t.kosten)).toEqual([307, 307, 307]);
    expect(p.kosten).toBe(921);
    expect(p.cashflow).toBe(teile.reduce((s, t) => s + t.cashflow, 0));
    expect(p.warmmiete - (p.raten + p.kosten)).toBe(p.cashflow);
    for (const t of teile) for (const v of [t.kaltmiete, t.nk, t.raten, t.kosten, t.cashflow]) expect(Number.isInteger(v)).toBe(true);
  });

  it("Schuldzinsen-Buchungen zählen nicht als laufende Kosten (stecken in der Rate)", () => {
    const t = objektMonat({
      kaltmiete: 1000, nk: 0, raten: 500,
      kosten: [...monatlich("2025-11", "2026-10", 100), ...monatlich("2025-11", "2026-10", 300, "Schuldzinsen")],
      einnahmen: [], heuteIso: H,
    });
    expect(t.kosten).toBe(100);
    expect(t.cashflow).toBe(400);
  });

  it("Posten ohne Objekt: Fenster über alle Buchungen", () => {
    const alle: Buchung[] = monatlich("2025-11", "2026-10", 1000, "Miete");
    const ohne = objektMonat({ kaltmiete: 0, nk: 0, raten: 200, kosten: [{ buchungsdatum: "2026-10-01", betrag: 120, kategorie: "Verwaltung" }], einnahmen: alle, heuteIso: H });
    expect(ohne.schnitt.monate).toBe(12);
    expect(ohne.kosten).toBe(10);
    expect(ohne.cashflow).toBe(-210);
  });

  it("Dashboard: je Objekt objektMonat, dazu der Posten ohne Objekt; die Objektseite dieselbe Funktion", () => {
    const dash = lies("app/(app)/page.tsx");
    expect(dash).toMatch(/const monat = portfolioMonat\(\[\s*\.\.\.properties\.map\(\(p\) => objektMonat\(\{/);
    expect(dash).toMatch(/kosten: kosten\.filter\(\(k\) => k\.prop_id === p\.id\),\s*einnahmen: einnahmen\.filter\(\(e\) => e\.prop_id === p\.id\),/);
    expect(dash).toMatch(/kosten: kosten\.filter\(\(k\) => !mitObjekt\(k\.prop_id\)\),\s*einnahmen: \[\.\.\.einnahmen, \.\.\.kosten\],/);
    expect(dash).not.toMatch(/Math\.round\(kostenSchnitt\.betrag\)/);
    const obj = lies("app/(app)/properties/[id]/page.tsx");
    expect(obj).toMatch(/const monat = objektMonat\(\{/);
    expect(obj).toMatch(/heuteIso,\s*\}\);/);
  });
});

describe("C15 — Stichtag in Europe/Berlin", () => {
  /** Alle Seiten und Routen unter app/. */
  function dateien(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /(^|\/)(page\.tsx|route\.ts|layout\.tsx)$/.test(f))
      .map((f) => join(dir, f));
  }
  const MUSTER = [
    /toISOString\(\)\.slice\(0, ?(7|10)\)/,
    /toISOString\(\)\.split\("T"\)/,
    /new Date\(\)\.(getFullYear|getMonth|getDate)\(/,
    /\b(heute|jetzt|now)\.(getFullYear|getMonth|getDate)\(/,
  ];

  it("keine Seite und keine Route rechnet „heute“ in UTC oder Serverzeit", () => {
    const alle = dateien("app");
    expect(alle.length).toBeGreaterThan(100); // der Wächter hat wirklich gesucht
    const funde: string[] = [];
    for (const f of alle) {
      lies(f).split("\n").forEach((z, i) => {
        if (/^\s*(\/\/|\*)/.test(z)) return;
        if (MUSTER.some((m) => m.test(z))) funde.push(`${f}:${i + 1}: ${z.trim()}`);
      });
    }
    expect(funde).toEqual([]);
  });

  it("der Wächter erkennt die alten Schreibweisen", () => {
    const alt = [
      "const heute = new Date().toISOString().slice(0, 10);",
      'const h = new Date().toISOString().split("T")[0];',
      "const j = new Date().getFullYear();",
      "const m = heute.getMonth() + 1;",
    ];
    for (const z of alt) expect(MUSTER.some((m) => m.test(z)), z).toBe(true);
  });

  it("Zeitstempel für Exporte in Berliner Ortszeit (Silvester 23:30 UTC = Neujahr 00:30)", () => {
    expect(zeitstempelBerlin(new Date("2026-12-31T23:30:00Z"))).toBe("20270101003000");
    expect(zeitstempelBerlin(new Date("2026-07-01T10:05:09Z"))).toBe("20260701120509");
  });
});

describe("C16 — Objekt-Check", () => {
  const H = "2026-10-09";
  const basis = { id: "o1", adresse: "Weg 1", kaufpreis: 100000, kaufdatum: "2020-01-01" };

  it("ein Grundstück mit Adresse, Kaufpreis und Kaufdatum ist vollständig", () => {
    const c = objektCheck({ ...basis, typ: "Grundstück", obj_status: "Leer" }, [], [], H);
    expect([c.erfuellt, c.gesamt]).toEqual([3, 3]);
  });

  it("ein Mieter, der erst einzieht, macht das Objekt nicht „vermietet“ — angelegt ist er trotzdem", () => {
    const kommt = { id: "m1", prop_id: "o1", mietbeginn: "2026-11-01", mietende: null };
    const leer = objektCheck({ ...basis, typ: "Eigentumswohnung", flaeche: 60, baujahr: 1990, afa_gebaeudeanteil: 80, obj_status: "Leer" }, [kommt], [], H);
    expect(leer.punkte.some((p) => p.schluessel === "mieter")).toBe(false);
    const vermietet = objektCheck({ ...basis, typ: "Eigentumswohnung", obj_status: "Vermietet" }, [kommt], [], H);
    expect(vermietet.punkte.find((p) => p.schluessel === "mieter")!.erfuellt).toBe(true);
  });
});

describe("B28 — Jahresbericht: Zeitraum im PDF wie auf der Seite", () => {
  it("Monate und Text", () => {
    expect(berichtMonate(2026, "2026-10-09")).toBe(10);
    expect(berichtMonate(2025, "2026-10-09")).toBe(12);
    expect(berichtMonate(2027, "2026-10-09")).toBe(12);
    expect(unterjaehrigText(2026, 10)).toBe("Zeitraum Januar–Oktober 2026 · unterjährig, Zins und Tilgung anteilig");
    expect(unterjaehrigText(2026, 1)).toBe("Zeitraum Januar 2026 · unterjährig, Zins und Tilgung anteilig");
    expect(unterjaehrigText(2025, 12)).toBeNull();
  });

  it("das PDF des laufenden Jahres nennt den Zeitraum, ein volles Jahr nicht", async () => {
    const { buildJahresberichtPdf } = await import("@/lib/pdf/berichtPdf");
    const zeile = { name: "Objekt", einnahmen: 10000, bewirtschaftung: 2000, zins: 1000, tilgung: 500, cashflow: 6500 };
    const absender = { name: "Max Muster", adresse: null, email: null };
    // WinAnsi-Gedankenstrich (0x96) liest der Test-Leser als \u0096.
    const lauf = pdfZeilen(await buildJahresberichtPdf(2026, [zeile], absender, { zeitraum: unterjaehrigText(2026, 10) }))
      .map((l) => l.replace(/\u0096/g, "–"));
    expect(lauf).toContain("Zeitraum Januar–Oktober 2026 · unterjährig, Zins und Tilgung anteilig");
    const voll = pdfZeilen(await buildJahresberichtPdf(2025, [zeile], absender, { zeitraum: unterjaehrigText(2025, 12) }));
    expect(voll.some((z) => z.includes("unterjährig"))).toBe(false);
  });

  it("Seite und Route nehmen dieselben Helfer und das Berliner Datum", () => {
    for (const f of ["app/(app)/jahresbericht/page.tsx", "app/api/berichte/jahresbericht/route.ts"]) {
      const q = lies(f);
      expect(q, f).toMatch(/berichtMonate\((year|jahr), heuteIso\)/);
      expect(q, f).toMatch(/unterjaehrigText\((year|jahr), monate\)/);
      expect(q, f).toMatch(/heuteBerlin\(\)/);
    }
    expect(lies("app/api/berichte/jahresbericht/route.ts")).toMatch(/\{ zeitraum: unterjaehrigText\(jahr, monate\) \}/);
  });
});

describe("B27 — Demo-Daten", () => {
  const sql = lies("supabase/migrations/20261009100000_demo_kosten_zinsen.sql");

  it("ohne Lösch- oder Entfernen-Befehle (Bestätigungsdialog), Aufruf nur für die Service-Role", () => {
    expect(sql).not.toMatch(/\b(delete|drop|truncate)\b/i);
    expect(sql).toMatch(/revoke execute on function public\.demo_zinsen_fortschreiben\(date\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.demo_zinsen_fortschreiben\(date\) to service_role/);
  });

  it("Jahreskosten je Jahr einmal, Hausgeld je Monat; Zinsen fallen weiter (nie steigen)", () => {
    expect(sql).toMatch(/'Versicherung', 'Grundsteuer', 'Müll', 'Straßenreinigung', 'Gartenpflege', 'Hausgeld \/ WEG'/);
    expect(sql).toMatch(/greatest\(b\.vorjahr - b\.letzter, 0\)/);
    expect(sql).toMatch(/set kaufdatum = date '2024-12-01'/);
  });

  it("/api/demo setzt die Zinsen nach Reset und Nebenkosten", () => {
    const r = lies("app/api/demo/route.ts");
    expect(r.indexOf('rpc("demo_zinsen_fortschreiben")')).toBeGreaterThan(r.indexOf('rpc("demo_nk_nachfuellen")'));
    expect(r.indexOf('rpc("demo_nk_nachfuellen")')).toBeGreaterThan(r.indexOf('rpc("demo_zuruecksetzen")'));
  });
});
