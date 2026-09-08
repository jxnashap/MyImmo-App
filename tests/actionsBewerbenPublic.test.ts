import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/bewerbenPublic.ts — die EINZIGE Server-Action ohne Login.
//
// Jeder mit dem Link kann sie aufrufen. Was hier hochgeladen wird, ist
// hochsensibel: Gehaltsabrechnung, SCHUFA-Auskunft, Mietschuldenfreiheit —
// Daten fremder Dritter, für die der Vermieter verantwortlich ist.
//
// Die eigentliche Berechtigungsprüfung (Token gültig, Link aktiv, 1-Stunden-
// Fenster, 5-Dateien-Grenze) steckt in den SECURITY-DEFINER-RPCs der Datenbank.
// Hier davor liegen: IP-Bremse, Formatprüfungen, Typ-/Größengrenzen und die
// Verschlüsselung. Diese Schicht wird hier geprüft — die RPC-Seite ist mit
// diesem Prüfstand nicht erreichbar und bleibt ausdrücklich ungetestet.
//
// GEPRÜFT, KEIN BEFUND (07.09.2026): Die Bremse hängt an `x-forwarded-for`.
// Laut Vercel-Dokumentation (docs/headers/request-headers) überschreibt Vercel
// diesen Header und leitet externe Werte NICHT weiter — ausdrücklich „to
// prevent spoofing"; eine Ausnahme gibt es nur für Enterprise-Kunden mit
// Trusted Proxy. Der Wert ist hier also vertrauenswürdig, `.split(",")[0]` ist
// unbedenklich. Wer diese Zeile künftig anfasst, sollte das wissen.

const KEY = process.env.DATA_ENCRYPTION_KEY;

/** Frische IP je Test — die Zähler liegen im Modul und sollen sich nicht mischen. */
let ipZaehler = 0;
function frischeIp() {
  return `203.0.113.${++ipZaehler % 250}`;
}

function mockeHeaders(ip: string) {
  vi.doMock("next/headers", () => ({
    headers: async () => new Map([["x-forwarded-for", ip]]) as never,
  }));
}

