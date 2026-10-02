"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zahlDe } from "@/lib/zahl";
import { darfWeiter, ZU_VIELE } from "@/lib/net/bremse";
import { MAX_FIRMEN } from "@/lib/angebote";

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
 * Vermieter: ein Angebot annehmen → normaler Auftrag an die Firma (Status „offen“, Link
 * /auftrag/<token> wie bisher). Die übrigen offenen Anfragen dieses Vorgangs werden abgelehnt.
 * Mieter-Kontakt nur bei ausdrücklichem Haken.
 */
export async function beauftrageAngebot(fd: FormData): Promise<{ ok: true; token: string } | Fehler> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const angebotId = String(fd.get("angebotId") ?? "").trim();
  const kontakt = fd.get("mieterKontakt") === "on";
  if (!angebotId) return { error: "Angebot fehlt." };

  const { data: ang, error: e1 } = await supabase
    .from("angebote").select("id,anfrage_id,betrag,termin").eq("id", angebotId).maybeSingle();
  if (e1 || !ang) return { error: "Angebot nicht gefunden." };
  const { data: q, error: e2 } = await supabase
    .from("angebotsanfragen").select("id,anliegen_id,firma_id,titel,beschreibung,objekt,absender,status")
    .eq("id", ang.anfrage_id).eq("vermieter_id", user.id).maybeSingle();
  if (e2 || !q) return { error: "Anfrage nicht gefunden." };
  if (q.status !== "angefragt") return { error: "Für diese Anfrage wurde schon entschieden." };
  const { data: anl, error: e3 } = await supabase
    .from("anliegen").select("id,prop_id,mieter_id").eq("id", q.anliegen_id).eq("vermieter_id", user.id).maybeSingle();
  if (e3 || !anl) return { error: "Vorgang nicht gefunden." };

  const { data: auftrag, error: e4 } = await supabase
    .from("auftraege")
    .insert({
      vermieter_id: user.id, service_user_id: null, firma_id: q.firma_id,
      anliegen_id: q.anliegen_id, prop_id: anl.prop_id ?? null,
      objekt_name: q.objekt, vermieter_name: q.absender || user.email || null,
      titel: q.titel, beschreibung: q.beschreibung, termin: ang.termin ?? null,
      status: "offen", erstellt_von: "vermieter",
      kosten_schaetzung: Number(ang.betrag),
      mieter_id: kontakt ? (anl.mieter_id ?? null) : null,
    })
    .select("id,public_token").maybeSingle();
  if (e4 || !auftrag) return { error: "Der Auftrag konnte nicht angelegt werden." };

  const { data: gesetzt, error: e5 } = await supabase
    .from("angebotsanfragen").update({ status: "beauftragt", auftrag_id: auftrag.id })
    .eq("id", q.id).eq("vermieter_id", user.id).eq("status", "angefragt")
    .select("id").maybeSingle();
  if (e5 || !gesetzt) return { error: "Auftrag angelegt, aber die Anfrage ließ sich nicht abschließen — bitte Seite neu laden." };

  const { error: e6 } = await supabase
    .from("angebotsanfragen").update({ status: "abgelehnt" })
    .eq("anliegen_id", q.anliegen_id).eq("vermieter_id", user.id).eq("status", "angefragt");
  if (e6) return { error: "Auftrag angelegt; die übrigen Anfragen sind noch offen — bitte einzeln zurückziehen." };

  revalidatePath("/anliegen");
  return { ok: true, token: String(auftrag.public_token) };
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
