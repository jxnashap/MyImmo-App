import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { deleteVerbrauch } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import VerbrauchChart, { type VPoint } from "@/components/VerbrauchChart";
import type { Verbrauch, Property } from "@/lib/types";

const ART_ICONS: Record<string, string> = { Strom: "⚡", Gas: "🔥", Wasser: "💧", Heizöl: "🛢", Fernwärme: "♨", Heizung: "♨", Sonstiges: "📦" };

export default async function VerbrauchPage({ searchParams }: { searchParams: { prop?: string; art?: string } }) {
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

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Verbrauch &amp; Nebenkosten</div>
          <div className="topbar-sub">Strom, Gas, Wasser, Heizung</div>
        </div>
        <Link href="/verbrauch/new" className="btn btn-gold">＋ Verbrauch</Link>
      </div>

      <form method="get" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>🏠 Immobilie:</label>
        <select name="prop" defaultValue={searchParams.prop ?? ""} className="input" style={{ minWidth: 200 }}>
          <option value="">Alle Immobilien</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>⚡ Art:</label>
        <select name="art" defaultValue={searchParams.art ?? ""} className="input" style={{ minWidth: 150 }}>
          <option value="">Alle Arten</option>
          {arten.map((a) => <option key={a} value={a}>{(ART_ICONS[a] || "") + " " + a}</option>)}
        </select>
        <button className="btn btn-ghost">Filtern</button>
      </form>

      {charts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {charts.map(([art, g]) => (
            <VerbrauchChart key={art} art={art} einheit={g.einheit} points={g.points} />
          ))}
        </div>
      )}

      <div className="section">
        <div className="section-header"><h3>Alle Einträge</h3></div>
        <div className="section-body">
          <table className="list-table">
            <thead><tr><th>Datum</th><th>Immobilie</th><th>Art</th><th>Menge</th><th>Einheit</th><th>Kosten</th><th></th></tr></thead>
            <tbody>
              {list.map((v) => (
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
              {list.length === 0 && (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon">⚡</div>Noch kein Verbrauch</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
