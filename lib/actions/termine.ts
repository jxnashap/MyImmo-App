"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl } from "@/lib/flash";
import { TERMIN_KATEGORIEN, WIEDERKEHRUNGEN, naechsteFaelligkeit } from "@/lib/termine";

function feldWerte(formData: FormData) {
  const kategorie = String(formData.get("kategorie") ?? "");
  const wiederkehrung = String(formData.get("wiederkehrung") ?? "");
  const vorlauf = parseInt(String(formData.get("vorlauf_tage") ?? ""), 10);
  return {
    prop_id: (formData.get("prop_id") as string) || null,
    mieter_id: (formData.get("mieter_id") as string) || null,
    notiz: (formData.get("notiz") as string) || null,
    kategorie: (TERMIN_KATEGORIEN as readonly string[]).includes(kategorie) ? kategorie : null,
    wiederkehrung: (WIEDERKEHRUNGEN as readonly string[]).includes(wiederkehrung) ? wiederkehrung : null,
    vorlauf_tage: Number.isFinite(vorlauf) && vorlauf > 0 ? Math.min(vorlauf, 365) : null,
  };
}

export async function createTermin(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titel = String(formData.get("titel") ?? "").trim();
  const datum = String(formData.get("datum") ?? "");
  // Kommentarloses `return` war der Grund, warum ein unvollständiges Formular
  // nichts anlegte UND nichts sagte — der Nutzer klickte ein zweites Mal.
  if (!titel || !datum) {
    redirect(flashUrl("/termine", "Bitte Titel und Datum angeben — es wurde nichts angelegt."));
  }

  const { error } = await supabase.from("termine").insert({
    user_id: user.id,
    titel,
    datum,
    ...feldWerte(formData),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/termine");
  // Redirect statt nur revalidate: Damit ist das Formular geleert und der
  // Nutzer bekommt eine Bestätigung. Vorher blieben die Eingaben stehen, die
  // Liste war womöglich jahresgefiltert — und der Termin landete doppelt in
  // der Datenbank, weil man den Knopf erneut drückte.
  redirect(flashUrl("/termine", `„${titel}" für den ${deDatumKurz(datum)} angelegt.`));
}

/** "2026-08-01" → "01.08.2026" (nur für Meldungen). */
function deDatumKurz(iso: string): string {
  const [j, m, t] = iso.split("-");
  return t && m && j ? `${t}.${m}.${j}` : iso;
}

export async function updateTermin(id: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titel = String(formData.get("titel") ?? "").trim();
  const datum = String(formData.get("datum") ?? "");
  if (!titel || !datum) return;

  const { error } = await supabase.from("termine").update({
    titel,
    datum,
    ...feldWerte(formData),
  }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/termine");
  redirect(flashUrl("/termine", "Termin gespeichert."));
}

export async function deleteTermin(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("termine").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/termine");
}

// Erledigt-Haken: beim Erledigen eines wiederkehrenden Termins wird die
// nächste Instanz angelegt (der abgehakte Eintrag bleibt als Historie).
export async function toggleErledigt(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: t } = await supabase
    .from("termine")
    .select("id,titel,datum,prop_id,mieter_id,notiz,kategorie,wiederkehrung,vorlauf_tage,erledigt")
    .eq("id", id)
    .single();
  if (!t) throw new Error("Termin nicht gefunden.");

  const neuErledigt = !t.erledigt;
  const { error } = await supabase.from("termine").update({ erledigt: neuErledigt }).eq("id", id);
  if (error) throw new Error(error.message);

  if (neuErledigt && t.wiederkehrung && t.datum) {
    const next = naechsteFaelligkeit(t.datum, t.wiederkehrung);
    if (next) {
      // Doppelklick-Schutz: nächste Instanz nur, wenn nicht schon vorhanden.
      const { data: vorhanden } = await supabase
        .from("termine")
        .select("id")
        .eq("titel", t.titel)
        .eq("datum", next)
        .limit(1)
        .maybeSingle();
      if (!vorhanden) {
        await supabase.from("termine").insert({
          user_id: user.id,
          titel: t.titel,
          datum: next,
          prop_id: t.prop_id,
          mieter_id: t.mieter_id,
          notiz: t.notiz,
          kategorie: t.kategorie,
          wiederkehrung: t.wiederkehrung,
          vorlauf_tage: t.vorlauf_tage,
        });
      }
    }
  }

  revalidatePath("/termine");
}

// Wartungs-Vorlage per Klick anlegen (Kategorie + Intervall voreingestellt).
// Erste Fälligkeit: in 30 Tagen — das Datum passt der Nutzer danach an.
export async function createVorlageTermin(
  titel: string,
  wiederkehrung: string,
  kategorie: string,
  notiz: string,
  propId: string | null,
  formData?: FormData,
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Frueher: stilles `return`. Der Nutzer klickte, nichts passierte, keine
  // Meldung — ununterscheidbar von „gespeichert".
  if (!(WIEDERKEHRUNGEN as readonly string[]).includes(wiederkehrung)) {
    throw new Error(`Unbekanntes Intervall „${wiederkehrung}" — Termin nicht angelegt.`);
  }

  // Objekt: fest gebunden (Objektseite) oder aus dem Formular (Termine-Seite).
  const prop = propId || (formData ? String(formData.get("prop_id") ?? "") : "") || null;

  const d = new Date();
  d.setDate(d.getDate() + 30);
  const { error } = await supabase.from("termine").insert({
    user_id: user.id,
    titel,
    datum: d.toISOString().split("T")[0],
    prop_id: prop,
    notiz,
    kategorie: (TERMIN_KATEGORIEN as readonly string[]).includes(kategorie) ? kategorie : "Wartung",
    wiederkehrung,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/termine");
  if (prop) revalidatePath(`/properties/${prop}`);
}
