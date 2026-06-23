import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

const eur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default async function PropertiesPage() {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("*").order("bezeichnung");
  const list = (data ?? []) as Property[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Objekte</h1>
        <Link href="/properties/new" className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink">
          + Neues Objekt
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="text-white/50">Noch keine Objekte. Lege dein erstes an.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Bezeichnung</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Wert</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-white/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/properties/${p.id}`} className="text-gold hover:underline">
                      {p.bezeichnung}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70">{p.adresse || "—"}</td>
                  <td className="px-4 py-3 text-white/70">{p.obj_status || "—"}</td>
                  <td className="px-4 py-3 text-right">{eur(p.wert ?? p.kaufpreis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
