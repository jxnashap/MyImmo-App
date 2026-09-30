import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { kurzTick, niceScale, aggregate, einnahmeDatum, xTickLabel, bucketTitel, istZeitraum, ZEITRAEUME, type RawPoint } from "@/lib/zeitraum";

describe("kurzTick — k-Format für Achsen", () => {
  it("schreibt Werte unter 1000 aus", () => {
    expect(kurzTick(850)).toBe("850");
    expect(kurzTick(0)).toBe("0");
    expect(kurzTick(999)).toBe("999");
  });
  it("kürzt ab 1000 mit k", () => {
    expect(kurzTick(1000)).toBe("1k");
    expect(kurzTick(1500)).toBe("1,5k");
    expect(kurzTick(12000)).toBe("12k");
    expect(kurzTick(250000)).toBe("250k");
  });
  it("behandelt negative Werte", () => {
    expect(kurzTick(-2000)).toBe("−2k");
  });
});

describe("niceScale — dynamische, runde Skala", () => {
  it("liefert runde Ticks und umschließt den Bereich", () => {
    const s = niceScale(0, 850);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(850);
    expect(s.ticks[0]).toBe(0);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
  });
  it("skaliert große Werte ohne feste Grenzen", () => {
    const klein = niceScale(0, 800);
    const gross = niceScale(0, 50000);
    expect(gross.max).toBeGreaterThan(klein.max);
  });
  it("kommt mit allen-Null klar (kein Fehler)", () => {
    const s = niceScale(0, 0);
    expect(s.ticks.length).toBeGreaterThan(0);
  });
});

describe("aggregate — monatsweise, 1J · 3J · 5J · Max", () => {
  const now = new Date(2026, 5, 15, 12); // 15.06.2026, Ortszeit
  const points: RawPoint[] = [
    { date: "2024-01-10", value: 100 },
    { date: "2025-03-01", value: 200 },
    { date: "2026-05-20", value: 300 },
    { date: "2026-06-01", value: 400 },
  ];

  it("die Auswahl ist 1J · 3J · 5J · Max — kein 1M mehr", () => {
    expect(ZEITRAEUME).toEqual(["1J", "3J", "5J", "Max"]);
    expect(istZeitraum("1M")).toBe(false); // gespeicherte Altwahl fällt auf den Standard
    expect(istZeitraum("3J")).toBe(true);
  });

  it("1J / 3J / 5J = 12 / 36 / 60 Monate, bis einschließlich des laufenden", () => {
    for (const [z, n, erster] of [["1J", 12, "2025-07-01"], ["3J", 36, "2023-07-01"], ["5J", 60, "2021-07-01"]] as const) {
      const a = aggregate(points, z, now);
      expect(a.gran, z).toBe("month");
      expect(a.buckets.length, z).toBe(n);
      expect(a.buckets[0].date, z).toBe(erster);
      expect(a.buckets[n - 1].date, z).toBe("2026-06-01");
    }
  });

  it("jede Buchung landet in IHREM Monat — auch am Monatsersten", () => {
    const a = aggregate(points, "1J", now);
    const wert = (d: string) => a.buckets.find((b) => b.date === d)?.value;
    expect(wert("2026-05-01")).toBe(300);
    expect(wert("2026-06-01")).toBe(400);
    expect(wert("2025-07-01")).toBe(0);
  });

  it("Monatserste bleiben im Monat, egal in welcher Zeitzone der Browser läuft", () => {
    // Früher: new Date("2026-03-01") ist westlich von UTC der 28. Februar.
    const a = aggregate([{ date: "2026-03-01", value: 850 }], "1J", now);
    expect(a.buckets.find((b) => b.date === "2026-03-01")?.value).toBe(850);
    expect(a.buckets.find((b) => b.date === "2026-02-01")?.value).toBe(0);
  });

  it("Max: monatsweise bis 6 Jahre Bestand, darüber jahresweise", () => {
    const a = aggregate(points, "Max", now);
    expect(a.gran).toBe("month");
    expect(a.buckets[0].date).toBe("2024-01-01");
    expect(a.buckets.length).toBe(30); // Jan 2024 … Jun 2026
    const alt = aggregate([{ date: "2015-04-01", value: 1 }, ...points], "Max", now);
    expect(alt.gran).toBe("year");
    expect(alt.buckets[0].date).toBe("2015-01-01");
    expect(alt.buckets.length).toBe(12); // 2015 … 2026
  });

  it("cumulative beginnt im Zeitraum bei 0 — frühere Buchungen zählen nicht", () => {
    // Bis 30.09.2026 mit „Grundlinie" (Saldo seit der ersten Buchung überhaupt).
    const a = aggregate(points, "1J", now, { cumulative: true });
    expect(a.buckets[a.buckets.length - 1].value).toBe(700);
    const m = aggregate(points, "Max", now, { cumulative: true });
    expect(m.buckets[m.buckets.length - 1].value).toBe(1000);
  });

  it("Vorausbuchungen nach dem laufenden Monat zählen nicht", () => {
    const a = aggregate([{ date: "2026-07-01", value: 999 }], "1J", now, { cumulative: true });
    expect(a.buckets[a.buckets.length - 1].value).toBe(0);
  });

  it("kein Fehler bei leeren oder kaputten Daten", () => {
    const a = aggregate([{ date: "", value: 5 }, { date: "kaputt", value: 5 }], "1J", now);
    expect(a.buckets.length).toBe(12);
    expect(a.buckets.every((b) => b.value === 0)).toBe(true);
    expect(aggregate([], "Max", now).buckets.length).toBe(1); // nur der laufende Monat
  });
});

