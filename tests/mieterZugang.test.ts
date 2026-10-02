// Mieterportal: Einladung an eine Adresse, Zugang trennen, Zustell-Sperre (02.10.2026).
// Auftrag des Betreibers: Der Vermieter darf die NK-Abrechnung nicht versehentlich an
// die falsche Person senden. Hintergrund: docs/zukunft/MIETERPORTAL-AUSBAU.md.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { pruefeEinladungsAdresse, pruefeZustellung, einladungsMail, type ZustellLage } from "@/lib/mieterZugang";

const lies = (p: string) => readFileSync(p, "utf8");

describe("Adresse doppelt eingeben", () => {
  it("normalisiert und verlangt Gleichheit", () => {
    expect(pruefeEinladungsAdresse(" Anna@Example.org ", "anna@example.org")).toEqual({ ok: true, email: "anna@example.org" });
    expect(pruefeEinladungsAdresse("anna@example.org", "anna@exmaple.org").ok).toBe(false);
    expect(pruefeEinladungsAdresse("keine-adresse", "keine-adresse").ok).toBe(false);
    expect(pruefeEinladungsAdresse("", "").ok).toBe(false);
  });
});

describe("Zustell-Prüfung", () => {
  const basis: ZustellLage = {
    verbunden: true, email: "anna@example.org", mietbeginn: "2021-03-01", mietende: null, jahr: 2025, schonZugestellt: false, heute: "2026-10-02",
  };
  it("Normalfall: frei, ohne Warnung", () => {
    expect(pruefeZustellung(basis)).toEqual({ sperre: null, warnungen: [] });
  });
  it("ohne verbundenes Konto: gesperrt — sonst hieße es „zugestellt“, und niemand sieht es", () => {
    expect(pruefeZustellung({ ...basis, verbunden: false }).sperre).toContain("kein verbundenes Portal-Konto");
  });
  it("Abrechnungsjahr außerhalb der Mietzeit: gesperrt", () => {
    expect(pruefeZustellung({ ...basis, mietbeginn: "2026-01-01" }).sperre).toContain("beginnt erst nach 2025");
    // Stichtag noch im Nachlauf, sonst greift zuerst das Zugangsende.
    expect(pruefeZustellung({ ...basis, mietende: "2024-12-31", heute: "2025-06-01" }).sperre).toContain("endete vor 2025");
    // Randtage gehören dazu.
    expect(pruefeZustellung({ ...basis, mietbeginn: "2025-12-31" }).sperre).toBeNull();
    expect(pruefeZustellung({ ...basis, mietende: "2025-01-01" }).sperre).toBeNull();
  });
  it("Warnungen: unbekannte Adresse, schon zugestellt", () => {
    expect(pruefeZustellung({ ...basis, email: null }).warnungen.join(" ")).toContain("Adresse ist unbekannt");
    expect(pruefeZustellung({ ...basis, schonZugestellt: true }).warnungen.join(" ")).toContain("bereits eine Abrechnung");
  });
});

describe("Einladungsmail", () => {
  it("enthält Link und Code, maskiert den Vermieternamen und nennt die Adress-Bindung", () => {
    const m = einladungsMail({ vermieter: "Max <Muster>", link: "https://www.myimmoapp.de/login?rolle=mieter&einladung=MI-ABCD-2345", code: "MI-ABCD-2345", gueltigBis: "2026-10-16T10:00:00Z" });
    expect(m.html).toContain("MI-ABCD-2345");
    expect(m.html).toContain("einladung=MI-ABCD-2345");
    expect(m.html).not.toContain("<Muster>");
    expect(m.html).toContain("Max &lt;Muster&gt;");
    expect(m.text).toContain("GENAU DIESER E-Mail-Adresse");
    expect(m.text).toContain("16.10.2026");
  });
});

// ---------- Actions ----------
let mails: { an: string }[] = [];
let brevoAn = true;
beforeEach(() => { vi.resetModules(); mails = []; brevoAn = true; });
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/mail/brevo", "@/lib/net/basisUrl", "@/lib/pdf/erzeugen"]) vi.doUnmock(m);
});

async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  vi.doMock("@/lib/mail/brevo", () => ({
    brevoBereit: () => brevoAn,
    sendeMail: async (m: { an: string }) => { mails.push(m); return true; },
  }));
  vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://www.myimmoapp.de" }));
  vi.doMock("@/lib/pdf/erzeugen", () => ({
    erzeugeNkPdf: async () => ({ titel: "Nebenkostenabrechnung 2025", dateiname: "nk.pdf", pdf: new Uint8Array([37, 80, 68, 70]) }),
    erzeugeBriefPdf: async () => null,
    erzeugeProtokollPdf: async () => null,
  }));
  const mod = await import(modul);
  return { db, mod };
}

const MIETER = { mieter: { id: "m1", prop_id: "p1", user_id: "nutzer-1", mietbeginn: "2021-03-01", mietende: null } };
// Funktion statt Konstante: Die Attrappe räumt die Folge ab (shift) — eine geteilte
// Liste wäre nach dem ersten Test leer.
const code = () => ({ "einladungscodes:insert": [{ code: "MI-ABCD-2345", gueltig_bis: "2026-10-16T10:00:00Z" }] });

