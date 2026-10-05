// Startseite, Phase 1 aus docs/FEEDBACK-BEWERTUNG-2026-10.md (01.10.2026):
// Hero mit Zielgruppe UND Alleinstellung, Zielgruppe statt Funktionszahl,
// Vertrauensabschnitt — und jeder Vertrauenssatz an seinen Beleg gebunden.
// Fällt eine Funktion weg, wird dieser Test rot, statt dass die Startseite still
// etwas verspricht, das es nicht mehr gibt (§ 5 UWG).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { VERTRAUEN, ORDNER } from "@/components/LandingPage";

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

describe("„Ein Link statt Aktenordner“ — jede Zeile belegt (05.10.2026)", () => {
  const text = (wer: string) => {
    const o = ORDNER.find((x) => x.wer === wer);
    expect(o, wer).toBeTruthy();
    return `${o!.t} ${o!.punkte.join(" ")}`;
  };

  it("vier Empfänger, gerendert vor dem Vier-Schritte-Abschnitt", () => {
    expect(ORDNER.map((o) => o.wer)).toEqual(["Für die Bank", "Für den Makler", "Für Mietinteressenten", "Für Handwerker"]);
    const i = lp.indexOf("Ein Link statt Aktenordner");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(lp.indexOf("---------- Prozess in 4 Schritten ----------"));
  });

  it("Bank: angepasste Checkliste, erzeugte Unterlagen, 7/14/30 Tage, widerrufbar, Rückmeldung", () => {
    const t = text("Für die Bank");
    const bel = lies("lib/beleihung.ts");
    for (const p of ['"etw"', '"vermietet"', '"selbststaendig"', 'auto: "kennblatt"', 'auto: "mietaufstellung"', 'auto: "nk"']) {
      expect(bel, p).toContain(p);
    }
    expect(t).toContain("7, 14 oder 30 Tage");
    const act = lies("lib/actions/beleihung.ts");
    expect(act).toContain("[7, 14, 30].includes(tageAblauf)");
    expect(act).toContain("export async function widerrufeFreigabe(");
    expect(existsSync("components/BankRueckmeldungForm.tsx")).toBe(true);
  });

  it("Makler: Checkliste, Selbstauskunft-PDF und ein Link, der wirklich existiert", () => {
    const t = text("Für den Makler");
    const mk = lies("lib/makler.ts");
    for (const k of ["finanzierungsbestaetigung", "kaeufer_selbstauskunft", "schufa_bonitaet"]) expect(mk).toContain(k);
    expect(lies("lib/actions/makler.ts")).toContain("buildKaeuferSelbstauskunftPdf");
    // „Link für 7, 14 oder 30 Tage“: die Aktion kennt genau diese Laufzeiten, die Seite existiert.
    expect(t).toContain("7, 14 oder 30 Tage");
    expect(lies("lib/actions/makler.ts")).toContain("[7, 14, 30].includes(tageAblauf)");
    expect(existsSync("app/(app)/makler-link/[token]/page.tsx")).toBe(true);
    // „Ausweis und Einkommen nur, wenn du sie bewusst anhakst“: beide sind datensparsam markiert
    // und damit nicht in der Vorauswahl.
    expect(t).toMatch(/Ausweis und Einkommen nur, wenn du sie bewusst anhakst/);
    expect(mk).toMatch(/key: "ausweis",[\s\S]*?datensparsam: true/);
    expect(mk).toMatch(/key: "einkommensnachweise",[\s\S]*?datensparsam: true/);
    expect(mk).toContain("!i.datensparsam");
  });

  it("Bewerber: öffentliche Seite ohne Login, Status, Absagen löschen", () => {
    expect(text("Für Mietinteressenten")).toContain("kein Konto");
    expect(lies("app/(app)/bewerben/[token]/page.tsx")).toContain("ÖFFENTLICHE Bewerbungs-Seite");
    const b = lies("lib/actions/bewerber.ts");
    expect(b).toContain('status: "neu" | "favorit" | "abgelehnt"');
    expect(b).toContain("export async function loescheAlteAbgelehnteBewerbungen(");
  });

  it("Handwerker: Angebots- und Auftrags-Link ohne Login, Mieterkontakt nur auf Freigabe", () => {
    expect(lies("app/(app)/angebot/[token]/page.tsx")).toContain("kein Login");
    const auf = lies("app/(app)/auftrag/[token]/page.tsx");
    expect(auf).toContain("kein Login");
    expect(auf).toContain("nur wenn der Vermieter den");
  });

  it("„erscheinen in keiner Suchmaschine“: alle vier öffentlichen Seiten sind noindex", () => {
    expect(lp).toContain("erscheinen in keiner Suchmaschine");
    for (const s of ["beleihung", "bewerben", "angebot", "auftrag", "makler-link"]) {
      expect(lies(`app/(app)/${s}/[token]/page.tsx`), s).toContain("robots: { index: false, follow: false }");
    }
  });
});
