"use server";

import { mitGeltendenBetraegen } from "@/lib/sollAb";
import { GEO_ZURUECKSETZEN } from "@/lib/geocode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pruefeEinheiten } from "@/lib/planGate";
import { flashUrl } from "@/lib/flash";
import { protokolliereWert } from "@/lib/wert/protokoll";
import { sollKaltmiete } from "@/lib/sollMiete";
import { ruecklageEintragAus, mitRuecklageJahr, ohneRuecklageJahr } from "@/lib/wegRuecklage";
import { dbFehlerText } from "@/lib/demoFehler";

// Wandelt FormData in ein typisiertes Objekt um (Zahlen -> number | null)
function parse(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };
  const str = (k: string) => {
    const v = formData.get(k);
    return v == null || v === "" ? null : String(v);
  };
  return {
    bezeichnung: str("bezeichnung") ?? "",
    typ: str("typ"),
    // Vom KI-Import erkannte Kurznotiz (Ausstattung, Besonderheiten). Wurde
    // im Wizard angezeigt, aber nie mitgesendet — die Zeile "Notiz" auf der
    // Objektseite blieb dadurch immer leer.
    notiz_import: str("notiz_import"),
    adresse: str("adresse"),
    kaufpreis: num("kaufpreis"),
    kaufdatum: str("kaufdatum"),
    wert: num("wert"),
    flaeche: num("flaeche"),
    grundstuecksflaeche: num("grundstuecksflaeche"),
    baujahr: num("baujahr"),
    miete: num("miete"),
    hausgeld: num("hausgeld"),
    obj_status: str("obj_status"),
    zimmer: num("zimmer"),
    einheiten_anzahl: num("einheiten_anzahl"),
    energieklasse: str("energieklasse"),
    energieausweis_datum: str("energieausweis_datum"),
    afa_methode: str("afa_methode") ?? "auto",
    afa_start_jahr: num("afa_start_jahr"),
    afa_betrag: num("afa_betrag"),
    afa_gebaeudeanteil: num("afa_gebaeudeanteil"),
  };
}

// Pflegt beim Speichern einer Immobilie die zugehörigen WIEDERKEHR-VORLAGEN
// (Miete als Einnahme, Hausgeld als Kosten) — statt wie früher eine einzelne
// Einnahme mit irreführendem wiederkehrend=true anzulegen:
// - fehlt die Vorlage → anlegen (monatlich, Start heute)
// - Betrag geändert   → Vorlage aktualisieren
// - Voraussetzung entfällt (Status ≠ Vermietet / Betrag leer) → deaktivieren
// Die Buchungen selbst erzeugt weiterhin der Nutzer über „Wiederkehrende
// Buchungen" auf /cashflow (bewusst kein stilles Auto-Insert).
type Parsed = ReturnType<typeof parse>;
async function autoBuchungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  propId: string,
  p: Parsed,
) {
  const heute = new Date().toISOString().split("T")[0];

  const pflegeVorlage = async (
    art: "einnahme" | "kosten",
    kategorie: string,
    betrag: number | null,
    aktivSoll: boolean,
    beschreibung: string,
    neuAnlegen = true,
  ) => {
    // Leer = „noch keine Vorlage". Eine fehlgeschlagene Abfrage sieht genauso
    // aus und legte eine ZWEITE Miet-Vorlage an — die Miete stünde doppelt im
    // Cashflow. Der Aufrufer meldet den Fehlschlag in der Erfolgsmeldung.
    const { data: rows, error: leseFehler } = await supabase
      .from("wiederkehrende_buchungen")
      .select("id,betrag,aktiv")
      .eq("prop_id", propId)
      .eq("art", art)
      .eq("kategorie", kategorie)
      .limit(1);
    if (leseFehler) return false;
    const vorhanden = rows?.[0] as { id: string; betrag: number | null; aktiv: boolean | null } | undefined;

    // Der Fehler wird zurückgegeben, nicht geworfen: Das Objekt ist zu diesem
    // Zeitpunkt bereits gespeichert. Verschlucken darf man ihn aber auch nicht —
    // ohne Miet-Vorlage fehlt die Einnahme im Cashflow, und das Formular hätte
    // trotzdem „gespeichert" gemeldet.
    if (aktivSoll && betrag && betrag > 0) {
      if (!vorhanden) {
        if (!neuAnlegen) return true;
        const { error } = await supabase.from("wiederkehrende_buchungen").insert({
          user_id: userId, art, prop_id: propId, kategorie, betrag,
          beschreibung, zyklus: "monatlich", start_datum: heute, ende_datum: null, aktiv: true,
        });
        return !error;
      }
      if (Number(vorhanden.betrag) !== betrag || vorhanden.aktiv !== true) {
        const { error } = await supabase.from("wiederkehrende_buchungen")
          .update({ betrag, aktiv: true }).eq("id", vorhanden.id).eq("user_id", userId);
        return !error;
      }
    } else if (vorhanden && vorhanden.aktiv) {
      // Voraussetzung entfallen → Vorlage deaktivieren (bestehende Buchungen bleiben).
      const { error } = await supabase.from("wiederkehrende_buchungen")
        .update({ aktiv: false }).eq("id", vorhanden.id).eq("user_id", userId);
      return !error;
    }
    return true;
  };

  // Miete: KEINE neue Vorlage mehr (Audit 06.10.2026, A5). Die Vorlage bucht ohne Mieter,
  // ohne NK-Anteil und ohne Mietmonat — das Mietkonto erkannte diese Buchungen nicht und
  // meldete den Monat weiter „offen“; wer dort nachbuchte, hatte die Miete doppelt im
  // Cashflow und in der Anlage V. Mieten laufen über das Mietkonto (je Mieter, warm).
  // Eine BESTEHENDE Vorlage wird weiter gepflegt bzw. abgeschaltet — nichts verschwindet still.
  const miete = await pflegeVorlage(
    "einnahme", "Miete", p.miete, p.obj_status === "Vermietet",
    `Kaltmiete ${p.bezeichnung} (automatisch)`, false,
  );
  const hausgeld = await pflegeVorlage(
    "kosten", "Hausgeld / WEG", p.hausgeld, true,
    `Hausgeld ${p.bezeichnung} (automatisch)`,
  );
  return miete && hausgeld;
}

