"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  berechneUmlage,
  type UmlageZeile,
  type VerteilenInput,
  type VerteilenErgebnis,
} from "@/lib/umlage";

export async function verteileNebenkosten(input: VerteilenInput): Promise<VerteilenErgebnis> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { propId, jahr, zeilen, mieter } = input;

  // Mieter dieses Objekts laden (Eigentum wird zusätzlich per RLS erzwungen).
  const { data: dbMieter, error: ladeFehler } = await supabase
    .from("mieter")
    .select("id,vorname,nachname,flaeche")
    .eq("prop_id", propId);
  if (ladeFehler) return { ok: false, positionen: 0, mieter: 0, gesamt: 0, fehler: ladeFehler.message };

  const erlaubt = new Map((dbMieter ?? []).map((m) => [m.id, m]));

  // Übergebene m² nur für Mieter dieses Objekts übernehmen + ggf. persistieren.
  const flaecheMap = new Map(mieter.map((m) => [m.id, m.flaeche]));
  const aktiveMieter = (dbMieter ?? [])
    .filter((m) => flaecheMap.has(m.id))
    .map((m) => ({
      id: m.id,
      name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
      flaeche: Math.max(0, flaecheMap.get(m.id) ?? 0),
    }));

  if (aktiveMieter.length === 0) {
    return { ok: false, positionen: 0, mieter: 0, gesamt: 0, fehler: "Keine Mieter für dieses Objekt gefunden." };
  }

  // Geänderte m² in mieter.flaeche speichern (damit „vorher festgelegt" persistiert).
  await Promise.all(
    aktiveMieter
      .filter((m) => {
        const alt = erlaubt.get(m.id)?.flaeche ?? null;
        return alt == null || Number(alt) !== m.flaeche;
      })
      .map((m) => supabase.from("mieter").update({ flaeche: m.flaeche }).eq("id", m.id)),
  );

  // Nur gültige Kostenzeilen (Bezeichnung + positiver Betrag).
  const gueltigeZeilen: UmlageZeile[] = zeilen
    .filter((z) => z.bezeichnung.trim() !== "" && z.betrag > 0)
    .map((z) => ({ bezeichnung: z.bezeichnung.trim(), betrag: z.betrag, schluessel: z.schluessel }));

  const ergebnis = berechneUmlage(gueltigeZeilen, aktiveMieter);

  // Bestehende Assistenten-Positionen dieses Jahres ersetzen (manuelle bleiben).
  const mieterIds = aktiveMieter.map((m) => m.id);
  const { error: delFehler } = await supabase
    .from("mieter_positionen")
    .delete()
    .in("mieter_id", mieterIds)
    .eq("jahr", jahr)
    .eq("quelle", "umlage");
  if (delFehler) return { ok: false, positionen: 0, mieter: 0, gesamt: 0, fehler: delFehler.message };

  // Neue Positionen aufbauen (nur Beträge > 0).
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
      })),
  );

  if (rows.length > 0) {
    const { error: insFehler } = await supabase.from("mieter_positionen").insert(rows);
    if (insFehler) return { ok: false, positionen: 0, mieter: 0, gesamt: 0, fehler: insFehler.message };
  }

  // Betroffene Seiten neu validieren.
  revalidatePath(`/properties/${propId}`);
  for (const id of mieterIds) {
    revalidatePath(`/tenants/${id}/nk`);
    revalidatePath(`/tenants/${id}/edit`);
  }

  const belieferte = new Set(rows.map((r) => r.mieter_id)).size;
  return { ok: true, positionen: rows.length, mieter: belieferte, gesamt: ergebnis.gesamt };
}
