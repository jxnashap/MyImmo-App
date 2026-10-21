import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockeNextUndSupabase } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";

// B08 (Prüfstand 11.10.2026): Auswertungen — vollständig oder gar nicht.
//
// Vorher luden Dashboard, Ein- & Ausgaben, Jahresbericht, DATEV- und Buchungs-Export ohne `.range()`
// und werteten `error` nicht aus. Die Attrappe `speicherDb` schneidet wie PostgREST still nach 1.000
// Zeilen ab — ein Test gegen sie fällt also auf, wenn wieder ohne Blättern geladen wird.

const U = "nutzer-1";
beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  vi.unstubAllEnvs();
});

/** 1.500 Einnahmen in 2025 (je 1 €) und eine fremde. */
const vieleEinnahmen = () => [
  ...Array.from({ length: 1500 }, (_, i) => ({
    id: `e${String(i).padStart(5, "0")}`, user_id: U, buchungsdatum: `2025-${String((i % 12) + 1).padStart(2, "0")}-03`,
    betrag: 1, kategorie: "Miete", beschreibung: "Miete", prop_id: "p1", nk_anteil: null,
  })),
  { id: "fremd", user_id: "anderer", buchungsdatum: "2025-01-03", betrag: 999, kategorie: "Miete", beschreibung: "x", prop_id: "p9" },
];

describe("alleZeilen / vielleichtAlle", () => {
  it("blättert über die 1.000er-Grenze, filtert und sortiert stabil", async () => {
    const { alleZeilen, nurKonto } = await import("@/lib/db/auswertung");
    const db = speicherDb({ tabellen: { einnahmen: vieleEinnahmen() } });
    const rows = await alleZeilen<{ id: string }>(db.client as never, "einnahmen", "*", nurKonto(U));
    expect(rows).toHaveLength(1500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1500);
    expect(db.protokoll.filter((p) => p.tabelle === "einnahmen").length).toBe(2);
  });

  it("ein Fehler auf einer späteren Seite wirft — es gibt kein Teilergebnis", async () => {
    const { alleZeilen, vielleichtAlle, nurKonto } = await import("@/lib/db/auswertung");
    const { DatenUnvollstaendig } = await import("@/lib/db/ladeAlle");
    const db = speicherDb({ tabellen: { einnahmen: vieleEinnahmen() }, fehlerAbSeite: { einnahmen: 1 } });
    await expect(alleZeilen(db.client as never, "einnahmen", "*", nurKonto(U))).rejects.toBeInstanceOf(DatenUnvollstaendig);
    const db2 = speicherDb({ tabellen: { einnahmen: vieleEinnahmen() }, fehlerAbSeite: { einnahmen: 1 } });
    expect(await vielleichtAlle(db2.client as never, "einnahmen", "*", nurKonto(U))).toBeNull();
  });

  it("unvollstaendigAntwort: 503 mit Klartext; andere Fehler werden weitergeworfen", async () => {
    const { unvollstaendigAntwort } = await import("@/lib/db/auswertung");
    const { DatenUnvollstaendig } = await import("@/lib/db/ladeAlle");
    const r = unvollstaendigAntwort(new DatenUnvollstaendig("kosten", "reset"));
    expect(r.status).toBe(503);
    expect(await r.text()).toMatch(/nicht vollständig geladen/);
    expect(() => unvollstaendigAntwort(new Error("anders"))).toThrow("anders");
  });
});

async function ladeRoute(pfad: string, init: NonNullable<Parameters<typeof speicherDb>[0]>) {
  vi.resetModules();
  const db = speicherDb({ ...init, tabellen: { nutzer_rollen: [{ user_id: U, rolle: "vermieter" }], properties: [{ id: "p1", user_id: U, bezeichnung: "Haus" }], kosten: [], kredite: [], ...init.tabellen } });
  mockeNextUndSupabase(db.client);
  return { db, mod: await import(pfad) };
}

