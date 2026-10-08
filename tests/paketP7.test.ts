// Paket P7 der Gesamtprüfung 07.10.2026 (docs/AUDIT-2026-10-07-gesamt.md): Mietkonto und Fristen.
// B7–B16, C26, C27, C40, C42, Zusammenführung 10 — dazu der Sicherheitsfund „Portal-Sichten schreibbar“.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  dritterWerktag, bundesFeiertage, mietFaelligkeit, mieteBezahlt, naechsterWerktag, TEILZAHLUNG_TOLERANZ,
} from "@/lib/mietStatus";
import { offeneMieten, sollFuerMonat, minderungAus, type MietkontoMieter } from "@/lib/mietkonto";
import { mieterKonto } from "@/lib/mieterKonto";
import { baueHeuteAufgaben } from "@/lib/heute";
import { mahnungMoeglich } from "@/lib/mahnung";
import { mieterFristen, globaleFristen } from "@/lib/fristen";
import { gleicheAb, enthaeltWort } from "@/lib/kontoauszug";
import { berechneVerbilligt } from "@/lib/steuer/verbilligt";
import { kautionZuHoch } from "@/lib/kaution";
import { DEFAULT_VORLAGEN } from "@/lib/dokumentVorlagen";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

const lies = (p: string) => readFileSync(p, "utf8");
const M: MietkontoMieter = { kaltmiete: 900, nk_vorauszahlung: 100, mietbeginn: "2025-01-01", mietende: null };
/** Mietbeginn im Juli 2026 — damit nur die Monate im Blick sind, um die es geht. */
const M7: MietkontoMieter = { ...M, mietbeginn: "2026-07-01" };
const miete = (ym: string, betrag: number) => ({ buchungsdatum: `${ym}-03`, kategorie: "Miete", soll_monat: ym, betrag });

describe("B7 — 3. Werktag ohne bundesweite Feiertage", () => {
  it("Ostern 2026: Karfreitag 03.04., Ostermontag 06.04., Himmelfahrt 14.05., Pfingstmontag 25.05.", () => {
    const f = bundesFeiertage(2026);
    for (const d of ["2026-04-03", "2026-04-06", "2026-05-14", "2026-05-25", "2026-01-01", "2026-10-03", "2026-12-25"]) expect(f.has(d), d).toBe(true);
  });
  it.each([["2026-04", "2026-04-07"], ["2027-01", "2027-01-06"], ["2026-05", "2026-05-06"], ["2026-10", "2026-10-05"]])("%s → %s", (ym, soll) => {
    expect(dritterWerktag(ym)).toBe(soll);
  });
  it("Ostermontag ist nicht überfällig", () => {
    expect(mietFaelligkeit("2026-04", "2026-04-06").stand).toBe("nicht_faellig");
  });
  it("der Brief nennt den Hinweis auf Landesfeiertage", () => {
    expect(lies("lib/mahnung.ts")).toMatch(/LANDESFEIERTAG_HINWEIS/);
  });
});

describe("B13 — eine Regel für „überfällig“, Berliner Stichtag", () => {
  it("am Fälligkeitstag: fällig, nicht überfällig — und auf dem Dashboard nicht dringend", () => {
    expect(mietFaelligkeit("2026-10", "2026-10-05")).toMatchObject({ stand: "faellig", tage: 0 });
    const a = baueHeuteAufgaben({ offeneMieten: [{ mieterId: "m", name: "X", objekt: "", monat: "2026-10", betrag: 1000 }], anliegen: [], meldungen: [], fristen: [] }, "2026-10-05", Infinity);
    expect(a[0].dringend).toBe(false);
    const b = baueHeuteAufgaben({ offeneMieten: [{ mieterId: "m", name: "X", objekt: "", monat: "2026-10", betrag: 1000 }], anliegen: [], meldungen: [], fristen: [] }, "2026-10-06", Infinity);
    expect(b[0].dringend).toBe(true);
  });
  it("offeneMieten zählt nach Berliner Datum (23:30 UTC am 05.10. = 06.10. in Berlin)", () => {
    const o = offeneMieten(M, [], [], new Date("2026-10-05T23:30:00Z"));
    expect(o.find((x) => x.jahrMonat === "2026-10")?.tageOffen).toBe(1);
  });
  it("der Wächter zählt „heute fällig“ nicht als überfällig", () => {
    expect(lies("components/RueckstandWaechter.tsx")).toMatch(/aktuell\.filter\(\(o\) => o\.tageOffen > 0\)/);
  });
});

