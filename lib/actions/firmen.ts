"use server";

// Firmenverzeichnis des Vermieters: Handwerksbetriebe & Grundstücks-Dienste
// mit Telefon/E-Mail/Website — sichtbar auch für verknüpfte Service-Partner.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function erstelleFirma(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Bitte den Firmennamen angeben." };
  const website = String(formData.get("website") ?? "").trim();

  const { error } = await supabase.from("firmen").insert({
    user_id: user.id,
    name: name.slice(0, 200),
    gewerk: String(formData.get("gewerk") ?? "").trim() || null,
    telefon: String(formData.get("telefon") ?? "").trim().slice(0, 50) || null,
    email: String(formData.get("email") ?? "").trim().slice(0, 200) || null,
    website: website ? (website.startsWith("http") ? website : `https://${website}`).slice(0, 300) : null,
    notiz: String(formData.get("notiz") ?? "").trim().slice(0, 500) || null,
  });
  if (error) return { error: "Firma konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

export async function loescheFirma(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("firmen").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}
