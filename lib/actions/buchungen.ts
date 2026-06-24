"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Hilfsfunktionen zum Auslesen von FormData
function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return v == null || v === "" ? null : String(v);
}

async function uid() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function done(fd: FormData, fallback: string): never {
  revalidatePath("/", "layout");
  redirect(str(fd, "back") || fallback);
}

// ===== EINNAHMEN =====
export async function createEinnahme(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("einnahmen").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    kategorie: str(fd, "kategorie"),
    betrag: num(fd, "betrag"),
    beschreibung: str(fd, "beschreibung"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/einnahmen");
}
export async function deleteEinnahme(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("einnahmen").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== KOSTEN =====
export async function createKosten(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("kosten").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    mieter_id: str(fd, "mieter_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    kategorie: str(fd, "kategorie"),
    betrag: num(fd, "betrag"),
    beschreibung: str(fd, "beschreibung"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/kosten");
}
export async function deleteKosten(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("kosten").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== VERBRAUCH =====
export async function createVerbrauch(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("verbrauch").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    art: str(fd, "art"),
    menge: num(fd, "menge"),
    einheit: str(fd, "einheit"),
    verbrauchkosten: num(fd, "verbrauchkosten"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/verbrauch");
}
export async function deleteVerbrauch(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("verbrauch").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== KREDITE =====
export async function createKredit(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("kredite").insert({
    user_id: userId,
    bezeichnung: str(fd, "bezeichnung"),
    prop_id: str(fd, "prop_id"),
    bank: str(fd, "bank"),
    darlnr: str(fd, "darlnr"),
    betrag: num(fd, "betrag"),
    restschuld: num(fd, "restschuld"),
    grundschuld: num(fd, "grundschuld"),
    beleihung: num(fd, "beleihung"),
    zinssatz: num(fd, "zinssatz"),
    tilgungssatz: num(fd, "tilgungssatz"),
    monatsrate: num(fd, "monatsrate"),
    zinsbindung: str(fd, "zinsbindung"),
    laufzeit: num(fd, "laufzeit"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/kredite");
}
export async function deleteKredit(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("kredite").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== NOTIZEN =====
export async function createNotiz(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("notizen").insert({
    user_id: userId,
    titel: str(fd, "titel"),
    prop_id: str(fd, "prop_id"),
    kategorie: str(fd, "kategorie"),
    inhalt: str(fd, "inhalt"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/notizen");
}
export async function deleteNotiz(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("notizen").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
