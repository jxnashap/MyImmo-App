import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { fachbetriebPflicht } from "@/lib/fachbetriebPflicht";
import { demoDarfRoute } from "@/lib/demo";

// Hausmeister & Servicepartner, Schritt 2 (05.10.2026): Verlauf mit Notizen/Fotos,
// „Fachbetrieb nötig“ (nur vorschlagen), Sperre für Gas/Strom/Trinkwasser/Schornstein.
// Datenbank-Regeln zurückgerollt bewiesen (supabase/migrations/README.md, 20261005110000).

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
const fehlerVon = (r: object) => ("error" in r ? String((r as { error: string }).error) : "");
type Z = { tabelle: string; op: string; daten?: unknown; filter: string[] };
const zugriffe = (db: { zugriffe: Z[] }, tabelle: string, op: string) => db.zugriffe.filter((z) => z.tabelle === tabelle && z.op === op);

describe("Fachbetrieb-Pflicht (Stichworte)", () => {
  it("erkennt Gas, Strom, Trinkwasser, Schornstein", () => {
    expect(fachbetriebPflicht("Gasgeruch im Keller")?.bereich).toBe("Gas");
    expect(fachbetriebPflicht("Therme zeigt Störung")?.bereich).toBe("Gas");
    expect(fachbetriebPflicht("Steckdose im Bad lose")?.bereich).toBe("Strom");
    expect(fachbetriebPflicht("Elektrik flackert")?.bereich).toBe("Strom");
    expect(fachbetriebPflicht("Trinkwasser riecht")?.bereich).toBe("Trinkwasser");
    expect(fachbetriebPflicht(null, "Schornstein zieht nicht")?.bereich).toBe("Schornstein");
  });
  it("lässt übliche Hausmeister-Arbeiten zu", () => {
    for (const t of ["Wasserhahn tropft", "Dachrinne verstopft", "Hecke schneiden", "Treppenhausbeleuchtung defekt — Leuchtmittel", "Heizkörper entlüften", "Tür klemmt, Gassenseite"]) {
      expect(fachbetriebPflicht(t), t).toBeNull();
    }
    expect(fachbetriebPflicht("", null, undefined)).toBeNull();
  });
});

describe("„Selbst erledigt“ ist bei Pflicht-Arbeiten gesperrt", () => {
  const erledigt = fd({ id: "a1", status: "erledigt", antwort: "gemacht" });

  it("Gas ohne Firma: abgelehnt, nichts gespeichert", async () => {
    const { db, mod } = await lade({ antwortFolge: { "auftraege:select": [{ titel: "Gastherme Störung", beschreibung: null, firma_id: null }] } });
    const r = await mod.beantworteAuftrag(erledigt);
    expect(r.error).toMatch(/Fachbetrieb nötig/);
    expect(zugriffe(db, "auftraege", "update")).toHaveLength(0);
  });

  it("mit freigegebener Firma am Auftrag: erledigt melden geht", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "auftraege:select": [{ titel: "Gastherme Störung", beschreibung: null, firma_id: "f1" }], "auftraege:update": [{ id: "a1" }] },
    });
    expect(await mod.beantworteAuftrag(erledigt)).toEqual({ ok: true });
    expect(zugriffe(db, "auftraege", "update")).toHaveLength(1);
  });

  it("gewöhnliche Arbeit ohne Firma: geht", async () => {
    const { mod } = await lade({
      antwortFolge: { "auftraege:select": [{ titel: "Dachrinne verstopft", beschreibung: null, firma_id: null }], "auftraege:update": [{ id: "a1" }] },
    });
    expect(await mod.beantworteAuftrag(erledigt)).toEqual({ ok: true });
  });

  it("die Prüfung liest nur eigene Aufträge", async () => {
    const { db, mod } = await lade({ antwortFolge: { "auftraege:select": [null] } });
    expect((await mod.beantworteAuftrag(erledigt)).error).toBe("Auftrag nicht gefunden.");
    expect(zugriffe(db, "auftraege", "select")[0].filter).toContain("eq:service_user_id=nutzer-1");
  });
});

