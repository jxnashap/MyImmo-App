import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mockeNextUndSupabase, fangeRedirect, fd } from "./stubs/actionHarness";
import { speicherDb, type SpeicherDbInit } from "./stubs/speicherDb";
import {
  archivTitelPraefix, erledigtAus, fristArchivAb, fristSeit, fristVermerk, fristVorgang, istZustellweg, vermerkeAus,
  vorgangText, ZUSTELLWEGE, type ArchivDok, type FristDokument, type FristVermerk, type FristVorgang, type PortalZustellung,
} from "@/lib/fristDokument";
import { FRIST_QUELLEN, quelleZu } from "@/lib/fristQuellen";
import { fristSchluessel } from "@/lib/termine";
import { fristZiel } from "@/lib/heute";
import { mieterFristen, kreditFristen, objektFristen, globaleFristen, type Frist } from "@/lib/fristen";
import { nkTitel } from "@/lib/zustellung";

// Ablauf D (Prüfstand 11.10.2026, Phase 5): Kalender, Mieterakte, Portal und Dokumente verbinden.
//
// Vorher-Zustand (belegt am Code vor diesem Paket):
//   · Eine Frist zur Wohnungsgeberbestätigung oder Mieterhöhung führte nur auf die Mieterseite, nicht in den
//     Brief-Generator; man suchte Mieter und Schreiben selbst.
//   · Die Frist „NK-Abrechnung zustellen“ ENTFIEL, sobald ein PDF im Archiv lag — ein PDF galt als erledigt.
//   · Eine abgeleitete Frist ließ sich nur ausblenden, nicht als erledigt vermerken; „fällig“ und „erledigt“
//     waren ununterscheidbar.
//   · Der Schlüssel einer Frist kannte den Mieter nicht: „NK-Abrechnung 2025 zustellen“ (31.12.) bei EINEM
//     Mieter ausgeblendet → bei ALLEN weg.
//   · Der Kalender-Export vergab UIDs nach Listenposition — eine neue Frist verschob die Kennungen, und der
//     importierende Kalender überschrieb einen Termin mit einem fremden.
//   · Die Rechtsgrundlagen standen als Text ohne Fundstelle und Prüfdatum da.

const U = "nutzer-1";
const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const N1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.useRealTimers();
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

