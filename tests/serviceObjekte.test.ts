import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { ladeServicePortalDaten } from "@/lib/servicePortalDaten";

// Hausmeister & Servicepartner, Schritt 1 (05.10.2026): Rolle je Verknüpfung, Zuordnung
// Partner ↔ Immobilien, Übergabe beim Partnerwechsel. Die Datenbank-Regeln sind in einer
// zurückgerollten Transaktion bewiesen (supabase/migrations/README.md, 20261005100000);
// hier steht, was die App davor tut.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/service");
  return { db, mod };
}

type Z = { tabelle: string; op: string; daten?: unknown; filter: string[] };
const zugriffe = (db: { zugriffe: Z[] }, tabelle: string, op: string) => db.zugriffe.filter((z) => z.tabelle === tabelle && z.op === op);

function objekteFd(rolle: string, objekte: string[]) {
  const f = fd({ serviceUserId: "hm-1", rolle });
  for (const o of objekte) f.append("objekt", o);
  return f;
}

describe("Rolle und Objekte setzen", () => {
  it("fügt neue Objekte hinzu und entfernt abgewählte — nur für das eigene Konto", async () => {
    const { db, mod } = await lade({
      rpc: { service_rolle_setzen: true },
      antwortFolge: {
        "properties:select": [[{ id: "p1" }, { id: "p2" }]],
        "service_objekte:select": [[{ prop_id: "p2" }, { prop_id: "p3" }]],
      },
    });
    expect(await mod.setzeServicePartner(objekteFd("hausmeister", ["p1", "p2"]))).toEqual({ ok: true });
    const ins = zugriffe(db, "service_objekte", "insert")[0];
    expect(ins.daten).toEqual([{ vermieter_id: "nutzer-1", service_user_id: "hm-1", prop_id: "p1" }]);
    const del = zugriffe(db, "service_objekte", "delete")[0];
    expect(del.filter).toEqual(expect.arrayContaining(["eq:vermieter_id=nutzer-1", "eq:service_user_id=hm-1", "in:prop_id=p3"]));
    expect(zugriffe(db, "properties", "select")[0].filter).toContain("eq:user_id=nutzer-1");
  });

  it("ein fremdes Objekt: nichts wird zugewiesen", async () => {
    const { db, mod } = await lade({
      rpc: { service_rolle_setzen: true },
      antwortFolge: { "properties:select": [[{ id: "p1" }]] },
    });
    const r = await mod.setzeServicePartner(objekteFd("hausmeister", ["p1", "fremd"]));
    expect(r).toEqual({ error: "Mindestens ein Objekt gehört nicht zu deinem Konto." });
    expect(zugriffe(db, "service_objekte", "insert")).toHaveLength(0);
  });

  it("unbekannter Partner (Rolle nicht gesetzt): Abbruch", async () => {
    const { db, mod } = await lade({ rpc: { service_rolle_setzen: false } });
    expect(await mod.setzeServicePartner(objekteFd("hausmeister", ["p1"]))).toEqual({ error: "Service-Partner nicht gefunden." });
    expect(zugriffe(db, "service_objekte", "insert")).toHaveLength(0);
  });

  it("Dienstleister: alle Objekte werden entfernt, angehakte zählen nicht", async () => {
    const { db, mod } = await lade({
      rpc: { service_rolle_setzen: true },
      antwortFolge: { "service_objekte:select": [[{ prop_id: "p1" }]] },
    });
    expect(await mod.setzeServicePartner(objekteFd("dienstleister", ["p1", "p2"]))).toEqual({ ok: true });
    expect(zugriffe(db, "service_objekte", "insert")).toHaveLength(0);
    expect(zugriffe(db, "service_objekte", "delete")[0].filter).toContain("in:prop_id=p1");
  });

  it("kann der aktuelle Stand nicht gelesen werden, wird nichts geändert (fail-closed)", async () => {
    const { db, mod } = await lade({
      rpc: { service_rolle_setzen: true },
      antwortFolge: { "properties:select": [[{ id: "p1" }]] },
      fehlerBei: { "service_objekte:select": { message: "kaputt" } },
    });
    const r = await mod.setzeServicePartner(objekteFd("hausmeister", ["p1"]));
    expect("error" in r).toBe(true);
    expect(zugriffe(db, "service_objekte", "insert")).toHaveLength(0);
    expect(zugriffe(db, "service_objekte", "delete")).toHaveLength(0);
  });

  it("eine erfundene Rolle wird abgelehnt", async () => {
    const { db, mod } = await lade({ rpc: { service_rolle_setzen: true } });
    expect(await mod.setzeServicePartner(objekteFd("admin", []))).toEqual({ error: "Bitte eine Rolle wählen." });
    expect(db.zugriffe.find((z) => z.op === "rpc")).toBeUndefined();
  });
});

