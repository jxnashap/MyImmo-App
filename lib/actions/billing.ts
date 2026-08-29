"use server";

// Abo-Aktionen (Bezahlsystem, inaktiv bis BILLING_ENFORCED=true).
// Checkout/Portal laufen über Paddle (Merchant of Record) — ohne Paddle-Env
// liefern die Actions eine verständliche Fehlermeldung statt zu crashen.
import { createClient } from "@/lib/supabase/server";
import { erstelleCheckoutUrl, kundenPortalUrl, paddleKonfiguriert } from "@/lib/billing/paddle";
import type { AboZyklus } from "@/lib/plan";

type ActionErgebnis = { url: string } | { fehler: string };

/** Startet den Paddle-Checkout für Privat/Plus (Business = "auf Anfrage"). */
export async function starteCheckout(
  plan: "privat" | "plus",
  zyklus: AboZyklus,
): Promise<ActionErgebnis> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { fehler: "Nicht angemeldet." };
  if (plan !== "privat" && plan !== "plus") return { fehler: "Unbekannter Tarif." };
  if (!paddleKonfiguriert())
    return { fehler: "Das Bezahlsystem ist noch nicht freigeschaltet — aktuell ist alles kostenlos (Early Access)." };

  const url = await erstelleCheckoutUrl({
    userId: user.id,
    email: user.email,
    plan,
    zyklus,
  });
  if (!url) return { fehler: "Checkout konnte nicht erstellt werden. Bitte später erneut versuchen." };
  return { url };
}

/** Öffnet das Paddle-Kundenportal (Zahlungsdaten ändern, kündigen). */
export async function oeffneAboPortal(): Promise<ActionErgebnis> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { fehler: "Nicht angemeldet." };
  if (!paddleKonfiguriert()) return { fehler: "Das Bezahlsystem ist noch nicht freigeschaltet." };

  const { data } = await supabase.from("abos").select("provider_customer_id").maybeSingle();
  const kundenId = (data as { provider_customer_id: string | null } | null)?.provider_customer_id;
  if (!kundenId) return { fehler: "Kein aktives Abo gefunden." };

  const url = await kundenPortalUrl(kundenId);
  if (!url) return { fehler: "Portal konnte nicht geöffnet werden. Bitte später erneut versuchen." };
  return { url };
}
