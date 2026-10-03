import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { aktuelleAngebote, anfrageMail, mailtoLink, type Angebotsanfrage, type Angebot } from "@/lib/angebote";
import { istOeffentlicheSeite } from "@/lib/oeffentlich";

// „Angebote einholen“ (02.10.2026, Handwerker-Anfragen Stufe 1). Grenzen, die hier halten
// müssen: nur eigene Vorgänge und Firmen, keine Mieterdaten in der Anfrage, Mieter-Kontakt
// beim Beauftragen nur mit Haken, öffentliche Abgabe nur über den Link (geprüft in der DB).

const ang = (x: Partial<Angebot>): Angebot => ({
  id: "g", anfrage_id: "q", firma: "F", kontakt: null, betrag: 100, termin: null, nachricht: null, created_at: "2026-10-01T10:00:00Z", ...x,
});
const anf = (x: Partial<Angebotsanfrage>): Angebotsanfrage => ({
  id: "q", anliegen_id: "a1", firma_id: "f", status: "angefragt", public_token: "t", token_ablauf: "2026-11-01T00:00:00Z",
  auftrag_id: null, created_at: "2026-10-01T00:00:00Z", angebote: [], ...x,
});

describe("Vergleich", () => {
  it("je Anfrage zählt das LETZTE Angebot; sortiert nach Preis; ohne Angebot nicht dabei", () => {
    const r = aktuelleAngebote([
      anf({ id: "q1", angebote: [ang({ id: "alt", betrag: 100, created_at: "2026-10-01T00:00:00Z" }), ang({ id: "neu", betrag: 900, created_at: "2026-10-02T00:00:00Z" })] }),
      anf({ id: "q2", angebote: [ang({ id: "b", betrag: 500 })] }),
      anf({ id: "q3" }),
    ]);
    expect(r.map((x) => x.angebot.id)).toEqual(["b", "neu"]);
  });
});

describe("Mail-Entwurf", () => {
  it("enthält Link und Titel, keine weiteren Angaben", () => {
    const m = anfrageMail({ firma: "Böhm", titel: "Heizung", link: "https://x/angebot/t", absender: "Jonas" });
    expect(m.betreff).toBe("Angebotsanfrage: Heizung");
    expect(m.text).toContain("https://x/angebot/t");
    expect(m.text.endsWith("Jonas")).toBe(true);
  });
  it("eine Adresse mit ? oder & kann Betreff und Text nicht kapern", () => {
    expect(mailtoLink("a@b.de", "S", "T")).toBe("mailto:a@b.de?subject=S&body=T");
    expect(mailtoLink("a@b.de?body=X", "S", "T")).toBe("mailto:?subject=S&body=T");
    expect(mailtoLink(null, "S", "T")).toBe("mailto:?subject=S&body=T");
  });
});

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

async function lade(init = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  vi.doMock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "1.2.3.4"]]) }));
  const mod = await import("@/lib/actions/angebote");
  return { db, mod };
}
type Db = Awaited<ReturnType<typeof lade>>["db"];
const ops = (db: Db, t: string, op: string) => db.zugriffe.filter((z) => z.tabelle === t && z.op === op);

