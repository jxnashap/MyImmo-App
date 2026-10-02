import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Phase 5, zweiter Hebel (30.09.2026): Layout und Seite prüften die Anmeldung
// je einmal selbst — zwei Netzaufrufe hintereinander. Jetzt EIN Aufruf je
// Anfrage über `aktuellerNutzer()` (React `cache`).
//
// Was sich hier NICHT prüfen lässt: das Zwischenspeichern selbst. `cache()`
// merkt sich nur in einer Server-Anfrage etwas; Vitest rendert ohne diesen
// Kontext, dort ist es ein Durchreicher. Geprüft wird, was sicherheits-
// relevant ist und was die Wirkung trägt.

const nutzer = readFileSync("lib/supabase/nutzer.ts", "utf8").replace(/\/\/.*$/gm, "");

describe("aktuellerNutzer", () => {
  it("prüft über getUser (Supabase fragt den Auth-Server), NICHT über getSession (nur Cookie)", () => {
    expect(nutzer).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(nutzer).not.toMatch(/getSession/);
  });

  it("ist per Anfrage zwischengespeichert und nur serverseitig nutzbar", () => {
    expect(nutzer).toMatch(/export const aktuellerNutzer = cache\(async \(\) =>/);
    expect(nutzer).toMatch(/import "server-only";/);
  });

  const SEITEN = [
    "app/(app)/layout.tsx", "app/(app)/page.tsx", "app/(app)/makler/page.tsx", "app/(app)/willkommen/page.tsx",
    "app/(app)/konto/page.tsx", "app/(app)/kauf/page.tsx", "app/(app)/service/page.tsx", "app/(app)/verkauf/page.tsx",
    "app/(app)/tenants/[id]/dokument/page.tsx", "app/(app)/tenants/[id]/protokoll/page.tsx", "app/(app)/portal/page.tsx",
    "app/(app)/einstellungen/page.tsx",
  ];

  it("Layout und Seiten benutzen den Helfer statt eigener getUser-Aufrufe", () => {
    for (const p of SEITEN) {
      const q = readFileSync(p, "utf8");
      expect(q, p).toMatch(/aktuellerNutzer\(\)/);
      expect(q, p).not.toMatch(/supabase\.auth\.getUser\(\)/);
    }
  });

  it("die Passwort-Reset-Seite bleibt bewusst bei ihrem eigenen Aufruf", () => {
    // Sicherheitskritisch (setzt ein Passwort ohne das alte) — ein paar
    // Millisekunden sind dort kein Grund, etwas zu ändern.
    const q = readFileSync("app/(app)/auth/passwort-neu/page.tsx", "utf8");
    expect(q).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(q).not.toMatch(/aktuellerNutzer/);
  });
});