describe("Partner wechseln", () => {
  const beide = [{ user_id: "alt", rolle: "hausmeister" }, { user_id: "neu", rolle: "hausmeister" }];

  it("nur OFFENE Aufträge wandern, erledigte bleiben beim bisherigen Partner", async () => {
    const { db, mod } = await lade({ antwortFolge: { "service_zugaenge:select": [beide], "auftraege:update": [[{ id: "a1" }, { id: "a2" }]] } });
    const r = await mod.uebergebeServicePartner(fd({ alt: "alt", neu: "neu" }));
    expect(r).toEqual({ ok: true, auftraege: 2, objekte: 0 });
    const u = zugriffe(db, "auftraege", "update")[0];
    expect(u.daten).toEqual({ service_user_id: "neu" });
    expect(u.filter).toEqual(expect.arrayContaining(["eq:vermieter_id=nutzer-1", "eq:service_user_id=alt", "in:status=freigabe,offen,angenommen"]));
  });

  it("mit Objekten: zum neuen hinzu, beim alten entfernt", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "service_zugaenge:select": [beide], "auftraege:update": [[]], "service_objekte:select": [[{ prop_id: "p1" }, { prop_id: "p2" }]] },
    });
    const r = await mod.uebergebeServicePartner(fd({ alt: "alt", neu: "neu", mitObjekten: "1" }));
    expect(r).toEqual({ ok: true, auftraege: 0, objekte: 2 });
    expect(zugriffe(db, "service_objekte", "upsert")[0].daten).toEqual([
      { vermieter_id: "nutzer-1", service_user_id: "neu", prop_id: "p1" },
      { vermieter_id: "nutzer-1", service_user_id: "neu", prop_id: "p2" },
    ]);
    expect(zugriffe(db, "service_objekte", "delete")[0].filter).toEqual(expect.arrayContaining(["eq:vermieter_id=nutzer-1", "eq:service_user_id=alt"]));
  });

  it("ein nicht verknüpfter Partner bekommt nichts", async () => {
    const { db, mod } = await lade({ antwortFolge: { "service_zugaenge:select": [[{ user_id: "alt", rolle: "hausmeister" }]] } });
    const r = await mod.uebergebeServicePartner(fd({ alt: "alt", neu: "fremd" }));
    expect("error" in r).toBe(true);
    expect(zugriffe(db, "auftraege", "update")).toHaveLength(0);
  });

  it("Objekte gehen nicht an einen Dienstleister", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "service_zugaenge:select": [[{ user_id: "alt", rolle: "hausmeister" }, { user_id: "neu", rolle: "dienstleister" }]], "auftraege:update": [[]] },
    });
    const r = await mod.uebergebeServicePartner(fd({ alt: "alt", neu: "neu", mitObjekten: "1" }));
    expect("error" in r).toBe(true);
    expect(zugriffe(db, "service_objekte", "upsert")).toHaveLength(0);
  });
});

describe("Trennen räumt die Zuordnung mit ab", () => {
  it("entferneServicePartner löscht auch die Objekte dieses Partners", async () => {
    const { db, mod } = await lade();
    expect(await mod.entferneServicePartner("hm-1")).toEqual({ ok: true });
    expect(zugriffe(db, "service_objekte", "delete")[0].filter).toEqual(expect.arrayContaining(["eq:vermieter_id=nutzer-1", "eq:service_user_id=hm-1"]));
  });

  it("scheitert das Aufräumen, meldet die Oberfläche es — nicht stillschweigend „gelöst“", async () => {
    const { mod } = await lade({ fehlerBei: { "service_objekte:delete": { message: "kaputt" } } });
    const r = await mod.entferneServicePartner("hm-1");
    expect(r.error).toMatch(/Objekt-Zuordnung blieb gespeichert/);
  });
});

