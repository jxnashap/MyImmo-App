import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { speicherDb } from "./stubs/speicherDb";
import {
  jahresPruefung, ZAEHLER_FENSTER_TAGE,
  type JpEinnahme, type JpKosten, type JpMieter, type JpZeitraum, type JpMeldung, type JpNk, type JahresPruefung,
} from "@/lib/jahresPruefung";

// Ablauf E (Prüfstand 11.10.2026, Phase 5): Jahresprüfung je Objekt — ohne Anlage V.
//
// Vorher-Zustand (belegt am Code vor diesem Paket): Es gab keine Stelle, die je Objekt und Jahr zeigt, was
// vor dem Abschluss fehlt. Einzelne Hinweise lagen verstreut (Rückstands-Wächter nur 12 Monate rückwärts und
// ohne Objektbezug, Objekt-Check nur Stammdaten). Fehlende Belege, Mietzahlungen ohne Mieter oder beim
// falschen Objekt, doppelte Buchungen, sich überschneidende Miet-Zeiträume, zwei Mieter in derselben Einheit,
// fehlende Zwischenablesungen und Abweichungen zwischen gebuchten Kosten und NK-Abrechnung fielen nirgends
// auf. Ob Jahresbericht, Buchungssaldo und DATEV-Export dieselben Summen ergeben, prüfte niemand.
//
// Jeder Test zeigt den Punkt UND dass er nach der Korrektur in den Daten verschwindet (kein Abhaken).

const P1 = "p1";
const P2 = "p2";
const HEUTE = "2026-10-11";
const JAHR = 2025;

const mieter = (x: Partial<JpMieter> & { id: string }): JpMieter => ({
  prop_id: P1, vorname: "Anna", nachname: "Weber", einheit: "EG", mietbeginn: "2020-01-01", mietende: null,
  kaltmiete: 800, nk_vorauszahlung: 200, stellplatz_miete: 0, minderungen: null, ...x,
});
let n = 0;
const ein = (x: Partial<JpEinnahme>): JpEinnahme => ({
  id: `e${++n}`, prop_id: P1, mieter_id: "anna", buchungsdatum: "2025-01-02", betrag: 1000, kategorie: "Miete", soll_monat: null, nk_anteil: 200, beschreibung: null, ...x,
});
const kost = (x: Partial<JpKosten>): JpKosten => ({
  id: `k${++n}`, prop_id: P1, buchungsdatum: "2025-03-10", betrag: 100, kategorie: "Reparatur", beschreibung: null, umlagefaehig: null,
  rechnung_path: "u/beleg.pdf", rechnung_name: "beleg.pdf", beleg_eingang_id: null, ...x,
});
/** Anna zahlt 2025 jeden Monat pünktlich 1.000 € (800 kalt + 200 NK). */
const volleMieten = (mieterId = "anna", propId = P1) =>
  Array.from({ length: 12 }, (_, i) => ein({ mieter_id: mieterId, prop_id: propId, buchungsdatum: `2025-${String(i + 1).padStart(2, "0")}-02`, soll_monat: `2025-${String(i + 1).padStart(2, "0")}` }));

function pruefe(x: Partial<Parameters<typeof jahresPruefung>[0]> = {}): JahresPruefung {
  return jahresPruefung({
    jahr: JAHR, heute: HEUTE,
    objekt: { id: P1, bezeichnung: "Haus Lindenweg", einheiten_anzahl: 2, kaufdatum: "2019-05-01" },
    mieter: [mieter({ id: "anna" })], zeitraeume: [], einnahmen: volleMieten(), kosten: [], kredite: [],
    meldungen: [], verbrauch: [], belegEingang: [], nk: { quelle: "keine", positionen: [] },
    ...x,
  });
}
const arten = (r: JahresPruefung, art: string) => r.punkte.filter((p) => p.art === art);

afterEach(() => {
  vi.useRealTimers();
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/nutzer"]) vi.doUnmock(m);
});