beforeEach(() => {
  vi.resetModules();
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = KEY;
  for (const m of ["next/headers", "next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(rpcAntwort: unknown = { ok: true, id: randomUUID() }, ip = frischeIp()) {
  vi.resetModules();
  mockeHeaders(ip);
  const { db, client } = fakeSupabase({
    rpc: { bewerbung_einreichen: rpcAntwort, bewerbung_datei_anhaengen: rpcAntwort },
  });
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/bewerbenPublic");
  return { db, mod };
}

const TOKEN = "11111111-2222-3333-4444-555555555555";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function datei(bytes: number, typ = "application/pdf", name = "gehalt.pdf") {
  return new File([new Uint8Array(bytes)], name, { type: typ });
}

describe("Bewerbung einreichen", () => {
  it("eine gültige Bewerbung geht durch und liefert die ID zurück", async () => {
    const { db, mod } = await lade({ ok: true, id: "b-1" });
    const r = await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna Meyer", email: "a@b.de" }));
    expect(r).toEqual({ ok: true, bewerbungId: "b-1" });
    expect(db.zugriffe.some((z) => z.tabelle === "rpc:bewerbung_einreichen")).toBe(true);
  });

  it("ein Token in falschem Format wird abgewiesen — ohne Datenbankkontakt", async () => {
    // Spart der Datenbank die Arbeit und verrät nichts über gültige Tokens.
    const { db, mod } = await lade();
    // Nur DREI Versuche — die Bremse zählt auch Fehlversuche (eigener Test
    // weiter unten). Mit fünf liefe dieser Test in die Bremse statt in die
    // Formatprüfung; das ist beim ersten Lauf genau so passiert.
    for (const t of ["abc", "../../etc", "' or 1=1--"]) {
      const r = await mod.reicheBewerbungEin(t, fd({ name: "Anna" }));
      expect(r.fehler).toBe("Ungültiger Link.");
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("ohne Namen passiert nichts", async () => {
    const { db, mod } = await lade();
    expect((await mod.reicheBewerbungEin(TOKEN, fd({ name: "   " }))).fehler).toContain("Namen");
    expect(db.zugriffe).toEqual([]);
  });

  it("eine Unterschrift muss ein PNG-Data-URL sein", async () => {
    // Sonst ließe sich beliebiger Inhalt in ein Feld schreiben, das später als
    // Bild in ein PDF gerendert wird.
    const { db, mod } = await lade();
    for (const u of ["<script>alert(1)</script>", "data:text/html;base64,PHNjcmlwdD4=", "http://example.com/x.png"]) {
      expect((await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna", unterschrift: u }))).fehler).toBe(
        "Ungültige Unterschrift.",
      );
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("eine echte PNG-Unterschrift kommt durch", async () => {
    const { mod } = await lade();
    expect((await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna", unterschrift: PNG }))).ok).toBe(true);
  });

  it("keine Unterschrift ist erlaubt", async () => {
    const { mod } = await lade();
    expect((await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }))).ok).toBe(true);
  });

  it("die RPC entscheidet über die Gültigkeit — ein „nein“ wird durchgereicht", async () => {
    const { mod } = await lade({ ok: false, error: "Dieser Link ist abgelaufen." });
    expect(await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }))).toEqual({
      ok: false,
      fehler: "Dieser Link ist abgelaufen.",
    });
  });

  it("ein Datenbankfehler verrät keine Interna", async () => {
    mockeHeaders(frischeIp());
    const { client } = fakeSupabase({ fehler: { message: 'relation "bewerbungen" does not exist' } });
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/bewerbenPublic");
    const r = await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }));
    expect(r.ok).toBe(false);
    expect(r.fehler).not.toContain("relation");
    expect(r.fehler).toContain("später erneut");
  });
});

describe("Die IP-Bremse", () => {
  it("nach drei Bewerbungen ist Schluss", async () => {
    const ip = frischeIp();
    const { mod } = await lade({ ok: true, id: "b" }, ip);
    for (let i = 0; i < 3; i++) {
      expect((await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }))).ok).toBe(true);
    }
    const vierte = await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }));
    expect(vierte.ok).toBe(false);
    expect(vierte.fehler).toContain("Zu viele Anfragen");
  });

  it("die Bremse greift VOR der Token-Prüfung", async () => {
    // Sonst ließe sich mit ungültigen Tokens unbegrenzt weiterprobieren und die
    // Bremse wäre für genau den Fall wirkungslos, für den sie da ist.
    const ip = frischeIp();
    const { mod } = await lade({ ok: true, id: "b" }, ip);
    for (let i = 0; i < 3; i++) await mod.reicheBewerbungEin("kaputt", fd({ name: "Anna" }));
    expect((await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }))).fehler).toContain("Zu viele Anfragen");
  });

  it("Uploads haben einen EIGENEN, großzügigeren Zähler", async () => {
    // 12 Dateien je Bewerbung × 3 Bewerbungen — mit dem 3er-Limit wäre nach der
    // ersten Datei Schluss gewesen.
    const ip = frischeIp();
    const { mod } = await lade({ ok: true }, ip);
    await mod.reicheBewerbungEin(TOKEN, fd({ name: "Anna" }));
    for (let i = 0; i < 10; i++) {
      const r = await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(100) }));
      expect(r.ok).toBe(true);
    }
  });

  it("auch der Upload-Zähler endet irgendwo", async () => {
    const ip = frischeIp();
    const { mod } = await lade({ ok: true }, ip);
    for (let i = 0; i < 40; i++) await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(10) }));
    const r = await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(10) }));
    expect(r.fehler).toContain("Zu viele Uploads");
  });
});

