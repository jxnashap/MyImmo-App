"use server";

// Vermieter-Seite des Bewerbungs-Systems: Links verwalten, Bewerbungen
// bewerten/löschen und die eigene E-Signatur pflegen.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function erstelleBewerberLink(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const propId = String(formData.get("propId") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  if (!propId) return { error: "Bitte ein Objekt wählen." };

  const { error } = await supabase.from("bewerber_links").insert({
    user_id: user.id,
    prop_id: propId,
    titel: titel || null,
  });
  if (error) return { error: "Link konnte nicht erstellt werden." };
  revalidatePath("/bewerbungen");
  return { ok: true };
}

/**
 * Objekt-Steckbrief (Anzeige-Eckdaten) + gewünschte Dokument-Slots eines
 * Bewerbungs-Links speichern. Zahlen tolerant parsen (deutsches Komma),
 * Slots gegen den Katalog whitelisten.
 */
export async function aktualisiereBewerberLink(id: string, fd: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const zahl = (k: string): number | null => {
    const roh = String(fd.get(k) ?? "").trim().replace(/\./g, "").replace(",", ".");
    if (!roh) return null;
    const n = Number(roh);
    return Number.isFinite(n) && n >= 0 && n < 100000000 ? n : null;
  };
  const text = (k: string, max: number): string | null => {
    const t = String(fd.get(k) ?? "").trim();
    return t ? t.slice(0, max) : null;
  };

  const { DOKUMENT_SLOTS, AUSSTATTUNG_OPTIONEN } = await import("@/lib/bewerbungsDokumente");
  const erlaubteSlots = new Set(DOKUMENT_SLOTS.map((s) => s.slug));
  const slots = fd.getAll("dokumente").map(String).filter((s) => erlaubteSlots.has(s));
  const erlaubteAusstattung = new Set<string>(AUSSTATTUNG_OPTIONEN);
  const ausstattung = fd.getAll("ausstattung").map(String).filter((a) => erlaubteAusstattung.has(a));

  const anzeige = {
    kaltmiete: zahl("kaltmiete"),
    nebenkosten: zahl("nebenkosten"),
    heizkosten_enthalten: String(fd.get("heizkosten_enthalten") ?? "") === "on",
    warmmiete: zahl("warmmiete"),
    kaution: zahl("kaution"),
    bezugsfrei_ab: text("bezugsfrei_ab", 10),
    etage: text("etage", 40),
    zimmer: zahl("zimmer"),
    schlafzimmer: zahl("schlafzimmer"),
    badezimmer: zahl("badezimmer"),
    flaeche: zahl("flaeche"),
    ausstattung,
    heizungsart: text("heizungsart", 80),
    energieausweis: text("energieausweis", 120),
    beschreibung: text("beschreibung", 2000),
    lage: text("lage", 1000),
  };

  const { error } = await supabase
    .from("bewerber_links")
    .update({ anzeige, dokumente_gewuenscht: slots })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  return { ok: true };
}

/**
 * DSGVO-Aufräumen: abgelehnte Bewerbungen, die älter als 6 Monate sind,
 * samt Dokumenten löschen (Frist deckt AGG-Geltendmachungsansprüche ab).
 * Bewusst KEINE stille Automatik — der Vermieter bestätigt per Klick.
 */
export async function loescheAlteAbgelehnteBewerbungen() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const grenze = new Date();
  grenze.setMonth(grenze.getMonth() - 6);
  await supabase
    .from("bewerbungen")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "abgelehnt")
    .lt("created_at", grenze.toISOString());
  revalidatePath("/anliegen");
  return { ok: true };
}

export async function setzeBewerberLinkAktiv(id: string, aktiv: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerber_links").update({ aktiv }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function loescheBewerberLink(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerber_links").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function setzeBewerbungStatus(id: string, status: "neu" | "favorit" | "abgelehnt") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerbungen").update({ status }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

export async function loescheBewerbung(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerbungen").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/bewerbungen");
  return { ok: true };
}

/**
 * Ein Bewerbungs-Dokument (Gehaltsabrechnung, SCHUFA, …) zum Download laden.
 * Die Base64-Daten werden bewusst NICHT mit der Liste ausgeliefert, sondern
 * erst hier auf Klick — RLS lässt ohnehin nur den Eigentümer durch.
 */
export async function ladeBewerbungDatei(
  id: string,
): Promise<{ ok: boolean; fehler?: string; name?: string; typ?: string; data?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, fehler: "Nicht angemeldet." };
  const { data, error } = await supabase
    .from("bewerbung_dateien")
    .select("name,typ,data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return { ok: false, fehler: "Dokument nicht gefunden." };
  // App-Layer-Verschlüsselung auflösen (Klartext-Altzeilen bleiben lesbar).
  const { decrypt } = await import("@/lib/crypto/secure");
  return { ok: true, name: data.name, typ: data.typ, data: decrypt(data.data) };
}

/** Ein einzelnes Bewerbungs-Dokument löschen (DSGVO-Datensparsamkeit). */
export async function loescheBewerbungDatei(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("bewerbung_dateien").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/anliegen");
  return { ok: true };
}

/** E-Signatur des Vermieters speichern (PNG-Data-URL, max. ~200 kB). */
export async function speichereUnterschrift(dataUrl: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > 200000) {
    return { error: "Ungültige Unterschrift." };
  }
  const { error } = await supabase
    .from("unterschriften")
    .upsert({ user_id: user.id, data: dataUrl, updated_at: new Date().toISOString() });
  if (error) return { error: "Konnte nicht gespeichert werden." };
  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function loescheUnterschrift() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  await supabase.from("unterschriften").delete().eq("user_id", user.id);
  revalidatePath("/einstellungen");
  return { ok: true };
}
