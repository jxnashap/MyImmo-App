import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { speicherDb, type SpeicherDbInit } from "./stubs/speicherDb";

// Ablauf F (Prüfstand 11.10.2026, Phase 5): dauerhafte Auftragsverwaltung für Schritte nach außen.
//
// Vorher-Zustand (belegt am Code vor diesem Paket):
//   · Hinweis-Mails gingen direkt an Brevo. Ein Fehlschlag war endgültig (kein Zustand, kein Grund, kein
//     zweiter Versuch); die 10-Minuten-Bremse zählte den Fehlschlag mit und meldete beim Wiederholen „gebremst“.
//   · „Speichern & zustellen“ zweimal (Zeitüberlauf, Doppelklick) → zwei Schreiben im Archiv, zwei
//     Zustellungen im Portal, zwei Hinweis-Mails.
//   · Auftrag an Partner bzw. Antrag des Hausmeisters zweimal abgeschickt → zwei Aufträge.
// Externe Dienste sind in diesen Tests SIMULIERT (Brevo-Attrappe zählt Sendungen) — nichts geht hinaus.

const U = "11111111-1111-4111-8111-111111111111"; // Empfänger
const V = "22222222-2222-4222-8222-222222222222"; // Vermieter (Auslöser)
const START = new Date("2026-10-11T10:00:00Z");

type Zeile = Record<string, unknown>;
/** Dieselbe Bedingung wie `aussen_auftrag_beanspruchen()` in der Migration — gegen die Tabelle der Attrappe. */
function beanspruchen(args: Record<string, unknown>, t: Record<string, Zeile[]>) {
  const jetzt = Date.now();
  const z = (t.aussen_auftraege ?? []).find((r) => r.id === args.p_id);
  const ok = z && Number(z.versuche) < Number(z.max_versuche) && Date.parse(String(z.naechster_versuch)) <= jetzt
    && (["offen", "fehler"].includes(String(z.status)) || (z.status === "in_arbeit" && Date.parse(String(z.letzter_versuch)) < jetzt - 5 * 60_000));
  if (!ok) return { data: [], error: null };
  Object.assign(z!, { status: "in_arbeit", versuche: Number(z!.versuche) + 1, letzter_versuch: new Date(jetzt).toISOString(), fehler: null });
  return { data: [{ ...z }], error: null };
}

const EINDEUTIG: SpeicherDbInit["eindeutig"] = {
  aussen_auftraege: [["user_id", "schluessel"]],
  notizen: [{ spalten: ["user_id", "vorgang"], wo: (r) => r.vorgang != null }],
  zustellungen: [{ spalten: ["notiz_id", "empfaenger_user_id"], wo: (r) => !r.zurueckgezogen_am && r.notiz_id != null }],
  auftraege: [{ spalten: ["vermieter_id", "vorgang"], wo: (r) => r.vorgang != null }],
};
const VORGABEN: SpeicherDbInit["vorgaben"] = {
  aussen_auftraege: () => ({ status: "offen", versuche: 0, max_versuche: 3, naechster_versuch: new Date(Date.now()).toISOString(), created_at: new Date(Date.now()).toISOString(), letzter_versuch: null, fehler: null, ergebnis: null }),
};

const MODULE = ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/mail/brevo", "@/lib/net/basisUrl", "@/lib/pdf/erzeugen"];
beforeEach(() => { vi.resetModules(); vi.useFakeTimers({ toFake: ["Date"], now: START }); });
afterEach(() => { vi.useRealTimers(); for (const m of MODULE) vi.doUnmock(m); });

