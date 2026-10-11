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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titel = String(formData.get("titel") ?? "").trim();
  const datum = String(formData.get("datum") ?? "");
  // Kommentarloses `return` war der Grund, warum ein unvollständiges Formular
  // nichts anlegte UND nichts sagte — der Nutzer klickte ein zweites Mal.
  if (!titel || !datum) {
    redirect(flashUrl("/termine", "Bitte Titel und Datum angeben — es wurde nichts angelegt.", "error"));
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
  redirect(flashUrl("/termine", `„${titel}“ für den ${deDatumKurz(datum)} angelegt.`));
}

/** "2026-08-01" → "01.08.2026" (nur für Meldungen). */
function deDatumKurz(iso: string): string {
  const [j, m, t] = iso.split("-");
  return t && m && j ? `${t}.${m}.${j}` : iso;
}

export async function updateTermin(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titel = String(formData.get("titel") ?? "").trim();
  const datum = String(formData.get("datum") ?? "");
  // Hier stand ein kommentarloses `return` — derselbe Fall, den `createTermin`
  // ein paar Zeilen weiter oben ausdrücklich als Fehler beschreibt: Der Nutzer
  // speichert, nichts passiert, nichts wird gesagt. Ununterscheidbar von Erfolg.
  if (!titel || !datum) {
    redirect(flashUrl("/termine", "Bitte Titel und Datum angeben — es wurde nichts gespeichert.", "error"));
  }

  // B12: Wer das Datum von Hand ändert, legt den Tag der Serie neu fest — sonst liefe der nächste
  // Folgetermin auf den alten Tag zurück. Gleiches Datum → Serientag bleibt (z. B. 31 trotz 28.02.).
  const { data: alt, error: altFehler } = await supabase
    .from("termine").select("datum").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (altFehler) throw new Error(altFehler.message);
  const { error } = await supabase.from("termine").update({
    titel,
    datum,
    ...feldWerte(formData),
    ...(alt && alt.datum !== datum ? { serien_tag: null } : {}),
  }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/termine");
  redirect(flashUrl("/termine", "Termin gespeichert."));
}

export async function deleteTermin(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("termine").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/termine");
}

// Erledigt-Haken: beim Erledigen eines wiederkehrenden Termins wird die
// nächste Instanz angelegt (der abgehakte Eintrag bleibt als Historie).
//
// B12 (Prüfstand 11.10.2026) — vorher in dieser Reihenfolge: erst „erledigt“ speichern, dann per
// Abfrage prüfen, dann den Folgetermin anlegen. Scheiterte der dritte Schritt, stand der Termin als
// erledigt da, der Folgetermin fehlte, und ein zweiter Klick schaltete den Haken wieder AUS. Zwei
// gleichzeitige Klicks legten zwei Folgetermine an (die Prüfung war nur eine Abfrage).
// JETZT:
//   1. `ziel` = gewünschter Zustand (vom Formular). Ist er schon erreicht, passiert nichts — eine
//      Wiederholung nach Zeitüberlauf schaltet nicht zurück.
//   2. ERST der Folgetermin, mit `vorgaenger_id` = dieser Termin (eindeutig, Migration
//      20261011120000): ein Termin hat höchstens EINEN Folgetermin, auch bei gleichzeitigen Klicks.
//   3. DANN „erledigt“. Scheitert Schritt 2, bleibt der Termin offen und der Fehler wird gezeigt.
//   4. Der Folgetermin rechnet vom TAG DER SERIE (`serien_tag`), nicht vom gekappten Vorgänger.
export async function toggleErledigt(id: string, ziel?: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: t, error: leseFehler } = await supabase
    .from("termine")
    .select("id,titel,datum,prop_id,mieter_id,notiz,kategorie,wiederkehrung,vorlauf_tage,erledigt,serien_tag")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (leseFehler) throw new Error(`Termin konnte nicht gelesen werden: ${leseFehler.message}`);
  if (!t) throw new Error("Termin nicht gefunden.");

  // Als Formular-Aktion kommt nach den gebundenen Werten ein FormData-Argument — nur ein echter
  // Wahrheitswert ist ein Ziel; sonst (alter Aufruf) wird umgeschaltet.
  const neuErledigt = typeof ziel === "boolean" ? ziel : !t.erledigt;
  if (neuErledigt === !!t.erledigt) {
    revalidatePath("/termine");
    return;
  }

  if (neuErledigt && t.wiederkehrung && t.datum) {
    const serienTag = t.serien_tag ?? Number(String(t.datum).slice(8, 10));
    const next = naechsteFaelligkeit(t.datum, t.wiederkehrung, serienTag);
    if (next) {
      // Altbestand ohne `vorgaenger_id` (vor der Migration angelegte Folgetermine): weiter über
      // Titel + Datum erkennen. Leer heißt „gibt es noch nicht“ — ein Fehler bricht deshalb ab.
      const { data: vorhanden, error: pruefFehler } = await supabase
        .from("termine")
        .select("id")
        .eq("user_id", user.id)
        .eq("titel", t.titel)
        .eq("datum", next)
        .limit(1)
        .maybeSingle();
      if (pruefFehler) throw new Error(`Folgetermin konnte nicht geprüft werden: ${pruefFehler.message}`);
      if (!vorhanden) {
        const { error: folgeFehler } = await supabase.from("termine").upsert({
          user_id: user.id,
          titel: t.titel,
          datum: next,
          prop_id: t.prop_id,
          mieter_id: t.mieter_id,
          notiz: t.notiz,
          kategorie: t.kategorie,
          wiederkehrung: t.wiederkehrung,
          vorlauf_tage: t.vorlauf_tage,
          vorgaenger_id: t.id,
          serien_tag: serienTag,
        }, { onConflict: "vorgaenger_id", ignoreDuplicates: true });
        // Der Termin bleibt OFFEN — sonst stünde er erledigt da, und der Folgetermin (der Zweck
        // einer Wiederkehrung) fehlte still.
        if (folgeFehler) throw new Error(`Folgetermin konnte nicht angelegt werden — der Termin bleibt offen: ${folgeFehler.message}`);
      }
    }
  }

  // Bedingt auf den gelesenen Zustand: Hat ein gleichzeitiger Klick ihn schon gesetzt, ändert sich nichts.
  const { error } = await supabase
    .from("termine")
    .update({ erledigt: neuErledigt })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("erledigt", !neuErledigt);
  if (error) throw new Error(error.message);

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Frueher: stilles `return`. Der Nutzer klickte, nichts passierte, keine
  // Meldung — ununterscheidbar von „gespeichert".
  if (!(WIEDERKEHRUNGEN as readonly string[]).includes(wiederkehrung)) {
    throw new Error(`Unbekanntes Intervall „${wiederkehrung}“ — Termin nicht angelegt.`);
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

// ---------------------------------------------------------------------------
// Abgeleitete Fristen aus- und wieder einblenden
// ---------------------------------------------------------------------------
// Abgeleitete Fristen (Miete, Kredit, Objekt, Steuer, Banking) werden aus den
// Stammdaten gerechnet und haben keine Zeile in `termine` — sie liessen sich
// deshalb weder abhaken noch loeschen. Eine einmal verpasste Frist blieb fuer
// immer stehen, bis die Liste ueberwiegend aus Altlasten bestand.
//
// Ausblenden loescht nichts: Die Frist ergibt sich weiter aus den Stammdaten,
// sie verschwindet nur aus der Ansicht.

// Der Schluessel wird in lib/termine.ts gebildet (fristSchluessel) — ein
// "use server"-Modul darf nur async Funktionen exportieren.
export async function blendeFristAus(schluessel: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("frist_ausgeblendet")
    .upsert({ user_id: user.id, schluessel }, { onConflict: "user_id,schluessel" });
  if (error) throw new Error(error.message);
  revalidatePath("/termine");
  revalidatePath("/");
}

export async function zeigeFristWieder(schluessel: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("frist_ausgeblendet")
    .delete()
    .eq("user_id", user.id)
    .eq("schluessel", schluessel);
  if (error) throw new Error(error.message);
  revalidatePath("/termine");
  revalidatePath("/");
}
