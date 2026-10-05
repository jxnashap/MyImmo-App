import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { selbstErledigtErlaubt, TAETIGKEITEN, TAETIGKEIT_KEYS } from "@/lib/taetigkeiten";

// „Selbst erledigt“ über eine Liste ERLAUBTER Tätigkeiten (05.10.2026, Prüfung vor dem Livegang):
// Die Sicherheit hängt nicht mehr allein an der Wortwahl im Titel.

const basis = { rolle: "hausmeister" as const, titel: "Auftrag", beschreibung: null, firmaId: null };

describe("Regel", () => {
  it("Hausmeister: erlaubte Tätigkeit ja, Fachbetriebs-Tätigkeit nein — auch ohne verräterisches Wort", () => {
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: "leuchtmittel" }).erlaubt).toBe(true);
    // „Heizung kalt“ fiel durch die Stichwortliste — über die Tätigkeit nicht mehr.
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: "heizung", titel: "Heizung kalt" }).erlaubt).toBe(false);
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: "sonstiges" }).erlaubt).toBe(false);
  });
  it("Stichworte bleiben das zweite Netz: erlaubte Tätigkeit mit Gas im Text → gesperrt", () => {
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: "kleinreparatur", titel: "Gasherd wackelt" }).erlaubt).toBe(false);
  });
  it("alte Aufträge ohne Tätigkeit: nur die Stichworte entscheiden", () => {
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: null, titel: "Dachrinne" }).erlaubt).toBe(true);
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: null, titel: "Gastherme" }).erlaubt).toBe(false);
  });
  it("mit freigegebenem Fachbetrieb am Auftrag ist alles erlaubt", () => {
    expect(selbstErledigtErlaubt({ ...basis, taetigkeit: "gas", titel: "Gastherme", firmaId: "f1" }).erlaubt).toBe(true);
  });
  it("ein Dienstleister IST der Fachbetrieb — keine Sperre", () => {
    expect(selbstErledigtErlaubt({ ...basis, rolle: "dienstleister", taetigkeit: "wasser", titel: "Trinkwasserleitung" }).erlaubt).toBe(true);
  });
  it("jede Fachbetriebs-Tätigkeit nennt einen Grund", () => {
    for (const t of TAETIGKEITEN.filter((x) => !x.selbst)) {
      const r = selbstErledigtErlaubt({ ...basis, taetigkeit: t.key });
      expect(r.erlaubt, t.key).toBe(false);
      if (!r.erlaubt) expect(r.grund).toContain(t.label);
    }
  });
});

describe("Datenbank und App sprechen dieselbe Liste", () => {
  it("die Prüfregel der Migration enthält genau die Schlüssel aus lib/taetigkeiten.ts", () => {
    const sql = readFileSync("supabase/migrations/20261005140000_auftrag_taetigkeit.sql", "utf8");
    const liste = /taetigkeit in \(([^)]*)\)/.exec(sql)![1];
    const db = [...liste.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(db).toEqual([...TAETIGKEIT_KEYS].sort());
  });
  it("der Partner kann die Tätigkeit nicht nachträglich umstellen (Spaltenschutz)", () => {
    expect(readFileSync("supabase/migrations/20261005140000_auftrag_taetigkeit.sql", "utf8")).toMatch(/new\.taetigkeit\s*:= old\.taetigkeit;/);
  });
});

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});
async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  return { db, mod: await import("@/lib/actions/service") };
}
type Z = { tabelle: string; op: string; daten?: unknown };
const ins = (db: { zugriffe: Z[] }) => db.zugriffe.filter((z) => z.tabelle === "auftraege" && z.op === "insert");
const upd = (db: { zugriffe: Z[] }) => db.zugriffe.filter((z) => z.tabelle === "auftraege" && z.op === "update");

describe("Server", () => {
  it("ohne oder mit erfundener Tätigkeit entsteht kein Antrag und kein Auftrag", async () => {
    for (const t of [undefined, "irgendwas"]) {
      const a = await lade();
      expect(await a.mod.beantrageAuftrag(fd({ vermieterId: "v1", titel: "X", taetigkeit: t }))).toEqual({ error: "Bitte die Art der Arbeit wählen." });
      expect(ins(a.db)).toHaveLength(0);
      const b = await lade();
      expect(await b.mod.erstelleAuftrag(fd({ serviceUserId: "s1", titel: "X", taetigkeit: t }))).toEqual({ error: "Bitte die Art der Arbeit wählen." });
      expect(ins(b.db)).toHaveLength(0);
    }
  });

  it("Hausmeister: Heizung ohne Firma → „erledigt“ abgelehnt, obwohl kein Stichwort im Titel", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "auftraege:select": [{ titel: "Heizung kalt", beschreibung: null, firma_id: null, taetigkeit: "heizung", vermieter_id: "v1" }] },
      antworten: { service_zugaenge: { rolle: "hausmeister" } },
    });
    const r = await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt" }));
    expect(r.error).toMatch(/Heizung \/ Warmwasser/);
    expect(upd(db)).toHaveLength(0);
  });

  it("Dienstleister: derselbe Auftrag darf erledigt werden", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "auftraege:select": [{ titel: "Heizung kalt", beschreibung: null, firma_id: null, taetigkeit: "heizung", vermieter_id: "v1" }], "auftraege:update": [{ id: "a1" }] },
      antworten: { service_zugaenge: { rolle: "dienstleister" } },
    });
    expect(await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt" }))).toEqual({ ok: true });
    expect(upd(db)).toHaveLength(1);
  });

  it("Rolle nicht lesbar → strengere Regel (wie Hausmeister)", async () => {
    const { mod } = await lade({
      antwortFolge: { "auftraege:select": [{ titel: "Heizung kalt", beschreibung: null, firma_id: null, taetigkeit: "heizung", vermieter_id: "v1" }], "auftraege:update": [{ id: "a1" }] },
      fehlerBei: { service_zugaenge: { message: "kaputt" } },
    });
    // Die Ablehnung muss von der Regel kommen — nicht von einem gescheiterten Speichern danach.
    expect((await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt" }))).error).toMatch(/Fachbetrieb nötig/);
  });
});
