import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AuthWeakPasswordError, AuthApiError } from "@supabase/auth-js";
import { passwortAblehnung, PASSWORT_LECK_HINWEIS } from "@/lib/passwort";

// Erster echter Durchlauf von „Passwort vergessen" (30.09.2026): Supabase
// lehnte „12345678" per Leak-Schutz ab, die Seite riet „Bitte fordere einen
// neuen Link an" — der Tester tat das, obwohl der Link gut war. Die Texte
// hier stammen WÖRTLICH aus dem Supabase-Log, nicht ausgedacht.

const LIVE_TEXT = "Password is known to be weak and easy to guess, please choose a different one.";

describe("passwortAblehnung", () => {
  it("der wörtliche Live-Text wird als Datenleck erkannt — auch ohne Code", () => {
    expect(passwortAblehnung({ message: LIVE_TEXT })).toMatch(/Datenleck/);
  });

  it("echtes Fehlerobjekt der Bibliothek mit reasons [pwned]", () => {
    const e = new AuthWeakPasswordError("irgendein Text", 422, ["pwned"]);
    expect(e.code).toBe("weak_password");
    expect(passwortAblehnung(e)).toMatch(/Datenleck/);
  });

  it("zu kurz bzw. zu wenige Zeichenarten: eigene, zutreffende Texte", () => {
    expect(passwortAblehnung(new AuthWeakPasswordError("Password should be at least 8 characters.", 422, ["length"]))).toMatch(/zu schwach/);
    expect(passwortAblehnung(new AuthWeakPasswordError("x", 422, ["characters"]))).toMatch(/Zeichenarten/);
  });

  it("gleiches Passwort wie bisher", () => {
    const e = new AuthApiError("New password should be different from the old password.", 422, "same_password");
    expect(passwortAblehnung(e)).toMatch(/unterscheiden/);
  });

  it("KEIN Passwort-Fehler → null, der Aufrufer entscheidet (dort ist ‚neuer Link' richtig)", () => {
    expect(passwortAblehnung(new AuthApiError("Auth session missing!", 401, "session_not_found"))).toBeNull();
    expect(passwortAblehnung({ message: "Invalid JWT" })).toBeNull();
    expect(passwortAblehnung(null)).toBeNull();
  });

  it("alle drei Stellen, die ein neues Passwort setzen, benutzen die Übersetzung", () => {
    const neu = readFileSync("components/PasswortNeu.tsx", "utf8");
    expect(neu).toMatch(/passwortAblehnung\(error\) \?\?/);
    expect(readFileSync("lib/passwortWechsel.ts", "utf8")).toMatch(/passwortAblehnung\(error\) \?\?/);
    const login = readFileSync("app/(app)/login/page.tsx", "utf8");
    expect(login.match(/setError\(passwortAblehnung\(error\) \?\? uebersetze\(error\.message\)\)/g)).toHaveLength(2);
    expect(`${neu}\n${login}`).not.toMatch(/pwned\|leaked\|compromis/);
  });

  it("die Leak-Regel steht VOR der Eingabe da: Reset-Formular und Registrierung", () => {
    expect(PASSWORT_LECK_HINWEIS).toMatch(/12345678/);
    expect(readFileSync("components/PasswortNeu.tsx", "utf8")).toMatch(/\{PASSWORT_LECK_HINWEIS\}/);
    expect(readFileSync("app/(app)/login/page.tsx", "utf8")).toMatch(/\{PASSWORT_LECK_HINWEIS\}/);
  });
});
