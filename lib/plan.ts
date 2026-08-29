// Tarif-/Abo-Logik (Bezahlsystem, Businessplan Kap. 5 / Preise-Seite PLAENE).
// GEBAUT, ABER INAKTIV: Solange die Env BILLING_ENFORCED nicht "true" ist,
// gilt Early Access — alle Funktionen sind frei (so kündigt es die Preise-
// Seite an). Aktivierungs-Checkliste: docs/BEZAHLSYSTEM.md.
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanId = "kostenlos" | "privat" | "plus" | "business";
export type AboStatus = "aktiv" | "testphase" | "ueberfaellig" | "pausiert" | "gekuendigt";
export type AboZyklus = "monat" | "jahr";

export type Abo = {
  plan: PlanId;
  status: AboStatus;
  zyklus: AboZyklus | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  gueltig_bis: string | null;
  storniert_zum: string | null;
};

export const PLAN_NAMEN: Record<PlanId, string> = {
  kostenlos: "Kostenlos",
  privat: "MyImmo Privat",
  plus: "MyImmo Plus",
  business: "MyImmo Business",
};

const RANG: Record<PlanId, number> = { kostenlos: 0, privat: 1, plus: 2, business: 3 };

// Einheiten-Limit je Tarif. Gezählt wird die Summe der Einheiten über alle
// Objekte (properties.einheiten_anzahl, mindestens 1 je Objekt).
export const EINHEITEN_LIMIT: Record<PlanId, number> = {
  kostenlos: 1,
  privat: 5,
  plus: 24,
  business: Number.POSITIVE_INFINITY,
};

// Funktions-Schlüssel → günstigster Tarif, der sie enthält (Preise-Seite).
export type Feature =
  | "nk_pdf"        // Nebenkostenabrechnung als PDF
  | "steuer"        // Anlage V, ELSTER-Hilfe, Berichte, DATEV
  | "dokumente"     // Dokument-Generator & Archiv
  | "mieterportal"  // Mieter-Zugänge
  | "service"       // Service-Aufträge / Firmenverzeichnis
  | "ki_import"     // KI-Import (OCR, Objekt-Import)
  | "kalkulatoren"  // Kauf-/Verkauf-/Bewertungs-Kalkulatoren
  | "beleihung"     // Beleihungsordner & Bankgespräch-Paket
  | "hausverwaltung";// Mandanten-getrennter HV-Zugang

export const FEATURE_AB_PLAN: Record<Feature, PlanId> = {
  nk_pdf: "privat",
  steuer: "privat",
  dokumente: "privat",
  mieterportal: "privat",
  service: "plus",
  ki_import: "plus",
  kalkulatoren: "plus",
  beleihung: "plus",
  hausverwaltung: "business",
};

/** Ist die Tarif-Durchsetzung aktiv? Ohne Env-Flag gilt Early Access. */
export function billingAktiv(): boolean {
  return process.env.BILLING_ENFORCED === "true";
}

/** Zählt ein Abo-Status als zahlend? (ueberfaellig = Kulanz, Paddle mahnt.) */
export function istZahlend(status: AboStatus): boolean {
  return status === "aktiv" || status === "testphase" || status === "ueberfaellig";
}

/** Wirksamer Tarif: ohne Abo oder nach Kündigung/Pause zählt "kostenlos". */
export function effektiverPlan(abo: Abo | null): PlanId {
  if (!abo) return "kostenlos";
  return istZahlend(abo.status) ? abo.plan : "kostenlos";
}

/** Enthält der Tarif das Feature? */
export function planEnthaelt(plan: PlanId, feature: Feature): boolean {
  return RANG[plan] >= RANG[FEATURE_AB_PLAN[feature]];
}

/**
 * Zentrale Freigabe-Prüfung. `enforced` explizit übergebbar (Tests/Server);
 * Default liest die Env — solange Early Access gilt, ist ALLES erlaubt.
 */
export function darfFeature(abo: Abo | null, feature: Feature, enforced: boolean = billingAktiv()): boolean {
  if (!enforced) return true;
  return planEnthaelt(effektiverPlan(abo), feature);
}

/** Einheiten-Limit des wirksamen Tarifs (Early Access: unbegrenzt). */
export function einheitenLimit(abo: Abo | null, enforced: boolean = billingAktiv()): number {
  if (!enforced) return Number.POSITIVE_INFINITY;
  return EINHEITEN_LIMIT[effektiverPlan(abo)];
}

/** Abo des angemeldeten Nutzers laden (RLS liefert nur den eigenen Datensatz). */
export async function getAbo(supabase: SupabaseClient): Promise<Abo | null> {
  const { data } = await supabase
    .from("abos")
    .select("plan,status,zyklus,provider_customer_id,provider_subscription_id,gueltig_bis,storniert_zum")
    .limit(1)
    .maybeSingle();
  return (data as Abo | null) ?? null;
}

/** Summe der Einheiten über alle Objekte (mind. 1 je Objekt). */
export async function zaehleEinheiten(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("properties").select("einheiten_anzahl");
  return ((data ?? []) as { einheiten_anzahl: number | null }[])
    .reduce((sum, p) => sum + Math.max(1, p.einheiten_anzahl ?? 1), 0);
}
