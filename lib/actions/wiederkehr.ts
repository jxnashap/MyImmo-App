"use server";

// Wiederkehrende Buchungen: Vorlagen verwalten und daraus die einzelnen
// Buchungen erzeugen (rückwirkend bis 10 Jahre, mit Dedup). Bewusst NICHT
// vollautomatisch — der Nutzer stößt das Erzeugen an und sieht vorab, wie
// viele Buchungen entstehen (kein stilles Auto-Insert).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { faelligeDaten, offeneDaten, ZYKLEN, type Zyklus } from "@/lib/wiederkehr";

export type WkResult = { ok: boolean; error?: string };

function zahl(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const text = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};

async function uid() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createVorlage(fd: FormData): Promise<WkResult> {
  const { supabase, user } = await uid();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const art = fd.get("art") === "einnahme" ? "einnahme" : "kosten";
  const kategorie = text(fd.get("kategorie"));
  const betrag = zahl(fd.get("betrag"));
  const zyklus = String(fd.get("zyklus") ?? "");
  const start = text(fd.get("start_datum"));
  const ende = text(fd.get("ende_datum"));

  if (!kategorie) return { ok: false, error: "Bitte eine Kategorie wählen." };
  if (!betrag || betrag <= 0) return { ok: false, error: "Betrag muss größer als 0 sein." };
  if (!ZYKLEN.includes(zyklus as Zyklus)) return { ok: false, error: "Bitte einen Zyklus wählen." };
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start))
    return { ok: false, error: "Bitte ein gültiges Startdatum wählen." };
  if (ende && ende < start) return { ok: false, error: "Das Enddatum liegt vor dem Start." };

  const { error } = await supabase.from("wiederkehrende_buchungen").insert({
    user_id: user.id,
    art,
    prop_id: text(fd.get("prop_id")),
    mieter_id: text(fd.get("mieter_id")),
    kategorie,
    betrag,
    beschreibung: text(fd.get("beschreibung")),
    zyklus,
    start_datum: start,
    ende_datum: ende,
    aktiv: true,
  });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath("/wiederkehrend");
  return { ok: true };
}

export async function setVorlageAktiv(id: string, aktiv: boolean): Promise<WkResult> {
  const { supabase, user } = await uid();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const { error } = await supabase
    .from("wiederkehrende_buchungen")
    .update({ aktiv })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Konnte Status nicht ändern." };
  revalidatePath("/wiederkehrend");
  return { ok: true };
}

// Vorlage löschen. Die bereits erzeugten Buchungen bleiben erhalten (ihr
// wiederkehr_id wird durch ON DELETE SET NULL zu einer normalen Buchung).
export async function deleteVorlage(id: string): Promise<WkResult> {
  const { supabase, user } = await uid();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const { error } = await supabase
    .from("wiederkehrende_buchungen")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidatePath("/wiederkehrend");
  return { ok: true };
}

// Erzeugt alle noch offenen Buchungen einer Vorlage (rückwirkend bis 10 Jahre).
// Idempotent: Termine, für die bereits eine von DIESER Vorlage erzeugte Buchung
// existiert, werden übersprungen.
export async function erzeugeBuchungen(
  vorlageId: string,
): Promise<{ ok: boolean; anzahl: number; error?: string }> {
  const { supabase, user } = await uid();
  if (!user) return { ok: false, anzahl: 0, error: "Nicht angemeldet." };

  const { data: v } = await supabase
    .from("wiederkehrende_buchungen")
    .select("*")
    .eq("id", vorlageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!v) return { ok: false, anzahl: 0, error: "Vorlage nicht gefunden." };

  const tabelle = v.art === "einnahme" ? "einnahmen" : "kosten";

  // Bereits erzeugte Buchungen dieser Vorlage (für Dedup).
  const { data: vorhanden } = await supabase
    .from(tabelle)
    .select("buchungsdatum")
    .eq("wiederkehr_id", vorlageId);

  const faellig = faelligeDaten({
    zyklus: v.zyklus,
    start_datum: v.start_datum,
    ende_datum: v.ende_datum,
  });
  const offen = offeneDaten(faellig, (vorhanden ?? []).map((r) => r.buchungsdatum));
  if (offen.length === 0) return { ok: true, anzahl: 0 };

  const rows = offen.map((datum) => ({
    user_id: user.id,
    prop_id: v.prop_id,
    mieter_id: v.mieter_id,
    buchungsdatum: datum,
    kategorie: v.kategorie,
    betrag: v.betrag,
    beschreibung: v.beschreibung ?? `${v.kategorie} (wiederkehrend)`,
    wiederkehrend: true,
    wiederkehr_id: vorlageId,
  }));

  const { error } = await supabase.from(tabelle).insert(rows);
  if (error) return { ok: false, anzahl: 0, error: "Erzeugen fehlgeschlagen." };

  revalidatePath("/wiederkehrend");
  revalidatePath("/cashflow");
  revalidatePath(v.art === "einnahme" ? "/einnahmen" : "/kosten");
  return { ok: true, anzahl: rows.length };
}
