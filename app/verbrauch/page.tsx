import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { deleteVerbrauch } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import ExpandableRows from "@/components/ExpandableRows";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import VerbrauchChart, { type VPoint } from "@/components/VerbrauchChart";
import type { Verbrauch, Property } from "@/lib/types";

const ART_ICONS: Record<string, string> = { Strom: "⚡", Gas: "🔥", Wasser: "💧", Heizöl: "🛢", Fernwärme: "♨", Heizung: "♨", Sonstiges: "📦" };

export default async function VerbrauchPage({ searchParams }: { searchParams: { prop?: string; art?: string; jahr?: string } }) {
  const supabase = createClient();
  const [{ data: verb }, { data: props }] = await Promise.all([
    supabase.from("verbrauch").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  let list = (verb ?? []) as Verbrauch[];
  if (searchParams.prop) list = list.filter((v) => v.prop_id === searchParams.prop);
  if (searchParams.art) list = list.filter((v) => (v.art ?? "") === searchParams.art);
  const arten = Array.from(new Set(((verb ?? []) as Verbrauch[]).map((v) => v.art).filter(Boolean))) as string[];

  // Verlaufs-Charts je Art (aus der gefilterten Liste, chronologisch)
  const kurzDatum = (d: string | null) => (d ? new Date(d).toLocaleDateString("de-DE", { month: "2-digit", year: "2-digit" }) : "—");
  const chartGruppen = new Map<string, { einheit: string; points: VPoint[] }>();
  for (const v of [...list].sort((a, b) => (a.buchungsdatum ?? "").localeCompare(b.buchungsdatum ?? ""))) {
    if (!v.art || v.menge == null) continue;
    const g = chartGruppen.get(v.art) ?? { einheit: v.einheit ?? "", points: [] };
    g.einheit = g.einheit || (v.einheit ?? "");
    g.points.push({ label: kurzDatum(v.buchungsdatum), menge: v.menge, kosten: v.verbrauchkosten ?? 0 });
    chartGruppen.set(v.art, g);
  }
  const charts = Array.from(chartGruppen.entries()).filter(([, g]) => g.points.length > 0);

  // Jahresfilter nur für die Tabelle (Charts behalten den Mehrjahres-Verlauf).
  const aktuellesJahr = new Date().getFullYear();
  const jahr = searchParams.jahr ?? String(aktuellesJahr);
  const jahre = Array.from(
    new Set([
      ...((verb ?? []) as Verbrauch[]).map((v) => (v.buchungsdatum ? new Date(v.buchungsdatum).getFullYear() : null)),
      aktuellesJahr,
    ].filter((y): y is number => y != null))
  ).sort((a, b) => b - a);
  const tabelle = jahr !== "alle"
    ? list.filter((v) => v.buchungsdatum && new Date(v.buchungsdatum).getFullYear() === Number(jahr))
    : list;

  const filters: FilterDef[] = [
    { name: "prop", label: "Immobilie", icon: "home", options: [{ value: "", label: "Alle Immobilien" }, ...properties.map((p) => ({ value: p.id, label: p.bezeichnung }))] },
    { name: "art", label: "Art", icon: "art", options: [{ value: "", label: "Alle Arten" }, ...arten.map((a) => ({ value: a, label: a }))] },
    { name: "jahr", label: "Jahr", icon: "jahr", defaultValue: String(aktuellesJahr), options: [...jahre.map((y) => ({ value: String(y), label: String(y) })), { value: "alle", label: "Alle Jahre" }] },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Verbrauch &amp; Nebenkosten</div>
          <div className="topbar-sub">Strom, Gas, Wasser, Heizung</div>
        </div>
        <Link href="/verbrauch/new" className="btn btn-gold">＋ Verbrauch</Link>
      </div>

      <FilterBar filters={filters} />

      {charts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {charts.map(([art, g]) => (
            <VerbrauchChart key={art} art={art} einheit={g.einheit} points={g.points} />
          ))}
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h3>Alle Einträge</h3>
        </div>
        <div className="section-body">
          <table className="list-table">
            <thead><tr><th>Datum</th><th>Immobilie</th><th>Art</th><th>Menge</th><th>Einheit</th><th>Kosten</th><th></th></tr></thead>
            <ExpandableRows cols={7} limit={10} label="weitere Einträge">
              {tabelle.map((v) => (
                <tr key={v.id}>
                  <td>{datum(v.buchungsdatum)}</td>
                  <td style={{ color: "var(--muted)" }}>{v.prop_id ? nameOf.get(v.prop_id) ?? "–" : "–"}</td>
                  <td>{(v.art && ART_ICONS[v.art]) || ""} {v.art ?? "–"}</td>
                  <td>{v.menge ?? "–"}</td>
                  <td style={{ color: "var(--muted)" }}>{v.einheit ?? ""}</td>
                  <td style={{ fontWeight: 600 }}>{euro(v.verbrauchkosten)}</td>
                  <td style={{ textAlign: "right" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><Link href={`/verbrauch/${v.id}/edit`} className="delete-btn" title="Bearbeiten" style={{ color: "var(--muted)" }}>✎</Link><DeleteButton action={deleteVerbrauch.bind(null, v.id)} className="delete-btn" label="✕" confirmText="Eintrag löschen?" /></span></td>
                </tr>
              ))}
              {tabelle.length === 0 && (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon">⚡</div>Noch kein Verbrauch</div></td></tr>
              )}
            </ExpandableRows>
          </table>
        </div>
      </div>
    </div>
  );
}
