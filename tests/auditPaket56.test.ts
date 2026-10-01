// Audit 01.10.2026, Paket 5 (A4 Mieter-Sicht) und Paket 6 (Dashboard/Zahlen:
// A8 Aufgabenliste, A9 Restnutzungsdauer, A10 Stichtag Berlin, B24 Zeile mobil,
// B27 Leerzustände, C30 Staffelplan). Verhaltens-Tests wo es eine Funktion
// gibt, Struktur-Tests fuer Seiten und Migration.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { kreditFristen } from "@/lib/fristen";
import { marktwert, RND_MINDESTANTEIL, type MarktwertEingabe } from "@/lib/kauf/marktwert";
import { aggregate, heuteBerlin } from "@/lib/zeitraum";
import { GND_WOHNGEBAEUDE } from "@/lib/bewertung/immowertv";

const lies = (p: string) => readFileSync(p, "utf8");
const inTagen = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe("A8: Kredit-Fristen sind nur dringend, wenn sie anstehen", () => {
  it("Zinsbindung in fünf Jahren → info, Vorbereitung in vier Jahren → info", () => {
    const f = kreditFristen({ zinsbindung: inTagen(5 * 365) });
    expect(f.find((x) => x.label === "Zinsbindung endet")?.typ).toBe("info");
    expect(f.find((x) => x.label === "Anschlussfinanzierung vorbereiten")?.typ).toBe("info");
  });
  it("Zinsbindung in sechs Monaten → beide warn (die Vorbereitung ist überfällig)", () => {
    const f = kreditFristen({ zinsbindung: inTagen(180) });
    expect(f.find((x) => x.label === "Zinsbindung endet")?.typ).toBe("warn");
    expect(f.find((x) => x.label === "Anschlussfinanzierung vorbereiten")?.typ).toBe("warn");
  });
  it("Zinsbindung in 13 Monaten → Ende info, Vorbereitung (in einem Monat) warn", () => {
    const f = kreditFristen({ zinsbindung: inTagen(395) });
    expect(f.find((x) => x.label === "Zinsbindung endet")?.typ).toBe("info");
    expect(f.find((x) => x.label === "Anschlussfinanzierung vorbereiten")?.typ).toBe("warn");
  });
  it("Dashboard zählt ALLE Aufgaben in der Überschrift und zeigt die wichtigsten", () => {
    const src = lies("app/(app)/page.tsx");
    expect(src).toContain("const alleHeuteAufgaben = baueHeuteAufgaben(");
    expect(src).toMatch(/heuteISO0,\n\s+Infinity,/);
    expect(src).toContain("alleHeuteAufgaben.slice(0, HEUTE_ZEILEN)");
    expect(src).toContain("${alleHeuteAufgaben.length} ${alleHeuteAufgaben.length === 1");
  });
});

describe("A9: Restnutzungsdauer hat eine Untergrenze", () => {
  const basis: MarktwertEingabe = {
    nutzung: "vermietung", objektTyp: "wohnung", wohnflaeche: 72, kaltmieteMonat: 720, anzahlWohnungen: 1,
    grundFlaeche: 0, bodenrichtwert: 0, baujahr: 1911, gebTyp: "efh", ausstattung: 3, bpiFaktor: 1.9,
    regionalFaktor: 1, liegenschaftszins: 3.5, sachwertfaktor: 1,
  };
  it("Altbau 1911: mindestens 30 % der GND, Hinweis im Ergebnis, Wert in der Nähe des Kaufpreises statt 7.022 €", () => {
    const r = marktwert(basis);
    expect(r.restnutzungsdauer).toBe(Math.round(GND_WOHNGEBAEUDE * RND_MINDESTANTEIL));
    expect(r.unsicher.some((u) => u.startsWith("Restnutzungsdauer"))).toBe(true);
    expect(r.ergebnis!.wert).toBeGreaterThan(100_000);
  });
  it("Baujahr 1998: rechnerische RND bleibt, kein Hinweis", () => {
    const r = marktwert({ ...basis, baujahr: 1998 });
    expect(r.restnutzungsdauer).toBe(GND_WOHNGEBAEUDE - (new Date().getFullYear() - 1998));
    expect(r.unsicher.some((u) => u.startsWith("Restnutzungsdauer"))).toBe(false);
  });
});