describe("B11 — eine Teilzahlungs-Toleranz für Vermieter und Portal", () => {
  it("999,20 von 1.000 = bezahlt; genau 1,00 € fehlt = offen", () => {
    expect(TEILZAHLUNG_TOLERANZ).toBe(1);
    expect(mieteBezahlt(1000, 999.2)).toBe(true);
    expect(mieteBezahlt(1000, 999)).toBe(false);
  });
  it("das Portal sagt dasselbe wie der Vermieter", () => {
    const k = mieterKonto(M7, [], [{ ...miete("2026-09", 999.2), mieter_id: "x" } as never], "2026-10-07");
    expect(k.find((x) => x.jahrMonat === "2026-09")?.status).toBe("bestaetigt");
    const ein = [miete("2026-07", 1000), miete("2026-08", 1000), miete("2026-09", 999.2), miete("2026-10", 1000)];
    expect(offeneMieten(M7, [], ein, "2026-10-07")).toHaveLength(0);
  });
});

describe("B12 — offene Vormonatsmiete bleibt auf dem Dashboard", () => {
  it("das Dashboard prüft die letzten Monate, nicht nur den laufenden", () => {
    const d = lies("app/(app)/page.tsx");
    expect(d).toMatch(/erwarteteMonate\(m as never, zeitraeumeVon\(m\.id as string\), ymPlus\(laufenderMonat, -2\), laufenderMonat\)/);
    expect(d).toMatch(/mietFaelligkeit\(soll\.jahrMonat, heuteISO0\)\.tage <= 62/);
  });
});

describe("B10 — Mahnung erst nach einer Erinnerung, Text ohne Behauptung", () => {
  it("ohne archivierte Erinnerung nach der Fälligkeit keine Mahnung", () => {
    expect(mahnungMoeglich([], "m1", "2026-10-05")).toBe(false);
    expect(mahnungMoeglich([{ mieter_id: "m1", created_at: "2026-09-10T10:00:00Z" }], "m1", "2026-10-05")).toBe(false);
    expect(mahnungMoeglich([{ mieter_id: "m2", created_at: "2026-10-08T10:00:00Z" }], "m1", "2026-10-05")).toBe(false);
    expect(mahnungMoeglich([{ mieter_id: "m1", created_at: "2026-10-08T10:00:00Z" }], "m1", "2026-10-05")).toBe(true);
  });
  it("der Wächter fragt das ab, die Vorlage behauptet keine vorherige Erinnerung", () => {
    expect(lies("components/RueckstandWaechter.tsx")).toMatch(/mahnungMoeglich\(erinnerungen, o\.mieterId, o\.faelligSeit\)/);
    expect(DEFAULT_VORLAGEN.mahnung).not.toMatch(/trotz vorheriger/i);
  });
});

describe("B8 / B9 / C27 / C40 — Fristen", () => {
  const basis = { mietbeginn: "2020-01-01", mietende: null, kuendigung: null, letzte_erhoehung: null };
  it("§ 558 nur bei normaler Miete", () => {
    for (const mietart of ["Index", "Staffel", "index", "staffel"]) {
      expect(mieterFristen({ ...basis, mietart }).some((f) => f.label.startsWith("Mieterhöhung möglich")), mietart).toBe(false);
    }
    expect(mieterFristen({ ...basis, mietart: "Standard" }).some((f) => f.label.startsWith("Mieterhöhung möglich"))).toBe(true);
  });
  it("verstrichene Staffelstufe ohne Miet-Zeitraum → Warnung; mit Zeitraum → keine", () => {
    const st = { ...basis, mietart: "Staffel", staffel_datum: "2025-09-01", staffel_intervall: "12", staffel_betrag: 40, staffel_stufen: 5 };
    const ohne = mieterFristen(st, { zeitraumMonate: [] }).find((f) => f.label === "Staffelstufe nicht im Mietkonto");
    expect(ohne).toMatchObject({ datum: "2025-09-01", typ: "warn" });
    // Auch die zweite Stufe (09/2026) ist schon verstrichen — fehlt sie, warnt es mit ihrem Datum.
    expect(mieterFristen(st, { zeitraumMonate: ["2025-09"] }).find((f) => f.label === "Staffelstufe nicht im Mietkonto")?.datum).toBe("2026-09-01");
    expect(mieterFristen(st, { zeitraumMonate: ["2025-09", "2026-09"] }).some((f) => f.label === "Staffelstufe nicht im Mietkonto")).toBe(false);
  });
  it("Indexmiete nach der Sperrfrist: „seit …“ ohne Datum statt des ersten Jahrestags", () => {
    const f = mieterFristen({ ...basis, mietart: "Index" });
    const idx = f.find((x) => x.label.startsWith("Indexanpassung möglich"));
    expect(idx).toMatchObject({ datum: null, typ: "ok" });
    expect(idx!.label).toContain("01.01.2021");
  });
  it("Steuererklärung: Samstag 31.07.2027 → Montag 02.08.2027 (§ 108 Abs. 3 AO)", () => {
    expect(naechsterWerktag("2027-07-31")).toBe("2027-08-02");
    expect(lies("lib/fristen.ts")).toMatch(/const est = naechsterWerktag\(`\$\{j\}-07-31`\)/);
    expect(globaleFristen().every((f) => !f.label.startsWith("Einkommensteuererklärung") || f.datum !== "2027-07-31")).toBe(true);
  });
});

