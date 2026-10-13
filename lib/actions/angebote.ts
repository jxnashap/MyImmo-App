"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zahlDe } from "@/lib/zahl";
import { darfWeiter, ZU_VIELE } from "@/lib/net/bremse";
import { MAX_FIRMEN } from "@/lib/angebote";
import { dbFehlerText } from "@/lib/demoFehler";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// „Angebote einholen“ (02.10.2026). Der Vermieter fragt Firmen aus seinem Verzeichnis an;
// die Firma antwortet über einen Link ohne Konto; der Vermieter beauftragt eines der Angebote.
// Grenzen: nur eigene Vorgänge, nur eigene Firmen; Name und Kontakt des Mieters gehen in der
// Anfrage NICHT mit (die Anfrage-Tabelle hat dafür keine Spalte) — erst beim Beauftragen und
// nur, wenn der Vermieter es ausdrücklich ankreuzt.

type Fehler = { error: string };

/** Vermieter: Anfrage an eine oder mehrere Firmen. Text ist vorher bearbeitbar. */
export async function fordereAngeboteAn(fd: FormData): Promise<{ ok: true; neu: number } | Fehler> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const anliegenId = String(fd.get("anliegenId") ?? "").trim();
  const firmaIds = [...new Set(fd.getAll("firmaId").map(String).filter(Boolean))];
  const titel = String(fd.get("titel") ?? "").trim().slice(0, 200);
  const beschreibung = String(fd.get("beschreibung") ?? "").trim().slice(0, 4000);
  if (!anliegenId) return { error: "Vorgang fehlt." };
  if (firmaIds.length === 0) return { error: "Bitte mindestens eine Firma auswählen." };
  if (firmaIds.length > MAX_FIRMEN) return { error: `Höchstens ${MAX_FIRMEN} Firmen auf einmal.` };
  if (!titel) return { error: "Bitte angeben, was gemacht werden soll." };

  const { data: anl, error: aFehler } = await supabase
    .from("anliegen").select("id,prop_id").eq("id", anliegenId).eq("vermieter_id", user.id).maybeSingle();
  if (aFehler || !anl) return { error: "Vorgang nicht gefunden." };

  const { data: firmen, error: fFehler } = await supabase
    .from("firmen").select("id").in("id", firmaIds).eq("user_id", user.id);
  if (fFehler) return { error: "Firmen konnten nicht geprüft werden." };
  if ((firmen ?? []).length !== firmaIds.length) return { error: "Eine der Firmen gehört nicht zu deinem Verzeichnis." };

  // Schon laufende Anfragen an dieselbe Firma nicht verdoppeln. Fehler → abbrechen, nicht
  // „nichts gefunden“ annehmen (sonst doppelte Links).
  const { data: laufend, error: lFehler } = await supabase
    .from("angebotsanfragen").select("firma_id")
    .eq("anliegen_id", anliegenId).eq("vermieter_id", user.id).eq("status", "angefragt");
  if (lFehler) return { error: "Anfragen konnten nicht geprüft werden." };
  const schon = new Set((laufend ?? []).map((r) => r.firma_id as string));
  const neu = firmaIds.filter((id) => !schon.has(id));
  if (neu.length === 0) return { error: "An diese Firmen läuft schon eine Anfrage." };

  let objekt: string | null = null;
  if (anl.prop_id) {
    const { data: p } = await supabase
      .from("properties").select("bezeichnung,adresse").eq("id", anl.prop_id).eq("user_id", user.id).maybeSingle();
    if (p) objekt = [p.bezeichnung, p.adresse].filter(Boolean).join(", ").slice(0, 300) || null;
  }
  const { data: profil } = await supabase.from("vermieter_profil").select("name").eq("user_id", user.id).maybeSingle();

  const { data: rows, error } = await supabase
    .from("angebotsanfragen")
    .insert(neu.map((firma_id) => ({
      vermieter_id: user.id, anliegen_id: anliegenId, firma_id,
      titel, beschreibung: beschreibung || null, objekt, absender: (profil?.name || null),
    })))
    .select("id");
  // B07: Je Vorgang und Firma höchstens EINE laufende Anfrage (Index `angebotsanfragen_laufend_eindeutig`).
  // Hat ein gleichzeitiger Aufruf sie gerade angelegt, kommt 23505 — dann ist nichts doppelt entstanden.
  if (error?.code === "23505") return { error: "An eine dieser Firmen läuft gerade schon eine Anfrage — bitte Seite neu laden." };
  if (error || !rows || rows.length !== neu.length) return { error: "Die Anfrage konnte nicht gespeichert werden." };

  revalidatePath("/anliegen");
  return { ok: true, neu: neu.length };
}