describe("Exporte: alle Buchungen oder 503", () => {
  it("DATEV: 1.500 Buchungen eines Jahres stehen ALLE im Stapel, fremde nicht", async () => {
    const { mod } = await ladeRoute("@/app/api/export/datev/route", { tabellen: { einnahmen: vieleEinnahmen() } });
    const r: Response = await mod.GET(new Request("https://x.test/api/export/datev?jahr=2025"));
    expect(r.status).toBe(200);
    const text = await r.text();
    // Kopf (2 Zeilen) + 1.500 Buchungen
    expect(text.trim().split(/\r?\n/).length).toBe(1502);
    expect(text).not.toContain("999,00");
  });

  it("DATEV: scheitert eine Seite, gibt es KEINEN Stapel", async () => {
    const { mod } = await ladeRoute("@/app/api/export/datev/route", { tabellen: { einnahmen: vieleEinnahmen() }, fehlerAbSeite: { einnahmen: 1 } });
    const r: Response = await mod.GET(new Request("https://x.test/api/export/datev?jahr=2025"));
    expect(r.status).toBe(503);
    expect(r.headers.get("Content-Disposition")).toBeNull();
  });

  it("Buchungs-CSV: 1.500 Einnahmen vollständig; Kostenfehler → 503", async () => {
    const ok = await ladeRoute("@/app/api/export/buchungen/route", { tabellen: { einnahmen: vieleEinnahmen() } });
    const r: Response = await ok.mod.GET();
    expect(r.status).toBe(200);
    expect((await r.text()).trim().split(/\r?\n/).length).toBe(1501); // Kopf + 1.500
    const kaputt = await ladeRoute("@/app/api/export/buchungen/route", { tabellen: { einnahmen: vieleEinnahmen() }, fehlerBei: { "kosten:select": "reset" } });
    expect((await kaputt.mod.GET()).status).toBe(503);
  });
});

describe("Jahresbericht-PDF: kein PDF aus einem Teilbestand", () => {
  it("scheitert eine Seite der Kosten, antwortet die Route 503", async () => {
    const { mod } = await ladeRoute("@/app/api/berichte/jahresbericht/route", {
      tabellen: { einnahmen: vieleEinnahmen(), vermieter_profil: [] }, fehlerAbSeite: { einnahmen: 1 },
    });
    const req = Object.assign(new Request("https://x.test/api/berichte/jahresbericht?jahr=2025"), { nextUrl: new URL("https://x.test/api/berichte/jahresbericht?jahr=2025") });
    const r: Response = await mod.GET(req);
    expect(r.status).toBe(503);
  });
});

describe("Nebenkosten-Lader", () => {
  it("ladeVorauszahlung: über 1.000 Mietbuchungen vollständig; ein Lesefehler wirft statt „keine Vorauszahlung“", async () => {
    const buchungen = Array.from({ length: 1100 }, (_, i) => ({
      id: `b${String(i).padStart(5, "0")}`, mieter_id: "m1", kategorie: "Miete",
      buchungsdatum: i < 1088 ? "2020-01-03" : `2025-${String(i - 1087).padStart(2, "0")}-03`,
      soll_monat: null, nk_anteil: 100,
    }));
    vi.resetModules();
    const db = speicherDb({ tabellen: { einnahmen: buchungen, miet_zeitraeume: [] } });
    vi.doMock("server-only", () => ({}));
    mockeNextUndSupabase(db.client);
    const { ladeVorauszahlung } = await import("@/lib/nkDaten");
    expect(await ladeVorauszahlung("m1", 2025)).toEqual({ gebucht: 1200, gebuchteMonate: 12, zeitraeume: [] });

    vi.resetModules();
    const kaputt = speicherDb({ tabellen: { einnahmen: buchungen, miet_zeitraeume: [] }, fehlerAbSeite: { einnahmen: 1 } });
    vi.doMock("server-only", () => ({}));
    mockeNextUndSupabase(kaputt.client);
    const m2 = await import("@/lib/nkDaten");
    await expect(m2.ladeVorauszahlung("m1", 2025)).rejects.toThrow(/nicht vollständig/);
  });

  it("ladeNkPositionen: scheitert das Lesen der Positionen, gibt es keine Abrechnung ohne Kosten", async () => {
    const { ladeNkPositionen } = await import("@/lib/nkPositionen");
    const db = speicherDb({ tabellen: { mieter_positionen: [{ id: "x", mieter_id: "m1", bezeichnung: "Wasser", betrag: 300 }] }, fehlerBei: { "mieter_positionen:select": "reset" } });
    await expect(ladeNkPositionen(db.client as never, { id: "m1", prop_id: null }, 2025)).rejects.toThrow(/nicht vollständig/);
  });

  it("nkAmObjekt: ein Lesefehler ist kein „nein“", async () => {
    const { nkAmObjekt } = await import("@/lib/nkPositionen");
    const db = speicherDb({ tabellen: { properties: [{ id: "p1", typ: "Mehrfamilienhaus", einheiten_anzahl: 3 }], mieter: [], nk_objekt_kosten: [] }, fehlerBei: { "mieter:select": "reset" } });
    await expect(nkAmObjekt(db.client as never, "p1")).rejects.toThrow(/nicht vollständig/);
  });
});

