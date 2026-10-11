"use server";

// „Speichern"-Aktionen für Brief, NK-Abrechnung und Übergabeprotokoll:
// erzeugen DASSELBE PDF wie die Download-Routen (lib/pdf/erzeugen.ts) und
// legen es als Archiv-Eintrag (Tabelle notizen) beim Mieter ab.

import { dbFehlerText } from "@/lib/demoFehler";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  erzeugeBriefPdf,
  erzeugeNkPdf,
  erzeugeProtokollPdf,
  type BriefFields,
  type ProtokollFields,
} from "@/lib/pdf/erzeugen";
import { ladeZustellLage, zustelle, type Empfaenger } from "@/lib/zustellung";
import { SCHRIFTFORM, digitalGesperrt, istAbgelehnt } from "@/lib/briefPruefung";
import { hinweisMailText } from "@/lib/zugang";
import type { DocArt } from "@/lib/dokumentVorlagen";

export type DokumentResult = {
  ok: boolean;
  /** Ablauf F: Dasselbe Formular kam ein zweites Mal — das vorhandene Schreiben gilt, nichts doppelt. */
  wiederholt?: boolean;
  error?: string;
  zugestelltAn?: string[];
  /** Was aus der Hinweis-Mail wurde (lib/zugang.ts) — null/fehlend, wenn es nichts zu sagen gibt. */
  hinweis?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function archiviere(opts: {
  userId: string;
  mieterId: string;
  kategorie: string;
  titel: string;
  dateiname: string;
  pdf: Uint8Array;
  /** direkt im Mieterportal zustellen — an genau diese Konten (lib/zustellung.ts) */
  zustellenAn?: Empfaenger[];
  /** Mieter soll „gelesen und bestätigt“ klicken. */
  bestaetigung?: boolean;
  /** Vorgangskennung des Formulars (Ablauf F): zweites Absenden → dasselbe Schreiben, nichts doppelt. */
  vorgang?: string | null;
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

  const vorgang = opts.vorgang && UUID_RE.test(opts.vorgang) ? opts.vorgang : null;
  const { data: eingefuegt, error } = await supabase.from("notizen").insert({
    // Nur mitschicken, wenn gesetzt — ohne Kennung bleibt der Weg wie vorher.
    ...(vorgang ? { vorgang } : {}),
    user_id: opts.userId,
    mieter_id: opts.mieterId,
    prop_id: mieter.prop_id ?? null,
    kategorie: opts.kategorie,
    titel: opts.titel,
    datei_name: opts.dateiname,
    datei_type: "application/pdf",
    datei_size: opts.pdf.length,
    datei_data: dateiData,
    // Nur noch Merkmal „war zum Zustellen gedacht“ — sichtbar macht es allein eine
    // Zeile in `zustellungen` (Migration 20261002140000).
    mieter_freigabe: !!opts.zustellenAn,
  }).select("id").single();
  let neu = eingefuegt as { id: string } | null;
  let wiederholt = false;
  // Ablauf F: Dasselbe Formular zum zweiten Mal (Zeitüberlauf, Doppelklick, Neustart) — das Schreiben
  // liegt schon im Archiv. Kein zweites anlegen; die Zustellung unten ist ebenfalls je Empfänger einmalig.
  if (error?.code === "23505" && vorgang) {
    const { data: vorhanden, error: e2 } = await supabase
      .from("notizen").select("id").eq("user_id", opts.userId).eq("vorgang", vorgang).maybeSingle();
    if (e2 || !vorhanden) return { ok: false, error: "Speichern im Archiv fehlgeschlagen." };
    neu = vorhanden as { id: string };
    wiederholt = true;
  } else if (error || !neu) {
    // Demo-Sperre sagt, warum (Audit P5, B54) — nicht „fehlgeschlagen“.
    return { ok: false, error: dbFehlerText(error, "Speichern im Archiv fehlgeschlagen.") };
  }

  revalidatePath("/archiv");
  revalidatePath(`/tenants/${opts.mieterId}`);
  if (!opts.zustellenAn) return { ok: true, ...(wiederholt ? { wiederholt } : {}) };

  const z = await zustelle(supabase, {
    userId: opts.userId,
    mieterId: opts.mieterId,
    notizId: (neu as { id: string }).id,
    titel: opts.titel,
    empfaenger: opts.zustellenAn,
    bestaetigung: !!opts.bestaetigung,
  });
  revalidatePath("/portal");
  if (!z.ok) return { ok: false, error: `Im Archiv gespeichert, aber nicht zugestellt: ${z.error}` };
  return { ok: true, zugestelltAn: z.an, hinweis: hinweisMailText(z.hinweisMail), ...(wiederholt ? { wiederholt } : {}) };
}

export type BriefZustellLage = { sperre: string | null; warnungen: string[]; an: string[] } | { error: string };

/**
 * Wer bekäme den Brief im Mieterportal? Für die Bestätigungskarte VOR dem Zustellen
 * (05.10.2026, Mahnung „ins Portal stellen“). Dieselbe Prüfung wie bei der NK-Abrechnung;
 * `speichereBrief(…, { zustellen: true })` wiederholt sie als Schranke.
 */
export async function pruefeBriefZustellung(mieterId: string): Promise<BriefZustellLage> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const lage = await ladeZustellLage(supabase, user.id, mieterId, { jahr: null });
  if ("error" in lage) return { error: lage.error };
  return { sperre: lage.sperre, warnungen: lage.warnungen, an: lage.empfaenger.map((e) => e.email ?? "Portal-Konto") };
}

export async function speichereBrief(
  mieterId: string,
  fields: BriefFields,
  versand: { zustellen?: boolean; bestaetigung?: boolean } = {},
  vorgang?: string,
): Promise<DokumentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Zustellen nur nach derselben Prüfung wie bei der NK-Abrechnung — die Karte im Browser
  // zeigt sie an, hier ist sie die Schranke (kein verbundenes Konto → nichts zustellen).
  let zustellenAn: Empfaenger[] | undefined;
  if (versand.zustellen) {
    // Schriftform (Gesamtprüfung P3, A8): Eine Kündigung im Portal wäre unwirksam (§ 568 Abs. 1,
    // §§ 126, 125 BGB) — die Oberfläche zeigt den Weg gar nicht erst, hier ist die Schranke.
    if (digitalGesperrt(fields.art)) return { ok: false, error: SCHRIFTFORM[fields.art as DocArt]?.text ?? "" };
    const lage = await ladeZustellLage(supabase, user.id, mieterId, { jahr: null });
    if ("error" in lage) return { ok: false, error: lage.error };
    if (lage.sperre) return { ok: false, error: lage.sperre };
    zustellenAn = lage.empfaenger;
  }

  try {
    const doc = await erzeugeBriefPdf(supabase, user.id, mieterId, fields);
    if (!doc) return { ok: false, error: "Mieter nicht gefunden." };
    if (istAbgelehnt(doc)) return { ok: false, error: doc.abgelehnt.join(" ") };
    return archiviere({
      userId: user.id,
      mieterId,
      kategorie: "Schreiben / Brief",
      titel: doc.titel,
      dateiname: doc.dateiname,
      pdf: doc.pdf,
      zustellenAn,
      bestaetigung: versand.bestaetigung,
      vorgang,
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
  vorgang?: string,
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
  let zustellenAn: Empfaenger[] | undefined;
  if (zustellen) {
    const lage = await ladeZustellLage(supabase, user.id, mieterId, { jahr: abrJahr });
    if ("error" in lage) return { ok: false, error: lage.error };
    if (lage.sperre) return { ok: false, error: lage.sperre };
    zustellenAn = lage.empfaenger;
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
      zustellenAn,
      vorgang,
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
