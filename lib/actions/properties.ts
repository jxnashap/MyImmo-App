"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { flashUrl } from "@/lib/flash";

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
  redirect(flashUrl("/properties", "Immobilie angelegt."));
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parse(formData);
  const { error } = await supabase.from("properties").update(parsed).eq("id", id);
  if (error) throw new Error(error.message);

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