// ------------------------------------------------------------------------------------------------
describe("Normalfall: ein sauberes Jahr ergibt keine Prüfpunkte", () => {
  it("volle Mieten, Kosten mit Beleg, nichts offen — und alle Abgleiche stimmen", () => {
    const r = pruefe({ kosten: [kost({}), kost({ kategorie: "Grundsteuer", betrag: 600, buchungsdatum: "2025-02-15" })] });
    expect(r.punkte).toEqual([]);
    expect(r.abgleich.filter((a) => !a.bezeichnung.startsWith("NK ·")).every((a) => a.stimmt)).toBe(true);
    expect(r.abgleich.length).toBeGreaterThanOrEqual(8); // der Abgleich hat hingesehen
  });
});

describe("Fehlende Belege", () => {
  it("Kosten ohne Beleg → Punkt mit Sprung zur Buchung; Beleg angehängt oder aus dem Eingang → weg", () => {
    const k = kost({ rechnung_path: null, rechnung_name: null });
    const r = pruefe({ kosten: [k] });
    expect(arten(r, "beleg")).toEqual([expect.objectContaining({ href: `/kosten/${k.id}/edit`, betrag: 100 })]);
    expect(arten(pruefe({ kosten: [{ ...k, rechnung_path: "u/x.pdf" }] }), "beleg")).toEqual([]);
    expect(arten(pruefe({ kosten: [{ ...k, beleg_eingang_id: "be1" }] }), "beleg")).toEqual([]);
    expect(arten(pruefe({ kosten: [{ ...k, betrag: 0 }] }), "beleg")).toEqual([]);
  });
  it("Belege im Eingang für DIESES Objekt, noch nicht gebucht → Hinweis", () => {
    const r = pruefe({ belegEingang: [{ id: "b1", status: "vorschlag", prop_id: P1 }, { id: "b2", status: "gebucht", prop_id: P1 }, { id: "b3", status: "neu", prop_id: P2 }] });
    expect(arten(r, "beleg")).toEqual([expect.objectContaining({ schwere: "hinweis", href: "/cashflow/belege", text: expect.stringMatching(/^1 Beleg liegt/) })]);
  });
});

describe("Unklare Zahlungszuordnung", () => {
  it("Mieteingang ohne Mieter → wichtig; zugeordnet → weg", () => {
    const x = ein({ mieter_id: null, buchungsdatum: "2025-07-15", soll_monat: null });
    const r = pruefe({ einnahmen: [...volleMieten(), x] });
    expect(arten(r, "zuordnung")).toEqual([expect.objectContaining({ schwere: "hoch", href: `/einnahmen/${x.id}/edit` })]);
  });
  it("Zahlung der Mieterin bei einem ANDEREN Objekt → Punkt (und dort fehlt sie im Mietkonto nicht, weil das Mietkonto am Mieter hängt)", () => {
    const mieten = volleMieten();
    mieten[4] = { ...mieten[4], prop_id: P2 };
    const r = pruefe({ einnahmen: mieten });
    expect(arten(r, "zuordnung")).toEqual([expect.objectContaining({ schluessel: `falsches-objekt:${mieten[4].id}` })]);
    expect(arten(pruefe({ einnahmen: volleMieten() }), "zuordnung")).toEqual([]);
  });
  it("Mieter eines anderen Objekts zählt hier nicht", () => {
    const carl = mieter({ id: "carl", prop_id: P2, vorname: "Carl" });
    expect(pruefe({ mieter: [mieter({ id: "anna" }), carl], einnahmen: [...volleMieten(), ...volleMieten("carl", P2)] }).punkte).toEqual([]);
  });
  it("mehr gezahlt als Soll → prüfen (Nachzahlung, anderer Monat oder Fehlbuchung)", () => {
    const mieten = volleMieten();
    mieten[3] = { ...mieten[3], betrag: 1100 };
    expect(arten(pruefe({ einnahmen: mieten }), "zuordnung")).toEqual([expect.objectContaining({ schluessel: "ueberzahlt:anna:2025-04", betrag: 100 })]);
  });
});