describe("Antrag des Hausmeisters mit Objekt", () => {
  it("ein zugewiesenes Objekt: prop_id und lesbarer Name landen im Auftrag", async () => {
    const { db, mod } = await lade({ antworten: { service_objekte_portal: { id: "p1", bezeichnung: "Haus A", adresse: "Weg 1" } } });
    const r = await mod.beantrageAuftrag(fd({ vermieterId: "v1", titel: "Rinne", taetigkeit: "rinne", propId: "p1", objekt: "Dach" }));
    expect(r).toMatchObject({ ok: true });
    expect(zugriffe(db, "auftraege", "insert")[0].daten).toMatchObject({ prop_id: "p1", objekt_name: "Haus A, Weg 1 — Dach" });
    expect(zugriffe(db, "service_objekte_portal", "select")[0].filter).toEqual(expect.arrayContaining(["eq:id=p1", "eq:vermieter_id=v1"]));
  });

  it("ein NICHT zugewiesenes Objekt: kein Auftrag", async () => {
    const { db, mod } = await lade({ antworten: { service_objekte_portal: null } });
    const r = await mod.beantrageAuftrag(fd({ vermieterId: "v1", titel: "Rinne", taetigkeit: "rinne", propId: "p9" }));
    expect(r).toEqual({ error: "Dieses Objekt ist dir nicht zugewiesen." });
    expect(zugriffe(db, "auftraege", "insert")).toHaveLength(0);
  });

  it("ohne Objekt bleibt der Antrag möglich (allgemein)", async () => {
    const { db, mod } = await lade();
    await mod.beantrageAuftrag(fd({ vermieterId: "v1", titel: "Werkzeug", taetigkeit: "sonstiges", objekt: "Keller" }));
    expect(zugriffe(db, "auftraege", "insert")[0].daten).toMatchObject({ prop_id: null, objekt_name: "Keller" });
  });
});

describe("Service-Portal-Daten", () => {
  it("Ansicht beim Vermieter: Objekte nur dieses Partners, Firmen nur, wenn er Hausmeister ist", async () => {
    const { client, db } = fakeSupabase({
      antwortFolge: {
        service_zugaenge: [[{ vermieter_id: "v1", firma: "Lindner", created_at: "2026-01-01", rolle: "dienstleister" }]],
        auftraege: [[]],
        firmen: [[{ id: "f1", name: "Konkurrenz" }]],
        service_objekte: [[]],
      },
    });
    const d = await ladeServicePortalDaten(client, { art: "vermieter", vermieterId: "v1", serviceUserId: "s1" });
    expect(d.firmen).toEqual([]);
    expect(d.auftraggeber[0].rolle).toBe("dienstleister");
    const so = (db.zugriffe as Z[]).find((z) => z.tabelle === "service_objekte")!;
    expect(so.filter).toEqual(expect.arrayContaining(["eq:vermieter_id=v1", "eq:service_user_id=s1"]));
  });

  it("der Partner selbst liest Objekte NUR über die Sicht, nie `properties`", async () => {
    const { client, db } = fakeSupabase({
      antwortFolge: { service_zugaenge: [[{ vermieter_id: "v1", firma: null, created_at: "2026-01-01", rolle: "hausmeister" }]], service_objekte_portal: [[{ id: "p1", bezeichnung: "A", adresse: null, vermieter_id: "v1" }]] },
    });
    const d = await ladeServicePortalDaten(client, { art: "service", serviceUserId: "s1" });
    expect(d.objekte).toHaveLength(1);
    expect((db.zugriffe as Z[]).some((z) => z.tabelle === "properties")).toBe(false);
  });
});

describe("Oberfläche und Migration", () => {
  const portal = readFileSync("components/AuftraegePortal.tsx", "utf8");
  it("Dienstleister bekommt kein Antragsformular und kein Firmenverzeichnis", () => {
    expect(portal).toMatch(/alsHausmeister\.length > 0 \? \(\s*<AntragForm/);
    expect(portal).toMatch(/\{alsHausmeister\.length > 0 && \(\s*<div className="section">\s*<div className="section-header"><h3><Building2[^]*?Firmenverzeichnis/);
  });
  it("das Objekt wird aus den ZUGEWIESENEN gewählt, nicht frei eingetippt", () => {
    expect(portal).toMatch(/<select name="propId"/);
    expect(portal).toMatch(/objekte\.filter\(\(o\) => o\.vermieter_id === vermieterId\)/);
  });
  it("die Demo darf ihre Zuordnung LESEN — die Sperre gilt nur dem Schreiben", () => {
    const m = readFileSync("supabase/migrations/20261005102000_service_objekte_demo_lesen.sql", "utf8");
    expect(m).toMatch(/alter policy demo_gesperrt on public\.service_objekte to anon/);
    expect(m).toMatch(/demo_kein_insert[^;]*for insert/);
    expect(m).toMatch(/demo_kein_update[^;]*for update/);
  });
  it("die Migrationen enthalten kein Lösch-Schlüsselwort (Bestätigungsdialog)", () => {
    for (const f of ["20261005100000_service_objekte.sql", "20261005101000_firmen_nur_hausmeister.sql", "20261005102000_service_objekte_demo_lesen.sql"]) {
      expect(readFileSync(`supabase/migrations/${f}`, "utf8"), f).not.toMatch(/\b(delete|drop)\b/i);
    }
  });
});
