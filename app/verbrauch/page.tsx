import { createClient } from "@/lib/supabase/server";
import { eur2 } from "@/lib/format";
import type { Verbrauch, Property } from "@/lib/types";

export default async function VerbrauchPage() {
  const supabase = createClient();
  const [{ data: verb }, { data: props }] = await Promise.all([
    supabase.from("verbrauch").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = (verb ?? []) as Verbrauch[];

  return (
    <div>
      <h1 className="mb-6 text-3xl">Verbrauch</h1>
      <div className="overflow-hidden rounded-[10px] border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Immobilie</th>
              <th className="px-4 py-3 font-medium">Art</th>
              <th className="px-4 py-3 text-right font-medium">Menge</th>
              <th className="px-4 py-3 text-right font-medium">Kosten</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white/70">{v.buchungsdatum ?? "—"}</td>
                <td className="px-4 py-3 text-white/70">{v.prop_id ? nameOf.get(v.prop_id) ?? "—" : "—"}</td>
                <td className="px-4 py-3">{v.art ?? "—"}</td>
                <td className="px-4 py-3 text-right">{v.menge != null ? `${v.menge} ${v.einheit ?? ""}` : "—"}</td>
                <td className="px-4 py-3 text-right">{eur2(v.verbrauchkosten)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">Keine Verbrauchsdaten.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
