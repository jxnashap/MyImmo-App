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
export function preisId(artikel: "privat" | "plus", zyklus: AboZyklus): string | null {
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
//
// Security-Review-Härtung: Tarif, Zyklus und Banking-Add-on werden aus den
// TATSÄCHLICH ABGERECHNETEN Preis-IDs der Subscription abgeleitet (items[]),
// NICHT aus custom_data — custom_data ist ein beim Checkout angehefteter
// Zettel, der bei Tarifwechseln im Paddle-Portal veraltet. custom_data dient
// nur noch der Nutzer-Zuordnung (user_id, serverseitig gesetzt).
// ---------------------------------------------------------------------------
export type AboUpdate = {
  user_id: string;
  plan: PlanId;
  status: AboStatus;
  zyklus: AboZyklus | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  gueltig_bis: string | null;
  storniert_zum: string | null;
  letztes_event_am: string | null; // occurred_at → Reihenfolge-Schutz im Webhook
};

const STATUS_MAP: Record<string, AboStatus> = {
  active: "aktiv",
  trialing: "testphase",
  past_due: "ueberfaellig",
  paused: "pausiert",
  canceled: "gekuendigt",
};

export type PreisZuordnung = Record<string, { artikel: "privat" | "plus"; zyklus: AboZyklus }>;

/** Preis-ID → Artikel/Zyklus aus der Env (Umkehrung der PADDLE_PRICE_*-Vars). */
export function preisZuordnungAusEnv(): PreisZuordnung {
  const map: PreisZuordnung = {};
  for (const artikel of ["privat", "plus"] as const) {
    for (const zyklus of ["monat", "jahr"] as const) {
      const id = preisId(artikel, zyklus);
      if (id) map[id] = { artikel, zyklus };
    }
  }
  return map;
}

export function parsePaddleEvent(payload: unknown, preise: PreisZuordnung = preisZuordnungAusEnv()): AboUpdate | null {
  const p = payload as { event_type?: string; occurred_at?: string; data?: Record<string, unknown> } | null;
  if (!p?.event_type?.startsWith("subscription.") || !p.data) return null;

  const data = p.data as {
    id?: string;
    status?: string;
    customer_id?: string;
    custom_data?: { user_id?: string } | null;
    items?: { price?: { id?: string } }[] | null;
    current_billing_period?: { ends_at?: string } | null;
    scheduled_change?: { action?: string; effective_at?: string } | null;
  };

  const userId = data.custom_data?.user_id;
  if (!userId) return null; // ohne Zuordnung kein Upsert — Event ignorieren

  const status: AboStatus =
    p.event_type === "subscription.canceled"
      ? "gekuendigt"
      : STATUS_MAP[data.status ?? ""] ?? "aktiv";

  // Tarif/Add-on aus den abgerechneten Preis-IDs ableiten (siehe Kopfkommentar).
  let plan: PlanId | null = null;
  let zyklus: AboZyklus | null = null;
  for (const item of data.items ?? []) {
    const treffer = item.price?.id ? preise[item.price.id] : undefined;
    if (!treffer) continue;
    if (plan === null || treffer.artikel === "plus") {
      plan = treffer.artikel;
      zyklus = treffer.zyklus;
    }
  }

  // Kein bekannter Tarif in den Items → Event NICHT anwenden (kein Rate-Fallback
  // mehr). Ausnahme Kündigung: dort neutralisiert der Status den Plan ohnehin —
  // die Kündigung muss durchkommen, sonst bliebe ein Bezahl-Tarif aktiv.
  if (plan === null) {
    if (status !== "gekuendigt") return null;
    plan = "kostenlos";
  }

  return {
    user_id: userId,
    plan,
    status,
    zyklus,
    provider_customer_id: data.customer_id ?? null,
    provider_subscription_id: data.id ?? null,
    gueltig_bis: data.current_billing_period?.ends_at ?? null,
    storniert_zum:
      data.scheduled_change?.action === "cancel" ? data.scheduled_change.effective_at ?? null : null,
    letztes_event_am: p.occurred_at ?? null,
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
}): Promise<string | null> {
  const items: { price_id: string; quantity: number }[] = [];
  const tarifPreis = preisId(args.plan, args.zyklus);
  if (!tarifPreis) return null;
  items.push({ price_id: tarifPreis, quantity: 1 });

  const antwort = await paddleFetch("/transactions", {
    items,
    ...(args.email ? { customer: { email: args.email } } : {}),
    custom_data: {
      user_id: args.userId,
      plan: args.plan,
      zyklus: args.zyklus,
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

/**
 * Kündigt eine Subscription sofort (Security-Review-Fix: wird VOR der
 * Konto-Löschung aufgerufen, damit nach dem Löschen keine Abbuchungen
 * mehr laufen). true = Paddle hat die Kündigung bestätigt.
 */
export async function kuendigeSubscription(providerSubscriptionId: string): Promise<boolean> {
  const antwort = await paddleFetch(`/subscriptions/${providerSubscriptionId}/cancel`, {
    effective_from: "immediately",
  });
  return antwort !== null;
}