describe("fordereAngeboteAn", () => {
  // Als Funktion: antwortFolge wird beim Abrufen geleert (shift) — jeder Test braucht frische Listen.
  const ok = () => ({
    antworten: { anliegen: { id: "a1", prop_id: "p1" }, properties: { bezeichnung: "Haus", adresse: "Weg 1" }, vermieter_profil: { name: "Jonas" } },
    antwortFolge: {
      "firmen:select": [[{ id: "f1" }, { id: "f2" }]],
      "angebotsanfragen:select": [[{ firma_id: "f2" }]],
      "angebotsanfragen:insert": [[{ id: "q1" }]],
    } as Record<string, unknown[]>,
  });
  const FORM = { anliegenId: "a1", titel: "Heizung defekt", beschreibung: "Therme zeigt F28" };
  const mitFirmen = (...ids: string[]) => { const f = fd(FORM); for (const i of ids) f.append("firmaId", i); return f; };

  it("legt nur für Firmen OHNE laufende Anfrage an — ohne Mieterangaben", async () => {
    const { db, mod } = await lade(ok());
    expect(await mod.fordereAngeboteAn(mitFirmen("f1", "f2"))).toEqual({ ok: true, neu: 1 });
    const zeilen = ops(db, "angebotsanfragen", "insert")[0].daten as unknown as Record<string, unknown>[];
    expect(zeilen).toEqual([{ vermieter_id: "nutzer-1", anliegen_id: "a1", firma_id: "f1", titel: "Heizung defekt", beschreibung: "Therme zeigt F28", objekt: "Haus, Weg 1", absender: "Jonas" }]);
    expect(ops(db, "anliegen", "select")[0].filter).toContain("eq:vermieter_id=nutzer-1");
    expect(ops(db, "firmen", "select")[0].filter).toContain("eq:user_id=nutzer-1");
    expect(db.zugriffe.some((z) => z.tabelle === "mieter")).toBe(false);
  });
  it("fremde Firma (weniger Treffer als gewählt) bricht ab", async () => {
    const { db, mod } = await lade({ ...ok(), antwortFolge: { ...ok().antwortFolge, "firmen:select": [[{ id: "f1" }]] } });
    const r = await mod.fordereAngeboteAn(mitFirmen("f1", "fremd"));
    expect("error" in r && r.error).toContain("nicht zu deinem Verzeichnis");
    expect(ops(db, "angebotsanfragen", "insert")).toHaveLength(0);
  });
  it("fremder Vorgang, keine Firma, mehr als 5 Firmen, leerer Titel → kein Schreiben", async () => {
    const faelle: [FormData, string, object?][] = [
      [mitFirmen("f1"), "Vorgang nicht gefunden", { ...ok(), antworten: { ...ok().antworten, anliegen: null } }],
      [mitFirmen(), "mindestens eine Firma"],
      [mitFirmen("1", "2", "3", "4", "5", "6"), "Höchstens 5"],
      [(() => { const f = fd({ ...FORM, titel: " " }); f.append("firmaId", "f1"); return f; })(), "was gemacht werden soll"],
    ];
    for (const [form, meldung, init] of faelle) {
      const { db, mod } = await lade(init ?? ok());
      const r = await mod.fordereAngeboteAn(form);
      expect("error" in r && r.error).toContain(meldung);
      expect(ops(db, "angebotsanfragen", "insert")).toHaveLength(0);
    }
  });
  it("scheitert die Prüfung laufender Anfragen, wird NICHT angelegt (sonst doppelte Links)", async () => {
    const { db, mod } = await lade({ ...ok(), antwortFolge: { ...ok().antwortFolge, "firmen:select": [[{ id: "f1" }]] }, fehlerBei: { "angebotsanfragen:select": { message: "x" } } });
    const r = await mod.fordereAngeboteAn(mitFirmen("f1"));
    expect("error" in r && r.error).toContain("Anfragen konnten nicht geprüft werden");
    expect(ops(db, "angebotsanfragen", "insert")).toHaveLength(0);
  });
  it("alle schon angefragt → Hinweis statt leerem Erfolg", async () => {
    const { mod } = await lade({ ...ok(), antwortFolge: { ...ok().antwortFolge, "firmen:select": [[{ id: "f2" }]] } });
    const r = await mod.fordereAngeboteAn(mitFirmen("f2"));
    expect("error" in r && r.error).toContain("läuft schon");
  });
});

describe("beauftrageAngebot", () => {
  const ok = () => ({
    antworten: {
      angebote: { id: "g1", anfrage_id: "q1", betrag: "480.5", termin: "2026-10-10" },
      anliegen: { id: "a1", prop_id: "p1", mieter_id: "m1" },
      auftraege: { id: "auf1", public_token: "tok" },
    },
    antwortFolge: {
      "angebotsanfragen:select": [{ id: "q1", anliegen_id: "a1", firma_id: "f1", titel: "Heizung", beschreibung: "B", objekt: "Haus", absender: "Jonas", status: "angefragt" }],
      "angebotsanfragen:update": [{ id: "q1" }, null],
    } as Record<string, unknown[]>,
  });
  it("legt einen offenen Auftrag an die Firma an — OHNE Mieter-Kontakt, wenn nicht angehakt", async () => {
    const { db, mod } = await lade(ok());
    expect(await mod.beauftrageAngebot(fd({ angebotId: "g1" }))).toEqual({ ok: true, token: "tok" });
    expect(ops(db, "auftraege", "insert")[0].daten).toMatchObject({
      vermieter_id: "nutzer-1", service_user_id: null, firma_id: "f1", anliegen_id: "a1", prop_id: "p1",
      status: "offen", erstellt_von: "vermieter", kosten_schaetzung: 480.5, termin: "2026-10-10", mieter_id: null,
    });
    const [gewaehlt, rest] = ops(db, "angebotsanfragen", "update");
    expect(gewaehlt.daten).toEqual({ status: "beauftragt", auftrag_id: "auf1" });
    expect(gewaehlt.filter).toEqual(expect.arrayContaining(["eq:id=q1", "eq:vermieter_id=nutzer-1", "eq:status=angefragt"]));
    expect(rest.daten).toEqual({ status: "abgelehnt" });
    expect(rest.filter).toEqual(expect.arrayContaining(["eq:anliegen_id=a1", "eq:vermieter_id=nutzer-1", "eq:status=angefragt"]));
  });
  it("mit Haken geht die Mieter-Zeile des Vorgangs mit", async () => {
    const { db, mod } = await lade(ok());
    await mod.beauftrageAngebot(fd({ angebotId: "g1", mieterKontakt: "on" }));
    expect(ops(db, "auftraege", "insert")[0].daten).toMatchObject({ mieter_id: "m1" });
  });
  it("schon entschiedene oder fremde Anfrage → kein Auftrag", async () => {
    for (const q of [{ ...(ok().antwortFolge["angebotsanfragen:select"][0] as object), status: "abgelehnt" }, null]) {
      const { db, mod } = await lade({ ...ok(), antwortFolge: { ...ok().antwortFolge, "angebotsanfragen:select": [q] } });
      expect("error" in (await mod.beauftrageAngebot(fd({ angebotId: "g1" })))).toBe(true);
      expect(ops(db, "auftraege", "insert")).toHaveLength(0);
    }
  });
  it("die Anfrage-Abfrage filtert auf das eigene Konto", async () => {
    const { db, mod } = await lade(ok());
    await mod.beauftrageAngebot(fd({ angebotId: "g1" }));
    expect(ops(db, "angebotsanfragen", "select")[0].filter).toContain("eq:vermieter_id=nutzer-1");
  });
  it("Abschluss der Anfrage scheitert → Fehler, kein stiller Erfolg", async () => {
    const { mod } = await lade({ ...ok(), antwortFolge: { ...ok().antwortFolge, "angebotsanfragen:update": [null] } });
    const r = await mod.beauftrageAngebot(fd({ angebotId: "g1" }));
    expect("error" in r && r.error).toContain("Auftrag angelegt");
  });
});

