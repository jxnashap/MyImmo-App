import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
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
  const filters: FilterDef[] = [
    { name: "year", label: "Jahr", icon: "jahr", defaultValue: String(new Date().getFullYear()), options: years.map((y) => ({ value: String(y), label: String(y) })) },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Jahresbericht &amp; Steuer-Export</div>
          <div className="topbar-sub">Anlage V · Cashflow-Auswertung · Druckansicht</div>
        </div>
      </div>

      <FilterBar filters={filters} />

      <div className="section">
        <div className="section-header"><h3>Auswertung {year}</h3></div>
        <div className="section-body">
          <table className="list-table">
            <thead>
              <tr>
                <th>Immobilie</th>
                <th style={{ textAlign: "right" }}>Einnahmen</th>
                <th style={{ textAlign: "right" }}>Kosten</th>
                <th style={{ textAlign: "right" }}>Kreditraten</th>
                <th style={{ textAlign: "right" }}>Netto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ textAlign: "right", color: "var(--green)" }}>{euro(r.e)}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }}>{euro(r.k)}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }}>{euro(r.r)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: r.netto >= 0 ? "var(--green)" : "var(--red)" }}>{euro(r.netto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td style={{ borderTop: "2px solid var(--line2)" }}>Summe</td>
                <td style={{ textAlign: "right", color: "var(--green)", borderTop: "2px solid var(--line2)" }}>{euro(sum.e)}</td>
                <td style={{ textAlign: "right", color: "var(--red)", borderTop: "2px solid var(--line2)" }}>{euro(sum.k)}</td>
                <td style={{ textAlign: "right", color: "var(--red)", borderTop: "2px solid var(--line2)" }}>{euro(sum.r)}</td>
                <td style={{ textAlign: "right", color: sum.netto >= 0 ? "var(--green)" : "var(--red)", borderTop: "2px solid var(--line2)" }}>{euro(sum.netto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted)" }}>Tipp: Diese Seite lässt sich per Cmd+P als PDF speichern oder drucken.</p>
    </div>
  );
}
