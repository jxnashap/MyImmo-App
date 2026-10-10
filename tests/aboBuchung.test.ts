import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  aboKostenZeilen,
  berlinerTag,
  parseAboZahlung,
  verteileAufObjekte,
} from "@/lib/billing/aboBuchung";
import { berechneAnlageV, AFA_DEFAULT } from "@/lib/anlageV";
import type { Kosten, Property } from "@/lib/types";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";

// Abo-Zahlung als Kostenbuchung (05.10.2026). Was halten muss:
// (1) nur bezahlte Euro-Rechnungen, Betrag in Cent aus Paddles Zeichenkette;
// (2) die Verteilung ergibt cent-genau den gezahlten Betrag, selbst bewohnte
//     Objekte bekommen nichts; (3) die Kategorie landet in der Anlage V bei den Verwaltungskosten;
// (4) der Webhook bucht über die atomare SQL-Funktion und meldet jeden Fehler
//     mit 500, damit Paddle erneut zustellt.

const TXN = "txn_01hv8wptq8987qeep44cyrewp9";
const ereignis = (data: Record<string, unknown> = {}, typ = "transaction.completed") => ({
  event_type: typ,
  occurred_at: "2026-10-05T09:00:00Z",
  data: {
    id: TXN,
    status: "completed",
    subscription_id: "sub_01hv8x29kz0t586xy6zn1a62ny",
    custom_data: { user_id: "kunde-1" },
    currency_code: "EUR",
    billed_at: "2026-10-05T08:59:00Z",
    details: { totals: { grand_total: "799" } },
    ...data,
  },
});

describe("Zahlung erkennen", () => {
  it("liest Betrag in Cent, Datum, Transaktion und Abo", () => {
    expect(parseAboZahlung(ereignis())).toEqual({
      transaktionId: TXN,
      subscriptionId: "sub_01hv8x29kz0t586xy6zn1a62ny",
      userIdHinweis: "kunde-1",
      cent: 799,
      datum: "2026-10-05",
    });
  });

  it("bucht nichts bei anderen Ereignissen, Fremdwährung, 0 € oder kaputtem Betrag", () => {
    expect(parseAboZahlung(ereignis({}, "transaction.paid"))).toBeNull();
    expect(parseAboZahlung(ereignis({}, "subscription.activated"))).toBeNull();
    expect(parseAboZahlung(ereignis({ status: "billed" }))).toBeNull();
    expect(parseAboZahlung(ereignis({ currency_code: "USD" }))).toBeNull();
    for (const g of ["0", "-799", "7.99", "", "abc"]) {
      expect(parseAboZahlung(ereignis({ details: { totals: { grand_total: g } } })), g).toBeNull();
    }
    expect(parseAboZahlung(ereignis({ id: "txn_kurz" }))).toBeNull();
    expect(parseAboZahlung(null)).toBeNull();
  });

  it("der Tag zählt in Berlin: 23:30 UTC am 31.12. ist schon das neue Steuerjahr", () => {
    expect(berlinerTag("2026-12-31T23:30:00Z")).toBe("2027-01-01");
    expect(parseAboZahlung(ereignis({ billed_at: "2026-12-31T23:30:00Z" }))!.datum).toBe("2027-01-01");
  });
});

