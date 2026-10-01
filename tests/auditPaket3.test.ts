// Audit 01.10.2026, Paket 3: der Produktweg — Early-Access-Anfrageweg (A5),
// Kontakt vor dem Login (B31), Grund fuer die Abmeldung (B30).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as preise from "@/lib/preise";
import { HILFE_MAILTO, KONTAKT_EMAIL, REGISTRIERUNG_OFFEN, START_CTA } from "@/lib/preise";

const lies = (p: string) => readFileSync(p, "utf8");

// A5 stand hier bis 01.10.2026 als „ein Anfrageweg, der existiert“ (mailto +
// 24-h-Zusage). Am selben Tag hat der Betreiber den Anfrageweg abgeschafft:
// Registrierung nur mit Beta-Code, auf der öffentlichen Strecke „Coming soon“.
// Die Tests halten jetzt fest, dass er WEG bleibt — und dass „Coming soon“
// nirgends anklickbar ist (ein Knopf, der „bald“ sagt und ein Formular öffnet,
// wäre schlimmer als keiner).
describe("A5 (neu): kein Anfrageweg, Start-Knopf „Coming soon“", () => {
  it("lib/preise kennt keinen Anfrageweg mehr", () => {
    expect(REGISTRIERUNG_OFFEN).toBe(false);
    expect(START_CTA).toBe("Coming soon");
    expect("EARLY_ACCESS_MAILTO" in preise).toBe(false);
    expect("EARLY_ACCESS_ZUSAGE" in preise).toBe(false);
    expect(HILFE_MAILTO.startsWith(`mailto:${KONTAKT_EMAIL}?subject=`)).toBe(true);
  });
  it("/anmelden und /login bieten keinen Code per E-Mail an — das Code-Feld bleibt", () => {
    for (const p of ["app/(app)/anmelden/page.tsx", "app/(app)/login/page.tsx"]) {
      const q = lies(p);
      expect(q, p).not.toMatch(/EARLY_ACCESS|Zugang per E-Mail anfragen|Early-Access-Zugang per E-Mail/);
    }
    expect(lies("app/(app)/login/page.tsx")).toContain('"Zugangscode (Beta)"');
  });
  it("„Coming soon“ ist eine Fläche, kein Link — bei offener Registrierung wieder ein Link", () => {
    const c = lies("components/StartCta.tsx");
    expect(c).toContain('<span className={`${className} start-bald`}');
    expect(c).toContain('aria-disabled="true"');
    expect(c).toContain('if (REGISTRIERUNG_OFFEN || href !== "/anmelden") {');
    expect(lies("app/globals.css")).toMatch(/\.start-bald \{[^}]*pointer-events: none/);
    const h = lies("components/landing/QlxHeader.tsx");
    expect(h).toContain('<span className="qlx-btn-hell start-bald" aria-disabled="true"');
    expect(h).toMatch(/\{REGISTRIERUNG_OFFEN && \(\s*<li>\s*<Link href="\/anmelden"/);
  });
  it("jede öffentliche Seite nimmt den Start-Knopf aus StartCta, keine trägt ihn selbst", () => {
    for (const p of [
      "components/LandingPage.tsx", "components/landing/Shell.tsx", "app/(pub)/preise/page.tsx",
      "app/(pub)/vorlagen/page.tsx", "app/(pub)/funktionen/[slug]/page.tsx", "app/(pub)/ratgeber/[slug]/page.tsx",
    ]) {
      const q = lies(p);
      expect(q, p).toContain("<StartCta ");
      expect(q, p).not.toMatch(/<Link href="\/anmelden"[^>]*>\{START_CTA\}/);
    }
  });
  it("die Demo führt nicht mehr zur Registrierung, solange sie zu ist", () => {
    for (const p of ["components/DemoLeiste.tsx", "components/DemoSperre.tsx"]) {
      expect(lies(p), p).toMatch(/\{REGISTRIERUNG_OFFEN && \(\s*<button/);
    }
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
