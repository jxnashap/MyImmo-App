"use server";

// Zählerstand-Meldungen (Etappe 4): Mieter melden Stände mit Foto-Beleg,
// der Vermieter übernimmt sie — ab der zweiten Meldung desselben Zählers
// wird die Differenz automatisch als Verbrauch gebucht.
import { revalidatePath } from "next/cache";
import { ladeAlle } from "@/lib/db/ladeAlle";
import { zaehlerVerbrauch, type ZaehlerMeldung } from "@/lib/zaehlerVerbrauch";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/zeitraum";

const ARTEN = ["Strom", "Gas", "Wasser", "Warmwasser", "Fernwärme", "Öl", "Sonstiges"] as const;
const MAX_FOTO = 4 * 1024 * 1024;
const FOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Zählerstand aus dem Formular lesen. Das Feld ist ein TEXTfeld
 * (`ZaehlerPortal.tsx`, `inputMode="decimal"` steuert nur die Handy-Tastatur).
 *
 * HIER BEWUSST NICHT `zahlDe()` AUS lib/zahl.ts — im Gegensatz zu Geldbeträgen:
 * Gas- und Wasserzähler haben regulär DREI Nachkommastellen ("5123.456" m³).
 * `zahlDe()` deutet einen Punkt vor drei Ziffern als Tausenderpunkt und würde
 * daraus 5.123.456 machen. Die Euro-Heuristik ist hier also falsch.
 *
 * BEHOBEN WURDE (07.09.2026) der eindeutige Fall: Steht ein Komma im Wert, sind
 * die Punkte Tausendertrennzeichen. Vorher lief hier
 * `parseFloat(s.replace(",", "."))` — das ersetzt nur das ERSTE Komma und ließ
 * die Punkte stehen: Aus "14.382,5" wurde 14,382 statt 14382,5, also das
 * Tausendfache daneben. Der Wert wandert über `uebernehmeZaehlerstand` als
 * Differenz in die Verbrauchsbuchung und von dort in die Nebenkostenabrechnung
 * des Mieters.
 *
 * OFFEN UND UNAUFLÖSBAR: "14.382" ohne Komma bleibt mehrdeutig — beim Stromzähler
 * sind vierzehntausend gemeint, beim Gaszähler vierzehn Komma drei-acht-zwei.
 * Es bleibt beim Dezimalpunkt (die für Zähler häufigere Lesart). Der Platzhalter
 * im Formular zeigt deshalb die Komma-Schreibweise.
 */
function parseStand(roh: string): number {
  const t = roh.trim().replace(/\s/g, "");
  // Komma vorhanden → deutsche Schreibweise, Punkte sind Tausender.
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  // `Number` statt `parseFloat`: "123abc" ist kein Zählerstand, sondern ein
  // Vertipper — parseFloat hätte daraus stillschweigend 123 gemacht.
  return norm === "" ? Number.NaN : Number(norm);
}

export async function meldeZaehlerstand(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Du bist nicht mehr angemeldet — bitte neu anmelden." };

  const art = String(formData.get("art") ?? "Strom");
  const stand = parseStand(String(formData.get("stand") ?? ""));
  const einheit = String(formData.get("einheit") ?? "kWh").trim() || "kWh";
  const zaehlernummer = String(formData.get("zaehlernummer") ?? "").trim();
  // Berliner Datum: zwischen 0 und 2 Uhr stand sonst der Vortag da (UTC).
  const ablesedatum = String(formData.get("ablesedatum") ?? "").trim() || heuteBerlin();
  const notiz = String(formData.get("notiz") ?? "").trim();
  if (!ARTEN.includes(art as (typeof ARTEN)[number])) return { error: "Ungültige Zählerart." };
  if (!Number.isFinite(stand) || stand < 0) return { error: "Bitte gib einen gültigen Zählerstand an." };

  const foto = formData.get("foto");
  let fotoFelder: Record<string, string> = {};
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > MAX_FOTO) return { error: "Das Foto ist größer als 4 MB." };
    if (!FOTO_MIME.includes(foto.type)) return { error: "Nur Fotos (JPG/PNG/WebP/HEIC) erlaubt." };
    fotoFelder = {
      foto_name: foto.name,
      foto_type: foto.type,
      foto_data: Buffer.from(await foto.arrayBuffer()).toString("base64"),
    };
  }

  const { data: zugang } = await supabase
    .from("mieter_zugaenge")
    .select("vermieter_id,mieter_id,prop_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!zugang) return { error: "Dein Konto ist mit keiner Wohnung verknüpft." };

  const { error } = await supabase.from("zaehlerstand_meldungen").insert({
    mieter_user_id: user.id,
    vermieter_id: zugang.vermieter_id,
    mieter_id: zugang.mieter_id,
    prop_id: zugang.prop_id,
    art,
    zaehlernummer: zaehlernummer || null,
    stand,
    einheit,
    ablesedatum,
    notiz: notiz || null,
    ...fotoFelder,
  });
  if (error) return { error: "Meldung konnte nicht gespeichert werden." };
  revalidatePath("/portal");
  revalidatePath("/verbrauch");
  return { ok: true };
}

