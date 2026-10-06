// Verknüpfungs-Audit 06.10.2026, Paket E — BuyImmo → MyImmo.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { objektAusKaufpruefung } from "@/lib/kauf/objektAusKaufpruefung";
import { darlehenAusWunschUrl, darlehenVorbelegung } from "@/lib/kauf/darlehenUebergabe";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";

const lies = (p: string) => readFileSync(p, "utf8");

describe("objektAusKaufpruefung()", () => {
  const basis = {
    adresse: "Lindenstr. 4, 23611 Bad Schwartau", kaufpreis: "249.000", flaeche: "72,5", baujahr: "1994",
    nutzung: "vermietung", kaltmiete: "780", objektTyp: "wohnung", anzahlWhg: "1", grundFlaeche: "", hausgeld: "310",
  };
  it("Wohnung zur Vermietung: deutsche Zahlen, Typ, Miete, Status", () => {
    // grundFlaeche ist gesetzt, gehört bei einer Wohnung aber nicht ins Objekt.
    const v = objektAusKaufpruefung("ETW Lindenstr.", { ...basis, grundFlaeche: "300" });
    expect(v).toMatchObject({
      bezeichnung: "ETW Lindenstr.", typ: "Eigentumswohnung", adresse: "Lindenstr. 4, 23611 Bad Schwartau",
      kaufpreis: 249000, flaeche: 72.5, baujahr: 1994, miete: 780, obj_status: "Vermietet",
      grundstuecksflaeche: null, einheiten_anzahl: null,
    });
  });
  it("Haus mit mehreren Wohnungen → Mehrfamilienhaus mit Einheiten; eins → Einfamilienhaus mit Grundstück", () => {
    expect(objektAusKaufpruefung("x", { ...basis, objektTyp: "haus", anzahlWhg: "4" })).toMatchObject({ typ: "Mehrfamilienhaus", einheiten_anzahl: 4, grundstuecksflaeche: null });
    expect(objektAusKaufpruefung("x", { ...basis, objektTyp: "haus", anzahlWhg: "1", grundFlaeche: "450" })).toMatchObject({ typ: "Einfamilienhaus", einheiten_anzahl: null, grundstuecksflaeche: 450 });
  });
  it("Eigennutzung: keine Miete, Status selbst bewohnt, das Kostenfeld wird kein Hausgeld", () => {
    const v = objektAusKaufpruefung("x", { ...basis, nutzung: "eigennutzung" });
    expect(v.miete).toBeNull();
    expect(v.obj_status).toBe("Selbst bewohnt");
    expect(v).not.toHaveProperty("hausgeld");
  });
  it("leere oder unplausible Felder bleiben leer statt 0", () => {
    const v = objektAusKaufpruefung("", { kaufpreis: "", flaeche: "0", baujahr: "198", adresse: "  " });
    expect(v).toMatchObject({ kaufpreis: null, flaeche: null, baujahr: null, adresse: null, bezeichnung: "Neues Objekt" });
  });
  it("ohne Namen trägt das Objekt die Adresse", () => {
    expect(objektAusKaufpruefung(null, basis).bezeichnung).toBe(basis.adresse);
  });
});

