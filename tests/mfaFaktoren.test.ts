import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GoTrueClient } from "@supabase/auth-js";
import { unbestaetigteTotp } from "@/lib/auth/mfaFaktoren";

// 30.09.2026: 2FA war für ein Konto dauerhaft blockiert — neunmal
// „A factor with the friendly name "MyImmo" for this user already exists"
// (Supabase-Log). Die Aufräumschleife suchte unbestätigte Faktoren in
// `listFactors().totp`, das nur bestätigte enthält.

const FAKTOREN = [
  { id: "rest", factor_type: "totp", status: "unverified", friendly_name: "MyImmo" },
  { id: "gut", factor_type: "totp", status: "verified", friendly_name: "MyImmo2" },
  { id: "tel", factor_type: "phone", status: "unverified" },
];

async function echteListe() {
  // Die ECHTE Bibliothek entscheidet, was in `.totp` und `.all` landet — nur
  // `getUser` (der Netzaufruf) ist an der Instanz ersetzt.
  const client = new GoTrueClient({ url: "https://test.supabase.co/auth/v1", persistSession: false, autoRefreshToken: false });
  (client as unknown as { getUser: () => Promise<unknown> }).getUser = async () => ({
    data: { user: { id: "u1", factors: FAKTOREN } }, error: null,
  });
  return client.mfa.listFactors();
}

describe("unbestätigte TOTP-Faktoren", () => {
  it("die Bibliothek legt unbestätigte Faktoren NICHT in .totp ab — der Grund des Fehlers", async () => {
    const { data } = await echteListe();
    if (!data) throw new Error("keine Liste — Aufbau des Tests prüfen");
    expect(data.totp.map((f) => f.id)).toEqual(["gut"]);
    expect(data.all.map((f) => f.id)).toEqual(["rest", "gut", "tel"]);
  });

  it("unbestaetigteTotp findet den Rest über .all — und nur TOTP", async () => {
    const { data } = await echteListe();
    expect(unbestaetigteTotp(data)).toEqual(["rest"]);
  });

  it("ohne Liste: nichts zu tun", () => {
    expect(unbestaetigteTotp(null)).toEqual([]);
    expect(unbestaetigteTotp({ all: [] })).toEqual([]);
  });

  it("ZweiFaktor räumt über den Helfer auf — beim Laden UND vor jedem Einrichten", () => {
    const q = readFileSync("components/ZweiFaktor.tsx", "utf8");
    expect(q).not.toMatch(/for \(const f of data\?\.totp/);
    expect(q).toMatch(/unbestaetigteTotp\(liste\)/);
    const starten = q.slice(q.indexOf("async function starten()"), q.indexOf("mfa.enroll("));
    expect(starten).toMatch(/await raeumeAuf\(\);/);
  });
});
