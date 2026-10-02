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
import { pruefeZustellung, type ZustellPruefung } from "@/lib/mieterZugang";

export type DokumentResult = { ok: boolean; error?: string };

async function archiviere(opts: {
  userId: string;
  mieterId: string;
  kategorie: string;
  titel: string;
  dateiname: string;
  pdf: Uint8Array;
  /** direkt im Mieterportal sichtbar machen */
  mieterFreigabe?: boolean;
}): Promise<DokumentResult> {
  const supabase = await createClient();

  // Fehler auswerten: Sonst landete das Dokument bei einem Abfragefehler ohne
  // Objekt-Zuordnung im Archiv — und der Nutzer fände es unter dem Objekt nicht.
  const { data: mieter, error: mieterFehler } = await supabase
    .from("mieter")
    .select("prop_id")
    .eq("id", opts.mieterId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (mieterFehler || !mieter) return { ok: false, error: "Mieter nicht gefunden." };

  const dateiData =
    "data:application/pdf;base64," + Buffer.from(opts.pdf).toString("base64");

  const { error } = await supabase.from("notizen").insert({
    user_id: opts.userId,
    mieter_id: opts.mieterId,
    prop_id: mieter.prop_id ?? null,
    kategorie: opts.kategorie,
    titel: opts.titel,
    datei_name: opts.dateiname,
    datei_type: "application/pdf",
    datei_size: opts.pdf.length,
    datei_data: dateiData,
    mieter_freigabe: opts.mieterFreigabe ?? false,
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
  const supabase = await createClient();
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
  zustellen = false,
): Promise<DokumentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const abrJahr = Number(jahr) || new Date().getFullYear() - 1;

  // Zustellen nur, wenn es jemand sehen kann und die Abrechnung zum Mietverhältnis
  // passt (docs/zukunft/MIETERPORTAL-AUSBAU.md, F5). Vorher meldete die Oberfläche
  // „im Mieterportal zugestellt“ auch ohne verbundenes Konto — der Vermieter glaubte
  // die Frist nach § 556 Abs. 3 BGB gewahrt, und niemand hatte etwas erhalten.
  // Dieselbe Prüfung zeigt der Dialog vorher an; hier ist sie die Schranke.
  if (zustellen) {
    const lage = await zustellLage(supabase, user.id, mieterId, abrJahr);
    if ("error" in lage) return { ok: false, error: lage.error };
    if (lage.sperre) return { ok: false, error: lage.sperre };
  }

  try {
    const doc = await erzeugeNkPdf(supabase, mieterId, abrJahr);
    if (!doc) return { ok: false, error: "Mieter nicht gefunden." };
    return archiviere({
      userId: user.id,
      mieterId,
      kategorie: "Nebenkostenabrechnung",
      titel: doc.titel,
      dateiname: doc.dateiname,
      pdf: doc.pdf,
      mieterFreigabe: zustellen,
    });
  } catch (e) {
    console.error("speichereNk:", e);
    return { ok: false, error: "PDF konnte nicht erzeugt werden." };
  }
}

/**
 * Alles, was die Zustell-Prüfung braucht — aus der Datenbank, nie vom Browser.
 * Fehler bei einer Abfrage = keine Zustellung (fail-closed): Ein leeres Ergebnis sähe
 * sonst aus wie „kein Hindernis“.
 */
async function zustellLage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mieterId: string,
  jahr: number,
): Promise<ZustellPruefung | { error: string }> {
  const [m, z, n] = await Promise.all([
    supabase.from("mieter").select("mietbeginn,mietende").eq("id", mieterId).eq("user_id", userId).maybeSingle(),
    supabase.from("mieter_zugaenge").select("email").eq("mieter_id", mieterId).eq("vermieter_id", userId).limit(1),
    supabase
      .from("notizen")
      .select("id")
      .eq("user_id", userId)
      .eq("mieter_id", mieterId)
      .eq("kategorie", "Nebenkostenabrechnung")
      .eq("titel", `Nebenkostenabrechnung ${jahr}`)
      .eq("mieter_freigabe", true)
      .limit(1),
  ]);
  if (m.error || z.error || n.error || !m.data) {
    return { error: "Zustellung konnte nicht geprüft werden — nichts zugestellt. Bitte erneut versuchen." };
  }
  const zug = (z.data ?? []) as { email: string | null }[];
  const mieter = m.data as { mietbeginn: string | null; mietende: string | null };
  return pruefeZustellung({
    verbunden: zug.length > 0,
    email: zug[0]?.email ?? null,
    mietbeginn: mieter.mietbeginn ?? null,
    mietende: mieter.mietende ?? null,
    jahr,
    schonZugestellt: ((n.data ?? []) as unknown[]).length > 0,
  });
}

export async function speichereProtokoll(
  mieterId: string,
  fields: ProtokollFields,
): Promise<DokumentResult> {
  const supabase = await createClient();
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
