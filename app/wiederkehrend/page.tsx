import { createClient } from "@/lib/supabase/server";
import WiederkehrManager from "@/components/WiederkehrManager";
import type { WiederkehrVorlage, Property, Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

// Wiederkehrende Buchungen: Vorlagen + je Vorlage die bereits erzeugten
// Buchungsdaten (für die Offen-Vorschau und den Dedup).
export default async function WiederkehrendPage() {
  const supabase = createClient();

  const [{ data: vRows }, { data: propRows }, { data: mieterRows }, { data: einn }, { data: kost }] =
    await Promise.all([
      supabase.from("wiederkehrende_buchungen").select("*").order("created_at", { ascending: false }),
      supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
      supabase.from("mieter").select("id,vorname,nachname,prop_id").order("nachname"),
      supabase.from("einnahmen").select("wiederkehr_id,buchungsdatum").not("wiederkehr_id", "is", null),
      supabase.from("kosten").select("wiederkehr_id,buchungsdatum").not("wiederkehr_id", "is", null),
    ]);

  const vorlagen = (vRows ?? []) as WiederkehrVorlage[];

  // Buchungsdaten je Vorlage sammeln (Einnahmen + Kosten).
  const gebucht = new Map<string, string[]>();
  for (const r of [...(einn ?? []), ...(kost ?? [])]) {
    const id = (r as { wiederkehr_id: string | null }).wiederkehr_id;
    const d = (r as { buchungsdatum: string | null }).buchungsdatum;
    if (!id || !d) continue;
    if (!gebucht.has(id)) gebucht.set(id, []);
    gebucht.get(id)!.push(d);
  }

  const properties = ((propRows ?? []) as Pick<Property, "id" | "bezeichnung">[]).map((p) => ({
    id: p.id,
    bezeichnung: p.bezeichnung ?? "Objekt",
  }));
  const propNamen: Record<string, string> = Object.fromEntries(properties.map((p) => [p.id, p.bezeichnung]));

  const mieter = ((mieterRows ?? []) as Pick<Tenant, "id" | "vorname" | "nachname" | "prop_id">[]).map((m) => ({
    id: m.id,
    name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
    prop_id: m.prop_id,
  }));
  const mieterNamen: Record<string, string> = Object.fromEntries(mieter.map((m) => [m.id, m.name]));

  const mitStatus = vorlagen.map((v) => ({ ...v, gebuchteDaten: gebucht.get(v.id) ?? [] }));

  return (
    <WiederkehrManager
      vorlagen={mitStatus}
      propNamen={propNamen}
      mieterNamen={mieterNamen}
      properties={properties}
      mieter={mieter}
    />
  );
}