describe("Notizen und Fotos", () => {
  const foto = (typ = "image/jpeg", groesse = 10) => new File([new Uint8Array(groesse)], "riss.jpg", { type: typ });

  it("Hausmeister: Rolle kommt aus dem Auftrag, Foto als Base64", async () => {
    const { db, mod } = await lade({ antworten: { auftraege: { vermieter_id: "v1", service_user_id: "nutzer-1" } } });
    expect(await mod.fuegeAuftragNotizHinzu(fd({ auftragId: "a1", text: "Riss im Putz", foto: foto() }))).toEqual({ ok: true });
    const d = zugriffe(db, "auftrag_notizen", "insert")[0].daten as Record<string, unknown>;
    expect(d).toMatchObject({ auftrag_id: "a1", vermieter_id: "v1", autor_id: "nutzer-1", autor_rolle: "service", art: "foto", datei_type: "image/jpeg", datei_size: 10 });
    expect(typeof d.datei_data).toBe("string");
  });

  it("Vermieter schreibt als Vermieter", async () => {
    const { db, mod } = await lade({ antworten: { auftraege: { vermieter_id: "nutzer-1", service_user_id: "hm" } } });
    await mod.fuegeAuftragNotizHinzu(fd({ auftragId: "a1", text: "Bitte Foto vom Zähler" }));
    expect(zugriffe(db, "auftrag_notizen", "insert")[0].daten).toMatchObject({ autor_rolle: "vermieter", art: "notiz" });
  });

  it("fremder Auftrag, falscher Dateityp, zu groß, leer: nichts gespeichert", async () => {
    const fremd = await lade({ antworten: { auftraege: { vermieter_id: "v1", service_user_id: "jemand" } } });
    expect(await fremd.mod.fuegeAuftragNotizHinzu(fd({ auftragId: "a1", text: "x" }))).toEqual({ error: "Auftrag nicht gefunden." });
    const typ = await lade({ antworten: { auftraege: { vermieter_id: "v1", service_user_id: "nutzer-1" } } });
    expect(await typ.mod.fuegeAuftragNotizHinzu(fd({ auftragId: "a1", foto: foto("text/html") }))).toEqual({ error: "Nur Fotos (JPG, PNG, WebP, HEIC)." });
    const gross = await lade({ antworten: { auftraege: { vermieter_id: "v1", service_user_id: "nutzer-1" } } });
    expect(await gross.mod.fuegeAuftragNotizHinzu(fd({ auftragId: "a1", foto: foto("image/png", 4 * 1024 * 1024 + 1) }))).toEqual({ error: "Das Foto ist größer als 4 MB." });
    const leer = await lade();
    expect(fehlerVon(await leer.mod.fuegeAuftragNotizHinzu(fd({ auftragId: "a1", text: "  " })))).toMatch(/Notiz schreiben oder ein Foto/);
    for (const x of [fremd, typ, gross, leer]) expect(zugriffe(x.db, "auftrag_notizen", "insert")).toHaveLength(0);
  });
});

describe("Fachbetrieb nötig — nur vorschlagen", () => {
  it("ruft die Datenbank-Funktion mit Firma, Schätzung und Begründung", async () => {
    const { db, mod } = await lade({ rpc: { auftrag_fachbetrieb_vorschlagen: true } });
    expect(await mod.meldeFachbetriebNoetig(fd({ auftragId: "a1", firmaId: "f1", kostenSchaetzung: "1.280", text: "Therme defekt" }))).toEqual({ ok: true });
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:auftrag_fachbetrieb_vorschlagen")).toBe(true);
    // Kein direktes Schreiben in auftraege — Status und Vorschlag setzt nur die Funktion.
    expect(zugriffe(db, "auftraege", "update")).toHaveLength(0);
  });

  it("lehnt die Datenbank ab (falscher Status/keine Rolle), sagt die App es", async () => {
    const { mod } = await lade({ rpc: { auftrag_fachbetrieb_vorschlagen: false } });
    expect(fehlerVon(await mod.meldeFachbetriebNoetig(fd({ auftragId: "a1", text: "Therme defekt" })))).toMatch(/nur als Hausmeister/);
  });

  it("ohne Begründung geht nichts hinaus", async () => {
    const { db, mod } = await lade({ rpc: { auftrag_fachbetrieb_vorschlagen: true } });
    expect(fehlerVon(await mod.meldeFachbetriebNoetig(fd({ auftragId: "a1", text: "x" })))).toMatch(/begründen/);
    expect(db.zugriffe.some((z) => z.op === "rpc")).toBe(false);
  });
});

describe("Freigabe übernimmt den Vorschlag", () => {
  it("eigene vorgeschlagene Firma wird zur Firma des Auftrags", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "auftraege:select": [{ firma_id: null, vorgeschlagene_firma_id: "f1" }], "auftraege:update": [{ id: "a1" }] },
      antworten: { firmen: { id: "f1" } },
    });
    expect(await mod.entscheideAuftrag("a1", true)).toEqual({ ok: true });
    expect(zugriffe(db, "auftraege", "update")[0].daten).toMatchObject({ status: "offen", firma_id: "f1" });
    expect(zugriffe(db, "firmen", "select")[0].filter).toContain("eq:user_id=nutzer-1");
  });

  it("eine fremde Firma als Vorschlag wird NICHT übernommen", async () => {
    const { db, mod } = await lade({
      antwortFolge: { "auftraege:select": [{ firma_id: null, vorgeschlagene_firma_id: "fremd" }], "auftraege:update": [{ id: "a1" }] },
      antworten: { firmen: null },
    });
    await mod.entscheideAuftrag("a1", true);
    expect(zugriffe(db, "auftraege", "update")[0].daten).not.toHaveProperty("firma_id");
  });
});