describe("Einladung erzeugen", () => {
  it("abweichende Wiederholung: abgelehnt, bevor irgendetwas geschrieben wird", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", { antworten: MIETER });
    const r = await mod.erzeugeEinladungscode("m1", "anna@example.org", "anna@exmaple.org");
    expect(r.error).toContain("stimmen nicht überein");
    expect(db.zugriffe.filter((z) => z.op !== "select")).toEqual([]);
    expect(mails).toEqual([]);
  });

  it("der Code trägt die normalisierte Adresse, und die Mail geht an GENAU diese Adresse", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", { antworten: MIETER, antwortFolge: code() });
    const r = await mod.erzeugeEinladungscode("m1", " Anna@Example.org", "anna@example.org ");
    expect(r).toMatchObject({ code: "MI-ABCD-2345", email: "anna@example.org", gesendet: true });
    const ins = db.zugriffe.find((z) => z.tabelle === "einladungscodes" && z.op === "insert");
    expect(ins?.daten).toMatchObject({ email: "anna@example.org", mieter_id: "m1", rolle: "mieter" });
    expect(mails.map((m) => m.an)).toEqual(["anna@example.org"]);
  });

  it("ohne Mailversand: Code gebunden, aber ehrlich „nicht gesendet“", async () => {
    brevoAn = false;
    const { mod } = await lade("@/lib/actions/einladung", { antworten: MIETER, antwortFolge: code() });
    const r = await mod.erzeugeEinladungscode("m1", "anna@example.org", "anna@example.org");
    expect(r).toMatchObject({ gesendet: false, email: "anna@example.org" });
    expect(mails).toEqual([]);
  });
});

describe("Zugang trennen", () => {
  it("erst offene Codes, dann Zugänge — beide auf den eigenen Vermieter gefiltert", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", { antworten: { mieter_zugaenge: [] } });
    expect(await mod.trenneMieterZugang("m1")).toEqual({ ok: true });
    const loesch = db.zugriffe.filter((z) => z.op === "delete");
    expect(loesch.map((z) => z.tabelle)).toEqual(["einladungscodes", "mieter_zugaenge"]);
    for (const z of loesch) {
      expect(z.filter).toContain("eq:mieter_id=m1");
      expect(z.filter).toContain("eq:vermieter_id=nutzer-1");
    }
  });
  it("Fehler beim Löschen oder ein verbliebener Zugang: kein „getrennt“", async () => {
    const { mod } = await lade("@/lib/actions/einladung", { fehlerBei: { "mieter_zugaenge:delete": { message: "x" } } });
    expect((await mod.trenneMieterZugang("m1")).error).toContain("sieht weiterhin alles");
    const { mod: mod2 } = await lade("@/lib/actions/einladung", { antworten: { mieter_zugaenge: [{ user_id: "u9" }] } });
    expect((await mod2.trenneMieterZugang("m1")).error).toContain("sieht weiterhin alles");
  });
});

describe("NK zustellen: die Server-Schranke", () => {
  const notizInsert = (db: { zugriffe: { tabelle: string; op: string }[] }) =>
    db.zugriffe.find((z) => z.tabelle === "notizen" && z.op === "insert");

  it("ohne verbundenes Konto: abgelehnt, nichts gespeichert", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumente", { antworten: { ...MIETER, mieter_zugaenge: [] } });
    const r = await mod.speichereNk("m1", 2025, true);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("kein verbundenes Portal-Konto");
    expect(notizInsert(db)).toBeUndefined();
  });
  it("die Zugangs-Abfrage filtert auf den eigenen Vermieter", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumente", { antworten: { ...MIETER, mieter_zugaenge: [{ email: "anna@example.org" }] } });
    expect((await mod.speichereNk("m1", 2025, true)).ok).toBe(true);
    const z = db.zugriffe.find((x) => x.tabelle === "mieter_zugaenge");
    expect(z?.filter).toEqual(expect.arrayContaining(["eq:mieter_id=m1", "eq:vermieter_id=nutzer-1"]));
    expect((notizInsert(db) as { daten?: Record<string, unknown> }).daten?.mieter_freigabe).toBe(true);
  });
  it("Abfragefehler: nicht zustellen (fail-closed)", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumente", { antworten: MIETER, fehlerBei: { "mieter_zugaenge:select": { message: "x" } } });
    expect((await mod.speichereNk("m1", 2025, true)).ok).toBe(false);
    expect(notizInsert(db)).toBeUndefined();
  });
  it("Jahr außerhalb der Mietzeit: abgelehnt", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumente", {
      antworten: { mieter: { prop_id: "p1", mietbeginn: "2026-02-01", mietende: null }, mieter_zugaenge: [{ email: "a@b.de" }] },
    });
    expect((await mod.speichereNk("m1", 2025, true)).error).toContain("beginnt erst nach 2025");
    expect(notizInsert(db)).toBeUndefined();
  });
  it("nur speichern geht weiter auch ohne Konto", async () => {
    const { db, mod } = await lade("@/lib/actions/dokumente", { antworten: { ...MIETER, mieter_zugaenge: [] } });
    expect((await mod.speichereNk("m1", 2025, false)).ok).toBe(true);
    expect(notizInsert(db)).toBeDefined();
  });
});

