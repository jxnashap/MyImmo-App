// Reiter per Wischen (01.10.2026, zweite Fassung: der Inhalt folgt dem Finger).
// Ein Wisch vollendet sich, wenn er WEIT oder SCHNELL war; alles andere
// schnappt zurück — nichts geht verloren, deshalb dürfen die Schwellen
// niedriger liegen als in der ersten Fassung.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  wischRichtung, zielReiter, wischAchse, wischVersatz,
  WISCH_ANTEIL, WISCH_SCHNELL_PX_MS, WISCH_SCHNELL_MIN_PX, RAND_PX, RICHTUNG_AB_PX, GUMMIBAND,
} from "@/lib/wischen";

const basis = { dy: 0, ms: 400, startX: 200, breite: 400 };
const weit = basis.breite * WISCH_ANTEIL; // 100 px

describe("wischRichtung", () => {
  it("nach links = nächster Reiter, nach rechts = voriger", () => {
    expect(wischRichtung({ ...basis, dx: -weit })).toBe(1);
    expect(wischRichtung({ ...basis, dx: weit })).toBe(-1);
  });
  it("weit genug zählt auch langsam; zu kurz und langsam schnappt zurück", () => {
    expect(wischRichtung({ ...basis, dx: -weit, ms: 5000 })).toBe(1);
    expect(wischRichtung({ ...basis, dx: -(weit - 1), ms: 5000 })).toBe(0);
  });
  it("ein kurzer Schnipser reicht — aber nicht ein Tipp mit Zittern", () => {
    const schnell = { ...basis, ms: 60, dx: -(WISCH_SCHNELL_PX_MS * 60) }; // 30 px in 60 ms = Tempo erreicht …
    expect(Math.abs(schnell.dx)).toBeLessThan(WISCH_SCHNELL_MIN_PX);
    expect(wischRichtung(schnell)).toBe(0); // … aber unter dem Mindestweg
    expect(wischRichtung({ ...basis, ms: 80, dx: -WISCH_SCHNELL_MIN_PX })).toBe(1); // 40 px in 80 ms = 0,5 px/ms
    expect(wischRichtung({ ...basis, ms: 81, dx: -WISCH_SCHNELL_MIN_PX })).toBe(0); // knapp zu langsam
  });
  it("schräges Scrollen zählt nicht — waagerecht muss deutlich überwiegen", () => {
    expect(wischRichtung({ ...basis, dx: -120, dy: 80 })).toBe(0);
    expect(wischRichtung({ ...basis, dx: -120, dy: 40 })).toBe(1);
  });
  it("am Bildschirmrand gehört die Geste dem System (Zurück)", () => {
    expect(wischRichtung({ ...basis, dx: 150, startX: RAND_PX - 1 })).toBe(0);
    expect(wischRichtung({ ...basis, dx: -150, startX: 400 - RAND_PX + 1 })).toBe(0);
    expect(wischRichtung({ ...basis, dx: 150, startX: RAND_PX })).toBe(-1);
  });
});

describe("wischAchse und Versatz", () => {
  it("entscheidet erst ab dem Mindestweg, dann nach der größeren Komponente", () => {
    expect(wischAchse(RICHTUNG_AB_PX - 1, RICHTUNG_AB_PX - 1)).toBeNull();
    expect(wischAchse(RICHTUNG_AB_PX, 3)).toBe("x");
    expect(wischAchse(3, RICHTUNG_AB_PX)).toBe("y");
    expect(wischAchse(-20, 25)).toBe("y");
  });
  it("am Listenende folgt der Inhalt nur gebremst (Gummiband)", () => {
    expect(wischVersatz(-90, true)).toBe(-90);
    expect(wischVersatz(-90, false)).toBe(-90 * GUMMIBAND);
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
  it("der Inhalt folgt dem Finger, das Gleiten läuft über transform mit Austritts-Kurve unter 300 ms", () => {
    expect(w).toContain("setVersatz(wischVersatz(dx, ziel !== null))");
    expect(w).toContain("transform: `translate3d(${versatz}px, 0, 0)`");
    expect(w).toMatch(/export const GLEIT_MS = (\d+);/);
    expect(Number(w.match(/export const GLEIT_MS = (\d+);/)![1])).toBeLessThan(300);
    expect(w).toContain("`transform ${GLEIT_MS}ms var(--ease-out-stark)`");
  });
  it("navigiert erst NACH dem Gleiten über den Router — die Adresse zieht mit, „Zurück“ bleibt heil", () => {
    expect(w).toContain("router.push(reiter[ziel].href, { scroll: false })");
    expect(w).toContain("abschliessen(gleitZiel ?? angezeigt);");
    // Ohne Weg feuert kein transitionend — sonst bliebe die Phase hängen.
    expect(w).toContain("if (zielVersatz === versatz) {");
    expect(w).toContain("GLEIT_MS + 80");
  });
  it("der Browser scrollt senkrecht selbst; Eingabefelder, waagerecht scrollbare Bereiche, Rand und Ausnahmen bleiben in Ruhe", () => {
    expect(w).toContain('touchAction: "pan-y"');
    expect(w).toContain('el.matches("input, textarea, select');
    expect(w).toContain("[data-kein-wischen]");
    expect(w).toMatch(/ox === "auto" \|\| ox === "scroll"\) && el\.scrollWidth > el\.clientWidth/);
    expect(w).toContain("p.clientX < RAND_PX || p.clientX > window.innerWidth - RAND_PX");
    expect(w).toContain("reduzierteBewegung()");
  });
  it("Nachbarn sind für Tastatur und Vorleser gesperrt; verschachtelt hält der innere Bereich die Geste an", () => {
    expect(w).toContain("inert={rel !== 0} aria-hidden={rel !== 0}");
    expect((w.match(/e\.stopPropagation\(\);/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("Mieterportal bringt jeden Reiter-Inhalt mit, das Vermieter-Mieterportal nur den aktiven (Platzhalter für die Nachbarn)", () => {
    const portal = readFileSync("components/PortalAnsicht.tsx", "utf8");
    expect(portal).toContain("const inhalte: Record<PortalTab, ReactNode> = {");
    expect(portal).toContain("reiter={PORTAL_TABS.map((t) => ({ href: hrefFuer(t.key), label: t.label, inhalt: inhalte[t.key] }))}");
    expect(portal).not.toMatch(/tab === "\w+" &&/);
    expect(readFileSync("app/(app)/anliegen/page.tsx", "utf8")).toContain(
      "reiter={TABS.map((t) => ({ href: `/anliegen?tab=${t.key}`, label: t.label, inhalt: t.key === tab ? inhalt : undefined }))}",
    );
    expect(w).toContain("wird geladen …");
  });
});
