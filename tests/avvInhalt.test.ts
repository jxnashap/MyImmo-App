import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AVV_BLOECKE, AVV_STAND, AVV_STAND_ISO, type AvvBlock } from "@/lib/avvInhalt";

// AVV (06.10.2026). Seite und PDF lasen bis dahin je einen eigenen Text — das PDF nannte noch
// Enable Banking (seit 29.08.2026 entfernt), die Seite kannte Brevo nicht, obwohl Brevo
// Einladungen an Mieter verschickt. Jetzt EINE Quelle; dieser Test hält sie mit dem Code im Takt.

const lies = (p: string) => readFileSync(p, "utf8");
const text = (b: AvvBlock) =>
  "h" in b ? b.h : "p" in b ? b.p : "b" in b ? b.b : "note" in b ? b.note : "ul" in b ? b.ul.join(" ") : "kv" in b ? b.kv.flat().join(" ") : "";
const alles = AVV_BLOECKE.map(text).join(" ");

/** Die Namen der Subauftragsverarbeiter in Ziffer 7 — der fett gesetzte Anfang jedes Punkts. */
const subListe = (() => {
  const i = AVV_BLOECKE.findIndex((b) => "h" in b && b.h.startsWith("7."));
  const ul = AVV_BLOECKE.slice(i).find((b): b is { ul: string[] } => "ul" in b);
  return ul!.ul.map((t) => /^\*\*(.+?)\*\*/.exec(t)?.[1] ?? "").join(" | ");
})();

describe("AVV: eine Quelle für Seite und PDF", () => {
  it("die Seite und das PDF-Skript lesen beide lib/avvInhalt.ts", () => {
    expect(lies("app/(pub)/avv/page.tsx")).toContain('from "@/lib/avvInhalt"');
    expect(lies("scripts/gen-avv-pdf.mjs")).toContain('from "../lib/avvInhalt.ts"');
    expect(lies("app/(pub)/avv/page.tsx")).not.toMatch(/Subauftragsverarbeiter<\/H2>|Supabase Inc\./);
  });

  it("zum Stand gibt es das PDF", () => {
    expect(existsSync(`docs/compliance/avv-nutzer-vertrag-${AVV_STAND_ISO}.pdf`)).toBe(true);
    expect(AVV_STAND).toMatch(/^\d{1,2}\. \p{L}+ 20\d\d$/u);
  });
});

describe("AVV: Subauftragsverarbeiter passen zum Code", () => {
  it("wer Daten im Auftrag verarbeitet, steht in Ziffer 7", () => {
    expect(subListe.split(" | ").every(Boolean), "jeder Punkt beginnt mit **Name**").toBe(true);
    for (const name of ["Supabase", "Vercel", "Anthropic"]) expect(subListe, name).toContain(name);
    // Brevo verschickt Einladungen an Mieter und Hinweis-Mails — solange es den Anschluss gibt.
    if (existsSync("lib/mail/brevo.ts")) expect(subListe).toContain("Brevo");
  });

  it("entfernte oder eigenverantwortliche Dienste stehen NICHT in der Genehmigungsliste", () => {
    expect(alles).not.toContain("Enable Banking"); // Open Banking am 29.08.2026 entfernt
    expect(subListe).not.toContain("Google"); // eigenständig Verantwortlicher (AVV-STATUS)
    expect(subListe).not.toContain("Paddle"); // Händler in eigener Verantwortung
  });

  it("jeder Subauftragsverarbeiter steht auch in der Datenschutzerklärung", () => {
    const ds = lies("app/(pub)/datenschutz/page.tsx");
    for (const name of ["Supabase", "Vercel", "Anthropic", "Brevo"]) expect(ds, name).toContain(name);
  });

  it("Dienste, die nur Adresse bzw. Link bekommen, sind offen benannt", () => {
    if (existsSync("lib/geocode.ts")) expect(alles).toContain("Nominatim");
    expect(alles).toContain("Jina AI");
  });
});

describe("AVV: Zusagen, die der Code einlösen muss", () => {
  it("Löschung der Dateien: die Kontolöschung leert den Beleg-Speicher", () => {
    expect(alles).toMatch(/einschließlich der gespeicherten Dateien/);
    expect(lies("lib/actions/account.ts")).toContain('"belege"');
  });

  it("Briefe an Mieter verschickt MyImmo nicht — der Brief-Versand bleibt ohne Brevo", () => {
    expect(alles).toContain("Briefe an Mieter");
    expect(lies("components/BriefVersand.tsx")).not.toMatch(/brevo/i);
  });
});