/** Benachrichtigung mit Attrappen: Brevo zählt, das Konto liefert eine Adresse. */
async function ladeHinweis(o: { senden?: () => boolean; tabellen?: Record<string, Zeile[]>; fehlerBei?: Record<string, string>; user?: Record<string, unknown> } = {}) {
  vi.resetModules();
  const db = speicherDb({ tabellen: { aussen_auftraege: [], ...o.tabellen }, eindeutig: EINDEUTIG, vorgaben: VORGABEN, rpc: { aussen_auftrag_beanspruchen: beanspruchen }, fehlerBei: o.fehlerBei });
  const admin = Object.assign(db.client, { auth: { ...(db.client as { auth: object }).auth, admin: { getUserById: async () => ({ data: { user: o.user ?? { email: "anna@example.org", user_metadata: {} } }, error: null }) } } });
  const gesendet: string[] = [];
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
  vi.doMock("@/lib/mail/brevo", () => ({ brevoBereit: () => true, sendeMail: async (m: { an: string }) => { const ok = o.senden ? o.senden() : true; if (ok) gesendet.push(m.an); return ok; } }));
  vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://www.myimmoapp.de" }));
  const mod = await import("@/lib/benachrichtigung");
  const zeile = () => db.tabellen.aussen_auftraege[0] as Zeile | undefined;
  return { mod, db, admin, gesendet, zeile };
}
const minuten = (n: number) => vi.setSystemTime(new Date(Date.now() + n * 60_000));

// ------------------------------------------------------------------------------------------------
describe("Regeln (rein)", () => {
  it("Schlüssel: einmalige Anlässe je Bezug, wiederkehrende je 10-Minuten-Fenster", async () => {
    const { hinweisSchluessel } = await import("@/lib/benachrichtigung");
    const t = START.getTime();
    expect(hinweisSchluessel("dokument", "n1", t)).toBe("hinweis:dokument:n1");
    expect(hinweisSchluessel("dokument", "n1", t + 86_400_000)).toBe("hinweis:dokument:n1"); // ein Tag später: derselbe Anlass
    const a = hinweisSchluessel("nachricht_an_mieter", "a1", t);
    expect(hinweisSchluessel("nachricht_an_mieter", "a1", t + 60_000)).toBe(a);
    expect(hinweisSchluessel("nachricht_an_mieter", "a1", t + 11 * 60_000)).not.toBe(a);
  });
  it("Wartezeit 10 min, dann 60 min; aufgegeben nach dem letzten Versuch oder bei endgültigem Fehler", async () => {
    const { naechsterVersuch, standNachFehler } = await import("@/lib/aussenAuftrag");
    const t = START.getTime();
    expect(naechsterVersuch(1, t)).toBe(new Date(t + 10 * 60_000).toISOString());
    expect(naechsterVersuch(2, t)).toBe(new Date(t + 60 * 60_000).toISOString());
    expect(naechsterVersuch(3, t)).toBe(new Date(t + 60 * 60_000).toISOString());
    expect(standNachFehler(1, 3)).toBe("fehler");
    expect(standNachFehler(3, 3)).toBe("aufgegeben");
    expect(standNachFehler(1, 3, true)).toBe("aufgegeben");
  });
  it("Text für die Oberfläche: vorgemerkt sagt, dass wiederholt wird; schon versandt sagt „keine zweite“", async () => {
    const { hinweisMailText } = await import("@/lib/zugang");
    expect(hinweisMailText(["vorgemerkt"])).toMatch(/versucht es erneut/);
    expect(hinweisMailText(["gebremst"])).toMatch(/keine zweite/);
    expect(hinweisMailText(["gesendet"])).toBeNull();
  });
});

