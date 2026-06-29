"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { encrypt, blindIndex } from "@/lib/crypto/secure";

export type IbanResult = { ok: boolean; error?: string };

export async function addIban(formData: FormData): Promise<IbanResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const kontoname = String(formData.get("kontoname") ?? "").trim();
  const inhaber = String(formData.get("inhaber") ?? "").trim();
  const iban = normalizeIban(String(formData.get("iban") ?? ""));

  if (!kontoname || !iban) return { ok: false, error: "Bitte Name und IBAN angeben." };
  if (!isValidIban(iban)) return { ok: false, error: "Die IBAN ist nicht korrekt (Prüfziffer stimmt nicht)." };

  // Die IBAN wird verschlüsselt gespeichert. Für Dublettenprüfung und
  // Unique-Index brauchen wir trotzdem einen deterministischen Vergleichswert
  // → Blind-Index (HMAC der normalisierten IBAN).
  const ibanBidx = blindIndex(iban);

  // Duplikat verhindern (gleiche IBAN beim selben Nutzer). Der Unique-Index
  // in der DB (user_id, iban_bidx) ist die eigentliche Absicherung gegen
  // Doppelklick-Races; diese Abfrage liefert nur die freundlichere Meldung.
  const { data: existing } = await supabase
    .from("ibans")
    .select("id")
    .eq("user_id", user.id)
    .eq("iban_bidx", ibanBidx)
    .maybeSingle();
  if (existing) return { ok: false, error: "Diese IBAN ist bereits hinterlegt." };

  // Erstes Konto des Nutzers automatisch als Standard markieren.
  const { count } = await supabase
    .from("ibans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const istErstes = (count ?? 0) === 0;

  const { error } = await supabase.from("ibans").insert({
    user_id: user.id,
    kontoname,
    inhaber: inhaber ? encrypt(inhaber) : null,
    iban: encrypt(iban),
    iban_bidx: ibanBidx,
    standard: istErstes,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Diese IBAN ist bereits hinterlegt." };
    return { ok: false, error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
  revalidatePath("/einstellungen");
  return { ok: true };
}

// Markiert ein Konto als Standard und entfernt die Markierung bei allen anderen.
export async function setStandardIban(id: string): Promise<IbanResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Erst alle zurücksetzen (verhindert Verletzung des Unique-Index), dann setzen.
  const { error: e1 } = await supabase
    .from("ibans")
    .update({ standard: false })
    .eq("user_id", user.id)
    .eq("standard", true);
  if (e1) return { ok: false, error: "Konnte Standard nicht setzen." };

  const { error: e2 } = await supabase
    .from("ibans")
    .update({ standard: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (e2) return { ok: false, error: "Konnte Standard nicht setzen." };

  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function deleteIban(id: string): Promise<IbanResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { error } = await supabase.from("ibans").delete().eq("id", id);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };

  // Falls dadurch kein Standard mehr existiert: ältestes verbleibendes Konto nachrücken.
  const { data: rest } = await supabase
    .from("ibans")
    .select("id, standard")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (rest && rest.length > 0 && !rest.some((r) => r.standard)) {
    await supabase.from("ibans").update({ standard: true }).eq("id", rest[0].id);
  }

  revalidatePath("/einstellungen");
  return { ok: true };
}
