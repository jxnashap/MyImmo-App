"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/secure";
import { BELEIHUNG_CHECKLISTE, type BelDok } from "@/lib/beleihung";
import { berechneNk, type NkRawPosition } from "@/lib/nk";
import { buildNkPdf, vermieterAus } from "@/lib/pdf/nkPdf";
import {
  buildKennblattPdf,
  buildMietaufstellungPdf,
  type BelObjektDaten,
  type BelAbsender,
} from "@/lib/pdf/beleihungPdf";

async function uid() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const DOK_FELDER = "item_key,status,notiz,datum,datei_name,datei_type,datei_size";

// Sensible Dateiinhalte verschlüsseln, WENN ein Schlüssel konfiguriert ist —
// sonst (wie bisher) als base64-Klartext ablegen. Die Datei-Routen entschlüsseln
// tolerant (Klartext-Altzeilen bleiben unverändert), Bestand bleibt lesbar.
function schuetze(dataUri: string): string {
  return process.env.DATA_ENCRYPTION_KEY ? encrypt(dataUri) : dataUri;
}

function pruefeKey(itemKey: string) {
  if (!BELEIHUNG_CHECKLISTE.some((i) => i.key === itemKey)) {
    throw new Error("Unbekanntes Checklisten-Item.");
  }
}