describe("Hinweis-Mail als dauerhafter Auftrag", () => {
  it("erster Aufruf: vorgemerkt, beansprucht, versandt, ERST DANN erledigt — mit Zeitpunkt und Ergebnis", async () => {
    const { mod, gesendet, zeile } = await ladeHinweis();
    expect(await mod.benachrichtige(U, "dokument", "n1", V)).toBe("gesendet");
    expect(gesendet).toEqual(["anna@example.org"]);
    expect(zeile()).toMatchObject({ user_id: U, ausgeloest_von: V, schluessel: "hinweis:dokument:n1", status: "erledigt", versuche: 1, ergebnis: "gesendet", nutzlast: { art: "dokument", bezug: "n1" } });
    expect(zeile()!.erledigt_am).toBeTruthy();
  });
  it("derselbe Anlass noch einmal (Zeitüberlauf, Neustart, Tage später): keine zweite Mail", async () => {
    const { mod, gesendet } = await ladeHinweis();
    await mod.benachrichtige(U, "dokument", "n1");
    minuten(60 * 24);
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("gebremst");
    expect(gesendet).toHaveLength(1);
  });
  it("zwei gleichzeitige Aufrufe: eine Mail", async () => {
    const { mod, gesendet, db } = await ladeHinweis();
    const r = await Promise.all([mod.benachrichtige(U, "dokument", "n1"), mod.benachrichtige(U, "dokument", "n1")]);
    expect(gesendet).toHaveLength(1);
    expect(db.tabellen.aussen_auftraege).toHaveLength(1);
    expect(r.sort()).toEqual(["gesendet", "vorgemerkt"]); // der zweite sieht den laufenden Versand
  });
  it("Versand scheitert → Fehlergrund, letzter Versuch, nächster Versuch; kein Versand vor der Zeit; danach wiederholt", async () => {
    let klappt = false;
    const { mod, gesendet, zeile } = await ladeHinweis({ senden: () => klappt });
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("vorgemerkt");
    expect(zeile()).toMatchObject({ status: "fehler", versuche: 1, fehler: "Versand beim Mailanbieter fehlgeschlagen", naechster_versuch: new Date(START.getTime() + 10 * 60_000).toISOString() });
    expect(zeile()!.letzter_versuch).toBe(START.toISOString());
    klappt = true;
    minuten(5);
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("vorgemerkt"); // noch nicht fällig
    expect(gesendet).toEqual([]);
    minuten(6);
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("gesendet");
    expect(zeile()).toMatchObject({ status: "erledigt", versuche: 2 });
  });
  it("drei Fehlschläge → aufgegeben, kein vierter Versuch", async () => {
    const { mod, gesendet, zeile } = await ladeHinweis({ senden: () => false });
    await mod.benachrichtige(U, "dokument", "n1");
    minuten(11); await mod.benachrichtige(U, "dokument", "n1");
    minuten(61); expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("fehler");
    expect(zeile()).toMatchObject({ status: "aufgegeben", versuche: 3 });
    minuten(120); expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("fehler");
    expect(zeile()!.versuche).toBe(3);
    expect(gesendet).toEqual([]);
  });
  it("abbestellt / Demo: erledigt mit diesem Ergebnis — kein Versand, auch nicht später", async () => {
    const { mod, gesendet, zeile } = await ladeHinweis({ user: { email: "anna@example.org", user_metadata: { benachrichtigungen_aus: true } } });
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("abbestellt");
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("abbestellt");
    expect(zeile()).toMatchObject({ status: "erledigt", ergebnis: "abbestellt" });
    expect(gesendet).toEqual([]);
  });
  it("Auftrag lässt sich nicht vormerken (Tabelle fehlt) → KEIN Versand ohne Spur", async () => {
    const { mod, gesendet } = await ladeHinweis({ fehlerBei: { "aussen_auftraege:upsert": "relation does not exist" } });
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("fehler");
    expect(gesendet).toEqual([]);
  });
  it("VERBLEIBENDES RISIKO, festgehalten: versandt, aber „erledigt“ nicht gespeichert → nach 5 min ein zweiter Versand", async () => {
    const { mod, gesendet, zeile } = await ladeHinweis({ fehlerBei: { "aussen_auftraege:update": "Verbindung weg" } });
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("gesendet");
    expect(zeile()).toMatchObject({ status: "in_arbeit" }); // nichts gilt als erledigt, was nicht gespeichert ist
    minuten(2);
    expect(await mod.benachrichtige(U, "dokument", "n1")).toBe("vorgemerkt"); // läuft noch — kein zweiter Versand
    minuten(4);
    await mod.benachrichtige(U, "dokument", "n1");
    expect(gesendet).toHaveLength(2); // das ist das benannte Zustellrisiko — kein „genau einmal“
  });
});