describe("Finanzierungswunsch → Darlehen", () => {
  const wunsch = { darlehen: 210000, sollzins: 3.6, anfangstilgung: 2, monatsrate: 980.4, zinsbindung: 15 };
  it("Wunsch → Adresse → Vorbelegung (Hin- und Rückweg)", () => {
    const url = darlehenAusWunschUrl(wunsch)!;
    expect(url.startsWith("/kredite/new?")).toBe(true);
    const q = Object.fromEntries(new URL(url, "https://x").searchParams);
    expect(q.back).toBe("/abschluss");
    expect(darlehenVorbelegung(q)).toEqual({ betrag: 210000, zinssatz: 3.6, tilgungssatz: 2, rateWunsch: 980, bindungJahre: 15 });
  });
  it("ohne Betrag kein Link; Unsinn aus Adresse oder Speicher fällt weg", () => {
    expect(darlehenAusWunschUrl(null)).toBeNull();
    expect(darlehenAusWunschUrl({ darlehen: 0 })).toBeNull();
    expect(darlehenAusWunschUrl("x")).toBeNull();
    expect(darlehenVorbelegung({ betrag: "abc", zins: "99", tilgung: "-1", rate: "", bindung: "100" })).toEqual({
      betrag: null, zinssatz: null, tilgungssatz: null, rateWunsch: null, bindungJahre: null,
    });
  });
  it("die Monatsrate wird NICHT vorbelegt — nur als Hinweis gezeigt (Paket A4)", () => {
    const s = lies("app/(app)/kredite/new/page.tsx");
    expect(s).toMatch(/name="monatsrate" placeholder="850" required \/>/);
    expect(s).toMatch(/vb\.rateWunsch != null &&/);
    expect(s).toMatch(/name="betrag"[^>]*defaultValue=\{vb\.betrag/);
  });
});

describe("createProperty verknüpft die Kaufprüfung", () => {
  afterEach(() => {
    for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  });
  async function lade(init = {}) {
    vi.resetModules();
    delete process.env.BILLING_ENFORCED;
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/properties");
    return { db, mod };
  }
  const form = (extra: Record<string, string> = {}) =>
    fd({ bezeichnung: "ETW Lindenstr.", typ: "Eigentumswohnung", obj_status: "Selbst bewohnt", ...extra });

  it("setzt uebernommen_prop_id nur an der eigenen, noch offenen Kaufprüfung", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p-neu" }, kalkulationen: { id: "k1" } } });
    const ziel = await fangeRedirect(() => mod.createProperty(form({ aus_kalkulation: "k1" })));
    const upd = db.zugriffe.find((a) => a.tabelle === "kalkulationen" && a.op === "update")!;
    expect(upd.daten).toEqual({ uebernommen_prop_id: "p-neu" });
    expect(upd.filter).toEqual(expect.arrayContaining(["eq:id=k1", "eq:user_id=nutzer-1", "is:uebernommen_prop_id=null"]));
    expect(ziel).toContain("/properties/p-neu");
    expect(decodeURIComponent(ziel)).not.toContain("nicht mit dem Objekt verknüpfen");
  });
  it("scheitert die Verknüpfung (schon übernommen), bleibt das Objekt — mit Hinweis", async () => {
    const { mod } = await lade({ antworten: { properties: { id: "p-neu" }, kalkulationen: null } });
    const ziel = await fangeRedirect(() => mod.createProperty(form({ aus_kalkulation: "k1" })));
    expect(ziel).toContain("/properties/p-neu");
    expect(decodeURIComponent(ziel)).toContain("nicht mit dem Objekt verknüpfen");
  });
  it("Datenbankfehler bei der Verknüpfung → ebenfalls Hinweis, kein Abbruch", async () => {
    const { mod } = await lade({ antworten: { properties: { id: "p-neu" }, kalkulationen: { id: "k1" } }, fehlerBei: { "kalkulationen:update": { message: "x" } } });
    const ziel = await fangeRedirect(() => mod.createProperty(form({ aus_kalkulation: "k1" })));
    expect(decodeURIComponent(ziel)).toContain("nicht mit dem Objekt verknüpfen");
  });
  it("ohne Kaufprüfung kein Zugriff auf kalkulationen", async () => {
    const { db, mod } = await lade({ antworten: { properties: { id: "p-neu" } } });
    await fangeRedirect(() => mod.createProperty(form()));
    expect(db.zugriffe.some((a) => a.tabelle === "kalkulationen")).toBe(false);
  });
});

describe("Oberfläche", () => {
  it("/properties/new belegt nur eigene, noch nicht übernommene Kaufprüfungen vor", () => {
    const s = lies("app/(app)/properties/new/page.tsx");
    expect(s).toMatch(/\.eq\("user_id", user\?\.id \?\? ""\)/);
    expect(s).toMatch(/if \(k\?\.uebernommen_prop_id\) schonUebernommen/);
    expect(s).toMatch(/ausKalkulation=\{vorbelegung \? aus : undefined\}/);
  });
  it("PropertyForm: Vorbelegung nur bei Neuanlage, das gespeicherte Objekt gewinnt", () => {
    const s = lies("components/PropertyForm.tsx");
    expect(s).toMatch(/const quelle: Partial<Property> \| undefined = property \?\? vorbelegung;/);
    expect(s).toMatch(/\{!property && ausKalkulation && <input type="hidden" name="aus_kalkulation"/);
  });
  it("/abschluss listet Kaufprüfungen mit Weg zum Objekt bzw. zur Übernahme", () => {
    const s = lies("app/(app)/abschluss/page.tsx");
    expect(s).toMatch(/\/properties\/new\?aus=\$\{encodeURIComponent\(k\.id\)\}/);
    expect(s).toMatch(/k\.uebernommen_prop_id \?/);
    expect(s).toMatch(/<DarlehenAusWunsch \/>/);
    expect(lies("lib/aufbauDaten.ts")).toMatch(/select\("id,name,summary,created_at,uebernommen_prop_id"\)/);
  });
});
