import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { herkunftAus, normalisiereHerkunft } from "@/lib/herkunft";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// Herkunftsmessung (03.10.2026, docs/MARKETINGPLAN.md §6). Drei Dinge müssen
// halten: (1) aus der Adresszeile kommt nur eine harmlose Kennung, (2) die
// Route speichert sie und überschreibt eine frühere nie mit null, (3) nichts
// davon landet im Browser-Speicher (§ 25 TDDDG, Datenschutz Ziffer 2).

const lies = (p: string) => readFileSync(p, "utf8");

describe("Kennung aus der Adresszeile", () => {
  it("liest ?von= vor ?utm_source= und normalisiert auf Kleinbuchstaben", () => {
    expect(herkunftAus("?von=Instagram")).toBe("instagram");
    expect(herkunftAus("?utm_source=linkedin")).toBe("linkedin");
    expect(herkunftAus("?utm_source=linkedin&von=welle1")).toBe("welle1");
    expect(herkunftAus(new URLSearchParams("von=forum.vermieter_2"))).toBe("forum.vermieter_2");
  });

  it("ohne Marke oder mit unbrauchbarer Marke: null — nie ein halber Wert", () => {
    for (const s of ["", "?", "?von=", "?von=<script>", "?von=a b", "?von=" + "x".repeat(41), "?nl=ok"]) {
      expect(herkunftAus(s), s).toBeNull();
    }
    expect(herkunftAus(null)).toBeNull();
    // Unbrauchbares ?von= fällt auf utm_source zurück statt ganz verloren zu gehen.
    expect(herkunftAus("?von=%3Cx%3E&utm_source=newsletter")).toBe("newsletter");
  });

  it("nimmt nur Zeichenketten an", () => {
    for (const w of [5, {}, [], true, undefined, null]) expect(normalisiereHerkunft(w)).toBeNull();
    expect(normalisiereHerkunft("  Welle1 ")).toBe("welle1");
  });

  it("dieselbe Regel steht als CHECK in der Datenbank", () => {
    const sql = lies("supabase/migrations/20261003071839_newsletter_herkunft.sql");
    expect(sql).toContain("^[a-z0-9._-]{1,40}$");
    expect(lies("lib/herkunft.ts")).toContain("/^[a-z0-9._-]{1,40}$/");
  });
});

describe("kein Speicher im Browser", () => {
  it("lib/herkunft und die Formulare benutzen weder Cookies noch Web-Storage", () => {
    for (const p of [
      "lib/herkunft.ts",
      "components/landing/StartBenachrichtigung.tsx",
      "components/landing/VerteilerForm.tsx",
    ]) {
      const code = lies(p).replace(/\/\/.*$/gm, "");
      expect(code, p).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    }
  });

  it("beide Formulare und die Registrierung schicken die Marke mit", () => {
    expect(lies("components/landing/StartBenachrichtigung.tsx")).toContain("herkunft: herkunftDieserSeite()");
    expect(lies("components/landing/VerteilerForm.tsx")).toContain("herkunft: herkunftDieserSeite()");
    expect(lies("app/(app)/login/page.tsx")).toMatch(/herkunft\s*\?\s*\{\s*herkunft\s*\}/);
  });

  it("die Datenschutzerklärung nennt die Herkunftsangabe bei Konto UND Anmeldung", () => {
    const ds = lies("app/(pub)/datenschutz/page.tsx");
    expect(ds.match(/Herkunftsangabe/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Route ────────────────────────────────────────────────────────────────
const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
  for (const m of [
    "next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin",
    "@/lib/mail/brevo", "@/lib/net/bremse", "@/lib/net/basisUrl",
  ]) vi.doUnmock(m);
});

async function lade() {
  vi.resetModules();
  const { db, client } = fakeSupabase({ antworten: { newsletter_anmeldungen: null } });
  mockeNextUndSupabase(client);
  vi.doMock("@/lib/net/bremse", () => ({ darfWeiter: async () => true, besucherIp: async () => "203.0.113.9" }));
  vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://www.myimmoapp.de" }));
  vi.doMock("@/lib/mail/brevo", () => ({ brevoBereit: () => true, sendeMail: async () => true }));
  const mod = await import("@/app/api/newsletter/route");
  return { db, mod };
}
type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown> }[] };
const upsert = (db: Db) => db.zugriffe.find((z) => z.tabelle === "newsletter_anmeldungen" && z.op === "upsert")!.daten!;
const post = (body: unknown) => new Request("https://x/api/newsletter", { method: "POST", body: JSON.stringify(body) });

describe("Route /api/newsletter", () => {
  it("speichert eine gültige Marke normalisiert", async () => {
    const { db, mod } = await lade();
    expect((await mod.POST(post({ email: "a@example.org", quelle: "start", herkunft: "Instagram" }))).status).toBe(200);
    expect(upsert(db as Db).herkunft).toBe("instagram");
  });

  it("eine unbrauchbare Marke wird verworfen, die Anmeldung läuft trotzdem", async () => {
    const { db, mod } = await lade();
    expect((await mod.POST(post({ email: "a@example.org", herkunft: "<script>" }))).status).toBe(200);
    expect(upsert(db as Db)).not.toHaveProperty("herkunft");
  });

  it("ohne Marke wird die Spalte nicht mitgeschickt — eine frühere Herkunft bleibt stehen", async () => {
    const { db, mod } = await lade();
    await mod.POST(post({ email: "a@example.org", quelle: "start" }));
    expect(upsert(db as Db)).not.toHaveProperty("herkunft");
  });
});