describe("Offene Rückstände (Regeln des Mietkontos)", () => {
  it("Teilzahlung im März → 500 € offen; Dezember-Miete im Januar gezahlt (Mietmonat gesetzt) zählt", () => {
    const mieten = volleMieten();
    mieten[2] = { ...mieten[2], betrag: 500, nk_anteil: 100 };
    mieten[11] = { ...mieten[11], buchungsdatum: "2026-01-04", soll_monat: "2025-12" };
    const r = pruefe({ einnahmen: mieten });
    expect(arten(r, "rueckstand")).toEqual([expect.objectContaining({ betrag: 500, href: "/mietkonto?monat=2025-03", text: expect.stringContaining("März 2025") })]);
    mieten[2] = { ...mieten[2], betrag: 1000, nk_anteil: 200 };
    expect(arten(pruefe({ einnahmen: mieten }), "rueckstand")).toEqual([]);
  });
  it("laufendes Jahr: ein Monat vor dem 3. Werktag ist nicht offen", () => {
    const mieten = Array.from({ length: 9 }, (_, i) => ein({ buchungsdatum: `2026-${String(i + 1).padStart(2, "0")}-02`, soll_monat: `2026-${String(i + 1).padStart(2, "0")}` }));
    const r = jahresPruefung({
      jahr: 2026, heute: "2026-10-02", objekt: { id: P1, bezeichnung: "H" }, mieter: [mieter({ id: "anna" })], zeitraeume: [], einnahmen: mieten,
      kosten: [], kredite: [], meldungen: [], verbrauch: [], belegEingang: [], nk: { quelle: "keine", positionen: [] },
    });
    expect(arten(r, "rueckstand")).toEqual([]); // Oktober erst am 05.10. fällig (3. Werktag)
  });
  it("eine Mieterhöhung per Miet-Zeitraum zählt ab ihrem Monat (vertragswerte)", () => {
    const zr: JpZeitraum = { mieter_id: "anna", von: "2025-07-01", bis: null, kaltmiete: 900, nk_vorauszahlung: 200, stellplatz_miete: 0 };
    const zr0: JpZeitraum = { mieter_id: "anna", von: "2020-01-01", bis: "2025-06-01", kaltmiete: 800, nk_vorauszahlung: 200, stellplatz_miete: 0 };
    const r = pruefe({ zeitraeume: [zr0, zr] });
    const offen = arten(r, "rueckstand")[0];
    expect(offen?.betrag).toBe(600); // Juli–Dezember je 100 € zu wenig
  });
});

describe("Mögliche Dubletten", () => {
  it("zweimal gleiche Kosten am gleichen Tag → Punkt; Beschreibung unterscheidet sie → weg", () => {
    const a = kost({ betrag: 89.9, kategorie: "Müll", umlagefaehig: "ja" });
    const b = kost({ betrag: 89.9, kategorie: "Müll", umlagefaehig: "ja" });
    expect(arten(pruefe({ kosten: [a, b] }), "dublette")).toEqual([expect.objectContaining({ href: `/kosten/${b.id}/edit`, betrag: 89.9 })]);
    expect(arten(pruefe({ kosten: [{ ...a, beschreibung: "Rg. 1001" }, { ...b, beschreibung: "Rg. 1002" }] }), "dublette")).toEqual([]);
  });
  it("Mieteingang doppelt → Punkt", () => {
    const mieten = volleMieten();
    const r = pruefe({ einnahmen: [...mieten, { ...mieten[5], id: "doppelt" }] });
    expect(arten(r, "dublette")).toHaveLength(1);
  });
});

