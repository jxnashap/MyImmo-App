"use server";

// ÖFFENTLICHE Action (kein Konto): Bank oder Makler schlagen über ihren Link 1–3 Termine vor oder
// hinterlassen eine Telefonnummer für einen Rückruf (06.10.2026). Nur nach dem Zugangscode — der
// Hash kommt aus dem httpOnly-Cookie der RICHTIGEN Art, nie aus dem Formular. Zeitpunkte kommen als
// Berliner Ortszeit aus `datetime-local` und werden hier nach UTC umgerechnet.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FREIGABE_COOKIE, FREIGABE_PFAD, type FreigabeArt } from "@/lib/freigabeCode";
import { TERMIN_MAX_VORSCHLAEGE, berlinZuIso, telefonGueltig, terminMeldung } from "@/lib/freigabeTermin";

export async function schlageTerminVor(
  art: FreigabeArt,
  token: string,
  fd: FormData,
): Promise<{ ok: true } | { error: string }> {
  if (art !== "bank" && art !== "makler") return { error: "Ungültiger Link." };
  if (!/^[0-9a-f-]{36}$/i.test(String(token))) return { error: "Ungültiger Link." };

  const hash = (await cookies()).get(FREIGABE_COOKIE[art])?.value;
  if (!hash) return { error: "Bitte die Seite neu laden und den Zugangscode eingeben." };

  const modus = String(fd.get("modus") ?? "");
  let vorschlaege: string[] = [];
  let telefon = String(fd.get("telefon") ?? "").trim();

  if (modus === "termine") {
    const roh = fd.getAll("vorschlag").map((v) => String(v).trim()).filter(Boolean);
    if (roh.length === 0) return { error: "Bitte mindestens einen Termin angeben." };
    if (roh.length > TERMIN_MAX_VORSCHLAEGE) return { error: "Höchstens drei Termine." };
    const iso = roh.map(berlinZuIso);
    if (iso.some((x) => !x)) return { error: "Bitte Datum und Uhrzeit vollständig angeben." };
    vorschlaege = iso as string[];
    if (new Set(vorschlaege).size !== vorschlaege.length) return { error: "Bitte drei verschiedene Zeitpunkte angeben." };
    if (vorschlaege.some((z) => new Date(z).getTime() <= Date.now())) return { error: "Termine müssen in der Zukunft liegen." };
    if (telefon && !telefonGueltig(telefon)) return { error: "Die Telefonnummer sieht nicht gültig aus." };
  } else if (modus === "rueckruf") {
    if (!telefonGueltig(telefon)) return { error: "Bitte eine gültige Telefonnummer angeben." };
  } else {
    return { error: "Bitte wählen: Termine vorschlagen oder Rückruf." };
  }
  if (!telefon) telefon = "";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("freigabe_public_termin", {
    p_art: art,
    p_token: token,
    p_code_hash: hash,
    p_modus: modus,
    p_vorschlaege: vorschlaege,
    p_ort: String(fd.get("ort") ?? "").trim().slice(0, 200),
    p_name: String(fd.get("name") ?? "").trim().slice(0, 200),
    p_telefon: telefon || null,
    p_nachricht: String(fd.get("nachricht") ?? "").trim().slice(0, 1000),
  });
  if (error) return { error: "Senden fehlgeschlagen — bitte später erneut versuchen." };
  const meldung = terminMeldung(data as string | null);
  if (meldung) return { error: meldung };

  revalidatePath(FREIGABE_PFAD[art](token));
  return { ok: true };
}
