import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { mockeNextUndSupabase } from "./stubs/actionHarness";
import { speicherDb, type SpeicherDbInit } from "./stubs/speicherDb";
import {
  leseKontoauszug, gleicheAb, gleicheRueckbuchungenAb, offeneMonate, rueckMonate, vorschauVerteilung, namensHinweis, normIban,
  type AbgleichMieter, type MieterStand, type RueckMieter, type Zahlung,
} from "@/lib/kontoauszug";
import { baueDatevBuchungen } from "@/lib/datev";

// Ablauf A (Prüfstand 11.10.2026, Phase 5): Kontoauszug → Vorschlag für Mieter/Monat → Prüfung
// unsicherer Treffer → bestätigte Buchung → Mietkonto → Erinnerungsvorschlag aus dem Rest.
//
// Vorher-Zustand (belegt am Code vor diesem Paket):
//   · Ausgänge im Auszug wurden nur gezählt — eine Rücklastschrift ließ sich nicht buchen, der Monat
//     blieb „bezahlt“, obwohl die Bank das Geld zurückgeholt hatte.
//   · Bei Mehrdeutigkeit stand nur das Wort „mehrdeutig“ da; der andere Mieter war nicht zu sehen und
//     nicht wählbar. Eingänge ohne Zuordnung waren eine Zahl, keine Liste.
//   · Ein Restbetrag nach einer Teilzahlung zählte nicht als „Betrag passt“.
//   · Nach dem Buchen kam ein Toast; was weiter offen ist, musste man im Rückstands-Wächter suchen.
//   · DATEV ließ negative Buchungen weg — die Summe dort lag über der in MyImmo.
// Externe Dienste: keiner beteiligt. Es wird nichts versendet (geprüft: kein fetch).

const U = "nutzer-1";
const hash = (iban: string) => createHash("sha256").update(normIban(iban)).digest("hex");
const IBAN_BERGER = "DE89370400440532013000";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2025-08-20T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

const vertrag = { kaltmiete: 700, nk_vorauszahlung: 150, stellplatz_miete: null, mietbeginn: "2024-01-01", mietende: null, minderungen: [] };
const stand = (zahlungen: MieterStand["zahlungen"] = []): MieterStand => ({ mieter: vertrag, zeitraeume: [], zahlungen });
const zahlung = (x: Partial<Zahlung> = {}): Zahlung => ({ zeile: 2, datum: "2025-08-04", betrag: 850, name: "Sophie Berger", zweck: "Miete August", iban: "", ...x });