describe("Dokumente anhängen", () => {
  it("beide IDs müssen das richtige Format haben", async () => {
    const { db, mod } = await lade();
    expect((await mod.haengeBewerbungDateiAn("kaputt", TOKEN, fd({ datei: datei(10) }))).fehler).toBe(
      "Ungültiger Link.",
    );
    expect((await mod.haengeBewerbungDateiAn(TOKEN, "kaputt", fd({ datei: datei(10) }))).fehler).toBe(
      "Ungültiger Link.",
    );
    expect(db.zugriffe).toEqual([]);
  });

  it("nur PDF, JPG, PNG und WebP", async () => {
    const { db, mod } = await lade();
    for (const typ of ["application/x-msdownload", "text/html", "image/svg+xml", "application/zip", ""]) {
      const r = await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(10, typ, "x") }));
      expect(r.fehler).toContain("Nur PDF-");
    }
    expect(db.zugriffe).toEqual([]);
  });

  it("SVG ist bewusst NICHT erlaubt", async () => {
    // SVG kann Skript enthalten; als Bild ausgeliefert wäre das ein XSS-Weg
    // im Vermieter-Konto, das die Datei später ansieht.
    const { mod } = await lade();
    expect((await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(10, "image/svg+xml") }))).ok).toBe(false);
  });

  it("über 6 MB wird abgelehnt", async () => {
    const { db, mod } = await lade();
    const r = await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(6 * 1024 * 1024 + 1) }));
    expect(r.fehler).toContain("größer als 6 MB");
    expect(db.zugriffe).toEqual([]);
  });

  it("eine leere Datei wird abgelehnt", async () => {
    const { mod } = await lade();
    expect((await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(0) }))).fehler).toContain(
      "Keine Datei",
    );
  });

  it("ein unbekannter Dokument-Slot wird zu „sonstiges“, nicht durchgereicht", async () => {
    // ACHTUNG, hier stand zuerst ein wertloser Test: Er prüfte nur, DASS die
    // RPC aufgerufen wird — nicht, WOMIT. Die Mutation „Weißliste entfernt"
    // blieb dadurch grün. Jetzt wird der übergebene Wert geprüft.
    mockeHeaders(frischeIp());
    const { client } = fakeSupabase();
    const gesehen: string[] = [];
    client.rpc = async (_n: string, args?: unknown) => {
      gesehen.push((args as { p: { slot: string } }).p.slot);
      return { data: { ok: true }, error: null };
    };
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/bewerbenPublic");
    for (const boese of ["../../root", "'; drop table--", "GEHALT", "", "eigener_slot"]) {
      await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(10), slot: boese }));
    }
    expect(gesehen).toEqual(["sonstiges", "sonstiges", "sonstiges", "sonstiges", "sonstiges"]);
  });

  it("bekannte Slots bleiben erhalten", async () => {
    // Wird über die aufgezeichneten RPC-Argumente geprüft — dafür fängt der
    // Test den Aufruf selbst ab.
    mockeHeaders(frischeIp());
    const { client } = fakeSupabase();
    const gesehen: unknown[] = [];
    client.rpc = async (_n: string, args?: unknown) => {
      gesehen.push(args);
      return { data: { ok: true }, error: null };
    };
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/bewerbenPublic");
    for (const slot of ["gehalt", "schufa", "wbs", "buergschaft"]) {
      await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: datei(10), slot }));
    }
    expect(gesehen.map((a) => (a as { p: { slot: string } }).p.slot)).toEqual([
      "gehalt",
      "schufa",
      "wbs",
      "buergschaft",
    ]);
  });
});

describe("Verschlüsselung der Nachweise", () => {
  async function hochgeladenesFeld(mitSchluessel: boolean) {
    if (mitSchluessel) process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    else delete process.env.DATA_ENCRYPTION_KEY;
    vi.resetModules();
    mockeHeaders(frischeIp());
    const { client } = fakeSupabase();
    let gesehen: { p: { data: string } } | null = null;
    client.rpc = async (_n: string, args?: unknown) => {
      gesehen = args as { p: { data: string } };
      return { data: { ok: true }, error: null };
    };
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/bewerbenPublic");
    const inhalt = new File([Buffer.from("NETTOGEHALT 3200 EUR")], "g.pdf", { type: "application/pdf" });
    await mod.haengeBewerbungDateiAn(TOKEN, TOKEN, fd({ datei: inhalt }));
    return gesehen!.p.data;
  }

  it("mit Schlüssel liegt der Nachweis NICHT als lesbares base64 vor", async () => {
    const gespeichert = await hochgeladenesFeld(true);
    expect(gespeichert).not.toContain("data:application/pdf;base64,");
    expect(gespeichert).not.toContain(Buffer.from("NETTOGEHALT 3200 EUR").toString("base64"));
  });

  it("ohne Schlüssel bleibt es Klartext — bewusster Rückfall für die Entwicklung", async () => {
    // Kein Versehen: `decrypt()` liest beides. Der Test hält fest, dass das
    // eine Entscheidung ist — und macht sichtbar, was passiert, wenn die
    // Env in Produktion fehlt.
    const gespeichert = await hochgeladenesFeld(false);
    expect(gespeichert).toContain("data:application/pdf;base64,");
  });
});
