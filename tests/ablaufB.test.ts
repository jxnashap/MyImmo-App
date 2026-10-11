import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { mockeNextUndSupabase } from "./stubs/actionHarness";
import { speicherDb, type SpeicherDbInit } from "./stubs/speicherDb";
import {
  leseBelegVorschlag, objektVorschlag, pruefeBeleg, buchbar, anzeigeStatus, kiMoeglich, BELEG_PROMPT,
  type KostenZeile, type BelegEingabe,
} from "@/lib/belegEingang";
import { nkAusBuchungen } from "@/lib/nkAusBuchungen";

// Ablauf B (Prüfstand 11.10.2026, Phase 5): Beleg hochladen → KI-Vorschlag → Objekt → Abgleich mit
// gebuchten Kosten → getrennte Vorschläge für Kostenart und Umlagefähigkeit → Freigabe → GENAU EINE
// Buchung mit Belegbezug. Unklares steht in der Prüfliste und sperrt die Buchung.
//
// Vorher-Zustand (belegt am Code vor diesem Paket): kein Belegeingang, kein Vorschlag aus dem Beleg,
// keine Dublettenprüfung für Kosten, keine Prüfliste; Umlagefähigkeit nur aus der Kategorie
// (`istUmlagefaehig`), eine Hausmeister-Rechnung mit Reparaturanteil ging also immer ganz in die NK.
// Externe Dienste: Der KI-Anbieter ist in allen Tests durch einen kontrollierten Adapter ersetzt —
// kein Aufruf kostet Geld, kein Beleg verlässt den Rechner.

const U = "nutzer-1";
const E1 = "11111111-2222-4333-8444-555555555555";
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF");
const HASH = createHash("sha256").update(PDF).digest("hex");

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/aiRoute", "@/lib/net/bremse"]) vi.doUnmock(m);
});

// ------------------------------------------------------------------------------------------------
describe("KI-Antwort lesen: nur Vorschlag, nichts geraten", () => {
  const antwort = (o: Record<string, unknown>) => `Hier: ${JSON.stringify(o)} Ende`;
  it("liest Betrag, Datum, Kostenart und Umlagefähigkeit getrennt", () => {
    const v = leseBelegVorschlag(antwort({
      datum: "2026-03-14", betrag: 240.5, aussteller: "AWB Köln", rechnungsnummer: "RE-42", leistung: "Restmüll 2026",
      kostenart: "müll", umlagefaehig: "ja", umlage_grund: "Müllabfuhr § 2 Nr. 8", objekt: "Lindenstr. 1, Köln",
    }));
    expect(v).toEqual({
      datum: "2026-03-14", betrag: 240.5, aussteller: "AWB Köln", rechnungsnummer: "RE-42", leistung: "Restmüll 2026",
      kategorie: "Müll", kategorieRoh: null, umlage: "ja", umlageGrund: "Müllabfuhr § 2 Nr. 8", objektHinweis: "Lindenstr. 1, Köln",
    });
  });
  it("unplausible Werte werden null — nie eine erfundene Zahl", () => {
    const v = leseBelegVorschlag(antwort({ datum: "2026-02-30", betrag: -5, kostenart: "Gartenzwerge", umlagefaehig: "vielleicht" }))!;
    expect(v).toMatchObject({ datum: null, betrag: null, kategorie: null, kategorieRoh: "Gartenzwerge", umlage: null });
    expect(leseBelegVorschlag(antwort({ betrag: 1e9 }))!.betrag).toBeNull();
    expect(leseBelegVorschlag("kein JSON")).toBeNull();
    expect(leseBelegVorschlag("[1,2]")).toBeNull();
  });
  it("die Anweisung trennt Kostenart und Umlagefähigkeit und verbietet Raten", () => {
    expect(BELEG_PROMPT).toMatch(/ANDERE Frage als die Kostenart/);
    expect(BELEG_PROMPT).toMatch(/Nie raten/);
    expect(BELEG_PROMPT).toMatch(/BUCHST nichts/);
  });
});