/** Vermieter: eine Anfrage zurückziehen — der Link gilt danach nicht mehr. */
export async function zieheAnfrageZurueck(anfrageId: string): Promise<{ ok: true } | Fehler> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data, error } = await supabase
    .from("angebotsanfragen").update({ status: "zurueckgezogen" })
    .eq("id", anfrageId).eq("vermieter_id", user.id).eq("status", "angefragt")
    .select("id").maybeSingle();
  if (error || !data) return { error: "Die Anfrage konnte nicht zurückgezogen werden." };
  revalidatePath("/anliegen");
  return { ok: true };
}

/**
 * Vermieter: ein Angebot beauftragen → Auftrag an die Firma (ohne Service-Konto), übrige Anfragen des Vorgangs
 * abgelehnt. Seit 13.10.2026 über die RPC `angebot_beauftragen` in EINER Transaktion: Vorher waren es vier
 * Schreibvorgänge, und ein Abbruch nach dem ersten ließ die Anfrage „beauftragt“ ohne Auftrag stehen (kein
 * Knopf mehr, die Firma wusste von nichts). Die RPC läuft mit den Rechten des Vermieters (RLS, Trigger) und
 * entscheidet je Vorgang nacheinander — zwei gleichzeitige Klicks ergeben genau EINEN Auftrag.
 * Mieter-Kontakt geht nur mit Haken mit.
 */
export async function beauftrageAngebot(fd: FormData): Promise<{ ok: true; token: string } | Fehler> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const angebotId = String(fd.get("angebotId") ?? "").trim();
  const kontakt = fd.get("mieterKontakt") === "on";
  if (!angebotId) return { error: "Angebot fehlt." };
  if (!UUID_RE.test(angebotId)) return { error: "Angebot nicht gefunden." };

  const { data, error } = await supabase.rpc("angebot_beauftragen", {
    p_angebot_id: angebotId,
    p_mieter_kontakt: kontakt,
    p_vermieter_name: user.email ?? null,
  });
  // Ein Fehler der Datenbank heißt: Die Transaktion wurde zurückgerollt — es ist NICHTS geändert.
  if (error) return { error: dbFehlerText(error, "Der Auftrag konnte nicht angelegt werden — es wurde nichts geändert, bitte erneut versuchen.") };
  const r = data as { ok?: boolean; token?: string; error?: string } | null;
  if (!r?.ok || !r.token) return { error: r?.error ?? "Der Auftrag konnte nicht angelegt werden." };

  revalidatePath("/anliegen");
  return { ok: true, token: String(r.token) };
}

/** Firma (ohne Konto): Angebot über den Link abgeben. Prüfung des Links in der Datenbank. */
export async function gibAngebotAb(fd: FormData): Promise<{ ok: true } | Fehler> {
  const token = String(fd.get("token") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "Dieser Link ist nicht gültig." };
  if (!(await darfWeiter("angebot_abgeben", 10, 3600))) return { error: ZU_VIELE };

  const firma = String(fd.get("firma") ?? "").trim().slice(0, 200);
  const kontakt = String(fd.get("kontakt") ?? "").trim().slice(0, 300);
  const nachricht = String(fd.get("nachricht") ?? "").trim().slice(0, 4000);
  const terminRoh = String(fd.get("termin") ?? "").trim();
  const betrag = zahlDe(String(fd.get("betrag") ?? ""));
  if (!firma) return { error: "Bitte den Betrieb angeben." };
  if (betrag == null || betrag < 0 || betrag > 10_000_000) return { error: "Bitte einen gültigen Betrag angeben (z. B. 480 oder 1.250,00)." };
  if (terminRoh && !/^\d{4}-\d{2}-\d{2}$/.test(terminRoh)) return { error: "Der Termin ist ungültig." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("angebot_public_abgeben", {
    p_token: token, p_firma: firma, p_kontakt: kontakt || null,
    p_betrag: Math.round(betrag * 100) / 100, p_termin: terminRoh || null, p_nachricht: nachricht || null,
  });
  if (error) return { error: "Das Angebot konnte nicht übermittelt werden." };
  const r = data as { ok?: boolean; error?: string } | null;
  if (!r?.ok) return { error: r?.error ?? "Das Angebot konnte nicht übermittelt werden." };
  return { ok: true };
}
