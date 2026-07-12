"use server";

// Zählerstand-Meldungen (Etappe 4): Mieter melden Stände mit Foto-Beleg,
// der Vermieter übernimmt sie — ab der zweiten Meldung desselben Zählers
// wird die Differenz automatisch als Verbrauch gebucht.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ARTEN = ["Strom", "Gas", "Wasser", "Warmwasser", "Fernwärme", "Öl", "Sonstiges"] as const;
const MAX_FOTO = 4 * 1024 * 1024;
const FOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function meldeZaehlerstand(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const art = String(formData.get("art") ?? "Strom");
  const stand = parseFloat(String(formData.get("stand") ?? "").replace(",", "."));
  const einheit = String(formData.get("einheit") ?? "kWh").trim() || "kWh";
  const zaehlernummer = String(formData.get("zaehlernummer") ?? "").trim();
  const ablesedatum = String(formData.get("ablesedatum") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const notiz = String(formData.get("notiz") ?? "").trim();
  if (!ARTEN.includes(art as (typeof ARTEN)[number])) return { error: "Ungültige Zählerart." };
  if (!Number.isFinite(stand) || stand < 0) return { error: "Bitte gib einen gültigen Zählerstand an." };

  const foto = formData.get("foto");
  let fotoFelder: Record<string, string> = {};
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > MAX_FOTO) return { error: "Das Foto ist größer als 4 MB." };
    if (!FOTO_MIME.includes(foto.type)) return { error: "Nur Fotos (JPG/PNG/WebP/HEIC) erlaubt." };
    fotoFelder = {
      foto_name: foto.name,
      foto_type: foto.type,
      foto_data: Buffer.from(await foto.arrayBuffer()).toString("base64"),
    };
  }

  const { data: zugang } = await supabase
    .from("mieter_zugaenge")
    .select("vermieter_id,mieter_id,prop_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!zugang) return { error: "Dein Konto ist mit keiner Wohnung verknüpft." };

  const { error } = await supabase.from("zaehlerstand_meldungen").insert({
    mieter_user_id: user.id,
    vermieter_id: zugang.vermieter_id,
    mieter_id: zugang.mieter_id,
    prop_id: zugang.prop_id,
    art,
    zaehlernummer: zaehlernummer || null,
    stand,
    einheit,
    ablesedatum,
    notiz: notiz || null,
    ...fotoFelder,
  });
  if (error) return { error: "Meldung konnte nicht gespeichert werden." };
  revalidatePath("/portal");
  revalidatePath("/verbrauch");
  return { ok: true };
}

export async function uebernehmeZaehlerstand(meldungId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: m } = await supabase
    .from("zaehlerstand_meldungen")
    .select("*")
    .eq("id", meldungId)
    .eq("vermieter_id", user.id)
    .maybeSingle();
  if (!m) return { error: "Meldung nicht gefunden." };
  if (m.uebernommen_am) return { error: "Bereits übernommen." };

  // Vorherige übernommene Meldung desselben Zählers → Differenz = Verbrauch
  const { data: vorher } = await supabase
    .from("zaehlerstand_meldungen")
    .select("stand,ablesedatum")
    .eq("vermieter_id", user.id)
    .eq("mieter_id", m.mieter_id)
    .eq("art", m.art)
    .not("uebernommen_am", "is", null)
    .lt("ablesedatum", m.ablesedatum)
    .order("ablesedatum", { ascending: false })
    .limit(1)
    .maybeSingle();

  let verbrauchGebucht = false;
  if (vorher && m.stand >= vorher.stand) {
    const menge = Math.round((m.stand - vorher.stand) * 100) / 100;
    if (menge > 0) {
      const { error: vErr } = await supabase.from("verbrauch").insert({
        user_id: user.id,
        prop_id: m.prop_id,
        buchungsdatum: m.ablesedatum,
        art: m.art,
        menge,
        einheit: m.einheit,
      });
      if (vErr) return { error: "Verbrauch konnte nicht gebucht werden." };
      verbrauchGebucht = true;
    }
  }

  const { error } = await supabase
    .from("zaehlerstand_meldungen")
    .update({ uebernommen_am: new Date().toISOString() })
    .eq("id", meldungId)
    .eq("vermieter_id", user.id);
  if (error) return { error: "Konnte nicht gespeichert werden." };

  revalidatePath("/verbrauch");
  revalidatePath("/portal");
  return { ok: true, verbrauchGebucht };
}
