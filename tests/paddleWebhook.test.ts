import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { parsePaddleEvent, verifyPaddleSignature, type PreisZuordnung } from "@/lib/billing/paddle";

// ---------------------------------------------------------------------------
// Signaturprüfung (Paddle-Signature: "ts=<unix>;h1=<hmac>")
// ---------------------------------------------------------------------------
describe("verifyPaddleSignature", () => {
  const secret = "whsec_test";
  const body = '{"event_type":"subscription.activated"}';
  const ts = 1_700_000_000;
  const h1 = crypto.createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");

  it("akzeptiert eine korrekte Signatur", () => {
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret, ts + 10)).toBe(true);
  });
  it("lehnt falsches Secret/manipulierten Body ab", () => {
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, "anderes", ts + 10)).toBe(false);
    expect(verifyPaddleSignature(body + " ", `ts=${ts};h1=${h1}`, secret, ts + 10)).toBe(false);
  });
  it("lehnt fehlenden Header und abgelaufene Timestamps ab (Replay-Schutz)", () => {
    expect(verifyPaddleSignature(body, null, secret, ts)).toBe(false);
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret, ts + 301)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Event-Parsing → Abo-Upsert. Tarif kommt aus den BEZAHLTEN Preis-IDs
// (items[]), custom_data liefert nur noch die user_id.
// ---------------------------------------------------------------------------
const PREISE: PreisZuordnung = {
  pri_privat_m: { artikel: "privat", zyklus: "monat" },
  pri_privat_j: { artikel: "privat", zyklus: "jahr" },
  pri_plus_j: { artikel: "plus", zyklus: "jahr" },
  pri_banking_j: { artikel: "banking", zyklus: "jahr" },
};

const eventFixture = (over: Record<string, unknown> = {}, typ = "subscription.activated") => ({
  event_type: typ,
  occurred_at: "2026-07-24T12:00:00Z",
  data: {
    id: "sub_123",
    status: "active",
    customer_id: "ctm_456",
    custom_data: { user_id: "u-1" },
    items: [{ price: { id: "pri_plus_j" } }, { price: { id: "pri_banking_j" } }],
    current_billing_period: { ends_at: "2027-07-24T00:00:00Z" },
    scheduled_change: null,
    ...over,
  },
});

describe("parsePaddleEvent", () => {
  it("subscription.activated → Tarif/Zyklus/Add-on aus den Preis-IDs", () => {
    const u = parsePaddleEvent(eventFixture(), PREISE);
    expect(u).toMatchObject({
      user_id: "u-1", plan: "plus", status: "aktiv", zyklus: "jahr",
      banking_addon: true, provider_customer_id: "ctm_456",
      provider_subscription_id: "sub_123", gueltig_bis: "2027-07-24T00:00:00Z",
      storniert_zum: null, letztes_event_am: "2026-07-24T12:00:00Z",
    });
  });
  it("Tarifwechsel im Portal: Items zählen, nicht ein alter custom_data-Zettel", () => {
    // custom_data behauptet plus+banking — bezahlt wird nur privat/Monat.
    const u = parsePaddleEvent(eventFixture({
      custom_data: { user_id: "u-1", plan: "plus", banking_addon: true },
      items: [{ price: { id: "pri_privat_m" } }],
    }), PREISE);
    expect(u).toMatchObject({ plan: "privat", zyklus: "monat", banking_addon: false });
  });
  it("nur unbekannte Preis-IDs → Event wird NICHT angewendet (kein Privat-Fallback)", () => {
    expect(parsePaddleEvent(eventFixture({ items: [{ price: { id: "pri_fremd" } }] }), PREISE)).toBeNull();
  });
  it("Kündigung kommt auch ohne bekannte Preis-IDs durch (Status neutralisiert den Plan)", () => {
    const u = parsePaddleEvent(eventFixture({ items: [{ price: { id: "pri_fremd" } }] }, "subscription.canceled"), PREISE);
    expect(u?.status).toBe("gekuendigt");
    expect(u?.plan).toBe("kostenlos");
  });
  it("subscription.canceled → Status gekündigt (egal was data.status sagt)", () => {
    const u = parsePaddleEvent(eventFixture({ status: "active" }, "subscription.canceled"), PREISE);
    expect(u?.status).toBe("gekuendigt");
  });
  it("geplante Kündigung (scheduled_change) → storniert_zum", () => {
    const u = parsePaddleEvent(eventFixture({
      scheduled_change: { action: "cancel", effective_at: "2026-12-31T00:00:00Z" },
    }), PREISE);
    expect(u?.storniert_zum).toBe("2026-12-31T00:00:00Z");
  });
  it("past_due/paused werden korrekt gemappt", () => {
    expect(parsePaddleEvent(eventFixture({ status: "past_due" }), PREISE)?.status).toBe("ueberfaellig");
    expect(parsePaddleEvent(eventFixture({ status: "paused" }), PREISE)?.status).toBe("pausiert");
  });
  it("ohne user_id in custom_data → null (kein blinder Upsert)", () => {
    expect(parsePaddleEvent(eventFixture({ custom_data: {} }), PREISE)).toBeNull();
  });
  it("fremde Events (transaction.*) → null", () => {
    expect(parsePaddleEvent({ event_type: "transaction.completed", data: {} }, PREISE)).toBeNull();
  });
});
