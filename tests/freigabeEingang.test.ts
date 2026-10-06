import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { erkenneEingangTyp, bereinigeDateiname, hochladeMeldung, eingangOrt } from "@/lib/freigabeEingang";
import { bauePortalNeuigkeiten } from "@/lib/portalNeuigkeiten";

// Rücklauf über Bank-/Makler-Link (06.10.2026, Migration 20261006090000). Zum ersten Mal legen
// Fremde ohne Konto Dateien in ein Konto. Deshalb: nur nach dem Zugangscode (Hash aus dem
// httpOnly-Cookie), Typ aus dem Dateikopf statt aus Name/Browser, Ablage im EINGANG statt im
// Archiv, und die Datenbank prüft alles ein zweites Mal.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

const T = "11111111-2222-3333-4444-555555555555";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe("Dateityp aus dem Dateikopf", () => {
  it("erkennt PDF, JPEG, PNG, WebP", () => {
    expect(erkenneEingangTyp(PDF)).toBe("application/pdf");
    expect(erkenneEingangTyp(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(erkenneEingangTyp(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(erkenneEingangTyp(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("lehnt umbenannte HTML-Datei, leere Datei und andere RIFF-Formate ab", () => {
    expect(erkenneEingangTyp(HTML)).toBeNull();
    expect(erkenneEingangTyp(new Uint8Array([]))).toBeNull();
    expect(erkenneEingangTyp(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // WAVE
  });
  it("Dateiname ohne Pfad und Steuerzeichen", () => {
    expect(bereinigeDateiname("C:\\Users\\x\\vertrag.pdf")).toBe("vertrag.pdf");
    expect(bereinigeDateiname("../../etc/a\u0000b.pdf")).toBe("ab.pdf");
    expect(bereinigeDateiname("")).toBe("Dokument");
  });
  it("Meldungen und Sprungziele", () => {
    expect(hochladeMeldung("ok")).toBeNull();
    expect(hochladeMeldung("limit")).toMatch(/viele Dateien/);
    expect(hochladeMeldung(null)).toMatch(/abgelaufen/);
    expect(eingangOrt("bank", "p1")).toBe("/properties/p1/beleihung#eingang");
    expect(eingangOrt("makler", null)).toBe("/makler#eingang");
  });
});

describe("schickeDateiZurueck (öffentlich)", () => {
  async function lade(art: "bank" | "makler", rpcAntwort: unknown, cookie?: { name: string; wert: string }) {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      cookies: async () => ({ get: (n: string) => (cookie && n === cookie.name ? { value: cookie.wert } : undefined) }),
    }));
    const { db, client } = fakeSupabase({ rpc: { freigabe_public_hochladen: rpcAntwort } });
    const args: Record<string, unknown>[] = [];
    const rpc = client.rpc;
    client.rpc = async (name: string, a?: unknown) => { args.push(a as Record<string, unknown>); return rpc(name, a); };
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/freigabeEingangPublic");
    return { db, mod, args, art };
  }
  const formular = (bytes: Uint8Array, name: string, typ: string) => {
    const f = new FormData();
    f.set("datei", new File([bytes as Uint8Array<ArrayBuffer>], name, { type: typ }));
    f.set("absender", "Frau Berg");
    return f;
  };

  it("ohne Code-Cookie erreicht nichts die Datenbank", async () => {
    const { mod, db } = await lade("bank", "ok");
    const r = await mod.schickeDateiZurueck("bank", T, formular(PDF, "a.pdf", "application/pdf"));
    expect("error" in r).toBe(true);
    expect(db.zugriffe).toEqual([]);
  });

  it("das Cookie der ANDEREN Art zählt nicht (Makler-Cookie auf Bank-Link)", async () => {
    const { mod, db } = await lade("bank", "ok", { name: "mi_makler", wert: "a".repeat(64) });
    expect("error" in (await mod.schickeDateiZurueck("bank", T, formular(PDF, "a.pdf", "application/pdf")))).toBe(true);
    expect(db.zugriffe).toEqual([]);
  });

  it("umbenannte HTML-Datei wird VOR der Datenbank abgelehnt, auch mit gelogenem Typ", async () => {
    const { mod, db } = await lade("bank", "ok", { name: "mi_bank", wert: "a".repeat(64) });
    const r = await mod.schickeDateiZurueck("bank", T, formular(HTML, "vertrag.pdf", "application/pdf"));
    expect(r).toEqual({ error: "Nur PDF, JPG, PNG oder WebP." });
    expect(db.zugriffe).toEqual([]);
  });

  it("gültig: Hash aus dem Cookie, Typ aus dem Dateikopf, Daten als data-URL", async () => {
    const { mod, args } = await lade("makler", "ok", { name: "mi_makler", wert: "b".repeat(64) });
    const r = await mod.schickeDateiZurueck("makler", T, formular(PDF, "../expose.pdf", "text/html"));
    expect(r).toEqual({ ok: true });
    expect(args[0]).toMatchObject({
      p_art: "makler", p_token: T, p_code_hash: "b".repeat(64),
      p_datei_name: "expose.pdf", p_datei_type: "application/pdf", p_datei_size: PDF.length, p_absender: "Frau Berg",
    });
    expect(String(args[0].p_datei_data)).toBe(`data:application/pdf;base64,${Buffer.from(PDF).toString("base64")}`);
  });

  it("Antwort der Datenbank wird nicht als Erfolg verschluckt", async () => {
    for (const a of ["limit", "format", "ungueltig", null]) {
      const { mod } = await lade("bank", a, { name: "mi_bank", wert: "a".repeat(64) });
      expect("error" in (await mod.schickeDateiZurueck("bank", T, formular(PDF, "a.pdf", "application/pdf")))).toBe(true);
    }
  });

  it("zu große Datei: abgelehnt ohne Datenbank", async () => {
    const { mod, db } = await lade("bank", "ok", { name: "mi_bank", wert: "a".repeat(64) });
    const gross = new Uint8Array(8 * 1024 * 1024 + 1); gross.set(PDF);
    expect("error" in (await mod.schickeDateiZurueck("bank", T, formular(gross, "a.pdf", "application/pdf")))).toBe(true);
    expect(db.zugriffe).toEqual([]);
  });
});

describe("Eingang des Eigentümers", () => {
  async function lade(init: Parameters<typeof fakeSupabase>[0]) {
    vi.resetModules();
    const { db, client } = fakeSupabase(init);
    mockeNextUndSupabase(client);
    return { db, mod: await import("@/lib/actions/freigabeEingang") };
  }
  it("Übernehmen: eine RPC (Archiv + Eingang leeren in einem Schritt); nichts entschieden → Fehler", async () => {
    const a = await lade({ rpc: { freigabe_eingang_uebernehmen: "n-1" } });
    expect(await a.mod.uebernimmEingang("e-1", "Darlehensvertrag", "Sonstiges")).toEqual({ ok: true, notizId: "n-1" });
    expect(a.db.zugriffe.map((z) => z.tabelle)).toEqual(["rpc:freigabe_eingang_uebernehmen"]);
    const b = await lade({ rpc: { freigabe_eingang_uebernehmen: null } });
    expect("error" in (await b.mod.uebernimmEingang("e-1", "x", "y"))).toBe(true);
  });
  it("Verwerfen leert die Datei, filtert auf Eigentümer und Status neu, kein Treffer → Fehler", async () => {
    const a = await lade({ antworten: { freigabe_eingang: { id: "e-1" } } });
    expect(await a.mod.verwirfEingang("e-1")).toEqual({ ok: true });
    const z = a.db.zugriffe.find((x) => x.tabelle === "freigabe_eingang" && x.op === "update")!;
    expect(z.daten).toMatchObject({ status: "verworfen", datei_data: null });
    expect(JSON.stringify(z.filter)).toContain("user_id");
    expect(JSON.stringify(z.filter)).toContain("neu");
    const b = await lade({ antworten: { freigabe_eingang: null } });
    expect("error" in (await b.mod.verwirfEingang("e-1"))).toBe(true);
  });
});

describe("Dashboard-Neuigkeit", () => {
  const leer = { ereignisse: [], anliegen: new Map(), zustellungen: [], angebote: [], rueckmeldungen: [], freigaben: [], bewerbungen: [] };
  it("unentschiedene Datei erscheint auch nach 14 Tagen, mit Sprung in den richtigen Eingang", () => {
    const { liste } = bauePortalNeuigkeiten({
      ...leer,
      eingang: [{ art: "bank", propId: "p9", absender: "Herr Kern", datei_name: "vertrag.pdf", created_at: "2026-08-01T10:00:00Z" }],
    }, "2026-10-06");
    expect(liste[0]).toMatchObject({ art: "eingang", sub: "vertrag.pdf", href: "/properties/p9/beleihung#eingang" });
    expect(liste[0].text).toContain("Bank");
  });
  it("ohne Eingang keine Zeile", () => {
    expect(bauePortalNeuigkeiten(leer, "2026-10-06").liste).toEqual([]);
  });
});

describe("Migration und Seiten", () => {
  const sql = readFileSync("supabase/migrations/20261006090000_freigabe_eingang.sql", "utf8");
  it("keine Insert-Policy für Nutzer, Entscheiden nur mit geleerter Datei, Code-Hash Pflicht", () => {
    expect(sql).not.toMatch(/for insert to authenticated/);
    expect(sql).toMatch(/status in \('uebernommen', 'verworfen'\) and datei_data is null/);
    expect(sql).toMatch(/and code_hash = p_code_hash/);
    expect(sql).toMatch(/n_stunde >= 10 or n_gesamt >= 30/);
    expect(sql).toMatch(/demo_schreibsperre/);
    expect(sql).not.toMatch(/\bdelete\b|\bdrop\b/i);
  });
  it("Kontolöschung kennt die Tabelle (Datei im SQL-Editor)", () => {
    expect(readFileSync("supabase/migrations/20261006091000_kontoloeschung_freigabe_eingang.sql", "utf8"))
      .toContain("delete from public.freigabe_eingang    where user_id = uid;");
  });
  it("Datei-Route nur für den Eigentümer und über dateiKopf", () => {
    const r = readFileSync("app/api/freigabe-eingang/[id]/route.ts", "utf8");
    expect(r).toContain('.eq("user_id", user.id)');
    expect(r).toContain("dateiKopf(");
  });
  it("öffentliche Seiten holen die Liste nur mit Hash", () => {
    for (const p of ["app/(app)/beleihung/[token]/page.tsx", "app/(app)/makler-link/[token]/page.tsx"]) {
      expect(readFileSync(p, "utf8")).toMatch(/rpc\("freigabe_public_eingang", \{ p_art: "(bank|makler)", p_token: params\.token, p_code_hash: hash \}\)/);
    }
  });
});
