// Startseite, Phase 1 aus docs/FEEDBACK-BEWERTUNG-2026-10.md (01.10.2026):
// Hero mit Zielgruppe UND Alleinstellung, Zielgruppe statt Funktionszahl,
// Vertrauensabschnitt — und jeder Vertrauenssatz an seinen Beleg gebunden.
// Fällt eine Funktion weg, wird dieser Test rot, statt dass die Startseite still
// etwas verspricht, das es nicht mehr gibt (§ 5 UWG).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { VERTRAUEN } from "@/components/LandingPage";

const lies = (p: string) => readFileSync(p, "utf8");
const lp = lies("components/LandingPage.tsx");

describe("Hero und Kennzahlen", () => {
  it("Hero nennt das System, die Alleinstellung und die Zielgruppe", () => {
    expect(lp).toContain("titel={<>Deine Immobilien. Ein\u00a0System. <em>Von\u00a0überall.</em></>}");
    expect(lp).toContain("Für private Vermieter mit mehr als ein paar Wohnungen, aber ohne Hausverwaltung");
    expect(lp).toContain("Für\u00a01–24\u00a0Einheiten.");
  });
  it("keine Funktionszahl mehr in den Kennzahlen", () => {
    expect(lp).not.toContain("{FEATURES.length}+");
    expect(lp).not.toContain("Funktionen — vom Mietvertrag bis ELSTER");
    expect(lp).toContain('<div className="z">1–24</div>');
  });
  it("kein „kein Abo“ — die FAQ kündigt ein Abo an", () => {
    expect(lp).not.toMatch(/·\s*kein Abo/);
    expect(lp).toContain("Datenbank in Frankfurt · derzeit kostenlos");
  });
  it("keine Versprechen für Funktionen, die es nicht gibt", () => {
    for (const w of ["Bankanbindung", "Bankkonto verbinden", "MyImmo AI", "KI-Assistent", "Copilot"]) {
      expect(lp, w).not.toContain(w);
    }
  });
});

describe("Vertrauensabschnitt — jeder Satz belegt", () => {
  const titel = VERTRAUEN.map((v) => v.t);
  const text = VERTRAUEN.map((v) => `${v.t} ${v.p}`).join(" ");

  it("sechs Punkte, gerendert vor der FAQ", () => {
    expect(VERTRAUEN).toHaveLength(6);
    expect(lp.indexOf("Deine Daten gehören dir")).toBeGreaterThan(0);
    expect(lp.indexOf("Deine Daten gehören dir")).toBeLessThan(lp.indexOf("---------- FAQ ----------"));
  });
  it("Standort: Frankfurt, nicht „die EU“ (Vercel und Anthropic sitzen in den USA)", () => {
    expect(titel).toContain("Datenbank in Frankfurt");
    // „eu-central-1“ ist der AWS-Regionsname, keine Werbeaussage.
    expect(text).not.toMatch(/\bEU\b(?!-central)|Europa|europäisch|DSGVO-konform/i);
    expect(lies("app/(pub)/datenschutz/page.tsx")).toContain("Frankfurt");
  });
  it("Verschlüsselung: AES-256-GCM steht wirklich im Code", () => {
    expect(text).toContain("AES-256-GCM");
    expect(lies("lib/crypto/secure.ts")).toContain('createCipheriv("aes-256-gcm"');
  });
  it("Mieter sehen nur ihr Mietverhältnis: die Portal-Sichten existieren", () => {
    expect(titel).toContain("Jeder sieht nur seins");
    expect(lies("supabase/migrations/20261001120000_mieter_sicht_spalten.sql")).toMatch(/create or replace view public\.mieter_portal/i);
  });
  it("Zwei-Faktor, Export, Löschen: die Bausteine existieren", () => {
    expect(titel).toEqual(expect.arrayContaining(["Zwei-Faktor-Anmeldung", "Alles exportierbar", "Kein Datenhandel"]));
    expect(existsSync("components/ZweiFaktor.tsx")).toBe(true);
    expect(existsSync("app/api/export/alles/route.ts")).toBe(true);
    expect(lies("lib/actions/account.ts")).toContain("export async function deleteAccount(");
  });
  it("„kein Tracking“ deckt sich mit der Datenschutzerklärung", () => {
    expect(text).toContain("kein Tracking");
    expect(lies("app/(pub)/datenschutz/page.tsx")).toContain("Kein Tracking, keine Analyse-Tools");
  });
});
