"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidIban, normalizeIban } from "@/lib/iban";

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

  // Duplikat verhindern (gleiche IBAN beim selben Nutzer). Der Unique-Index
  // in der DB ist die eigentliche Absicherung gegen Doppelklick-Races; diese
  // Abfrage liefert nur die freundlichere Meldung im Normalfall.
  const { data: existing } = await supabase
    .from("ibans")
    .select("id")
    .eq("user_id", user.id)
    .eq("iban", iban)
    .maybeSingle();
  if (existing) return { ok: false, error: "Diese IBAN ist bereits hinterlegt." };

  const { error } = await supabase.from("ibans").insert({
    user_id: user.id,
    kontoname,
    inhaber: inhaber || null,
    iban,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Diese IBAN ist bereits hinterlegt." };
    return { ok: false, error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function deleteIban(id: string): Promise<IbanResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { error } = await supabase.from("ibans").delete().eq("id", id);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidatePath("/einstellungen");
  return { ok: true };
}
