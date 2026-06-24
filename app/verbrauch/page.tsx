import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import type { Verbrauch, Property } from "@/lib/types";

const ART_ICONS: Record<string, string> = { Strom: "⚡", Gas: "🔥", Wasser: "💧", Heizöl: "🛢", Fernwärme: "♨", Heizung: "♨", Sonstiges: "📦" };

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
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Verbrauch &amp; Nebenkosten</div>
          <div className="topbar-sub">Strom, Gas, Wasser, Heizung</div>
        </div>
        <Link href="/properties" className="btn btn-gold">＋ Verbrauch</Link>
      </div>

      <div className="section">
        <div className="section-header"><h3>Alle Einträge</h3></div>
        <div className="section-body">
          <table>
            <thead><tr><th>Datum</th><th>Immobilie</th><th>Art</th><th>Menge</th><th>Einheit</th><th>Kosten</th></tr></thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td>{datum(v.buchungsdatum)}</td>
                  <td style={{ color: "var(--muted)" }}>{v.prop_id ? nameOf.get(v.prop_id) ?? "–" : "–"}</td>
                  <td>{(v.art && ART_ICONS[v.art]) || ""} {v.art ?? "–"}</td>
                  <td>{v.menge ?? "–"}</td>
                  <td style={{ color: "var(--muted)" }}>{v.einheit ?? ""}</td>
                  <td style={{ fontWeight: 600 }}>{euro(v.verbrauchkosten)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6}><div className="empty"><div className="empty-icon">⚡</div>Noch kein Verbrauch</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