/** Zusatz für die Erfolgsmeldung, wenn die Vorlagen-Pflege scheiterte. */
const VORLAGEN_HINWEIS =
  " Die automatischen Buchungsvorlagen konnten nicht aktualisiert werden — bitte auf /cashflow prüfen.";
const KAUFPRUEFUNG_HINWEIS =
  " Die Kaufprüfung ließ sich nicht mit dem Objekt verknüpfen (vielleicht schon übernommen) — sie steht in BuyImmo weiter als offen.";

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);

  // Einheiten-Schranke des Tarifs. Ohne BILLING_ENFORCED kehrt
  // pruefeEinheiten() sofort mit `erlaubt` zurueck — ohne Datenbankabfrage.
  // Gezaehlt wird die Summe der EINHEITEN ueber alle Objekte, nicht die Zahl
  // der Objekte: So ist das Limit in lib/plan.ts definiert und so steht es
  // auf der Preisseite („bis 5 Einheiten").
  const einheiten = await pruefeEinheiten(supabase, Math.max(1, parsed.einheiten_anzahl ?? 1));
  if (!einheiten.erlaubt) redirect(flashUrl("/properties", einheiten.meldung ?? "Tarif-Limit erreicht.", "error"));

  const { data: neu, error } = await supabase
    .from("properties")
    .insert({ ...parsed, user_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const vorlagenOk = neu?.id ? await autoBuchungen(supabase, user.id, neu.id, parsed) : true;

  // Paket E (06.10.2026): Aus einer Kaufprüfung angelegt → die Prüfung mit dem Objekt verknüpfen,
  // damit sie nicht ein zweites Mal übernommen wird. Nur die eigene, noch nicht übernommene
  // (der Trigger `kalkulation_uebernahme_pruefen` prüft zusätzlich, dass das Objekt dem Konto
  // gehört). Scheitert das, bleibt das Objekt angelegt — der Nutzer erfährt es im Hinweis.
  const ausKalk = String(formData.get("aus_kalkulation") ?? "").trim();
  let verknuepft = true;
  if (neu?.id && ausKalk) {
    const { data: kalk, error: kalkFehler } = await supabase
      .from("kalkulationen")
      .update({ uebernommen_prop_id: neu.id })
      .eq("id", ausKalk)
      .eq("user_id", user.id)
      .is("uebernommen_prop_id", null)
      .select("id")
      .maybeSingle();
    verknuepft = !kalkFehler && !!kalk;
  }

  revalidatePath("/properties");
  revalidatePath("/");
  revalidatePath("/cashflow");
  // Direkt ins neue Objekt springen — dort schließen die Folgeschritte
  // (Mieter, Kredit, Buchung) ohne erneutes Suchen an.
  redirect(
    flashUrl(
      neu?.id ? `/properties/${neu.id}` : "/properties",
      "Immobilie angelegt." + (vorlagenOk ? "" : VORLAGEN_HINWEIS) + (verknuepft ? "" : KAUFPRUEFUNG_HINWEIS),
    ),
  );
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);
  // Felder, die das Formular gar nicht mitschickt, duerfen NICHT ueberschrieben
  // werden: `parse()` liefert dafuer null. Das Objekt-Formular hat kein Feld
  // `notiz_import` — ohne diese Ausnahme loeschte jedes Speichern die vom
  // KI-Import erkannte Notiz.
  const felder: Record<string, unknown> = { ...parsed };
  if (!formData.has("notiz_import")) delete felder.notiz_import;
  // Adresse geändert → gecachte Koordinaten UND das gemerkte Suchergebnis
  // verwerfen (auch „nicht gefunden" gilt nur für die alte Adresse); die
  // Marktwert-Schätzung verortet beim nächsten „Aktualisieren“ neu (lib/geocode.ts).
  const { data: alt } = await supabase.from("properties").select("adresse").eq("id", id).single();
  const koordReset = alt && (alt.adresse ?? null) !== parsed.adresse ? GEO_ZURUECKSETZEN : {};
  const { error } = await supabase.from("properties").update({ ...felder, ...koordReset }).eq("id", id);
  if (error) throw new Error(error.message);

  // Manuell gepflegter Wert → als Stand für die Wertentwicklung protokollieren
  // (nur bei Änderung; siehe protokolliereWert).
  await protokolliereWert(supabase, user.id, id, parsed.wert, "manuell", "Objekt-Formular");

  const vorlagenOk = await autoBuchungen(supabase, user.id, id, parsed);

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  revalidatePath("/");
  revalidatePath("/cashflow");
  // Zurueck aufs Objekt, nicht in die Liste: Eingestiegen wird ueber
  // /properties/<id>/edit, und der Zurueck-Knopf dort zeigt ebenfalls auf die
  // Detailseite. Wer in die Liste geworfen wird, muss sein Objekt nach jedem
  // Speichern neu suchen. (createProperty macht es bereits so.)
  redirect(flashUrl(`/properties/${id}`, "Immobilie gespeichert." + (vorlagenOk ? "" : VORLAGEN_HINWEIS)));
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // `user_id` steht mit im Filter, obwohl RLS greift: Ein RLS-geblocktes DELETE
  // liefert KEINEN Fehler, sondern null Zeilen — der Aufrufer hielte eine fremde
  // ID für gelöscht. Mit dem Filter ist es dieselbe Wirkung, aber absichtlich.
  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect("/properties");
}

