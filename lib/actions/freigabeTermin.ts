"use server";

// Termine über Bank-/Makler-Link — Seite des Eigentümers (06.10.2026). Bestätigen läuft als EINE
// Datenbank-Funktion (Status + Eintrag in `termine`), damit ein Fehler dazwischen keinen halben
// Zustand hinterlässt. „Keiner passt“ und „Rückruf ohne Termin erledigt“ sind reine Statuswechsel;
// beide gehen nur von `offen` aus (Regel `freigabe_termine_entscheiden`).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { berlinZuIso } from "@/lib/freigabeTermin";

async function konto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function neuLaden() {
  revalidatePath("/makler");
  revalidatePath("/properties/[id]/beleihung", "page");
  revalidatePath("/termine");
  revalidatePath("/");
}

/**
 * Einen Termin bestätigen. `zeit` ist entweder einer der Vorschläge (ISO, unverändert aus der
 * Datenbank) oder — beim Rückruf — die vereinbarte Berliner Ortszeit aus `datetime-local`.
 */
export async function bestaetigeFreigabeTermin(
  id: string,
  zeit: string,
  antwort: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await konto();
  const iso = /T\d{2}:\d{2}$/.test(String(zeit)) ? berlinZuIso(String(zeit)) : String(zeit ?? "");
  if (!iso || Number.isNaN(Date.parse(iso))) return { error: "Bitte Datum und Uhrzeit angeben." };
  const { data, error } = await supabase.rpc("freigabe_termin_bestaetigen", {
    p_id: id,
    p_zeit: iso,
    p_antwort: String(antwort ?? "").slice(0, 1000),
  });
  if (error) return { error: "Bestätigen fehlgeschlagen." };
  if (!data) return { error: "Dieser Vorschlag ist schon entschieden oder der Zeitpunkt gehört nicht dazu." };
  neuLaden();
  return { ok: true };
}

async function setzeStatus(id: string, status: "abgelehnt" | "erledigt", antwort: string) {
  const { supabase, userId } = await konto();
  const { data, error } = await supabase
    .from("freigabe_termine")
    .update({
      status,
      antwort: String(antwort ?? "").trim().slice(0, 1000) || null,
      entschieden_am: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "offen")
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Speichern fehlgeschlagen." } as const;
  neuLaden();
  return { ok: true } as const;
}

/** „Keiner passt“ — die Bank sieht die Antwort und kann neu vorschlagen. */
export async function lehneFreigabeTerminAb(id: string, antwort: string): Promise<{ ok: true } | { error: string }> {
  return setzeStatus(id, "abgelehnt", antwort);
}

/** Rückruf erledigt, ohne dass ein Termin eingetragen wird (z. B. alles am Telefon geklärt). */
export async function erledigeFreigabeRueckruf(id: string, antwort: string): Promise<{ ok: true } | { error: string }> {
  return setzeStatus(id, "erledigt", antwort);
}
