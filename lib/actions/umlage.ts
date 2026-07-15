"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { berechneUmlage, type UmlageZeile, type VerteilenInput, type VerteilenErgebnis } from "@/lib/umlage";
import { monateImJahr } from "@/lib/nk";

export async function verteileNebenkosten(input: VerteilenInput): Promise<VerteilenErgebnis> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { propId, jahr, zeitanteilig, zeilen, mieter } = input;

  const fehlerErg = (fehler: string): VerteilenErgebnis => ({
    ok: false,
    positionen: 0,
    mieter: 0,
    gesamt: 0,
    nichtUmgelegt: 0,
    fehler,
  });

  // Objekt (Gesamtfläche als Referenz fürs Zeitanteilige) + Mieter laden.
  const [{ data: prop }, { data: dbMieter, error: ladeFehler }] = await Promise.all([
    supabase.from("properties").select("flaeche").eq("id", propId).maybeSingle(),
    supabase.from("mieter").select("id,vorname,nachname,einheit,flaeche,mietbeginn,mietende").eq("prop_id", propId),
  ]);
  if (ladeFehler) return fehlerErg(ladeFehler.message);

  const erlaubt = new Map((dbMieter ?? []).map((m) => [m.id, m]));
  const flaecheMap = new Map(mieter.map((m) => [m.id, m.flaeche]));

  const aktiveMieter = (dbMieter ?? [])
    .filter((m) => flaecheMap.has(m.id))
    .map((m) => ({
      id: m.id,
      name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
      flaeche: Math.max(0, flaecheMap.get(m.id) ?? 0),
      monate: monateImJahr(jahr, m.mietbeginn, m.mietende).monate,
    }));

  if (aktiveMieter.length === 0) return fehlerErg("Keine Mieter für dieses Objekt gefunden.");

  // Geänderte m² in mieter.flaeche speichern (damit „vorher festgelegt" persistiert).
  await Promise.all(
    aktiveMieter
      .filter((m) => {
        // Nie eine gepflegte Fläche mit 0 überschreiben (leeres Feld im
        // Assistenten darf keinen Datenverlust auslösen).
        if (m.flaeche <= 0) return false;
        const alt = erlaubt.get(m.id)?.flaeche ?? null;
        return alt == null || Number(alt) !== m.flaeche;
      })
      .map((m) => supabase.from("mieter").update({ flaeche: m.flaeche }).eq("id", m.id)),
  );

  const gueltigeZeilen: UmlageZeile[] = zeilen
    .filter((z) => z.bezeichnung.trim() !== "" && z.betrag > 0)
    .map((z) => ({
      bezeichnung: z.bezeichnung.trim(),
      betrag: z.betrag,
      schluessel: z.schluessel,
      lohnanteil: z.lohnanteil,
      art35a: z.art35a,
    }));

  // Einheiten zählen (distinct einheit); ohne gepflegte Einheiten-Namen
  // bleibt die Mieterzahl die Näherung.
  const einheiten = new Set(
    (dbMieter ?? []).map((m) => (m.einheit ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const ergebnis = berechneUmlage(gueltigeZeilen, aktiveMieter, {
    zeitanteilig,
    referenzFlaeche: prop?.flaeche ?? 0,
    anzahlEinheiten: einheiten.size,
  });

  // Bestehende Assistenten-Positionen dieses Jahres ersetzen (manuelle bleiben).
  const mieterIds = aktiveMieter.map((m) => m.id);
  const { error: delFehler } = await supabase
    .from("mieter_positionen")
    .delete()
    .in("mieter_id", mieterIds)
    .eq("jahr", jahr)
    .eq("quelle", "umlage");
  if (delFehler) return fehlerErg(delFehler.message);

  const rows = ergebnis.perMieter.flatMap((m) =>
    m.positionen
      .filter((p) => p.betrag > 0)
      .map((p) => ({
        user_id: user.id,
        mieter_id: m.id,
        bezeichnung: p.bezeichnung,
        betrag: p.betrag,
        umlageschluessel: p.schluessel,
        jahr,
        umlagefaehig: true,
        quelle: "umlage",
        lohnanteil: p.lohnanteil && p.lohnanteil > 0 ? p.lohnanteil : null,
        art_35a: p.art35a ?? null,
      })),
  );

  if (rows.length > 0) {
    const { error: insFehler } = await supabase.from("mieter_positionen").insert(rows);
    if (insFehler) return fehlerErg(insFehler.message);
  }

  revalidatePath(`/properties/${propId}`);
  for (const id of mieterIds) {
    revalidatePath(`/tenants/${id}/nk`);
    revalidatePath(`/tenants/${id}/edit`);
  }

  const belieferte = new Set(rows.map((r) => r.mieter_id)).size;
  return {
    ok: true,
    positionen: rows.length,
    mieter: belieferte,
    gesamt: ergebnis.gesamt,
    nichtUmgelegt: ergebnis.nichtUmgelegt,
  };
}
