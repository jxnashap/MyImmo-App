"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidIban, normalizeIban } from "@/lib/iban";

export async function addIban(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kontoname = String(formData.get("kontoname") ?? "").trim();
  const inhaber = String(formData.get("inhaber") ?? "").trim();
  const iban = normalizeIban(String(formData.get("iban") ?? ""));

  if (!kontoname || !iban) throw new Error("Bitte Name und IBAN angeben.");
  if (!isValidIban(iban)) throw new Error("Die IBAN ist ungültig (Prüfziffer stimmt nicht).");

  const { error } = await supabase.from("ibans").insert({
    user_id: user.id,
    kontoname,
    inhaber: inhaber || null,
    iban,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/einstellungen");
}

export async function deleteIban(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("ibans").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/einstellungen");
}
