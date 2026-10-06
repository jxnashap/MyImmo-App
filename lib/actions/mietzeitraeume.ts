"use server";

// Miet-Zeiträume: pro Mieter mehrere Perioden mit eigener Kaltmiete/NK/
// Stellplatzmiete. von/bis sind Monats-Anker (immer der 1. des Monats);
// bis = null heißt offen/laufend.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vertragswerte } from "@/lib/mietkonto";
import { planeMietaenderung, type Betraege, type ZeitraumZeile } from "@/lib/sollAb";
import { schreibeMietaenderung } from "@/lib/mietaenderung";
import { staffelPlan } from "@/lib/staffel";

export type MietZeitraumResult = { ok: boolean; error?: string };

function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// "YYYY-MM" (input type=month) → "YYYY-MM-01"; leere Eingabe → null.
function monat(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}$/.test(v)) return null;
  return `${v}-01`;
}

async function uid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function felder(fd: FormData) {
  return {
    von: monat(fd, "von"),
    bis: monat(fd, "bis"),
    kaltmiete: num(fd, "kaltmiete"),
    nk_vorauszahlung: num(fd, "nk_vorauszahlung"),
    stellplatz_miete: num(fd, "stellplatz_miete"),
  };
}

export async function createMietZeitraum(mieterId: string, fd: FormData): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const f = felder(fd);
  if (!f.von) return { ok: false, error: "Bitte den ersten Monat (von) angeben." };
  if (f.bis && f.bis < f.von) return { ok: false, error: "\u201eBis\u201c liegt vor \u201eVon\u201c." };

  // prop_id aus dem Mieter übernehmen (praktisch für Objektauswertungen).
  // Fail-closed: Ein fremder oder nicht lesbarer Mieter bekommt keinen
  // Zeitraum — vorher wäre er mit prop_id null angelegt worden.
  const { data: mieter, error: mieterFehler } = await supabase
    .from("mieter")
    .select("prop_id")
    .eq("id", mieterId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mieterFehler || !mieter) return { ok: false, error: "Mieter nicht gefunden." };

  const { error } = await supabase.from("miet_zeitraeume").insert({
    user_id: userId,
    mieter_id: mieterId,
    prop_id: mieter.prop_id ?? null,
    ...f,
  });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}

export async function updateMietZeitraum(id: string, mieterId: string, fd: FormData): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const f = felder(fd);
  if (!f.von) return { ok: false, error: "Bitte den ersten Monat (von) angeben." };
  if (f.bis && f.bis < f.von) return { ok: false, error: "\u201eBis\u201c liegt vor \u201eVon\u201c." };

  const { error } = await supabase.from("miet_zeitraeume").update(f).eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}

export async function deleteMietZeitraum(id: string, mieterId: string): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const { error } = await supabase.from("miet_zeitraeume").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}

/**
 * Neue Beträge ab einem Monat (Paket B, 06.10.2026) — z. B. die angepasste NK-Vorauszahlung
 * nach § 560 Abs. 4 BGB. Nicht genannte Beträge bleiben, wie sie in diesem Monat gelten.
 * Frühere Monate behalten ihre Werte (planeMietaenderung schließt Lücken mit den alten).
 *
 * Schreibt NUR Miet-Zeiträume, nicht die Felder am Mieter: Die bleiben der Grundwert, auf dem
 * z. B. der Staffelplan rechnet. Was in einem Monat gilt, sagt `vertragswerte()`.
 */
export async function setzeMieteAb(
  mieterId: string,
  abYm: string,
  aenderung: Partial<Betraege>,
): Promise<MietZeitraumResult> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };
  const r = await mieteAbAnwenden(supabase, userId, mieterId, [{ abYm, aenderung }]);
  if (!r.ok) return r;
  revalidatePath(`/tenants/${mieterId}`);
  revalidatePath("/mietkonto");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Staffelmiete ins Mietkonto (Paket B, 06.10.2026): jede Stufe des Staffelplans als Miet-Zeitraum
 * ab ihrem Monat. Vorher erzeugte der Plan nur eine Frist — das Soll blieb die Anfangsmiete.
 * Stufen, die schon als Zeitraum mit genau dieser Kaltmiete beginnen, werden übersprungen
 * (mehrfaches Klicken ändert nichts). Rechnung: `staffelPlan()` wie auf der Mieterseite.
 */
