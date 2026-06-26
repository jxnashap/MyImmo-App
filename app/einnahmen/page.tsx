import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { deleteEinnahme } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import ExpandableRows from "@/components/ExpandableRows";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import type { Einnahme, Property, Tenant } from "@/lib/types";

export default async function EinnahmenPage({
  searchParams,
}: {
  searchParams: { prop?: string; kategorie?: string; jahr?: string; mieter?: string };
}) {
  const supabase = createClient();
  const [{ data: einn }, { data: props }, { data: miet }] = await Promise.all([
    supabase.from("einnahmen").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));

  const KATEGORIEN = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"];
  let list = (einn ?? []) as Einnahme[];
  if (searchParams.prop) list = list.filter((e) => e.prop_id === searchParams.prop);
  if (searchParams.mieter) list = list.filter((e) => e.mieter_id === searchParams.mieter);
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

  const filters: FilterDef[] = [
    { name: "prop", label: "Immobilie", icon: "home", options: [{ value: "", label: "Alle Immobilien" }, ...properties.map((p) => ({ value: p.id, label: p.bezeichnung }))] },
    { name: "mieter", label: "Mieter", icon: "user", options: [{ value: "", label: "Alle Mieter" }, ...tenants.map((t) => ({ value: t.id, label: `${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—" }))] },
    { name: "kategorie", label: "Kategorie", icon: "tag", options: [{ value: "", label: "Alle Kategorien" }, ...KATEGORIEN.map((k) => ({ value: k, label: k }))] },
    { name: "jahr", label: "Jahr", icon: "jahr", defaultValue: String(aktuellesJahr), options: [...jahre.map((y) => ({ value: String(y), label: String(y) })), { value: "alle", label: "Alle Jahre" }] },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Einnahmen</div>
          <div className="topbar-sub">Miete und sonstige Erträge</div>
        </div>
        <Link href="/einnahmen/new" className="btn btn-gold">＋ Einnahme</Link>
      </div>

      <FilterBar filters={filters} />

      <div className="section">
        <div className="section-header">
          <h3>Alle Einnahmen</h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{list.length} Buchungen · <span style={{ color: "var(--green)" }}>{euro(total)}</span></span>
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
