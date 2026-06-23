import { createClient } from "@/lib/supabase/server";
import { eur2 } from "@/lib/format";
import type { Einnahme, Property } from "@/lib/types";

export default async function EinnahmenPage({
  searchParams,
}: {
  searchParams: { prop?: string };
}) {
  const supabase = createClient();
  const [{ data: einn }, { data: props }] = await Promise.all([
    supabase.from("einnahmen").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));

  let list = (einn ?? []) as Einnahme[];
  if (searchParams.prop) list = list.filter((e) => e.prop_id === searchParams.prop);
  const total = list.reduce((s, e) => s + (e.betrag ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Einnahmen</h1>
        <form method="get" className="flex items-center gap-2 text-sm">
          <select name="prop" defaultValue={searchParams.prop ?? ""} className="input">
            <option value="">Alle Immobilien</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.bezeichnung}</option>
            ))}
          </select>
          <button className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">Filtern</button>
        </form>
      </div>

      <div className="mb-4 text-sm text-white/50">
        {list.length} Buchungen · Summe <span className="gold">{eur2(total)}</span>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Immobilie</th>
              <th className="px-4 py-3 font-medium">Kategorie</th>
              <th className="px-4 py-3 font-medium">Beschreibung</th>
              <th className="px-4 py-3 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white/70">{e.buchungsdatum ?? "—"}</td>
                <td className="px-4 py-3 text-white/70">{e.prop_id ? nameOf.get(e.prop_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{e.kategorie ?? "—"}</td>
                <td className="px-4 py-3 text-white/60">{e.beschreibung ?? ""}</td>
                <td className="px-4 py-3 text-right gold">{eur2(e.betrag)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">Keine Einnahmen.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
