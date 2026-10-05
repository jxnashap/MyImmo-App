import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { kaufLinkMitSanierung, sanierungAusParam, SANIERUNG_MAX } from "@/lib/sanierung/uebergabe";
import { anschaffungsnahVorKauf, berechneAnschaffungsnah } from "@/lib/steuer/anschaffungsnah";

// Sanierungsrechner → Kauf-Assistent (05.10.2026). Die Sanierung fließt in die Gesamtinvestition
// und in den 15-%-Hinweis. Geprüft gegen die reinen Funktionen UND den gerenderten Kauf-Rechner.

describe("Übergabe über die Adresse", () => {
  it("Link: ganze Euro aufgerundet, ohne Betrag kein Parameter, Obergrenze", () => {
    expect(kaufLinkMitSanierung(10361.4)).toBe("/kauf?sanierung=10362");
    expect(kaufLinkMitSanierung(0)).toBe("/kauf");
    expect(kaufLinkMitSanierung(Number.NaN)).toBe("/kauf");
    expect(kaufLinkMitSanierung(SANIERUNG_MAX * 3)).toBe(`/kauf?sanierung=${SANIERUNG_MAX}`);
  });

  it("Lesen: nur ganze positive Euro bis zur Obergrenze — alles andere wird ignoriert", () => {
    expect(sanierungAusParam("12345")).toBe(12345);
    expect(sanierungAusParam(["7", "8"])).toBe(7);
    for (const unsinn of [undefined, "", "0", "-5", "12.345", "12,5", "1e5", "<script>", String(SANIERUNG_MAX + 1), "9999999999"]) {
      expect(sanierungAusParam(unsinn), String(unsinn)).toBeNull();
    }
  });

  it("hin und zurück ergibt denselben Betrag", () => {
    const link = kaufLinkMitSanierung(48_250);
    expect(sanierungAusParam(new URL(link, "https://x.de").searchParams.get("sanierung") ?? undefined)).toBe(48_250);
  });
});

describe("15-%-Grenze vor dem Kauf", () => {
  it("Kaufpreis 250.000, 80 % Gebäude → Grenze 30.000; genau 30.000 ist nicht darüber", () => {
    expect(anschaffungsnahVorKauf(250_000, 30_000)).toEqual({ gebaeudeAK: 200_000, grenze: 30_000, prozentVomGebaeude: 15, ueber: false });
    expect(anschaffungsnahVorKauf(250_000, 30_001)?.ueber).toBe(true);
  });

  it("eigener Gebäudeanteil, und ohne Kaufpreis oder Sanierung kein Ergebnis", () => {
    expect(anschaffungsnahVorKauf(250_000, 10_000, 70)?.grenze).toBe(26_250); // 175.000 × 15 %
    expect(anschaffungsnahVorKauf(0, 10_000)).toBeNull();
    expect(anschaffungsnahVorKauf(250_000, 0)).toBeNull();
  });

  it("dieselbe Grenze wie der Steuer-Wächter nach dem Kauf", () => {
    const vorher = anschaffungsnahVorKauf(250_000, 1)!;
    const nachher = berechneAnschaffungsnah({ kaufpreis: 250_000, gebaeudeanteilProzent: null, kaufdatum: "2026-01-01" }, [], new Date("2026-06-01"));
    expect(nachher.grenze).toBe(vorher.grenze);
  });
});

// ── Gerenderter Kauf-Rechner ────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/actions/kalkulation", () => ({
  saveKalkulation: async () => ({}),
  updateKalkulation: async () => ({}),
  deleteKalkulation: async () => ({}),
}));

async function rechner(sanierungStart: number | null): Promise<string> {
  const { default: ObjektRechner } = await import("@/components/kauf/ObjektRechner");
  // demo = true: feste Startwerte (Kaufpreis 245.000 €, Bundesland 5 %, Makler 3,57 %).
  return renderToStaticMarkup(createElement(ObjektRechner, { demo: true, sanierungStart }));
}

describe("Kauf-Rechner mit übergebener Sanierung", () => {
  it("Sanierung steckt in der Gesamtinvestition und wird in der Notiz genannt", async () => {
    // 245.000 + 245.000 × 10,57 % (25.896,50) + 20.000 = 290.896,50 → € 290.897
    const html = await rechner(20_000);
    expect(html).toContain("€ 290.897");
    expect(html).toContain("inkl. € 25.897 Nebenkosten + € 20.000 Sanierung");
    expect(html).toMatch(/value="20000"/);
    // Unter der Grenze: 245.000 × 80 % × 15 % = 29.400
    expect(html).toContain("Unter der 15-%-Grenze");
    expect(html).toContain("€ 29.400");
  });

  it("über der Grenze: Hinweis auf AfA statt Sofortabzug", async () => {
    const html = await rechner(30_000);
    expect(html).toContain("über 15 % des Gebäudeanteils");
  });

  it("ohne Sanierung: alte Gesamtinvestition, kein 15-%-Hinweis", async () => {
    const html = await rechner(null);
    expect(html).toContain("€ 270.897"); // 245.000 + 25.896,50
    expect(html).not.toContain("Sanierung</");
    expect(html).not.toContain("15-%-Grenze");
  });
});
