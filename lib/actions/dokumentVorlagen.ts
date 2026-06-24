"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Speichert (upsert) den bearbeiteten Standardtext einer Dokumentart für den aktuellen Nutzer. */
export async function saveDokumentVorlage(art: string, text: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("dokument_vorlagen")
    .upsert(
      { user_id: user.id, art, text, updated_at: new Date().toISOString() },
      { onConflict: "user_id,art" },
    );
  if (error) throw new Error(error.message);
}

/** Setzt eine Dokumentart auf den Standardtext zurück (löscht die gespeicherte Vorlage). */
export async function resetDokumentVorlage(art: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("dokument_vorlagen")
    .delete()
    .eq("user_id", user.id)
    .eq("art", art);
  if (error) throw new Error(error.message);
}
