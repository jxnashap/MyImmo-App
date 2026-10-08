import { describe, it, expect } from "vitest";
import { normMietart, MIETART_LABEL } from "@/lib/mietart";
import { mieterFristen } from "@/lib/fristen";

// Scan 06.10.2026: „Index“ (Import/Demo) wurde auf der Mieterseite als „Standard“
// gezeigt, ein ausgezogener Mieter bekam „Mieterhöhung möglich“.
describe("normMietart", () => {
  it("liest Groß- und Kleinschreibung gleich", () => {
    expect(normMietart("Index")).toBe("index");
    expect(normMietart("index")).toBe("index");
    expect(normMietart("Staffel")).toBe("staffel");
    expect(normMietart("Staffelmiete")).toBe("staffel");
    expect(normMietart("Standard")).toBe("standard");
    expect(normMietart(null)).toBe("standard");
    expect(MIETART_LABEL[normMietart("Index")]).toBe("Indexmiete");
  });
});

describe("mieterFristen nach Vertragsende", () => {
  const basis = { mietbeginn: "2018-01-01", kuendigung: null, letzte_erhoehung: null };
  it("kein Erhöhungs-/Index-Hinweis und kein rotes Mietende für Ausgezogene", () => {
    const f = mieterFristen({ ...basis, mietende: "2025-09-30", mietart: "Index" });
    expect(f.some((x) => /Mieterhöhung|Indexmiete/.test(x.label))).toBe(false);
    expect(f.find((x) => x.label === "Mietende")?.typ).toBe("info");
  });
  it("laufender Vertrag behält die Hinweise", () => {
    const f = mieterFristen({ ...basis, mietende: null, mietart: "Index" });
    expect(f.some((x) => x.label === "Indexmiete prüfen" || x.label.startsWith("Indexanpassung möglich"))).toBe(true);
    // § 558 gilt bei Indexmiete nicht (§ 557b Abs. 2 BGB, P7/B8) — nur bei normaler Miete.
    expect(f.some((x) => x.label.startsWith("Mieterhöhung möglich"))).toBe(false);
    expect(mieterFristen({ ...basis, mietende: null, mietart: null }).some((x) => x.label.startsWith("Mieterhöhung möglich"))).toBe(true);
  });
});