// Die Seiten selbst ausführen (Server-Komponenten sind async-Funktionen): Scheitert eine Grundlage,
// muss die Seite WERFEN (Fehlerkarte), statt eine Zahl aus einem Teilbestand zu rendern.
async function ladeSeite(pfad: string, init: NonNullable<Parameters<typeof speicherDb>[0]>) {
  vi.resetModules();
  const db = speicherDb({
    ...init,
    tabellen: {
      nutzer_rollen: [{ user_id: U, rolle: "vermieter" }],
      properties: [{ id: "p1", user_id: U, bezeichnung: "Haus", typ: "Mehrfamilienhaus", einheiten_anzahl: 3, kaufpreis: 300000 }],
      kosten: [], kredite: [], mieter: [], miet_zeitraeume: [], bewertung_historie: [], wiederkehrende_buchungen: [],
      termine: [], anliegen: [], zaehlerstand_meldungen: [], vertreter: [], frist_ausgeblendet: [], notizen: [], zustellungen: [],
      vermieter_profil: [], nk_objekt_kosten: [], nk_objekt_jahr: [], mieter_positionen: [], nk_co2: [],
      ...init.tabellen,
    },
  });
  vi.doMock("server-only", () => ({}));
  vi.doMock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
  mockeNextUndSupabase(db.client);
  const mod = await import(pfad);
  return { db, Seite: mod.default as (p: unknown) => Promise<unknown> };
}

/** Alle Texte eines React-Elementbaums (ohne Rendern; Kreisbezüge werden übersprungen). */
function texte(knoten: unknown, gesehen = new Set<unknown>()): string {
  if (knoten == null || typeof knoten === "boolean") return "";
  if (typeof knoten === "string" || typeof knoten === "number") return String(knoten);
  if (typeof knoten !== "object" || gesehen.has(knoten)) return "";
  gesehen.add(knoten);
  if (Array.isArray(knoten)) return knoten.map((k) => texte(k, gesehen)).join(" ");
  const props = (knoten as { props?: Record<string, unknown> }).props;
  if (!props) return "";
  return Object.entries(props).filter(([k]) => k !== "dangerouslySetInnerHTML").map(([, v]) => texte(v, gesehen)).join(" ");
}

