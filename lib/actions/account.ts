"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// DSGVO Art. 17: löscht das eigene Konto samt aller Daten über die
// SECURITY-DEFINER-Funktion delete_own_account() und meldet danach ab.
export async function deleteAccount(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    throw new Error("Konto konnte nicht gelöscht werden: " + error.message);
  }

  // Session beenden (Cookies löschen) und zur Login-Seite.
  await supabase.auth.signOut();
  redirect("/login?geloescht=1");
}
