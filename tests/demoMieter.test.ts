// Demo-Mieter (01.10.2026): zweites Demo-Konto für die Mieter-Sicht.
// Das Mieterportal war bis dahin der einzige Nutzerbereich ohne automatische
// Prüfung — kein Testkonto, der Rauchtest kam nie dorthin.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DEMO_EMAIL, DEMO_MIETER_EMAIL, demoDarfRoute, istDemoKonto } from "@/lib/demo";

const lies = (p: string) => readFileSync(p, "utf8");

describe("Demo-Mieter ist ein Demo-Konto", () => {
  it("istDemoKonto erkennt beide Konten — und nur die", () => {
    expect(istDemoKonto(DEMO_EMAIL)).toBe(true);
    expect(istDemoKonto(DEMO_MIETER_EMAIL)).toBe(true);
    expect(istDemoKonto("demo.mieter@myimmo.test ")).toBe(false);
    expect(istDemoKonto("vermieter@example.de")).toBe(false);
  });
  it("Portal und Konto-Seite sind in der Demo frei, der Rest bleibt wie er war", () => {
    expect(demoDarfRoute("/portal")).toBe(true);
    expect(demoDarfRoute("/portal?tab=zaehler".split("?")[0])).toBe(true);
    expect(demoDarfRoute("/konto")).toBe(true);
    expect(demoDarfRoute("/makler")).toBe(false);
    expect(demoDarfRoute("/api/export/alles")).toBe(false);
  });
  it("die Datenbank-Sperre kennt das Mieter-Konto über den signierten E-Mail-Claim; die Verknüpfung ist nur Service-Role", () => {
    const sql = lies("supabase/migrations/20261001150000_demo_mieter.sql");
    expect(sql).toContain("auth.jwt() ->> 'email') in ('demo.vermieter@myimmo.test', 'demo.mieter@myimmo.test')");
    expect(sql).toContain("revoke execute on function public.demo_mieter_verknuepfen() from public, anon, authenticated;");
    // Verknüpft wird GENAU die Demo-Mieterin (Sophie Berger) mit ihrer Wohnung.
    expect(sql).toContain("f3fd40b4-b021-4f1f-8f68-24ced9e9c6f2");
    expect(sql).toContain("d560ceb5-9dc2-4869-a0c8-41833c061a2c");
  });
});

describe("/api/demo?rolle=mieter", () => {
  const route = lies("app/api/demo/route.ts");
  it("legt das Konto idempotent an, verknüpft nach dem Reset, meldet als Mieter an und landet im Portal", () => {
    expect(route).toContain('searchParams.get("rolle") === "mieter"');
    expect(route).toContain("admin.auth.admin.createUser({");
    expect(route).toContain("email_confirm: true");
    expect(route).toContain('admin.rpc("demo_mieter_verknuepfen")');
    expect(route).toContain("email: alsMieter ? DEMO_MIETER_EMAIL : DEMO_EMAIL,");
    expect(route).toContain('const gewaehlt = alsMieter ? "/portal"');
  });
  it("die Verknüpfung läuft auch beim Vermieter-Start — der Reset entfernt sie sonst aus den Anliegen", () => {
    // Der Aufruf steht auf eigener Zeile im else-Zweig (4 Leerzeichen) — nicht
    // hinter einem `if (alsMieter)`.
    expect(route).toMatch(/\n    const \{ data: verknuepft, error: vFehler \} = await admin\.rpc\("demo_mieter_verknuepfen"\);/);
  });
});

describe("Mieter-Shell und Rauchtest", () => {
  it("die Mieter-Shell zeigt in der Demo Schreibschutz und Demo-Leiste", () => {
    const layout = lies("app/(app)/layout.tsx");
    const shell = layout.slice(layout.indexOf('if (rolle === "mieter" || rolle === "service")'), layout.indexOf("// Vermieter & Hausverwaltung nutzen die volle App"));
    expect(shell).toContain("{istDemoKonto(user.email) && <DemoNurLesen />}");
    expect(shell).toContain("{istDemoKonto(user.email) && <DemoLeiste />}");
  });
  it("der Rauchtest meldet sich als Mieter an und prüft alle fünf Reiter, /konto und die Sperre des Vermieter-Bereichs", () => {
    const s = lies("scripts/rauchtest.mjs");
    expect(s).toContain('hole("/api/demo?rolle=mieter")');
    for (const tab of ["anliegen", "zahlungen", "dokumente", "zaehler"]) expect(s).toContain(`/portal?tab=${tab}`);
    expect(s).toContain('pfad: "/konto"');
    expect(s).toContain('pfad: "/steuer", erwartet: [], zielPfad: "/portal"');
  });
});