describe("Seiten: Fehlerkarte statt Teilbestand", () => {
  const fall = (name: string, pfad: string, args: unknown) => {
    it(`${name}: rendert mit 1.500 Buchungen, wirft bei einem Fehler auf Seite 2`, async () => {
      const ok = await ladeSeite(pfad, { tabellen: { einnahmen: vieleEinnahmen() } });
      await expect(ok.Seite(args)).resolves.toBeTruthy();
      const kaputt = await ladeSeite(pfad, { tabellen: { einnahmen: vieleEinnahmen() }, fehlerAbSeite: { einnahmen: 1 } });
      await expect(kaputt.Seite(args)).rejects.toThrow(/nicht vollständig/);
    });
  };
  fall("Dashboard", "@/app/(app)/page", { searchParams: Promise.resolve({}) });
  fall("Ein- & Ausgaben", "@/app/(app)/cashflow/page", { searchParams: Promise.resolve({}) });
  fall("Jahresbericht", "@/app/(app)/jahresbericht/page", { searchParams: Promise.resolve({ year: "2025" }) });

  it("Ein- & Ausgaben und Jahresbericht ZEIGEN die Summe aller 1.500 Buchungen (nicht die ersten 1.000)", async () => {
    const { euro } = await import("@/lib/format");
    const cf = await ladeSeite("@/app/(app)/cashflow/page", { tabellen: { einnahmen: vieleEinnahmen() } });
    const cfText = texte(await cf.Seite({ searchParams: Promise.resolve({ jahr: "2025" }) }));
    expect(cfText).toContain(euro(1500));
    expect(cfText).not.toContain(euro(1000));
    const jb = await ladeSeite("@/app/(app)/jahresbericht/page", { tabellen: { einnahmen: vieleEinnahmen() } });
    expect(texte(await jb.Seite({ searchParams: Promise.resolve({ year: "2025" }) }))).toContain(euro(1500));
  });

  it("Dashboard: fehlt eine AUFGABENquelle, rendert es — und die Liste nennt die Lücke", async () => {
    const { Seite } = await ladeSeite("@/app/(app)/page", { tabellen: {}, fehlerBei: { "anliegen:select": "reset" } });
    const html = texte(await Seite({ searchParams: Promise.resolve({}) }));
    // Seit 21.10.2026 zwei Abfragen an `anliegen` (offene + bestätigte Termine) — beide fallen aus.
    expect(html).toMatch(/Unvollständig: Mieter-Anliegen(, [^—]+)? konnten nicht geladen werden/);
    expect(html).not.toContain("Alles erledigt");
  });

  it("NK-Seite des Mieters: CO₂- oder Kostenfehler → Fehlerkarte", async () => {
    const tabellen = {
      mieter: [{ id: "m1", user_id: U, prop_id: "p1", vorname: "A", nachname: "B", mietbeginn: "2024-01-01", mietende: null, flaeche: 50, nk_vorauszahlung: 100 }],
      einnahmen: [],
    };
    const args = { params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve({ jahr: "2025" }) };
    const ok = await ladeSeite("@/app/(app)/tenants/[id]/nk/page", { tabellen });
    await expect(ok.Seite(args)).resolves.toBeTruthy();
    for (const stelle of ["nk_co2:select", "kosten:select", "mieter_positionen:select"]) {
      const k = await ladeSeite("@/app/(app)/tenants/[id]/nk/page", { tabellen, fehlerBei: { [stelle]: "reset" } });
      await expect(k.Seite(args), stelle).rejects.toThrow(/nicht vollständig/);
    }
  });

  it("NK-Seite des Objekts: Buchungs-, CO₂- oder Mieterfehler → Fehlerkarte", async () => {
    const tabellen = {
      mieter: [
        { id: "m1", user_id: U, prop_id: "p1", vorname: "A", nachname: "B", mietbeginn: "2024-01-01", mietende: null, flaeche: 50, nk_vorauszahlung: 100 },
        { id: "m2", user_id: U, prop_id: "p1", vorname: "C", nachname: "D", mietbeginn: "2024-01-01", mietende: null, flaeche: 60, nk_vorauszahlung: 120 },
      ],
      einnahmen: [],
    };
    const args = { params: Promise.resolve({ id: "p1" }), searchParams: Promise.resolve({ jahr: "2025" }) };
    const ok = await ladeSeite("@/app/(app)/properties/[id]/nebenkosten/page", { tabellen });
    await expect(ok.Seite(args)).resolves.toBeTruthy();
    for (const stelle of ["kosten:select", "nk_co2:select"]) {
      const k = await ladeSeite("@/app/(app)/properties/[id]/nebenkosten/page", { tabellen, fehlerBei: { [stelle]: "reset" } });
      await expect(k.Seite(args), stelle).rejects.toThrow(/nicht vollständig/);
    }
  });
});