describe("A10: EIN Stichtag in Europe/Berlin für Server und Browser", () => {
  it("heuteBerlin: 30.09. 23:30 UTC ist in Berlin schon der 1.10.", () => {
    expect(heuteBerlin(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01");
    expect(heuteBerlin(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07-15");
  });
  it("aggregate mit ISO-Stichtag endet im Monat des Stichtags — unabhängig von der Prozess-Zeitzone", () => {
    // Stichtag bewusst in einem ANDEREN Monat als dem des Testlaufs — sonst
    // bliebe ein Rückfall auf new Date() unentdeckt (Mutation M5).
    const a = aggregate([{ date: "2024-05-01", value: 500 }], "1J", "2024-05-01");
    expect(a.buckets[a.buckets.length - 1].date).toBe("2024-05-01");
    expect(a.buckets[a.buckets.length - 1].value).toBe(500);
  });
  it("BetragChart bekommt den Stichtag vom Server und ruft kein new Date()", () => {
    const chart = lies("components/BetragChart.tsx");
    expect(chart).toContain("heute: string;");
    expect(chart).toContain("aggregate(points, zeitraum, heute, { cumulative })");
    expect(chart).not.toMatch(/aggregate\([^)]*new Date\(\)/);
    const seite = lies("app/(app)/page.tsx");
    expect(seite).toContain("const heuteISO0 = heuteBerlin();");
    expect(seite).toContain("heute={heuteISO0}");
    expect(seite).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe("B24/B27/C30: Dashboard-Zeile, Leerzustände, Staffelplan", () => {
  it("die Aufgabenzeile wickelt auf dem Handy um", () => {
    const css = lies("app/globals.css");
    expect(css).toMatch(/@media \(max-width: 560px\) \{\s*\.heute-zeile \{ flex-wrap: wrap;/);
    expect(lies("app/(app)/page.tsx")).toContain('className="heute-label"');
  });
  it("Listen unterscheiden „gefiltert“ von „nichts“ — die Seite reicht es durch", () => {
    for (const p of ["components/lists/CashflowListe.tsx", "components/lists/EinnahmenListe.tsx", "components/lists/KostenListe.tsx"]) {
      const src = lies(p);
      expect(src, p).toContain("gefiltert?: boolean;");
      expect(src, p).toMatch(/\{gefiltert \? <div className="empty">/);
    }
    const seite = lies("app/(app)/cashflow/page.tsx");
    expect(seite).toContain("gefiltert={(einn?.length ?? 0) + (kost?.length ?? 0) > 0}");
    expect(lies("app/(app)/properties/page.tsx")).toContain("Kein Objekt passt zu Suche oder Status-Filter");
  });
  it("Buchungssaldo: ohne Buchungen „anlegen“, mit Buchungen außerhalb des Fensters „Zeitraum vergrößern“", () => {
    const chart = lies("components/BetragChart.tsx");
    expect(chart).toMatch(/art="nichts"[\s\S]*Noch keine Buchungen/);
    expect(chart).toMatch(/buckets\.every\(\(b\) => b\.value === 0\)[\s\S]*art="filter"/);
  });
  it("Dashboard und Termine laden den Staffelplan, damit mieterFristen die nächste Stufe rechnet", () => {
    for (const p of ["app/(app)/page.tsx", "app/(app)/termine/page.tsx"]) {
      expect(lies(p), p).toContain("staffel_datum,staffel_intervall,staffel_betrag,staffel_prozent,staffel_stufen");
    }
  });
});

describe("Paket 5 (A4): Mieter sehen Sichten, keine Tabellen", () => {
  it("das Portal liest mieter_portal und properties_portal", () => {
    const src = lies("app/(app)/portal/page.tsx");
    expect(src).toContain('from("mieter_portal")');
    expect(src).toContain('from("properties_portal")');
    expect(src).not.toContain('from("mieter").select("*")');
  });
  it("die Migration entfernt die Zeilen-Policies und gibt den Sichten nur dem angemeldeten Nutzer Leserecht", () => {
    const sql = lies("supabase/migrations/20261001120000_mieter_sicht_spalten.sql");
    expect(sql).toContain("drop policy if exists properties_select_zugang on public.properties;");
    expect(sql).toContain("drop policy if exists mieter_select_zugang on public.mieter;");
    expect(sql).toContain("security_barrier = true");
    expect(sql).toContain("grant select on public.mieter_portal to authenticated;");
    // Keine sensible Spalte in der Sicht
    for (const spalte of ["notiz", "miethistorie", "iban", "kaution_bank", "mietspiegel", "email", "telefon"]) {
      expect(sql, spalte).not.toMatch(new RegExp(`m\\.${spalte}\\b`));
    }
    for (const spalte of ["kaufpreis", "wert", "marktwert_aktuell", "bodenrichtwert", "notiz_import"]) {
      expect(sql, spalte).not.toMatch(new RegExp(`p\\.${spalte}\\b`));
    }
  });
});
