"use server";

// Service-Rolle (Businessplan Kap. 14): Vermieter lädt Service-Partner
// (Handwerker/Hausmeister) per Code ein und vergibt Aufträge; der Partner
// arbeitet sie im schlanken Service-Portal ab.
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne 0/O, 1/I/L

function neuerCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `SV-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Vermieter: Einladungscode für einen Service-Partner erzeugen (14 Tage). */
export async function erzeugeServiceCode() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const code = neuerCode();
  const { data, error } = await supabase
    .from("einladungscodes")
    .insert({ vermieter_id: user.id, code, rolle: "service" })
    .select("code,gueltig_bis")
    .single();
  if (error) return { error: "Code konnte nicht erstellt werden." };
  revalidatePath("/anliegen");
  return { code: data.code as string, gueltigBis: data.gueltig_bis as string };
}

export async function widerrufeServiceCode(code: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase
    .from("einladungscodes")
    .delete()
    .eq("code", code)
    .eq("vermieter_id", user.id)
    .eq("rolle", "service")
    .is("eingeloest_am", null);
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: Verknüpfung zu einem Service-Partner lösen (Aufträge bleiben). */
export async function entferneServicePartner(serviceUserId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase
    .from("service_zugaenge")
    .delete()
    .eq("vermieter_id", user.id)
    .eq("user_id", serviceUserId);
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: Auftrag an einen verknüpften Service-Partner erstellen. */
export async function erstelleAuftrag(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const serviceUserId = String(formData.get("serviceUserId") ?? "");
  const propId = String(formData.get("propId") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  const termin = String(formData.get("termin") ?? "").trim();
  const anliegenId = String(formData.get("anliegenId") ?? "").trim();
  if (!serviceUserId) return { error: "Bitte einen Service-Partner wählen." };
  if (!titel) return { error: "Bitte einen Betreff angeben." };

  // Partner muss mit diesem Vermieter verknüpft sein.
  const { data: zugang } = await supabase
    .from("service_zugaenge")
    .select("user_id")
    .eq("vermieter_id", user.id)
    .eq("user_id", serviceUserId)
    .maybeSingle();
  if (!zugang) return { error: "Service-Partner nicht gefunden." };

  // Objekt-/Absendername denormalisieren (Service-Portal hat keinen
  // RLS-Zugriff auf properties/vermieter_profil).
  let objektName: string | null = null;
  if (propId) {
    const { data: p } = await supabase
      .from("properties").select("bezeichnung,adresse").eq("id", propId).eq("user_id", user.id).maybeSingle();
    if (p) objektName = [p.bezeichnung, p.adresse].filter(Boolean).join(", ");
  }
  const { data: profil } = await supabase
    .from("vermieter_profil").select("name").eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("auftraege").insert({
    vermieter_id: user.id,
    service_user_id: serviceUserId,
    prop_id: propId || null,
    anliegen_id: anliegenId || null,
    objekt_name: objektName,
    vermieter_name: profil?.name || user.email || null,
    titel,
    beschreibung: beschreibung || null,
    termin: termin || null,
  });
  if (error) return { error: "Auftrag konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

/** Service-Partner (Hausmeister): Auftrag BEANTRAGEN — der Vermieter bekommt
 *  die Anfrage im Mieterportal (Tab Service) und gibt sie frei. */
export async function beantrageAuftrag(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const vermieterId = String(formData.get("vermieterId") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  const objekt = String(formData.get("objekt") ?? "").trim();
  const firmaId = String(formData.get("firmaId") ?? "").trim();
  const termin = String(formData.get("termin") ?? "").trim();
  if (!vermieterId) return { error: "Bitte den Auftraggeber wählen." };
  if (!titel) return { error: "Bitte angeben, was gemacht werden muss." };

  const { error } = await supabase.from("auftraege").insert({
    vermieter_id: vermieterId,
    service_user_id: user.id,
    firma_id: firmaId || null,
    objekt_name: objekt || null,
    titel: titel.slice(0, 200),
    beschreibung: beschreibung.slice(0, 2000) || null,
    termin: termin || null,
    status: "freigabe",
    erstellt_von: "service",
  });
  if (error) return { error: "Antrag konnte nicht gespeichert werden." };
  revalidatePath("/service");
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: beantragten Auftrag freigeben oder ablehnen. */
export async function entscheideAuftrag(id: string, freigeben: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data, error } = await supabase
    .from("auftraege")
    .update({ status: freigeben ? "offen" : "nicht_freigegeben", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("vermieter_id", user.id)
    .eq("status", "freigabe")
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Entscheidung konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

/** Service-Partner: Auftrag beantworten (angenommen/erledigt/abgelehnt). */
export async function beantworteAuftrag(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const antwort = String(formData.get("antwort") ?? "").trim();
  if (!id || !["angenommen", "erledigt", "abgelehnt"].includes(status)) {
    return { error: "Ungültige Eingabe." };
  }
  const { error } = await supabase
    .from("auftraege")
    .update({ status, antwort: antwort || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("service_user_id", user.id);
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/service");
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: Auftrag löschen. */
export async function loescheAuftrag(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("auftraege").delete().eq("id", id).eq("vermieter_id", user.id);
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}
