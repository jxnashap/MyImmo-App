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
  const supabase = createClient();
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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("kalkulationen").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Kauf-Radar: Lage/Zustand (je 0–25) sind die subjektiven Score-Anteile des
// Nutzers. Sie leben in `data` (String-Record) — keine Schemaänderung nötig.
export async function saveRadarWerte(id: string, lage: number, zustand: number): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const l = Math.max(0, Math.min(25, Math.round(lage)));
  const z = Math.max(0, Math.min(25, Math.round(zustand)));
  const { data: row, error: readErr } = await supabase
    .from("kalkulationen").select("data").eq("id", id).single();
  if (readErr) return { ok: false, error: readErr.message };
  const data = { ...((row?.data ?? {}) as Record<string, string>), radar_lage: String(l), radar_zustand: String(z) };
  const { error } = await supabase.from("kalkulationen").update({ data }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
