// Auswahl „Dokument“: Zahlungserinnerung oder Mahnung (08.10.2026, Vorgabe des Betreibers) und
// „Mieter: nur lesen“ — der Spaltenschutz als Erlaubnisliste.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { zahlungsBriefWahl, erinnerungArchiviert } from "@/lib/mahnung";
import { baueHeuteAufgaben } from "@/lib/heute";

const lies = (p: string) => readFileSync(p, "utf8");
const leer = { anliegen: [], meldungen: [], fristen: [] };
const miete = { mieterId: "m1", name: "Anna Weber", objekt: "Haus", monat: "2026-10", betrag: 1240 };

describe("zahlungsBriefWahl — EINE Stelle für beide Briefe", () => {
  const w = zahlungsBriefWahl({ mieterId: "m1", mieterName: "Anna Weber", jahrMonat: "2026-10", betrag: 1240, heuteISO: "2026-10-08", erinnerungArchiviert: false });

  it("beide Briefe für denselben Mieter, Monat und Betrag", () => {
    expect(w.erinnerung).toContain("/tenants/m1/dokument?art=zahlungserinnerung");
    expect(w.mahnung).toContain("/tenants/m1/dokument?art=mahnung");
    for (const url of [w.erinnerung, w.mahnung]) {
      expect(url).toContain("betrag=1240");
      expect(url).toContain("datum=2026-10-15"); // Frist eine Woche ab heute
    }
  });

  it("die Kopfzeile nennt wer, welcher Monat und wie viel", () => {
    expect(w.titel).toMatch(/^Anna Weber · Miete Oktober 2026 · 1\.240,00\s€ offen$/);
  });
});

