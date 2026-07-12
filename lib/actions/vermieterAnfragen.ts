"use server";

// Anfragen des Vermieters an den Mieter (Zählerstand, Zutritt, Zustimmung
// Mieterhöhung, Personenzahl, …) — Gegenrichtung zum Anliegen-System.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const ANFRAGE_TYPEN = [
  "zaehlerstand", "zutritt", "mieterhoehung", "personenzahl",
  "kontaktdaten", "kaution", "dokument", "uebergabe", "sonstiges",
] as const;

export async function erstelleVermieterAnfrage(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const mieterId = String(formData.get("mieterId") ?? "");
  const typ = String(formData.get("typ") ?? "sonstiges");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  const termin = String(formData.get("termin") ?? "").trim();
  const faelligBis = String(formData.get("faelligBis") ?? "").trim();
  if (!mieterId) return { error: "Bitte einen Mieter wählen." };
  if (!ANFRAGE_TYPEN.includes(typ as (typeof ANFRAGE_TYPEN)[number])) return { error: "Ungültiger Typ." };
  if (!titel) return { error: "Bitte einen Betreff angeben." };

  const { data: mieter } = await supabase
    .from("mieter")
    .select("id,prop_id")
    .eq("id", mieterId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mieter) return { error: "Mieter nicht gefunden." };

  const { error } = await supabase.from("vermieter_anfragen").insert({
    vermieter_id: user.id,
    mieter_id: mieterId,
    prop_id: mieter.prop_id,
    typ,
    titel,
    beschreibung: beschreibung || null,
    termin: termin || null,
    faellig_bis: faelligBis || null,
  });
  if (error) return { error: "Anfrage konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}

/** Mieter beantwortet: status = erledigt | abgelehnt (+ optionale Antwort). */
export async function beantworteVermieterAnfrage(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const antwort = String(formData.get("antwort") ?? "").trim();
  if (!id || !["erledigt", "abgelehnt"].includes(status)) return { error: "Ungültige Eingabe." };

  const { error } = await supabase
    .from("vermieter_anfragen")
    .update({ status, antwort: antwort || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/portal");
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter löscht eine (z. B. versehentliche) Anfrage. */
export async function loescheVermieterAnfrage(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("vermieter_anfragen").delete().eq("id", id).eq("vermieter_id", user.id);
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}
