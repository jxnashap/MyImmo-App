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
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function rechnungFelder(fd: FormData) {
  const f = fd.get("rechnung");
  if (!f || typeof f === "string" || (f as File).size === 0) return {};
  const file = f as File;
  // ~6 MB Limit (base64 bläht ~33% auf; Spalte ist Text)
  if (file.size > 6 * 1024 * 1024) throw new Error("Rechnung zu groß (max. 6 MB).");
  const mime = file.type || "application/octet-stream";
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return {
    rechnung_name: file.name || "Rechnung",
    rechnung_type: mime,
    rechnung_size: fmtSize(file.size),
    rechnung_data: `data:${mime};base64,${base64}`,
  };
}

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
    ...(await rechnungFelder(fd)),
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
export async function deleteRechnung(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase
    .from("kosten")
    .update({ rechnung_name: null, rechnung_type: null, rechnung_size: null, rechnung_data: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/kosten");
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
