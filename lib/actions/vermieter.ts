"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};

export async function saveVermieter(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const payload = {
    user_id: user.id,
    name: str(formData, "name"),
    strasse: str(formData, "strasse"),
    plz: str(formData, "plz"),
    ort: str(formData, "ort"),
    email: str(formData, "email"),
    telefon: str(formData, "telefon"),
    updated_at: new Date().toISOString(),
  };

  // Ein Datensatz pro Nutzer (unique user_id) -> upsert.
  const { error } = await supabase
    .from("vermieter_profil")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);

  revalidatePath("/einstellungen");
}
