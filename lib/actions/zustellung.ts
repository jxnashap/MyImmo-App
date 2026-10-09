"use server";

// Zustellungen ins Mieterportal (02.10.2026): Archiv-Dokument zustellen, zurückziehen,
// und — beim Mieter — „gelesen und bestätigt“. Ersetzt den Schalter `mieter_freigabe`,
// der ein Dokument jedem zeigte, der gerade an der Mieter-Zeile hing.
// Hintergrund: docs/zukunft/MIETERPORTAL-AUSBAU.md, S1/S6/S9 und Abschnitt 9.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ladeZustellLage, zustelle } from "@/lib/zustellung";
import { hinweisMailText } from "@/lib/zugang";

export type ZustellErgebnis = { ok: true; an?: string[]; hinweis?: string | null } | { error: string };

/** Ein vorhandenes Archiv-Dokument dem Mieter zustellen, dem es zugeordnet ist. */
export async function stelleDokumentZu(notizId: string, bestaetigung = false): Promise<ZustellErgebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: n, error } = await supabase
    .from("notizen")
    .select("id,mieter_id,titel,datei_name")
    .eq("id", notizId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !n) return { error: "Dokument nicht gefunden." };
  const doc = n as { id: string; mieter_id: string | null; titel: string | null; datei_name: string | null };
  if (!doc.mieter_id) return { error: "Das Dokument ist keinem Mieter zugeordnet — bitte zuerst im Archiv zuordnen." };
  if (!doc.datei_name) return { error: "Das Dokument hat keine Datei — es gäbe nichts zu sehen." };

  const lage = await ladeZustellLage(supabase, user.id, doc.mieter_id, { jahr: null, notizId: doc.id });
  if ("error" in lage) return { error: lage.error };
  if (lage.sperre) return { error: lage.sperre };

  const z = await zustelle(supabase, {
    userId: user.id,
    mieterId: doc.mieter_id,
    notizId: doc.id,
    titel: doc.titel ?? doc.datei_name,
    empfaenger: lage.empfaenger,
    bestaetigung,
  });
  if (!z.ok) return { error: z.error };

  revalidatePath(`/tenants/${doc.mieter_id}`);
  revalidatePath("/portal");
  return { ok: true, an: z.an, hinweis: hinweisMailText(z.hinweisMail) };
}

/** Zustellung zurückziehen: sofort unsichtbar für den Mieter, die Zeile bleibt als Protokoll. */
export async function zieheZustellungZurueck(zustellungId: string, mieterId?: string): Promise<ZustellErgebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data, error } = await supabase.rpc("zustellung_zurueckziehen", { p_id: zustellungId });
  if (error || data !== true) return { error: "Zurückziehen fehlgeschlagen — die Zustellung ist unverändert." };

  if (mieterId) revalidatePath(`/tenants/${mieterId}`);
  revalidatePath("/portal");
  return { ok: true };
}

/** Mieter: „gelesen und zur Kenntnis genommen“ — keine Unterschrift, nur dieser Klick. */
export async function bestaetigeZustellung(zustellungId: string): Promise<ZustellErgebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data, error } = await supabase.rpc("zustellung_bestaetigen", { p_id: zustellungId });
  if (error || data !== true) return { error: "Bestätigung konnte nicht gespeichert werden." };

  revalidatePath("/portal");
  return { ok: true };
}
