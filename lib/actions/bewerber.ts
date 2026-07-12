"use server";

// Vermieter-Seite des Bewerbungs-Systems: Links verwalten, Bewerbungen
// bewerten/löschen und die eigene E-Signatur pflegen.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function erstelleBewerberLink(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const propId = String(formData.get("propId") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  if (!propId) return { error: "Bitte ein Objekt wählen." };

  const { error } = await supabase.from("bewerber_links").insert({
    user_id: user.id,
    prop_id: propId,
    titel: titel || null,
  });
  if (error) return { error: "Link konnte nicht erstellt werden." };
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function setzeBewerberLinkAktiv(id: string, aktiv: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerber_links").update({ aktiv }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function loescheBewerberLink(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerber_links").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function setzeBewerbungStatus(id: string, status: "neu" | "favorit" | "abgelehnt") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerbungen").update({ status }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function loescheBewerbung(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerbungen").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

/** E-Signatur des Vermieters speichern (PNG-Data-URL, max. ~200 kB). */
export async function speichereUnterschrift(dataUrl: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > 200000) {
    return { error: "Ungültige Unterschrift." };
  }
  const { error } = await supabase
    .from("unterschriften")
    .upsert({ user_id: user.id, data: dataUrl, updated_at: new Date().toISOString() });
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function loescheUnterschrift() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("unterschriften").delete().eq("user_id", user.id);
  revalidatePath("/einstellungen");
  return { ok: true };
}
