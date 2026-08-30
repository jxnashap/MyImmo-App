import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Formular- und Statusmeldungen erscheinen mitten in der Seite, oft weit vom
// Fokus entfernt. Ohne Ansage merkt ein Screenreader-Nutzer nicht, dass das
// Speichern fehlgeschlagen ist — er hört Stille und hält den Vorgang für
// erledigt (WCAG 4.1.3, Statusmeldungen).
//
// Aufteilung: Fehler unterbrechen (role="alert"), neutrale und positive
// Hinweise warten, bis der Vorleser ausgeredet hat (role="status").

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const pfad = join(ordner, n);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return pfad.endsWith(".tsx") ? [pfad] : [];
  });
}

const quellen = [...dateien("components"), ...dateien("app")].map((p) => ({
  pfad: p.replace(/\\/g, "/"),
  zeilen: readFileSync(p, "utf8").split("\n"),
}));

/** Bedingt gerenderte Meldungen, die keine Ansage-Rolle im Tag tragen. */
function stumm() {
  const treffer: string[] = [];
  for (const { pfad, zeilen } of quellen) {
    zeilen.forEach((z, i) => {
      if (!/\{(\w*[Ff]ehler\w*|\w*[Ee]rror\w*|\w*[Hh]inweis\w*|msg)\s*&&/.test(z)) return;
      const block = zeilen.slice(i, i + 4).join("\n");
      // Nur JSX-Meldungen zählen — eine Bedingung ohne Element ist keine.
      if (!/<(p|div|span)[\s>]/.test(block)) return;
      // Für den Tag-Kopf ein größeres Fenster: mehrzeilige Tags reichen oft
      // über die vier Zeilen hinaus, ihr `>` steht erst später.
      const weit = zeilen.slice(i, i + 16).join("\n");
      const ersterTag = weit.slice(weit.search(/<(p|div|span)[\s>]/));
      const kopf = ersterTag.slice(0, ersterTag.indexOf(">") + 1);
      const angesagt = /role="(alert|status)"/.test(kopf) || /aria-live=/.test(kopf);
      if (!angesagt) treffer.push(`${pfad}:${i + 1}`);
    });
  }
  return treffer;
}

describe("Statusmeldungen werden angesagt", () => {
  it("keine bedingt gerenderte Fehler- oder Hinweismeldung bleibt stumm", () => {
    expect(stumm()).toEqual([]);
  });

  it("Fehler nutzen alert, nicht status — sie dürfen nicht warten", () => {
    const falsch: string[] = [];
    for (const { pfad, zeilen } of quellen) {
      zeilen.forEach((z, i) => {
        const m = z.match(/\{(\w*(?:[Ff]ehler|[Ee]rror)\w*)\s*&&/);
        if (!m) return;
        const block = zeilen.slice(i, i + 4).join("\n");
        if (!/<(p|div|span)[\s>]/.test(block)) return;
        // Nur das ERSTE Tag dieser Meldung ansehen. Im 4-Zeilen-Fenster steht
        // oft direkt darunter ein `hinweis` mit role="status" — das ist eine
        // andere Meldung und darf hier nicht mitzählen.
        const weit = zeilen.slice(i, i + 16).join("\n");
        const ersterTag = weit.slice(weit.search(/<(p|div|span)[\s>]/));
        const kopf = ersterTag.slice(0, ersterTag.indexOf(">") + 1);
        if (/role="status"/.test(kopf)) falsch.push(`${pfad}:${i + 1} (${m[1]})`);
      });
    }
    expect(falsch).toEqual([]);
  });
});

describe("Toast-Bereiche", () => {
  const toast = readFileSync("components/Toast.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  it("Fehler-Toasts liegen in einem assertive-Bereich, der Rest in einem polite", () => {
    expect(toast).toMatch(/aria-live="assertive"[^>]*role="alert"/);
    expect(toast).toMatch(/aria-live="polite"[^>]*role="status"/);
  });

  it("beide Bereiche stehen dauerhaft im DOM, auch leer", () => {
    // Ein Live-Bereich, der erst mit seinem Inhalt entsteht, wird von
    // Screenreadern nicht angesagt — deshalb darf hier nichts weggerendert
    // oder per display:none versteckt werden.
    expect(toast).not.toMatch(/\{.*\.length > 0 && [\s\S]{0,80}toast-stapel/);
    expect(css).not.toMatch(/\.toast-stapel:empty\s*\{[^}]*display:\s*none/);
  });

  it("der Abstand läuft über margin, nicht über gap am Streifen", () => {
    // `gap` wirkt auch zwischen leeren Stapeln und risse eine Lücke, wenn
    // gerade nur eine Sorte Toast sichtbar ist.
    const streifen = css.match(/\.toast-viewport \{[^}]*\}/)?.[0] ?? "";
    expect(streifen).not.toContain("gap:");
    expect(css).toContain(".toast-stapel:not(:empty) + .toast-stapel:not(:empty)");
  });
});