describe("Objekt aus der Anschrift: nur bei genau einem Treffer", () => {
  const objekte = [
    { id: "p1", bezeichnung: "MFH Lindenstraße", adresse: "Lindenstraße 1, 50667 Köln" },
    { id: "p2", bezeichnung: "ETW Ring", adresse: "Ringstr. 5, Köln" },
  ];
  it("Straße erkannt (auch „Str.“ ↔ „Straße“)", () => {
    expect(objektVorschlag("Objekt: Lindenstr. 1, Köln", objekte)).toBe("p1");
    expect(objektVorschlag("Ringstraße 5", objekte)).toBe("p2");
  });
  it("nichts oder mehrdeutig → kein Vorschlag", () => {
    expect(objektVorschlag("Hauptstraße 9", objekte)).toBeNull();
    expect(objektVorschlag(null, objekte)).toBeNull();
    expect(objektVorschlag("Lindenstraße 1", [...objekte, { id: "p3", bezeichnung: "Garage", adresse: "Lindenstraße 1, Köln" }])).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
describe("Prüfliste", () => {
  const e = (x: Partial<BelegEingabe> = {}): BelegEingabe => ({
    eintragId: "e1", datei_hash: HASH, prop_id: "p1", kategorie: "Müll", umlagefaehig: "ja", betrag: 240.5, datum: "2026-03-14", ...x,
  });
  const k = (x: Partial<KostenZeile> = {}): KostenZeile => ({
    id: "k1", prop_id: "p1", buchungsdatum: "2026-03-01", betrag: 240.5, kategorie: "Müll", beschreibung: null, rechnung_path: null, beleg_eingang_id: null, ...x,
  });
  const leer = { kosten: [] as KostenZeile[], eingaenge: [] };

  it("vollständig und eindeutig → keine Punkte, buchbar", () => {
    const r = pruefeBeleg(e(), leer);
    expect(r).toEqual({ punkte: [], anhaengbar: [] });
    expect(buchbar(r.punkte, false)).toBe(true);
  });
  it("fehlender Betrag/Datum, unbekannte Kostenart, kein Objekt → sperrt", () => {
    const r = pruefeBeleg(e({ betrag: null, datum: null, kategorie: "Gartenzwerge", prop_id: null }), leer);
    expect(r.punkte.map((p) => [p.art, p.sperrt])).toEqual([
      ["betrag_fehlt", true], ["datum_fehlt", true], ["kategorie_unbekannt", true], ["objekt_fehlt", true],
    ]);
    expect(buchbar(r.punkte, true)).toBe(false);
  });
  it("„ohne Objekt“ ausdrücklich gewählt → kein Objekt-Punkt", () => {
    expect(pruefeBeleg(e({ prop_id: null, ohneObjekt: true }), leer).punkte).toEqual([]);
  });
  it("dieselbe Datei schon im Eingang → Dublette; buchbar nur mit Bestätigung", () => {
    const r = pruefeBeleg(e(), { kosten: [], eingaenge: [{ id: "e0", datei_hash: HASH, status: "gebucht" }] });
    expect(r.punkte).toEqual([{ art: "dublette_datei", text: "Dieselbe Datei liegt schon im Belegeingang und ist gebucht.", sperrt: true }]);
    expect(buchbar(r.punkte, false)).toBe(false);
    expect(buchbar(r.punkte, true)).toBe(true);
  });
  it("gleicher Betrag ±3 Tage MIT Beleg → mögliche Dublette; gleiche Rechnungsnummer in der Beschreibung ebenso", () => {
    expect(pruefeBeleg(e(), { kosten: [k({ rechnung_path: "u/x.pdf", buchungsdatum: "2026-03-12" })], eingaenge: [] }).punkte[0])
      .toMatchObject({ art: "dublette_buchung", sperrt: true });
    expect(pruefeBeleg(e({ rechnungsnummer: "RE-2026-42" }), { kosten: [k({ betrag: 1, beschreibung: "AWB · Nr. RE-2026-42" })], eingaenge: [] }).punkte[0])
      .toMatchObject({ art: "dublette_buchung" });
    // anderes Objekt, anderer Betrag oder weiter weg → keine Dublette
    expect(pruefeBeleg(e(), { kosten: [k({ rechnung_path: "u/x.pdf", prop_id: "p2" })], eingaenge: [] }).punkte).toEqual([]);
    expect(pruefeBeleg(e(), { kosten: [k({ rechnung_path: "u/x.pdf", buchungsdatum: "2026-03-20" })], eingaenge: [] }).punkte).toEqual([]);
  });
  it("gebuchte Kosten OHNE Beleg (gleicher Betrag, ±45 Tage) → anhängbar; zwei davon → Zahlung unklar", () => {
    const eins = pruefeBeleg(e(), { kosten: [k(), k({ id: "k2", betrag: 99 }), k({ id: "k3", buchungsdatum: "2025-12-01" })], eingaenge: [] });
    expect(eins.anhaengbar.map((x) => x.id)).toEqual(["k1"]);
    expect(eins.punkte).toEqual([]);
    const zwei = pruefeBeleg(e(), { kosten: [k(), k({ id: "k2", buchungsdatum: "2026-04-10" })], eingaenge: [] });
    expect(zwei.anhaengbar.map((x) => x.id)).toEqual(["k1", "k2"]);
    expect(zwei.punkte).toEqual([expect.objectContaining({ art: "zahlung_unklar", sperrt: false })]);
  });
  it("Kosten OHNE Beleg am selben Tag sind keine Dublette, sondern anhängbar", () => {
    const r = pruefeBeleg(e(), { kosten: [k({ buchungsdatum: "2026-03-14" })], eingaenge: [] });
    expect(r.punkte).toEqual([]);
    expect(r.anhaengbar.map((x) => x.id)).toEqual(["k1"]);
  });
  it("nicht anhängbar: Kosten mit Beleg, schon an einem anderen Eingang, an einem anderen Objekt", () => {
    const r = pruefeBeleg(e(), {
      kosten: [k({ id: "mit", rechnung_path: "u/x.pdf", buchungsdatum: "2026-02-20" }), k({ id: "belegt", beleg_eingang_id: "e9" }), k({ id: "anders", prop_id: "p2" })],
      eingaenge: [],
    });
    expect(r.anhaengbar).toEqual([]);
  });
  it("Umlagefähigkeit getrennt: ungeklärt oder abweichend von der Kategorie → Hinweis, sperrt nicht", () => {
    expect(pruefeBeleg(e({ umlagefaehig: "unklar" }), leer).punkte).toEqual([expect.objectContaining({ art: "umlage_pruefen", sperrt: false })]);
    expect(pruefeBeleg(e({ kategorie: "Reparatur", umlagefaehig: "ja" }), leer).punkte[0].text).toMatch(/„Reparatur“ ist üblicherweise nicht umlagefähig, gewählt ist „umlagefähig“/);
    expect(pruefeBeleg(e({ kategorie: "Hausmeister", umlagefaehig: "nein" }), leer).punkte[0].text).toMatch(/üblicherweise umlagefähig/);
  });
  it("Zustand: „in Arbeit“ länger als 5 Minuten = abgebrochen; KI nur bis 3 Versuche", () => {
    const jetzt = Date.parse("2026-03-14T12:00:00Z");
    expect(anzeigeStatus({ status: "in_arbeit", letzter_versuch: "2026-03-14T11:56:00Z" }, jetzt)).toBe("in_arbeit");
    expect(anzeigeStatus({ status: "in_arbeit", letzter_versuch: "2026-03-14T11:54:00Z" }, jetzt)).toBe("abgebrochen");
    expect(kiMoeglich({ status: "fehler", versuche: 2, letzter_versuch: null }, jetzt)).toBe(true);
    expect(kiMoeglich({ status: "fehler", versuche: 3, letzter_versuch: null }, jetzt)).toBe(false);
    expect(kiMoeglich({ status: "vorschlag", versuche: 1, letzter_versuch: null }, jetzt)).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
const eingang = (x: Record<string, unknown> = {}) => ({
  id: "e1", user_id: U, datei_pfad: `${U}/eingang-e1.pdf`, datei_name: "Rechnung.pdf", datei_mime: "application/pdf", datei_groesse: PDF.length,
  datei_hash: HASH, status: "vorschlag", versuche: 1, letzter_versuch: null, fehler: null, kosten_id: null,
  vorschlag: { rechnungsnummer: "RE-42" }, created_at: "2026-03-14T10:00:00Z", ...x,
});

async function lade(init: Partial<SpeicherDbInit> & { tabellen?: SpeicherDbInit["tabellen"] } = {}) {
  vi.resetModules();
  const db = speicherDb({
    ...init,
    tabellen: {
      properties: [{ id: "p1", user_id: U, bezeichnung: "MFH", adresse: "Lindenstraße 1" }, { id: "p-fremd", user_id: "anderer" }],
      kosten: [],
      beleg_eingang: [eingang()],
      ...init.tabellen,
    },
    dateien: init.dateien ?? { belege: { [`${U}/eingang-e1.pdf`]: PDF } },
    eindeutig: { kosten: [["beleg_eingang_id"]] },
    vorgaben: { kosten: () => ({ id: `k-${Math.random().toString(36).slice(2, 8)}` }) },
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/belegEingang");
  return { db, mod, kosten: () => db.tabellen.kosten, eingaenge: () => db.tabellen.beleg_eingang };
}
const buchung = (x: Record<string, unknown> = {}) => ({
  prop_id: "p1", kategorie: "Müll", umlagefaehig: "ja", betrag: "240,50", buchungsdatum: "2026-03-14", beschreibung: "AWB · Nr. RE-42", ...x,
});

describe("Hochladen", () => {
  const datei = (bytes: Uint8Array, name = "Rechnung.pdf") => { const fd = new FormData(); fd.set("datei", new File([new Uint8Array(bytes)], name)); return fd; };

  it("PDF → Datei flach unter <uid>/, Zeile „neu“ mit Prüfsumme; Typ aus dem Dateikopf", async () => {
    const { mod, db, eingaenge } = await lade({ tabellen: { beleg_eingang: [] }, dateien: {} });
    const r = await mod.ladeBelegHoch(datei(PDF, "x.exe"));
    expect(r.ok).toBe(true);
    const z = eingaenge()[0];
    expect(z).toMatchObject({ user_id: U, status: "neu", datei_mime: "application/pdf", datei_hash: HASH, datei_name: "x.exe" });
    expect(z.datei_pfad).toMatch(new RegExp(`^${U}/eingang-[0-9a-f-]{36}\\.pdf$`));
    expect(Object.keys(db.dateien().belege)).toEqual([z.datei_pfad]);
  });
  it("kein PDF/Bild → abgelehnt, nichts gespeichert", async () => {
    const { mod, db, eingaenge } = await lade({ tabellen: { beleg_eingang: [] }, dateien: {} });
    expect(await mod.ladeBelegHoch(datei(new TextEncoder().encode("<script>alert(1)</script>"), "r.pdf"))).toEqual({ ok: false, error: "Nur PDF, JPEG, PNG oder WebP." });
    expect(eingaenge()).toEqual([]);
    expect(db.dateien().belege ?? {}).toEqual({});
  });
  it("Zeile scheitert → die eben hochgeladene Datei wird wieder entfernt", async () => {
    const { mod, db } = await lade({ tabellen: { beleg_eingang: [] }, dateien: {}, fehlerBei: { "beleg_eingang:insert": "kaputt" } });
    const r = await mod.ladeBelegHoch(datei(PDF));
    expect(r.ok).toBe(false);
    expect(db.dateien().belege).toEqual({});
  });
});

describe("Buchen: genau einmal, mit Belegbezug", () => {
  it("neue Kosten mit Beleg, Kostenart und GETRENNTER Umlagefähigkeit; Eingang „gebucht“", async () => {
    const { mod, kosten, eingaenge } = await lade();
    const r = await mod.bucheBeleg("e1", buchung({ kategorie: "Hausmeister", umlagefaehig: "nein" }));
    expect(r).toMatchObject({ ok: true });
    expect(kosten()).toEqual([expect.objectContaining({
      user_id: U, prop_id: "p1", kategorie: "Hausmeister", umlagefaehig: "nein", betrag: 240.5, buchungsdatum: "2026-03-14",
      rechnung_path: `${U}/eingang-e1.pdf`, rechnung_name: "Rechnung.pdf", rechnung_type: "application/pdf", beleg_eingang_id: "e1",
    })]);
    expect(eingaenge()[0]).toMatchObject({ status: "gebucht", kosten_id: kosten()[0].id });
  });

  it("zweimal tippen → beim zweiten Mal „schon gebucht“, keine zweite Buchung", async () => {
    const { mod, kosten } = await lade();
    await mod.bucheBeleg("e1", buchung());
    expect(await mod.bucheBeleg("e1", buchung())).toMatchObject({ ok: true, schonGebucht: true });
    expect(kosten()).toHaveLength(1);
  });

  it("GLEICHZEITIG in zwei Tabs → eine Buchung", async () => {
    const { mod, kosten, eingaenge } = await lade();
    const [a, b] = await Promise.all([mod.bucheBeleg("e1", buchung()), mod.bucheBeleg("e1", buchung())]);
    expect([a.ok, b.ok]).toEqual([true, true]);
    expect(kosten()).toHaveLength(1);
    expect(eingaenge()[0].status).toBe("gebucht");
  });

  it("Abbruch nach der Buchung, vor dem Zustand → Wiederholung holt nur den Zustand nach", async () => {
    vi.resetModules();
    let erstes = true;
    const db = speicherDb({
      tabellen: { properties: [{ id: "p1", user_id: U }], kosten: [], beleg_eingang: [eingang()] },
      dateien: { belege: { [`${U}/eingang-e1.pdf`]: PDF } },
      eindeutig: { kosten: [["beleg_eingang_id"]] },
      vorgaben: { kosten: () => ({ id: "k-1" }) },
      fehlerWenn: (t, op) => (t === "beleg_eingang" && op === "update" && erstes ? ((erstes = false), "Zeitüberschreitung") : null),
    });
    mockeNextUndSupabase(db.client);
    const mod = await import("@/lib/actions/belegEingang");
    const r1 = await mod.bucheBeleg("e1", buchung());
    expect(r1.ok).toBe(false);
    expect(r1.ok === false && r1.error).toMatch(/es entsteht keine zweite Buchung/);
    expect(db.tabellen.kosten).toHaveLength(1);
    expect(await mod.bucheBeleg("e1", buchung())).toMatchObject({ ok: true, kosten_id: "k-1", schonGebucht: true });
    expect(db.tabellen.kosten).toHaveLength(1);
    expect(db.tabellen.beleg_eingang[0]).toMatchObject({ status: "gebucht", kosten_id: "k-1" });
  });

  it("an vorhandene Kosten ohne Beleg hängen: keine neue Buchung, Beleg und Umlage an der vorhandenen", async () => {
    const vorhanden = { id: "k-grund", user_id: U, prop_id: "p1", buchungsdatum: "2026-02-15", betrag: 240.5, kategorie: "Müll", rechnung_path: null, beleg_eingang_id: null };
    const { mod, kosten, eingaenge } = await lade({ tabellen: { kosten: [vorhanden] } });
    const r = await mod.bucheBeleg("e1", buchung({ anhaengen_an: "k-grund" }));
    expect(r).toEqual({ ok: true, kosten_id: "k-grund", angehaengt: true });
    expect(kosten()).toEqual([expect.objectContaining({ id: "k-grund", rechnung_path: `${U}/eingang-e1.pdf`, beleg_eingang_id: "e1", umlagefaehig: "ja" })]);
    expect(eingaenge()[0]).toMatchObject({ status: "gebucht", kosten_id: "k-grund" });
  });

  it("Wettlauf: zwischen Prüfen und Anhängen bekommt die Buchung woanders einen Beleg → nichts überschrieben", async () => {
    vi.resetModules();
    const vorhanden = { id: "k-grund", user_id: U, prop_id: "p1", buchungsdatum: "2026-02-15", betrag: 240.5, kategorie: "Müll", rechnung_path: null as string | null, beleg_eingang_id: null };
    let einmal = true;
    const db = speicherDb({
      tabellen: { properties: [{ id: "p1", user_id: U }], kosten: [vorhanden], beleg_eingang: [eingang()] },
      eindeutig: { kosten: [["beleg_eingang_id"]] },
      fehlerWenn: (t, op) => { if (t === "kosten" && op === "update" && einmal) { einmal = false; vorhanden.rechnung_path = "u/andere-sitzung.pdf"; } return null; },
    });
    mockeNextUndSupabase(db.client);
    const mod = await import("@/lib/actions/belegEingang");
    const r = await mod.bucheBeleg("e1", buchung({ anhaengen_an: "k-grund" }));
    expect(r).toEqual({ ok: false, error: "Die Buchung hat inzwischen einen Beleg — bitte die Liste neu laden." });
    expect(db.tabellen.kosten[0]).toMatchObject({ rechnung_path: "u/andere-sitzung.pdf", beleg_eingang_id: null });
    expect(db.tabellen.beleg_eingang[0].status).toBe("vorschlag");
  });

  it("Anhängen bricht nach dem Anhängen ab → Wiederholung schließt ab, statt „passt nicht mehr“", async () => {
    vi.resetModules();
    const vorhanden = { id: "k-grund", user_id: U, prop_id: "p1", buchungsdatum: "2026-02-15", betrag: 240.5, kategorie: "Müll", rechnung_path: null, beleg_eingang_id: null };
    let erstes = true;
    const db = speicherDb({
      tabellen: { properties: [{ id: "p1", user_id: U }], kosten: [vorhanden], beleg_eingang: [eingang()] },
      eindeutig: { kosten: [["beleg_eingang_id"]] },
      fehlerWenn: (t, op) => (t === "beleg_eingang" && op === "update" && erstes ? ((erstes = false), "Zeitüberschreitung") : null),
    });
    mockeNextUndSupabase(db.client);
    const mod = await import("@/lib/actions/belegEingang");
    expect((await mod.bucheBeleg("e1", buchung({ anhaengen_an: "k-grund" }))).ok).toBe(false);
    expect(await mod.bucheBeleg("e1", buchung({ anhaengen_an: "k-grund" }))).toMatchObject({ ok: true, kosten_id: "k-grund" });
    expect(db.tabellen.beleg_eingang[0]).toMatchObject({ status: "gebucht", kosten_id: "k-grund" });
    expect(db.tabellen.kosten).toHaveLength(1);
  });

  it("gebuchter Beleg, dessen Buchung inzwischen gelöscht ist → nicht still neu gebucht", async () => {
    const { mod, kosten } = await lade({ tabellen: { beleg_eingang: [eingang({ status: "gebucht", kosten_id: "k-geloescht" })] } });
    expect(await mod.bucheBeleg("e1", buchung())).toEqual({ ok: true, kosten_id: "k-geloescht", schonGebucht: true });
    expect(kosten()).toEqual([]);
  });

  it("anhängen nur an PASSENDE Kosten: anderer Betrag oder schon mit Beleg → abgelehnt, nichts geändert", async () => {
    const passtNicht = { id: "k-x", user_id: U, prop_id: "p1", buchungsdatum: "2026-03-01", betrag: 99, kategorie: "Müll", rechnung_path: null, beleg_eingang_id: null };
    const mitBeleg = { id: "k-y", user_id: U, prop_id: "p1", buchungsdatum: "2026-03-01", betrag: 240.5, kategorie: "Müll", rechnung_path: "u/alt.pdf", beleg_eingang_id: null };
    const { mod, kosten } = await lade({ tabellen: { kosten: [passtNicht, mitBeleg] } });
    expect((await mod.bucheBeleg("e1", buchung({ anhaengen_an: "k-x" }))).ok).toBe(false);
    const r = await mod.bucheBeleg("e1", buchung({ anhaengen_an: "k-y", dublette_ok: true }));
    expect(r.ok).toBe(false);
    expect(kosten().map((k) => k.rechnung_path)).toEqual([null, "u/alt.pdf"]);
  });

  it("mögliche Dublette (Buchung mit Beleg, gleicher Betrag, 2 Tage Abstand) → erst nach Bestätigung", async () => {
    const doppelt = { id: "k-d", user_id: U, prop_id: "p1", buchungsdatum: "2026-03-12", betrag: 240.5, kategorie: "Müll", rechnung_path: "u/x.pdf", beleg_eingang_id: null };
    const { mod, kosten } = await lade({ tabellen: { kosten: [doppelt] } });
    const r = await mod.bucheBeleg("e1", buchung());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.punkte?.map((p) => p.art)).toEqual(["dublette_buchung"]);
    expect(kosten()).toHaveLength(1);
    expect((await mod.bucheBeleg("e1", buchung({ dublette_ok: true }))).ok).toBe(true);
    expect(kosten()).toHaveLength(2);
  });

  it("dieselbe Datei als zweiter Eingang → Dublette; gleiche Rechnungsnummer im Vorschlag → Dublette", async () => {
    const { mod } = await lade({ tabellen: { beleg_eingang: [eingang(), eingang({ id: "e0", status: "gebucht", kosten_id: "k-0", datei_pfad: "u/e0.pdf" })] } });
    expect(await mod.bucheBeleg("e1", buchung())).toMatchObject({ ok: false, punkte: [expect.objectContaining({ art: "dublette_datei" })] });
  });

  it("Prüfliste sperrt: unbekannte Kostenart, kein Objekt, keine Umlage-Entscheidung, fremdes Objekt", async () => {
    const { mod, kosten } = await lade();
    expect((await mod.bucheBeleg("e1", buchung({ kategorie: "Gartenzwerge" }))).ok).toBe(false);
    expect((await mod.bucheBeleg("e1", buchung({ prop_id: null }))).ok).toBe(false);
    expect((await mod.bucheBeleg("e1", buchung({ umlagefaehig: "" }))).ok).toBe(false);
    expect(await mod.bucheBeleg("e1", buchung({ prop_id: "p-fremd" }))).toEqual({ ok: false, error: "Objekt nicht gefunden." });
    expect(await mod.bucheBeleg("e1", buchung({ betrag: "0" }))).toMatchObject({ ok: false, error: "Betrag fehlt." });
    expect(kosten()).toEqual([]);
    // ausdrücklich ohne Objekt geht
    expect((await mod.bucheBeleg("e1", buchung({ prop_id: null, ohne_objekt: true, kategorie: "Verwaltung", umlagefaehig: "nein" }))).ok).toBe(true);
    expect(kosten()[0]).toMatchObject({ prop_id: null, kategorie: "Verwaltung" });
  });

  it("Dublettenprüfung scheitert (Abfragefehler) → nichts gebucht (fail-closed)", async () => {
    const { mod, kosten } = await lade({ fehlerAbSeite: { kosten: 0 } });
    const r = await mod.bucheBeleg("e1", buchung());
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/nichts gebucht/) });
    expect(kosten()).toEqual([]);
  });

  it("Berechtigung: fremder Eingang ist „nicht gefunden“", async () => {
    const { mod, kosten } = await lade({ tabellen: { beleg_eingang: [eingang({ user_id: "anderer" })] } });
    expect(await mod.bucheBeleg("e1", buchung())).toEqual({ ok: false, error: "Beleg nicht gefunden." });
    expect(kosten()).toEqual([]);
  });
});

describe("Verwerfen", () => {
  it("offener Beleg: Zeile und Datei weg", async () => {
    const { mod, db, eingaenge } = await lade();
    expect(await mod.verwirfBeleg("e1")).toEqual({ ok: true });
    expect(eingaenge()).toEqual([]);
    expect(db.dateien().belege).toEqual({});
  });
  it("gebuchter Beleg: bleibt, Datei bleibt (sie gehört zur Buchung)", async () => {
    const { mod, db, eingaenge } = await lade({ tabellen: { beleg_eingang: [eingang({ status: "gebucht", kosten_id: "k-1" })] } });
    expect((await mod.verwirfBeleg("e1")).ok).toBe(false);
    expect(eingaenge()).toHaveLength(1);
    expect(Object.keys(db.dateien().belege)).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------------------------
describe("KI-Vorschlag als dauerhafter Auftrag (Route /api/beleg-vorschlag, Adapter statt KI)", () => {
  const beanspruchen = (args: Record<string, unknown>, t: Record<string, Record<string, unknown>[]>, uid: string | null) => {
    const r = t.beleg_eingang.find((x) => x.id === args.p_id && x.user_id === uid);
    const frei = r && (r.versuche as number) < 3 && (r.status === "neu" || r.status === "fehler" ||
      (r.status === "in_arbeit" && Date.parse(r.letzter_versuch as string) < Date.now() - 5 * 60_000));
    if (!r || !frei) return { data: [], error: null };
    Object.assign(r, { status: "in_arbeit", versuche: (r.versuche as number) + 1, letzter_versuch: new Date().toISOString(), fehler: null });
    return { data: [{ ...r }], error: null };
  };
  const KI_ANTWORT = JSON.stringify({ content: [{ text: JSON.stringify({ datum: "2026-03-14", betrag: 240.5, kostenart: "Müll", umlagefaehig: "ja", objekt: "Lindenstraße 1" }) }] });

  async function route(o: { ki?: () => Promise<Response>; bereit?: boolean; bremse?: boolean; eintrag?: Record<string, unknown> } = {}) {
    vi.resetModules();
    const db = speicherDb({
      tabellen: {
        properties: [{ id: "p1", user_id: U, bezeichnung: "MFH", adresse: "Lindenstraße 1, Köln" }],
        kosten: [],
        beleg_eingang: [eingang({ id: E1, status: "neu", versuche: 0, vorschlag: null, ...o.eintrag })],
      },
      dateien: { belege: { [`${U}/eingang-e1.pdf`]: PDF } },
      rpc: { beleg_eingang_beanspruchen: beanspruchen },
    });
    mockeNextUndSupabase(db.client);
    const ki = vi.fn(o.ki ?? (async (..._args: unknown[]) => new Response(KI_ANTWORT, { status: 200 })));
    vi.doMock("@/lib/aiRoute", async (orig) => ({ ...(await orig<typeof import("@/lib/aiRoute")>()), callAnthropic: ki, kiBereit: () => o.bereit ?? true }));
    vi.doMock("@/lib/net/bremse", () => ({ darfWeiter: async () => o.bremse ?? true }));
    const { POST } = await import("@/app/api/beleg-vorschlag/route");
    const aufruf = () => POST(new Request("http://x/api/beleg-vorschlag", { method: "POST", body: JSON.stringify({ id: E1 }) }));
    return { db, ki, aufruf, e: () => db.tabellen.beleg_eingang[0] };
  }

  it("Erfolg → Vorschlag gespeichert (mit Objekt), Zustand „vorschlag“ — und KEINE Buchung", async () => {
    const { aufruf, e, db, ki } = await route();
    const r = await aufruf();
    expect(r.status).toBe(200);
    expect(e()).toMatchObject({ status: "vorschlag", versuche: 1, fehler: null, vorschlag: expect.objectContaining({ betrag: 240.5, kategorie: "Müll", umlage: "ja", prop_id: "p1" }) });
    expect(db.tabellen.kosten).toEqual([]);
    expect(ki).toHaveBeenCalledTimes(1);
    const block = ((ki.mock.calls[0] as unknown[])[1] as { messages: { content: { type: string; source?: { media_type: string } }[] }[] }).messages[0].content[0];
    expect(block).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
  });

  it("zweiter Aufruf (Doppelklick) → 409, die KI wird nicht noch einmal bezahlt", async () => {
    const { aufruf, ki } = await route();
    await aufruf();
    expect((await aufruf()).status).toBe(409);
    expect(ki).toHaveBeenCalledTimes(1);
  });

  it("gleichzeitig zweimal → genau ein KI-Aufruf", async () => {
    const { aufruf, ki } = await route();
    const [a, b] = await Promise.all([aufruf(), aufruf()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(ki).toHaveBeenCalledTimes(1);
  });

  it("KI-Fehler → Zustand „fehler“ mit Grund; Wiederholung möglich, nach drei Versuchen nicht mehr", async () => {
    const { aufruf, e, ki } = await route({ ki: async () => new Response("kaputt", { status: 529 }) });
    expect((await aufruf()).status).toBe(502);
    expect(e()).toMatchObject({ status: "fehler", fehler: "KI-Dienst antwortete mit 529.", versuche: 1 });
    await aufruf(); await aufruf();
    expect(e().versuche).toBe(3);
    expect((await aufruf()).status).toBe(409);
    expect(ki).toHaveBeenCalledTimes(3);
  });

  it("unlesbare Antwort → „fehler“, Felder bleiben leer (nichts geraten)", async () => {
    const { aufruf, e } = await route({ ki: async () => new Response(JSON.stringify({ content: [{ text: "Ich glaube 240 €" }] }), { status: 200 }) });
    expect((await aufruf()).status).toBe(422);
    expect(e()).toMatchObject({ status: "fehler", vorschlag: null });
  });

  it("Zeitüberschreitung → „fehler“ mit Grund", async () => {
    const { aufruf, e } = await route({ ki: async () => { const f = new Error("abgebrochen"); f.name = "AbortError"; throw f; } });
    expect((await aufruf()).status).toBe(504);
    expect(e()).toMatchObject({ status: "fehler", fehler: "Zeitüberschreitung beim KI-Dienst." });
  });

  it("abgebrochener Lauf (seit 6 min „in Arbeit“) ist wieder frei", async () => {
    const { aufruf, e } = await route({ eintrag: { status: "in_arbeit", versuche: 1, letzter_versuch: new Date(Date.now() - 6 * 60_000).toISOString() } });
    expect((await aufruf()).status).toBe(200);
    expect(e()).toMatchObject({ status: "vorschlag", versuche: 2 });
  });

  it("inzwischen von Hand gebucht → der Vorschlag überschreibt nichts", async () => {
    const { aufruf, e, db } = await route({
      ki: async () => { db.tabellen.beleg_eingang[0].status = "gebucht"; db.tabellen.beleg_eingang[0].kosten_id = "k-9"; return new Response(KI_ANTWORT, { status: 200 }); },
    });
    const r = await aufruf();
    expect(await r.json()).toEqual({ ok: true, ueberholt: true });
    expect(e()).toMatchObject({ status: "gebucht", kosten_id: "k-9", vorschlag: null });
  });

  it("keine gültige Kennung → 400 ohne Beanspruchung", async () => {
    const { ki, e } = await route();
    const { POST } = await import("@/app/api/beleg-vorschlag/route");
    expect((await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ id: "e1' or 1=1" }) }))).status).toBe(400);
    expect(ki).not.toHaveBeenCalled();
    expect(e().versuche).toBe(0);
  });

  it("kein KI-Anbieter → 503 ohne Beanspruchung (der Beleg bleibt „neu“, von Hand ausfüllbar)", async () => {
    const { aufruf, e, ki } = await route({ bereit: false });
    expect((await aufruf()).status).toBe(503);
    expect(e()).toMatchObject({ status: "neu", versuche: 0 });
    expect(ki).not.toHaveBeenCalled();
  });

  it("Bremse greift → 429 ohne KI-Aufruf", async () => {
    const { aufruf, ki, e } = await route({ bremse: false });
    expect((await aufruf()).status).toBe(429);
    expect(ki).not.toHaveBeenCalled();
    expect(e().versuche).toBe(0);
  });

  it("Bild über 5 MB → „fehler“ ohne KI-Aufruf", async () => {
    const { aufruf, ki, e } = await route({ eintrag: { datei_mime: "image/jpeg", datei_groesse: 6 * 1024 * 1024 } });
    expect((await aufruf()).status).toBe(413);
    expect(ki).not.toHaveBeenCalled();
    expect(e()).toMatchObject({ status: "fehler" });
  });
});

// ------------------------------------------------------------------------------------------------
describe("NK nehmen die je Buchung bestätigte Umlagefähigkeit — nicht nur die Kategorie", () => {
  const k = (kategorie: string, betrag: number, umlagefaehig?: string | null) => ({ prop_id: "p1", buchungsdatum: "2026-05-01", kategorie, betrag, umlagefaehig });
  it("„nein“ schließt eine Hausmeister-Rechnung aus, „ja“ nimmt Sonstiges auf, „unklar“ wird genannt", () => {
    const r = nkAusBuchungen([k("Hausmeister", 500, "nein"), k("Hausmeister", 300), k("Sonstiges", 80, "ja"), k("Müll", 120, "unklar")], "p1", 2026);
    expect(r.vorschlaege.map((v) => [v.bezeichnung, v.betrag])).toEqual([["Hausmeister", 300], ["Sonstiges", 80]]);
    expect(r.unklar).toEqual([{ kategorie: "Müll", betrag: 120 }]);
  });
});
