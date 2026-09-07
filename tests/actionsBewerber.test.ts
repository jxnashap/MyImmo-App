import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/bewerber.ts — die Vermieter-Seite des Bewerbungs-Systems.
//
// Hier liegen die Daten, die über die öffentliche Strecke hereinkommen:
// Gehaltsabrechnungen, SCHUFA-Auskünfte, Selbstauskünfte fremder Menschen,
// die sich nur auf eine Wohnung beworben haben. Zwei Dinge zählen deshalb
// besonders: Es darf niemand an fremde Bewerbungen kommen, und das
// DSGVO-Aufräumen muss die richtigen Zeilen treffen — nicht mehr, nicht
// weniger.

const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => {
  vi.resetModules();
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = KEY;
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init = {}) {
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/bewerber");
  return { db, mod };
}

function op(
  db: { zugriffe: { tabelle: string; op: string; daten?: unknown; filter: string[] }[] },
  tabelle: string,
  art: string,
) {
  return db.zugriffe.find((z) => z.tabelle === tabelle && z.op === art);
}

describe("Steckbrief-Zahlen: der Fund vom 07.09.2026", () => {
  /** Der gespeicherte Anzeige-Block. */
  async function anzeige(werte: Record<string, string>) {
    vi.resetModules();
    const { db, mod } = await lade();
    await mod.aktualisiereBewerberLink("l-1", fd(werte));
    return (op(db, "bewerber_links", "update")?.daten as { anzeige: Record<string, unknown> }).anzeige;
  }

  it("ein Dezimalpunkt bleibt ein Dezimalpunkt", async () => {
    // DER FEHLER: `.replace(/\./g, "")` entfernte ALLE Punkte, ohne Ansehen
    // der Stellung. Aus „1200.50" wurden 120.050 € — und die stehen öffentlich
    // im Steckbrief, den jeder Bewerber sieht. Die Felder sind Textfelder,
    // es kommt also an, was getippt wurde.
    expect((await anzeige({ kaltmiete: "1200.50" })).kaltmiete).toBe(1200.5);
    expect((await anzeige({ flaeche: "0.5" })).flaeche).toBe(0.5);
  });

  it("ein Tausenderpunkt bleibt ein Tausenderpunkt", async () => {
    expect((await anzeige({ kaution: "3.600" })).kaution).toBe(3600);
    expect((await anzeige({ kaltmiete: "1.234.567" })).kaltmiete).toBe(1234567);
  });

  it("deutsche Komma-Schreibweise funktioniert weiter", async () => {
    expect((await anzeige({ kaltmiete: "1.200,50" })).kaltmiete).toBe(1200.5);
    expect((await anzeige({ nebenkosten: "180,25" })).nebenkosten).toBe(180.25);
  });

  it("negative und unsinnig große Werte werden verworfen", async () => {
    expect((await anzeige({ kaltmiete: "-100" })).kaltmiete).toBeNull();
    expect((await anzeige({ kaltmiete: "999999999" })).kaltmiete).toBeNull();
    expect((await anzeige({ kaltmiete: "keine Zahl" })).kaltmiete).toBeNull();
  });

  it("leere Felder werden null, nicht 0", async () => {
    // 0 € Kaltmiete wäre eine Aussage; leer heißt „nicht angegeben".
    expect((await anzeige({ kaltmiete: "" })).kaltmiete).toBeNull();
  });
});

describe("Steckbrief: Weißlisten für Dokumente und Ausstattung", () => {
  it("nur bekannte Dokument-Slots werden gespeichert", async () => {
    const { DOKUMENT_SLOTS } = await import("@/lib/bewerbungsDokumente");
    const echt = DOKUMENT_SLOTS[0].slug;
    const { db, mod } = await lade();
    const f = new FormData();
    f.append("dokumente", echt);
    f.append("dokumente", "../../etc/passwd");
    f.append("dokumente", "alles");
    await mod.aktualisiereBewerberLink("l-1", f);
    expect((op(db, "bewerber_links", "update")?.daten as { dokumente_gewuenscht: string[] }).dokumente_gewuenscht)
      .toEqual([echt]);
  });

  it("nur bekannte Ausstattungsmerkmale", async () => {
    const { AUSSTATTUNG_OPTIONEN } = await import("@/lib/bewerbungsDokumente");
    const { db, mod } = await lade();
    const f = new FormData();
    f.append("ausstattung", AUSSTATTUNG_OPTIONEN[0]);
    f.append("ausstattung", "<script>alert(1)</script>");
    await mod.aktualisiereBewerberLink("l-1", f);
    const daten = op(db, "bewerber_links", "update")?.daten as { anzeige: { ausstattung: string[] } };
    expect(daten.anzeige.ausstattung).toEqual([AUSSTATTUNG_OPTIONEN[0]]);
  });

  it("Freitexte werden gekappt", async () => {
    const { db, mod } = await lade();
    await mod.aktualisiereBewerberLink(
      "l-1",
      fd({ beschreibung: "B".repeat(5000), lage: "L".repeat(3000), etage: "E".repeat(200) }),
    );
    const a = (op(db, "bewerber_links", "update")?.daten as { anzeige: Record<string, string> }).anzeige;
    expect(a.beschreibung).toHaveLength(2000);
    expect(a.lage).toHaveLength(1000);
    expect(a.etage).toHaveLength(40);
  });

  it("gespeichert wird nur der eigene Link", async () => {
    const { db, mod } = await lade();
    await mod.aktualisiereBewerberLink("l-1", fd({ kaltmiete: "900" }));
    expect(op(db, "bewerber_links", "update")?.filter).toContain("eq:user_id=nutzer-1");
  });
});