describe("B14 — Kontoauszug: Name nur als ganzes Wort, Monatsname im Zweck zählt nicht", () => {
  const mieter = [
    { mieterId: "mai", propId: null, name: "Kai Mai", nachname: "Mai", ibanHash: null, offen: [{ jahrMonat: "2026-05", gesamt: 750, nk: 100 }] },
    { mieterId: "huber", propId: null, name: "Eva Huber", nachname: "Huber", ibanHash: null, offen: [{ jahrMonat: "2026-05", gesamt: 750, nk: 100 }] },
  ];
  const zahlung = (name: string, zweck: string) => ({ zeile: 1, datum: "2026-05-03", betrag: 750, name, zweck, iban: "" });
  it("Petra Schulz, „Miete Mai 2026 Whg 2“ → „Mai“ zählt nicht als Name, nur der Betrag passt", () => {
    const r = gleicheAb([zahlung("Petra Schulz", "Miete Mai 2026 Whg 2")], mieter, new Map());
    // Betrag allein (2 Punkte) ist keine Zuordnung — vorher: Kai Mai „sicher“ (4 Punkte).
    expect(r.treffer).toHaveLength(0);
  });
  it("Name nur im Verwendungszweck + Betrag → Vorschlag, nie „sicher“", () => {
    const r = gleicheAb([zahlung("Petra Schulz", "Miete Huber Mai")], mieter, new Map());
    expect(r.treffer[0]).toMatchObject({ mieterId: "huber", stufe: "vorschlag" });
    expect(r.treffer[0].gruende).toContain("Name im Zweck");
  });
  it("Kai Mai im Auftraggeber → sicher", () => {
    const r = gleicheAb([zahlung("Kai Mai", "Miete Mai 2026")], mieter, new Map());
    expect(r.treffer[0]).toMatchObject({ mieterId: "mai", stufe: "sicher" });
  });
  it("ganzes Wort: „Huber“ passt nicht auf „Hubert“", () => {
    expect(enthaeltWort("hubert schmidt", "huber")).toBe(false);
    expect(enthaeltWort("frau huber, whg 2", "huber")).toBe(true);
  });
});