describe("Nebenkosten: Objekt-Lader und PDF", () => {
  const mieter = [
    { id: "m1", user_id: U, prop_id: "p1", vorname: "A", nachname: "B", mietbeginn: "2024-01-01", mietende: null, flaeche: 50, nk_vorauszahlung: 100 },
    { id: "m2", user_id: U, prop_id: "p1", vorname: "C", nachname: "D", mietbeginn: "2024-01-01", mietende: null, flaeche: 60, nk_vorauszahlung: 120 },
  ];

  it("ladeNkObjekt: ohne Mieter würde alles auf den Leerstand verteilt — ein Lesefehler wirft", async () => {
    const { ladeNkObjekt } = await import("@/lib/nkPositionen");
    const db = speicherDb({ tabellen: { nk_objekt_kosten: [], nk_objekt_jahr: [], mieter }, fehlerBei: { "mieter:select": "reset" } });
    await expect(ladeNkObjekt(db.client as never, "p1", 2025)).rejects.toThrow(/nicht vollständig/);
  });

  it("ladeNkPositionen: ein Lesefehler am Objekt macht aus einem Mehrfamilienhaus kein Einzelobjekt", async () => {
    const { ladeNkPositionen } = await import("@/lib/nkPositionen");
    const db = speicherDb({ tabellen: { mieter_positionen: [], nk_objekt_kosten: [], nk_objekt_jahr: [], mieter, properties: [] }, fehlerBei: { "properties:select": "reset" } });
    await expect(ladeNkPositionen(db.client as never, { id: "m1", prop_id: "p1" }, 2025)).rejects.toThrow(/nicht vollständig/);
  });

  it("Sammel-PDF des Hauses: fehlt EINE Abrechnung, entsteht kein PDF", async () => {
    const tabellen = { mieter, einnahmen: [] };
    const req = (j: string) => Object.assign(new Request(`https://x.test/p?jahr=${j}`), { nextUrl: new URL(`https://x.test/p?jahr=${j}`) });
    const args = { params: Promise.resolve({ id: "p1" }) };
    const ok = await ladeSeite("@/app/(app)/properties/[id]/nebenkosten/pdf/route", { tabellen });
    const mod1 = await import("@/app/(app)/properties/[id]/nebenkosten/pdf/route");
    void ok;
    expect((await mod1.GET(req("2025") as never, args)).status).toBe(200);

    // Die Abrechnung von m2 scheitert am Laden des Mieters (z. B. Zeitüberlauf) — die Liste der Mieter nicht.
    await ladeSeite("@/app/(app)/properties/[id]/nebenkosten/pdf/route", { tabellen, fehlerWenn: (t, op, f) => (t === "mieter" && f.includes("eq:id=m2") ? "reset" : null) });
    const mod2 = await import("@/app/(app)/properties/[id]/nebenkosten/pdf/route");
    const r = await mod2.GET(req("2025") as never, { params: Promise.resolve({ id: "p1" }) });
    expect(r.status).toBe(503);
    expect(r.headers.get("Content-Type")).not.toBe("application/pdf");
  });

  it("Einzel-PDF: ein CO₂-Lesefehler gibt 503 statt eines PDFs ohne Gutschrift", async () => {
    await ladeSeite("@/app/(app)/tenants/[id]/nk/pdf/route", { tabellen: { mieter, einnahmen: [] }, fehlerBei: { "nk_co2:select": "reset" } });
    const mod = await import("@/app/(app)/tenants/[id]/nk/pdf/route");
    const r = await mod.GET(Object.assign(new Request("https://x.test/p?jahr=2025"), { nextUrl: new URL("https://x.test/p?jahr=2025") }) as never, { params: Promise.resolve({ id: "m1" }) });
    expect(r.status).toBe(503);
  });
});