// ------------------------------------------------------------------------------------------------
describe("Stand des Schreibens zu einer Frist — fällig ist nicht erledigt", () => {
  const wg: FristDokument = { art: "wohnungsgeber" };
  const frist = "2026-10-15";
  const dok = (x: Partial<ArchivDok> = {}): ArchivDok => ({
    id: N1, mieter_id: M1, titel: `${archivTitelPraefix(wg)} – Anna Weber`, created_at: "2026-10-05T09:00:00Z", ...x,
  });
  const zu = (x: Partial<PortalZustellung> = {}): PortalZustellung => ({
    notiz_id: N1, zugestellt_am: "2026-10-06T08:00:00Z", gelesen_am: null, zurueckgezogen_am: null, ...x,
  });

  it("ohne Schreiben: offen", () => {
    expect(fristVorgang(wg, M1, frist, [], [])).toEqual({ stand: "offen" });
  });
  it("Schreiben an einen ANDEREN Mieter, mit anderem Titel oder vor dem Fenster zählt nicht", () => {
    expect(fristVorgang(wg, M1, frist, [dok({ mieter_id: M2 })], []).stand).toBe("offen");
    expect(fristVorgang(wg, M1, frist, [dok({ titel: "Mahnung – Anna Weber" })], []).stand).toBe("offen");
    expect(fristSeit(wg, frist)).toBe("2026-07-15");
    expect(fristVorgang(wg, M1, frist, [dok({ created_at: "2026-07-14T23:00:00Z" })], []).stand).toBe("offen");
    expect(fristVorgang(wg, M1, frist, [dok({ created_at: "2026-07-15T08:00:00Z" })], []).stand).toBe("entwurf");
  });
  it("PDF im Archiv → Entwurf; im Portal → bereitgestellt; abgerufen → abgerufen; zurückgezogen zählt nicht", () => {
    expect(fristVorgang(wg, M1, frist, [dok()], [])).toEqual({ stand: "entwurf", notizId: N1, am: "2026-10-05" });
    expect(fristVorgang(wg, M1, frist, [dok()], [zu()])).toEqual({ stand: "bereitgestellt", notizId: N1, am: "2026-10-06" });
    expect(fristVorgang(wg, M1, frist, [dok()], [zu({ gelesen_am: "2026-10-07T18:00:00Z" })])).toEqual({ stand: "abgerufen", notizId: N1, am: "2026-10-07" });
    expect(fristVorgang(wg, M1, frist, [dok()], [zu({ zurueckgezogen_am: "2026-10-06T09:00:00Z", gelesen_am: "2026-10-07T00:00:00Z" })]).stand).toBe("entwurf");
  });
  it("mehrere Fassungen: das weiteste Stadium, auch wenn die neueste noch Entwurf ist", () => {
    const neu = dok({ id: "n-neu", created_at: "2026-10-09T09:00:00Z" });
    expect(fristVorgang(wg, M1, frist, [neu, dok()], [zu()])).toMatchObject({ stand: "bereitgestellt", notizId: N1 });
  });
  it("der Erledigt-Vermerk des Vermieters schlägt alles — auch ohne Schreiben im Archiv", () => {
    expect(fristVorgang(wg, M1, frist, [], [], { erledigt_am: "2026-10-08", zustellweg: "persoenlich", notiz_id: null }))
      .toEqual({ stand: "erledigt", am: "2026-10-08", zustellweg: "persoenlich", notizId: null });
  });
  it("NK: zählt jede Abrechnung DIESES Jahres, auch wenn sie Monate vor dem 31.12. entstand", () => {
    const nk: FristDokument = { art: "nk", jahr: 2025 };
    expect(archivTitelPraefix(nk)).toBe(nkTitel(2025)); // derselbe Titel, den das Archiv schreibt
    const abr = (jahr: number, am: string): ArchivDok => ({ id: `nk${jahr}`, mieter_id: M1, titel: nkTitel(jahr), created_at: am });
    expect(fristVorgang(nk, M1, "2026-12-31", [abr(2025, "2026-02-01T09:00:00Z")], []).stand).toBe("entwurf");
    expect(fristVorgang(nk, M1, "2026-12-31", [abr(2024, "2025-03-01T09:00:00Z")], []).stand).toBe("offen");
  });
  it("der Text sagt nie „zugestellt“ oder „zugegangen“, solange der Vermieter es nicht bestätigt hat", () => {
    const staende: FristVorgang[] = [
      { stand: "offen" },
      { stand: "entwurf", notizId: N1, am: "2026-10-05" },
      { stand: "bereitgestellt", notizId: N1, am: "2026-10-06" },
      { stand: "abgerufen", notizId: N1, am: "2026-10-07" },
    ];
    for (const v of staende) expect(vorgangText(v), v.stand).not.toMatch(/zugestellt|zugegangen|erledigt/i);
    expect(vorgangText(staende[1])).toContain("Zugang nicht bestätigt");
    expect(vorgangText({ stand: "erledigt", am: "2026-10-08", zustellweg: "einwurf_einschreiben", notizId: null })).toBe("erledigt am 08.10.2026 · Einwurf-Einschreiben");
  });
  it("Archiv-Fenster: 400 Tage vor heute, nach Kalendertagen", () => {
    expect(fristArchivAb("2026-10-11")).toBe("2025-09-06");
  });
});

