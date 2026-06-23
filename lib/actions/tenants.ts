"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };
  const str = (k: string) => {
    const v = formData.get(k);
    return v == null || v === "" ? null : String(v);
  };
  return {
    prop_id: str("prop_id"),
    vorname: str("vorname"),
    nachname: str("nachname"),
    email: str("email"),
    telefon: str("telefon"),
    mieter_adresse: str("mieter_adresse"),
    einheit: str("einheit"),
    mietbeginn: str("mietbeginn"),
    mietende: str("mietende"),
    kaltmiete: num("kaltmiete"),
    nk_vorauszahlung: num("nk_vorauszahlung"),
    kaution: num("kaution"),
    kaution_status: str("kaution_status"),
    flaeche: num("flaeche"),
    mietart: str("mietart"),
    notiz: str("notiz"),
  };
}

export async function createTenant(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("mieter").insert({ ...parse(formData), user_id: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function updateTenant(id: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("mieter").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function deleteTenant(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("mieter").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect("/tenants");
}
