// Glas-Leiste: der offene Reiter steht in der Mitte (01.10.2026).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { zentrierVersatz } from "@/lib/glasLeiste";

describe("zentrierVersatz", () => {
  const leiste = { scrollBreite: 900, sichtBreite: 360 };
  it("stellt einen mittleren Reiter genau in die Mitte", () => {
    // Reiter 400–500 → Mitte 450 → Sichtfenster 270–630
    expect(zentrierVersatz({ ...leiste, reiterLinks: 400, reiterBreite: 100 })).toBe(270);
  });
  it("an den Enden geht Mitte nicht — dort bleibt der Rand", () => {
    expect(zentrierVersatz({ ...leiste, reiterLinks: 0, reiterBreite: 100 })).toBe(0);
    expect(zentrierVersatz({ ...leiste, reiterLinks: 800, reiterBreite: 100 })).toBe(540); // 900 − 360
  });
  it("passt die Leiste ganz hinein (Desktop), wird nicht gescrollt", () => {
    expect(zentrierVersatz({ scrollBreite: 700, sichtBreite: 760, reiterLinks: 600, reiterBreite: 100 })).toBe(0);
  });
});

describe("Einbindung", () => {
  it("beide Leisten laufen über GlassLeiste und führen bei Reiterwechsel nach — beim Laden ohne Sprung", () => {
    const g = readFileSync("components/GlassLeiste.tsx", "utf8");
    expect(g).toContain('querySelector<HTMLElement>(".glass-item.active")');
    expect(g).toContain("}, [aktiv]);");
    expect(g).toContain('behavior: ruhig ? "auto" : "smooth"');
    expect(g).toContain("zentriere(bar, el, erstesMal.current);");
    expect(g).toContain("useLayoutEffect(");
    expect(readFileSync("components/PortalAnsicht.tsx", "utf8")).toContain('<GlassLeiste aktiv={tab} label="Portal-Bereiche">');
    expect(readFileSync("app/(app)/anliegen/page.tsx", "utf8")).toContain('<GlassLeiste aktiv={tab} label="Bereiche" style={{ marginBottom: 20 }}>');
    for (const d of ["components/PortalAnsicht.tsx", "app/(app)/anliegen/page.tsx"]) {
      expect(readFileSync(d, "utf8"), d).not.toContain('<nav className="glass-bar"');
    }
  });
});
