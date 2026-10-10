"use server";

// Anliegen im Mieterportal (Etappe 2): Mieter erstellt Schaden/Dokument/Frage,
// Vermieter setzt Status; beide schreiben Nachrichten in den Verlauf (seit 02.10.2026,
// lib/vorgang.ts). RLS sichert beide Seiten ab.
import { dbFehlerText } from "@/lib/demoFehler";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pruefeNachricht } from "@/lib/vorgang";
import { benachrichtige } from "@/lib/benachrichtigung";

const TYPEN = ["schaden", "dokument", "frage"] as const;
const STATI = ["offen", "in_arbeit", "erledigt"] as const;

// Anhänge: Fotos + PDF, max. 3 Dateien à 4 MB (Base64 in der DB).
const MAX_DATEIEN = 3;
const MAX_GROESSE = 4 * 1024 * 1024;
const ERLAUBTE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function erstelleAnliegen(formData: FormData) {
  const supabase = await createClient();
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
    if (f.size > MAX_GROESSE) return { error: `„${f.name}“ ist größer als 4 MB.` };
    if (!ERLAUBTE_MIME.includes(f.type)) return { error: `„${f.name}“: nur Fotos (JPG/PNG/WebP/HEIC) oder PDF.` };
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
  // Demo-Sperre sagt, warum (Audit P5, B54): Schaden melden und Dokument anfragen endeten in
  // der Demo in „konnte nicht gespeichert werden“.
  if (error || !neu) return { error: dbFehlerText(error, "Anliegen konnte nicht gespeichert werden.") };

  for (const f of dateien) {
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    const { error: fehlerDatei } = await supabase.from("anliegen_dateien").insert({
      anliegen_id: neu.id,
      name: f.name,
      mime: f.type,
      groesse: f.size,
      daten: b64,
    });
    if (fehlerDatei) return { error: `Anliegen gespeichert, aber „${f.name}“ konnte nicht hochgeladen werden.` };
  }

  await benachrichtige(zugang.vermieter_id, "anliegen_neu", neu.id);

  revalidatePath("/portal");
  revalidatePath("/anliegen");
  return { ok: true };
}

// ---- Terminkoordination: Vermieter schlägt Slots vor, Mieter bestätigt ----

const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/; // datetime-local

/** Vermieter: bis zu 3 Terminvorschläge ans Anliegen hängen (ersetzt alte,
 *  setzt eine evtl. vorhandene Bestätigung zurück). */
export async function schlageTermineVor(formData: FormData) {
  const supabase = await createClient();
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

  const { data, error } = await supabase
    .from("anliegen")
    .update({
      termin_vorschlaege: slots,
      termin_bestaetigt: null,
      status: "in_arbeit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("vermieter_id", user.id)
    .select("mieter_user_id")
    .maybeSingle();
  if (error) return { error: "Termine konnten nicht gespeichert werden." };
  await benachrichtige((data as { mieter_user_id?: string } | null)?.mieter_user_id, "termine", id);
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}

/** Mieter: einen der vorgeschlagenen Termine bestätigen. Der DB-Trigger
 *  stellt sicher, dass nur ein echter Vorschlag bestätigt werden kann. */
export async function bestaetigeAnliegenTermin(id: string, slot: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!id || !SLOT_RE.test(slot)) return { error: "Ungültige Eingabe." };

  const { data, error } = await supabase
    .from("anliegen")
    .update({ termin_bestaetigt: slot.slice(0, 16), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mieter_user_id", user.id)
    .select("vermieter_id")
    .maybeSingle();
  if (error) return { error: "Termin konnte nicht bestätigt werden." };
  await benachrichtige((data as { vermieter_id?: string } | null)?.vermieter_id, "termin_bestaetigt", id);
  revalidatePath("/portal");
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: den vom Mieter bestätigten Termin in den Kalender übernehmen. */
export async function terminInKalender(id: string) {
  const supabase = await createClient();
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

/**
 * Vermieter: Status setzen und optional eine Nachricht in den Verlauf schreiben.
 * Seit 02.10.2026 überschreibt die Nachricht nichts mehr (vorher: Feld `antwort`) —
 * sie wird ein Eintrag im Verlauf. Den Statuswechsel schreibt die Datenbank mit.
 */
export async function bearbeiteAnliegen(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const nachricht = String(formData.get("nachricht") ?? "").trim();
  if (!id || !STATI.includes(status as (typeof STATI)[number])) return { error: "Ungültige Eingabe." };
  if (nachricht) {
    const p = pruefeNachricht(nachricht);
    if (!p.ok) return { error: p.fehler };
  }

  // Erst die Nachricht: Scheitert sie, bleibt auch der Status stehen — sonst stünde
  // „erledigt“ ohne die Erklärung dazu im Verlauf.
  if (nachricht) {
    const { error: nFehler } = await supabase.from("anliegen_ereignisse").insert({
      anliegen_id: id,
      autor_id: user.id,
      autor_rolle: "vermieter",
      art: "nachricht",
      text: nachricht,
    });
    if (nFehler) return { error: "Nachricht konnte nicht gespeichert werden — nichts geändert." };
  }

  const { data, error } = await supabase
    .from("anliegen")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("vermieter_id", user.id)
    .select("id,mieter_user_id")
    .maybeSingle();
  if (error || !data) return { error: nachricht ? "Nachricht gesendet, Status aber nicht gespeichert." : "Konnte nicht gespeichert werden." };
  if (nachricht) await benachrichtige((data as { mieter_user_id?: string }).mieter_user_id, "nachricht_an_mieter", id);
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}

/**
 * Nachricht im Verlauf eines Anliegens — für Mieter UND Vermieter. Die Rolle kommt aus
 * dem Anliegen selbst (wer ist wer), nie vom Browser; die Datenbank prüft sie erneut.
 */
export async function schreibeNachricht(anliegenId: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const p = pruefeNachricht(text);
  if (!p.ok) return { error: p.fehler };

  const { data: a, error: aFehler } = await supabase
    .from("anliegen")
    .select("id,vermieter_id,mieter_user_id")
    .eq("id", anliegenId)
    .maybeSingle();
  if (aFehler || !a) return { error: "Anliegen nicht gefunden." };
  const rolle = a.vermieter_id === user.id ? "vermieter" : a.mieter_user_id === user.id ? "mieter" : null;
  if (!rolle) return { error: "Anliegen nicht gefunden." };

  const { error } = await supabase.from("anliegen_ereignisse").insert({
    anliegen_id: anliegenId,
    autor_id: user.id,
    autor_rolle: rolle,
    art: "nachricht",
    text: p.text,
  });
  if (error) {
    return {
      error: rolle === "mieter"
        ? "Nachricht konnte nicht gesendet werden. Ist dein Portal-Zugang noch aktiv?"
        : "Nachricht konnte nicht gespeichert werden.",
    };
  }
  await benachrichtige(
    rolle === "mieter" ? a.vermieter_id : a.mieter_user_id,
    rolle === "mieter" ? "nachricht_an_vermieter" : "nachricht_an_mieter",
    anliegenId,
  );
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}