describe("B15 — Mietminderung", () => {
  const mit = { ...M7, minderungen: [{ von: "2026-07", bis: "2026-09", prozent: 10, grund: "Heizung" }] };
  it("10 % von 1.000 → Soll 900, außerhalb des Zeitraums 1.000", () => {
    expect(sollFuerMonat(mit, [], "2026-08")).toMatchObject({ gesamt: 900, kaltmiete: 800, minderung: { betrag: 100, grund: "Heizung" } });
    expect(sollFuerMonat(mit, [], "2026-10")?.gesamt).toBe(1000);
  });
  it("geminderte Monate mit 900 bezahlt → nichts offen", () => {
    const ein = ["2026-07", "2026-08", "2026-09"].map((ym) => miete(ym, 900)).concat(miete("2026-10", 1000));
    expect(offeneMieten(mit, [], ein, "2026-10-20")).toHaveLength(0);
    expect(offeneMieten(M7, [], ein, "2026-10-20").map((o) => o.jahrMonat)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
  it("Eingabe: Prozent ODER Betrag, gültige Monate", () => {
    expect(minderungAus({ von: "2026-07", prozent: "10" })).toMatchObject({ von: "2026-07", prozent: 10, betrag: null, bis: null });
    expect(minderungAus({ von: "2026-07", prozent: "10", betrag: "50" })).toHaveProperty("fehler");
    expect(minderungAus({ von: "2026-07" })).toHaveProperty("fehler");
    expect(minderungAus({ von: "2026-07", bis: "2026-06", betrag: "50" })).toHaveProperty("fehler");
    expect(minderungAus({ von: "2026-07", prozent: "150" })).toHaveProperty("fehler");
  });
  it("Wächter, Dashboard und Portal laden die Minderungen", () => {
    expect(lies("components/RueckstandWaechter.tsx")).toMatch(/stellplatz_miete,minderungen"/);
    expect(lies("app/(app)/page.tsx")).toMatch(/staffel_stufen,minderungen"/);
    expect(lies("lib/portalDaten.ts")).toMatch(/mietart,minderungen";/);
  });
});

describe("B15 — Action: Minderung hinzufügen", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m); });
  it("hängt die geprüfte Minderung an die Liste und filtert auf das eigene Konto", async () => {
    const { db, client } = fakeSupabase({ antwortFolge: { mieter: [{ minderungen: [] }, { id: "m1" }] } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/mietzeitraeume");
    const r = await mod.fuegeMinderungHinzu("m1", fd({ von: "2026-07", prozent: "10", grund: "Heizung" }));
    expect(r.ok).toBe(true);
    const upd = [...db.zugriffe].reverse().find((z) => z.tabelle === "mieter" && z.op === "update");
    expect(upd?.daten?.minderungen).toEqual([{ von: "2026-07", bis: null, prozent: 10, betrag: null, grund: "Heizung", anliegen_id: null }]);
    expect(JSON.stringify(upd)).toMatch(/user_id/);
  });
  it("ungültige Eingabe: Fehler, nichts geschrieben", async () => {
    const { db, client } = fakeSupabase({ antwortFolge: { mieter: [{ minderungen: [] }, { id: "m1" }] } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/mietzeitraeume");
    const r = await mod.fuegeMinderungHinzu("m1", fd({ von: "2026-07", prozent: "10", betrag: "5" }));
    expect(r.ok).toBe(false);
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });
});

describe("C26 / C42 / B16", () => {
  it("verbilligte Vermietung: 65,995 % ist nicht ≥ 66 % (ungerundet verglichen)", () => {
    const r = berechneVerbilligt({ kaltmiete: 559.95, nkVorauszahlung: 100, vergleichKaltProM2: 9, flaeche: 100 } as never);
    expect(r.status).toBe("gelb");
    expect(r.prozent).toBe(65.99);
  });
  it("Kaution über drei Nettokaltmieten", () => {
    expect(kautionZuHoch(3500, 700)).toBe(true);
    expect(kautionZuHoch(2100, 700)).toBe(false);
    expect(kautionZuHoch(3500, null)).toBe(false);
  });
  it("Werbetext verspricht keinen Anlageort und keinen Einbehalt-Ablauf", () => {
    const t = lies("lib/funktionen.ts");
    expect(t).not.toMatch(/Beim Auszug steht damit fest, was einbehalten wurde/);
    expect(t).not.toMatch(/und Anlageort je Mietverhältnis/);
  });
});

describe("Sicherheit — Portal-Sichten sind nur lesbar", () => {
  it("jede in den Migrationen angelegte Sicht hat ihre Schreibrechte entzogen", () => {
    const dateien = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const sql = dateien.map((f) => lies(`supabase/migrations/${f}`)).join("\n");
    const sichten = new Set([...sql.matchAll(/create (?:or replace )?view (?:public\.)?(\w+)/gi)].map((m) => m[1]));
    expect(sichten.size).toBeGreaterThanOrEqual(4);
    for (const v of sichten) {
      expect(sql, v).toMatch(new RegExp(`revoke insert, update, delete[^;]*on public\\.${v}\\s+from public, anon, authenticated`, "i"));
    }
  });
});
