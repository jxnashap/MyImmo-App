"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ARTEN } from "@/lib/dokumentVorlagen";

// Ein Vorlagentext ist ein Brief, keine Datei — 20.000 Zeichen sind mehr als
// jede Kündigung braucht und verhindern, dass hier Megabytes abgelegt werden.
const MAX_TEXT = 20_000;

function pruefeArt(art: string) {
  if (!ARTEN.some((a) => a.v === art)) throw new Error("Unbekannte Dokumentart.");
}

/** Speichert (upsert) den bearbeiteten Standardtext einer Dokumentart für den aktuellen Nutzer. */
export async function saveDokumentVorlage(art: string, text: string) {
  pruefeArt(art);
  if (typeof text !== "string" || text.length > MAX_TEXT) throw new Error("Vorlagentext zu lang.");
  const supabase = await createClient();
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
  pruefeArt(art);
  const supabase = await createClient();
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