describe("Widersprüchliche Vertragszeiträume", () => {
  it("ohne Mietbeginn / Mietende vor Mietbeginn → wichtig", () => {
    expect(arten(pruefe({ mieter: [mieter({ id: "anna", mietbeginn: null })], einnahmen: [] }), "vertrag")).toEqual([expect.objectContaining({ schluessel: "ohne-beginn:anna" })]);
    expect(arten(pruefe({ mieter: [mieter({ id: "anna", mietbeginn: "2025-03-01", mietende: "2025-02-01" })], einnahmen: [] }), "vertrag").map((p) => p.schluessel)).toContain("ende-vor-beginn:anna");
  });
  it("Miet-Zeiträume überschneiden sich oder liegen außerhalb des Vertrags", () => {
    const zr = (von: string, bis: string | null): JpZeitraum => ({ mieter_id: "anna", von, bis, kaltmiete: 800, nk_vorauszahlung: 200, stellplatz_miete: 0 });
    const r = pruefe({ zeitraeume: [zr("2025-01-01", "2025-08-01"), zr("2025-06-01", null)] });
    expect(arten(r, "vertrag").map((p) => p.schluessel)).toContain("zeitraum-ueberlappt:anna:2025-06-01");
    expect(arten(pruefe({ zeitraeume: [zr("2025-01-01", "2025-05-01"), zr("2025-06-01", null)] }), "vertrag")).toEqual([]);
    expect(arten(pruefe({ zeitraeume: [zr("2019-01-01", null)] }), "vertrag").map((p) => p.schluessel)).toContain("zeitraum-ausserhalb:anna:2019-01-01");
    // Ein offener (laufender) Zeitraum, nach dem noch einer beginnt, überschneidet sich immer.
    expect(arten(pruefe({ zeitraeume: [zr("2024-01-01", null), zr("2025-06-01", null)] }), "vertrag").map((p) => p.schluessel)).toContain("zeitraum-ueberlappt:anna:2025-06-01");
  });
  it("zwei Mieter gleichzeitig in derselben Einheit → wichtig; nacheinander oder andere Einheit → nicht", () => {
    const ben = mieter({ id: "ben", vorname: "Ben", einheit: "EG", mietbeginn: "2025-06-01" });
    expect(arten(pruefe({ mieter: [mieter({ id: "anna" }), ben] }), "vertrag")).toEqual([expect.objectContaining({ schluessel: "doppelt-vermietet:anna,ben", href: "/tenants/ben/edit" })]);
    expect(arten(pruefe({ mieter: [mieter({ id: "anna", mietende: "2025-05-31" }), ben] }), "vertrag")).toEqual([]);
    expect(arten(pruefe({ mieter: [mieter({ id: "anna" }), { ...ben, einheit: "OG" }] }), "vertrag")).toEqual([]);
  });
  it("Objekt mit nur einer Einheit: zwei laufende Verträge ohne Einheit → Punkt", () => {
    const r = jahresPruefung({
      jahr: JAHR, heute: HEUTE, objekt: { id: P1, bezeichnung: "ETW", einheiten_anzahl: 1 },
      mieter: [mieter({ id: "anna", einheit: null }), mieter({ id: "ben", einheit: null, mietbeginn: "2024-01-01" })], zeitraeume: [], einnahmen: [],
      kosten: [], kredite: [], meldungen: [], verbrauch: [], belegEingang: [], nk: { quelle: "keine", positionen: [] },
    });
    expect(arten(r, "vertrag").map((p) => p.text)).toEqual([expect.stringContaining("gleichzeitig in diesem Objekt")]);
  });
});

describe("Umlagefähigkeit ungeklärt (dieselbe Regel wie die NK)", () => {
  it("Buchung „unklar“ → Punkt; „ja“ → weg; Hausgeld ohne Festlegung → je Kategorie", () => {
    const k = kost({ kategorie: "Hausmeister", umlagefaehig: "unklar" });
    expect(arten(pruefe({ kosten: [k] }), "umlage")).toEqual([expect.objectContaining({ href: `/kosten/${k.id}/edit` })]);
    expect(arten(pruefe({ kosten: [{ ...k, umlagefaehig: "ja" }] }), "umlage")).toEqual([]);
    const h = kost({ kategorie: "Hausgeld / WEG", betrag: 300 });
    expect(arten(pruefe({ kosten: [h] }), "umlage")).toEqual([expect.objectContaining({ schluessel: "umlage-kat:Hausgeld / WEG", betrag: 300 })]);
  });
});

