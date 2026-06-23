"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createTermin(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titel = String(formData.get("titel") ?? "").trim();
  const datum = String(formData.get("datum") ?? "");
  if (!titel || !datum) return;

  const { error } = await supabase.from("termine").insert({
    user_id: user.id,
    titel,
    datum,
    prop_id: (formData.get("prop_id") as string) || null,
    notiz: (formData.get("notiz") as string) || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/termine");
}

export async function deleteTermin(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("termine").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/termine");
}
