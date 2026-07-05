"use server";

// CO₂-Kostenaufteilung in der NK-Abrechnung: Eingaben (Brennstoffrechnung)
// je Mieter + Jahr speichern (Upsert) und optional den Vermieteranteil als
// Kosten-Buchung anlegen (Werbungskosten / Anlage V).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { co2Aufteilung } from "@/lib/co2";

export type NkCo2Result = { ok: boolean; error?: string };

const num = (fd: FormData, k: string): number | null => {
  const s = String(fd.get(k) ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function speichereNkCo2(
  mieterId: string,
  jahr: number,
  fd: FormData,
): Promise<NkCo2Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100)
    return { ok: false, error: "Ungültiges Abrechnungsjahr." };

  const { error } = await supabase.from("nk_co2").upsert(
    {
      user_id: user.id,
      mieter_id: mieterId,
      jahr,
      co2_kg: num(fd, "co2_kg"),
      co2_kosten: num(fd, "co2_kosten"),
      flaeche: num(fd, "flaeche"),
      gewerbe: fd.get("gewerbe") === "on",
    },
    { onConflict: "mieter_id,jahr" },
  );
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}/nk`);
  return { ok: true };
}

export async function loescheNkCo2(mieterId: string, jahr: number): Promise<NkCo2Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { error } = await supabase
    .from("nk_co2")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("jahr", jahr);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}/nk`);
  return { ok: true };
}

const KOSTEN_KATEGORIE = "CO₂-Kosten (Vermieteranteil)";

// Vermieteranteil als Kosten buchen — taucht damit in Werbungskosten/Anlage V
// auf. Doppelbuchung wird über kategorie + mieter + Jahresultimo verhindert.
export async function bucheCo2Vermieteranteil(
  mieterId: string,
  jahr: number,
): Promise<NkCo2Result & { betrag?: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const [{ data: row }, { data: tenant }] = await Promise.all([
    supabase
      .from("nk_co2")
      .select("co2_kg,co2_kosten,flaeche,gewerbe")
      .eq("mieter_id", mieterId)
      .eq("jahr", jahr)
      .maybeSingle(),
    supabase.from("mieter").select("vorname,nachname,prop_id").eq("id", mieterId).single(),
  ]);
  if (!row || !tenant) return { ok: false, error: "Keine CO₂-Daten gespeichert." };
  if (!(Number(row.co2_kg) > 0) || !(Number(row.flaeche) > 0))
    return { ok: false, error: "CO₂-Menge und Wohnfläche fehlen." };

  const a = co2Aufteilung({
    co2Kg: Number(row.co2_kg),
    co2Kosten: row.co2_kosten != null ? Number(row.co2_kosten) : null,
    flaeche: Number(row.flaeche),
    jahr,
    gewerbe: !!row.gewerbe,
  });
  if (!(a.vermieterAnteil > 0))
    return { ok: false, error: "Vermieteranteil ist 0 € — nichts zu buchen." };

  const buchungsdatum = `${jahr}-12-31`;
  const { data: vorhanden } = await supabase
    .from("kosten")
    .select("id")
    .eq("mieter_id", mieterId)
    .eq("kategorie", KOSTEN_KATEGORIE)
    .eq("buchungsdatum", buchungsdatum)
    .limit(1);
  if (vorhanden && vorhanden.length > 0)
    return { ok: false, error: `Für ${jahr} bereits gebucht (siehe Kosten).` };

  const name = [tenant.vorname, tenant.nachname].filter(Boolean).join(" ") || "Mieter";
  const { error } = await supabase.from("kosten").insert({
    user_id: user.id,
    prop_id: tenant.prop_id,
    mieter_id: mieterId,
    buchungsdatum,
    kategorie: KOSTEN_KATEGORIE,
    betrag: a.vermieterAnteil,
    beschreibung: `CO₂-Vermieteranteil NK ${jahr} · ${name} (${a.vermieterProzent} %)`,
  });
  if (error) return { ok: false, error: "Buchen fehlgeschlagen." };

  revalidatePath(`/tenants/${mieterId}/nk`);
  revalidatePath("/kosten");
  revalidatePath("/cashflow");
  return { ok: true, betrag: a.vermieterAnteil };
}