describe("Mieten zählen im Mietmonat", () => {
  it("soll_monat schlägt das Buchungsdatum", () => {
    expect(einnahmeDatum({ buchungsdatum: "2026-02-02", soll_monat: "2026-01" })).toBe("2026-01-01");
    expect(einnahmeDatum({ buchungsdatum: "2026-02-02", soll_monat: null })).toBe("2026-02-02");
    expect(einnahmeDatum({ buchungsdatum: "2026-02-02", soll_monat: "2026-13" })).toBe("2026-02-02");
    expect(einnahmeDatum({ buchungsdatum: null })).toBeNull();
  });

  it("verspätete Januar-Miete: Januar voll, Februar nicht doppelt", () => {
    const now = new Date(2026, 1, 20);
    const mieten = [
      { buchungsdatum: "2026-02-02", soll_monat: "2026-01", betrag: 800 }, // Januar, spät gezahlt
      { buchungsdatum: "2026-02-01", soll_monat: "2026-02", betrag: 800 },
    ];
    const a = aggregate(mieten.map((e) => ({ date: einnahmeDatum(e)!, value: e.betrag })), "1J", now);
    const wert = (d: string) => a.buckets.find((b) => b.date === d)?.value;
    expect(wert("2026-01-01")).toBe(800);
    expect(wert("2026-02-01")).toBe(800);
  });

  it("das Dashboard gibt Einnahmen über einnahmeDatum in die Grafik", () => {
    const q = readFileSync("app/(app)/page.tsx", "utf8");
    expect(q).toMatch(/einnahmeDatum\(e as/);
    expect(q).not.toMatch(/einnahmen\.filter\(\(e\) => e\.buchungsdatum\)\.map/);
  });
});

describe("Achse und Tooltip", () => {
  const now = new Date(2026, 5, 15);
  it("1J: jeder Monat; 3J: Quartale mit Jahr; 5J: Jahreswechsel", () => {
    const labels = (z: "1J" | "3J" | "5J") => {
      const a = aggregate([], z, now);
      return a.buckets.map((_, i) => xTickLabel(a.buckets, i, a.gran)).filter(Boolean);
    };
    expect(labels("1J")).toHaveLength(12);
    expect(labels("1J")[0]).toBe("Jul");
    expect(labels("3J")).toContain("Jan 25");
    expect(labels("3J").length).toBe(12);
    expect(labels("5J")).toEqual(["2022", "2023", "2024", "2025", "2026"]);
  });
  it("Tooltip ohne Zeitzonen-Verschiebung", () => {
    expect(bucketTitel("2026-03-01", "month")).toBe("Mär 2026");
    expect(bucketTitel("2026-01-01", "year")).toBe("2026");
  });
});
