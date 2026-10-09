// Paket P3 der Gesamtprüfung (docs/AUDIT-2026-10-07-gesamt.md): die SCHRANKE auf dem Server.
// Die Oberfläche sperrt die Knöpfe schon — geprüft wird hier, dass ein Aufruf am Formular vorbei
// (PDF-Route, „Im Archiv ablegen“, „Ins Mieterportal“) an denselben Regeln scheitert.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { pdfZeilen, pdfTexte } from "./stubs/pdfText";
import { DEFAULT_VORLAGEN } from "@/lib/dokumentVorlagen";
import type { BriefFields } from "@/lib/pdf/erzeugen";

const lies = (p: string) => readFileSync(p, "utf8");

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/pdf/docPdf"]) vi.doUnmock(m);
});

const MIETER = {
  vorname: "Anna", nachname: "Weber", weitere_mieter: "Ben Weber", mieter_adresse: "Lindenstr. 1, 23611 Bad Schwartau",
  einheit: "EG links", prop_id: "obj-1", kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: 0,
  mietbeginn: "2022-01-01", letzte_erhoehung: null, iban: null,
};

const OBJEKT = { bezeichnung: "MFH Lindenstraße", adresse: "Lindenstr. 1, 23611 Bad Schwartau" };

const KUENDIGUNG: BriefFields = {
  art: "kuendigung", datum: "2027-01-31", betrag: "", grund: "Eigenbedarf für meine Tochter.", ibanId: "",
  vName: "Max Muster", vAdr: "Hauptstr. 2, 23611 Bad Schwartau", text: DEFAULT_VORLAGEN.kuendigung, signieren: "1", zugang: "2026-10-07",
};

type Erfasst = { anrede?: string; empfaengerNamen?: string[]; absender: { name: string }; unterschriftPng?: string | null; absaetze: string[] };

/** erzeugeBriefPdf mit gefälschter Datenbank; buildDocPdf wird abgefangen, damit seine Eingabe sichtbar ist. */
async function erzeuge(f: BriefFields, mieter: Record<string, unknown> = MIETER, extra: Record<string, unknown> = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase({
    antworten: { mieter, properties: OBJEKT, vermieter_profil: null, unterschriften: { data: "data:image/png;base64,AAAA" }, miet_zeitraeume: [], ...extra },
  });
  const erfasst: Erfasst[] = [];
  vi.doMock("@/lib/pdf/docPdf", () => ({
    buildDocPdf: async (d: Erfasst) => {
      erfasst.push(d);
      return new Uint8Array([37, 80, 68, 70]);
    },
  }));
  const { erzeugeBriefPdf } = await import("@/lib/pdf/erzeugen");
  const r = await erzeugeBriefPdf(client as never, "nutzer-1", "m1", f);
  return { r, erfasst, db };
}