describe("Verteilung nach Einheiten", () => {
  const objekte = [
    { id: "a", einheiten_anzahl: 1, obj_status: "Vermietet" },
    { id: "b", einheiten_anzahl: 2, obj_status: "Leer" },
    { id: "c", einheiten_anzahl: 6, obj_status: "Selbst bewohnt" },
  ];

  it("selbst bewohnte Objekte bekommen nichts, die Summe ist cent-genau", () => {
    const t = verteileAufObjekte(799, objekte);
    expect(t.map((x) => x.prop_id)).toEqual(["a", "b"]);
    expect(t.reduce((s, x) => s + x.cent, 0)).toBe(799);
    expect(t).toEqual([{ prop_id: "a", cent: 266 }, { prop_id: "b", cent: 533 }]);
  });

  it("fehlende oder unsinnige Einheiten zählen als 1", () => {
    const t = verteileAufObjekte(1000, [{ id: "x", einheiten_anzahl: null }, { id: "y", einheiten_anzahl: 0 }]);
    expect(t).toEqual([{ prop_id: "x", cent: 500 }, { prop_id: "y", cent: 500 }]);
  });

  it("die Summe stimmt bei jedem Betrag und jeder Aufteilung", () => {
    for (const cent of [1, 2, 99, 799, 1299, 12900, 99999]) {
      for (const n of [1, 2, 3, 7, 13]) {
        const obj = Array.from({ length: n }, (_, i) => ({ id: `o${i}`, einheiten_anzahl: (i % 4) + 1 }));
        const t = verteileAufObjekte(cent, obj);
        expect(t.reduce((s, x) => s + x.cent, 0), `${cent}/${n}`).toBe(cent);
        expect(t.every((x) => x.cent > 0)).toBe(true);
      }
    }
  });

  it("ohne passendes Objekt: eine Zeile ohne Objekt", () => {
    expect(verteileAufObjekte(799, [])).toEqual([{ prop_id: null, cent: 799 }]);
    expect(verteileAufObjekte(799, [objekte[2]])).toEqual([{ prop_id: null, cent: 799 }]);
  });

  it("die Zeilen landen in der Anlage V bei den Verwaltungskosten (Vordruck: nicht umgelegte Kosten)", () => {
    const z = aboKostenZeilen(parseAboZahlung(ereignis())!, objekte);
    // Durch die echte Anlage-V-Rechnung, nicht über eine Konstante: Landet die
    // Kategorie im falschen Topf, steht der Betrag nicht bei den Verwaltungskosten.
    const props = objekte.map((o) => ({ id: o.id, bezeichnung: o.id, adresse: null, kaufpreis: 0 }) as unknown as Property);
    const r = berechneAnlageV(2026, props, [], z as unknown as Kosten[], [], AFA_DEFAULT);
    expect(r.gesamt.werbungskosten.verwaltung).toBe(7.99);
    expect(r.objekte.find((o) => o.propId === "c")?.werbungskosten.verwaltung ?? 0).toBe(0);
    expect(z.map((x) => x.betrag)).toEqual([2.66, 5.33]);
    expect(z[0].beschreibung).toContain(TXN);
    expect(z[0].buchungsdatum).toBe("2026-10-05");
  });
});

// ── Webhook ──────────────────────────────────────────────────────────────
const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
  for (const m of ["next/cache", "next/navigation", "next/headers", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/billing/paddle"]) vi.doUnmock(m);
});

async function lade(init: Parameters<typeof fakeSupabase>[0]) {
  vi.resetModules();
  process.env.PADDLE_WEBHOOK_SECRET = "geheim";
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  vi.doMock("@/lib/billing/paddle", () => ({ verifyPaddleSignature: () => true, parsePaddleEvent: () => null }));
  const mod = await import("@/app/api/billing/webhook/route");
  return { db, mod };
}
type Db = { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] };
const post = (body: unknown) =>
  new Request("https://www.myimmoapp.de/api/billing/webhook", { method: "POST", body: JSON.stringify(body), headers: { "paddle-signature": "ts=1;h1=x" } }) as never;
const OBJEKTE = [{ id: "a", einheiten_anzahl: 1, obj_status: "Vermietet" }, { id: "b", einheiten_anzahl: 3, obj_status: "Vermietet" }];