describe("Mahnung ist immer wählbar — die Erinnerung ist nur ein Hinweis", () => {
  it("auch ohne archivierte Erinnerung gibt es den Mahnungs-Link", () => {
    const [a] = baueHeuteAufgaben({ ...leer, offeneMieten: [{ ...miete, erinnerungArchiviert: false }] }, "2026-10-08", Infinity);
    expect(a.neben?.wahl.mahnung).toContain("art=mahnung");
    expect(a.neben?.wahl.erinnerungArchiviert).toBe(false);
  });

  it("der Hinweis kommt aus den Daten des Dashboards durch", () => {
    const [a] = baueHeuteAufgaben({ ...leer, offeneMieten: [{ ...miete, erinnerungArchiviert: true }] }, "2026-10-08", Infinity);
    expect(a.neben?.wahl.erinnerungArchiviert).toBe(true);
    // Das Dashboard rechnet ihn je Mieter und Monat aus den archivierten Erinnerungen.
    expect(lies("app/(app)/page.tsx")).toMatch(/erinnerungArchiviert: erinnerungArchiviert\(\s*\(erinnRows \?\? \[\]\)[^,]*,\s*m\.id as string,\s*mietFaelligkeit\(soll\.jahrMonat, heuteISO0\)\.faellig/);
  });

  it("nur eine Erinnerung NACH der Fälligkeit beim selben Mieter zählt", () => {
    const e = [{ mieter_id: "m1", created_at: "2026-10-06T08:00:00Z" }];
    expect(erinnerungArchiviert(e, "m1", "2026-10-05")).toBe(true);
    expect(erinnerungArchiviert(e, "m2", "2026-10-05")).toBe(false);
    expect(erinnerungArchiviert(e, "m1", "2026-10-07")).toBe(false);
  });

  it("die Auswahl zeigt beide Wahlen ohne Bedingung, die Erinnerung steuert nur den Untertitel", () => {
    const k = lies("components/BriefWahl.tsx");
    expect(k).toMatch(/href=\{wahl\.erinnerung\}/);
    expect(k).toMatch(/href=\{wahl\.mahnung\}/);
    // Keine Sperre wie bis 08.10.2026 („mahnungMoeglich && <Link …>“).
    expect(k).not.toMatch(/erinnerungArchiviert\s*&&/);
    expect(lies("components/RueckstandWaechter.tsx")).not.toMatch(/mahnungMoeglich/);
    expect(lies("components/RueckstandWaechter.tsx")).toMatch(/<BriefWahl wahl=\{wahl\} \/>/);
  });
});

describe("Zeile: „überfällig“ statt „offen“ nach der Fälligkeit", () => {
  it("am Fälligkeitstag offen und nicht dringend, danach überfällig und dringend", () => {
    const [vorher] = baueHeuteAufgaben({ ...leer, offeneMieten: [miete] }, "2026-10-05", Infinity);
    expect(vorher.label).toBe("Mieteingang Oktober 2026 offen");
    expect(vorher.dringend).toBe(false);
    const [nachher] = baueHeuteAufgaben({ ...leer, offeneMieten: [miete] }, "2026-10-06", Infinity);
    expect(nachher.label).toBe("Miete Oktober 2026 überfällig");
    expect(nachher.dringend).toBe(true);
  });
});

describe("Auswahlblatt: Apple-Stil, schnell, zugänglich", () => {
  const k = lies("components/BriefWahl.tsx");
  const css = lies("app/globals.css");
  const block = css.slice(css.indexOf("/* ===== Auswahl „Dokument“"), css.indexOf("/* ===== Hover-Bewegung nur fuer echte Zeigegeraete"));

  it("liegt im Portal an <body> — .section schneidet sonst ab", () => {
    // Das Ziel des Portals, nicht der Kommentar darüber (der nennt document.body auch).
    expect(k).toMatch(/createPortal\(\s*<div className=\{`briefwahl[\s\S]*?<\/div>,\s*document\.body,\s*\)\}/);
    expect(css).toMatch(/\.section \{[^}]*overflow: hidden/);
  });

  it("Escape schließt, der Fokus geht auf die erste Wahl und zurück auf den Knopf", () => {
    expect(k).toMatch(/e\.key === "Escape"/);
    expect(k).toMatch(/erste\.current\?\.focus/);
    expect(k).toMatch(/knopf\.current\?\.focus\(\)/);
    expect(k).toMatch(/aria-expanded=/);
  });

  it("am Handy schließt ein resize das Blatt NICHT (Adressleiste)", () => {
    expect(k).toMatch(/if \(amKnopf\) \{\s*window\.addEventListener\("resize"/);
    expect(k).toMatch(/const BLATT_AM_KNOPF = "\(min-width: 561px\)"/);
    expect(block).toMatch(/@media \(max-width: 560px\)/);
  });

  it("nur transform/opacity, ease-out, unter 300 ms, mit Reduced-Motion und Reduced-Transparency", () => {
    const dauern = [...block.matchAll(/animation: \w+ (\d+)ms/g)].map((m) => Number(m[1]));
    expect(dauern.length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...dauern)).toBeLessThan(300);
    expect(block).not.toMatch(/\bease-in\b(?!-out)/);
    const keyframes = [...block.matchAll(/@keyframes \w+ \{([^}]*\}[^}]*)\}/g)].map((m) => m[1]);
    expect(keyframes.length).toBeGreaterThanOrEqual(6);
    for (const kf of keyframes) expect(kf.replace(/opacity|transform|from|to|[\s:;{}().%\d-]|scale|translateY|none/g, "")).toBe("");
    expect(block).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(block).toMatch(/@media \(prefers-reduced-transparency: reduce\)/);
  });

  it("grau im Hellen UND im Dunkeln (Theme-Schalter und Systemvorgabe)", () => {
    expect(block).toMatch(/:root \{\s*--wahl-flaeche: rgba\(242, 242, 247/);
    expect(block).toMatch(/\[data-theme="dark"\] \{\s*--wahl-flaeche: rgba\(44, 44, 46/);
    expect(block).toMatch(/:root:not\(\[data-theme\]\) \{\s*--wahl-flaeche: rgba\(44, 44, 46/);
  });
});

describe("Mieter: nur lesen — Spaltenschutz als Erlaubnisliste", () => {
  // Die jüngste Fassung je Funktion zählt (Migrationen in Reihenfolge).
  const dateien = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
  const juengste = (fn: string) => {
    let text = "";
    for (const f of dateien) {
      const s = lies(`supabase/migrations/${f}`);
      const i = s.indexOf(`create or replace function public.${fn}()`);
      if (i >= 0) text = s.slice(i, s.indexOf("$function$;", i));
    }
    return text;
  };

  it("anliegen: verglichen wird die ganze Zeile ohne die erlaubten Spalten", () => {
    const f = juengste("anliegen_mieter_spaltenschutz");
    expect(f).toMatch(/to_jsonb\(new\) - array\['termin_bestaetigt', 'updated_at'\]/);
    expect(f).toMatch(/is distinct from \(to_jsonb\(old\) - array\['termin_bestaetigt', 'updated_at'\]\)/);
    // Keine Sperrliste mehr: eine neue Spalte wäre dort still beschreibbar.
    expect(f).not.toMatch(/new\.titel is distinct from old\.titel/);
  });

  it("vermieter_anfragen: nur Status und Antwort", () => {
    const f = juengste("vermieter_anfragen_mieter_spaltenschutz");
    expect(f).toMatch(/to_jsonb\(new\) - array\['status', 'antwort', 'updated_at'\]/);
    expect(f).not.toMatch(/new\.titel is distinct from old\.titel/);
  });
});
