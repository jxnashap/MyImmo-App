import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Gemeldet am 31.08.2026: Wer sich mit Zugangscode registriert hatte, wurde
// beim ersten Login ERNEUT nach dem Code gefragt — und bekam ihn dann als
// falsch zurück. Zwei unabhängige Ursachen:
//
//   1. Das Willkommens-Gate schrieb den Code vor der Prüfung in Großbuchstaben.
//      Der Beta-Zugangscode enthält Klein- und Großbuchstaben, Ziffern und
//      Sonderzeichen; der Vergleich ist exakt. Damit war derselbe Code, der bei
//      der Registrierung durchging, hier zwangsläufig falsch.
//   2. Bei der Registrierung wurde der Code nur geprüft, nie gespeichert —
//      deshalb fragte das Gate überhaupt ein zweites Mal.
//
// Diese Tests prüfen die Struktur der Korrektur. Das Verhalten der Datenbank-
// Seite (freischaltung_nachholen) wurde direkt in Postgres durchgespielt:
// gültig+Zustimmung → schaltet frei · zweiter Aufruf → false · ohne Zustimmung
// → abgelehnt, Vormerkung bleibt · abgelaufen → abgelehnt · angemeldeter
// Nutzer kann keine fremde Adresse vormerken (permission denied).

const action = readFileSync("lib/actions/freischaltung.ts", "utf8");
const login = readFileSync("app/(app)/login/page.tsx", "utf8");
const layout = readFileSync("app/(app)/layout.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260831090000_registrierung_freigabe_vormerken.sql",
  "utf8",
);

describe("Der Zugangscode wird nicht mehr verstümmelt", () => {
  it("das Willkommens-Gate übergibt den Code UNVERÄNDERT an die Beta-Prüfung", () => {
    // Der eigentliche Fehler: `.trim().toUpperCase()` vor `pruefeBetaCode`.
    const zeile = action.split("\n").find((z) => z.includes('formData.get("code")'));
    expect(zeile).toBeDefined();
    expect(zeile).toContain(".trim()");
    expect(zeile).not.toContain("toUpperCase");
  });

  it("Großschreibung bleibt für Einladungscodes erhalten — die sind immer groß", () => {
    expect(action).toContain("const codeGross = code.toUpperCase();");
    expect(action).toMatch(/einladungscode_einloesen.*p_code: codeGross/);
  });

  it("die Beta-Prüfung vergleicht weiterhin exakt (keine stille Aufweichung)", () => {
    expect(action).toContain("if (code.trim() !== erwartet)");
  });
});

describe("Der Code wird nur noch EINMAL abgefragt", () => {
  it("die Registrierung merkt die Freischaltung vor, statt nur zu prüfen", () => {
    expect(login).toContain("bereiteRegistrierungVor(code, email, consent)");
    expect(login).not.toContain("await pruefeBetaCode(");
  });

  it("Prüfung und Vormerkung liegen in EINER Action", () => {
    // Zwei getrennte Actions wären eine Hintertür: Man könnte die Vormerkung
    // direkt aufrufen und sich am Zugangscode vorbei freischalten.
    const ab = action.indexOf("export async function bereiteRegistrierungVor");
    expect(ab).toBeGreaterThan(-1);
    const koerper = action.slice(ab);
    expect(koerper).toContain("await pruefeBetaCode(code)");
    expect(koerper).toContain("registrierung_freigaben");
    // Vormerken nur mit dem Service-Role-Key, nie über die Nutzer-Sitzung.
    expect(koerper).toContain("createAdminClient()");
  });

  it("das Gate löst die Vormerkung ein, bevor es nach /willkommen umleitet", () => {
    const ab = layout.indexOf("istFreigeschaltet(supabase, user.id)");
    const koerper = layout.slice(ab, ab + 900);
    expect(koerper).toContain("freischaltung_nachholen");
    expect(koerper.indexOf("freischaltung_nachholen")).toBeLessThan(
      koerper.indexOf('redirect("/willkommen")'),
    );
  });

  it("die Registrierungsmeldung kündigt den nächsten Schritt an", () => {
    // Vorher stand dort nur "bitte bestätige die E-Mail" — dass danach noch
    // etwas kommt, erfuhr niemand.
    expect(login).toMatch(/bestätige jetzt die E-Mail/);
    expect(login).toMatch(/nicht noch einmal gebraucht/);
  });
});

describe("Die Vormerkung ist keine Hintertür", () => {
  it("kein Vertrauen auf signUp-Metadaten", () => {
    // `raw_user_meta_data` kommt vom Client und ist frei setzbar.
    expect(migration).toContain("WARUM NICHT ueber `signUp`-Metadaten");
    // Der Begriff darf im ERKLÄRENDEN Kommentar stehen — nur nicht im Code.
    const ausfuehrbar = migration
      .split("\n")
      .filter((z) => !z.trimStart().startsWith("--") && !z.trimStart().startsWith("*"))
      .join("\n");
    expect(ausfuehrbar).not.toMatch(/raw_user_meta_data/);
  });

  it("die Tabelle ist für anon und authenticated gesperrt", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.registrierung_freigaben from anon, authenticated");
    // RLS an und KEINE Policy: damit kommt nur die Service-Role heran.
    expect(migration).not.toMatch(/create policy .* on public\.registrierung_freigaben/);
  });

  it("ohne Zustimmung wird nicht freigeschaltet", () => {
    expect(migration).toContain("if not v_zeile.consent then return false; end if;");
  });

  it("die Vormerkung verfällt und wird nach dem Einlösen gelöscht", () => {
    expect(migration).toContain("ablauf_am > now()");
    expect(migration).toContain("delete from public.registrierung_freigaben where email = v_zeile.email");
  });

  it("E-Mail-Vergleich ohne Rücksicht auf Groß-/Kleinschreibung", () => {
    // Genau diese Art stiller Nichtübereinstimmung war der Ursprungsfehler.
    expect(migration).toContain("lower(email) = lower(v_email)");
  });
});
