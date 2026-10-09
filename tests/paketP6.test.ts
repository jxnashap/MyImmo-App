// Paket P6 der Gesamtprüfung 07.10.2026 (docs/AUDIT-2026-10-07-gesamt.md): Kredite mit Zeit.
// B3 (Jahresbericht), B17, B18, B19, B20, B21, B22, B23, C7; Zusammenführungen 6, 7, 12.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { restschuldVon, rateVon, istGetilgt, zinsUndTilgung, getilgtProzent, summeRaten } from "@/lib/kredit";
import { schuldenStand } from "@/lib/schuldenStand";
import { beleihungsauslauf, auslaufVon } from "@/lib/beleihungsauslauf";
import { jahresZeile } from "@/lib/jahresberichtZeile";
import { kreditFristen, sonderkuendigungNachZehnJahren } from "@/lib/fristen";
import { bestandAusMyImmo, selbstauskunftAbweichungen, mitBestand } from "@/lib/kauf/selbstauskunftBestand";
import { DEMO_SELBSTAUSKUNFT } from "@/lib/kauf/selbstauskunft";
import { fakeSupabase, mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";

const lies = (p: string) => readFileSync(p, "utf8");

describe("B17 — abbezahltes Darlehen: keine Rate, keine Tilgung", () => {
  const k = { betrag: 200000, restschuld: 0, monatsrate: 900, zinssatz: 3 };
  it("Rate 0, Tilgung 0, getilgt 100 %", () => {
    expect(istGetilgt(k)).toBe(true);
    expect(rateVon(k)).toBe(0);
    expect(zinsUndTilgung(k)).toEqual({ zins: 0, tilgung: 0 });
    expect(getilgtProzent(k)).toBe(100);
  });
  it("Schulden-Uhr und Raten-Summe zählen es nicht", () => {
    expect(schuldenStand([k]).tilgungMonat).toBe(0);
    expect(summeRaten([k, { restschuld: 1000, monatsrate: 250 }])).toBe(250);
  });
  it("Dashboard, Objektseite und /kredite summieren über summeRaten", () => {
    // Seit P8 je Objekt + „ohne Objekt“, summiert über portfolioMonat.
    expect(lies("app/(app)/page.tsx")).toMatch(/raten: summeRaten\(kredite\.filter\(\(k\) => k\.prop_id === p\.id\)\)/);
    expect(lies("app/(app)/page.tsx")).toMatch(/raten: summeRaten\(kredite\.filter\(\(k\) => !mitObjekt\(k\.prop_id\)\)\)/);
    expect(lies("app/(app)/properties/[id]/page.tsx")).toMatch(/const totalKreditRate = summeRaten\(kred\)/);
    expect(lies("app/(app)/kredite/page.tsx")).toMatch(/const summeRate = summeRaten\(list\)/);
  });
});

describe("B18 — leere Restschuld = Darlehenssumme, überall", () => {
  const leer = { betrag: 200000, restschuld: null, monatsrate: 900, zinssatz: 3 };
  it("Restschuld 200.000, nicht getilgt, 0 %", () => {
    expect(restschuldVon(leer)).toBe(200000);
    expect(istGetilgt(leer)).toBe(false);
    expect(getilgtProzent(leer)).toBe(0);
    expect(schuldenStand([leer])).toMatchObject({ offen: 200000, getilgt: 0, prozent: 0 });
  });
  it("Auslauf je Objekt rechnet mit der Darlehenssumme", () => {
    const z = beleihungsauslauf([{ id: "p", bezeichnung: "X", wert: 400000, kaufpreis: null }], [{ prop_id: "p", grundschuld: null, ...leer }]);
    expect(z[0].auslaufProzent).toBe(50);
  });
  it("ohne Darlehenssumme kein Prozentwert (statt „0 % getilgt“ oder „100 %“)", () => {
    expect(getilgtProzent({ betrag: null, restschuld: 1000 })).toBeNull();
  });
  it("kein Leser rechnet mehr selbst mit `restschuld ??`", () => {
    const dateien = ["app", "components", "lib"].flatMap((w) =>
      (readdirSync(w, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => `${w}/${f}`));
    expect(dateien.length).toBeGreaterThan(300);
    const treffer = dateien
      .filter((d) => d !== "lib/kredit.ts" && d !== "lib/verkauf.ts")
      .filter((d) => /restschuld \?\? (0|k\.betrag|kr\.betrag)|\(k\.restschuld \?\? 0\)/.test(lies(d)));
    expect(treffer).toEqual([]);
  });
});

describe("C7 — Zins + Tilgung ergeben die Rate", () => {
  it("178.000 × 2,1 % / 12 = 311,50 → 312 + 578 = 890", () => {
    expect(zinsUndTilgung({ restschuld: 178000, zinssatz: 2.1, monatsrate: 890 })).toEqual({ zins: 312, tilgung: 578 });
  });
});

describe("Zusammenführung 7 — eine Auslauf-Formel für /kredite, Kennblatt und Bank-Link", () => {
  it("auslaufVon: 178.000 / 289.000 = 61,6 %", () => {
    expect(auslaufVon(178000, 289000)).toBe(61.6);
    expect(auslaufVon(1, 0)).toBeNull();
  });
  it("PDF und Bank-Link rufen sie auf", () => {
    expect(lies("lib/pdf/beleihungPdf.ts")).toMatch(/auslaufVon\(o\.restschuld, o\.wert\)/);
    expect(lies("app/(app)/beleihung/[token]/page.tsx")).toMatch(/auslaufVon\(info\.restschuld, o\.wert\)/);
  });
});

describe("B3 — Jahresbericht: Raten und Zinsen nur, solange das Darlehen lief", () => {
  // Demo Plagwitz: Kauf 15.08.2023, Auszahlung 01.10.2023, Rate 1.180, Restschuld 256.000, 3,8 %.
  const kredite = [{ prop_id: "p", restschuld: 256000, zinssatz: 3.8, monatsrate: 1180, auszahlung_datum: "2023-10-01", laufzeit: null }];
  const daten = { einnahmen: [], kosten: [], kredite, kaufdatum: "2023-08-15" };
  it("2023: drei Raten (3.540 €), Zinsschätzung höchstens 3 Monate (2.432 €)", () => {
    const z = jahresZeile("p", 2023, 12, daten);
    expect(z.cashflow).toBe(-3540);
    expect(z.zins).toBeCloseTo(2432, 0);
  });
  it("2021: vor dem Kauf nichts", () => {
    expect(jahresZeile("p", 2021, 12, daten)).toMatchObject({ zins: 0, tilgung: 0, cashflow: 0 });
  });
  it("laufendes Jahr: nur verstrichene Monate", () => {
    expect(jahresZeile("p", 2024, 5, daten).cashflow).toBe(-5900);
  });
  it("ohne Datum: ganzjährig, gekennzeichnet", () => {
    const z = jahresZeile("p", 2024, 12, { ...daten, kaufdatum: null, kredite: [{ ...kredite[0], auszahlung_datum: null }] });
    expect(z.cashflow).toBe(-14160);
    expect(z.kreditOhneStart).toBe(true);
  });
  it("Seite und PDF reichen das Kaufdatum durch", () => {
    for (const p of ["app/(app)/jahresbericht/page.tsx", "app/api/berichte/jahresbericht/route.ts"]) {
      expect(lies(p), p).toMatch(/jahresZeile\(p\.id, \w+, monate, \{ einnahmen, kosten, kredite, kaufdatum: p\.kaufdatum \}\)/);
    }
  });
});

describe("B20 — § 489 BGB: Nr. 2 nur, wenn die Bindung länger als zehn Jahre läuft", () => {
  it("Bindung 31.03.2031, Auszahlung 01.04.2021 → kein Termin „Sonderkündigungsrecht“, Hinweis auf Nr. 1", () => {
    const f = kreditFristen({ auszahlung_datum: "2021-04-01", zinsbindung: "2031-03-31" });
    expect(f.map((x) => x.label)).not.toContain("Sonderkündigungsrecht (10 J. nach Auszahlung)");
    expect(f.find((x) => x.label === "Zinsbindung endet")?.rechtsgrundlage).toMatch(/§ 489 Abs\. 1 Nr\. 1 BGB/);
  });
  it("Bindung 15 Jahre → Termin zehn Jahre nach Auszahlung", () => {
    const f = kreditFristen({ auszahlung_datum: "2021-04-01", zinsbindung: "2036-03-31" });
    expect(f.find((x) => x.label.startsWith("Sonderkündigungsrecht"))?.datum).toBe("2031-04-01");
  });
  it("ohne Bindung → Termin; ohne Auszahlung → keiner", () => {
    expect(sonderkuendigungNachZehnJahren({ auszahlung_datum: "2021-04-01" })).toBe(true);
    expect(sonderkuendigungNachZehnJahren({ zinsbindung: "2036-03-31" })).toBe(false);
  });
});

describe("B19 + B18 — Actions: Rate ist Pflicht, leere Restschuld = Darlehenssumme", () => {
  beforeEach(() => { process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64"); vi.resetModules(); });
  afterEach(() => { for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m); });
  async function lade() {
    vi.resetModules();
    const { db, client } = fakeSupabase({});
    mockeNextUndSupabase(client);
    return { db, mod: await import("@/lib/actions/buchungen") };
  }
  const geschrieben = (db: { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown> }[] }) =>
    [...db.zugriffe].reverse().find((z) => z.tabelle === "kredite" && z.daten)?.daten;

  it("updateKredit: geleerte Restschuld wird zur Darlehenssumme", async () => {
    const { db, mod } = await lade();
    await fangeRedirect(() => mod.updateKredit("k1", fd({ betrag: "200000", restschuld: "", monatsrate: "900" })));
    expect(geschrieben(db)?.restschuld).toBe(200000);
  });
  it("ohne Rate: Fehler, nichts geschrieben — beim Anlegen und Bearbeiten", async () => {
    const { db, mod } = await lade();
    await expect(mod.updateKredit("k1", fd({ betrag: "200000" }))).rejects.toThrow(/monatliche Rate/);
    await expect(mod.createKredit(fd({ betrag: "200000" }))).rejects.toThrow(/monatliche Rate/);
    expect(db.zugriffe.filter((z) => z.tabelle === "kredite")).toHaveLength(0);
  });
  it("Rate 0 nur bei Restschuld 0", async () => {
    const { db, mod } = await lade();
    await expect(mod.updateKredit("k1", fd({ betrag: "200000", restschuld: "5000", monatsrate: "0" }))).rejects.toThrow(/abbezahlten/);
    await fangeRedirect(() => mod.updateKredit("k1", fd({ betrag: "200000", restschuld: "0", monatsrate: "0" })));
    expect(geschrieben(db)?.monatsrate).toBe(0);
  });
  it("der Dialog auf /kredite verlangt die Rate", () => {
    expect(lies("components/KrediteListe.tsx")).toMatch(/name="monatsrate" defaultValue=\{offen\.monatsrate \?\? ""\} required/);
  });
});

describe("B22 + B23 — Texte versprechen nur, was es gibt", () => {
  it("/kredite: kein Tilgungsplan, keine fortgeschriebene Restschuld", () => {
    const q = lies("app/(app)/kredite/page.tsx");
    expect(q).not.toMatch(/Tilgungsplan|Tilgungsverlauf|rechnet daraus Restschuld/);
    expect(q).toMatch(/schreibt MyImmo nicht selbst fort/);
  });
  it("Kredit-Dialog: „Beleihungsauslauf laut Bank“ statt zweimal derselbe Begriff", () => {
    const q = lies("components/KrediteListe.tsx");
    expect(q).toContain('feld("Beleihungsauslauf laut Bank"');
    expect(q).not.toContain('feld("Beleihungsauslauf",');
  });
});

describe("B21 — Selbstauskunft gegen den Bestand", () => {
  const kredite = [
    { betrag: 300000, restschuld: 250000, monatsrate: 1200, zinssatz: 3 },
    { betrag: 100000, restschuld: 0, monatsrate: 500, zinssatz: 2 },
  ];
  const objekte = [{ id: "a", typ: "Eigentumswohnung", miete: 900 }, { id: "b", typ: "Eigentumswohnung", miete: 700 }];
  const mieter = [{ prop_id: "a", kaltmiete: 850, mietbeginn: "2020-01-01", mietende: null }];
  const b = bestandAusMyImmo(kredite, objekte, mieter, "2026-10-07");
  it("Bestand: Raten 1.200 (getilgtes ohne), Restschuld 250.000, Kaltmiete 850 + 700", () => {
    expect(b).toEqual({ raten: 1200, restschuld: 250000, kaltmiete: 1550, darlehen: 2 });
  });
  it("weniger eingetragen = Abweichung; Kredite darüber (privat) nicht", () => {
    const ab = selbstauskunftAbweichungen({ ratenKredite: 1500, summeVerbindlichkeiten: 6400, mieteinnahmen: 0 }, b);
    expect(ab.map((a) => a.feld)).toEqual(["summeVerbindlichkeiten", "mieteinnahmen"]);
  });
  it("höhere Mieteinnahmen als in MyImmo sind ebenfalls eine Abweichung", () => {
    expect(selbstauskunftAbweichungen({ ratenKredite: 1200, summeVerbindlichkeiten: 250000, mieteinnahmen: 3000 }, b).map((a) => a.feld)).toEqual(["mieteinnahmen"]);
  });
  it("die Demo nimmt den Demo-Bestand", () => {
    expect(mitBestand(DEMO_SELBSTAUSKUNFT, b)).toMatchObject({ ratenKredite: 1200, summeVerbindlichkeiten: 250000, mieteinnahmen: 1550 });
    expect(lies("app/(app)/kauf/page.tsx")).toMatch(/demo \? mitBestand\(DEMO_SELBSTAUSKUNFT, bestand\)/);
  });
  it("das Formular zeigt den Abgleich", () => {
    expect(lies("components/kauf/SelbstauskunftForm.tsx")).toMatch(/selbstauskunftAbweichungen\(/);
  });
});