// ------------------------------------------------------------------------------------------------
describe("Auszug lesen: Ausgänge bleiben als Liste erhalten", () => {
  it("Rücklastschrift und Strom sind Ausgänge mit negativem Betrag; gezählt wie vorher", () => {
    const csv = [
      `"Buchungstag";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"Betrag"`,
      `"01.08.25";"Miete August";"Sophie Berger";"DE89 3704 0044 0532 0130 00";"850,00"`,
      `"06.08.25";"RUECKLASTSCHRIFT Miete August";"Sophie Berger";"DE89 3704 0044 0532 0130 00";"-850,00"`,
      `"07.08.25";"Abschlag";"Stadtwerke";"DE11";"-89,90"`,
    ].join("\n");
    const a = leseKontoauszug(csv);
    if (!a.ok) throw new Error(a.fehler);
    expect(a.zahlungen.map((z) => z.betrag)).toEqual([850]);
    expect(a.ausgaenge).toBe(2);
    expect(a.abgaenge.map((z) => [z.betrag, z.name, z.iban])).toEqual([[-850, "Sophie Berger", IBAN_BERGER], [-89.9, "Stadtwerke", "DE11"]]);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Mehrdeutigkeit sichtbar, Restbetrag zählt", () => {
  const m = (x: Partial<AbgleichMieter>): AbgleichMieter => ({
    mieterId: "m1", propId: "p1", name: "Sophie Berger", nachname: "Berger", ibanHash: null,
    offen: [{ jahrMonat: "2025-08", gesamt: 850, nk: 150, rest: 850 }], ...x,
  });

  it("zwei gleich passende Mieter: Vorschlag, „mehrdeutig“, der andere steht als Alternative MIT seinen Monaten da", () => {
    const zwei = [m({}), m({ mieterId: "m2", name: "Karl Berger", offen: [{ jahrMonat: "2025-07", gesamt: 850, nk: 100, rest: 850 }] })];
    const { treffer } = gleicheAb([zahlung({ name: "Berger" })], zwei, new Map());
    expect(treffer).toHaveLength(1);
    expect(treffer[0]).toMatchObject({ mieterId: "m1", stufe: "vorschlag", gruende: ["Name", "Betrag", "mehrdeutig"] });
    expect(treffer[0].alternativen).toEqual([
      expect.objectContaining({ mieterId: "m2", name: "Karl Berger", jahrMonat: "2025-07", punkte: 4, monate: [expect.objectContaining({ jahrMonat: "2025-07" })] }),
    ]);
  });

  it("ein klar stärkerer Mieter (IBAN) bleibt „sicher“, der schwächere steht trotzdem als Alternative da", () => {
    const z = zahlung({ iban: IBAN_BERGER, name: "S Berger" });
    const zwei = [m({ mieterId: "m2", name: "Karl Berger" }), m({ ibanHash: hash(IBAN_BERGER) })];
    const { treffer } = gleicheAb([z], zwei, new Map([[z.zeile, hash(IBAN_BERGER)]]));
    expect(treffer[0]).toMatchObject({ mieterId: "m1", stufe: "sicher", punkte: 7 });
    expect(treffer[0].alternativen.map((a) => [a.mieterId, a.punkte])).toEqual([["m2", 4]]);
  });

  it("nur EIN passender Mieter → keine Alternativen", () => {
    expect(gleicheAb([zahlung()], [m({})], new Map()).treffer[0].alternativen).toEqual([]);
  });

  it("der offene REST nach einer Teilzahlung zählt als passender Betrag (+2)", () => {
    const teil = m({ offen: [{ jahrMonat: "2025-08", gesamt: 850, nk: 150, rest: 450 }] });
    const { treffer } = gleicheAb([zahlung({ betrag: 450 })], [teil], new Map());
    expect(treffer[0]).toMatchObject({ stufe: "sicher", gruende: ["Name", "Restbetrag"] });
  });

  it("ein Rest ohne Teilzahlung (rest = gesamt) zählt nur einmal als „Betrag“", () => {
    expect(gleicheAb([zahlung()], [m({})], new Map()).treffer[0].gruende).toEqual(["Name", "Betrag"]);
  });

  it("Eingang ohne Zuordnung: genau ein Mieter mit passendem Namen wird vorgeschlagen, bei zweien keiner", () => {
    const z = zahlung({ betrag: 123 });
    expect(gleicheAb([z], [m({})], new Map()).ohneZuordnung).toEqual([z]);
    expect(namensHinweis(z, [m({})], new Map())).toBe("m1");
    expect(namensHinweis(z, [m({}), m({ mieterId: "m2" })], new Map())).toBeNull();
    expect(namensHinweis(zahlung({ name: "Arbeitgeber GmbH", zweck: "Gehalt" }), [m({})], new Map())).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
describe("offene Monate aus Vertrag und Zahlungen (dieselbe Rechnung wie der Server)", () => {
  it("Teilzahlung → Rest; Rücklastschrift → wieder ganz offen; bezahlt → nicht offen", () => {
    const s = stand([
      { jahrMonat: "2025-06", betrag: 850, datum: "2025-06-03" },
      { jahrMonat: "2025-07", betrag: 850, datum: "2025-07-03" },
      { jahrMonat: "2025-07", betrag: -850, datum: "2025-07-09" },
      { jahrMonat: "2025-08", betrag: 400, datum: "2025-08-04" },
    ]);
    expect(offeneMonate(s, "2025-06", "2025-08").map((o) => [o.jahrMonat, o.rest])).toEqual([["2025-07", 850], ["2025-08", 450]]);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Ausgänge an Mieter: Rücklastschrift oder Erstattung", () => {
  const rm = (x: Partial<RueckMieter> = {}): RueckMieter => ({
    mieterId: "m1", propId: "p1", name: "Sophie Berger", nachname: "Berger", ibanHash: hash(IBAN_BERGER),
    stand: stand([{ jahrMonat: "2025-08", betrag: 850, datum: "2025-08-01" }]), ...x,
  });
  const ab = (x: Partial<Zahlung> = {}) => zahlung({ zeile: 9, datum: "2025-08-06", betrag: -850, zweck: "Miete August", iban: IBAN_BERGER, ...x });
  const h = (z: Zahlung) => new Map([[z.zeile, hash(z.iban)]]);

  it("„Rücklastschrift“ im Zweck → Rücklastschrift auf den Monat der Zahlung", () => {
    const z = ab({ zweck: "RUECKLASTSCHRIFT Miete August" });
    const [t] = gleicheRueckbuchungenAb([z], [rm()], h(z));
    expect(t).toMatchObject({ mieterId: "m1", art: "ruecklastschrift", jahrMonat: "2025-08", gruende: ["IBAN", "Name", "Rücklastschrift im Zweck"] });
  });

  it("ohne Stichwort: derselbe Betrag kam vor wenigen Tagen herein → Rücklastschrift", () => {
    const z = ab();
    expect(gleicheRueckbuchungenAb([z], [rm()], h(z))[0]).toMatchObject({ art: "ruecklastschrift", jahrMonat: "2025-08" });
  });

  it("Überzahlung im Monat → Erstattung auf diesen Monat", () => {
    const m = rm({ stand: stand([{ jahrMonat: "2025-07", betrag: 900, datum: "2025-07-02" }]) });
    const z = ab({ betrag: -50, zweck: "Rueckzahlung zu viel" });
    expect(rueckMonate(m.stand)).toEqual([{ jahrMonat: "2025-07", gezahlt: 900, ueberzahlt: 50 }]);
    // „Rueckzahlung“ ist kein Rücklastschrift-Wort → Erstattung
    expect(gleicheRueckbuchungenAb([z], [m], h(z))[0]).toMatchObject({ art: "erstattung", jahrMonat: "2025-07" });
  });

  it("Erstattung ohne überzahlten Monat → kein Monat vorgeschlagen (Kaution/NK-Guthaben gehören nicht hierher)", () => {
    const z = ab({ betrag: -300, zweck: "Kaution zurueck" });
    expect(gleicheRueckbuchungenAb([z], [rm()], h(z))[0]).toMatchObject({ art: "erstattung", jahrMonat: null });
  });

  it("ein Ausgang an Fremde wird NICHT zugeordnet — auch nicht bei gleichem Betrag", () => {
    const z = ab({ name: "Stadtwerke", iban: "DE11" });
    expect(gleicheRueckbuchungenAb([z], [rm()], h(z))).toEqual([]);
  });

  it("zwei Mieter mit gleichem Namen ohne IBAN → mehrdeutig, Alternative genannt", () => {
    const z = ab({ iban: "", zweck: "Ruecklastschrift" });
    const [t] = gleicheRueckbuchungenAb([z], [rm({ ibanHash: null }), rm({ mieterId: "m2", name: "Karl Berger", ibanHash: null })], new Map());
    expect(t.gruende).toContain("mehrdeutig");
    expect(t.alternativen).toEqual([{ mieterId: "m2", name: "Karl Berger" }]);
  });
});

// ------------------------------------------------------------------------------------------------
const mieter = (over: Record<string, unknown> = {}) => ({
  id: "m1", user_id: U, vorname: "Sophie", nachname: "Berger", prop_id: "p1", kaltmiete: 700, nk_vorauszahlung: 150,
  stellplatz_miete: null, mietbeginn: "2024-01-01", mietende: null, minderungen: null, ...over,
});
const miete = (over: Record<string, unknown> = {}) => ({
  user_id: U, mieter_id: "m1", prop_id: "p1", kategorie: "Miete", buchungsdatum: "2025-07-03", betrag: 850, nk_anteil: 150,
  soll_monat: "2025-07", zahlung_ref: "a:m1|2025-07", ...over,
});
/** Alles bis Juli 2025 bezahlt — damit nur das offen ist, was der Test erzeugt. */
const bisJuliBezahlt = () => {
  const rows = [];
  for (let m = 1; m <= 19; m++) {
    const ym = `${2024 + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, "0")}`;
    rows.push(miete({ soll_monat: ym, buchungsdatum: `${ym}-03`, zahlung_ref: `a:m1|${ym}` }));
  }
  return rows;
};

async function lade(init: { einnahmen?: Record<string, unknown>[]; notizen?: Record<string, unknown>[]; mieter?: Record<string, unknown>[] } & Partial<SpeicherDbInit> = {}) {
  vi.resetModules();
  const db = speicherDb({
    tabellen: {
      mieter: init.mieter ?? [mieter(), mieter({ id: "m-fremd", user_id: "anderer" })],
      miet_zeitraeume: [],
      einnahmen: init.einnahmen ?? bisJuliBezahlt(),
      notizen: init.notizen ?? [],
    },
    eindeutig: { einnahmen: [["user_id", "zahlung_ref"]] },
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/mietkonto");
  return { db, mod, einnahmen: () => db.tabellen.einnahmen as Record<string, unknown>[] };
}
const ka = (over: Record<string, unknown> = {}) => ({
  mieter_id: "m1", buchungsdatum: "2025-07-09", betrag: -850, soll_monat: "2025-07", vorgang: "rueck-zeile-0001", art: "ruecklastschrift" as const, ...over,
});
const imMonat = (rows: Record<string, unknown>[], ym: string) => rows.filter((r) => r.soll_monat === ym);
const summe = (rows: Record<string, unknown>[], f = "betrag") => Math.round(rows.reduce((s, r) => s + Number(r[f] ?? 0), 0) * 100) / 100;

describe("Server: Rückbuchungen aus dem Kontoauszug", () => {
  it("Rücklastschrift → negative Buchung mit demselben NK-Anteil; danach ist der Monat wieder offen", async () => {
    const { mod, einnahmen } = await lade();
    const r = await mod.bestaetigeMehrere([ka()], "kontoauszug");
    expect(r).toMatchObject({ ok: true, anzahl: 1 });
    expect(imMonat(einnahmen(), "2025-07").find((x) => Number(x.betrag) < 0)).toMatchObject({
      betrag: -850, nk_anteil: -150, zahlung_ref: "ka:rueck-zeile-0001", kategorie: "Miete", beschreibung: "Rücklastschrift (Kontoauszug)",
    });
    expect(summe(imMonat(einnahmen(), "2025-07"))).toBe(0);
    expect(r.offen?.map((o) => [o.jahrMonat, o.rest])).toContainEqual(["2025-07", 850]);
  });

  it("REGRESSION: nach einer Rücklastschrift lässt sich der Monat wieder bestätigen (neue Kennung „a:…|r1“)", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([ka()], "kontoauszug");
    // Vorher: dieselbe Kennung „a:m1|2025-07“ existierte schon → „übersprungen“, der Monat blieb offen.
    const r = await mod.bestaetigeMieteingang({ mieter_id: "m1", buchungsdatum: "2025-07-20", betrag: 850, soll_monat: "2025-07", vorgang: "neu-0001" });
    expect(r).toEqual({ ok: true });
    expect(imMonat(einnahmen(), "2025-07").map((x) => [x.betrag, x.zahlung_ref])).toEqual([
      [850, "a:m1|2025-07"], [-850, "ka:rueck-zeile-0001"], [850, "a:m1|2025-07|r1"],
    ]);
  });

  it("nach der Rücklastschrift: zwei gleichzeitige Bestätigungen buchen den Monat nur EINMAL", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([ka()], "kontoauszug");
    const eingabe = (v: string) => ({ mieter_id: "m1", buchungsdatum: "2025-07-20", betrag: 850, soll_monat: "2025-07", vorgang: v });
    const [a, b] = await Promise.all([mod.bestaetigeMieteingang(eingabe("tab-a-0001")), mod.bestaetigeMieteingang(eingabe("tab-b-0001"))]);
    expect([a.ok, b.ok]).toEqual([true, true]);
    expect([a, b].filter((x) => x.uebersprungen)).toHaveLength(1);
    expect(summe(imMonat(einnahmen(), "2025-07"))).toBe(850);
  });

  it("Nacherfassung nach einer Rücklastschrift bucht den Monat wieder (gleiche Kennungslogik)", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([ka()], "kontoauszug");
    const r = await mod.bestaetigeMehrere([{ mieter_id: "m1", buchungsdatum: "2025-07-25", betrag: 850, soll_monat: "2025-07" }], "nacherfassung");
    expect(r).toMatchObject({ ok: true, anzahl: 1 });
    expect(imMonat(einnahmen(), "2025-07").at(-1)).toMatchObject({ zahlung_ref: "a:m1|2025-07|r1" });
  });

  it("dieselbe Rücklastschrift zweimal eingelesen → keine zweite Buchung", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([ka()], "kontoauszug");
    expect(await mod.bestaetigeMehrere([ka()], "kontoauszug")).toMatchObject({ ok: true, anzahl: 0, uebersprungen: 1 });
    expect(summe(imMonat(einnahmen(), "2025-07"))).toBe(0);
  });

  it("Rücklastschrift höher als eingegangen → nicht gebucht, mit Grund", async () => {
    const { mod, einnahmen } = await lade();
    const vorher = einnahmen().length;
    const r = await mod.bestaetigeMehrere([ka({ betrag: -1700 })], "kontoauszug");
    expect(r).toMatchObject({ ok: true, anzahl: 0 });
    expect(r.abgelehnt?.[0]).toMatch(/Sophie Berger, Juli 2025: Rücklastschrift 1\.700,00\s€ ist mehr als eingegangen \(850,00\s€\)/);
    expect(einnahmen()).toHaveLength(vorher);
  });

  it("Teil-Rücklastschrift: NK-Anteil anteilig zum gebuchten Verhältnis", async () => {
    const { mod, einnahmen } = await lade();
    await mod.bestaetigeMehrere([ka({ betrag: -400 })], "kontoauszug");
    expect(imMonat(einnahmen(), "2025-07").at(-1)).toMatchObject({ betrag: -400, nk_anteil: -70.59 });
  });

  it("Erstattung nur bis zur Überzahlung; NK-Anteil nur, soweit NK überzahlt sind", async () => {
    const ein = bisJuliBezahlt().map((r) => (r.soll_monat === "2025-07" ? { ...r, betrag: 900 } : r));
    const { mod, einnahmen } = await lade({ einnahmen: ein });
    const zuviel = await mod.bestaetigeMehrere([ka({ betrag: -60, art: "erstattung", vorgang: "erst-zeile-0001" })], "kontoauszug");
    expect(zuviel.abgelehnt?.[0]).toMatch(/Erstattung 60,00\s€, überzahlt sind 50,00\s€ — nicht gebucht\. Kaution oder NK-Guthaben/);
    const ok = await mod.bestaetigeMehrere([ka({ betrag: -50, art: "erstattung", vorgang: "erst-zeile-0002" })], "kontoauszug");
    expect(ok).toMatchObject({ ok: true, anzahl: 1 });
    expect(imMonat(einnahmen(), "2025-07").at(-1)).toMatchObject({ betrag: -50, nk_anteil: null, beschreibung: "Erstattung an Mieter (Kontoauszug)" });
    expect(summe(imMonat(einnahmen(), "2025-07"))).toBe(850);
  });

  it("Vorzeichen und Art gehören zusammen: negativ ohne Art, positiv mit Art, ohne Monat, in der Nacherfassung → nichts", async () => {
    const { mod, einnahmen } = await lade();
    const vorher = einnahmen().length;
    expect((await mod.bestaetigeMehrere([ka({ art: null })], "kontoauszug")).ok).toBe(false);
    expect((await mod.bestaetigeMehrere([ka({ betrag: 850 })], "kontoauszug")).ok).toBe(false);
    expect((await mod.bestaetigeMehrere([ka({ soll_monat: null })], "kontoauszug")).ok).toBe(false);
    expect((await mod.bestaetigeMehrere([ka()], "nacherfassung")).ok).toBe(false);
    expect(einnahmen()).toHaveLength(vorher);
  });

  it("Berechtigung: ein fremder Mieter wird übersprungen, nichts gebucht", async () => {
    const { mod, einnahmen } = await lade();
    const vorher = einnahmen().length;
    expect(await mod.bestaetigeMehrere([ka({ mieter_id: "m-fremd" })], "kontoauszug")).toMatchObject({ ok: true, anzahl: 0, uebersprungen: 1 });
    expect(einnahmen()).toHaveLength(vorher);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Nach dem Abgleich: Erinnerungsvorschlag aus dem tatsächlichen Rest", () => {
  const eingang = (over: Record<string, unknown> = {}) => ({
    mieter_id: "m1", buchungsdatum: "2025-08-04", betrag: 400, soll_monat: "2025-08", vorgang: "eingang-zeile-01", ...over,
  });

  it("Teilzahlung im überfälligen Monat → Rest 450 mit vorbereitetem Brief für genau diesen Mieter, Monat und Betrag", async () => {
    const fetchSpion = vi.spyOn(globalThis, "fetch");
    const { mod } = await lade();
    const r = await mod.bestaetigeMehrere([eingang()], "kontoauszug");
    expect(r.offen).toEqual([
      expect.objectContaining({ mieterId: "m1", name: "Sophie Berger", jahrMonat: "2025-08", gesamt: 850, gezahlt: 400, rest: 450 }),
    ]);
    const o = r.offen![0];
    expect(o.tageOffen).toBeGreaterThan(0);
    expect(o.wahl?.titel).toBe("Sophie Berger · Miete August 2025 · 450,00 € offen");
    const url = new URL(o.wahl!.erinnerung, "https://x");
    expect(url.pathname).toBe("/tenants/m1/dokument");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ art: "zahlungserinnerung", betrag: "450", monat: "2025-08" });
    expect(o.wahl!.mahnung).toContain("art=mahnung");
    // Versendet wird NICHTS — kein Mail-, kein Portal-Aufruf.
    expect(fetchSpion).not.toHaveBeenCalled();
  });

  it("ganz bezahlt → nichts offen, kein Brief", async () => {
    const { mod } = await lade();
    expect((await mod.bestaetigeMehrere([eingang({ betrag: 850 })], "kontoauszug")).offen).toEqual([]);
  });

  it("noch nicht fällig (vor dem 3. Werktag) → nicht in der Liste", async () => {
    vi.setSystemTime(new Date("2025-09-02T10:00:00Z"));
    const ein = [...bisJuliBezahlt(), miete({ soll_monat: "2025-08", buchungsdatum: "2025-08-03", zahlung_ref: "a:m1|2025-08" })];
    const { mod } = await lade({ einnahmen: ein });
    const r = await mod.bestaetigeMehrere([eingang({ buchungsdatum: "2025-09-01", soll_monat: "2025-09", betrag: 100 })], "kontoauszug");
    expect(r.offen).toEqual([]);
  });

  it("archivierte Zahlungserinnerung nach der Fälligkeit → nur ein Hinweis, der Brief bleibt wählbar", async () => {
    const { mod } = await lade({ notizen: [{ user_id: U, mieter_id: "m1", titel: "Zahlungserinnerung – Sophie Berger", created_at: "2025-08-12T09:00:00Z" }] });
    const r = await mod.bestaetigeMehrere([eingang()], "kontoauszug");
    expect(r.offen![0].wahl).toMatchObject({ erinnerungArchiviert: true });
  });

  it("die Archiv-Abfrage scheitert → der Vorschlag kommt trotzdem (ohne Hinweis)", async () => {
    vi.resetModules();
    const db = speicherDb({
      tabellen: { mieter: [mieter()], miet_zeitraeume: [], einnahmen: bisJuliBezahlt(), notizen: [] },
      eindeutig: { einnahmen: [["user_id", "zahlung_ref"]] },
      fehlerBei: { notizen: "Zeitüberschreitung" },
    });
    mockeNextUndSupabase(db.client);
    const mod = await import("@/lib/actions/mietkonto");
    const r = await mod.bestaetigeMehrere([eingang()], "kontoauszug");
    expect(r.offen![0].wahl).toMatchObject({ erinnerungArchiviert: false });
  });
});

// ------------------------------------------------------------------------------------------------
describe("Vorschau im Browser = Buchung auf dem Server", () => {
  it("Sammelzahlung 1.900 € ab Juli: dieselben Teile und dieselbe Überzahlung", async () => {
    const ein = bisJuliBezahlt().filter((r) => r.soll_monat !== "2025-07");
    const daten = new Map([["m1", stand(ein.map((r) => ({ jahrMonat: r.soll_monat as string, betrag: r.betrag as number, datum: r.buchungsdatum as string })))]]);
    const v = vorschauVerteilung([{ schluessel: 2, mieterId: "m1", betrag: 1900, monat: "2025-07" }], daten, "2025-08").get(2)!;
    expect(v.teile.map((t) => [t.jahrMonat, t.betrag])).toEqual([["2025-07", 850], ["2025-08", 1050]]);
    expect(v.ueberzahlung).toBe(200);

    const { mod, einnahmen } = await lade({ einnahmen: ein });
    const r = await mod.bestaetigeMehrere([{ mieter_id: "m1", buchungsdatum: "2025-08-04", betrag: 1900, soll_monat: "2025-07", vorgang: "sammel-zeile-1" }], "kontoauszug");
    expect(r.ueberzahlung).toBe(v.ueberzahlung);
    const neu = einnahmen().filter((x) => String(x.zahlung_ref).startsWith("ka:"));
    expect(neu.map((x) => [x.soll_monat, x.betrag])).toEqual(v.teile.map((t) => [t.jahrMonat, t.betrag]));
  });

  it("zwei Eingänge desselben Mieters werden nacheinander verrechnet (wie beim Buchen)", () => {
    const daten = new Map([["m1", stand([])]]);
    const v = vorschauVerteilung(
      [{ schluessel: 2, mieterId: "m1", betrag: 850, monat: "2025-08" }, { schluessel: 3, mieterId: "m1", betrag: 850, monat: "2025-08" }],
      daten, "2025-09",
    );
    expect(v.get(2)!.teile.map((t) => t.jahrMonat)).toEqual(["2025-08"]);
    expect(v.get(3)!.teile.map((t) => t.jahrMonat)).toEqual(["2025-09"]);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Mietkonto nach einer Rückbuchung", () => {
  it("ein Monat mit +850 / −850 steht wieder zum Bestätigen da; die Zahlungen gehen in den Abgleich", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    const db = speicherDb({
      tabellen: {
        mieter: [mieter({ einheit: null, iban: null })],
        miet_zeitraeume: [],
        properties: [{ id: "p1", user_id: U, bezeichnung: "Haus" }],
        einnahmen: [miete(), miete({ betrag: -850, nk_anteil: -150, zahlung_ref: "ka:x", buchungsdatum: "2025-07-09" }), miete({ soll_monat: "2025-08", buchungsdatum: "2025-08-03", betrag: 400, zahlung_ref: "m:y" })],
      },
    });
    mockeNextUndSupabase(db.client);
    const { ladeMietkonto } = await import("@/lib/mietkontoDaten");
    const juli = await ladeMietkonto("2025-07");
    expect(juli.zeilen[0]).toMatchObject({ schonGebucht: false, gezahlt: 0 });
    expect(juli.nacherfassung[0].gebuchteMonate).toEqual(["2025-08"]);
    expect(juli.nacherfassung[0].zahlungen).toEqual([
      { jahrMonat: "2025-07", betrag: 850, datum: "2025-07-03" },
      { jahrMonat: "2025-07", betrag: -850, datum: "2025-07-09" },
      { jahrMonat: "2025-08", betrag: 400, datum: "2025-08-03" },
    ]);
    const aug = await ladeMietkonto("2025-08");
    expect(aug.zeilen[0]).toMatchObject({ schonGebucht: true, gezahlt: 400 });
  });
});

// ------------------------------------------------------------------------------------------------
describe("DATEV stimmt mit den Buchungen überein (auch mit Rückbuchungen)", () => {
  it("negative Einnahme → Soll auf demselben Erlöskonto; Haben − Soll = Summe in MyImmo", () => {
    const einnahmen = [
      { buchungsdatum: "2025-07-03", betrag: 850, kategorie: "Miete", prop_id: "p1" },
      { buchungsdatum: "2025-07-09", betrag: -850, kategorie: "Miete", prop_id: "p1", beschreibung: "Rücklastschrift (Kontoauszug)" },
      { buchungsdatum: "2025-07-20", betrag: 850, kategorie: "Miete", prop_id: "p1" },
    ];
    const kosten = [
      { buchungsdatum: "2025-03-01", betrag: 200, kategorie: "Reparatur", prop_id: "p1" },
      { buchungsdatum: "2025-03-09", betrag: -40, kategorie: "Reparatur", prop_id: "p1", beschreibung: "Gutschrift" },
    ];
    const b = baueDatevBuchungen(2025, einnahmen, kosten, () => "Haus");
    const rueck = b.find((x) => x.buchungstext.includes("Rücklastschrift"))!;
    expect(rueck).toMatchObject({ betrag: 850, sollHaben: "S", konto: 8100 });
    expect(b.find((x) => x.buchungstext.includes("Gutschrift"))).toMatchObject({ betrag: 40, sollHaben: "H", konto: 4260 });
    const erloese = b.filter((x) => x.konto === 8100).reduce((s, x) => s + (x.sollHaben === "H" ? x.betrag : -x.betrag), 0);
    expect(erloese).toBe(einnahmen.reduce((s, e) => s + e.betrag, 0));
    const aufwand = b.filter((x) => x.konto === 4260).reduce((s, x) => s + (x.sollHaben === "S" ? x.betrag : -x.betrag), 0);
    expect(aufwand).toBe(160);
    expect(b.every((x) => x.betrag > 0)).toBe(true);
  });
});