describe("Zählerstände", () => {
  const meldung = (x: Partial<JpMeldung>): JpMeldung => ({ id: "z1", mieter_id: "anna", prop_id: P1, ablesedatum: "2025-12-31", uebernommen_am: null, art: "Wasser", ...x });
  it("gemeldet, nicht übernommen → Punkt; übernommen → weg", () => {
    expect(arten(pruefe({ meldungen: [meldung({})] }), "zaehler")).toEqual([expect.objectContaining({ href: "/verbrauch" })]);
    expect(arten(pruefe({ meldungen: [meldung({ uebernommen_am: "2026-01-05T10:00:00Z" })] }), "zaehler")).toEqual([]);
  });
  it(`Mieterwechsel ohne Ablesung ±${ZAEHLER_FENSTER_TAGE} Tage → Auszug und Einzug; mit Ablesung → weg`, () => {
    const ben = mieter({ id: "ben", vorname: "Ben", einheit: "OG", mietbeginn: "2018-01-01", mietende: "2025-05-31" });
    const dora = mieter({ id: "dora", vorname: "Dora", einheit: "OG", mietbeginn: "2025-06-01" });
    const ohne = arten(pruefe({ mieter: [mieter({ id: "anna" }), ben, dora], einnahmen: [] }), "zaehler").map((p) => p.schluessel).sort();
    expect(ohne).toEqual(["zwischenablesung:ben:Auszug", "zwischenablesung:dora:Einzug"]);
    expect(arten(pruefe({ mieter: [mieter({ id: "anna" }), ben, dora], einnahmen: [], verbrauch: [{ prop_id: P1, buchungsdatum: "2025-06-03" }] }), "zaehler")).toEqual([]);
    expect(arten(pruefe({ mieter: [mieter({ id: "anna" }), ben, dora], einnahmen: [], verbrauch: [{ prop_id: P1, buchungsdatum: "2025-06-20" }] }), "zaehler")).toHaveLength(2); // 20 Tage daneben
  });
});

