"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Wandelt FormData in ein typisiertes Objekt um (Zahlen -> number | null)
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
    bezeichnung: str("bezeichnung") ?? "",
    typ: str("typ"),
    adresse: str("adresse"),
    kaufpreis: num("kaufpreis"),
    wert: num("wert"),
    flaeche: num("flaeche"),
    baujahr: num("baujahr"),
    miete: num("miete"),
    hausgeld: num("hausgeld"),
    obj_status: str("obj_status"),
    zimmer: num("zimmer"),
    energieklasse: str("energieklasse"),
  };
}

export async function createProperty(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("properties")
    .insert({ ...parse(formData), user_id: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect("/properties");
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("properties").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect("/properties");
}

export async function deleteProperty(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect("/properties");
}