describe("Oberfläche, Route, Migration", () => {
  const portal = readFileSync("components/AuftraegePortal.tsx", "utf8");
  it("bei Pflicht-Arbeit kein „Selbst erledigt“-Knopf, stattdessen der Hinweis", () => {
    expect(portal).toMatch(/\{!selbstGesperrt && \(/);
    expect(portal).toMatch(/className="pflicht-hinweis"/);
  });
  it("Fotos gehen über eine Route mit dateiKopf — und die Demo darf sie ansehen", () => {
    expect(readFileSync("app/api/auftrag-foto/[id]/route.ts", "utf8")).toMatch(/dateiKopf\(/);
    expect(demoDarfRoute("/api/auftrag-foto/abc")).toBe(true);
  });
  it("die Listen laden den Verlauf OHNE Bilddaten", () => {
    expect(readFileSync("lib/auftragNotizen.ts", "utf8")).not.toMatch(/AUFTRAG_NOTIZ_SPALTEN = "[^"]*datei_data/);
  });
  it("Migration ohne Lösch-Schlüsselwort", () => {
    expect(readFileSync("supabase/migrations/20261005110000_auftrag_verlauf.sql", "utf8")).not.toMatch(/\b(delete|drop)\b/i);
  });
});

// Schritt 3 (05.10.2026): Freigabe mit [Freigeben] [Ablehnen] [Rückfrage] + Status an den Vermieter.
import { rueckfrageOffen, type AuftragNotiz } from "@/lib/auftragNotizen";
import { bauePortalNeuigkeiten } from "@/lib/portalNeuigkeiten";

describe("Rückfrage", () => {
  const n = (autor_rolle: "vermieter" | "service", rueckfrage = false, text = "x"): AuftragNotiz =>
    ({ id: Math.random().toString(), auftrag_id: "a1", autor_rolle, art: "notiz", text, datei_name: null, datei_type: null, created_at: "2026-10-05", rueckfrage });

  it("offen, bis der Hausmeister danach etwas schreibt", () => {
    expect(rueckfrageOffen([])).toBeNull();
    expect(rueckfrageOffen([n("vermieter", true, "Zweites Angebot?")])?.text).toBe("Zweites Angebot?");
    expect(rueckfrageOffen([n("vermieter", true), n("service")])).toBeNull();
    expect(rueckfrageOffen([n("service"), n("vermieter", true)])).not.toBeNull();
    expect(rueckfrageOffen([n("vermieter")])).toBeNull(); // gewöhnliche Notiz ist keine Rückfrage
  });

  it("nur zu einem Antrag in der Freigabe, nur eigene Aufträge", async () => {
    const ok = await lade({ antworten: { auftraege: { id: "a1", status: "freigabe" } } });
    expect(await ok.mod.stelleRueckfrage(fd({ auftragId: "a1", text: "Zweites Angebot?" }))).toEqual({ ok: true });
    expect(zugriffe(ok.db, "auftrag_notizen", "insert")[0].daten).toMatchObject({ autor_rolle: "vermieter", rueckfrage: true, vermieter_id: "nutzer-1" });
    expect(zugriffe(ok.db, "auftraege", "select")[0].filter).toContain("eq:vermieter_id=nutzer-1");

    const zuSpaet = await lade({ antworten: { auftraege: { id: "a1", status: "offen" } } });
    expect(fehlerVon(await zuSpaet.mod.stelleRueckfrage(fd({ auftragId: "a1", text: "Frage?" })))).toMatch(/nur, solange/);
    expect(zugriffe(zuSpaet.db, "auftrag_notizen", "insert")).toHaveLength(0);

    const fremd = await lade({ antworten: { auftraege: null } });
    expect(fehlerVon(await fremd.mod.stelleRueckfrage(fd({ auftragId: "a1", text: "Frage?" })))).toBe("Auftrag nicht gefunden.");
  });

  it("drei Knöpfe bei der Freigabe, Rückfrage sichtbar beim Hausmeister", () => {
    const sm = readFileSync("components/ServiceManager.tsx", "utf8");
    expect(sm).toMatch(/> Freigeben/);
    expect(sm).toMatch(/Ablehnen\s*<\/button>\s*<button[^>]*onClick=\{\(\) => setFrage\(""\)\}/);
    expect(readFileSync("components/AuftraegePortal.tsx", "utf8")).toMatch(/className="rueckfrage-hinweis"/);
  });
});

describe("Status an den Vermieter (Dashboard-Neuigkeiten)", () => {
  const leer = { ereignisse: [], anliegen: new Map(), zustellungen: [], angebote: [], rueckmeldungen: [], bewerbungen: [] };
  it("Fachbetrieb-Vorschlag und Fotos des Hausmeisters erscheinen", () => {
    const { liste } = bauePortalNeuigkeiten({
      ...leer,
      freigaben: [{ titel: "Therme", created_at: "2026-10-05T08:00:00Z", fachbetrieb: true }, { titel: "Rinne", created_at: "2026-10-04T08:00:00Z" }],
      hausmeister: [{ art: "foto", auftrag: "Rinne", created_at: "2026-10-05T09:00:00Z" }, { art: "notiz", auftrag: "Alt", created_at: "2026-08-01T09:00:00Z" }],
    }, "2026-10-05");
    expect(liste.map((x) => x.text)).toEqual(["Hausmeister hat ein Foto angehängt", "Hausmeister: Fachbetrieb nötig", "Hausmeister bittet um Freigabe"]);
  });
});
