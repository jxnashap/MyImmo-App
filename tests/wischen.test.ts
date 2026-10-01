// Reiter per Wischen (01.10.2026). Die Entscheidung ist streng, weil ein
// falscher Wisch die Lesestelle kostet und ein verpasster nur einen Tipp.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { wischRichtung, zielReiter, WISCH_MIN_PX, RAND_PX, WISCH_MAX_MS } from "@/lib/wischen";

const basis = { dy: 0, ms: 200, startX: 200, breite: 400 };

describe("wischRichtung", () => {
  it("nach links = nächster Reiter, nach rechts = voriger", () => {
    expect(wischRichtung({ ...basis, dx: -120 })).toBe(1);
    expect(wischRichtung({ ...basis, dx: 120 })).toBe(-1);
  });
  it("zu kurz zählt nicht", () => {
    expect(wischRichtung({ ...basis, dx: -(WISCH_MIN_PX - 1) })).toBe(0);
    expect(wischRichtung({ ...basis, dx: -WISCH_MIN_PX })).toBe(1);
  });
  it("schräges Scrollen zählt nicht — waagerecht muss deutlich überwiegen", () => {
    expect(wischRichtung({ ...basis, dx: -120, dy: 80 })).toBe(0);
    expect(wischRichtung({ ...basis, dx: -120, dy: 40 })).toBe(1);
  });
  it("langsames Ziehen zählt nicht", () => {
    expect(wischRichtung({ ...basis, dx: -120, ms: WISCH_MAX_MS + 1 })).toBe(0);
  });
  it("am Bildschirmrand gehört die Geste dem System (Zurück)", () => {
    expect(wischRichtung({ ...basis, dx: 150, startX: RAND_PX - 1 })).toBe(0);
    expect(wischRichtung({ ...basis, dx: -150, startX: 400 - RAND_PX + 1 })).toBe(0);
    expect(wischRichtung({ ...basis, dx: 150, startX: RAND_PX })).toBe(-1);
  });
});

describe("zielReiter", () => {
  const r = ["/a", "/b", "/c"];
  it("geht einen Schritt und läuft am Rand nicht um", () => {
    expect(zielReiter(r, 1, 1)).toBe("/c");
    expect(zielReiter(r, 1, -1)).toBe("/a");
    expect(zielReiter(r, 2, 1)).toBeNull();
    expect(zielReiter(r, 0, -1)).toBeNull();
    expect(zielReiter(r, 1, 0)).toBeNull();
    expect(zielReiter(r, -1, 1)).toBeNull();
  });
});

describe("Einbindung", () => {
  const w = readFileSync("components/WischReiter.tsx", "utf8");
  it("navigiert über den Router — die Adresse zieht mit, „Zurück“ bleibt heil", () => {
    expect(w).toContain("router.push(ziel, { scroll: false })");
  });
  it("lässt Eingabefelder, waagerecht scrollbare Bereiche und Ausnahmen in Ruhe", () => {
    expect(w).toContain('el.matches("input, textarea, select');
    expect(w).toContain("[data-kein-wischen]");
    expect(w).toMatch(/ox === "auto" \|\| ox === "scroll"\) && el\.scrollWidth > el\.clientWidth/);
  });
  it("verschachtelt: der innere Bereich hält die Geste an", () => {
    expect(w).toContain("e.stopPropagation();");
  });
  it("Mieterportal und Vermieter-Mieterportal sind eingebunden — mit den Reiter-Adressen in Leistenreihenfolge", () => {
    expect(readFileSync("components/PortalAnsicht.tsx", "utf8")).toContain(
      "<WischReiter reiter={PORTAL_TABS.map((t) => hrefFuer(t.key))} aktuell={PORTAL_TABS.findIndex((t) => t.key === tab)}>",
    );
    expect(readFileSync("app/(app)/anliegen/page.tsx", "utf8")).toContain(
      "<WischReiter reiter={TABS.map((t) => `/anliegen?tab=${t.key}`)} aktuell={TABS.findIndex((t) => t.key === tab)}>",
    );
  });
});