describe("fuehreAus(): Stand genau benannt", () => {
  it("Lauf gelungen, „erledigt“ nicht speicherbar → Stand „nicht_gespeichert“ (nicht „erledigt“)", async () => {
    const { admin } = await ladeHinweis({ fehlerBei: { "aussen_auftraege:update": "Verbindung weg" } });
    const { fuehreAus } = await import("@/lib/aussenAuftrag");
    const r = await fuehreAus(admin as never, { userId: U, schluessel: "x:1", art: "hinweis_mail", nutzlast: {} }, async () => ({ ok: true, ergebnis: "gesendet" }));
    expect(r).toMatchObject({ stand: "nicht_gespeichert", ergebnis: "gesendet" });
  });
  it("Ausnahme im Lauf → Fehler mit Grund, kein Absturz", async () => {
    const { admin, zeile } = await ladeHinweis();
    const { fuehreAus } = await import("@/lib/aussenAuftrag");
    const r = await fuehreAus(admin as never, { userId: U, schluessel: "x:2", art: "hinweis_mail", nutzlast: {} }, async () => { throw new Error("Netz weg"); });
    expect(r).toMatchObject({ stand: "wartet", grund: "Netz weg" });
    expect(zeile()).toMatchObject({ status: "fehler", fehler: "Netz weg" });
  });
});

describe("Wiederholung per Cron", () => {
  it("fällige Fehler werden versandt, zu alte aufgegeben, laufende und nicht fällige nicht angefasst", async () => {
    const z = (id: string, x: Zeile): Zeile => ({ id, user_id: U, schluessel: `k-${id}`, art: "hinweis_mail", nutzlast: { art: "dokument", bezug: id }, status: "fehler", versuche: 1, max_versuche: 3, letzter_versuch: START.toISOString(), naechster_versuch: START.toISOString(), fehler: "x", ergebnis: null, created_at: START.toISOString(), ...x });
    const { admin, gesendet, db } = await ladeHinweis({ tabellen: { aussen_auftraege: [
      z("faellig", {}),
      z("spaeter", { naechster_versuch: new Date(START.getTime() + 3_600_000).toISOString() }),
      z("alt", { created_at: new Date(START.getTime() - 25 * 3_600_000).toISOString() }),
      z("laeuft", { status: "in_arbeit", letzter_versuch: START.toISOString() }),
      z("erledigt", { status: "erledigt" }),
      z("uralt", { status: "erledigt", created_at: new Date(START.getTime() - 91 * 86_400_000).toISOString() }),
      z("uralt-offen", { status: "fehler", versuche: 3, created_at: new Date(START.getTime() - 91 * 86_400_000).toISOString(), naechster_versuch: new Date(START.getTime() + 3_600_000).toISOString() }),
    ] } });
    minuten(1);
    const { wiederholeFaellige } = await import("@/lib/aussenAuftrag");
    const { sendeHinweis } = await import("@/lib/benachrichtigung");
    const r = await wiederholeFaellige(admin as never, (zz) => () => sendeHinweis(admin as never, String(zz.user_id), "dokument"));
    expect(r).toMatchObject({ erledigt: 1, veraltet: 2, geloescht: 1 });
    expect(gesendet).toHaveLength(1);
    const st = Object.fromEntries((db.tabellen.aussen_auftraege as Zeile[]).map((x) => [x.id, x.status]));
    // Nach 90 Tagen ist ein abgeschlossener Eintrag weg; ein offener wird erst aufgegeben (nächster Lauf löscht ihn).
    expect(st).toEqual({ faellig: "erledigt", spaeter: "fehler", alt: "aufgegeben", laeuft: "in_arbeit", erledigt: "erledigt", "uralt-offen": "aufgegeben" });
  });
  it("Route: ohne CRON_SECRET aus (503), falsches Geheimnis 401, ohne Mailversand nichts beansprucht", async () => {
    vi.resetModules();
    const alt = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      let { GET } = await import("@/app/api/cron/aussen-auftraege/route");
      expect((await GET(new Request("https://x/api/cron/aussen-auftraege"))).status).toBe(503);
      process.env.CRON_SECRET = "geheim";
      vi.resetModules();
      vi.doMock("@/lib/mail/brevo", () => ({ brevoBereit: () => false, sendeMail: async () => { throw new Error("darf nicht"); } }));
      ({ GET } = await import("@/app/api/cron/aussen-auftraege/route"));
      expect((await GET(new Request("https://x/api/cron/aussen-auftraege", { headers: { authorization: "Bearer falsch" } }))).status).toBe(401);
      const ok = await GET(new Request("https://x/api/cron/aussen-auftraege", { headers: { authorization: "Bearer geheim" } }));
      expect(await ok.json()).toEqual({ ok: true, uebersprungen: "Mailversand nicht eingerichtet" });
    } finally {
      if (alt === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = alt;
    }
  });
});

