"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl, sicheresZiel } from "@/lib/flash";
import { encryptDarlnr } from "@/lib/kreditData";

// Hilfsfunktionen zum Auslesen von FormData
function num(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return v == null || v === "" ? null : String(v);
}
// Pflichtbetrag: muss vorhanden und > 0 sein (negative/0-Buchungen würden
// die Dashboard- und Steuersummen verfälschen).
function posNum(fd: FormData, k: string, label: string): number {
  const n = num(fd, k);
  if (n == null) throw new Error(`Bitte ${label} angeben.`);
  if (n <= 0) throw new Error(`${label} muss größer als 0 sein.`);
  return n;
}

async function uid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function done(fd: FormData, fallback: string): never {
  revalidatePath("/", "layout");
  // `back` kommt aus einem Formularfeld und darf nur auf eine INTERNE Seite
  // zeigen — vorher wurde der Wert ungeprueft in redirect() gereicht.
  redirect(flashUrl(sicheresZiel(str(fd, "back"), fallback), "Gespeichert."));
}

// ===== EINNAHMEN =====
// Optionaler NK-Anteil (in „Miete" enthaltene NK-Vorauszahlung): muss, falls
// gesetzt, zwischen 0 und dem Betrag liegen.
function nkAnteil(fd: FormData): number | null {
  const nk = num(fd, "nk_anteil");
  if (nk != null && (nk < 0 || nk > posNum(fd, "betrag", "Betrag")))
    throw new Error("NK-Anteil muss zwischen 0 und dem Betrag liegen.");
  return nk;
}

// Mietmonat (Paket B, 06.10.2026): YYYY-MM aus dem Monatsfeld. Nur mitschreiben, wenn das
// Formular das Feld HAT — andere Formulare (Listen-Dialog) schicken es nicht und dürften einen
// gespeicherten Mietmonat sonst nicht still löschen.
function sollMonat(fd: FormData): { soll_monat?: string | null } {
  if (!fd.has("soll_monat")) return {};
  const v = String(fd.get("soll_monat") ?? "").trim();
  if (!v) return { soll_monat: null };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new Error("Mietmonat bitte als Monat angeben.");
  return { soll_monat: v };
}

