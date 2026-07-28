"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QUELLE_VERKAUF } from "@/lib/einschaetzung";

// Marktwert-Einschätzungen (Verkauf-Assistent): eigene Wertschätzungen je
// Objekt mit Datum festhalten und wiederfinden. Speichert in derselben
// Tabelle wie die automatischen Wert-Stände (`bewertung_historie`), damit die
// Einschätzungen auch in der Wertentwicklung des Objekts auftauchen.

export type EinschaetzungEingabe = {
  immobilieId: string;
  marktwert: number;
  datum: string; // ISO (YYYY-MM-DD)
  notiz?: string;
};

export type EinschaetzungErgebnis = { ok: true; id: string } | { ok: false; error: string };

export async function speichereEinschaetzung(e: EinschaetzungEingabe): Promise<EinschaetzungErgebnis> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!e.immobilieId) return { ok: false, error: "Bitte ein Objekt auswählen." };
  if (!Number.isFinite(e.marktwert) || e.marktwert <= 0) return { ok: false, error: "Bitte einen Marktwert größer 0 eingeben." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) return { ok: false, error: "Bitte ein gültiges Datum wählen." };

  // Datum auf Mittag setzen: so bleibt der Tag in jeder Zeitzone derselbe.
  const zeitpunkt = new Date(`${e.datum}T12:00:00.000Z`).toISOString();
  const notiz = (e.notiz ?? "").trim().slice(0, 200);

  const { data, error } = await supabase
    .from("bewertung_historie")
    .insert({
      user_id: user.id,
      immobilie_id: e.immobilieId,
      marktwert: Math.round(e.marktwert),
      datum: zeitpunkt,
      verfahren: "einschaetzung",
      quelle: notiz ? `${QUELLE_VERKAUF} · ${notiz}` : QUELLE_VERKAUF,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/verkauf");
  revalidatePath("/bewertung");
  return { ok: true, id: data.id as string };
}

export async function loescheEinschaetzung(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("bewertung_historie").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/verkauf");
  return { ok: true };
}

// Eine Einschätzung als aktuellen Marktwert des Objekts übernehmen — bewusst
// nur auf Klick (vorschlagen + bestätigen, keine stille Automatik).
export async function uebernehmeAlsWert(
  immobilieId: string,
  marktwert: number,
  datumIso: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!Number.isFinite(marktwert) || marktwert <= 0) return { ok: false, error: "Ungültiger Wert." };

  const { error } = await supabase
    .from("properties")
    .update({
      wert: Math.round(marktwert),
      marktwert_aktuell: Math.round(marktwert),
      marktwert_stand: datumIso.slice(0, 10),
    })
    .eq("id", immobilieId);
  if (error) return { ok: false, error: error.message };

  for (const p of ["/verkauf", "/properties", `/properties/${immobilieId}`, "/"]) revalidatePath(p);
  return { ok: true };
}