// ------------------------------------------------------------------------------------------------
describe("Zweites Absenden legt nichts doppelt an", () => {
  const VG = "abababab-abab-4bab-8bab-abababababab";
  const VG2 = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
  async function ladeDok(tabellen: Record<string, Zeile[]> = {}) {
    vi.resetModules();
    const db = speicherDb({ nutzer: { id: V }, eindeutig: EINDEUTIG, tabellen: { mieter: [{ id: "m1", user_id: V, prop_id: "p1" }], notizen: [], zustellungen: [], ...tabellen } });
    mockeNextUndSupabase(db.client);
    vi.doMock("@/lib/pdf/erzeugen", () => ({ erzeugeBriefPdf: async () => ({ titel: "Mahnung – Anna", dateiname: "m.pdf", pdf: new Uint8Array([37, 80, 68, 70]) }) }));
    const mod = await import("@/lib/actions/dokumente");
    return { db, mod };
  }
  it("„Im Archiv ablegen“ zweimal mit derselben Kennung → ein Schreiben; neue Kennung → neues Schreiben", async () => {
    const { db, mod } = await ladeDok();
    expect(await mod.speichereBrief("m1", {} as never, {}, VG)).toEqual({ ok: true });
    expect(await mod.speichereBrief("m1", {} as never, {}, VG)).toEqual({ ok: true, wiederholt: true });
    expect(db.tabellen.notizen).toHaveLength(1);
    await mod.speichereBrief("m1", {} as never, {}, VG2);
    expect(db.tabellen.notizen).toHaveLength(2);
  });
  it("gleichzeitig zweimal (Doppelklick) → ein Schreiben", async () => {
    const { db, mod } = await ladeDok();
    const r = await Promise.all([mod.speichereBrief("m1", {} as never, {}, VG), mod.speichereBrief("m1", {} as never, {}, VG)]);
    expect(r.every((x) => x.ok)).toBe(true);
    expect(db.tabellen.notizen).toHaveLength(1);
  });
  it("ohne Kennung (alter Aufruf) wie bisher; eine ungültige Kennung wird nicht gespeichert", async () => {
    const { db, mod } = await ladeDok();
    await mod.speichereBrief("m1", {} as never);
    await mod.speichereBrief("m1", {} as never, {}, "1' or '1'='1");
    expect(db.tabellen.notizen).toHaveLength(2);
    expect(db.tabellen.notizen.every((n) => n.vorgang === undefined)).toBe(true);
  });

  it("Zustellung: wer sie schon hat, bekommt keine zweite — auch nicht gleichzeitig", async () => {
    vi.resetModules();
    const db = speicherDb({ nutzer: { id: V }, eindeutig: EINDEUTIG, tabellen: { zustellungen: [] } });
    const hinweise: string[] = [];
    vi.doMock("@/lib/benachrichtigung", () => ({ benachrichtige: async (u: string) => { hinweise.push(u); return "gebremst"; } }));
    const { zustelle } = await import("@/lib/zustellung");
    const opts = { userId: V, mieterId: "m1", notizId: "n1", titel: "Mahnung", empfaenger: [{ userId: U, email: "anna@example.org" }] };
    const r = await Promise.all([zustelle(db.client as never, opts), zustelle(db.client as never, opts)]);
    expect(r.every((x) => x.ok)).toBe(true);
    expect(db.tabellen.zustellungen).toHaveLength(1);
    expect((await zustelle(db.client as never, opts)).ok).toBe(true);
    expect(db.tabellen.zustellungen).toHaveLength(1);
    vi.doUnmock("@/lib/benachrichtigung");
  });
  it("Zustellung an zwei: einer hat sie schon → nur der andere bekommt eine neue Zeile", async () => {
    vi.resetModules();
    const W = "33333333-3333-4333-8333-333333333333";
    const db = speicherDb({ nutzer: { id: V }, eindeutig: EINDEUTIG, tabellen: { zustellungen: [{ id: "z0", notiz_id: "n1", empfaenger_user_id: U, zurueckgezogen_am: null }] } });
    vi.doMock("@/lib/benachrichtigung", () => ({ benachrichtige: async () => "gesendet" }));
    const { zustelle } = await import("@/lib/zustellung");
    const r = await zustelle(db.client as never, { userId: V, mieterId: "m1", notizId: "n1", titel: "M", empfaenger: [{ userId: U, email: null }, { userId: W, email: null }] });
    expect(r.ok).toBe(true);
    expect(db.tabellen.zustellungen.map((z) => z.empfaenger_user_id).sort()).toEqual([U, W].sort());
    vi.doUnmock("@/lib/benachrichtigung");
  });
  it("Zustellung: eine echte Störung bleibt ein Fehler (kein „schon da“ erfunden)", async () => {
    vi.resetModules();
    const db = speicherDb({ nutzer: { id: V }, eindeutig: EINDEUTIG, tabellen: { zustellungen: [] }, fehlerBei: { "zustellungen:insert": "timeout" } });
    vi.doMock("@/lib/benachrichtigung", () => ({ benachrichtige: async () => "gesendet" }));
    const { zustelle } = await import("@/lib/zustellung");
    const r = await zustelle(db.client as never, { userId: V, mieterId: "m1", notizId: "n1", titel: "M", empfaenger: [{ userId: U, email: null }] });
    expect(r).toMatchObject({ ok: false });
    vi.doUnmock("@/lib/benachrichtigung");
  });

  it("Auftrag an den Partner zweimal mit derselben Kennung → ein Auftrag, beide Male „ok“", async () => {
    vi.resetModules();
    const db = speicherDb({ nutzer: { id: V }, eindeutig: EINDEUTIG, tabellen: {
      auftraege: [], service_zugaenge: [{ vermieter_id: V, user_id: U, rolle: "hausmeister" }], properties: [], vermieter_profil: [], mieter: [],
    } });
    mockeNextUndSupabase(db.client);
    const mod = await import("@/lib/actions/service");
    const { TAETIGKEIT_KEYS } = await import("@/lib/taetigkeiten");
    const T = TAETIGKEIT_KEYS[0];
    const form = () => fd({ serviceUserId: U, titel: "Dachrinne reinigen", taetigkeit: T, vorgang: VG });
    expect(await mod.erstelleAuftrag(form())).toEqual({ ok: true });
    expect(await mod.erstelleAuftrag(form())).toEqual({ ok: true });
    expect(db.tabellen.auftraege).toHaveLength(1);
    expect(await mod.erstelleAuftrag(fd({ serviceUserId: U, titel: "Dachrinne reinigen", taetigkeit: T, vorgang: VG2 }))).toEqual({ ok: true });
    expect(db.tabellen.auftraege).toHaveLength(2);
  });
});
