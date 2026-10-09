"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto/secure";
import { pruefeFrischeAnmeldung, REAUTH_MELDUNG } from "@/lib/auth/frisch";
import { erzeugeMaklerCode, maklerCodeHash } from "@/lib/maklerCode";
import { EMAIL } from "@/lib/mahnung";
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
  const supabase = await createClient();
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
export async function generiereMaklerDokument(itemKey: string, opts: { personenstand?: boolean } = {}): Promise<MaklerDok> {
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

  // P4 (C45): Personenstand nur auf ausdrückliche Wahl (Standard: weglassen).
  const pdf = await buildKaeuferSelbstauskunftPdf(daten, absender, { personenstand: opts.personenstand === true });
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

// ===== Freigabe-Link für den Makler (05.10.2026, Migration 20261005160000) =====
// Gegenstück zum Bank-Link. Lesen nur über `makler_public_info`/`makler_public_datei` (Token,
// aktiv, Ablauf in der Datenbank geprüft); jeder Datei-Abruf landet im Abruf-Protokoll.

export type MaklerFreigabe = {
  token: string;
  item_keys: string[];
  ablauf: string;
  aktiv: boolean;
  created_at: string | null;
  empfaenger_email: string | null;
};

const FREIGABE_FELDER = "token,item_keys,ablauf,aktiv,created_at,empfaenger_email";

// Seit 05.10.2026 mit Zugangscode und Empfänger: Der Code wird hier erzeugt, EINMAL zurückgegeben
// (für die vorbereitete Mail und die Anzeige) und nur als HMAC gespeichert.
export async function createMaklerFreigabe(
  itemKeys: string[],
  tageAblauf: number,
  empfaengerEmail: string,
): Promise<{ freigabe: MaklerFreigabe; code: string }> {
  const keys = [...new Set(itemKeys)].filter((k) => istMaklerKey(k));
  if (!keys.length) throw new Error("Bitte mindestens ein Dokument auswählen.");
  const tage = [7, 14, 30].includes(tageAblauf) ? tageAblauf : 14;
  const email = String(empfaengerEmail ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) throw new Error("Bitte eine gültige E-Mail-Adresse des Maklers eintragen.");

  const { supabase, userId } = await uid();
  // Der Link öffnet Ausweis- und Bonitätsunterlagen für jeden, der ihn hat — wie beim Bank-Link
  // eine frische Anmeldung verlangen.
  const frisch = await pruefeFrischeAnmeldung(supabase);
  if (!frisch.ok) throw new Error(REAUTH_MELDUNG);

  // Nur Dokumente, die wirklich eine Datei haben — sonst verspricht der Link etwas Leeres.
  const { data: vorhanden, error: lesefehler } = await supabase
    .from("makler_dokumente")
    .select("item_key,datei_name")
    .eq("user_id", userId)
    .in("item_key", keys);
  if (lesefehler) throw new Error(lesefehler.message);
  const mitDatei = keys.filter((k) => (vorhanden ?? []).some((d) => d.item_key === k && !!d.datei_name));
  if (!mitDatei.length) throw new Error("Zu den gewählten Punkten ist noch keine Datei hinterlegt.");

  const token = crypto.randomUUID();
  const code = erzeugeMaklerCode();
  const { data, error } = await supabase
    .from("makler_freigaben")
    .insert({
      token,
      user_id: userId,
      item_keys: mitDatei,
      ablauf: new Date(Date.now() + tage * 24 * 3600 * 1000).toISOString(),
      empfaenger_email: email,
      code_hash: maklerCodeHash(token, code),
    })
    .select(FREIGABE_FELDER)
    .single();
  if (error) throw new Error(error.message);
  return { freigabe: data as MaklerFreigabe, code };
}

// Widerrufen: der Link ist sofort ungültig. Wieder aktivieren lässt die Datenbank nicht zu.
export async function widerrufeMaklerFreigabe(token: string): Promise<void> {
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from("makler_freigaben")
    .update({ aktiv: false })
    .eq("token", token)
    .eq("user_id", userId)
    .select("token")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Link nicht gefunden.");
}
