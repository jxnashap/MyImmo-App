import type { createClient } from "@/lib/supabase/server";

// Schreibt einen Wert-Stand in `bewertung_historie` — aber nur, wenn er sich
// vom zuletzt erfassten Stand unterscheidet (kein Rauschen bei unveränderten
// Speicherungen). Damit füllt sich der Wertentwicklungs-Chart über die Zeit,
// egal ob der Wert per Index-Fortschreibung, ImmoWertV oder manuell entstand.
export async function protokolliereWert(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propId: string,
  marktwert: number | null | undefined,
  verfahren: string,
  quelle: string,
): Promise<void> {
  if (marktwert == null || !Number.isFinite(marktwert) || marktwert <= 0) return;
  const wert = Math.round(marktwert);

  const { data: letzte } = await supabase
    .from("bewertung_historie")
    .select("marktwert")
    .eq("immobilie_id", propId)
    .order("datum", { ascending: false })
    .limit(1);
  const vorher = letzte?.[0]?.marktwert ?? null;
  if (vorher != null && Math.round(Number(vorher)) === wert) return;

  await supabase.from("bewertung_historie").insert({
    user_id: userId,
    immobilie_id: propId,
    verfahren,
    marktwert: wert,
    quelle,
  });
}
