import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { parsePaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

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
// Event-Parsing → Abo-Upsert
// ---------------------------------------------------------------------------
const eventFixture = (over: Record<string, unknown> = {}, typ = "subscription.activated") => ({
  event_type: typ,
  data: {
    id: "sub_123",
    status: "active",
    customer_id: "ctm_456",
    custom_data: { user_id: "u-1", plan: "plus", zyklus: "jahr", banking_addon: true },
    current_billing_period: { ends_at: "2027-07-24T00:00:00Z" },
    scheduled_change: null,
    ...over,
  },
});

describe("parsePaddleEvent", () => {
  it("subscription.activated → vollständiger Upsert", () => {
    const u = parsePaddleEvent(eventFixture());
    expect(u).toMatchObject({
      user_id: "u-1", plan: "plus", status: "aktiv", zyklus: "jahr",
      banking_addon: true, provider_customer_id: "ctm_456",
      provider_subscription_id: "sub_123", gueltig_bis: "2027-07-24T00:00:00Z",
      storniert_zum: null,
    });
  });
  it("subscription.canceled → Status gekündigt (egal was data.status sagt)", () => {
    const u = parsePaddleEvent(eventFixture({ status: "active" }, "subscription.canceled"));
    expect(u?.status).toBe("gekuendigt");
  });
  it("geplante Kündigung (scheduled_change) → storniert_zum", () => {
    const u = parsePaddleEvent(eventFixture({
      scheduled_change: { action: "cancel", effective_at: "2026-12-31T00:00:00Z" },
    }));
    expect(u?.storniert_zum).toBe("2026-12-31T00:00:00Z");
  });
  it("past_due/paused werden korrekt gemappt", () => {
    expect(parsePaddleEvent(eventFixture({ status: "past_due" }))?.status).toBe("ueberfaellig");
    expect(parsePaddleEvent(eventFixture({ status: "paused" }))?.status).toBe("pausiert");
  });
  it("ohne user_id in custom_data → null (kein blinder Upsert)", () => {
    expect(parsePaddleEvent(eventFixture({ custom_data: { plan: "plus" } }))).toBeNull();
  });
  it("fremde Events (transaction.*) → null", () => {
    expect(parsePaddleEvent({ event_type: "transaction.completed", data: {} })).toBeNull();
  });
  it("unbekannter Plan in custom_data fällt auf privat zurück", () => {
    const u = parsePaddleEvent(eventFixture({ custom_data: { user_id: "u-1", plan: "hacker" } }));
    expect(u?.plan).toBe("privat");
  });
});
