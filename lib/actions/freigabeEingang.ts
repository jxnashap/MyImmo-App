"use server";

// Eingang des Eigentümers (06.10.2026): Was Bank oder Makler über ihren Link geschickt haben,
// wird bewusst übernommen (→ Archiv) oder verworfen. In beiden Fällen leert die Datenbank die
// Datei im Eingang (Regel `freigabe_eingang_entscheiden`). Übernehmen läuft als EINE
// Datenbank-Funktion, damit ein Fehler dazwischen keine doppelte Archiv-Ablage hinterlässt.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function konto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function neuLaden() {
  revalidatePath("/makler");
  revalidatePath("/properties/[id]/beleihung", "page");
  revalidatePath("/archiv");
  revalidatePath("/");
}

export async function uebernimmEingang(
  id: string,
  titel: string,
  kategorie: string,
): Promise<{ ok: true; notizId: string } | { error: string }> {
  const { supabase } = await konto();
  const { data, error } = await supabase.rpc("freigabe_eingang_uebernehmen", {
    p_id: id,
    p_titel: String(titel ?? "").slice(0, 200),
    p_kategorie: String(kategorie ?? "").slice(0, 100),
  });
  if (error) return { error: "Übernehmen fehlgeschlagen." };
  if (!data) return { error: "Diese Datei ist schon entschieden oder nicht mehr da." };
  neuLaden();
  return { ok: true, notizId: String(data) };
}

export async function verwirfEingang(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await konto();
  const { data, error } = await supabase
    .from("freigabe_eingang")
    .update({ status: "verworfen", datei_data: null, entschieden_am: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "neu")
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Verwerfen fehlgeschlagen." };
  neuLaden();
  return { ok: true };
}
