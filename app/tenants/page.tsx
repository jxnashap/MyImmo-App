import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tenant, Property } from "@/lib/types";

const eur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default async function TenantsPage() {
  const supabase = createClient();
  const [{ data: tenants }, { data: props }] = await Promise.all([
    supabase.from("mieter").select("*").order("nachname"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const list = (tenants ?? []) as Tenant[];
  const propList = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const propMap = new Map(propList.map((p): [string, string] => [p.id, p.bezeichnung]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mieter</h1>
        <Link href="/tenants/new" className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink">
          + Neuer Mieter
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="text-white/50">Noch keine Mieter angelegt.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Objekt</th>
                <th className="px-4 py-3 font-medium">Einheit</th>
                <th className="px-4 py-3 text-right font-medium">Kaltmiete</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-white/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${t.id}/edit`} className="text-gold hover:underline">
                      {[t.vorname, t.nachname].filter(Boolean).join(" ") || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70">{t.prop_id ? propMap.get(t.prop_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 text-white/70">{t.einheit || "—"}</td>
                  <td className="px-4 py-3 text-right">{eur(t.kaltmiete)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
