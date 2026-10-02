"use server";

// Hinweis-Mails abbestellen (02.10.2026). Die Einstellung liegt in den Metadaten des
// eigenen Kontos — sie betrifft nur den Nutzer selbst und ist keine Sicherheitsfrage;
// gelesen wird sie beim Versand über die Service-Role (lib/benachrichtigung.ts).
import { createClient } from "@/lib/supabase/server";
import { istDemoKonto } from "@/lib/demo";

export async function setzeBenachrichtigungen(aus: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  // Das Demo-Konto teilen sich alle Besucher — eine Einstellung dort träfe alle.
  if (istDemoKonto(user.email)) return { error: "In der Demo wird nichts gespeichert." };
  const { error } = await supabase.auth.updateUser({ data: { benachrichtigungen_aus: aus === true } });
  if (error) return { error: "Einstellung konnte nicht gespeichert werden." };
  return { ok: true };
}
