"use server";

// Server-Action des Willkommens-Gates: prüft den Zugangscode SERVERSEITIG
// (nicht nur im Formular) und dokumentiert die Zustimmung. Erst danach
// bekommt ein neu registriertes Konto Zugriff auf die App.
import { createClient } from "@/lib/supabase/server";

export async function schalteKontoFrei(
  formData: FormData,
): Promise<{ ok: boolean; fehler?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, fehler: "Nicht angemeldet." };

  const code = String(formData.get("code") ?? "").trim();
  const consent = formData.get("consent") === "on" || formData.get("consent") === "true";
  if (!consent) return { ok: false, fehler: "Bitte AGB und Datenschutz zustimmen." };

  // Zugangscode serverseitig prüfen. BETA_CODE (server-only) bevorzugt,
  // Fallback auf den bisherigen öffentlichen Code.
  const erwartet = process.env.BETA_CODE ?? process.env.NEXT_PUBLIC_BETA_CODE ?? "";
  if (!erwartet || code !== erwartet) {
    return { ok: false, fehler: "Ungültiger Zugangscode." };
  }

  const { error } = await supabase.rpc("konto_freischalten", { p_quelle: "code" });
  if (error) return { ok: false, fehler: "Freischaltung fehlgeschlagen — bitte erneut versuchen." };
  return { ok: true };
}
