"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl } from "@/lib/flash";
import { encrypt } from "@/lib/crypto/secure";
import { normalizeIban } from "@/lib/iban";

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
    kuendigung: num("kuendigung"),
    letzte_erhoehung: str("letzte_erhoehung"),
    kaltmiete: num("kaltmiete"),
    nk_vorauszahlung: num("nk_vorauszahlung"),
    kaution: num("kaution"),
    kaution_status: str("kaution_status"),
    flaeche: num("flaeche"),
    mietart: str("mietart"),
    staffel_datum: str("staffel_datum"),
    staffel_betrag: num("staffel_betrag"),
    staffel_intervall: str("staffel_intervall"),
    notiz: str("notiz"),
  };
}

// Mieter-IBAN separat: wird VERSCHLÜSSELT gespeichert (wie ibans.iban),
// darf deshalb nicht durch parse() als Klartext laufen.
function ibanEnc(formData: FormData): string | null {
  const raw = String(formData.get("iban") ?? "").trim();
  return raw ? encrypt(normalizeIban(raw)) : null;
}

export async function createTenant(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("mieter").insert({ ...parse(formData), iban: ibanEnc(formData), user_id: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect(flashUrl("/tenants", "Mieter angelegt."));
}

export async function updateTenant(id: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("mieter").update({ ...parse(formData), iban: ibanEnc(formData) }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect(flashUrl("/tenants", "Mieter gespeichert."));
}

export async function deleteTenant(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("mieter").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tenants");
  redirect("/tenants");
}