describe("erzeugeBriefPdf — dieselbe Prüfung wie die Vorschau", () => {
  it("B42: ohne Absender kein PDF — kein Rückfall auf „MyImmo“", async () => {
    const { r, erfasst } = await erzeuge({ ...KUENDIGUNG, vName: "" });
    expect(r).toEqual({ abgelehnt: [expect.stringMatching(/Absender \(Name\)/)] });
    expect(erfasst).toHaveLength(0);
    expect(lies("lib/pdf/erzeugen.ts")).not.toMatch(/"MyImmo"/);
  });
  it("B42 gilt für JEDE Art, auch die Mahnung", async () => {
    const { r } = await erzeuge({ ...KUENDIGUNG, art: "mahnung", text: DEFAULT_VORLAGEN.mahnung, betrag: "950", datum: "2026-10-20", vName: "" });
    expect(r).toMatchObject({ abgelehnt: [expect.stringMatching(/Absender/)] });
  });
  it("A8/B40: Kündigung ohne Grund, ohne Zugang, nicht zum Monatsende oder zu früh → kein PDF", async () => {
    expect((await erzeuge({ ...KUENDIGUNG, grund: " " })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/Begründung/)] });
    expect((await erzeuge({ ...KUENDIGUNG, zugang: "" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/Zugang beim Mieter/)] });
    expect((await erzeuge({ ...KUENDIGUNG, datum: "2027-01-01" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/Ende eines Monats/)] });
    expect((await erzeuge({ ...KUENDIGUNG, datum: "2026-12-31" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/Frühestens zum 31\.01\.2027/)] });
  });
  it("A7: Mieterhöhung ohne Begründung oder mit offener Lücke → kein PDF", async () => {
    const mh: BriefFields = { ...KUENDIGUNG, art: "mieterhoehung", text: DEFAULT_VORLAGEN.mieterhoehung, betrag: "850", datum: "2027-01-01", grund: "" };
    expect((await erzeuge(mh)).r).toMatchObject({ abgelehnt: [expect.stringMatching(/Begründung/)] });
    expect((await erzeuge({ ...mh, grund: "Mietspiegel [Gemeinde, Stand]" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/Lücken/)] });
    expect((await erzeuge({ ...mh, datum: "2026-12-01", grund: "Mietspiegel Lübeck 2025, Feld C3" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/frühestens 01\.01\.2027/)] });
  });
  it("gültige Kündigung: PDF an ALLE Vertragspartner, Anrede je Person, ohne eingebettete Unterschrift (§ 126 BGB)", async () => {
    const { r, erfasst, db } = await erzeuge(KUENDIGUNG);
    expect(r).toMatchObject({ dateiname: "kuendigung_Anna_Weber.pdf" });
    const d = erfasst[0];
    expect(d.absender.name).toBe("Max Muster");
    expect(d.empfaengerNamen).toEqual(["Anna Weber", "Ben Weber"]);
    expect(d.anrede).toBe("Sehr geehrte/r Anna Weber, sehr geehrte/r Ben Weber,");
    expect(d.unterschriftPng).toBeNull();
    expect(db.zugriffe.some((z) => z.tabelle === "unterschriften")).toBe(false);
    expect(d.absaetze.join(" ")).toMatch(/Eigenbedarf für meine Tochter/);
    expect(d.absaetze.join(" ")).toMatch(/Textform .* zwei Monate vor der Beendigung/);
  });
  it("Gegenprobe: bei der Mahnung wird die E-Signatur weiter eingebettet", async () => {
    const { erfasst } = await erzeuge({ ...KUENDIGUNG, art: "mahnung", text: DEFAULT_VORLAGEN.mahnung, betrag: "950", datum: "2026-10-20", monat: "2026-10" });
    expect(erfasst[0].unterschriftPng).toBe("data:image/png;base64,AAAA");
  });
  it("{{mieter}} nennt alle — Quittung „Anna Weber und Ben Weber“", async () => {
    const { erfasst } = await erzeuge({ ...KUENDIGUNG, art: "mietquittung", text: DEFAULT_VORLAGEN.mietquittung, datum: "2026-10-01", signieren: "", betrag: "1070", monat: "2026-10" });
    expect(erfasst[0].absaetze[0]).toMatch(/dass Anna Weber und Ben Weber für das Mietobjekt/);
  });
  it("{{miete}} = die HEUTE geltende Kaltmiete laut Miet-Zeitraum (wie die Vorschau), nicht das Mieterfeld", async () => {
    const z = [{ von: "2024-01-01", bis: null, kaltmiete: 910, nk_vorauszahlung: 150, stellplatz_miete: 0 }];
    const { erfasst } = await erzeuge({ ...KUENDIGUNG, art: "allgemein", text: "Miete {{miete}}", signieren: "" }, MIETER, { miet_zeitraeume: z });
    expect(erfasst[0].absaetze[0]).toMatch(/^Miete 910,00/);
  });
  it("leere Platzhalter scheitern auch auf dem Server (vorher nur in der Vorschau)", async () => {
    const { r } = await erzeuge({ ...KUENDIGUNG, art: "zahlungserinnerung", text: DEFAULT_VORLAGEN.zahlungserinnerung, datum: "", signieren: "" });
    expect(r).toMatchObject({ abgelehnt: [expect.stringMatching(/\{\{datum\}\}/)] });
  });
});

