import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { deleteEinnahme } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import ExpandableRows from "@/components/ExpandableRows";
import YearSelect from "@/components/YearSelect";
import type { Einnahme, Property } from "@/lib/types";

export default async function EinnahmenPage({
  searchParams,
}: {
  searchParams: { prop?: string; kategorie?: string; jahr?: string };
}) {
  const supabase = createClient();
  const [{ data: einn }, { data: props }] = await Promise.all([
    supabase.from("einnahmen").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));

  const KATEGORIEN = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"];
  let list = (einn ?? []) as Einnahme[];
  if (searchParams.prop) list = list.filter((e) => e.prop_id === searchParams.prop);
  if (searchParams.kategorie) list = list.filter((e) => (e.kategorie ?? "") === searchParams.kategorie);

  const aktuellesJahr = new Date().getFullYear();
  const jahr = searchParams.jahr ?? String(aktuellesJahr);
  const jahre = Array.from(
    new Set([
      ...((einn ?? []) as Einnahme[]).map((e) => (e.buchungsdatum ? new Date(e.buchungsdatum).getFullYear() : null)),
      aktuellesJahr,
    ].filter((y): y is number => y != null))
  ).sort((a, b) => b - a);
  if (jahr !== "alle") list = list.filter((e) => e.buchungsdatum && new Date(e.buchungsdatum).getFullYear() === Number(jahr));

  const total = list.reduce((s, e) => s + (e.betrag ?? 0), 0);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Einnahmen</div>
          <div className="topbar-sub">Miete und sonstige Erträge</div>
        </div>
        <Link href="/einnahmen/new" className="btn btn-gold">＋ Einnahme</Link>
      </div>

      <form method="get" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <input type="hidden" name="jahr" value={jahr} />
        <label style={{ fontSize: 12, color: "var(--muted)" }}>🏠 Immobilie:</label>
        <select name="prop" defaultValue={searchParams.prop ?? ""} className="input" style={{ minWidth: 200 }}>
          <option value="">Alle Immobilien</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "var(--muted)" }}>🏷️ Kategorie:</label>
        <select name="kategorie" defaultValue={searchParams.kategorie ?? ""} className="input" style={{ minWidth: 170 }}>
          <option value="">Alle Kategorien</option>
          {KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button className="btn btn-ghost">Filtern</button>
      </form>

      <div className="section">
        <div className="section-header">
          <h3>Alle Einnahmen</h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <YearSelect years={jahre} current={jahr} params={searchParams} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{list.length} Buchungen · <span style={{ color: "var(--green)" }}>{euro(total)}</span></span>
          </div>
        </div>
        <div className="section-body">
          <table className="list-table">
            <thead><tr><th>Datum</th><th>Immobilie</th><th>Kategorie</th><th>Beschreibung</th><th>Betrag</th><th></th></tr></thead>
            <ExpandableRows cols={6} limit={10} label="weitere Buchungen">
              {list.map((e) => (
                <tr key={e.id}>
                  <td>{datum(e.buchungsdatum)}</td>
                  <td style={{ color: "var(--muted)" }}>{e.prop_id ? nameOf.get(e.prop_id) ?? "–" : "–"}</td>
                  <td>{e.kategorie ? <span className="badge badge-green">{e.kategorie}</span> : "–"}</td>
                  <td style={{ color: "var(--muted)" }}>{e.beschreibung ?? ""}</td>
                  <td style={{ fontWeight: 600, color: "var(--green)" }}>{euro(e.betrag)}</td>
                  <td style={{ textAlign: "right" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><Link href={`/einnahmen/${e.id}/edit`} className="delete-btn" title="Bearbeiten" style={{ color: "var(--muted)" }}>✎</Link><DeleteButton action={deleteEinnahme.bind(null, e.id)} className="delete-btn" label="✕" confirmText="Eintrag löschen?" /></span></td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6}><div className="empty"><div className="empty-icon">💰</div><h4>Noch keine Einnahmen</h4><p>Erfasse Mietzahlungen, Kautionen oder sonstige Erträge.</p><Link href="/einnahmen/new" className="btn btn-gold">＋ Einnahme erfassen</Link></div></td></tr>
              )}
            </ExpandableRows>
          </table>
        </div>
      </div>
    </div>
  );
}