// Status setzen (abhaken / wieder öffnen) — Datei bleibt erhalten.
export async function setBeleihungStatus(
  propId: string,
  itemKey: string,
  status: "offen" | "hochgeladen" | "erledigt",
): Promise<BelDok> {
  pruefeKey(itemKey);
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("beleihung_dokumente")
    .upsert(
      { user_id: userId, prop_id: propId, item_key: itemKey, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,prop_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as BelDok;
}

// Datum (z. B. Ausstellungsdatum des Dokuments) speichern.
export async function setBeleihungDatum(propId: string, itemKey: string, datum: string | null): Promise<BelDok> {
  pruefeKey(itemKey);
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("beleihung_dokumente")
    .upsert(
      { user_id: userId, prop_id: propId, item_key: itemKey, datum: datum || null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,prop_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as BelDok;
}

// Datei hochladen (base64 inline, wie Archiv) → Status 'hochgeladen'.
export async function uploadBeleihungDatei(propId: string, itemKey: string, fd: FormData): Promise<BelDok> {
  pruefeKey(itemKey);
  const f = fd.get("datei");
  if (!f || typeof f === "string" || (f as File).size === 0) throw new Error("Keine Datei gewählt.");
  const file = f as File;
  if (file.size > 8 * 1024 * 1024) throw new Error("Datei zu groß (max. 8 MB).");
  const mime = file.type || "application/octet-stream";
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("beleihung_dokumente")
    .upsert(
      {
        user_id: userId,
        prop_id: propId,
        item_key: itemKey,
        status: "hochgeladen",
        datei_name: file.name || "Dokument",
        datei_type: mime,
        datei_size: file.size,
        datei_data: schuetze(`data:${mime};base64,${base64}`),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,prop_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as BelDok;
}

// Datei entfernen — Status zurück auf 'offen' (außer manuell erledigt).
export async function removeBeleihungDatei(propId: string, itemKey: string): Promise<BelDok> {
  pruefeKey(itemKey);
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("beleihung_dokumente")
    .upsert(
      {
        user_id: userId,
        prop_id: propId,
        item_key: itemKey,
        status: "offen",
        datei_name: null,
        datei_type: null,
        datei_size: null,
        datei_data: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,prop_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as BelDok;
}

// ===== „Aus MyImmo erzeugen": Kennblatt / Mietaufstellung / NK-Abrechnung =====

async function ladeObjektDaten(supabase: ReturnType<typeof createClient>, propId: string) {
  const [{ data: prop }, { data: mieter }, { data: kredite }, { data: profil }] = await Promise.all([
    supabase
      .from("properties")
      .select("id,bezeichnung,adresse,typ,baujahr,flaeche,zimmer,energieklasse,kaufpreis,wert,miete,hausgeld")
      .eq("id", propId)
      .single(),
    supabase
      .from("mieter")
      .select("id,vorname,nachname,einheit,flaeche,kaltmiete,nk_vorauszahlung,mietbeginn,mietende,mieter_adresse")
      .eq("prop_id", propId)
      .order("einheit"),
    supabase.from("kredite").select("restschuld,betrag").eq("prop_id", propId),
    supabase.from("vermieter_profil").select("name,strasse,plz,ort,email").limit(1).maybeSingle(),
  ]);
  if (!prop) throw new Error("Objekt nicht gefunden.");

  const aktive = (mieter ?? []).filter((m) => !m.mietende || new Date(m.mietende) >= new Date());
  const mieteMo = aktive.reduce((s, m) => s + (m.kaltmiete ?? 0), 0);
  const restschuld = (kredite ?? []).reduce((s, k) => s + (k.restschuld ?? k.betrag ?? 0), 0);

  const objekt: BelObjektDaten = {
    bezeichnung: prop.bezeichnung,
    adresse: prop.adresse,
    typ: prop.typ,
    baujahr: prop.baujahr,
    flaeche: prop.flaeche,
    zimmer: prop.zimmer,
    energieklasse: prop.energieklasse,
    kaufpreis: prop.kaufpreis,
    wert: prop.wert,
    mieteMo: mieteMo > 0 ? mieteMo : prop.miete ?? 0,
    restschuld,
    hausgeld: prop.hausgeld,
  };
  const absender: BelAbsender = {
    name: profil?.name || "MyImmo",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  };
  return { objekt, mieterAktiv: aktive, alleMieter: mieter ?? [], absender, profil };
}

async function speichereAutoPdf(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propId: string,
  itemKey: string,
  dateiName: string,
  pdf: Uint8Array,
  notiz: string | null,
): Promise<BelDok> {
  const { data, error } = await supabase
    .from("beleihung_dokumente")
    .upsert(
      {
        user_id: userId,
        prop_id: propId,
        item_key: itemKey,
        status: "hochgeladen",
        notiz,
        datei_name: dateiName,
        datei_type: "application/pdf",
        datei_size: pdf.length,
        datei_data: schuetze(`data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,prop_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as BelDok;
}

// Erzeugt das Auto-Dokument (kennblatt | mietaufstellung | nk) aus App-Daten
// und legt es direkt als Datei am Checklisten-Item ab.
export async function generiereBeleihungDokument(propId: string, itemKey: string): Promise<BelDok> {
  const item = BELEIHUNG_CHECKLISTE.find((i) => i.key === itemKey);
  if (!item?.auto) throw new Error("Dieses Item kann nicht automatisch erzeugt werden.");
  const { supabase, userId } = await uid();
  const { objekt, mieterAktiv, absender, profil } = await ladeObjektDaten(supabase, propId);
  const slug = objekt.bezeichnung.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, "_").slice(0, 40);

  if (item.auto === "kennblatt") {
    const pdf = await buildKennblattPdf(objekt, absender);
    return speichereAutoPdf(supabase, userId, propId, itemKey, `Kennblatt_${slug}.pdf`, pdf, "Aus MyImmo erzeugt");
  }

  if (item.auto === "mietaufstellung") {
    if (!mieterAktiv.length) throw new Error("Keine aktiven Mieter am Objekt.");
    const zeilen = mieterAktiv.map((m) => ({
      einheit: m.einheit,
      name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
      flaeche: m.flaeche,
      kaltmiete: m.kaltmiete,
      nkVz: m.nk_vorauszahlung,
      mietbeginn: m.mietbeginn,
    }));
    const pdf = await buildMietaufstellungPdf(objekt, zeilen, absender);
    return speichereAutoPdf(supabase, userId, propId, itemKey, `Mietaufstellung_${slug}.pdf`, pdf, "Aus MyImmo erzeugt");
  }

  // NK-Abrechnung: letztes abgeschlossenes Jahr, erster aktiver Mieter mit Positionen.
  const jahr = new Date().getFullYear() - 1;
  for (const m of mieterAktiv) {
    const { data: positions } = await supabase
      .from("mieter_positionen")
      .select("bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr,aufteilung,verbrauch_mieter,verbrauch_gesamt,grundkosten_prozent,flaeche_gesamt")
      .eq("mieter_id", m.id)
      .order("created_at");
    const posJahr = (positions ?? []).filter((p) => p.jahr == null || p.jahr === jahr);
    if (!posJahr.length) continue;

    const abrechnung = berechneNk(
      jahr,
      {
        vorname: m.vorname,
        nachname: m.nachname,
        mieter_adresse: m.mieter_adresse,
        einheit: m.einheit,
        flaeche: m.flaeche,
        mietbeginn: m.mietbeginn,
        mietende: m.mietende,
        nk_vorauszahlung: m.nk_vorauszahlung,
      },
      { bezeichnung: objekt.bezeichnung, adresse: objekt.adresse ?? null },
      posJahr as NkRawPosition[],
    );
    const pdf = await buildNkPdf(abrechnung, vermieterAus(profil, null));
    const name = [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter";
    return speichereAutoPdf(
      supabase,
      userId,
      propId,
      itemKey,
      `NK_${jahr}_${slug}.pdf`,
      pdf,
      `NK-Abrechnung ${jahr} für ${name} (aus MyImmo erzeugt)`,
    );
  }
  throw new Error(`Keine NK-Positionen für ${jahr} gefunden — erst unter Mieter → NK-Abrechnung Positionen erfassen.`);
}

// ===== Phase 2: Freigabe-Links für die Bank =====

export type Freigabe = {
  token: string;
  item_keys: string[];
  ablauf: string;
  aktiv: boolean;
  created_at: string | null;
};

// Freigabe erstellen: Eigentümer wählt Dokumente + Ablauf; Angaben (Wunsch-
// Konditionen) werden mitgespeichert und auf der Bank-Seite angezeigt.
export async function createFreigabe(
  propId: string,
  itemKeys: string[],
  angaben: Record<string, string>,
  tageAblauf: number,
): Promise<Freigabe> {
  const keys = itemKeys.filter((k) => BELEIHUNG_CHECKLISTE.some((i) => i.key === k));
  if (!keys.length) throw new Error("Bitte mindestens ein Dokument auswählen.");
  const tage = [7, 14, 30].includes(tageAblauf) ? tageAblauf : 14;

  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("beleihung_freigaben")
    .insert({
      user_id: userId,
      prop_id: propId,
      item_keys: keys,
      angaben,
      ablauf: new Date(Date.now() + tage * 24 * 3600 * 1000).toISOString(),
    })
    .select("token,item_keys,ablauf,aktiv,created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Freigabe;
}

// Freigabe widerrufen (owner-scoped über RLS).
export async function widerrufeFreigabe(token: string): Promise<void> {
  const { supabase } = await uid();
  const { error } = await supabase
    .from("beleihung_freigaben")
    .update({ aktiv: false })
    .eq("token", token);
  if (error) throw new Error(error.message);
}
