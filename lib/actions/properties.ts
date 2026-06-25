"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl } from "@/lib/flash";

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

// Legt bei vermieteter Miete / vorhandenem Hausgeld automatisch wiederkehrende
// Buchungen an — aber nur, wenn noch keine solche Buchung existiert (idempotent).
type Parsed = ReturnType<typeof parse>;
async function autoBuchungen(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propId: string,
  p: Parsed,
) {
  const heute = new Date().toISOString().split("T")[0];

  if (p.miete && p.miete > 0 && p.obj_status === "Vermietet") {
    const { data: vorhanden } = await supabase
      .from("einnahmen")
      .select("id")
      .eq("prop_id", propId)
      .eq("kategorie", "Miete")
      .eq("wiederkehrend", true)
      .limit(1);
    if (!vorhanden?.length) {
      await supabase.from("einnahmen").insert({
        user_id: userId, prop_id: propId, buchungsdatum: heute,
        kategorie: "Miete", betrag: p.miete,
        beschreibung: `Kaltmiete ${p.bezeichnung} (automatisch erfasst)`,
        wiederkehrend: true,
      });
    }
  }

  if (p.hausgeld && p.hausgeld > 0) {
    const { data: vorhanden } = await supabase
      .from("kosten")
      .select("id")
      .eq("prop_id", propId)
      .eq("kategorie", "Hausgeld / WEG")
      .eq("wiederkehrend", true)
      .limit(1);
    if (!vorhanden?.length) {
      await supabase.from("kosten").insert({
        user_id: userId, prop_id: propId, buchungsdatum: heute,
        kategorie: "Hausgeld / WEG", betrag: p.hausgeld,
        beschreibung: `Hausgeld ${p.bezeichnung} (automatisch erfasst)`,
        wiederkehrend: true,
      });
    }
  }
}

export async function createProperty(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);
  const { data: neu, error } = await supabase
    .from("properties")
    .insert({ ...parsed, user_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (neu?.id) await autoBuchungen(supabase, user.id, neu.id, parsed);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect(flashUrl("/properties", "Immobilie angelegt."));
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);
  const { error } = await supabase.from("properties").update(parsed).eq("id", id);
  if (error) throw new Error(error.message);

  await autoBuchungen(supabase, user.id, id, parsed);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect(flashUrl("/properties", "Immobilie gespeichert."));
}

export async function deleteProperty(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect("/properties");
}
