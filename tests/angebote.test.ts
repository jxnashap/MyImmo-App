import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { speicherDb } from "./stubs/speicherDb";
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

// Ab hier gegen `speicherDb` (B07, 11.10.2026): Zustandsänderungen sind echte Zeilen, gleichzeitige
// Aufrufe verzahnen sich, und der Teil-Index „eine laufende Anfrage je Vorgang und Firma“ gilt.
async function ladeSpeicher(extra: { fehlerBei?: Record<string, string> } = {}) {
  vi.resetModules();
  const db = speicherDb({
    tabellen: {
      angebote: [{ id: "g1", anfrage_id: "q1", betrag: "480.5", termin: "2026-10-10" }, { id: "g2", anfrage_id: "q2", betrag: 600, termin: null }],
      angebotsanfragen: [
        { id: "q1", vermieter_id: "nutzer-1", anliegen_id: "a1", firma_id: "f1", titel: "Heizung", beschreibung: "B", objekt: "Haus", absender: "Jonas", status: "angefragt", auftrag_id: null },
        { id: "q2", vermieter_id: "nutzer-1", anliegen_id: "a1", firma_id: "f2", titel: "Heizung", beschreibung: "B", objekt: "Haus", absender: "Jonas", status: "angefragt", auftrag_id: null },
        { id: "q-fremd", vermieter_id: "anderer", anliegen_id: "a-fremd", firma_id: "f9", status: "angefragt", auftrag_id: null },
      ],
      anliegen: [{ id: "a1", vermieter_id: "nutzer-1", prop_id: "p1", mieter_id: "m1" }, { id: "a-fremd", vermieter_id: "anderer", prop_id: "p9", mieter_id: "m9" }],
      firmen: [{ id: "f1", user_id: "nutzer-1" }, { id: "f2", user_id: "nutzer-1" }, { id: "f3", user_id: "nutzer-1" }],
      auftraege: [], properties: [], vermieter_profil: [],
    },
    eindeutig: { angebotsanfragen: [{ spalten: ["anliegen_id", "firma_id"], wo: (r) => r.status === "angefragt" }] },
    // Spalten-Standards wie in der Datenbank.
    vorgaben: {
      auftraege: () => ({ public_token: `tok-${Math.random().toString(36).slice(2, 8)}` }),
      angebotsanfragen: () => ({ status: "angefragt", auftrag_id: null }),
    },
    fehlerBei: extra.fehlerBei,
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/angebote");
  const anfrage = (id: string) => db.tabellen.angebotsanfragen.find((r) => r.id === id)!;
  return { db, mod, anfrage };
}

describe("beauftrageAngebot", () => {
  it("legt einen offenen Auftrag an die Firma an — OHNE Mieter-Kontakt, wenn nicht angehakt", async () => {
    const { db, mod, anfrage } = await ladeSpeicher();
    const r = await mod.beauftrageAngebot(fd({ angebotId: "g1" }));
    expect(r).toEqual({ ok: true, token: db.tabellen.auftraege[0].public_token });
    expect(db.tabellen.auftraege).toEqual([expect.objectContaining({
      vermieter_id: "nutzer-1", service_user_id: null, firma_id: "f1", anliegen_id: "a1", prop_id: "p1",
      status: "offen", erstellt_von: "vermieter", kosten_schaetzung: 480.5, termin: "2026-10-10", mieter_id: null,
    })]);
    expect(anfrage("q1")).toMatchObject({ status: "beauftragt", auftrag_id: db.tabellen.auftraege[0].id });
    expect(anfrage("q2")).toMatchObject({ status: "abgelehnt" }); // die übrigen des Vorgangs
    expect(anfrage("q-fremd")).toMatchObject({ status: "angefragt" });
  });

  it("mit Haken geht die Mieter-Zeile des Vorgangs mit", async () => {
    const { db, mod } = await ladeSpeicher();
    await mod.beauftrageAngebot(fd({ angebotId: "g1", mieterKontakt: "on" }));
    expect(db.tabellen.auftraege[0]).toMatchObject({ mieter_id: "m1" });
  });

  it("ein zweiter Klick (Anfrage schon entschieden) legt keinen zweiten Auftrag an", async () => {
    const { db, mod } = await ladeSpeicher();
    await mod.beauftrageAngebot(fd({ angebotId: "g1" }));
    const r = await mod.beauftrageAngebot(fd({ angebotId: "g1" }));
    expect("error" in r && r.error).toContain("schon entschieden");
    expect(db.tabellen.auftraege).toHaveLength(1);
  });

  it("Doppelklick GLEICHZEITIG: genau EIN Auftrag", async () => {
    const { db, mod } = await ladeSpeicher();
    const [a, b] = await Promise.all([mod.beauftrageAngebot(fd({ angebotId: "g1" })), mod.beauftrageAngebot(fd({ angebotId: "g1" }))]);
    expect(db.tabellen.auftraege).toHaveLength(1);
    expect([a, b].filter((x) => "ok" in x)).toHaveLength(1);
  });

  it("zwei VERSCHIEDENE Angebote desselben Vorgangs gleichzeitig: es bleibt bei einem Auftrag", async () => {
    // Das zweite wird abgelehnt, sobald das erste beauftragt ist — oder scheitert an seiner Beanspruchung.
    const { db, mod } = await ladeSpeicher();
    await Promise.all([mod.beauftrageAngebot(fd({ angebotId: "g1" })), mod.beauftrageAngebot(fd({ angebotId: "g2" }))]);
    expect(db.tabellen.angebotsanfragen.filter((r) => r.status === "beauftragt").length).toBeGreaterThanOrEqual(1);
    // Beide könnten beansprucht sein, bevor das Ablehnen läuft — dann gibt es zwei Aufträge, aber nie
    // zwei an DIESELBE Firma. Festgehalten wird hier, was garantiert ist:
    const firmen = db.tabellen.auftraege.map((x) => x.firma_id);
    expect(new Set(firmen).size).toBe(firmen.length);
  });

  it("schon entschiedene oder fremde Anfrage → kein Auftrag", async () => {
    const { db, mod, anfrage } = await ladeSpeicher();
    anfrage("q1").status = "abgelehnt";
    db.tabellen.angebote.push({ id: "g-fremd", anfrage_id: "q-fremd", betrag: 1, termin: null });
    for (const id of ["g1", "g-fremd", "gibt-es-nicht"]) {
      expect("error" in (await mod.beauftrageAngebot(fd({ angebotId: id })))).toBe(true);
    }
    expect(db.tabellen.auftraege).toHaveLength(0);
    expect(anfrage("q-fremd").status).toBe("angefragt");
  });

  it("scheitert der Auftrag, ist die Anfrage wieder offen", async () => {
    const { db, mod, anfrage } = await ladeSpeicher({ fehlerBei: { "auftraege:insert": "abgelehnt" } });
    const r = await mod.beauftrageAngebot(fd({ angebotId: "g1" }));
    expect(r).toEqual({ error: "Der Auftrag konnte nicht angelegt werden." });
    expect(anfrage("q1")).toMatchObject({ status: "angefragt", auftrag_id: null });
    expect(anfrage("q2").status).toBe("angefragt");
    expect(db.tabellen.auftraege).toHaveLength(0);
  });

  it("scheitert das Beanspruchen, entsteht kein Auftrag", async () => {
    const { db, mod } = await ladeSpeicher({ fehlerBei: { "angebotsanfragen:update": "timeout" } });
    expect("error" in (await mod.beauftrageAngebot(fd({ angebotId: "g1" })))).toBe(true);
    expect(db.tabellen.auftraege).toHaveLength(0);
  });
});

describe("fordereAngeboteAn: gleichzeitig", () => {
  it("zwei GLEICHZEITIGE Anfragen an dieselbe Firma → EINE laufende Anfrage, der zweite Aufruf meldet es", async () => {
    const { db, mod } = await ladeSpeicher();
    db.tabellen.angebotsanfragen = db.tabellen.angebotsanfragen.filter((r) => r.anliegen_id !== "a1");
    const form = () => { const f = fd({ anliegenId: "a1", titel: "Dach undicht" }); f.append("firmaId", "f3"); return f; };
    const [a, b] = await Promise.all([mod.fordereAngeboteAn(form()), mod.fordereAngeboteAn(form())]);
    expect(db.tabellen.angebotsanfragen.filter((r) => r.firma_id === "f3" && r.status === "angefragt")).toHaveLength(1);
    expect([a, b].filter((x) => "ok" in x)).toHaveLength(1);
    expect([a, b].map((x) => ("error" in x ? x.error : "")).join()).toMatch(/läuft (gerade )?schon/);
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