// Indexierte Wertschätzung übernehmen (Portfolio-Wert aktuell halten, §12):
// setzt den fortgeschriebenen Wert als "aktuellen Wert" — bewusst nur auf
// Klick des Nutzers (vorschlagen + bestätigen, keine stille Automatik).
export async function uebernehmeIndexwert(id: string, wert: number, standQuartal: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!Number.isFinite(wert) || wert <= 0) throw new Error("Ungültiger Wert.");

  const { error } = await supabase
    .from("properties")
    .update({
      wert: Math.round(wert),
      marktwert_aktuell: Math.round(wert),
      marktwert_stand: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Übernommenen Index-Wert als Stand für die Wertentwicklung protokollieren.
  await protokolliereWert(supabase, user.id, id, wert, "index", "HPI-Fortschreibung");

  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");
  revalidatePath("/");
  redirect(flashUrl(`/properties/${id}`, `Wert aktualisiert (Index-Stand ${standQuartal}).`));
}

// AfA-Assistent → Objekt: den ermittelten Gebäudeanteil (%) am Objekt speichern.
// Bewusst nur auf Klick (Rückkanal, keine stille Automatik); fließt in Anlage V/
// AfA-Berechnungen ein. Näherung — keine Steuerberatung.
export async function uebernehmeAfaGebaeudeanteil(
  id: string,
  prozent: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!Number.isFinite(prozent) || prozent <= 0 || prozent > 100) {
    return { ok: false, error: "Ungültiger Gebäudeanteil." };
  }

  const { error } = await supabase
    .from("properties")
    .update({ afa_gebaeudeanteil: Math.round(prozent * 10) / 10 })
    .eq("id", id);
  if (error) {
    // Rohe Postgres-Meldung nur ins Server-Log, nicht in die Oberfläche (englisch, technisch).
    console.error("uebernehmeAfaGebaeudeanteil:", error.message);
    return { ok: false, error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }

  revalidatePath(`/properties/${id}`);
  revalidatePath("/afa-assistent");
  revalidatePath("/steuer");
  return { ok: true };
}

// Objektfeld „Miete" an die Summe der laufenden Mieter angleichen (Hinweis auf
// der Objektseite, lib/sollMiete.ts). Der Betrag wird HIER neu berechnet und
// nicht vom Client übernommen — sonst ließe sich über die Action jede
// beliebige Miete setzen. Nur auf Klick, nie still.
export async function gleicheObjektMieteAn(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: prop, error: propFehler }, { data: mieter, error: mieterFehler }, { data: mz, error: mzFehler }] = await Promise.all([
    supabase.from("properties").select("id,typ,miete").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("mieter").select("id,prop_id,kaltmiete,stellplatz_miete,mietbeginn,mietende").eq("prop_id", id).eq("user_id", user.id),
    supabase.from("miet_zeitraeume").select("mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete").eq("user_id", user.id),
  ]);
  // Ladefehler ausdrücklich melden. (Ohne Mieterliste fiele die Regel zwar auf
  // „keine Mieter“ und schriebe nichts — der Nutzer erführe dann aber einen
  // falschen Grund.)
  if (propFehler || mieterFehler || mzFehler) return { ok: false, error: "Objekt oder Mieter konnten nicht geladen werden." };
  if (!prop) return { ok: false, error: "Objekt nicht gefunden." };

  const heute = new Date().toISOString().slice(0, 10);
  // Dieselbe Miete wie Objektseite und Mietkonto (Paket B: Miet-Zeiträume des Monats).
  const mieterJetzt = mitGeltendenBetraegen((mieter ?? []) as { id: string; prop_id: string | null; kaltmiete: number | null; stellplatz_miete: number | null; mietbeginn: string | null; mietende: string | null }[], (mz ?? []) as never[], heute.slice(0, 7));
  const soll = sollKaltmiete(prop, mieterJetzt, heute);
  if (soll.quelle !== "mieter") return { ok: false, error: "Das Objekt hat keine laufenden Mieter." };

  const { data, error } = await supabase
    .from("properties")
    .update({ miete: Math.round(soll.betrag * 100) / 100 })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Nicht gespeichert." };

  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");
  revalidatePath("/");
  return { ok: true };
}

