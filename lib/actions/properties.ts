"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl } from "@/lib/flash";
import { protokolliereWert } from "@/lib/wert/protokoll";

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
  supabase: ReturnType<typeof createClient>,
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
  ) => {
    const { data: rows } = await supabase
      .from("wiederkehrende_buchungen")
      .select("id,betrag,aktiv")
      .eq("prop_id", propId)
      .eq("art", art)
      .eq("kategorie", kategorie)
      .limit(1);
    const vorhanden = rows?.[0] as { id: string; betrag: number | null; aktiv: boolean | null } | undefined;

    if (aktivSoll && betrag && betrag > 0) {
      if (!vorhanden) {
        await supabase.from("wiederkehrende_buchungen").insert({
          user_id: userId, art, prop_id: propId, kategorie, betrag,
          beschreibung, zyklus: "monatlich", start_datum: heute, ende_datum: null, aktiv: true,
        });
      } else if (Number(vorhanden.betrag) !== betrag || vorhanden.aktiv !== true) {
        await supabase.from("wiederkehrende_buchungen")
          .update({ betrag, aktiv: true }).eq("id", vorhanden.id);
      }
    } else if (vorhanden && vorhanden.aktiv) {
      // Voraussetzung entfallen → Vorlage deaktivieren (bestehende Buchungen bleiben).
      await supabase.from("wiederkehrende_buchungen").update({ aktiv: false }).eq("id", vorhanden.id);
    }
  };

  await pflegeVorlage(
    "einnahme", "Miete", p.miete, p.obj_status === "Vermietet",
    `Kaltmiete ${p.bezeichnung} (automatisch)`,
  );
  await pflegeVorlage(
    "kosten", "Hausgeld / WEG", p.hausgeld, true,
    `Hausgeld ${p.bezeichnung} (automatisch)`,
  );
}

export async function createProperty(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);
  const { data: neu, error } = await supabase
    .from("properties")
    .insert({ ...parsed, user_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (neu?.id) await autoBuchungen(supabase, user.id, neu.id, parsed);

  revalidatePath("/properties");
  revalidatePath("/");
  revalidatePath("/cashflow");
  // Direkt ins neue Objekt springen — dort schließen die Folgeschritte
  // (Mieter, Kredit, Buchung) ohne erneutes Suchen an.
  redirect(flashUrl(neu?.id ? `/properties/${neu.id}` : "/properties", "Immobilie angelegt."));
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);
  // Adresse geändert → gecachte Koordinaten verwerfen; die Portfolio-Karte
  // geocodiert beim nächsten Aufruf neu.
  const { data: alt } = await supabase.from("properties").select("adresse").eq("id", id).single();
  const koordReset = alt && (alt.adresse ?? null) !== parsed.adresse ? { lat: null, lng: null } : {};
  const { error } = await supabase.from("properties").update({ ...parsed, ...koordReset }).eq("id", id);
  if (error) throw new Error(error.message);

  // Manuell gepflegter Wert → als Stand für die Wertentwicklung protokollieren
  // (nur bei Änderung; siehe protokolliereWert).
  await protokolliereWert(supabase, user.id, id, parsed.wert, "manuell", "Objekt-Formular");

  await autoBuchungen(supabase, user.id, id, parsed);

  revalidatePath("/properties");
  revalidatePath("/");
  revalidatePath("/cashflow");
  redirect(flashUrl("/properties", "Immobilie gespeichert."));
}

export async function deleteProperty(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
  revalidatePath("/");
  redirect("/properties");
}

// Indexierte Wertschätzung übernehmen (Portfolio-Wert aktuell halten, §12):
// setzt den fortgeschriebenen Wert als "aktuellen Wert" — bewusst nur auf
// Klick des Nutzers (vorschlagen + bestätigen, keine stille Automatik).
export async function uebernehmeIndexwert(id: string, wert: number, standQuartal: string) {
  const supabase = createClient();
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