describe("PDF-Route und Archiv", () => {
  it("die Route antwortet mit 400 und dem Grund, statt ein PDF zu liefern", async () => {
    vi.resetModules();
    const { client } = fakeSupabase({ antworten: { mieter: MIETER, properties: OBJEKT, vermieter_profil: null, miet_zeitraeume: [] } });
    mockeNextUndSupabase(client);
    const { POST } = await import("@/app/(app)/tenants/[id]/dokument/pdf/route");
    const form = new FormData();
    for (const [k, v] of Object.entries({ ...KUENDIGUNG, grund: "" })) form.append(k, String(v ?? ""));
    const r = await POST(new Request("http://localhost/tenants/m1/dokument/pdf", { method: "POST", body: form }) as never, { params: Promise.resolve({ id: "m1" }) });
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/Begründung/);
  });
  it("A8: Kündigung lässt sich nicht ins Mieterportal stellen — die Schranke greift vor jeder Abfrage", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({ antworten: { mieter: MIETER } });
    mockeNextUndSupabase(client);
    const { speichereBrief } = await import("@/lib/actions/dokumente");
    const r = await speichereBrief("m1", KUENDIGUNG, { zustellen: true });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/eigenhändig unterschrieben/) });
    expect(db.zugriffe.some((z) => z.tabelle === "notizen" || z.tabelle === "zustellungen")).toBe(false);
  });
  it("Archiv-Kopie einer abgelehnten Kündigung: Fehlermeldung statt Eintrag", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({ antworten: { mieter: MIETER, properties: OBJEKT, vermieter_profil: null, miet_zeitraeume: [] } });
    mockeNextUndSupabase(client);
    const { speichereBrief } = await import("@/lib/actions/dokumente");
    const r = await speichereBrief("m1", { ...KUENDIGUNG, datum: "2026-12-31" });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/Frühestens zum 31\.01\.2027/) });
    expect(db.zugriffe.some((z) => z.tabelle === "notizen" && z.op === "insert")).toBe(false);
  });
});

describe("B44 — Mieterformular", () => {
  it("„Weitere Mieter laut Vertrag“ wird gespeichert (gekürzt, leer = null)", async () => {
    vi.resetModules();
    const { db, client } = fakeSupabase({});
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/tenants");
    await fangeRedirect(() => mod.createTenant(fd({ nachname: "Weber", weitere_mieter: "  Ben Weber\nClara Weber  " })));
    expect(db.zugriffe.find((z) => z.tabelle === "mieter" && z.op === "insert")?.daten?.weitere_mieter).toBe("Ben Weber\nClara Weber");
    vi.resetModules();
    const zwei = fakeSupabase({});
    mockeNextUndSupabase(zwei.client);
    const mod2 = await import("@/lib/actions/tenants");
    await fangeRedirect(() => mod2.createTenant(fd({ nachname: "Weber", weitere_mieter: "   " })));
    expect(zwei.db.zugriffe.find((z) => z.tabelle === "mieter" && z.op === "insert")?.daten?.weitere_mieter).toBeNull();
  });
  it("das Formular hat das Feld; die Migration legt die Spalte an", () => {
    expect(lies("components/TenantForm.tsx")).toMatch(/name="weitere_mieter"/);
    expect(lies("supabase/migrations/20261008120000_mieter_weitere_vertragspartner.sql")).toMatch(/add column if not exists weitere_mieter text/);
  });
});

