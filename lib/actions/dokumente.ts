"use server";

// „Speichern"-Aktionen für Brief, NK-Abrechnung und Übergabeprotokoll:
// erzeugen DASSELBE PDF wie die Download-Routen (lib/pdf/erzeugen.ts) und
// legen es als Archiv-Eintrag (Tabelle notizen) beim Mieter ab.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  erzeugeBriefPdf,
  erzeugeNkPdf,
  erzeugeProtokollPdf,
  type BriefFields,
  type ProtokollFields,
} from "@/lib/pdf/erzeugen";

export type DokumentResult = { ok: boolean; error?: string };

async function archiviere(opts: {
  userId: string;
  mieterId: string;
  kategorie: string;
  titel: string;
  dateiname: string;
  pdf: Uint8Array;
}): Promise<DokumentResult> {
  const supabase = createClient();

  const { data: mieter } = await supabase
    .from("mieter")
    .select("prop_id")
    .eq("id", opts.mieterId)
    .single();

  const dateiData =
    "data:application/pdf;base64," + Buffer.from(opts.pdf).toString("base64");

  const { error } = await supabase.from("notizen").insert({
    user_id: opts.userId,
    mieter_id: opts.mieterId,
    prop_id: mieter?.prop_id ?? null,
    kategorie: opts.kategorie,
    titel: opts.titel,
    datei_name: opts.dateiname,
    datei_type: "application/pdf",
    datei_size: opts.pdf.length,
    datei_data: dateiData,
  });
  if (error) return { ok: false, error: "Speichern im Archiv fehlgeschlagen." };

  revalidatePath("/archiv");
  revalidatePath(`/tenants/${opts.mieterId}`);
  return { ok: true };
}

export async function speichereBrief(
  mieterId: string,
  fields: BriefFields,
): Promise<DokumentResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  try {
    const doc = await erzeugeBriefPdf(supabase, user.id, mieterId, fields);
    if (!doc) return { ok: false, error: "Mieter nicht gefunden." };
    return archiviere({
      userId: user.id,
      mieterId,
      kategorie: "Schreiben / Brief",
      titel: doc.titel,
      dateiname: doc.dateiname,
      pdf: doc.pdf,
    });
  } catch (e) {
    console.error("speichereBrief:", e);
    return { ok: false, error: "PDF konnte nicht erzeugt werden." };
  }
}

export async function speichereNk(
  mieterId: string,
  jahr: number,
): Promise<DokumentResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  try {
    const doc = await erzeugeNkPdf(supabase, mieterId, Number(jahr) || new Date().getFullYear() - 1);
    if (!doc) return { ok: false, error: "Mieter nicht gefunden." };
    return archiviere({
      userId: user.id,
      mieterId,
      kategorie: "Nebenkostenabrechnung",
      titel: doc.titel,
      dateiname: doc.dateiname,
      pdf: doc.pdf,
    });
  } catch (e) {
    console.error("speichereNk:", e);
    return { ok: false, error: "PDF konnte nicht erzeugt werden." };
  }
}

export async function speichereProtokoll(
  mieterId: string,
  fields: ProtokollFields,
): Promise<DokumentResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  try {
    const doc = await erzeugeProtokollPdf(supabase, user.id, mieterId, fields);
    if (!doc) return { ok: false, error: "Mieter nicht gefunden." };
    return archiviere({
      userId: user.id,
      mieterId,
      kategorie: "Übergabeprotokoll",
      titel: doc.titel,
      dateiname: doc.dateiname,
      pdf: doc.pdf,
    });
  } catch (e) {
    console.error("speichereProtokoll:", e);
    return { ok: false, error: "PDF konnte nicht erzeugt werden." };
  }
}