// ------------------------------------------------------------------------------------------------
describe("Schlüssel je Mieter: ein Vermerk gilt nur für DIESEN Vorgang", () => {
  const nkLabel = "NK-Abrechnung 2025 zustellen";
  const v = (schluessel: string, x: Partial<FristVermerk> = {}): FristVermerk =>
    ({ schluessel, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "post", notiz_id: null, ...x });

  it("zwei Mieter mit derselben NK-Frist haben verschiedene Schlüssel", () => {
    expect(fristSchluessel("mieter", "2026-12-31", nkLabel, M1)).not.toBe(fristSchluessel("mieter", "2026-12-31", nkLabel, M2));
    expect(fristSchluessel("steuer", "2027-02-15", "Grundsteuer")).toBe("steuer|2027-02-15|Grundsteuer");
  });
  it("erledigt bei Mieter 1 lässt Mieter 2 offen", () => {
    const m = vermerkeAus([v(fristSchluessel("mieter", "2026-12-31", nkLabel, M1))]);
    expect(erledigtAus(fristVermerk(m, "mieter", M1, "2026-12-31", nkLabel))).toMatchObject({ erledigt_am: "2026-10-08" });
    expect(fristVermerk(m, "mieter", M2, "2026-12-31", nkLabel)).toBeNull();
  });
  it("Altbestand (Schlüssel ohne Mieter) blendet weiter aus — zählt aber nie als erledigt", () => {
    const m = vermerkeAus([v(fristSchluessel("mieter", "2026-12-31", nkLabel))]);
    const r = fristVermerk(m, "mieter", M2, "2026-12-31", nkLabel);
    expect(r).toMatchObject({ grund: "ausgeblendet" });
    expect(erledigtAus(r)).toBeNull();
  });
  it("Fristen ohne Bezug (Steuer): neuer = alter Schlüssel, erledigt zählt", () => {
    const m = vermerkeAus([v(fristSchluessel("steuer", "2027-08-02", "Einkommensteuererklärung 2026"))]);
    expect(erledigtAus(fristVermerk(m, "steuer", null, "2027-08-02", "Einkommensteuererklärung 2026"))).not.toBeNull();
  });
  it("erledigt nur mit Grund, Datum UND Zustellweg", () => {
    expect(erledigtAus(v("x", { grund: "ausgeblendet" }))).toBeNull();
    expect(erledigtAus(v("x", { erledigt_am: null }))).toBeNull();
    expect(erledigtAus(v("x", { zustellweg: null }))).toBeNull();
    expect(erledigtAus(null)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
describe("Frist → Schreiben: Mieter und Art vorgewählt", () => {
  it("Wohnungsgeber und Mieterhöhung öffnen den Generator, NK die Abrechnung des Jahres", () => {
    expect(fristZiel("mieter", M1, "Wohnungsgeberbestätigung ausstellen", { art: "wohnungsgeber" })).toBe(`/tenants/${M1}/dokument?art=wohnungsgeber`);
    expect(fristZiel("mieter", M1, "Nächste Mieterhöhung möglich", { art: "mieterhoehung" })).toBe(`/tenants/${M1}/dokument?art=mieterhoehung`);
    expect(fristZiel("mieter", M1, "NK-Abrechnung 2025 zustellen", { art: "nk", jahr: 2025 })).toBe(`/tenants/${M1}/nk?jahr=2025`);
    expect(fristZiel("mieter", M1, "Mietende")).toBe(`/tenants/${M1}`);
  });
  it("mieterFristen hängt das Schreiben an genau diese drei Fristen", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-11T10:00:00Z") });
    const neu = mieterFristen({ mietbeginn: "2026-10-01", mietende: null, kuendigung: 3, letzte_erhoehung: null });
    expect(neu.find((f) => f.label === "Wohnungsgeberbestätigung ausstellen")?.dokument).toEqual({ art: "wohnungsgeber" });
    const alt = mieterFristen({ mietbeginn: "2020-01-01", mietende: "2027-06-30", kuendigung: 3, letzte_erhoehung: "2025-08-01", mietart: "Standard" });
    expect(alt.find((f) => f.label === "Nächste Mieterhöhung möglich")?.dokument).toEqual({ art: "mieterhoehung" });
    expect(alt.find((f) => f.label === "NK-Abrechnung 2025 zustellen")?.dokument).toEqual({ art: "nk", jahr: 2025 });
    expect(alt.filter((f) => f.dokument).map((f) => f.label).sort()).toEqual(["NK-Abrechnung 2025 zustellen", "Nächste Mieterhöhung möglich"]);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Rechtsgrundlagen: amtliche Fundstelle, Wortlaut, Prüfdatum", () => {
  function alleFristen(): Frist[] {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-11T10:00:00Z") });
    const m = [
      mieterFristen({ mietbeginn: "2026-10-01", mietende: null, kuendigung: 3, letzte_erhoehung: null }),
      mieterFristen({ mietbeginn: "2020-01-01", mietende: "2027-06-30", kuendigung: 3, letzte_erhoehung: "2025-08-01", mietart: "Standard" }),
      mieterFristen({ mietbeginn: "2023-01-01", mietende: null, kuendigung: 3, letzte_erhoehung: null, mietart: "Standard" }),
      mieterFristen({ mietbeginn: "2022-01-01", mietende: null, kuendigung: 3, letzte_erhoehung: null, mietart: "Staffel", staffel_datum: "2027-01-01" }),
      mieterFristen({ mietbeginn: "2022-01-01", mietende: null, kuendigung: 3, letzte_erhoehung: "2025-01-01", mietart: "Index" }),
    ].flat();
    const k = [
      kreditFristen({ zinsbindung: "2031-03-31", auszahlung_datum: "2024-03-01" }), // Bindung endet vor 10 Jahren → Nr. 1
      kreditFristen({ zinsbindung: "2040-03-31", auszahlung_datum: "2021-03-01" }),
    ].flat();
    return [...m, ...k, ...objektFristen({ energieausweis_datum: "2018-05-01" }), ...globaleFristen()];
  }

  it("jede Rechtsgrundlage, die eine Frist nennt, hat einen Eintrag — außer ausdrücklichen Empfehlungen", () => {
    const fristen = alleFristen();
    const normen = new Set(fristen.map((f) => f.rechtsgrundlage).filter((r): r is string => !!r && !r.startsWith("Empfehlung:")));
    expect(normen.size).toBeGreaterThanOrEqual(10); // der Wächter hat hingesehen
    for (const r of normen) expect(quelleZu(r), r).not.toBeNull();
  });
  it("jeder Eintrag wird von mindestens einer Frist benutzt (keine Leiche, die geprüft aussieht)", () => {
    const fristen = alleFristen();
    for (const q of FRIST_QUELLEN) {
      expect(fristen.some((f) => quelleZu(f.rechtsgrundlage)?.norm === q.norm), q.norm).toBe(true);
    }
  });
  it("Fundstelle beim BMJ, Wortlaut vorhanden, Prüfdatum gesetzt", () => {
    for (const q of FRIST_QUELLEN) {
      expect(q.url, q.norm).toMatch(/^https:\/\/www\.gesetze-im-internet\.de\/[a-z0-9_]+\/__\d+[a-z]?\.html$/);
      expect(q.wortlaut.length, q.norm).toBeGreaterThan(30);
      expect(q.geprueft, q.norm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("längster Treffer gewinnt: „§ 558 Abs. 1 BGB“ nicht als „§ 558 BGB“", () => {
    expect(quelleZu("§ 558 Abs. 1 BGB (Jahressperrfrist)")?.norm).toBe("§ 558 Abs. 1 BGB");
    expect(quelleZu("§ 558 BGB")?.norm).toBe("§ 558 BGB");
    expect(quelleZu(undefined)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
const SCHL = fristSchluessel("mieter", "2026-12-31", "NK-Abrechnung 2025 zustellen", M1);
async function ladeAction(init: Partial<SpeicherDbInit> = {}) {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-11T10:00:00Z") });
  const db = speicherDb({
    nutzer: { id: U },
    ...init,
    tabellen: { frist_ausgeblendet: [], ...init.tabellen },
    eindeutig: { frist_ausgeblendet: [["user_id", "schluessel"]] },
  });
  const spuren = mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/termine");
  return { db, spuren, mod, zeilen: () => db.tabellen.frist_ausgeblendet };
}
const gut = { erledigt_am: "2026-10-08", zustellweg: "einwurf_einschreiben", notiz_id: N1, zurueck: "/termine?quelle=auto" };

describe("„Zugang bestätigen“: erledigt erst mit Datum und Weg", () => {
  it("vermerkt genau einmal — ein zweiter Klick (Zeitüberlauf, Doppelklick) ändert nichts", async () => {
    const { mod, zeilen, spuren } = await ladeAction();
    const ziel = await fangeRedirect(() => mod.erledigeFrist(SCHL, fd(gut)));
    expect(ziel).toMatch(/^\/termine\?quelle=auto&flash=/);
    expect(ziel).not.toContain("flashTyp=error");
    await fangeRedirect(() => mod.erledigeFrist(SCHL, fd(gut)));
    expect(zeilen()).toHaveLength(1);
    expect(zeilen()[0]).toMatchObject({ user_id: U, schluessel: SCHL, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "einwurf_einschreiben", notiz_id: N1 });
    expect(spuren.revalidiert).toEqual(expect.arrayContaining(["/termine", "/"]));
  });
  it("eine ausgeblendete Frist wird erledigt (dieselbe Zeile, kein zweiter Eintrag)", async () => {
    const { mod, zeilen } = await ladeAction({ tabellen: { frist_ausgeblendet: [{ id: "f1", user_id: U, schluessel: SCHL, grund: "ausgeblendet", erledigt_am: null, zustellweg: null, notiz_id: null }] } });
    await fangeRedirect(() => mod.erledigeFrist(SCHL, fd({ ...gut, notiz_id: undefined })));
    expect(zeilen()).toHaveLength(1);
    expect(zeilen()[0]).toMatchObject({ id: "f1", grund: "erledigt", notiz_id: null });
  });
  it.each([
    ["ohne Datum", { erledigt_am: "" }],
    ["unmögliches Datum", { erledigt_am: "2026-02-30" }],
    ["Datum in der Zukunft", { erledigt_am: "2026-10-12" }],
    ["uraltes Datum", { erledigt_am: "1999-12-31" }],
    ["ohne Zustellweg", { zustellweg: "" }],
    ["erfundener Zustellweg", { zustellweg: "brieftaube" }],
    ["Schreiben-ID kein UUID", { notiz_id: "1 or 1=1" }],
  ])("lehnt ab: %s — nichts gespeichert, Meldung als Fehler", async (_n, patch) => {
    const { mod, zeilen } = await ladeAction();
    const ziel = await fangeRedirect(() => mod.erledigeFrist(SCHL, fd({ ...gut, ...patch })));
    expect(ziel).toContain("flashTyp=error");
    expect(decodeURIComponent(ziel)).toContain("es wurde nichts vermerkt");
    expect(zeilen()).toHaveLength(0);
  });
  it("lehnt ab: leerer oder überlanger Schlüssel", async () => {
    const { mod, zeilen } = await ladeAction();
    expect(await fangeRedirect(() => mod.erledigeFrist("", fd(gut)))).toContain("flashTyp=error");
    expect(await fangeRedirect(() => mod.erledigeFrist(`mieter|${"x".repeat(300)}`, fd(gut)))).toContain("flashTyp=error");
    expect(zeilen()).toHaveLength(0);
  });
  it("heute ist erlaubt (Berliner Datum)", async () => {
    const { mod, zeilen } = await ladeAction();
    await fangeRedirect(() => mod.erledigeFrist(SCHL, fd({ ...gut, erledigt_am: "2026-10-11" })));
    expect(zeilen()).toHaveLength(1);
  });
  it("fremdes Schreiben: die Datenbank lehnt ab (frist_bezug) — die Meldung sagt warum", async () => {
    const { mod, zeilen } = await ladeAction({ fehlerBei: { "frist_ausgeblendet:upsert": "Das Schreiben gehört nicht zu diesem Konto." }, fehlerHint: { "frist_ausgeblendet:upsert": "frist_bezug" } });
    const ziel = decodeURIComponent(await fangeRedirect(() => mod.erledigeFrist(SCHL, fd(gut))));
    expect(ziel).toContain("Das Schreiben gehört nicht zu deinem Konto");
    expect(ziel).toContain("flashTyp=error");
    expect(zeilen()).toHaveLength(0);
  });
  it("Datenbankfehler: Fehler-Meldung statt „vermerkt“", async () => {
    const { mod } = await ladeAction({ fehlerBei: { "frist_ausgeblendet:upsert": "timeout" } });
    const ziel = decodeURIComponent(await fangeRedirect(() => mod.erledigeFrist(SCHL, fd(gut))));
    expect(ziel).toContain("konnte nicht gespeichert werden");
    expect(ziel).not.toContain("Als erledigt vermerkt");
  });
  it("Rücksprung nur intern — „//fremd.de“ landet auf /termine", async () => {
    const { mod } = await ladeAction();
    expect(await fangeRedirect(() => mod.erledigeFrist(SCHL, fd({ ...gut, zurueck: "//fremd.example/login" })))).toMatch(/^\/termine\?flash=/);
  });
  it("ohne Anmeldung: Login, nichts gespeichert", async () => {
    const { mod, zeilen } = await ladeAction({ nutzer: null });
    expect(await fangeRedirect(() => mod.erledigeFrist(SCHL, fd(gut)))).toBe("/login");
    expect(zeilen()).toHaveLength(0);
  });
  it("Vermerk aufheben löscht nur diese Zeile", async () => {
    const andere = fristSchluessel("mieter", "2026-12-31", "NK-Abrechnung 2025 zustellen", M2);
    const { mod, zeilen } = await ladeAction({ tabellen: { frist_ausgeblendet: [
      { id: "a", user_id: U, schluessel: SCHL, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "post", notiz_id: null },
      { id: "b", user_id: U, schluessel: andere, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "post", notiz_id: null },
    ] } });
    await mod.zeigeFristWieder(SCHL);
    expect(zeilen().map((z) => z.id)).toEqual(["b"]);
  });
  it("Zustellwege: feste Liste, dieselbe wie die Datenbank-Regel", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261011150000_ablauf_d_frist_erledigt.sql", "utf8");
    const imSql = /zustellweg in\s*\(([^)]*)\)/.exec(sql)?.[1].match(/'([a-z_]+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
    expect(imSql.sort()).toEqual(Object.keys(ZUSTELLWEGE).sort());
    expect(istZustellweg("post")).toBe(true);
    expect(istZustellweg("constructor")).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Kalender-Export: stabile UIDs, nichts Erledigtes", () => {
  async function ics(tabellen: Record<string, Record<string, unknown>[]>) {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-11T10:00:00Z") });
    const db = speicherDb({ nutzer: { id: U }, tabellen: { termine: [], properties: [], mieter: [], kredite: [], frist_ausgeblendet: [], ...tabellen } });
    mockeNextUndSupabase(db.client);
    const { GET } = await import("@/app/(app)/termine/ical/route");
    const res = await GET(new Request("https://www.myimmoapp.de/termine/ical") as never);
    const text = await res.text();
    const ereignisse = text.split("BEGIN:VEVENT").slice(1).map((b) => ({
      uid: /UID:(.*)\r\n/.exec(b)?.[1] ?? "", titel: /SUMMARY:(.*)\r\n/.exec(b)?.[1] ?? "",
    }));
    return ereignisse;
  }
  const anna = { id: M1, prop_id: null, vorname: "Anna", nachname: "Weber", einheit: null, mietbeginn: "2020-01-01", mietende: null, kuendigung: 3, letzte_erhoehung: "2025-08-01", mietart: "Standard", staffel_datum: null };
  const ben = { ...anna, id: M2, vorname: "Ben" };

  it("gleiche Frist → gleiche UID, auch wenn eine andere Frist dazukommt", async () => {
    const vorher = await ics({ mieter: [anna] });
    const nachher = await ics({ mieter: [{ ...anna, mietende: "2027-09-30" }] }); // + Mietende, + Kündigungsfrist
    const uid = (l: { uid: string; titel: string }[], t: string) => l.find((e) => e.titel === t)?.uid;
    expect(nachher.length).toBeGreaterThan(vorher.length);
    for (const t of ["NK-Abrechnung 2025 zustellen", "Nächste Mieterhöhung möglich"]) {
      expect(uid(vorher, t), t).toBeTruthy();
      expect(uid(nachher, t), t).toBe(uid(vorher, t));
    }
  });
  it("zwei Mieter, gleiche Frist → verschiedene UIDs; alle UIDs eindeutig", async () => {
    const e = await ics({ mieter: [anna, ben] });
    const nk = e.filter((x) => x.titel === "NK-Abrechnung 2025 zustellen");
    expect(nk).toHaveLength(2);
    expect(nk[0].uid).not.toBe(nk[1].uid);
    expect(new Set(e.map((x) => x.uid)).size).toBe(e.length);
  });
  it("erledigt oder ausgeblendet → nicht im Kalender; die andere Mieterin bleibt", async () => {
    const e = await ics({
      mieter: [anna, ben],
      frist_ausgeblendet: [
        { user_id: U, schluessel: SCHL, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "post", notiz_id: null },
        { user_id: U, schluessel: fristSchluessel("mieter", "2026-08-01", "Nächste Mieterhöhung möglich", M2), grund: "ausgeblendet", erledigt_am: null, zustellweg: null, notiz_id: null },
      ],
    });
    expect(e.filter((x) => x.titel === "NK-Abrechnung 2025 zustellen")).toHaveLength(1);
    expect(e.filter((x) => x.titel === "Nächste Mieterhöhung möglich")).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------------------------
describe("/termine zeigt Stand, Quelle und das Bestätigen-Formular", () => {
  async function seite(tabellen: Record<string, Record<string, unknown>[]>, suche: Record<string, string> = {}) {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-11T10:00:00Z") });
    const db = speicherDb({
      nutzer: { id: U },
      tabellen: { termine: [], properties: [], mieter: [], kredite: [], frist_ausgeblendet: [], notizen: [], vertreter: [], miet_zeitraeume: [], zustellungen: [], ...tabellen },
    });
    // Eigene Attrappen (die Seite rendert Client-Bausteine mit Router-Hooks).
    vi.doMock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
    vi.doMock("next/navigation", () => ({
      redirect: (z: string) => { throw new Error(`redirect ${z}`); },
      notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
      useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
      usePathname: () => "/termine",
      useSearchParams: () => new URLSearchParams(),
    }));
    const { default: TerminePage } = await import("@/app/(app)/termine/page");
    const el = await TerminePage({ searchParams: Promise.resolve(suche) });
    return renderToStaticMarkup(el).replace(/<!-- -->/g, "");
  }
  const anna = { id: M1, prop_id: null, vorname: "Anna", nachname: "Weber", einheit: null, mietbeginn: "2020-01-01", mietende: null, kuendigung: 3, letzte_erhoehung: "2025-08-01", mietart: "Standard", staffel_datum: null };
  const ben = { ...anna, id: M2, vorname: "Ben", nachname: "Kurz" };
  const nkAnna = { id: N1, mieter_id: M1, titel: nkTitel(2025), created_at: "2026-03-01T09:00:00Z" };

  it("ohne Schreiben: Link in den Generator/die Abrechnung und Formular", async () => {
    const neu = { ...anna, id: M2, vorname: "Ben", nachname: "Neu", mietbeginn: "2026-10-05", letzte_erhoehung: null };
    const html = await seite({ mieter: [anna, neu] });
    expect(html).toContain(`href="/tenants/${M2}/dokument?art=wohnungsgeber"`);
    expect(html).toContain("noch kein Schreiben");
    expect(html).toContain(`href="/tenants/${M1}/nk?jahr=2025"`);
    expect(html).toContain("Zugang bestätigen");
    expect(html).toContain('name="zustellweg"');
    expect(html).toContain('max="2026-10-11"');
  });
  it("PDF im Archiv: „Zugang nicht bestätigt“ + Link zum Schreiben + Schreiben am Formular", async () => {
    const html = await seite({ mieter: [anna], notizen: [nkAnna] });
    expect(html).toContain("PDF erstellt am 01.03.2026 — Zugang nicht bestätigt");
    expect(html).toContain(`href="/archiv/${N1}/datei"`);
    expect(html).toContain(`name="notiz_id" value="${N1}"`);
  });
  it("erledigt bei Anna: aus der offenen Liste weg, Ben bleibt; mit „Erledigte anzeigen“ wieder da", async () => {
    const vermerk = { user_id: U, schluessel: SCHL, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "einwurf_einschreiben", notiz_id: N1 };
    const offen = await seite({ mieter: [anna, ben], notizen: [nkAnna], frist_ausgeblendet: [vermerk] });
    expect(offen.match(/NK-Abrechnung 2025 zustellen/g)).toHaveLength(1);
    expect(offen).toContain("Ben Kurz");
    const alle = await seite({ mieter: [anna, ben], notizen: [nkAnna], frist_ausgeblendet: [vermerk] }, { erledigte: "1" });
    expect(alle).toContain("erledigt am 08.10.2026 · Einwurf-Einschreiben");
    expect(alle).toContain("Erledigt-Vermerk aufheben");
  });
  it("Rechtsgrundlage mit Prüfdatum im Hinweis; Gesetzestext verlinkt", async () => {
    const html = await seite({ mieter: [anna] });
    expect(html).toContain("§ 556 Abs. 3 BGB (12-Monats-Frist) — Wortlaut geprüft am 11.10.2026");
    expect(html).toContain('href="https://www.gesetze-im-internet.de/bgb/__556.html"');
  });
  it("eigener Termin mit Mieter führt in dessen Akte", async () => {
    const html = await seite({ mieter: [anna], termine: [{ id: "t1", titel: "Wohnungsübergabe", datum: "2026-10-20", mieter_id: M1, prop_id: null, erledigt: false, kategorie: "Miete", wiederkehrung: null, notiz: null }] });
    expect(html).toMatch(new RegExp(`href="/tenants/${M1}"[^>]*>Wohnungsübergabe<`));
  });
});

// ------------------------------------------------------------------------------------------------
describe("Mieterakte: Frist mit Stand und Erledigt-Vermerk", () => {
  async function akte(tabellen: Record<string, Record<string, unknown>[]>) {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-11T10:00:00Z") });
    const db = speicherDb({
      nutzer: { id: U },
      tabellen: { mieter: [], miet_zeitraeume: [], notizen: [], zustellungen: [], einladungscodes: [], mieter_zugaenge: [], frist_ausgeblendet: [], properties: [], ibans: [], ...tabellen },
    });
    vi.doMock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
    vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => db.client }));
    vi.doMock("next/navigation", () => ({
      redirect: (z: string) => { throw new Error(`redirect ${z}`); },
      notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
      useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
      usePathname: () => `/tenants/${M1}`,
      useSearchParams: () => new URLSearchParams(),
    }));
    const { default: Seite } = await import("@/app/(app)/tenants/[id]/page");
    const el = await Seite({ params: Promise.resolve({ id: M1 }) });
    return renderToStaticMarkup(el).replace(/<!-- -->/g, "");
  }
  // Ohne eingetragene letzte Erhöhung: dann gibt es nur die NK-Frist mit einem Schreiben (die Erhöhung hat kein Datum).
  const anna = { id: M1, user_id: U, prop_id: null, vorname: "Anna", nachname: "Weber", einheit: null, mietbeginn: "2020-01-01", mietende: null, kuendigung: 3, letzte_erhoehung: null, mietart: "Standard", staffel_datum: null, kaltmiete: 700, nk_vorauszahlung: 150 };
  const nk = { id: N1, user_id: U, mieter_id: M1, titel: nkTitel(2025), kategorie: "Nebenkostenabrechnung", datei_name: "nk.pdf", created_at: "2026-03-01T09:00:00Z" };

  it("PDF im Archiv: Frist bleibt, Stand „Zugang nicht bestätigt“, Weg zum Bestätigen", async () => {
    const html = await akte({ mieter: [anna], notizen: [nk] });
    expect(html).toContain("NK-Abrechnung 2025 zustellen");
    expect(html).toContain("PDF erstellt am 01.03.2026 — Zugang nicht bestätigt");
    expect(html).toContain("Zugang bestätigen");
  });
  it("erledigt vermerkt: durchgestrichen mit Datum und Weg, kein „Zugang bestätigen“ mehr", async () => {
    const html = await akte({ mieter: [anna], notizen: [nk], frist_ausgeblendet: [{ user_id: U, schluessel: SCHL, grund: "erledigt", erledigt_am: "2026-10-08", zustellweg: "bote", notiz_id: N1 }] });
    expect(html).toContain("erledigt am 08.10.2026 · per Boten (mit Zeugen)");
    expect(html).toMatch(/line-through[^>]*>NK-Abrechnung 2025 zustellen/);
    expect(html).not.toContain("Zugang bestätigen");
  });
});
