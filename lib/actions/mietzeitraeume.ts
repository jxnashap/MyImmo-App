"use server";

// Miet-Zeiträume: pro Mieter mehrere Perioden mit eigener Kaltmiete/NK/
// Stellplatzmiete. von/bis sind Monats-Anker (immer der 1. des Monats);
// bis = null heißt offen/laufend.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MietZeitraumResult = { ok: boolean; error?: string };

function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// "YYYY-MM" (input type=month) → "YYYY-MM-01"; leere Eingabe → null.
function monat(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}$/.test(v)) return null;
  return `${v}-01`;
}

async function uid() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function felder(fd: FormData) {
  return {
    von: monat(fd, "von"),
    bis: monat(fd, "bis"),
    kaltmiete: num(fd, "kaltmiete"),
    nk_vorauszahlung: num(fd, "nk_vorauszahlung"),
    stellplatz_miete: num(fd, "stellplatz_miete"),
  };
}

export async function createMietZeitraum(mieterId: string, fd: FormData): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const f = felder(fd);
  if (!f.von) return { ok: false, error: "Bitte den ersten Monat (von) angeben." };
  if (f.bis && f.bis < f.von) return { ok: false, error: "\u201eBis\u201c liegt vor \u201eVon\u201c." };

  // prop_id aus dem Mieter übernehmen (praktisch für Objektauswertungen).
  const { data: mieter } = await supabase
    .from("mieter")
    .select("prop_id")
    .eq("id", mieterId)
    .single();

  const { error } = await supabase.from("miet_zeitraeume").insert({
    user_id: userId,
    mieter_id: mieterId,
    prop_id: mieter?.prop_id ?? null,
    ...f,
  });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}

export async function updateMietZeitraum(id: string, mieterId: string, fd: FormData): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const f = felder(fd);
  if (!f.von) return { ok: false, error: "Bitte den ersten Monat (von) angeben." };
  if (f.bis && f.bis < f.von) return { ok: false, error: "\u201eBis\u201c liegt vor \u201eVon\u201c." };

  const { error } = await supabase.from("miet_zeitraeume").update(f).eq("id", id);
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}

export async function deleteMietZeitraum(id: string, mieterId: string): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const { error } = await supabase.from("miet_zeitraeume").delete().eq("id", id);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}