// ------------------------------------------------------------------------------------------------
describe("Abgleich gegen die gebuchten Beträge (dieselben Rechnungen wie die Seiten)", () => {
  // Kaution, Schuldzinsen, Rücklastschrift (negative Miete) und Kosten-Gutschrift — die Fälle, an denen
  // Ableitungen schon einmal auseinanderliefen (Kaution im Jahresbericht, Negatives im DATEV-Export).
  const mieten = volleMieten();
  const daten = {
    einnahmen: [...mieten, ein({ kategorie: "Kaution", betrag: 2400, nk_anteil: null, buchungsdatum: "2025-01-02" }), ein({ betrag: -1000, nk_anteil: -200, buchungsdatum: "2025-05-09", soll_monat: "2025-05", beschreibung: "Rücklastschrift" }), ein({ betrag: 1000, nk_anteil: 200, buchungsdatum: "2025-05-20", soll_monat: "2025-05", beschreibung: "erneut" })],
    kosten: [kost({ kategorie: "Schuldzinsen", betrag: 1800, buchungsdatum: "2025-12-30" }), kost({ kategorie: "Reparatur", betrag: -150, buchungsdatum: "2025-04-01", beschreibung: "Gutschrift" }), kost({ kategorie: "Grundsteuer", betrag: 600, buchungsdatum: "2025-02-15" })],
  };
  it("alles stimmt — auch mit Kaution, Zinsen, Rücklastschrift und Gutschrift", () => {
    const r = pruefe(daten);
    const nichtStimmend = r.abgleich.filter((a) => !a.stimmt && !a.bezeichnung.startsWith("NK ·")).map((a) => `${a.bezeichnung}: ${a.a} vs ${a.b}`);
    expect(nichtStimmend).toEqual([]);
    const dErloes = r.abgleich.find((a) => a.bezeichnung === "DATEV · Erlöse")!;
    expect(dErloes.b).toBe(12000); // 12 × 1.000 − 1.000 + 1.000
    expect(r.abgleich.find((a) => a.bezeichnung === "DATEV · Kaution")!.b).toBe(2400);
    expect(r.abgleich.find((a) => a.bezeichnung === "DATEV · Aufwand")!.b).toBe(2250);
    expect(r.abgleich.find((a) => a.bezeichnung === "Cashflow-Seite · Buchungssaldo")!.b).toBe(12000 + 2400 - 2250);
    expect(r.abgleich.find((a) => a.bezeichnung === "Jahresbericht · laufende Kosten")!.b).toBe(450);
    expect(r.punkte.filter((p) => p.art === "abgleich")).toEqual([]);
  });
  it("weicht eine Ableitung ab (DATEV verliert Negative wie vor Ablauf A), steht ein wichtiger Prüfpunkt da", async () => {
    vi.resetModules();
    vi.doMock("@/lib/datev", async () => {
      const echt = await vi.importActual<typeof import("@/lib/datev")>("@/lib/datev");
      type E = Parameters<typeof echt.baueDatevBuchungen>[1];
      type K = Parameters<typeof echt.baueDatevBuchungen>[2];
      return { ...echt, baueDatevBuchungen: (j: number, e: E, k: K, n: (id: string | null) => string) =>
        echt.baueDatevBuchungen(j, e.filter((x) => (x.betrag ?? 0) > 0), k.filter((x) => (x.betrag ?? 0) > 0), n) };
    });
    const { jahresPruefung: jp } = await import("@/lib/jahresPruefung");
    const r = jp({
      jahr: JAHR, heute: HEUTE, objekt: { id: P1, bezeichnung: "H", einheiten_anzahl: 2 }, mieter: [mieter({ id: "anna" })], zeitraeume: [],
      einnahmen: daten.einnahmen, kosten: daten.kosten, kredite: [], meldungen: [], verbrauch: [], belegEingang: [], nk: { quelle: "keine", positionen: [] },
    });
    vi.doUnmock("@/lib/datev");
    const p = arten(r, "abgleich").map((x) => x.schluessel);
    expect(p).toEqual(expect.arrayContaining(["abgleich:DATEV · Erlöse", "abgleich:DATEV · Aufwand", "abgleich:DATEV · Anzahl Buchungen"]));
    expect(arten(r, "abgleich").every((x) => x.schwere === "hoch")).toBe(true);
  });
  it("Buchung mit Betrag 0 geht nicht in den Export — die Anzahl sagt es", () => {
    const r = pruefe({ ...daten, kosten: [...daten.kosten, kost({ betrag: 0, kategorie: "Sonstiges" })] });
    const z = r.abgleich.find((a) => a.bezeichnung === "DATEV · Anzahl Buchungen")!;
    expect(z.stimmt).toBe(true); // 0-Buchungen zählen auch links nicht mit
  });
  it("NK-Vorauszahlung ohne NK-Anteil gebucht → Punkt", () => {
    const ohneNk = volleMieten().map((x, i) => (i < 3 ? { ...x, nk_anteil: null } : x));
    const r = pruefe({ einnahmen: ohneNk });
    expect(r.abgleich.find((a) => a.bezeichnung === "NK · Vorauszahlungen")).toMatchObject({ a: 2400, b: 1800, stimmt: false });
    expect(arten(r, "abgleich")).toEqual([expect.objectContaining({ schluessel: "nk-vorauszahlung", betrag: -600 })]);
  });
  it("NK-Abrechnung gegen gebuchte umlagefähige Kosten: fehlt, weicht ab, ungebucht", () => {
    const kosten = [
      kost({ kategorie: "Grundsteuer", betrag: 600, umlagefaehig: "ja" }),
      kost({ kategorie: "Müll", betrag: 300, umlagefaehig: "ja", buchungsdatum: "2025-04-01" }),
      kost({ kategorie: "Versicherung", betrag: 400, umlagefaehig: "ja", buchungsdatum: "2025-05-01" }),
    ];
    const nk: JpNk = { quelle: "mieter", positionen: [{ bezeichnung: "Grundsteuer", betrag: 600 }, { bezeichnung: "Müllabfuhr", betrag: 350 }, { bezeichnung: "Heizung", betrag: 1200 }] };
    const r = pruefe({ kosten, nk });
    const s = arten(r, "abgleich").map((p) => p.schluessel).sort();
    expect(s).toEqual(["nk-betrag:müllabfuhr", "nk-fehlt:gebäudeversicherung", "nk-ungebucht:heizung"]);
    expect(r.abgleich.find((a) => a.bezeichnung === "NK · umlagefähige Kosten")).toMatchObject({ a: 1300, b: 2150 });
    // Korrigiert: Müll 350 gebucht, Versicherung in die NK, Heizung gebucht → nichts mehr offen
    const korrigiert = pruefe({
      kosten: [kosten[0], { ...kosten[1], betrag: 350 }, kosten[2], kost({ kategorie: "Heizung", betrag: 1200, umlagefaehig: "ja", buchungsdatum: "2025-06-01" })],
      nk: { quelle: "mieter", positionen: [...nk.positionen, { bezeichnung: "Gebäudeversicherung", betrag: 400 }] },
    });
    expect(arten(korrigiert, "abgleich")).toEqual([]);
  });
  it("NK am Objekt (MFH): Positionen werden addiert; beim Mieter zählt die Hausposition einmal", () => {
    const kosten = [kost({ kategorie: "Grundsteuer", betrag: 600, umlagefaehig: "ja" })];
    expect(arten(pruefe({ kosten, nk: { quelle: "objekt", positionen: [{ bezeichnung: "Grundsteuer", betrag: 400 }, { bezeichnung: "Grundsteuer", betrag: 200 }] } }), "abgleich")).toEqual([]);
    expect(arten(pruefe({ kosten, nk: { quelle: "mieter", positionen: [{ bezeichnung: "Grundsteuer", betrag: 600 }, { bezeichnung: "Grundsteuer", betrag: 600 }] } }), "abgleich")).toEqual([]);
    // Kurzbezeichnung in der Abrechnung („Müll“) = Bezeichnung der Buchungsvorschläge („Müllabfuhr“).
    const muell = [kost({ kategorie: "Müll", betrag: 300, umlagefaehig: "ja" })];
    expect(arten(pruefe({ kosten: muell, nk: { quelle: "mieter", positionen: [{ bezeichnung: "Müll", betrag: 300 }] } }), "abgleich")).toEqual([]);
  });
  it("noch keine NK erfasst → keine Einzelpunkte, nur der Hinweis in der Tabelle", () => {
    const r = pruefe({ kosten: [kost({ kategorie: "Grundsteuer", betrag: 600, umlagefaehig: "ja" })] });
    expect(arten(r, "abgleich")).toEqual([]);
    expect(r.abgleich.find((a) => a.bezeichnung === "NK · umlagefähige Kosten")?.erklaerung).toContain("noch keine NK-Kosten erfasst");
  });
});

