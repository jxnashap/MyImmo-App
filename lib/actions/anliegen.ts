"use server";

// Anliegen im Mieterportal (Etappe 2): Mieter erstellt Schaden/Dokument/Frage,
// Vermieter setzt Status und antwortet. RLS sichert beide Seiten ab.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TYPEN = ["schaden", "dokument", "frage"] as const;
const STATI = ["offen", "in_arbeit", "erledigt"] as const;

// Anhänge: Fotos + PDF, max. 3 Dateien à 4 MB (Base64 in der DB).
const MAX_DATEIEN = 3;
const MAX_GROESSE = 4 * 1024 * 1024;
const ERLAUBTE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function erstelleAnliegen(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const typ = String(formData.get("typ") ?? "frage");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  if (!TYPEN.includes(typ as (typeof TYPEN)[number])) return { error: "Ungültiger Typ." };
  if (!titel) return { error: "Bitte gib einen Betreff an." };

  // Zugang des Mieter-Kontos → Vermieter/Wohnung ableiten (nicht vom Client vertrauen)
  const { data: zugang } = await supabase
    .from("mieter_zugaenge")
    .select("vermieter_id,mieter_id,prop_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!zugang) return { error: "Dein Konto ist mit keiner Wohnung verknüpft." };

  // Anhänge VOR dem Insert validieren (kein halbes Anliegen bei Fehler)
  const dateien = formData
    .getAll("dateien")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (dateien.length > MAX_DATEIEN) return { error: `Maximal ${MAX_DATEIEN} Dateien.` };
  for (const f of dateien) {
    if (f.size > MAX_GROESSE) return { error: `„${f.name}" ist größer als 4 MB.` };
    if (!ERLAUBTE_MIME.includes(f.type)) return { error: `„${f.name}": nur Fotos (JPG/PNG/WebP/HEIC) oder PDF.` };
  }

  const { data: neu, error } = await supabase
    .from("anliegen")
    .insert({
      mieter_user_id: user.id,
      vermieter_id: zugang.vermieter_id,
      mieter_id: zugang.mieter_id,
      prop_id: zugang.prop_id,
      typ,
      titel,
      beschreibung: beschreibung || null,
    })
    .select("id")
    .single();
  if (error || !neu) return { error: "Anliegen konnte nicht gespeichert werden." };

  for (const f of dateien) {
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    const { error: fehlerDatei } = await supabase.from("anliegen_dateien").insert({
      anliegen_id: neu.id,
      name: f.name,
      mime: f.type,
      groesse: f.size,
      daten: b64,
    });
    if (fehlerDatei) return { error: `Anliegen gespeichert, aber „${f.name}" konnte nicht hochgeladen werden.` };
  }

  revalidatePath("/portal");
  revalidatePath("/anliegen");
  return { ok: true };
}

// ---- Terminkoordination: Vermieter schlägt Slots vor, Mieter bestätigt ----

const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/; // datetime-local

/** Vermieter: bis zu 3 Terminvorschläge ans Anliegen hängen (ersetzt alte,
 *  setzt eine evtl. vorhandene Bestätigung zurück). */
export async function schlageTermineVor(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const slots = ["slot1", "slot2", "slot3"]
    .map((k) => String(formData.get(k) ?? "").trim())
    .filter((s) => SLOT_RE.test(s))
    .map((s) => s.slice(0, 16));
  if (!id) return { error: "Ungültige Eingabe." };
  if (slots.length === 0) return { error: "Bitte mindestens einen Termin angeben." };

  const { error } = await supabase
    .from("anliegen")
    .update({
      termin_vorschlaege: slots,
      termin_bestaetigt: null,
      status: "in_arbeit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("vermieter_id", user.id);
  if (error) return { error: "Termine konnten nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}

/** Mieter: einen der vorgeschlagenen Termine bestätigen. Der DB-Trigger
 *  stellt sicher, dass nur ein echter Vorschlag bestätigt werden kann. */
export async function bestaetigeAnliegenTermin(id: string, slot: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!id || !SLOT_RE.test(slot)) return { error: "Ungültige Eingabe." };

  const { error } = await supabase
    .from("anliegen")
    .update({ termin_bestaetigt: slot.slice(0, 16), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mieter_user_id", user.id);
  if (error) return { error: "Termin konnte nicht bestätigt werden." };
  revalidatePath("/portal");
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: den vom Mieter bestätigten Termin in den Kalender übernehmen. */
export async function terminInKalender(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: a } = await supabase
    .from("anliegen")
    .select("titel,termin_bestaetigt,prop_id")
    .eq("id", id)
    .eq("vermieter_id", user.id)
    .maybeSingle();
  if (!a?.termin_bestaetigt) return { error: "Kein bestätigter Termin vorhanden." };

  const uhrzeit = a.termin_bestaetigt.slice(11, 16);
  const { error } = await supabase.from("termine").insert({
    user_id: user.id,
    titel: `Termin: ${a.titel}`.slice(0, 200),
    datum: a.termin_bestaetigt.slice(0, 10),
    prop_id: a.prop_id ?? null,
    kategorie: "Sonstiges",
    notiz: `Mit dem Mieter vereinbarter Termin (${uhrzeit} Uhr) — aus Anliegen übernommen.`,
  });
  if (error) return { error: "Kalendereintrag konnte nicht angelegt werden." };
  revalidatePath("/termine");
  return { ok: true };
}

export async function bearbeiteAnliegen(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const antwort = String(formData.get("antwort") ?? "").trim();
  if (!id || !STATI.includes(status as (typeof STATI)[number])) return { error: "Ungültige Eingabe." };

  const { error } = await supabase
    .from("anliegen")
    .update({ status, antwort: antwort || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("vermieter_id", user.id);
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}
