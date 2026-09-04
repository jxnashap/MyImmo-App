import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/ibans.ts und lib/actions/einladung.ts.
//
// Die IBAN-Action ist die Stelle, an der Bankdaten der App anvertraut werden.
// Sie darf zwei Dinge nie tun: eine IBAN im Klartext ablegen und bei fehlendem
// Schlüssel stillschweigend etwas anderes speichern.

const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  vi.resetModules();
});
afterEach(() => {
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = KEY;
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(modul: string, init = {}) {
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, spuren, mod };
}

function schrieb(db: { zugriffe: { tabelle: string; daten?: Record<string, unknown> }[] }, tabelle: string) {
  return [...db.zugriffe].reverse().find((x) => x.tabelle === tabelle && x.daten)?.daten;
}

const IBAN = "DE89370400440532013000"; // gültige Prüfziffer

describe("IBAN speichern", () => {
  it("die IBAN wird verschlüsselt abgelegt — nie im Klartext", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans");
    const r = await mod.addIban(fd({ kontoname: "Giro", iban: IBAN, inhaber: "Max Muster" }));
    expect(r.ok).toBe(true);
    const daten = schrieb(db, "ibans")!;
    expect(daten.iban).not.toBe(IBAN);
    expect(String(daten.iban)).not.toContain("0532013000");
    // Auch der Inhaber ist personenbezogen und wird verschlüsselt.
    expect(daten.inhaber).not.toBe("Max Muster");
  });

  it("der Blind-Index ist deterministisch, der Chiffretext nicht", async () => {
    // Ohne den deterministischen Index gäbe es keine Dublettenprüfung; wäre
    // der Chiffretext ebenfalls deterministisch, verriete er Gleichheit.
    const { db, mod } = await lade("@/lib/actions/ibans");
    await mod.addIban(fd({ kontoname: "A", iban: IBAN }));
    const erste = schrieb(db, "ibans")!;
    await mod.addIban(fd({ kontoname: "B", iban: IBAN }));
    const zweite = schrieb(db, "ibans")!;
    expect(zweite.iban_bidx).toBe(erste.iban_bidx);
    expect(zweite.iban).not.toBe(erste.iban);
  });

  it("Leerzeichen und Kleinschreibung werden normalisiert", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans");
    await mod.addIban(fd({ kontoname: "A", iban: "de89 3704 0044 0532 0130 00" }));
    const a = schrieb(db, "ibans")!.iban_bidx;
    vi.resetModules();
    const zweite = await lade("@/lib/actions/ibans");
    await zweite.mod.addIban(fd({ kontoname: "A", iban: IBAN }));
    // Gleiche IBAN, andere Schreibweise → gleicher Index, sonst greift die
    // Dublettenprüfung nicht.
    expect(schrieb(zweite.db, "ibans")!.iban_bidx).toBe(a);
  });

  it("eine IBAN mit falscher Prüfziffer wird abgelehnt", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans");
    const r = await mod.addIban(fd({ kontoname: "A", iban: "DE89370400440532013001" }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Prüfziffer");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("fehlender Schlüssel: klare Meldung, kein stiller Klartext", async () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    vi.resetModules();
    const { db, mod } = await lade("@/lib/actions/ibans");
    const r = await mod.addIban(fd({ kontoname: "A", iban: IBAN }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("DATA_ENCRYPTION_KEY");
    // Der eigentliche Punkt: es wurde NICHTS gespeichert.
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("die Verschlüsselung läuft VOR dem ersten Datenbankzugriff", async () => {
    // Sonst stünde bei fehlendem Schlüssel eine halb ausgeführte Aktion da.
    delete process.env.DATA_ENCRYPTION_KEY;
    vi.resetModules();
    const { db, mod } = await lade("@/lib/actions/ibans");
    await mod.addIban(fd({ kontoname: "A", iban: IBAN }));
    expect(db.zugriffe).toEqual([]);
  });

  it("eine bereits hinterlegte IBAN wird erkannt", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans", { antworten: { ibans: { id: "vorhanden" } } });
    const r = await mod.addIban(fd({ kontoname: "A", iban: IBAN }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("bereits hinterlegt");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });

  it("das erste Konto wird automatisch Standard, ein weiteres nicht", async () => {
    const erste = await lade("@/lib/actions/ibans", { zaehler: { ibans: 0 } });
    await erste.mod.addIban(fd({ kontoname: "A", iban: IBAN }));
    expect(schrieb(erste.db, "ibans")?.standard).toBe(true);

    vi.resetModules();
    const zweite = await lade("@/lib/actions/ibans", { zaehler: { ibans: 2 } });
    await zweite.mod.addIban(fd({ kontoname: "B", iban: IBAN }));
    expect(schrieb(zweite.db, "ibans")?.standard).toBe(false);
  });

  it("ohne Kontoname oder IBAN passiert nichts", async () => {
    const { mod } = await lade("@/lib/actions/ibans");
    expect((await mod.addIban(fd({ iban: IBAN }))).ok).toBe(false);
    expect((await mod.addIban(fd({ kontoname: "A" }))).ok).toBe(false);
  });
});

describe("Standard-Konto umschalten", () => {
  it("erst alle zurücksetzen, dann das gewählte setzen", async () => {
    // Umgekehrte Reihenfolge würde den Unique-Index verletzen.
    const { db, mod } = await lade("@/lib/actions/ibans");
    await mod.setStandardIban("k2");
    const schreib = db.zugriffe.filter((z) => z.tabelle === "ibans" && z.op === "update");
    expect(schreib).toHaveLength(2);
    expect(schreib[0].daten).toEqual({ standard: false });
    expect(schreib[1].daten).toEqual({ standard: true });
    // Beide Schritte sind auf das eigene Konto eingeschränkt.
    expect(schreib[0].filter).toContain("eq:user_id=nutzer-1");
    expect(schreib[1].filter).toContain("eq:user_id=nutzer-1");
  });
});

describe("IBAN löschen: das Standard-Konto darf nicht verwaisen", () => {
  it("war das gelöschte der Standard, rückt das älteste nach", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans", {
      antwortFolge: { "ibans:select": [[{ id: "alt", standard: false }, { id: "neu", standard: false }]] },
    });
    await mod.deleteIban("weg");
    const nach = db.zugriffe.filter((z) => z.op === "update" && z.daten);
    expect(nach).toHaveLength(1);
    expect(nach[0].filter).toContain("eq:id=alt");
  });

  it("gibt es noch einen Standard, wird nichts nachgezogen", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans", {
      antwortFolge: { "ibans:select": [[{ id: "a", standard: true }, { id: "b", standard: false }]] },
    });
    await mod.deleteIban("weg");
    expect(db.zugriffe.filter((z) => z.op === "update")).toHaveLength(0);
  });
});

