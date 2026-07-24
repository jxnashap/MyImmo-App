// Paddle-Adapter (Merchant of Record): Paddle verkauft in unserem Namen und
// übernimmt EU-Umsatzsteuer + Rechnungen. Alles ist optional konfiguriert —
// ohne Env bleibt das System stumm (Early Access, docs/BEZAHLSYSTEM.md).
//
// Benötigte Env (Vercel, erst zur Aktivierung):
//   PADDLE_API_KEY          — Server-API-Key (Paddle → Developer Tools)
//   PADDLE_WEBHOOK_SECRET   — Secret der Webhook-Destination /api/billing/webhook
//   PADDLE_ENV              — "sandbox" (Default) | "production"
//   PADDLE_PRICE_PRIVAT_MONAT / _JAHR, PADDLE_PRICE_PLUS_MONAT / _JAHR,
//   PADDLE_PRICE_BANKING_MONAT / _JAHR — Preis-IDs aus dem Paddle-Katalog.
import crypto from "crypto";
import type { AboStatus, AboZyklus, PlanId } from "@/lib/plan";

const API_BASIS = () =>
  process.env.PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

export function paddleKonfiguriert(): boolean {
  return !!process.env.PADDLE_API_KEY;
}

/** Preis-ID aus der Env (z. B. PADDLE_PRICE_PRIVAT_MONAT). */
export function preisId(artikel: "privat" | "plus" | "banking", zyklus: AboZyklus): string | null {
  return process.env[`PADDLE_PRICE_${artikel.toUpperCase()}_${zyklus.toUpperCase()}`] ?? null;
}

// ---------------------------------------------------------------------------
// Webhook-Signatur (Paddle-Signature: "ts=<unix>;h1=<hmac>").
// HMAC-SHA256 über `${ts}:${rawBody}` mit dem Webhook-Secret.
// ---------------------------------------------------------------------------
export function verifyPaddleSignature(
  rawBody: string,
  signaturHeader: string | null,
  secret: string,
  jetztSekunden: number = Math.floor(Date.now() / 1000),
  toleranzSekunden = 300,
): boolean {
  if (!signaturHeader) return false;
  const teile = Object.fromEntries(
    signaturHeader.split(";").map((t) => t.split("=") as [string, string]),
  ) as { ts?: string; h1?: string };
  if (!teile.ts || !teile.h1) return false;
  const ts = Number(teile.ts);
  if (!Number.isFinite(ts) || Math.abs(jetztSekunden - ts) > toleranzSekunden) return false;
  const erwartet = crypto.createHmac("sha256", secret).update(`${teile.ts}:${rawBody}`).digest("hex");
  const a = Buffer.from(erwartet);
  const b = Buffer.from(teile.h1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Event-Parsing (pur, testbar): subscription.* → Abo-Upsert-Felder.
// custom_data {user_id, plan, zyklus, banking_addon} wird beim Checkout
// mitgegeben und von Paddle an die Subscription durchgereicht.
// ---------------------------------------------------------------------------
export type AboUpdate = {
  user_id: string;
  plan: PlanId;
  status: AboStatus;
  zyklus: AboZyklus | null;
  banking_addon: boolean;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  gueltig_bis: string | null;
  storniert_zum: string | null;
};

const STATUS_MAP: Record<string, AboStatus> = {
  active: "aktiv",
  trialing: "testphase",
  past_due: "ueberfaellig",
  paused: "pausiert",
  canceled: "gekuendigt",
};

const PLAENE: PlanId[] = ["kostenlos", "privat", "plus", "business"];

export function parsePaddleEvent(payload: unknown): AboUpdate | null {
  const p = payload as { event_type?: string; data?: Record<string, unknown> } | null;
  if (!p?.event_type?.startsWith("subscription.") || !p.data) return null;

  const data = p.data as {
    id?: string;
    status?: string;
    customer_id?: string;
    custom_data?: { user_id?: string; plan?: string; zyklus?: string; banking_addon?: boolean } | null;
    current_billing_period?: { ends_at?: string } | null;
    scheduled_change?: { action?: string; effective_at?: string } | null;
  };

  const userId = data.custom_data?.user_id;
  if (!userId) return null; // ohne Zuordnung kein Upsert — Event ignorieren

  const planRoh = data.custom_data?.plan ?? "";
  const plan = (PLAENE.includes(planRoh as PlanId) ? planRoh : "privat") as PlanId;

  const status: AboStatus =
    p.event_type === "subscription.canceled"
      ? "gekuendigt"
      : STATUS_MAP[data.status ?? ""] ?? "aktiv";

  const zyklusRoh = data.custom_data?.zyklus;
  const zyklus: AboZyklus | null = zyklusRoh === "monat" || zyklusRoh === "jahr" ? zyklusRoh : null;

  return {
    user_id: userId,
    plan,
    status,
    zyklus,
    banking_addon: !!data.custom_data?.banking_addon,
    provider_customer_id: data.customer_id ?? null,
    provider_subscription_id: data.id ?? null,
    gueltig_bis: data.current_billing_period?.ends_at ?? null,
    storniert_zum:
      data.scheduled_change?.action === "cancel" ? data.scheduled_change.effective_at ?? null : null,
  };
}

// ---------------------------------------------------------------------------
// Checkout & Kundenportal (Server-API-Calls).
// ---------------------------------------------------------------------------
async function paddleFetch(pfad: string, body: unknown): Promise<Record<string, unknown> | null> {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;
  const res = await fetch(`${API_BASIS()}${pfad}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Erzeugt eine Paddle-Transaktion und liefert die Hosted-Checkout-URL.
 * Voraussetzung im Paddle-Dashboard: "Default payment link" ist gesetzt
 * (Checkout-Einstellungen), sonst fehlt checkout.url in der Antwort.
 */
export async function erstelleCheckoutUrl(args: {
  userId: string;
  email?: string | null;
  plan: "privat" | "plus";
  zyklus: AboZyklus;
  bankingAddon?: boolean;
}): Promise<string | null> {
  const items: { price_id: string; quantity: number }[] = [];
  const tarifPreis = preisId(args.plan, args.zyklus);
  if (!tarifPreis) return null;
  items.push({ price_id: tarifPreis, quantity: 1 });
  if (args.bankingAddon) {
    const addonPreis = preisId("banking", args.zyklus);
    if (addonPreis) items.push({ price_id: addonPreis, quantity: 1 });
  }

  const antwort = await paddleFetch("/transactions", {
    items,
    ...(args.email ? { customer: { email: args.email } } : {}),
    custom_data: {
      user_id: args.userId,
      plan: args.plan,
      zyklus: args.zyklus,
      banking_addon: !!args.bankingAddon,
    },
  });
  const data = antwort?.data as { checkout?: { url?: string } } | undefined;
  return data?.checkout?.url ?? null;
}

/** Kundenportal (Zahlungsdaten ändern, kündigen) für einen Paddle-Kunden. */
export async function kundenPortalUrl(providerCustomerId: string): Promise<string | null> {
  const antwort = await paddleFetch(`/customers/${providerCustomerId}/portal-sessions`, {});
  const data = antwort?.data as { urls?: { general?: { overview?: string } } } | undefined;
  return data?.urls?.general?.overview ?? null;
}
