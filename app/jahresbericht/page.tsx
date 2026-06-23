import { createClient } from "@/lib/supabase/server";
import { eur } from "@/lib/format";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";

export default async function JahresberichtPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const supabase = createClient();
  const year = Number(searchParams.year) || new Date().getFullYear();

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("einnahmen").select("*"),
    supabase.from("kosten").select("*"),
    supabase.from("kredite").select("*"),
  ]);

  const properties = (props ?? []) as Property[];
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];

  const inYear = (d: string | null) => !!d && d.startsWith(String(year));

  const rows = properties.map((p) => {
    const e = einnahmen.filter((x) => x.prop_id === p.id && inYear(x.buchungsdatum)).reduce((s, x) => s + (x.betrag ?? 0), 0);
    const k = kosten.filter((x) => x.prop_id === p.id && inYear(x.buchungsdatum)).reduce((s, x) => s + (x.betrag ?? 0), 0);
    const r = kredite.filter((x) => x.prop_id === p.id).reduce((s, x) => s + (x.monatsrate ?? 0), 0) * 12;
    return { name: p.bezeichnung, e, k, r, netto: e - k - r };
  });

  const sum = rows.reduce(
    (a, r) => ({ e: a.e + r.e, k: a.k + r.k, r: a.r + r.r, netto: a.netto + r.netto }),
    { e: 0, k: 0, r: 0, netto: 0 }
  );

  const years = [year + 1, year, year - 1, year - 2];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Jahresbericht {year}</h1>
        <form method="get" className="flex items-center gap-2 text-sm">
          <select name="year" defaultValue={String(year)} className="input">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">Anzeigen</button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Immobilie</th>
              <th className="px-4 py-3 text-right font-medium">Einnahmen</th>
              <th className="px-4 py-3 text-right font-medium">Kosten</th>
              <th className="px-4 py-3 text-right font-medium">Kreditraten</th>
              <th className="px-4 py-3 text-right font-medium">Netto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/10">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 text-right gold">{eur(r.e)}</td>
                <td className="px-4 py-3 text-right" style={{ color: "var(--red)" }}>{eur(r.k)}</td>
                <td className="px-4 py-3 text-right" style={{ color: "var(--red)" }}>{eur(r.r)}</td>
                <td className="px-4 py-3 text-right" style={{ color: r.netto >= 0 ? "var(--green)" : "var(--red)" }}>{eur(r.netto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/20 font-medium">
              <td className="px-4 py-3">Summe</td>
              <td className="px-4 py-3 text-right gold">{eur(sum.e)}</td>
              <td className="px-4 py-3 text-right" style={{ color: "var(--red)" }}>{eur(sum.k)}</td>
              <td className="px-4 py-3 text-right" style={{ color: "var(--red)" }}>{eur(sum.r)}</td>
              <td className="px-4 py-3 text-right" style={{ color: sum.netto >= 0 ? "var(--green)" : "var(--red)" }}>{eur(sum.netto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 text-xs text-white/40">
        Tipp: Diese Seite lässt sich per Cmd+P als PDF speichern oder drucken.
      </p>
    </div>
  );
}
