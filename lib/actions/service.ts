"use server";

import { UEBERNAHME_KATEGORIEN } from "@/lib/kategorien";
// Service-Rolle (Businessplan Kap. 14): Vermieter lädt Service-Partner
// (Handwerker/Hausmeister) per Code ein und vergibt Aufträge; der Partner
// arbeitet sie im schlanken Service-Portal ab.
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zahlDe } from "@/lib/zahl";
import { selbstErledigtErlaubt, TAETIGKEIT_KEYS } from "@/lib/taetigkeiten";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne 0/O, 1/I/L

function neuerCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `SV-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Vermieter: Einladungscode für einen Service-Partner erzeugen (14 Tage). */
export async function erzeugeServiceCode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const code = neuerCode();
  const { data, error } = await supabase
    .from("einladungscodes")
    .insert({ vermieter_id: user.id, code, rolle: "service" })
    .select("code,gueltig_bis")
    .single();
  if (error) return { error: "Code konnte nicht erstellt werden." };
  revalidatePath("/anliegen");
  return { code: data.code as string, gueltigBis: data.gueltig_bis as string };
}

export async function widerrufeServiceCode(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  // Der Fehler MUSS ausgewertet werden: Ein stillschweigend fehlgeschlagenes
  // Löschen meldet „widerrufen", während der Code weiter gültig ist.
  const { error } = await supabase
    .from("einladungscodes")
    .delete()
    .eq("code", code)
    .eq("vermieter_id", user.id)
    .eq("rolle", "service")
    .is("eingeloest_am", null);
  if (error) return { error: "Code konnte nicht widerrufen werden — er ist weiterhin gültig." };
  revalidatePath("/anliegen");
  return { ok: true };
}

/** Vermieter: Verknüpfung zu einem Service-Partner lösen (Aufträge bleiben). */
export async function entferneServicePartner(serviceUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  // Wie beim Widerruf: Bleibt der Fehler unbemerkt, behält der Partner Zugriff,
  // obwohl die Oberfläche „gelöst" anzeigt.
  const { error } = await supabase
    .from("service_zugaenge")
    .delete()
    .eq("vermieter_id", user.id)
    .eq("user_id", serviceUserId);
  if (error) return { error: "Verknüpfung konnte nicht gelöst werden — der Zugriff besteht weiter." };
  // Zuordnungen mit entfernen. Sichtbar wären sie ohnehin nicht mehr (Regel und Sicht verlangen
  // eine bestehende Verknüpfung) — aber ein erneut eingeladener Partner bekäme sonst alte Objekte zurück.
  const { error: oFehler } = await supabase
    .from("service_objekte")
    .delete()
    .eq("vermieter_id", user.id)
    .eq("service_user_id", serviceUserId);
  if (oFehler) return { error: "Verknüpfung gelöst, aber die Objekt-Zuordnung blieb gespeichert — bitte erneut versuchen." };
  revalidatePath("/anliegen");
  return { ok: true };
}

const ROLLEN = ["hausmeister", "dienstleister"] as const;
const OFFENE_STATUS = ["freigabe", "offen", "angenommen"];

/**
 * Vermieter: Rolle und Objekte eines Partners festlegen (05.10.2026).
 * Hausmeister betreut die angehakten Objekte; ein Dienstleister hat keine Objekte (er sieht nur,
 * was ihm beauftragt wird) — seine Zuordnungen werden deshalb entfernt.
 */
export async function setzeServicePartner(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const serviceUserId = String(formData.get("serviceUserId") ?? "");
  const rolle = String(formData.get("rolle") ?? "");
  if (!(ROLLEN as readonly string[]).includes(rolle)) return { error: "Bitte eine Rolle wählen." };
  const gewuenscht = rolle === "hausmeister"
    ? [...new Set(formData.getAll("objekt").map(String).filter(Boolean))]
    : [];

  const { data: gesetzt, error: rFehler } = await supabase.rpc("service_rolle_setzen", { p_user: serviceUserId, p_rolle: rolle });
  if (rFehler || gesetzt !== true) return { error: "Service-Partner nicht gefunden." };

  // Nur eigene Objekte — die Datenbank prüft es ebenfalls; hier für eine klare Meldung.
  if (gewuenscht.length > 0) {
    const { data: eigene, error: pFehler } = await supabase
      .from("properties").select("id").eq("user_id", user.id).in("id", gewuenscht);
    if (pFehler) return { error: "Objekte konnten nicht geprüft werden — nichts geändert." };
    if ((eigene ?? []).length !== gewuenscht.length) return { error: "Mindestens ein Objekt gehört nicht zu deinem Konto." };
  }

  // Fail-closed: Ohne den aktuellen Stand wüssten wir nicht, was zu entfernen ist.
  const { data: jetzt, error: jFehler } = await supabase
    .from("service_objekte").select("prop_id").eq("vermieter_id", user.id).eq("service_user_id", serviceUserId);
  if (jFehler) return { error: "Zuordnung konnte nicht gelesen werden — nichts geändert." };
  const vorhanden = new Set(((jetzt ?? []) as { prop_id: string }[]).map((r) => r.prop_id));
  const neu = gewuenscht.filter((id) => !vorhanden.has(id));
  const weg = [...vorhanden].filter((id) => !gewuenscht.includes(id));

  if (neu.length > 0) {
    const { error } = await supabase
      .from("service_objekte")
      .insert(neu.map((prop_id) => ({ vermieter_id: user.id, service_user_id: serviceUserId, prop_id })));
    if (error) return { error: "Objekte konnten nicht zugewiesen werden." };
  }
  if (weg.length > 0) {
    const { error } = await supabase
      .from("service_objekte")
      .delete()
      .eq("vermieter_id", user.id)
      .eq("service_user_id", serviceUserId)
      .in("prop_id", weg);
    if (error) return { error: "Objekte konnten nicht entfernt werden — der Partner sieht sie weiterhin." };
  }
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

/**
 * Vermieter: Hausmeister wechseln (05.10.2026). Offene Aufträge (Freigabe, offen, angenommen)
 * und — auf Wunsch — die Objekte gehen an den neuen Partner. Erledigte bleiben beim alten
 * (das ist seine Arbeit und der Nachweis dafür).
 */
export async function uebergebeServicePartner(formData: FormData): Promise<{ ok: true; auftraege: number; objekte: number } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const alt = String(formData.get("alt") ?? "");
  const neu = String(formData.get("neu") ?? "");
  const mitObjekten = formData.get("mitObjekten") === "1";
  if (!alt || !neu || alt === neu) return { error: "Bitte einen anderen Partner wählen." };

  const { data: beide, error: zFehler } = await supabase
    .from("service_zugaenge").select("user_id,rolle").eq("vermieter_id", user.id).in("user_id", [alt, neu]);
  if (zFehler) return { error: "Partner konnten nicht geprüft werden — nichts übergeben." };
  const neuZugang = ((beide ?? []) as { user_id: string; rolle: string }[]).find((z) => z.user_id === neu);
  if ((beide ?? []).length !== 2 || !neuZugang) return { error: "Beide Partner müssen mit deinem Konto verknüpft sein." };

  const { data: verschoben, error: aFehler } = await supabase
    .from("auftraege")
    .update({ service_user_id: neu })
    .eq("vermieter_id", user.id)
    .eq("service_user_id", alt)
    .in("status", OFFENE_STATUS)
    .select("id");
  if (aFehler) return { error: "Aufträge konnten nicht übergeben werden." };

  let objekte = 0;
  if (mitObjekten) {
    if (neuZugang.rolle !== "hausmeister") return { error: "Objekte gehen nur an einen Hausmeister — die Aufträge wurden übergeben." };
    const { data: altObj, error: oFehler } = await supabase
      .from("service_objekte").select("prop_id").eq("vermieter_id", user.id).eq("service_user_id", alt);
    if (oFehler) return { error: "Aufträge übergeben, Objekte nicht — bitte erneut versuchen." };
    const ids = ((altObj ?? []) as { prop_id: string }[]).map((r) => r.prop_id);
    if (ids.length > 0) {
      const { error: insFehler } = await supabase
        .from("service_objekte")
        .upsert(ids.map((prop_id) => ({ vermieter_id: user.id, service_user_id: neu, prop_id })), { onConflict: "service_user_id,prop_id", ignoreDuplicates: true });
      if (insFehler) return { error: "Aufträge übergeben, Objekte nicht — bitte erneut versuchen." };
      const { error: delFehler } = await supabase
        .from("service_objekte").delete().eq("vermieter_id", user.id).eq("service_user_id", alt);
      if (delFehler) return { error: "Objekte übergeben, aber beim bisherigen Partner nicht entfernt — er sieht sie weiterhin." };
    }
    objekte = ids.length;
  }
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true, auftraege: (verschoben ?? []).length, objekte };
}

/** Vermieter: Auftrag an einen verknüpften Service-Partner erstellen. */
export async function erstelleAuftrag(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const serviceUserId = String(formData.get("serviceUserId") ?? "");
  const propId = String(formData.get("propId") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  const termin = String(formData.get("termin") ?? "").trim();
  const anliegenId = String(formData.get("anliegenId") ?? "").trim();
  const mieterId = String(formData.get("mieterId") ?? "").trim();
  const taetigkeit = String(formData.get("taetigkeit") ?? "").trim();
  if (!serviceUserId) return { error: "Bitte einen Service-Partner wählen." };
  if (!titel) return { error: "Bitte einen Betreff angeben." };
  if (!TAETIGKEIT_KEYS.includes(taetigkeit)) return { error: "Bitte die Art der Arbeit wählen." };

  // Mieter-Kontakt nur teilen, wenn der Mieter dem Vermieter gehört (Opt-in).
  let mieterOk: string | null = null;
  if (mieterId) {
    const { data: m } = await supabase
      .from("mieter").select("id").eq("id", mieterId).eq("user_id", user.id).maybeSingle();
    mieterOk = m?.id ?? null;
  }

  // Partner muss mit diesem Vermieter verknüpft sein.
  const { data: zugang } = await supabase
    .from("service_zugaenge")
    .select("user_id")
    .eq("vermieter_id", user.id)
    .eq("user_id", serviceUserId)
    .maybeSingle();
  if (!zugang) return { error: "Service-Partner nicht gefunden." };

  // Objekt-/Absendername denormalisieren (Service-Portal hat keinen
  // RLS-Zugriff auf properties/vermieter_profil).
  let objektName: string | null = null;
  if (propId) {
    const { data: p } = await supabase
      .from("properties").select("bezeichnung,adresse").eq("id", propId).eq("user_id", user.id).maybeSingle();
    if (p) objektName = [p.bezeichnung, p.adresse].filter(Boolean).join(", ");
  }
  const { data: profil } = await supabase
    .from("vermieter_profil").select("name").eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("auftraege").insert({
    vermieter_id: user.id,
    service_user_id: serviceUserId,
    prop_id: propId || null,
    anliegen_id: anliegenId || null,
    objekt_name: objektName,
    vermieter_name: profil?.name || user.email || null,
    titel,
    beschreibung: beschreibung || null,
    termin: termin || null,
    mieter_id: mieterOk,
    taetigkeit,
  });
  if (error) return { error: "Auftrag konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

/** Service-Partner (Hausmeister): Auftrag BEANTRAGEN — der Vermieter bekommt
 *  die Anfrage im Mieterportal (Tab Service) und gibt sie frei. */
export async function beantrageAuftrag(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const vermieterId = String(formData.get("vermieterId") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  const beschreibung = String(formData.get("beschreibung") ?? "").trim();
  const objekt = String(formData.get("objekt") ?? "").trim();
  const propId = String(formData.get("propId") ?? "").trim();
  const firmaId = String(formData.get("firmaId") ?? "").trim();
  const termin = String(formData.get("termin") ?? "").trim();
  const schaetzungRoh = String(formData.get("kostenSchaetzung") ?? "").trim();
  const taetigkeit = String(formData.get("taetigkeit") ?? "").trim();
  if (!vermieterId) return { error: "Bitte den Auftraggeber wählen." };
  if (!titel) return { error: "Bitte angeben, was gemacht werden muss." };
  if (!TAETIGKEIT_KEYS.includes(taetigkeit)) return { error: "Bitte die Art der Arbeit wählen." };
  const schaetzung = schaetzungRoh ? parseBetrag(schaetzungRoh) : null;
  if (schaetzungRoh && schaetzung == null) return { error: "Bitte die geschätzten Kosten als Betrag angeben (z. B. 250 oder 1.250,00)." };

  // Kostengrenze des Auftraggebers (02.10.2026): bis zu dieser Summe ist der Auftrag ohne
  // Rückfrage freigegeben. Die Datenbank prüft dasselbe noch einmal (Einfüge-Regel). Scheitert
  // die Abfrage, bleibt es bei der Freigabe durch den Vermieter — nie umgekehrt.
  let unterGrenze = false;
  if (schaetzung != null) {
    const { data: grenze, error: gFehler } = await supabase.rpc("auftrag_kostengrenze", { p_vermieter: vermieterId });
    unterGrenze = !gFehler && typeof grenze === "number" && schaetzung <= grenze;
  }

  // Objekt: nur eines, das der Vermieter ihm zugewiesen hat (Sicht `service_objekte_portal`).
  // Die Datenbank prüft dasselbe beim Einfügen — hier entsteht der lesbare Objektname.
  let objektName: string | null = objekt || null;
  if (propId) {
    const { data: o, error: oFehler } = await supabase
      .from("service_objekte_portal").select("id,bezeichnung,adresse").eq("id", propId).eq("vermieter_id", vermieterId).maybeSingle();
    if (oFehler || !o) return { error: "Dieses Objekt ist dir nicht zugewiesen." };
    const name = [o.bezeichnung, o.adresse].filter(Boolean).join(", ");
    objektName = objekt ? `${name} — ${objekt}` : name;
  }

  // Vorgeschlagene Firma muss zum gewählten Auftraggeber gehören.
  let firmaOk: string | null = null;
  if (firmaId) {
    const { data: f } = await supabase
      .from("firmen").select("id").eq("id", firmaId).eq("user_id", vermieterId).maybeSingle();
    if (!f) return { error: "Die gewählte Firma gehört nicht zu diesem Auftraggeber." };
    firmaOk = f.id;
  }

  const { error } = await supabase.from("auftraege").insert({
    vermieter_id: vermieterId,
    service_user_id: user.id,
    firma_id: firmaOk,
    prop_id: propId || null,
    objekt_name: objektName ? objektName.slice(0, 300) : null,
    titel: titel.slice(0, 200),
    beschreibung: beschreibung.slice(0, 2000) || null,
    termin: termin || null,
    kosten_schaetzung: schaetzung,
    taetigkeit,
    status: unterGrenze ? "offen" : "freigabe",
    auto_freigegeben: unterGrenze,
    erstellt_von: "service",
  });
  if (error) return { error: "Antrag konnte nicht gespeichert werden." };
  revalidatePath("/service");
  revalidatePath("/anliegen");
  return { ok: true, freigegeben: unterGrenze };
}

/** Vermieter: beantragten Auftrag freigeben oder ablehnen. Optional wird
 *  dabei ein Mieter ausgewählt, dessen Kontakt die Firma über den
 *  öffentlichen Auftrags-Link zur Terminabsprache bekommt. */
export async function entscheideAuftrag(id: string, freigeben: boolean, mieterId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  let mieterOk: string | null = null;
  if (freigeben && mieterId) {
    const { data: m } = await supabase
      .from("mieter").select("id").eq("id", mieterId).eq("user_id", user.id).maybeSingle();
    if (!m) return { error: "Mieter nicht gefunden — Freigabe abgebrochen." };
    mieterOk = m.id;
  }

  // Vorschlag des Hausmeisters („Fachbetrieb nötig“) wird mit der Freigabe zur Firma des
  // Auftrags — nur, wenn die Firma zum eigenen Verzeichnis gehört und noch keine gesetzt ist.
  let firmaAusVorschlag: string | null = null;
  if (freigeben) {
    const { data: a, error: aFehler } = await supabase
      .from("auftraege").select("firma_id,vorgeschlagene_firma_id").eq("id", id).eq("vermieter_id", user.id).maybeSingle();
    if (aFehler || !a) return { error: "Auftrag nicht gefunden." };
    if (!a.firma_id && a.vorgeschlagene_firma_id) {
      const { data: f, error: fFehler } = await supabase
        .from("firmen").select("id").eq("id", a.vorgeschlagene_firma_id).eq("user_id", user.id).maybeSingle();
      if (fFehler) return { error: "Vorgeschlagene Firma konnte nicht geprüft werden — nichts freigegeben." };
      firmaAusVorschlag = f?.id ?? null;
    }
  }

  const { data, error } = await supabase
    .from("auftraege")
    .update({
      status: freigeben ? "offen" : "nicht_freigegeben",
      ...(mieterOk ? { mieter_id: mieterOk } : {}),
      ...(firmaAusVorschlag ? { firma_id: firmaAusVorschlag } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("vermieter_id", user.id)
    .eq("status", "freigabe")
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Entscheidung konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

// Rechnungs-Anhang: gleiche Grenzen wie bei Anliegen-Anhängen.
const RECHNUNG_MAX = 4 * 1024 * 1024;
const RECHNUNG_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/**
 * "1.234,56" / "1234.56" / "1.000" → number | null.
 *
 * DER FALL, DER HIER FEHLTE (gefunden 04.09.2026): Ein Punkt ohne Komma wurde
 * IMMER als Dezimaltrennzeichen gelesen. In einer deutschsprachigen App ist
 * "1.000" aber der naheliegendste Weg, tausend Euro zu schreiben — daraus
 * wurde 1,00 €. Bei "12.345" war das Ergebnis unter BEIDEN Lesarten falsch
 * (12,35 — auf zwei Stellen gerundet). Der Betrag kommt vom Handwerker und
 * wird vom Vermieter per Klick zur Kosten-Buchung, landet also in der
 * Steuerauswertung.
 *
 * Gelöst wird das NICHT durch eine eigene Regel, sondern über `zahlDe()` aus
 * `lib/zahl.ts` — die Stelle, an der die deutsche Zahlenlesart im Projekt
 * ohnehin schon korrekt implementiert ist (samt Test). Sie ist zusätzlich
 * feiner als ein reiner Tausender-Test: Dank der Ausnahme für führende Nullen
 * bleibt "0.500" ein halber Euro und wird nicht zu 500.
 *
 * Hier bleibt nur, was die Beträge dieser Datei zusätzlich brauchen:
 * keine negativen Werte, auf Cent gerundet.
 */
function parseBetrag(s: string): number | null {
  const n = zahlDe(s);
  return n != null && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Service-Partner: Auftrag beantworten (angenommen/erledigt/abgelehnt).
 *  Beim Erledigen können Betrag, Lohnanteil (§ 35a) und die Rechnung
 *  mitgegeben werden — der Vermieter übernimmt das per Klick als Kosten. */
export async function beantworteAuftrag(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const antwort = String(formData.get("antwort") ?? "").trim();
  if (!id || !["angenommen", "erledigt", "abgelehnt"].includes(status)) {
    return { error: "Ungültige Eingabe." };
  }

  const update: Record<string, unknown> = {
    status,
    antwort: antwort || null,
    updated_at: new Date().toISOString(),
  };

  if (status === "erledigt") {
    // Gas, Strom, Trinkwasser, Schornstein: „selbst erledigt“ gibt es dort nicht — erst mit
    // einem (vom Vermieter freigegebenen) Fachbetrieb am Auftrag (lib/fachbetriebPflicht.ts).
    const { data: a, error: aFehler } = await supabase
      .from("auftraege").select("titel,beschreibung,firma_id,taetigkeit,vermieter_id").eq("id", id).eq("service_user_id", user.id).maybeSingle();
    if (aFehler || !a) return { error: "Auftrag nicht gefunden." };
    // Die Sperre gilt dem HAUSMEISTER — ein Dienstleister ist selbst der Fachbetrieb.
    // Ohne lesbare Rolle gilt die strengere Regel (fail-closed).
    const { data: z } = await supabase
      .from("service_zugaenge").select("rolle").eq("user_id", user.id).eq("vermieter_id", a.vermieter_id).maybeSingle();
    const pruefung = selbstErledigtErlaubt({
      rolle: z?.rolle === "dienstleister" ? "dienstleister" : "hausmeister",
      taetigkeit: a.taetigkeit, titel: a.titel, beschreibung: a.beschreibung, firmaId: a.firma_id,
    });
    if (!pruefung.erlaubt) {
      return { error: `${pruefung.grund} Bitte „Fachbetrieb nötig“ wählen — der Vermieter gibt die Firma frei.` };
    }
    const betrag = parseBetrag(String(formData.get("betrag") ?? ""));
    const lohnanteil = parseBetrag(String(formData.get("lohnanteil") ?? ""));
    if (lohnanteil != null && betrag == null) return { error: "Lohnanteil ohne Gesamtbetrag — bitte auch den Betrag angeben." };
    if (lohnanteil != null && betrag != null && lohnanteil > betrag) {
      return { error: "Der Lohnanteil kann nicht über dem Gesamtbetrag liegen." };
    }
    if (betrag != null) {
      update.betrag = betrag;
      update.lohnanteil = lohnanteil;
    }
    const datei = formData.get("rechnung");
    if (datei instanceof File && datei.size > 0) {
      if (datei.size > RECHNUNG_MAX) return { error: "Die Rechnung ist größer als 4 MB." };
      if (!RECHNUNG_MIME.includes(datei.type)) return { error: "Rechnung: nur Fotos (JPG/PNG/WebP/HEIC) oder PDF." };
      update.rechnung_name = datei.name;
      update.rechnung_type = datei.type;
      update.rechnung_data = Buffer.from(await datei.arrayBuffer()).toString("base64");
    }
  }

  const { data, error } = await supabase
    .from("auftraege")
    .update(update)
    .eq("id", id)
    .eq("service_user_id", user.id)
    // Nur freigegebene Aufträge sind beantwortbar (Freigabe-Umgehung verhindern)
    .in("status", ["offen", "angenommen"])
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Konnte nicht gespeichert werden — der Auftrag wurde ggf. zurückgezogen." };
  revalidatePath("/service");
  revalidatePath("/anliegen");
  return { ok: true };
}


/** Vermieter: erledigten Auftrag als Kosten-Buchung übernehmen (Betrag,
 *  Rechnung als Anhang, Lohnanteil dokumentiert in der Notiz — für die
 *  § 35a-Bescheinigung der Mieter in der NK-Abrechnung). */
export async function uebernimmAuftragAlsKosten(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const id = String(formData.get("id") ?? "");
  const kat = String(formData.get("kategorie") ?? "Reparatur");
  const kategorie = (UEBERNAHME_KATEGORIEN as readonly string[]).includes(kat) ? kat : "Reparatur";
  // Rechnungsdatum (Paket C, 06.10.2026): Vorher galt der Tag des Klicks — ein Dezember-Auftrag,
  // der im Januar übernommen wurde, rutschte ins nächste Steuer- und Abrechnungsjahr.
  const datumRoh = String(formData.get("buchungsdatum") ?? "").trim();
  const buchungsdatum = /^\d{4}-\d{2}-\d{2}$/.test(datumRoh) && !Number.isNaN(Date.parse(datumRoh))
    ? datumRoh
    : new Date().toISOString().slice(0, 10);
  if (!id) return { error: "Ungültige Eingabe." };

  const { data: a } = await supabase
    .from("auftraege")
    .select("titel,objekt_name,prop_id,betrag,lohnanteil,rechnung_name,rechnung_type,rechnung_data,kosten_id,status,service_user_id")
    .eq("id", id)
    .eq("vermieter_id", user.id)
    .maybeSingle();
  if (!a) return { error: "Auftrag nicht gefunden." };
  if (a.status !== "erledigt") return { error: "Nur erledigte Aufträge lassen sich übernehmen." };
  if (a.kosten_id) return { error: "Dieser Auftrag wurde bereits als Kosten erfasst." };
  if (!(Number(a.betrag) > 0)) return { error: "Der Partner hat keinen Betrag angegeben — bitte manuell unter Kosten erfassen." };

  const { data: partner } = await supabase
    .from("service_zugaenge")
    .select("firma,email")
    .eq("vermieter_id", user.id)
    .eq("user_id", a.service_user_id)
    .maybeSingle();
  const partnerName = partner?.firma || partner?.email || "Service-Partner";

  const notizTeile = [`Übernommen aus Service-Auftrag (${partnerName}).`];
  if (Number(a.lohnanteil) > 0) {
    notizTeile.push(`Davon Arbeits-/Lohnanteil: ${Number(a.lohnanteil).toFixed(2)} € (§ 35a EStG — für die NK-Abrechnung als Lohnanteil erfassen).`);
  }

  // Rechnung in den Belege-Bucket kopieren (wie beim normalen Kosten-Upload);
  // schlägt der Upload fehl, bleibt die Base64-Ablage als Fallback lesbar.
  let rechnung: Record<string, unknown> = {};
  if (a.rechnung_data) {
    const buf = Buffer.from(a.rechnung_data, "base64");
    const kb = buf.length / 1024;
    const groesse = kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
    const ext = (a.rechnung_name?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("belege")
      .upload(path, buf, { contentType: a.rechnung_type ?? "application/octet-stream", upsert: false });
    rechnung = {
      rechnung_name: a.rechnung_name,
      rechnung_type: a.rechnung_type,
      rechnung_size: groesse,
      ...(upErr ? { rechnung_data: a.rechnung_data } : { rechnung_path: path, rechnung_data: null }),
    };
  }

  const { data: neu, error } = await supabase
    .from("kosten")
    .insert({
      user_id: user.id,
      prop_id: a.prop_id ?? null,
      buchungsdatum,
      kategorie,
      betrag: Number(a.betrag),
      beschreibung: a.titel.slice(0, 200),
      notiz: notizTeile.join(" "),
      ...rechnung,
    })
    .select("id")
    .single();
  if (error || !neu) return { error: "Kosten-Buchung konnte nicht angelegt werden." };

  // Die Verknüpfung ist der Doppel-Buchungs-Schutz: Ohne `kosten_id` hält der
  // Auftrag sich für unverbucht und legt beim nächsten Klick eine ZWEITE
  // Kosten-Buchung an. Der Fehler darf deshalb nicht verschluckt werden.
  const { error: linkFehler } = await supabase
    .from("auftraege")
    .update({ kosten_id: neu.id })
    .eq("id", id)
    .eq("vermieter_id", user.id);
  if (linkFehler) {
    return {
      error:
        "Die Kosten-Buchung wurde angelegt, konnte dem Auftrag aber nicht zugeordnet werden. " +
        "Bitte in den Kosten prüfen, bevor erneut gebucht wird.",
    };
  }
  revalidatePath("/anliegen");
  revalidatePath("/kosten");
  return { ok: true };
}

/** Vermieter: Auftrag löschen. */
export async function loescheAuftrag(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { error } = await supabase.from("auftraege").delete().eq("id", id).eq("vermieter_id", user.id);
  if (error) return { error: "Auftrag konnte nicht gelöscht werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

/** Vermieter: Kostengrenze für Hausmeister-Anträge setzen (leer = keine, alles braucht Freigabe). */
export async function setzeKostengrenze(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const roh = String(formData.get("kostengrenze") ?? "").trim();
  const grenze = roh ? parseBetrag(roh) : null;
  if (roh && (grenze == null || grenze > 100000)) return { error: "Bitte einen Betrag bis 100.000 € angeben." };

  const { data, error } = await supabase
    .from("vermieter_profil")
    .upsert({ user_id: user.id, kostengrenze: grenze }, { onConflict: "user_id" })
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { error: "Kostengrenze konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  return { ok: true };
}

// Fotos am Auftrag: gleiche Grenzen wie die Datenbank (Migration 20261005110000).
const FOTO_MAX = 4 * 1024 * 1024;
const FOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Notiz oder Foto am Auftrag (05.10.2026) — vom Vermieter oder vom Partner, dem der Auftrag
 * gehört. Die Rolle ergibt sich aus dem Auftrag, nie aus dem Formular.
 */
export async function fuegeAuftragNotizHinzu(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const auftragId = String(formData.get("auftragId") ?? "");
  const text = String(formData.get("text") ?? "").trim().slice(0, 2000);
  const foto = formData.get("foto");
  const hatFoto = foto instanceof File && foto.size > 0;
  if (!auftragId) return { error: "Auftrag fehlt." };
  if (!text && !hatFoto) return { error: "Bitte eine Notiz schreiben oder ein Foto wählen." };
  if (hatFoto && foto.size > FOTO_MAX) return { error: "Das Foto ist größer als 4 MB." };
  if (hatFoto && !FOTO_MIME.includes(foto.type)) return { error: "Nur Fotos (JPG, PNG, WebP, HEIC)." };

  const { data: a, error: aFehler } = await supabase
    .from("auftraege").select("vermieter_id,service_user_id").eq("id", auftragId).maybeSingle();
  if (aFehler || !a) return { error: "Auftrag nicht gefunden." };
  const rolle = a.vermieter_id === user.id ? "vermieter" : a.service_user_id === user.id ? "service" : null;
  if (!rolle) return { error: "Auftrag nicht gefunden." };

  const { error } = await supabase.from("auftrag_notizen").insert({
    auftrag_id: auftragId,
    vermieter_id: a.vermieter_id,
    autor_id: user.id,
    autor_rolle: rolle,
    art: hatFoto ? "foto" : "notiz",
    text: text || null,
    ...(hatFoto
      ? {
          datei_name: foto.name.slice(0, 200),
          datei_type: foto.type,
          datei_size: foto.size,
          datei_data: Buffer.from(await foto.arrayBuffer()).toString("base64"),
        }
      : {}),
  });
  if (error) return { error: "Notiz konnte nicht gespeichert werden." };
  revalidatePath("/service");
  revalidatePath("/anliegen");
  return { ok: true };
}

/**
 * Hausmeister: „Kann ich nicht selbst — Fachbetrieb nötig“ (05.10.2026). Er SCHLÄGT eine Firma
 * vor (Entscheidung des Betreibers: nie selbst beauftragen); der Auftrag geht zurück in die
 * Freigabe, der Vermieter entscheidet. Die Datenbank prüft Rolle, Status und Firma.
 */
export async function meldeFachbetriebNoetig(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const auftragId = String(formData.get("auftragId") ?? "");
  const firmaId = String(formData.get("firmaId") ?? "").trim() || null;
  const text = String(formData.get("text") ?? "").trim();
  const schaetzungRoh = String(formData.get("kostenSchaetzung") ?? "").trim();
  const schaetzung = schaetzungRoh ? parseBetrag(schaetzungRoh) : null;
  if (!auftragId) return { error: "Auftrag fehlt." };
  if (text.length < 3) return { error: "Bitte kurz begründen, warum ein Fachbetrieb nötig ist." };
  if (schaetzungRoh && schaetzung == null) return { error: "Bitte die geschätzten Kosten als Betrag angeben (z. B. 280)." };

  const { data, error } = await supabase.rpc("auftrag_fachbetrieb_vorschlagen", {
    p_auftrag: auftragId,
    p_firma: firmaId,
    p_schaetzung: schaetzung,
    p_text: text.slice(0, 2000),
  });
  if (error) return { error: error.code === "22023" ? error.message : "Vorschlag konnte nicht gesendet werden." };
  if (data !== true) return { error: "Nur möglich, solange der Auftrag offen oder angenommen ist — und nur als Hausmeister." };
  revalidatePath("/service");
  revalidatePath("/anliegen");
  return { ok: true };
}

/**
 * Vermieter: Rückfrage zu einem Antrag (05.10.2026) — dritter Weg neben Freigeben und Ablehnen.
 * Der Auftrag bleibt in der Freigabe; der Hausmeister antwortet im Verlauf.
 */
export async function stelleRueckfrage(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const auftragId = String(formData.get("auftragId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!auftragId) return { error: "Auftrag fehlt." };
  if (text.length < 3) return { error: "Bitte die Frage formulieren." };

  const { data: a, error: aFehler } = await supabase
    .from("auftraege").select("id,status").eq("id", auftragId).eq("vermieter_id", user.id).maybeSingle();
  if (aFehler || !a) return { error: "Auftrag nicht gefunden." };
  if (a.status !== "freigabe") return { error: "Rückfragen gibt es nur, solange der Antrag auf deine Freigabe wartet." };

  const { error } = await supabase.from("auftrag_notizen").insert({
    auftrag_id: auftragId,
    vermieter_id: user.id,
    autor_id: user.id,
    autor_rolle: "vermieter",
    art: "notiz",
    text: text.slice(0, 2000),
    rueckfrage: true,
  });
  if (error) return { error: "Rückfrage konnte nicht gespeichert werden." };
  revalidatePath("/anliegen");
  revalidatePath("/service");
  return { ok: true };
}

/** Service-Portal geöffnet: „zuletzt gesehen“ setzen (05.10.2026). Beste Mühe — scheitert es,
 *  bleibt die Markierung „neu“ einfach stehen; kein Fehler für den Partner. */
export async function markiereServiceGesehen(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.rpc("service_gesehen");
  return { ok: !error };
}