// ------------------------------------------------------ WEG-Erhaltungsrücklage je Steuerjahr ----
// BFH IX R 19/24: Die Zuführung zur Erhaltungsrücklage ist keine Werbungskosten, die Entnahme für
// Erhaltung schon. Beide Beträge aus der WEG-Jahresabrechnung, je Objekt und Jahr in
// `properties.weg_ruecklage` (Migration 20261010162259). Rechnung: lib/wegRuecklage.ts + Anlage V.
export async function setzeWegRuecklage(propId: string, fd: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  const e = ruecklageEintragAus(fd.get("jahr"), fd.get("zufuehrung"), fd.get("entnahme"));
  if ("fehler" in e) return { ok: false, error: e.fehler };
  const { data: p, error: leseFehler } = await supabase
    .from("properties").select("weg_ruecklage").eq("id", propId).eq("user_id", user.id).maybeSingle();
  if (leseFehler || !p) return { ok: false, error: "Objekt nicht gefunden." };
  const { data, error } = await supabase
    .from("properties").update({ weg_ruecklage: mitRuecklageJahr(p.weg_ruecklage, e.jahr, e.wert) })
    .eq("id", propId).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: dbFehlerText(error, "Die Rücklage konnte nicht gespeichert werden.") };
  revalidatePath(`/properties/${propId}`);
  revalidatePath("/steuer");
  return { ok: true };
}

export async function entferneWegRuecklage(propId: string, jahr: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!Number.isInteger(jahr)) return { ok: false, error: "Eintrag nicht gefunden." };
  const { data: p, error: leseFehler } = await supabase
    .from("properties").select("weg_ruecklage").eq("id", propId).eq("user_id", user.id).maybeSingle();
  if (leseFehler || !p) return { ok: false, error: "Objekt nicht gefunden." };
  const { data, error } = await supabase
    .from("properties").update({ weg_ruecklage: ohneRuecklageJahr(p.weg_ruecklage, jahr) })
    .eq("id", propId).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: dbFehlerText(error, "Der Eintrag konnte nicht entfernt werden.") };
  revalidatePath(`/properties/${propId}`);
  revalidatePath("/steuer");
  return { ok: true };
}
