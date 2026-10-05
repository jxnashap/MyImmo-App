// Re-Auth-Dialog ohne übergebene E-Mail (05.10.2026, am Handy gemeldet):
// Makler-Link und Bank-Freigabe rufen `useReAuth()` ohne Kontodaten auf. Der
// Dialog endete dann bei jedem Passwort mit „Keine E-Mail-Adresse bekannt.“ —
// die frische Anmeldung war für diese beiden Wege unmöglich.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const quelle = readFileSync("components/ReAuthDialog.tsx", "utf8");

describe("ReAuthDialog ohne E-Mail-Prop", () => {
  it("holt die E-Mail selbst, wenn der Aufrufer keine übergibt", () => {
    expect(quelle).toMatch(/if \(!emailProp\) \{[\s\S]{0,200}supabase\.auth\.getUser\(\)/);
    expect(quelle).toMatch(/const email = emailProp \?\? konto\?\.email/);
  });

  it("erkennt Konten ohne Passwort über die Datenbank, nicht über provider allein", () => {
    expect(quelle).toMatch(/rpc\("konto_hat_passwort"\)/);
    expect(quelle).toMatch(/ohnePasswort\(antwort/);
  });

  it("die Aufrufer ohne Kontodaten gibt es weiterhin (sonst wäre der Rückweg überflüssig)", () => {
    expect(readFileSync("components/MaklerLink.tsx", "utf8")).toMatch(/useReAuth\(\)/);
    expect(readFileSync("components/BeleihungsOrdner.tsx", "utf8")).toMatch(/useReAuth\(\)/);
  });
});