describe("Datenbank und Oberfläche", () => {
  const sql = lies("supabase/migrations/20261002100000_einladung_an_email.sql");
  it("beide Einlöse-Wege prüfen die Adresse; nach der Anmeldung zusätzlich die Bestätigung", () => {
    expect(sql).toContain("and e.email = lower(btrim(new.email))");
    expect(sql).toContain("if v_mail is distinct from v_e.email or v_bestaetigt is null then");
    expect(sql).toContain("values (uid, v_e.vermieter_id, v_e.mieter_id, v_e.prop_id, v_e.email)");
  });
  it("die Migration enthält kein Löschen (die Supabase-Schranke dafür erreicht den Betreiber nicht)", () => {
    expect(sql.toLowerCase()).not.toMatch(/\bdelete\b/);
  });
  it("Wiederholungsfeld lässt kein Einfügen zu — sonst kopiert man den Tippfehler mit", () => {
    expect(lies("components/MieterEinladung.tsx")).toContain("onPaste={(e) => e.preventDefault()}");
  });
  it("Zustellen nur aus der Bestätigungskarte und nur ohne Sperre", () => {
    const k = lies("components/NkSpeichernButton.tsx");
    expect(k.match(/speichern\(true\)/g)?.length).toBe(1);
    expect(k).toContain("{!pruefung.sperre && (");
  });
});

// ---------- Zugangsende (Betreiber 02.10.2026: bis 31.12. des Folgejahres) ----------
import { zugangEndet } from "@/lib/mieterZugang";
import { belegInMietzeit } from "@/lib/portalDaten";

describe("Zugang endet nach dem Auszug", () => {
  const basis: ZustellLage = {
    verbunden: true, email: "anna@example.org", mietbeginn: "2021-03-01", mietende: "2025-04-30", jahr: 2025, schonZugestellt: false, heute: "2026-10-02",
  };
  it("31.12. des Jahres NACH dem Auszug; ohne Mietende kein Ende", () => {
    expect(zugangEndet("2025-04-30")).toBe("2026-12-31");
    expect(zugangEndet("2025-12-31")).toBe("2026-12-31");
    expect(zugangEndet(null)).toBeNull();
  });
  it("im Nachlauf darf zugestellt werden — genau dafür gibt es ihn", () => {
    expect(pruefeZustellung(basis).sperre).toBeNull();
    expect(pruefeZustellung({ ...basis, heute: "2026-12-31" }).sperre).toBeNull();
  });
  it("ab dem 1.1. des übernächsten Jahres: gesperrt", () => {
    expect(pruefeZustellung({ ...basis, heute: "2027-01-01" }).sperre).toContain("am 31.12.2026 abgelaufen");
  });
  it("Belege nur aus der eigenen Mietzeit, in ganzen Kalenderjahren", () => {
    const m = { mietbeginn: "2021-03-01", mietende: "2025-04-30" };
    expect(belegInMietzeit("2021-01-15", m)).toBe(true); // Jahresabrechnung 2021 umfasst Januar
    expect(belegInMietzeit("2020-12-31", m)).toBe(false);
    expect(belegInMietzeit("2025-11-30", m)).toBe(true);
    expect(belegInMietzeit("2026-01-01", m)).toBe(false);
    expect(belegInMietzeit("2030-01-01", { mietbeginn: "2021-03-01", mietende: null })).toBe(true);
  });
});

describe("Zugangsende in der Datenbank", () => {
  const sql = lies("supabase/migrations/20261002120000_zugang_endet.sql");
  const ohneKommentare = sql.split("\n").filter((z) => !z.trim().startsWith("--")).join("\n");
  it("eine Prüffunktion für alle sieben Regeln und beide Sichten", () => {
    expect(ohneKommentare.match(/alter policy /g)?.length).toBe(7);
    expect(ohneKommentare.match(/public\.mieter_zugang_aktiv\(/g)!.length).toBeGreaterThanOrEqual(9);
    expect(ohneKommentare).toContain("where public.mieter_zugang_aktiv(m.id);");
    expect(ohneKommentare).toContain("public.mieter_beleg_sichtbar(prop_id, buchungsdatum)");
  });
  it("Ende = 31.12. des Folgejahres, Stichtag in deutscher Zeit", () => {
    expect(ohneKommentare).toContain("make_date(extract(year from p_mietende)::int + 1, 12, 31)");
    expect(ohneKommentare).toContain("(now() at time zone 'Europe/Berlin')::date <= public.mieter_zugang_endet(m.mietende)");
  });
  it("ohne DROP und DELETE (die Supabase-Rückfrage erreicht den Betreiber nicht)", () => {
    expect(ohneKommentare.toLowerCase()).not.toMatch(/\b(drop|delete)\b/);
  });
});