export async function uebernehmeStaffel(mieterId: string): Promise<MietZeitraumResult & { stufen?: number }> {
  const { supabase, userId } = await uid();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };
  const [mRes, zRes] = await Promise.all([
    supabase.from("mieter").select("mietart,kaltmiete,staffel_datum,staffel_intervall,staffel_typ,staffel_betrag,staffel_prozent,staffel_stufen").eq("id", mieterId).eq("user_id", userId).maybeSingle(),
    supabase.from("miet_zeitraeume").select("von,kaltmiete").eq("mieter_id", mieterId).eq("user_id", userId),
  ]);
  if (mRes.error || zRes.error || !mRes.data) return { ok: false, error: "Mieter nicht gefunden." };
  const m = mRes.data as {
    mietart: string | null; kaltmiete: number | null; staffel_datum: string | null; staffel_intervall: string | null;
    staffel_typ: string | null; staffel_betrag: number | null; staffel_prozent: number | null; staffel_stufen: number | null;
  };
  if ((m.mietart ?? "").toLowerCase() !== "staffel" || !m.staffel_datum) return { ok: false, error: "Kein Staffelplan hinterlegt." };
  const plan = staffelPlan({
    startMiete: Number(m.kaltmiete) || 0,
    startDatum: m.staffel_datum,
    intervallMonate: Number(m.staffel_intervall) || 12,
    typ: m.staffel_typ === "prozent" ? "prozent" : "betrag",
    betrag: m.staffel_betrag,
    prozent: m.staffel_prozent,
    stufen: m.staffel_stufen ?? 0,
  });
  if (plan.length === 0) return { ok: false, error: "Der Staffelplan ist unvollständig (Betrag oder Prozent fehlt)." };
  const vorhanden = new Set(((zRes.data ?? []) as { von: string; kaltmiete: number | null }[]).map((z) => `${z.von.slice(0, 7)}|${Number(z.kaltmiete)}`));
  const offen = plan.filter((st) => !vorhanden.has(`${st.datum.slice(0, 7)}|${st.miete}`));
  if (offen.length === 0) return { ok: true, stufen: 0 };

  const r = await mieteAbAnwenden(supabase, userId, mieterId, offen.map((st) => ({ abYm: st.datum.slice(0, 7), aenderung: { kaltmiete: st.miete } })));
  if (!r.ok) return r;
  revalidatePath(`/tenants/${mieterId}`);
  revalidatePath("/mietkonto");
  revalidatePath("/");
  return { ok: true, stufen: offen.length };
}

/** Wendet Änderungen nacheinander an (aufsteigend nach Monat), liest dazwischen neu. */
async function mieteAbAnwenden(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mieterId: string,
  schritte: { abYm: string; aenderung: Partial<Betraege> }[],
): Promise<MietZeitraumResult> {
  for (const { abYm, aenderung } of schritte) {
    if (!/^\d{4}-\d{2}$/.test(abYm)) return { ok: false, error: "Bitte einen Monat angeben." };
    for (const v of Object.values(aenderung)) {
      if (v != null && (!Number.isFinite(v) || v < 0)) return { ok: false, error: "Ungültiger Betrag." };
    }
  }
  for (const { abYm, aenderung } of [...schritte].sort((a, b) => a.abYm.localeCompare(b.abYm))) {
    const [mRes, zRes] = await Promise.all([
      supabase.from("mieter").select("prop_id,mietbeginn,kaltmiete,nk_vorauszahlung,stellplatz_miete").eq("id", mieterId).eq("user_id", userId).maybeSingle(),
      supabase.from("miet_zeitraeume").select("id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete").eq("mieter_id", mieterId).eq("user_id", userId),
    ]);
    if (mRes.error || zRes.error || !mRes.data) return { ok: false, error: "Mieter nicht gefunden." };
    const m = mRes.data as { prop_id: string | null; mietbeginn: string | null } & Betraege;
    const zr = (zRes.data ?? []) as ZeitraumZeile[];
    if (!m.mietbeginn) return { ok: false, error: "Ohne Mietbeginn kennt das Mietkonto kein Soll — bitte zuerst den Mietbeginn eintragen." };

    const jetzt = vertragswerte(m, zr, abYm);
    const neu: Betraege = {
      kaltmiete: aenderung.kaltmiete ?? jetzt.kaltmiete,
      nk_vorauszahlung: aenderung.nk_vorauszahlung ?? jetzt.nk,
      stellplatz_miete: aenderung.stellplatz_miete ?? jetzt.stellplatz,
    };
    const alt: Betraege = { kaltmiete: m.kaltmiete, nk_vorauszahlung: m.nk_vorauszahlung, stellplatz_miete: m.stellplatz_miete };
    const plan = planeMietaenderung({ mietbeginn: m.mietbeginn, alt, neu, zeitraeume: zr, abYm });
    if (!plan.neu && !plan.ersetzen) return { ok: false, error: "Der Monat liegt am oder vor dem Mietbeginn — dann im Mieter selbst ändern." };
    const r = await schreibeMietaenderung(supabase, { userId, mieterId, propId: m.prop_id, plan });
    if ("error" in r) return { ok: false, error: r.error };
  }
  return { ok: true };
}
