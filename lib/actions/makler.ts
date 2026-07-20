"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/secure";
import { MAKLER_CHECKLISTE, istMaklerKey, type MaklerDok } from "@/lib/makler";
import { buildKaeuferSelbstauskunftPdf } from "@/lib/pdf/kaeuferPdf";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";

// Sensible Dateiinhalte verschlüsseln, WENN ein Schlüssel konfiguriert ist —
// sonst (wie bisher) als base64-Klartext ablegen. decrypt() beim Ausliefern ist
// tolerant und gibt Klartext-Altzeilen unverändert zurück.
function schuetze(dataUri: string): string {
  return process.env.DATA_ENCRYPTION_KEY ? encrypt(dataUri) : dataUri;
}

// Server-Actions für den Makler-Ordner. Nutzergebunden (nicht objektabhängig):
// unique (user_id, item_key). Datei als base64-Data-URI inline (wie Beleihung),
// RLS schützt je Nutzer. Sensible Inhalte (SCHUFA/Einkommen/Ausweis) — siehe
// Datensparsamkeits-Hinweise in der UI.

async function uid() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const DOK_FELDER = "item_key,status,notiz,datum,datei_name,datei_type,datei_size";

function pruefeKey(itemKey: string) {
  if (!istMaklerKey(itemKey)) throw new Error("Unbekanntes Checklisten-Item.");
}

// Status setzen (abhaken / wieder öffnen) — Datei bleibt erhalten.
export async function setMaklerStatus(
  itemKey: string,
  status: "offen" | "hochgeladen" | "erledigt",
): Promise<MaklerDok> {
  pruefeKey(itemKey);
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("makler_dokumente")
    .upsert(
      { user_id: userId, item_key: itemKey, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as MaklerDok;
}

// Datum (z. B. Ausstellungsdatum) speichern.
export async function setMaklerDatum(itemKey: string, datum: string | null): Promise<MaklerDok> {
  pruefeKey(itemKey);
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("makler_dokumente")
    .upsert(
      { user_id: userId, item_key: itemKey, datum: datum || null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as MaklerDok;
}

// Datei hochladen (base64 inline, ≤ 8 MB) → Status 'hochgeladen'.
export async function uploadMaklerDatei(itemKey: string, fd: FormData): Promise<MaklerDok> {
  pruefeKey(itemKey);
  const f = fd.get("datei");
  if (!f || typeof f === "string" || (f as File).size === 0) throw new Error("Keine Datei gewählt.");
  const file = f as File;
  if (file.size > 8 * 1024 * 1024) throw new Error("Datei zu groß (max. 8 MB).");
  const mime = file.type || "application/octet-stream";
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("makler_dokumente")
    .upsert(
      {
        user_id: userId,
        item_key: itemKey,
        status: "hochgeladen",
        datei_name: file.name || "Dokument",
        datei_type: mime,
        datei_size: file.size,
        datei_data: schuetze(`data:${mime};base64,${base64}`),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as MaklerDok;
}

// „Aus MyImmo erzeugen": Käufer-Selbstauskunft-PDF aus der (verschlüsselten)
// Selbstauskunft + Vermieter-/Nutzerprofil erzeugen und am Item ablegen.
export async function generiereMaklerDokument(itemKey: string): Promise<MaklerDok> {
  const item = MAKLER_CHECKLISTE.find((i) => i.key === itemKey);
  if (item?.auto !== "kaeufer_selbstauskunft") {
    throw new Error("Dieses Item kann nicht automatisch erzeugt werden.");
  }
  const { supabase, userId } = await uid();

  const daten = await ladeSelbstauskunft();
  if (!daten) {
    throw new Error("Keine Selbstauskunft gefunden — fülle sie erst im Kauf-Assistenten aus.");
  }
  const { data: profil } = await supabase
    .from("vermieter_profil")
    .select("name,strasse,plz,ort,email")
    .limit(1)
    .maybeSingle();

  const absender = {
    name: profil?.name || "Käufer/in",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  };

  const pdf = await buildKaeuferSelbstauskunftPdf(daten, absender);
  const dataUri = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;

  const { data, error } = await supabase
    .from("makler_dokumente")
    .upsert(
      {
        user_id: userId,
        item_key: itemKey,
        status: "hochgeladen",
        notiz: "Aus MyImmo erzeugt",
        datei_name: "Kaeufer-Selbstauskunft.pdf",
        datei_type: "application/pdf",
        datei_size: pdf.length,
        datei_data: schuetze(dataUri),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as MaklerDok;
}

// Datei entfernen — Status zurück auf 'offen'.
export async function removeMaklerDatei(itemKey: string): Promise<MaklerDok> {
  pruefeKey(itemKey);
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("makler_dokumente")
    .upsert(
      {
        user_id: userId,
        item_key: itemKey,
        status: "offen",
        datei_name: null,
        datei_type: null,
        datei_size: null,
        datei_data: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_key" },
    )
    .select(DOK_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return data as MaklerDok;
}