describe("zieheAnfrageZurueck", () => {
  it("nur eigene, nur laufende; Treffer-Null ist ein Fehler", async () => {
    const { db, mod } = await lade({ antworten: { angebotsanfragen: { id: "q1" } } });
    expect(await mod.zieheAnfrageZurueck("q1")).toEqual({ ok: true });
    expect(ops(db, "angebotsanfragen", "update")[0].filter).toEqual(expect.arrayContaining(["eq:id=q1", "eq:vermieter_id=nutzer-1", "eq:status=angefragt"]));
    const { mod: m2 } = await lade();
    expect("error" in (await m2.zieheAnfrageZurueck("q1"))).toBe(true);
  });
});

describe("gibAngebotAb (öffentlich, ohne Konto)", () => {
  const T = "11111111-2222-3333-4444-555555555555";
  it("deutscher Betrag wird verstanden und gerundet an die DB-Prüfung gegeben", async () => {
    const { db, mod } = await lade({ rpc: { angebot_public_abgeben: { ok: true } } });
    expect(await mod.gibAngebotAb(fd({ token: T, firma: "Böhm", betrag: "1.250,555" }))).toEqual({ ok: true });
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:angebot_public_abgeben")).toBe(true);
  });
  it("Ablehnung der Datenbank (Link abgelaufen) wird angezeigt, nicht verschluckt", async () => {
    const { mod } = await lade({ rpc: { angebot_public_abgeben: { error: "Dieser Link ist nicht mehr gültig." } } });
    expect(await mod.gibAngebotAb(fd({ token: T, firma: "B", betrag: "1" }))).toEqual({ error: "Dieser Link ist nicht mehr gültig." });
  });
  it("kaputter Token, fehlender Betrieb, unlesbarer Betrag, Bremse → nie an die DB", async () => {
    const faelle: [Record<string, string>, string, object?][] = [
      [{ token: "x", firma: "B", betrag: "1" }, "nicht gültig"],
      [{ token: T, firma: " ", betrag: "1" }, "Betrieb"],
      [{ token: T, firma: "B", betrag: "viel" }, "gültigen Betrag"],
      [{ token: T, firma: "B", betrag: "-5" }, "gültigen Betrag"],
      [{ token: T, firma: "B", betrag: "5", termin: "morgen" }, "Termin"],
      [{ token: T, firma: "B", betrag: "5" }, "Zu viele", { fehlerBei: { "rpc:rate_limit_pruefen": { message: "zu viele" } } }],
    ];
    for (const [werte, meldung, init] of faelle) {
      const { db, mod } = await lade({ rpc: { angebot_public_abgeben: { ok: true } }, ...(init ?? {}) });
      const r = await mod.gibAngebotAb(fd(werte));
      expect("error" in r && r.error).toContain(meldung);
      expect(db.zugriffe.some((z) => z.tabelle === "rpc:angebot_public_abgeben")).toBe(false);
    }
  });
});

describe("Anbindung", () => {
  it("die Angebotsseite ist öffentlich und ohne App-Rahmen — wie /auftrag", () => {
    expect(istOeffentlicheSeite("/angebot/abc")).toBe(true);
    expect(readFileSync("app/(app)/layout.tsx", "utf8")).toContain('"/auftrag", "/angebot"');
  });
  it("die öffentliche Seite zeigt keinen Mieter", () => {
    const seite = readFileSync("app/(app)/angebot/[token]/page.tsx", "utf8");
    expect(seite).toContain('rpc("angebot_public_info"');
    expect(seite).not.toMatch(/mieter_(name|telefon|email)/);
  });
  it("der Vorgang zeigt „Angebote einholen“ nur bei Schäden", () => {
    expect(readFileSync("components/AnliegenManager.tsx", "utf8")).toContain('angebote && a.typ === "schaden"');
  });
});
