import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { laufzeitText } from "@/lib/kreditLaufzeit";
import { standardStartNacherfassung } from "@/lib/mietkonto";

// Zweite Review-Runde (30.09.2026).

describe("Kredit-Laufzeit: Dauer oder Endjahr, beides lesbar", () => {
  it("Dauer in Jahren — wie ALLE echten Nutzer das Feld ausgefüllt hatten", () => {
    expect(laufzeitText(30)).toBe("30 Jahre");
    expect(laufzeitText(1)).toBe("1 Jahr");
    expect(laufzeitText(30, "2021-04-01")).toBe("30 Jahre · bis 2051");
  });

  it("Altbestand als Endjahr bleibt ein Endjahr", () => {
    expect(laufzeitText(2042)).toBe("bis 2042");
    expect(laufzeitText(2042, "2021-04-01")).toBe("bis 2042"); // nicht 2021 + 2042
  });

  it("Unsinn und Leeres → Strich statt einer falschen Zahl", () => {
    for (const w of [null, undefined, 0, -5, 150, Number.NaN]) expect(laufzeitText(w)).toBe("–");
  });

  it("Formulare fragen nach Jahren, keine Anzeige gibt den Rohwert aus", () => {
    for (const p of ["app/(app)/kredite/new/page.tsx", "app/(app)/kredite/[id]/edit/page.tsx", "components/KrediteListe.tsx"]) {
      const q = readFileSync(p, "utf8");
      expect(q, p).not.toContain("Gesamtlaufzeit bis (Jahr)");
      expect(q, p).toContain("Gesamtlaufzeit (Jahre)");
    }
    for (const p of ["components/KrediteListe.tsx", "app/(app)/properties/[id]/page.tsx"]) {
      const q = readFileSync(p, "utf8");
      expect(q, p).toMatch(/laufzeitText\(k\.laufzeit, k\.auszahlung_datum\)/);
      expect(q, p).not.toMatch(/\{k\.laufzeit \?\? "–"\}/);
    }
  });
});

