import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import VerbrauchListe from "@/components/lists/VerbrauchListe";
import type { Verbrauch, Property } from "@/lib/types";

export default async function VerbrauchPage({ searchParams }: { searchParams: { prop?: string; art?: string; jahr?: string } }) {
  const supabase = createClient();
  const [{ data: verb }, { data: props }] = await Promise.all([
    supabase.from("verbrauch").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  let list = (verb ?? []) as Verbrauch[];
  if (searchParams.prop) list = list.filter((v) => v.prop_id === searchParams.prop);
  if (searchParams.art) list = list.filter((v) => (v.art ?? "") === searchParams.art);
  const arten = Array.from(new Set(((verb ?? []) as Verbrauch[]).map((v) => v.art).filter(Boolean))) as string[];

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
        <Link href="/verbrauch/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Verbrauch</Link>
      </div>

      <FilterBar filters={filters} />

      <div className="section">
        <div className="section-header">
          <h3>Alle Einträge</h3>
        </div>
        <div className="section-body">
          <VerbrauchListe rows={tabelle} properties={properties} />
        </div>
      </div>
    </div>
  );
}
