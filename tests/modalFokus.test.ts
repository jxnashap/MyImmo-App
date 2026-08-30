import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Modale Dialoge brauchen vier Dinge, damit sie mit Tastatur und Screenreader
// bedienbar sind: role="dialog", aria-modal, einen Namen (aria-label oder
// aria-labelledby) und tabIndex={-1} am selben Element, damit es den
// Anfangsfokus annehmen kann. Fokus-Falle, Anfangsfokus, Rückgabe und das
// Stummschalten des Hintergrunds liefert `useModalFokus`.
//
// Diese Tests prüfen die Struktur, nicht das Verhalten — das Verhalten wurde im
// echten Browser durchgespielt (Tab-Runde, Shift+Tab, Escape, Fokusrückgabe).
// Sie fangen den Fall ab, dass jemand ein neues Modal ohne diese Teile ergänzt.

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const pfad = join(ordner, n);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return pfad.endsWith(".tsx") ? [pfad] : [];
  });
}

const alle = [...dateien("components"), ...dateien("app")].map((p) => ({
  pfad: p.replace(/\\/g, "/"),
  inhalt: readFileSync(p, "utf8"),
}));

// Komponenten mit eigener, bereits geprüfter Fokus-Verwaltung. Sie wurden
// bewusst NICHT auf den Hook umgestellt: beide brauchen abweichendes Verhalten
// (die Befehlspalette fokussiert ihr Suchfeld und behandelt Pfeiltasten, die
// Tour darf beim Schrittwechsel den Fokus nicht zurücksetzen). Funktionierenden
// Code umzubauen wäre Risiko ohne Gewinn gewesen.
const EIGENE_LOESUNG = ["components/ui/CommandPalette.tsx", "components/OnboardingTour.tsx"];

describe("Modale Dialoge", () => {
  // Die Befehlspalette nutzt einen eigenen Overlay-Namen — ohne sie hier
  // aufzunehmen, waere ihr Eintrag in EIGENE_LOESUNG toter Code und der Test
  // strenger, als er wirkt.
  const modale = alle.filter(
    (d) => d.inhalt.includes('className="modal-overlay"') || d.inhalt.includes('className="cmdk-overlay"'),
  );

  it("es gibt überhaupt welche zu prüfen", () => {
    expect(modale.length).toBeGreaterThanOrEqual(6);
  });

  it("jedes Modal nutzt useModalFokus (oder hat eine dokumentierte eigene Lösung)", () => {
    const ohne = modale
      .filter((d) => !EIGENE_LOESUNG.includes(d.pfad))
      .filter((d) => !d.inhalt.includes("useModalFokus"))
      .map((d) => d.pfad);
    expect(ohne).toEqual([]);
  });

  it("jedes Modal setzt role=dialog und aria-modal", () => {
    const ohne = modale
      .filter((d) => !(d.inhalt.includes('role="dialog"') && d.inhalt.includes('aria-modal="true"')))
      .map((d) => d.pfad);
    expect(ohne).toEqual([]);
  });

  it("jedes Modal hat einen zugänglichen Namen", () => {
    const ohne = modale
      .filter((d) => !(d.inhalt.includes("aria-label") || d.inhalt.includes("aria-labelledby")))
      .map((d) => d.pfad);
    expect(ohne).toEqual([]);
  });

  // Ohne tabIndex={-1} nimmt das Dialog-Element den Anfangsfokus nicht an —
  // der Fokus bliebe auf dem Auslöser HINTER dem Overlay stehen, und der
  // Screenreader sagt nie, dass sich etwas geöffnet hat.
  it("jedes Modal mit useModalFokus kann den Anfangsfokus annehmen (tabIndex={-1})", () => {
    const ohne = modale
      .filter((d) => d.inhalt.includes("useModalFokus"))
      .filter((d) => !d.inhalt.includes("tabIndex={-1}"))
      .map((d) => d.pfad);
    expect(ohne).toEqual([]);
  });

  // Escape kommt aus dem Hook. Ein zusätzlicher eigener Handler schließt den
  // Dialog zweimal — harmlos, aber die zweite Quelle wird beim nächsten Umbau
  // übersehen.
  it("kein Modal mit Hook hat daneben noch einen eigenen Escape-Handler", () => {
    const doppelt = modale
      .filter((d) => d.inhalt.includes("useModalFokus"))
      .filter((d) => /e\.key === "Escape"/.test(d.inhalt))
      .map((d) => d.pfad);
    expect(doppelt).toEqual([]);
  });
});

describe("useModalFokus", () => {
  const quelle = readFileSync("lib/modalFokus.ts", "utf8");

  it("hängt vom Aktiv-Flag ab — sonst liefe der Effekt einmal mit leerer Ref", () => {
    expect(quelle).toMatch(/\}, \[aktiv\]\);/);
  });

  it("gibt den Fokus beim Schließen zurück, aber nur an ein noch existierendes Element", () => {
    expect(quelle).toContain("document.contains(vorher)");
  });

  it("räumt aria-hidden im Cleanup wieder ab", () => {
    expect(quelle).toContain('versteckt.forEach((el) => el.removeAttribute("aria-hidden"))');
  });
});
