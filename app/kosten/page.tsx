import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, istUmlagefaehig } from "@/lib/format";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import KostenListe from "@/components/lists/KostenListe";
import { generiereBuchungen } from "@/lib/actions/wiederkehr";
import type { Kosten, Property, Tenant } from "@/lib/types";

const KATEGORIEN = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

export default async function KostenPage({
  searchParams,
}: {
  searchParams: { prop?: string; mieter?: string; umlage?: string; jahr?: string; kat?: string };
}) {
  const supabase = createClient();
  await generiereBuchungen();
  const [{ data: kost }, { data: props }, { data: miet }] = await Promise.all([
    supabase.from("kosten").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];

  let list = (kost ?? []) as Kosten[];
  if (searchParams.prop) list = list.filter((k) => k.prop_id === searchParams.prop);
  if (searchParams.mieter) list = list.filter((k) => k.mieter_id === searchParams.mieter);
  if (searchParams.kat) list = list.filter((k) => (k.kategorie ?? "") === searchParams.kat);
  if (searchParams.umlage) list = list.filter((k) => istUmlagefaehig(k.kategorie) === searchParams.umlage);

  const aktuellesJahr = new Date().getFullYear();
  const jahr = searchParams.jahr ?? String(aktuellesJahr);
  const jahre = Array.from(
    new Set([
      ...((kost ?? []) as Kosten[]).map((k) => (k.buchungsdatum ? new Date(k.buchungsdatum).getFullYear() : null)),
      aktuellesJahr,
    ].filter((y): y is number => y != null))
  ).sort((a, b) => b - a);
  if (jahr !== "alle") list = list.filter((k) => k.buchungsdatum && new Date(k.buchungsdatum).getFullYear() === Number(jahr));

  const total = list.reduce((s, k) => s + (k.betrag ?? 0), 0);

  const filters: FilterDef[] = [
    { name: "prop", label: "Immobilie", icon: "home", options: [{ value: "", label: "Alle Immobilien" }, ...properties.map((p) => ({ value: p.id, label: p.bezeichnung }))] },
    { name: "mieter", label: "Mieter", icon: "user", options: [{ value: "", label: "Alle Mieter" }, ...tenants.map((t) => ({ value: t.id, label: `${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—" }))] },
    { name: "kat", label: "Kategorie", icon: "tag", options: [{ value: "", label: "Alle Kosten" }, ...KATEGORIEN.map((k) => ({ value: k, label: k }))] },
    { name: "umlage", label: "Umlagefähig", icon: "umlage", variant: "toggle", options: [{ value: "ja", label: "Umlagefähig" }] },
    { name: "jahr", label: "Jahr", icon: "jahr", defaultValue: String(aktuellesJahr), options: [...jahre.map((y) => ({ value: String(y), label: String(y) })), { value: "alle", label: "Alle Jahre" }] },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Kosten &amp; Ausgaben</div>
          <div className="topbar-sub">Reparaturen, Verwaltung, Versicherungen</div>
        </div>
        <Link href="/kosten/new" className="btn btn-gold">＋ Ausgabe</Link>
      </div>

      <FilterBar filters={filters} />

      <div className="section">
        <div className="section-header">
          <h3>Alle Ausgaben</h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{list.length} Buchungen · <span style={{ color: "var(--red)" }}>{euro(total)}</span></span>
        </div>
        <div className="section-body">
          <KostenListe rows={list} properties={properties} tenants={tenants} />
        </div>
      </div>
    </div>
  );
}