// ------------------------------------------------------------------------------------------------
describe("Seite /properties/[id]/jahrespruefung", () => {
  async function seite(tabellen: Record<string, Record<string, unknown>[]>, jahr = "2025", id = P1) {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${HEUTE}T10:00:00Z`) });
    const db = speicherDb({ nutzer: { id: "u1" }, tabellen: {
      properties: [{ id: P1, user_id: "u1", bezeichnung: "Haus Lindenweg", einheiten_anzahl: 2, kaufdatum: "2019-05-01", typ: "Mehrfamilienhaus" }, { id: P2, user_id: "u2", bezeichnung: "Fremd" }],
      mieter: [], miet_zeitraeume: [], einnahmen: [], kosten: [], kredite: [], zaehlerstand_meldungen: [], verbrauch: [], beleg_eingang: [], nk_objekt_kosten: [], mieter_positionen: [],
      ...tabellen,
    } });
    vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
    vi.doMock("@/lib/supabase/nutzer", () => ({ aktuellerNutzer: async () => ({ id: "u1" }) }));
    vi.doMock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, redirect: () => { throw new Error("redirect"); } }));
    const { default: Seite } = await import("@/app/(app)/properties/[id]/jahrespruefung/page");
    const el = await Seite({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ jahr }) });
    return renderToStaticMarkup(el).replace(/<!-- -->/g, "");
  }
  const anna = { id: "anna", user_id: "u1", prop_id: P1, vorname: "Anna", nachname: "Weber", einheit: "EG", mietbeginn: "2020-01-01", mietende: null, kaltmiete: 800, nk_vorauszahlung: 200, stellplatz_miete: 0 };
  const mieten = () => volleMieten().map((x) => ({ ...x, user_id: "u1" }));

  it("zeigt Prüfpunkte mit Sprungziel und die Abgleich-Tabelle", async () => {
    const ohneBeleg = { ...kost({ rechnung_path: null, rechnung_name: null }), user_id: "u1" };
    const html = await seite({ mieter: [anna], einnahmen: mieten(), kosten: [ohneBeleg] });
    expect(html).toContain("Jahresprüfung 2025");
    expect(html).toContain("Fehlende Belege (1)");
    expect(html).toContain(`href="/kosten/${ohneBeleg.id}/edit"`);
    expect(html).toContain("DATEV · Erlöse");
    expect(html).toContain("✓ stimmt");
  });
  it("die Dezember-Miete aus dem Januar und Zahlungen beim falschen Objekt werden mitgeladen", async () => {
    const m = mieten();
    m[11] = { ...m[11], buchungsdatum: "2026-01-04" };       // soll_monat 2025-12
    m[4] = { ...m[4], prop_id: P2 };                          // falsches Objekt
    const html = await seite({ mieter: [anna], einnahmen: m });
    expect(html).not.toContain("Offene Rückstände");
    expect(html).toContain("einem anderen Objekt zugeordnet");
  });
  it("sauberes Jahr: „nichts offen“", async () => {
    const html = await seite({ mieter: [anna], einnahmen: mieten() });
    expect(html).toContain("Für 2025 ist nichts offen");
  });
  it("fremdes Objekt → nicht gefunden; unsinniges Jahr → Vorjahr", async () => {
    await expect(seite({}, "2025", P2)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await seite({ mieter: [anna], einnahmen: mieten() }, "1850")).toContain("Jahresprüfung 2025");
    expect(await seite({ mieter: [anna], einnahmen: mieten() }, "2027")).toContain("Jahresprüfung 2025");
  });
  it("eine fehlende Nebenquelle wird genannt statt still weggelassen", async () => {
    vi.resetModules();
    const html = await (async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${HEUTE}T10:00:00Z`) });
      const db = speicherDb({ nutzer: { id: "u1" }, fehlerBei: { beleg_eingang: "relation does not exist" }, tabellen: {
        properties: [{ id: P1, user_id: "u1", bezeichnung: "Haus", einheiten_anzahl: 2, typ: "Mehrfamilienhaus" }],
        mieter: [anna], miet_zeitraeume: [], einnahmen: mieten(), kosten: [], kredite: [], zaehlerstand_meldungen: [], verbrauch: [], nk_objekt_kosten: [], mieter_positionen: [],
      } });
      vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
      vi.doMock("@/lib/supabase/nutzer", () => ({ aktuellerNutzer: async () => ({ id: "u1" }) }));
      vi.doMock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
      const { default: Seite } = await import("@/app/(app)/properties/[id]/jahrespruefung/page");
      return renderToStaticMarkup(await Seite({ params: Promise.resolve({ id: P1 }), searchParams: Promise.resolve({ jahr: "2025" }) }));
    })();
    expect(html).toContain("Nicht geladen: Belegeingang");
  });
});