describe("Mietkonto-Hinweise mit über 1.000 Mietbuchungen", () => {
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const monate = (n: number) => Array.from({ length: n }, (_, i) => {
    const [j, m] = heute.slice(0, 7).split("-").map(Number);
    const g = j * 12 + (m - 1) - i;
    return `${Math.floor(g / 12)}-${String((g % 12) + 1).padStart(2, "0")}`;
  });
  const mieterRow = { id: "m1", user_id: U, prop_id: "p1", vorname: "A", nachname: "B", mietbeginn: "2020-01-01", mietende: null, kaltmiete: 700, nk_vorauszahlung: 150, stellplatz_miete: null, minderungen: null };
  const alt = Array.from({ length: 1100 }, (_, i) => ({ id: `a${String(i).padStart(5, "0")}`, user_id: U, mieter_id: "m1", kategorie: "Miete", buchungsdatum: "2010-01-03", soll_monat: "2010-01", betrag: 1 }));
  const bezahlt = monate(14).map((ym, i) => ({ id: `z${String(i).padStart(3, "0")}`, user_id: U, mieter_id: "m1", kategorie: "Miete", buchungsdatum: `${ym}-01`, soll_monat: ym, betrag: 850 }));

  it("RueckstandWaechter: bezahlte Monate jenseits der ersten 1.000 Buchungen zählen — kein falscher Rückstand", async () => {
    const { Seite } = await ladeSeite("@/components/RueckstandWaechter", { tabellen: { mieter: [mieterRow], einnahmen: [...alt, ...bezahlt] } });
    expect(await Seite({})).toBeNull();
  });

  it("RueckstandWaechter: Lesefehler → Hinweis statt Rückstand", async () => {
    const { Seite } = await ladeSeite("@/components/RueckstandWaechter", { tabellen: { mieter: [mieterRow], einnahmen: [...alt, ...bezahlt] }, fehlerAbSeite: { einnahmen: 1 } });
    const t = texte(await Seite({}));
    expect(t).toMatch(/nicht vollständig geprüft/);
    expect(t).not.toMatch(/überfällig/);
  });

  it("Navigationszähler: die Miete DIESES Monats wird gefunden, auch hinter 1.000 alten Buchungen", async () => {
    vi.resetModules();
    const db = speicherDb({ tabellen: { anliegen: [], bewerbungen: [], auftraege: [], mieter: [mieterRow], einnahmen: [...alt, ...bezahlt] } });
    vi.doMock("server-only", () => ({}));
    mockeNextUndSupabase(db.client);
    const { ladeNeuigkeiten } = await import("@/lib/neuigkeiten");
    expect((await ladeNeuigkeiten()).cashflow).toBe(0);
    db.tabellen.einnahmen = alt; // nichts für diesen Monat
    expect((await ladeNeuigkeiten()).cashflow).toBe(1);
  });
});

describe("Objektseite", () => {
  const tabellen = {
    properties: [{ id: "p1", user_id: U, bezeichnung: "Haus", typ: "Wohnung", kaufpreis: 200000, miete: 700 }],
    mieter: [{ id: "m1", user_id: U, prop_id: "p1", vorname: "A", nachname: "B", mietbeginn: "2024-01-01", mietende: null, kaltmiete: 700, nk_vorauszahlung: 150 }],
    einnahmen: [], verbrauch: [], vergleichsangebote: [], kosten: [],
  };
  it("rendert; ein Lesefehler bei Kosten oder Miet-Zeiträumen ergibt die Fehlerkarte", async () => {
    const args = { params: Promise.resolve({ id: "p1" }) };
    const ok = await ladeSeite("@/app/(app)/properties/[id]/page", { tabellen });
    await expect(ok.Seite(args)).resolves.toBeTruthy();
    for (const stelle of ["kosten:select", "miet_zeitraeume:select", "kredite:select"]) {
      const k = await ladeSeite("@/app/(app)/properties/[id]/page", { tabellen, fehlerBei: { [stelle]: "reset" } });
      await expect(k.Seite(args), stelle).rejects.toThrow(/nicht vollständig/);
    }
  });
});