describe("Alles bleibt beim eigenen Konto", () => {
  it("jede Schreib- und Leseaktion filtert auf die eigene user_id", async () => {
    const { db, mod } = await lade({ antworten: { bewerbung_dateien: { name: "x", typ: "application/pdf", data: "d" } } });
    await mod.setzeBewerberLinkAktiv("l-1", false);
    await mod.loescheBewerberLink("l-1");
    await mod.setzeBewerbungStatus("b-1", "favorit");
    await mod.loescheBewerbung("b-1");
    await mod.ladeBewerbungDatei("d-1");
    await mod.loescheBewerbungDatei("d-1");
    await mod.loescheUnterschrift();

    // Sieben Zugriffe, jeder auf das eigene Konto eingeschränkt.
    expect(db.zugriffe).toHaveLength(7);
    for (const z of db.zugriffe) {
      expect(z.filter).toContain("eq:user_id=nutzer-1");
    }
  });

  it("ein Bewerbungs-Dokument wird nur mit passender user_id geladen", async () => {
    const { db, mod } = await lade({ antworten: { bewerbung_dateien: null } });
    const r = await mod.ladeBewerbungDatei("fremd");
    expect(r.ok).toBe(false);
    expect(r.fehler).toBe("Dokument nicht gefunden.");
    expect(op(db, "bewerbung_dateien", "select")?.filter).toContain("eq:user_id=nutzer-1");
  });

  it("beim Laden wird entschlüsselt", async () => {
    const { encrypt } = await import("@/lib/crypto/secure");
    const klar = "data:application/pdf;base64,R0VIQUxU";
    const { mod } = await lade({
      antworten: { bewerbung_dateien: { name: "gehalt.pdf", typ: "application/pdf", data: encrypt(klar) } },
    });
    const r = await mod.ladeBewerbungDatei("d-1");
    expect(r.data).toBe(klar);
  });
});

describe("DSGVO-Aufräumen: die richtigen Zeilen, nicht mehr", () => {
  it("nur ABGELEHNTE Bewerbungen, nur eigene, nur ältere als sechs Monate", async () => {
    // Jede der drei Bedingungen fehlt woanders weh: ohne `status` verschwänden
    // Favoriten, ohne `user_id` fremde Daten, ohne Datum auch die von gestern.
    const { db, mod } = await lade();
    await mod.loescheAlteAbgelehnteBewerbungen();
    const del = op(db, "bewerbungen", "delete")!;
    expect(del.filter).toContain("eq:user_id=nutzer-1");
    expect(del.filter).toContain("eq:status=abgelehnt");
    expect(del.filter.some((f) => f.startsWith("lt:created_at"))).toBe(true);
  });

  it("die Grenze liegt rund sechs Monate zurück", async () => {
    const { db, mod } = await lade();
    await mod.loescheAlteAbgelehnteBewerbungen();
    const grenze = op(db, "bewerbungen", "delete")!.filter.find((f) => f.startsWith("lt:created_at"))!.split("=")[1];
    const monate = (Date.now() - new Date(grenze).getTime()) / (1000 * 3600 * 24 * 30.44);
    expect(monate).toBeGreaterThan(5.5);
    expect(monate).toBeLessThan(6.5);
  });
});

describe("E-Signatur des Vermieters", () => {
  it("nur PNG-Data-URLs bis ~200 kB", async () => {
    const { db, mod } = await lade();
    for (const u of [
      "data:image/svg+xml;base64,PHN2Zz4=",
      "<img src=x onerror=alert(1)>",
      "https://example.com/sig.png",
      "data:image/png;base64," + "A".repeat(200001),
    ]) {
      expect((await mod.speichereUnterschrift(u)).error).toBe("Ungültige Unterschrift.");
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("eine gültige Unterschrift wird am eigenen Konto gespeichert", async () => {
    const { db, mod } = await lade();
    expect((await mod.speichereUnterschrift("data:image/png;base64,iVBORw0KGgo=")).ok).toBe(true);
    expect(op(db, "unterschriften", "upsert")?.daten).toMatchObject({ user_id: "nutzer-1" });
  });
});

describe("Bewerber-Link anlegen", () => {
  it("ohne Objekt entsteht kein Link", async () => {
    const { db, mod } = await lade();
    expect((await mod.erstelleBewerberLink(fd({ titel: "3-Zimmer" }))).error).toContain("Objekt");
    expect(db.zugriffe).toEqual([]);
  });

  it("die user_id kommt aus der Sitzung", async () => {
    const { db, mod } = await lade();
    await mod.erstelleBewerberLink(fd({ propId: "p-1", titel: "3-Zimmer", user_id: "fremd" }));
    expect(op(db, "bewerber_links", "insert")?.daten).toMatchObject({ user_id: "nutzer-1", prop_id: "p-1" });
  });
});
