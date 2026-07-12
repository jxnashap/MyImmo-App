"use server";

// Anliegen im Mieterportal (Etappe 2): Mieter erstellt Schaden/Dokument/Frage,
// Vermieter setzt Status und antwortet. RLS sichert beide Seiten ab.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TYPEN = ["schaden", "dokument", "frage"] as const;
const STATI = ["offen", "in_arbeit", "erledigt"] as const;

export async function erstelleAnliegen(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const typ = String(formData.get("typ") ?? "frage");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  if (!TYPEN.includes(typ as (typeof TYPEN)[number])) return { error: "Ungültiger Typ." };
  if (!titel) return { error: "Bitte gib einen Betreff an." };

  // Zugang des Mieter-Kontos → Vermieter/Wohnung ableiten (nicht vom Client vertrauen)
  const { data: zugang } = await supabase
    .from("mieter_zugaenge")
    .select("vermieter_id,mieter_id,prop_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!zugang) return { error: "Dein Konto ist mit keiner Wohnung verknüpft." };

  const { error } = await supabase.from("anliegen").insert({
    mieter_user_id: user.id,
    vermieter_id: zugang.vermieter_id,
    mieter_id: zugang.mieter_id,
    prop_id: zugang.prop_id,
    typ,
    titel,
    beschreibung: beschreibung || null,
  });
  if (error) return { error: "Anliegen konnte nicht gespeichert werden." };
  revalidatePath("/portal");
  revalidatePath("/anliegen");
  return { ok: true };
}

export async function bearbeiteAnliegen(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const antwort = String(formData.get("antwort") ?? "").trim();
  if (!id || !STATI.includes(status as (typeof STATI)[number])) return { error: "Ungültige Eingabe." };

  const { error } = await supabase
    .from("anliegen")
    .update({ status, antwort: antwort || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("vermieter_id", user.id);
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}