describe("Nacherfassung: Voreinstellung ist das Vorjahr, nicht der älteste Mietvertrag", () => {
  it("alter Vertrag → Januar des Vorjahres (Demo: 299 offene Monate, Vertrag von 2018)", () => {
    expect(standardStartNacherfassung(["2018-03-01", "2021-04-01"], "2026-09")).toBe("2025-01");
  });

  it("junger Vertrag → sein Beginn", () => {
    expect(standardStartNacherfassung(["2025-11-01"], "2026-09")).toBe("2025-11");
    expect(standardStartNacherfassung(["2025-11-01", "2026-02-15"], "2026-09")).toBe("2025-11");
  });

  it("ohne gültigen Mietbeginn → Januar des Vorjahres", () => {
    expect(standardStartNacherfassung([null, "", "kaputt"], "2027-01")).toBe("2026-01");
  });

  it("die Oberfläche benutzt die Funktion", () => {
    const q = readFileSync("components/MietkontoBestaetigung.tsx", "utf8");
    expect(q).toMatch(/useState\(startVoreinstellung\)/);
    expect(q).toMatch(/standardStartNacherfassung\(/);
  });
});

describe("Werbeaussagen widersprechen der Datenschutzerklärung nicht", () => {
  // „100 % Daten in der EU" stand auf der Startseite, während /datenschutz
  // Übermittlungen in die USA nennt (Vercel, Anthropic). Irreführend (§ 5 UWG).
  const MARKETING = [
    "components/LandingPage.tsx",
    "components/landing/data.tsx",
    "components/landing/QlxHeader.tsx",
    "components/landing/Shell.tsx",
    "app/(app)/page.tsx",
    "app/(pub)/funktionen/page.tsx",
    "app/(pub)/vision/page.tsx",
    "app/(pub)/preise/page.tsx",
  ];

  it("die Datenschutzerklärung nennt die USA — sonst ist dieser Test gegenstandslos", () => {
    expect(readFileSync("app/(pub)/datenschutz/page.tsx", "utf8")).toMatch(/USA/);
  });

  it("keine Aussage „Daten (nur/ausschließlich/100 %) in der EU“ im sichtbaren Text", () => {
    for (const p of MARKETING) {
      // Kommentare zählen nicht — der Hinweis auf die alte Aussage darf stehen.
      const code = readFileSync(p, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");
      expect(code, p).not.toMatch(/Daten (nur |ausschließlich )?in der EU/);
      expect(code, p).not.toMatch(/>100 %<\/div><div className="t">Daten/);
    }
  });

  it("keine Emojis als Bildersatz auf der Startseite", () => {
    for (const p of ["components/LandingPage.tsx", "components/landing/RollenFlow.tsx"]) {
      expect(readFileSync(p, "utf8"), p).not.toMatch(/📄/);
    }
  });
});

describe("Kopfzeile: Logo und Knöpfe überlappen nicht (761–1.319 px)", () => {
  // Gemessen am 30.09.2026 in Chromium gegen localhost: vorher bis zu 215 px
  // Überlappung von 761 bis ~1.200 px, nachher ≥ 46 px Abstand bis 1.920 px.
  // Die Messung selbst braucht einen Browser; hier stehen die Stufen fest.
  const css = readFileSync("app/globals.css", "utf8");
  it("unter 1.320 px Kurzform und ohne Logo-Unterzeile", () => {
    expect(css).toMatch(/@media \(max-width: 1319px\) \{\s*\.qlx-brand-sub \{ display: none; \}\s*\.qlx-cta-lang \{ display: none; \}\s*\.qlx-cta-kurz \{ display: inline; \}/);
  });
  it("unter 900 px nur noch „Anmelden“", () => {
    expect(css).toMatch(/@media \(max-width: 899px\) \{\s*\.qlx-header-cta \.qlx-btn-hell \{ display: none; \}/);
  });
  it("der Knopf trägt beide Fassungen aus lib/preise.ts, keine hart eingetragene", () => {
    const h = readFileSync("components/landing/QlxHeader.tsx", "utf8");
    expect(h).toContain("{START_CTA_KURZ}");
    expect(h).toContain('aria-label={START_CTA}');
  });
});

// data.tsx enthält JSX und lässt sich hier nicht importieren — die Einträge
// werden aus dem Quelltext gelesen (ein Eintrag je Zeile).
const VISION = [...readFileSync("components/landing/data.tsx", "utf8")
  .slice(readFileSync("components/landing/data.tsx", "utf8").indexOf("export const VISION"))
  .split("];")[0]
  .matchAll(/\{ t: "([^"]+)",[^\n]*status: "(fertig|bald|geplant)" \}/g)]
  .map((m) => ({ t: m[1], status: m[2] }));

describe("Roadmap: nichts Fertiges als geplant, nichts Geplantes als fertig", () => {
  // „Geführtes Onboarding" stand als GEPLANT, obwohl es seit Juli existiert.
  const BELEG: Record<string, string> = {
    "Geführtes Onboarding": "components/OnboardingTour.tsx",
    "Zwei-Faktor-Anmeldung": "components/ZweiFaktor.tsx",
  };
  it("jeder „fertig“-Eintrag hat eine Komponente als Beleg", () => {
    expect(VISION.length).toBeGreaterThanOrEqual(4); // der Erkenner hat alle Einträge gefunden
    const fertig = VISION.filter((v) => v.status === "fertig");
    expect(fertig.length).toBeGreaterThan(0);
    for (const v of fertig) {
      expect(BELEG[v.t], v.t).toBeTruthy();
      expect(() => readFileSync(BELEG[v.t], "utf8"), v.t).not.toThrow();
    }
  });
  it("was einen Beleg hat, steht nicht als geplant da", () => {
    for (const v of VISION) if (BELEG[v.t]) expect(v.status, v.t).toBe("fertig");
  });
});