describe("Einladungscodes für das Mieterportal", () => {
  it("das Format ist MI-XXXX-XXXX ohne verwechselbare Zeichen", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: { id: "m1", prop_id: "p1", user_id: "nutzer-1" }, einladungscodes: { code: "MI-TEST-CODE", gueltig_bis: "2026-12-31" } },
    });
    // 40 Codes ziehen, damit ein verbotenes Zeichen auffällt.
    const codes: string[] = [];
    for (let i = 0; i < 40; i++) {
      db.zugriffe.length = 0;
      await mod.erzeugeEinladungscode("m1");
      codes.push(String(schrieb(db, "einladungscodes")?.code));
    }
    for (const c of codes) {
      expect(c).toMatch(/^MI-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
      // 0/O und 1/I/L sind auf einem ausgedruckten Zettel nicht zu unterscheiden.
      expect(c.slice(3)).not.toMatch(/[01OIL]/);
    }
    expect(new Set(codes).size).toBe(codes.length); // keine Wiederholungen
  });

  it("ein fremder Mieter wird abgelehnt", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", { antworten: { mieter: null } });
    const r = await mod.erzeugeEinladungscode("fremd");
    expect(r.error).toContain("nicht gefunden");
    expect(db.zugriffe.some((z) => z.tabelle === "einladungscodes" && z.op === "insert")).toBe(false);
  });

  it("die Mieter-Abfrage schränkt auf den angemeldeten Vermieter ein", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: { id: "m1", prop_id: "p1", user_id: "nutzer-1" }, einladungscodes: { code: "MI-TEST-CODE", gueltig_bis: "2026-12-31" } },
    });
    await mod.erzeugeEinladungscode("m1");
    const abfrage = db.zugriffe.find((z) => z.tabelle === "mieter");
    expect(abfrage?.filter).toContain("eq:user_id=nutzer-1");
  });

  it("alte, NICHT eingelöste Codes werden ersetzt — eingelöste bleiben", async () => {
    // Ein eingelöster Code hängt an einem bestehenden Mieter-Zugang. Würde er
    // mitgelöscht, verlöre der Mieter seinen Zugang bei jedem neuen Code.
    const { db, mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: { id: "m1", prop_id: "p1", user_id: "nutzer-1" }, einladungscodes: { code: "MI-TEST-CODE", gueltig_bis: "2026-12-31" } },
    });
    await mod.erzeugeEinladungscode("m1");
    const loeschung = db.zugriffe.find((z) => z.tabelle === "einladungscodes" && z.op === "delete");
    expect(loeschung?.filter).toContain("is:eingeloest_am=null");
    expect(loeschung?.filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("der Widerruf löscht ebenfalls nur nicht eingelöste Codes", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung");
    await mod.widerrufeEinladung("m1");
    const l = db.zugriffe.find((z) => z.op === "delete");
    expect(l?.filter).toContain("is:eingeloest_am=null");
    expect(l?.filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("Early Access: die Tarif-Schranke fragt die abos-Tabelle nicht ab", async () => {
    delete process.env.BILLING_ENFORCED;
    vi.resetModules();
    const { db, mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: { id: "m1", prop_id: "p1", user_id: "nutzer-1" }, einladungscodes: { code: "MI-TEST-CODE", gueltig_bis: "2026-12-31" } },
    });
    await mod.erzeugeEinladungscode("m1");
    expect(db.zugriffe.some((z) => z.tabelle === "abos")).toBe(false);
  });
});