export async function createEinnahme(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("einnahmen").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    mieter_id: str(fd, "mieter_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    kategorie: str(fd, "kategorie"),
    betrag: posNum(fd, "betrag", "Betrag"),
    beschreibung: str(fd, "beschreibung"),
    nk_anteil: nkAnteil(fd),
    ...sollMonat(fd),
  });
  if (error) throw new Error(error.message);
  done(fd, "/einnahmen");
}
export async function updateEinnahme(id: string, fd: FormData) {
  const { supabase } = await uid();
  const { error } = await supabase.from("einnahmen").update({
    prop_id: str(fd, "prop_id"),
    mieter_id: str(fd, "mieter_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    kategorie: str(fd, "kategorie"),
    betrag: posNum(fd, "betrag", "Betrag"),
    beschreibung: str(fd, "beschreibung"),
    nk_anteil: nkAnteil(fd),
    ...sollMonat(fd),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  done(fd, "/einnahmen");
}
export async function deleteEinnahme(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("einnahmen").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== KOSTEN =====
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Beleg in den privaten Storage-Bucket "belege" hochladen (Pfad =
// userId/UUID.ext, RLS je user_id-Ordner). Ersetzt die frühere
// Base64-in-DB-Ablage; rechnung_data wird beim Neuspeichern genullt
// (alte Base64-Belege bleiben über den Routen-Fallback lesbar).
async function rechnungHochladen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fd: FormData,
  altPath?: string | null,
) {
  const f = fd.get("rechnung");
  if (!f || typeof f === "string" || (f as File).size === 0) return {};
  const file = f as File;
  if (file.size > 15 * 1024 * 1024) throw new Error("Beleg zu groß (max. 15 MB).");
  const mime = file.type || "application/octet-stream";
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("belege").upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error("Upload fehlgeschlagen: " + error.message);
  if (altPath) await supabase.storage.from("belege").remove([altPath]); // alten Beleg ersetzen
  return {
    rechnung_name: file.name || "Beleg",
    rechnung_type: mime,
    rechnung_size: fmtSize(file.size),
    rechnung_path: path,
    rechnung_data: null,
  };
}

export async function createKosten(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("kosten").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    mieter_id: str(fd, "mieter_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    kategorie: str(fd, "kategorie"),
    betrag: posNum(fd, "betrag", "Betrag"),
    beschreibung: str(fd, "beschreibung"),
    ...(await rechnungHochladen(supabase, userId, fd)),
  });
  if (error) throw new Error(error.message);
  done(fd, "/kosten");
}
export async function updateKosten(id: string, fd: FormData) {
  const { supabase, userId } = await uid();
  const { data: alt } = await supabase.from("kosten").select("rechnung_path").eq("id", id).single();
  const { error } = await supabase.from("kosten").update({
    prop_id: str(fd, "prop_id"),
    mieter_id: str(fd, "mieter_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    kategorie: str(fd, "kategorie"),
    betrag: posNum(fd, "betrag", "Betrag"),
    beschreibung: str(fd, "beschreibung"),
    ...(await rechnungHochladen(supabase, userId, fd, alt?.rechnung_path)),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  done(fd, "/kosten");
}
export async function deleteKosten(id: string) {
  const { supabase } = await uid();
  // Beleg aus dem Storage mitlöschen (Aufräumen)
  const { data: k } = await supabase.from("kosten").select("rechnung_path").eq("id", id).single();
  if (k?.rechnung_path) await supabase.storage.from("belege").remove([k.rechnung_path]);
  const { error } = await supabase.from("kosten").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
export async function deleteRechnung(id: string) {
  const { supabase } = await uid();
  const { data: k } = await supabase.from("kosten").select("rechnung_path").eq("id", id).single();
  if (k?.rechnung_path) await supabase.storage.from("belege").remove([k.rechnung_path]);
  const { error } = await supabase
    .from("kosten")
    .update({ rechnung_name: null, rechnung_type: null, rechnung_size: null, rechnung_path: null, rechnung_data: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/kosten");
}

// ===== VERBRAUCH =====
export async function createVerbrauch(fd: FormData) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("verbrauch").insert({
    user_id: userId,
    prop_id: str(fd, "prop_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    art: str(fd, "art"),
    menge: num(fd, "menge"),
    einheit: str(fd, "einheit"),
    verbrauchkosten: num(fd, "verbrauchkosten"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/verbrauch");
}
export async function updateVerbrauch(id: string, fd: FormData) {
  const { supabase } = await uid();
  const { error } = await supabase.from("verbrauch").update({
    prop_id: str(fd, "prop_id"),
    buchungsdatum: str(fd, "buchungsdatum"),
    art: str(fd, "art"),
    menge: num(fd, "menge"),
    einheit: str(fd, "einheit"),
    verbrauchkosten: num(fd, "verbrauchkosten"),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  done(fd, "/verbrauch");
}
export async function deleteVerbrauch(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("verbrauch").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== KREDITE =====
// Rate ist Pflicht (Verknüpfungs-Audit A4) — auch im Bearbeiten-Dialog auf /kredite, der nur ein
// Browser-`required` hatte (Gesamtprüfung 07.10.2026, B19). 0 € nur bei abbezahltem Darlehen
// (Restschuld 0, B17). Wirft wie die übrigen Kredit-Actions; das Formular verhindert es vorher.
function pruefeKreditRate(fd: FormData) {
  const rate = num(fd, "monatsrate");
  const rest = num(fd, "restschuld");
  if (rate == null) throw new Error("Bitte die monatliche Rate laut Darlehensvertrag eintragen.");
  if (rate < 0 || (rate === 0 && rest !== 0)) throw new Error("Eine Rate von 0 € gibt es nur bei einem abbezahlten Darlehen (Restschuld 0).");
}

export async function createKredit(fd: FormData) {
  pruefeKreditRate(fd);
  const { supabase, userId } = await uid();
  const { error } = await supabase.from("kredite").insert({
    user_id: userId,
    bezeichnung: str(fd, "bezeichnung"),
    prop_id: str(fd, "prop_id"),
    bank: str(fd, "bank"),
    darlnr: encryptDarlnr(str(fd, "darlnr")),
    betrag: num(fd, "betrag"),
    // Restschuld leer? → mit Darlehenssumme vorbelegen, sonst würde ein frisches
    // Darlehen (Restschuld 0/null) fälschlich als „100 % getilgt" dargestellt.
    restschuld: num(fd, "restschuld") ?? num(fd, "betrag"),
    grundschuld: num(fd, "grundschuld"),
    beleihung: num(fd, "beleihung"),
    zinssatz: num(fd, "zinssatz"),
    tilgungssatz: num(fd, "tilgungssatz"),
    monatsrate: num(fd, "monatsrate"),
    zinsbindung: str(fd, "zinsbindung"),
    auszahlung_datum: str(fd, "auszahlung_datum"),
    sonder: str(fd, "sonder"),
    laufzeit: num(fd, "laufzeit"),
  });
  if (error) throw new Error(error.message);
  done(fd, "/kredite");
}
export async function updateKredit(id: string, fd: FormData) {
  pruefeKreditRate(fd);
  const { supabase } = await uid();
  const { error } = await supabase.from("kredite").update({
    bezeichnung: str(fd, "bezeichnung"),
    prop_id: str(fd, "prop_id"),
    bank: str(fd, "bank"),
    darlnr: encryptDarlnr(str(fd, "darlnr")),
    betrag: num(fd, "betrag"),
    // Derselbe Rückfall wie beim Anlegen (Audit 07.10.2026, B18): Vorher wurde eine geleerte
    // Restschuld als null gespeichert → „100 % getilgt“ auf /kredite, Auslauf 0 %.
    restschuld: num(fd, "restschuld") ?? num(fd, "betrag"),
    grundschuld: num(fd, "grundschuld"),
    beleihung: num(fd, "beleihung"),
    zinssatz: num(fd, "zinssatz"),
    tilgungssatz: num(fd, "tilgungssatz"),
    monatsrate: num(fd, "monatsrate"),
    zinsbindung: str(fd, "zinsbindung"),
    auszahlung_datum: str(fd, "auszahlung_datum"),
    sonder: str(fd, "sonder"),
    laufzeit: num(fd, "laufzeit"),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  done(fd, "/kredite");
}
export async function deleteKredit(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("kredite").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ===== NOTIZEN =====
// Anlegen und Bearbeiten laufen über das Archiv (lib/actions/archiv.ts). Hier lagen bis 10.10.2026
// noch createNotiz/updateNotiz/deleteNotizDatei mit dem toten Ziel `/notizen` — nirgends aufgerufen
// (Gesamtprüfung C50). Geblieben ist nur das Löschen von der Objektseite.
export async function deleteNotiz(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("notizen").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