describe("Webhook bucht die Zahlung", () => {
  it("Verlängerung: Konto über die Subscription, verteilt, über die SQL-Funktion", async () => {
    const { db, mod } = await lade({
      antworten: { abos: { user_id: "konto-aus-abo" }, properties: OBJEKTE },
      rpc: { abo_zahlung_buchen: true },
    });
    const r = await mod.POST(post(ereignis({ custom_data: null })));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, gebucht: true });
    const d = db as Db;
    expect(d.zugriffe.find((z) => z.tabelle === "properties")!.filter).toContain("eq:user_id=konto-aus-abo");
    const rpc = d.zugriffe.find((z) => z.tabelle === "rpc:abo_zahlung_buchen")!.daten!;
    expect(rpc.p_user).toBe("konto-aus-abo");
    expect(rpc.p_transaktion).toBe(TXN);
    expect(rpc.p_cent).toBe(799);
    expect((rpc.p_zeilen as { betrag: number }[]).map((z) => z.betrag)).toEqual([2, 5.99]);
    // Nie direkt in kosten schreiben — nur die Funktion ist atomar und einmalig.
    expect(d.zugriffe.some((z) => z.tabelle === "kosten")).toBe(false);
  });

  it("Erstkauf ohne bekanntes Abo: Konto aus custom_data", async () => {
    const { db, mod } = await lade({ antworten: { abos: null, properties: [] }, rpc: { abo_zahlung_buchen: true } });
    expect((await mod.POST(post(ereignis()))).status).toBe(200);
    expect((db as Db).zugriffe.find((z) => z.tabelle === "rpc:abo_zahlung_buchen")!.daten!.p_user).toBe("kunde-1");
  });

  it("die Subscription schlägt custom_data", async () => {
    const { db, mod } = await lade({ antworten: { abos: { user_id: "echt" }, properties: [] }, rpc: { abo_zahlung_buchen: true } });
    await mod.POST(post(ereignis({ custom_data: { user_id: "anders" } })));
    expect((db as Db).zugriffe.find((z) => z.tabelle === "rpc:abo_zahlung_buchen")!.daten!.p_user).toBe("echt");
  });

  it("wiederholte Zustellung ist kein Fehler", async () => {
    const { mod } = await lade({ antworten: { abos: { user_id: "k" }, properties: [] }, rpc: { abo_zahlung_buchen: false } });
    const r = await mod.POST(post(ereignis()));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, gebucht: false });
  });

  it("ohne Zuordnung, bei Lesefehlern und bei Buchungsfehlern: 500, damit Paddle erneut zustellt", async () => {
    let t = await lade({ antworten: { abos: null } });
    expect((await t.mod.POST(post(ereignis({ custom_data: null })))).status).toBe(500);
    expect((t.db as Db).zugriffe.some((z) => z.op === "rpc")).toBe(false);

    t = await lade({ antworten: { abos: { user_id: "k" } }, fehlerBei: { abos: { message: "x" } } });
    expect((await t.mod.POST(post(ereignis()))).status).toBe(500);

    t = await lade({ antworten: { abos: { user_id: "k" } }, fehlerBei: { properties: { message: "x" } } });
    expect((await t.mod.POST(post(ereignis()))).status).toBe(500);
    expect((t.db as Db).zugriffe.some((z) => z.op === "rpc")).toBe(false);

    t = await lade({ antworten: { abos: { user_id: "k" }, properties: [] }, fehlerBei: { "rpc:abo_zahlung_buchen": { message: "x" } } });
    expect((await t.mod.POST(post(ereignis()))).status).toBe(500);
  });

  it("die SQL-Funktion ist nur für die Service-Role und prüft Summe und Objekt-Besitz", () => {
    const sql = readFileSync("supabase/migrations/20261005142945_abo_zahlung_buchen.sql", "utf8");
    expect(sql).toMatch(/revoke all on function public\.abo_zahlung_buchen[^;]*from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.abo_zahlung_buchen[^;]*to service_role/);
    expect(sql).toContain("on conflict (transaktion_id) do nothing");
    expect(sql).toContain("Summe der Zeilen passt nicht");
    expect(sql).toContain("p.user_id = p_user");
  });
});
