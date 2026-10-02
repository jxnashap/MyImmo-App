import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ohnePasswort } from "@/lib/passwort";

// 30.09.2026: Ein Konto, das am 26.06. über Google angelegt wurde und heute per
// „Passwort vergessen" ein Passwort bekam, konnte es in den Einstellungen nicht
// ändern — die App schloss aus `app_metadata.provider` („google", ändert sich
// nie) auf „kein Passwort". Live nachgezählt: 1 solches Konto, 4 Google-Konten
// ohne Passwort, 17 E-Mail-Konten.

describe("ohnePasswort", () => {
  it("die Datenbank-Antwort entscheidet — auch gegen den Anlage-Weg", () => {
    expect(ohnePasswort({ data: true, error: null }, "google")).toBe(false); // der gemeldete Fall
    expect(ohnePasswort({ data: false, error: null }, "google")).toBe(true);
    expect(ohnePasswort({ data: true, error: null }, "email")).toBe(false);
    expect(ohnePasswort({ data: false, error: null }, "email")).toBe(true);
  });

  it("ohne verwertbare Antwort: bisheriger Schluss als Rückfall", () => {
    const fehler = { data: null, error: { message: "x" } };
    expect(ohnePasswort(fehler, "google")).toBe(true);
    expect(ohnePasswort(fehler, "email")).toBe(false);
    expect(ohnePasswort({ data: null, error: null }, "google")).toBe(true); // unbekanntes Konto → null
    expect(ohnePasswort({ data: true, error: { message: "x" } }, "google")).toBe(true);
  });
});

describe("Seiten und Komponenten fragen, ob ein Passwort DA ist", () => {
  it("beide Seiten rufen die Datenbankfunktion und reichen das Ergebnis weiter", () => {
    for (const p of ["app/(app)/einstellungen/page.tsx", "app/(app)/konto/page.tsx"]) {
      const q = readFileSync(p, "utf8");
      expect(q, p).toMatch(/supabase\.rpc\("konto_hat_passwort"\)/);
      expect(q, p).toMatch(/ohnePasswort=\{ohnePasswort\(passwortAntwort, /);
    }
  });

  it("keine Komponente entscheidet mehr über das Passwort-Formular anhand von provider", () => {
    for (const p of ["components/SettingsView.tsx", "components/KontoVerwaltung.tsx"]) {
      const q = readFileSync(p, "utf8");
      expect(q, p).not.toMatch(/const istGoogle = !!provider/);
      expect(q, p).not.toMatch(/useReAuth\(email, !!provider/);
      expect(q, p).toMatch(/const istGoogle = ohnePasswort;/);
    }
  });

  it("die Migration gibt die Funktion nur angemeldeten Konten frei", () => {
    const m = readFileSync("supabase/migrations/20260930212305_konto_hat_passwort.sql", "utf8");
    expect(m).toMatch(/security definer/);
    expect(m).toMatch(/where u\.id = auth\.uid\(\)/);
    expect(m).toMatch(/revoke execute on function public\.konto_hat_passwort\(\) from public, anon;/);
  });
});
