"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Kalkulation } from "@/lib/types";

// ===== Gespeicherte Kalkulationen (Cockpit) =====
// Gibt die neu angelegte Zeile zurück, damit die Liste im Client lokal ergänzt
// werden kann — KEIN revalidatePath/refresh (das würde die Eingabe-States der
// Client-Komponente zurücksetzen).
export async function saveKalkulation(
  name: string,
  data: Record<string, string>,
  summary: Record<string, number>,
): Promise<Kalkulation> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: row, error } = await supabase.from("kalkulationen").insert({
    user_id: user.id,
    name: (name || "").trim() || "Kalkulation",
    data,
    summary,
  }).select("id,name,data,summary,created_at").single();
  if (error) throw new Error(error.message);
  return row as Kalkulation;
}

export async function deleteKalkulation(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("kalkulationen").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Wiedervorlage: eine gespeicherte Kalkulation überschreiben (statt eine
// zweite anzulegen), wenn der Nutzer sie zum Bearbeiten geöffnet hat.
export async function updateKalkulation(
  id: string,
  name: string,
  data: Record<string, string>,
  summary: Record<string, number>,
): Promise<Kalkulation> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: row, error } = await supabase
    .from("kalkulationen")
    .update({ name: (name || "").trim() || "Kalkulation", data, summary })
    .eq("id", id)
    .select("id,name,data,summary,created_at")
    .single();
  if (error) throw new Error(error.message);
  return row as Kalkulation;
}