export async function uebernehmeZaehlerstand(meldungId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Du bist nicht mehr angemeldet — bitte neu anmelden." };

  // B07 (11.10.2026): Erst BEANSPRUCHEN — bedingt auf „noch nicht übernommen“. Ein Doppelklick oder ein
  // paralleler Aufruf findet die Meldung danach schon übernommen und bucht keinen zweiten Verbrauch.
  // Vorher: lesen → Verbrauch buchen → markieren; zwei Aufrufe dazwischen buchten zweimal.
  const jetzt = new Date().toISOString();
  const { data: m, error: claimFehler } = await supabase
    .from("zaehlerstand_meldungen")
    .update({ uebernommen_am: jetzt })
    .eq("id", meldungId)
    .eq("vermieter_id", user.id)
    .is("uebernommen_am", null)
    .select("id,art,einheit,zaehlernummer,mieter_id,prop_id,stand,ablesedatum")
    .maybeSingle();
  if (claimFehler) return { error: "Konnte nicht gespeichert werden." };
  if (!m) {
    const { data: da } = await supabase
      .from("zaehlerstand_meldungen").select("uebernommen_am").eq("id", meldungId).eq("vermieter_id", user.id).maybeSingle();
    return { error: da ? "Bereits übernommen." : "Meldung nicht gefunden." };
  }
  const zuruecknehmen = async (fehler: string) => {
    const { error: rueck } = await supabase.from("zaehlerstand_meldungen").update({ uebernommen_am: null })
      .eq("id", meldungId).eq("vermieter_id", user.id).eq("uebernommen_am", jetzt);
    return { error: rueck ? `${fehler} Die Meldung steht trotzdem als übernommen — bitte Seite neu laden.` : fehler };
  };

  // Frühere übernommene Meldungen derselben Zählerart — WELCHE zum selben Zähler gehört, entscheidet
  // `zaehlerVerbrauch()` (B11: Nummer, Einheit, Mietverhältnis, zeitliche Folge). Der Abfragefehler
  // MUSS ausgewertet werden: Leer hieße „erste Meldung“, und der Verbrauch dieses Zeitraums fehlte
  // dauerhaft (die nächste Differenz zählte ab DIESEM Stand weiter).
  let vorher: ZaehlerMeldung[];
  try {
    vorher = await ladeAlle<ZaehlerMeldung & { id: string }>("zaehlerstand_meldungen", (von, bis) =>
      supabase.from("zaehlerstand_meldungen")
        .select("id,art,einheit,zaehlernummer,mieter_id,prop_id,stand,ablesedatum")
        .eq("vermieter_id", user.id).eq("art", m.art).neq("id", meldungId)
        .not("uebernommen_am", "is", null)
        .order("id").range(von, bis));
  } catch {
    return zuruecknehmen("Der vorherige Zählerstand konnte nicht gelesen werden — es wurde nichts übernommen.");
  }

  const erg = zaehlerVerbrauch(m as ZaehlerMeldung, vorher);
  let verbrauchGebucht = false;
  if (erg.art === "verbrauch" && erg.menge > 0) {
    // `meldung_id` ist eindeutig (Migration 20261011110000): Je Meldung höchstens EIN Verbrauch.
    const { error: vErr } = await supabase.from("verbrauch").insert({
      user_id: user.id,
      prop_id: m.prop_id,
      buchungsdatum: m.ablesedatum,
      art: m.art,
      menge: erg.menge,
      einheit: m.einheit,
      meldung_id: meldungId,
    });
    if (vErr && vErr.code !== "23505") return zuruecknehmen("Verbrauch konnte nicht gebucht werden.");
    verbrauchGebucht = !vErr;
  }

  revalidatePath("/verbrauch");
  revalidatePath("/portal");
  return {
    ok: true,
    verbrauchGebucht,
    ...(erg.art === "rueckfrage" ? { hinweis: erg.grund } : {}),
  };
}
