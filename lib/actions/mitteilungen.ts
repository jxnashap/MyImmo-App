"use server";

// Mitteilungen an ein Haus / alle Mieter und Gebäude-Infos (02.10.2026, Schritt 6 aus
// docs/zukunft/MIETERPORTAL-AUSBAU.md § 9). Mitteilungen sind Zustellungen
// (art = 'mitteilung'): je verbundenem, aktivem Konto eine Zeile, zusammengehalten über
// `gruppe` — dieselben Schranken in der Datenbank wie bei Dokumenten.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zugangEndet } from "@/lib/mieterZugang";
import { heuteBerlin } from "@/lib/zeitraum";
import { benachrichtige } from "@/lib/benachrichtigung";

const MITTEILUNG_TITEL_MAX = 120;
const MITTEILUNG_TEXT_MAX = 4000;

type Zugang = { user_id: string; mieter_id: string; prop_id: string | null; email: string | null; mieter: { mietende: string | null } | null };

export async function sendeMitteilung(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const titel = String(fd.get("titel") ?? "").trim();
  const nachricht = String(fd.get("nachricht") ?? "").trim();
  const ziel = String(fd.get("ziel") ?? "");
  const bestaetigung = fd.get("bestaetigung") === "on";
  if (!titel || !nachricht) return { error: "Bitte Betreff und Text eingeben." };
  if (titel.length > MITTEILUNG_TITEL_MAX) return { error: `Betreff höchstens ${MITTEILUNG_TITEL_MAX} Zeichen.` };
  if (nachricht.length > MITTEILUNG_TEXT_MAX) return { error: `Text höchstens ${MITTEILUNG_TEXT_MAX} Zeichen.` };
  if (!ziel) return { error: "Bitte wählen, an wen die Mitteilung geht." };

  // Empfänger = verbundene Konten der EIGENEN Mieter, deren Zugang nicht abgelaufen ist.
  // Fehler bei der Abfrage = nichts senden (ein leeres Ergebnis sähe aus wie „niemand da“).
  let q = supabase
    .from("mieter_zugaenge")
    .select("user_id,mieter_id,prop_id,email,mieter:mieter_id(mietende)")
    .eq("vermieter_id", user.id);
  if (ziel !== "alle") q = q.eq("prop_id", ziel);
  const { data, error } = await q;
  if (error) return { error: "Empfänger konnten nicht ermittelt werden — nichts gesendet." };
  const heute = heuteBerlin();
  const empfaenger = ((data ?? []) as unknown as Zugang[]).filter((z) => {
    const ende = zugangEndet(z.mieter?.mietende ?? null);
    return !ende || heute <= ende;
  });
  if (empfaenger.length === 0) {
    return { error: "Niemand würde die Mitteilung sehen — kein Mieter mit aktivem Portal-Zugang." };
  }

  const gruppe = crypto.randomUUID();
  const zeilen = empfaenger.map((z) => ({
    vermieter_id: user.id,
    zugestellt_von: user.id,
    art: "mitteilung",
    titel,
    nachricht,
    mieter_id: z.mieter_id,
    empfaenger_user_id: z.user_id,
    empfaenger_email: z.email,
    bestaetigung_noetig: bestaetigung,
    gruppe,
  }));
  const { data: neu, error: iFehler } = await supabase.from("zustellungen").insert(zeilen).select("id");
  if (iFehler || !neu || (neu as unknown[]).length !== zeilen.length) {
    return { error: "Mitteilung konnte nicht gesendet werden — niemand sieht sie." };
  }
  for (const z of empfaenger) await benachrichtige(z.user_id, "mitteilung", gruppe);

  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true, anzahl: empfaenger.length };
}

export async function zieheMitteilungZurueck(gruppe: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data, error } = await supabase.rpc("mitteilung_zurueckziehen", { p_gruppe: gruppe });
  if (error || typeof data !== "number" || data < 1) return { error: "Zurückziehen fehlgeschlagen — die Mitteilung ist unverändert." };
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}

const INFO_FELDER = { hausmeister: 500, notdienst: 500, muell: 1000, hausordnung: 4000, sonstiges: 2000 } as const;

export async function speichereGebaeudeInfos(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const propId = String(fd.get("prop_id") ?? "");
  if (!propId) return { error: "Bitte ein Objekt wählen." };

  const werte: Record<string, string | null> = {};
  for (const [feld, max] of Object.entries(INFO_FELDER)) {
    const v = String(fd.get(feld) ?? "").trim();
    if (v.length > max) return { error: `Ein Feld ist zu lang (höchstens ${max} Zeichen).` };
    werte[feld] = v || null;
  }

  const { data, error } = await supabase
    .from("gebaeude_infos")
    .upsert({ prop_id: propId, vermieter_id: user.id, ...werte, updated_at: new Date().toISOString() }, { onConflict: "prop_id" })
    .select("prop_id")
    .maybeSingle();
  if (error || !data) return { error: "Gebäude-Infos konnten nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/portal");
  return { ok: true };
}
