import { describe, it, expect } from "vitest";
import { kurzTick, niceScale, aggregate, type RawPoint } from "@/lib/zeitraum";

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

describe("aggregate — Bucketing nach Zeitraum", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const points: RawPoint[] = [
    { date: "2024-01-10", value: 100 },
    { date: "2025-03-01", value: 200 },
    { date: "2026-05-20", value: 300 },
    { date: "2026-06-01", value: 400 },
  ];

  it("1J = 12 Monats-Buckets", () => {
    const a = aggregate(points, "1J", now);
    expect(a.gran).toBe("month");
    expect(a.buckets.length).toBe(12);
  });

  it("1M = tageweise", () => {
    const a = aggregate(points, "1M", now);
    expect(a.gran).toBe("day");
    // Juni-Buchung im Fenster vorhanden
    expect(a.buckets.some((b) => b.value === 400)).toBe(true);
  });

  it("Max = jahresweise ab frühestem Punkt", () => {
    const a = aggregate(points, "Max", now);
    expect(a.gran).toBe("year");
    expect(a.buckets[0].date.startsWith("2024")).toBe(true);
    expect(a.buckets.length).toBe(3); // 2024, 2025, 2026
  });

  it("cumulative bildet laufende Summe inkl. Grundlinie", () => {
    const a = aggregate(points, "1J", now, { cumulative: true });
    const last = a.buckets[a.buckets.length - 1].value;
    // Grundlinie (vor dem 1J-Fenster: 100 + 200) + Fenster (300 + 400) = 1000
    expect(last).toBe(1000);
  });

  it("kein Fehler bei leeren Daten", () => {
    const a = aggregate([], "1J", now);
    expect(a.buckets.length).toBe(12);
    expect(a.buckets.every((b) => b.value === 0)).toBe(true);
  });
});
