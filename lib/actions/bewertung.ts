"use server";

// Server-Action „Jetzt aktualisieren" für die Immobilienbewertung.
// Ablauf: Geocoding (falls nötig) → Bodenrichtwert best-effort → Comparables
// (Eigenbestand + IS24-Stub) → Kennzahlen (manuell > gespeichert > auto) →
// ImmoWertV-Rechnung → persistieren (properties + Historie + Comparables-Snapshot).
// Keys/Endpunkte ausschließlich über ENV (siehe lib/valuation/sources/*).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { geocode } from "@/lib/valuation/sources/geocode";
import { bodenrichtwertAbrufen } from "@/lib/valuation/sources/boris";
import { eigenbestandComparables, is24Comparables, type Vergleichsangebot } from "@/lib/valuation/sources/comparables";
import { bewerten, type Kennzahlen, type Verfahren } from "@/lib/valuation/bewerten";

const numOr = (fd: FormData, k: string): number | null => {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

export async function refreshBewertung(propId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: prop } = await supabase.from("properties").select("*").eq("id", propId).single();
  if (!prop || prop.user_id !== user.id) return;

  // Manuelle Overrides aus dem Formular (haben Vorrang).
  const manual = {
    bodenrichtwert: numOr(formData, "bodenrichtwert"),
    liegenschaftszins: numOr(formData, "liegenschaftszins"),
    restnutzungsdauer: numOr(formData, "restnutzungsdauer"),
    vergleichspreis_m2: numOr(formData, "vergleichspreis_m2"),
    vergleichsmiete_m2: numOr(formData, "vergleichsmiete_m2"),
  };
  const vf = String(formData.get("bewertungsverfahren") ?? "");
  const verfahrenOverride = (vf === "vergleich" || vf === "ertrag" || vf === "sach") ? (vf as Verfahren) : null;

  // 1) Geocoding (nur wenn Koordinaten fehlen).
  let lat: number | null = prop.latitude;
  let lng: number | null = prop.longitude;
  if ((lat == null || lng == null) && prop.adresse) {
    const g = await geocode(prop.adresse);
    if (g) { lat = g.lat; lng = g.lng; }
  }

  // 2) Bodenrichtwert: manuell > gespeichert > Auto-Abruf (best effort).
  let brw: number | null = manual.bodenrichtwert ?? prop.bodenrichtwert ?? null;
  let brwStichtag: string | null = prop.bodenrichtwert_stichtag ?? null;
  let brwQuelle = manual.bodenrichtwert != null ? "manuell" : (prop.bodenrichtwert != null ? "gespeichert" : "—");
  if (manual.bodenrichtwert == null) {
    const b = await bodenrichtwertAbrufen(lat, lng);
    if (b) { brw = b.wert; brwStichtag = b.stichtag; brwQuelle = b.quelle; }
  }

  // 3) Comparables (Eigenbestand + IS24-Stub).
  let comps: Vergleichsangebot[] = [];
  if (lat != null && lng != null) {
    const { data: others } = await supabase
      .from("properties").select("id,typ,flaeche,zimmer,wert,latitude,longitude").eq("user_id", user.id);
    comps = eigenbestandComparables(
      { id: propId, typ: prop.typ, flaeche: prop.flaeche, latitude: lat, longitude: lng },
      (others ?? []) as never[], 5,
    );
    const is24 = await is24Comparables(lat, lng, { typ: prop.typ, flaeche: prop.flaeche });
    comps = [...comps, ...is24];
  }

  // 4) Kennzahlen + Rechnung.
  const kennzahlen: Kennzahlen = {
    bodenrichtwertM2: brw,
    liegenschaftszinsProzent: manual.liegenschaftszins ?? prop.liegenschaftszins,
    restnutzungsdauer: manual.restnutzungsdauer ?? prop.restnutzungsdauer,
    vergleichspreisM2: manual.vergleichspreis_m2 ?? prop.vergleichspreis_m2,
    vergleichsmieteM2: manual.vergleichsmiete_m2 ?? prop.vergleichsmiete_m2,
  };
  const jahr = new Date().getFullYear();
  const erg = bewerten(
    { typ: prop.typ, obj_status: prop.obj_status, flaeche: prop.flaeche, grundstuecksflaeche: prop.grundstuecksflaeche, baujahr: prop.baujahr, miete: prop.miete },
    kennzahlen, jahr, verfahrenOverride,
  );

  const now = new Date().toISOString();
  const quelleninfo = {
    brwQuelle, brwStichtag, geokodiert: lat != null && lng != null,
    comparables: comps.length,
    is24Aktiv: process.env.VALUATION_IS24_ENABLED === "true",
    avmAktiv: process.env.VALUATION_AVM_ENABLED === "true",
    borisAktiv: process.env.VALUATION_BORIS_ENABLED === "true",
    stand: now,
  };

  // 5) Persistieren.
  await supabase.from("properties").update({
    latitude: lat, longitude: lng,
    bodenrichtwert: brw, bodenrichtwert_stichtag: brwStichtag,
    liegenschaftszins: kennzahlen.liegenschaftszinsProzent,
    restnutzungsdauer: kennzahlen.restnutzungsdauer,
    vergleichspreis_m2: kennzahlen.vergleichspreisM2,
    vergleichsmiete_m2: kennzahlen.vergleichsmieteM2,
    marktwert_aktuell: erg.marktwert,
    marktwert_stand: erg.marktwert != null ? now : null,
    bewertungsverfahren: erg.verfahren,
    bewertung_quelleninfo: quelleninfo,
  }).eq("id", propId);

  // Comparables-Snapshot ersetzen.
  await supabase.from("vergleichsangebote").delete().eq("immobilie_id", propId);
  if (comps.length) {
    await supabase.from("vergleichsangebote").insert(comps.map((c) => ({
      user_id: user.id, immobilie_id: propId, quelle: c.quelle, externe_id: c.externe_id, art: c.art,
      flaeche: c.flaeche, zimmer: c.zimmer, preis: c.preis, preis_pro_qm: c.preis_pro_qm,
      distanz_km: c.distanz_km, angebots_datum: c.angebots_datum,
    })));
  }

  // Historie fortschreiben — nur wenn Wert vorliegt UND sich geändert hat.
  if (erg.marktwert != null) {
    const { data: letzte } = await supabase
      .from("bewertung_historie").select("marktwert").eq("immobilie_id", propId)
      .order("datum", { ascending: false }).limit(1);
    const vorher = letzte?.[0]?.marktwert ?? null;
    if (vorher == null || Math.round(vorher) !== erg.marktwert) {
      await supabase.from("bewertung_historie").insert({
        user_id: user.id, immobilie_id: propId, verfahren: erg.verfahren,
        marktwert: erg.marktwert, mietwert: erg.mietwert,
        eingangsdaten: { kennzahlen, comparables: comps.slice(0, 20), quelleninfo }, quelle: "ImmoWertV/App",
      });
    }
  }

  revalidatePath(`/properties/${propId}`);
}