describe("Brief-Generator (Oberfläche)", () => {
  const dg = lies("components/DocGenerator.tsx");
  it("Kündigung: kein Versand per Mail/Portal, keine E-Signatur, stattdessen der Schriftform-Hinweis", () => {
    expect(dg).toMatch(/\{!blockiert && !nurPapier && \(\s*<BriefVersand/);
    expect(dg).toMatch(/\{nurPapier \? \(/);
    expect(dg).toMatch(/signieren: signieren && !nurPapier \? "1" : ""/);
    expect(dg).toMatch(/schriftform\.text/);
  });
  it("Fehler sperren PDF, Archiv und Versand; der Zugang geht mit ins Formular", () => {
    expect(dg).toMatch(/disabled=\{ablegen \|\| blockiert\}/);
    expect(dg).toMatch(/\{blockiert \? \(\s*<button type="button" className="btn btn-gold" disabled>/);
    expect(dg).toMatch(/<input type="hidden" name="zugang" value=\{zugang\} \/>/);
  });
  it("Vorschau und PDF nennen alle Vertragspartner", () => {
    expect(dg).toMatch(/empfaenger=\{\[\.\.\.empfaengerNamenZeilen\(namen\), \.\.\.empfZeilen\]\}/);
    expect(dg).toMatch(/<p>\{anrede\(namen\)\}<\/p>/);
  });
});

describe("/vorlagen wirbt nur mit dem, was gebaut ist (§ 5 UWG)", () => {
  it("keine außerordentliche Kündigung, keine „korrekte Begründung“ als Versprechen", () => {
    const v = lies("app/(pub)/vorlagen/page.tsx");
    expect(v).not.toMatch(/außerordentliche/);
    expect(v).not.toMatch(/korrekter Begründung/);
    expect(v).toMatch(/§ 573c BGB berechnet/);
  });
});

describe("B44 — das ECHTE PDF (lib/pdf/docPdf.ts)", () => {
  const basis = { titel: "Kündigung des Mietverhältnisses", absender: { name: "Max Muster" }, empfaengerAdresse: "Lindenstr. 1, 23611 Bad Schwartau", objekt: "MFH", absaetze: ["Text."] };
  it("je Vertragspartner eine Zeile im Adressfeld, Anschrift unter dem letzten; Anrede an alle", async () => {
    const { buildDocPdf } = await import("@/lib/pdf/docPdf");
    const z = pdfZeilen(await buildDocPdf({ ...basis, empfaengerName: "Anna Weber und Ben Weber", empfaengerNamen: ["Anna Weber", "Ben Weber"], anrede: "Sehr geehrte/r Anna Weber, sehr geehrte/r Ben Weber," }));
    const i = z.indexOf("Anna Weber");
    expect(z.slice(i, i + 4)).toEqual(["Anna Weber", "Ben Weber", "Lindenstr. 1", "23611 Bad Schwartau"]);
    expect(z).toContain("Sehr geehrte/r Anna Weber, sehr geehrte/r Ben Weber,");
  });
  it("eine lange Anrede wird umbrochen statt in den Rand zu laufen; ohne Angabe bleibt die alte Anrede", async () => {
    const { buildDocPdf } = await import("@/lib/pdf/docPdf");
    const lang = "Sehr geehrte/r Anna-Lena Weber-Schmidt, sehr geehrte/r Benjamin Weber-Schmidt, sehr geehrte/r Clara Weber-Schmidt,";
    const z = pdfZeilen(await buildDocPdf({ ...basis, empfaengerName: "X", anrede: lang }));
    const i = z.findIndex((t) => t.startsWith("Sehr geehrte/r Anna-Lena"));
    const teile = z.slice(i, i + 2);
    expect(teile[0]).not.toBe(lang); // nicht in einer Zeile
    expect(teile.join(" ")).toBe(lang);
    // Zweite Zeile eine Zeilenhöhe tiefer — nicht übereinander gedruckt; der Brieftext folgt darunter.
    const mitY = pdfTexte(await buildDocPdf({ ...basis, empfaengerName: "X", anrede: lang }));
    const [a, b, text] = mitY.slice(i, i + 3);
    expect(a.y - b.y).toBeGreaterThanOrEqual(12);
    expect(b.y - text.y).toBeGreaterThanOrEqual(12);
    const alt = pdfZeilen(await buildDocPdf({ ...basis, empfaengerName: "Anna Weber" }));
    expect(alt).toContain("Sehr geehrte/r Anna Weber,");
  });
});
