// Audit 01.10.2026, Paket 3: der Produktweg — Early-Access-Anfrageweg (A5),
// Kontakt vor dem Login (B31), Grund fuer die Abmeldung (B30).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ctaBeschriftung, EARLY_ACCESS_MAILTO, EARLY_ACCESS_ZUSAGE, HILFE_MAILTO, KONTAKT_EMAIL, START_CTA } from "@/lib/preise";

const lies = (p: string) => readFileSync(p, "utf8");

describe("A5: ein Anfrageweg, der existiert", () => {
  it("die mailto-Links tragen Adresse und Betreff, die Zusage nennt eine Frist", () => {
    expect(EARLY_ACCESS_MAILTO.startsWith(`mailto:${KONTAKT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(EARLY_ACCESS_MAILTO)).toContain("Early-Access-Zugang");
    expect(HILFE_MAILTO.startsWith(`mailto:${KONTAKT_EMAIL}?subject=`)).toBe(true);
    expect(EARLY_ACCESS_ZUSAGE).toMatch(/24 Stunden/);
  });
  it("/anmelden zeigt den Anfrageweg und die Zusage, /login direkt am Code-Feld", () => {
    const anmelden = lies("app/(app)/anmelden/page.tsx");
    expect(anmelden).toContain("href={EARLY_ACCESS_MAILTO}");
    expect(anmelden).toContain("{EARLY_ACCESS_ZUSAGE}");
    const login = lies("app/(app)/login/page.tsx");
    const codeFeld = login.indexOf('"Zugangscode (Beta)"');
    const hinweis = login.indexOf("href={EARLY_ACCESS_MAILTO}");
    expect(codeFeld).toBeGreaterThan(0);
    expect(hinweis).toBeGreaterThan(codeFeld);
    expect(hinweis - codeFeld).toBeLessThan(1500);
    // Nur fuer Vermieter/Hausverwaltung — Mieter bekommen den Code vom Vermieter.
    expect(login.slice(hinweis - 400, hinweis)).toMatch(/rolle !== "mieter" && rolle !== "service"/);
  });
  it("jede oeffentliche Seite beschriftet den Start-Knopf ueber lib/preise", () => {
    expect(lies("app/(pub)/preise/page.tsx")).toContain("{START_CTA}");
    expect(lies("app/(pub)/funktionen/[slug]/page.tsx")).toContain("{START_CTA} <ArrowRight");
    expect(lies("app/(pub)/vorlagen/page.tsx")).toContain('ctaBeschriftung("Vorlagen kostenlos nutzen")');
    expect(lies("app/(pub)/ratgeber/[slug]/page.tsx")).toContain("ctaBeschriftung(a.feature.cta)");
    expect(ctaBeschriftung("Objekt anlegen")).toBe(START_CTA);
  });
});

describe("B31: Hilfe vor dem Login", () => {
  it("/login und /anmelden verlinken Hilfe & Kontakt in der Fusszeile", () => {
    for (const p of ["app/(app)/login/page.tsx", "app/(app)/anmelden/page.tsx"]) {
      expect(lies(p), p).toContain("href={HILFE_MAILTO}");
      expect(lies(p), p).toContain("Hilfe &amp; Kontakt");
    }
  });
});

describe("B30: der Nutzer erfaehrt, warum er vor dem Login steht", () => {
  it("AutoLogout gibt inaktiv (mit Minuten) bzw. geschlossen mit", () => {
    const src = lies("components/AutoLogout.tsx");
    expect(src).toMatch(/logout\("inaktiv"\)/);
    expect(src).toMatch(/logout\("geschlossen"\)/);
    expect(src).toContain('q.set("min", String(min()))');
    expect(src).not.toMatch(/window\.location\.href = "\/login";/);
  });
  it("die Login-Seite hat fuer alle drei Gruende einen Satz", () => {
    const src = lies("app/(app)/login/page.tsx");
    for (const g of ["inaktiv", "geschlossen", "abgelaufen"]) expect(src).toContain(`grund === "${g}"`);
    expect(src).toContain("Alles Gespeicherte ist noch da.");
  });
});
