import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum, istUmlagefaehig } from "@/lib/format";
import { deleteKosten, deleteRechnung } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import ExpandableRows from "@/components/ExpandableRows";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import type { Kosten, Property, Tenant } from "@/lib/types";

const KATEGORIEN = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

export default async function KostenPage({
  searchParams,
}: {
  searchParams: { prop?: string; mieter?: string; umlage?: string; jahr?: string; kat?: string };
}) {
  const supabase = createClient();
  const [{ data: kost }, { data: props }, { data: miet }] = await Promise.all([
    supabase.from("kosten").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];
  const propName = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const mietName = new Map(tenants.map((t): [string, string] => [t.id, `${t.vorname ?? ""} ${t.nachname ?? ""}`.trim()]));

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
    { name: "kat", label: "Kategorie", icon: "tag", options: [{ value: "", label: "Alle Kosten" }, ...KATEGORIEN.map((k) => ({ value: k, label: k }))] },
    { name: "mieter", label: "Mieter", icon: "user", options: [{ value: "", label: "Alle Mieter" }, ...tenants.map((t) => ({ value: t.id, label: `${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—" }))] },
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
          <table className="list-table">
            <thead><tr><th>Datum</th><th>Immobilie</th><th>Mieter</th><th>Kategorie</th><th>Umlage</th><th>Beleg</th><th>Betrag</th><th></th></tr></thead>
            <ExpandableRows cols={8} limit={10} label="weitere Buchungen">
              {list.map((k) => {
                const u = istUmlagefaehig(k.kategorie);
                return (
                  <tr key={k.id}>
                    <td>{datum(k.buchungsdatum)}</td>
                    <td style={{ color: "var(--muted)" }}>{k.prop_id ? propName.get(k.prop_id) ?? "–" : "–"}</td>
                    <td style={{ color: "var(--muted)" }}>{k.mieter_id ? mietName.get(k.mieter_id) ?? "–" : "–"}</td>
                    <td>{k.kategorie ? <span className="badge badge-red">{k.kategorie}</span> : "–"}</td>
                    <td><span className={`badge ${u === "ja" ? "badge-green" : u === "nein" ? "badge-red" : "badge-teal"}`}>{u === "ja" ? "umlagefähig" : u === "nein" ? "nicht" : "prüfen"}</span></td>
                    <td>
                      {k.rechnung_name ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <a href={`/kosten/${k.id}/rechnung`} target="_blank" rel="noopener noreferrer" title={`${k.rechnung_name}${k.rechnung_size ? " · " + k.rechnung_size : ""}`} style={{ color: "var(--gold)" }}>
                            {k.rechnung_type === "application/pdf" ? "📄" : k.rechnung_type?.startsWith("image/") ? "🖼️" : "📎"} ansehen
                          </a>
                          <DeleteButton action={deleteRechnung.bind(null, k.id)} className="delete-btn" label="✕" confirmText="Beleg entfernen?" />
                        </span>
                      ) : (
                        <span style={{ color: "var(--faint)", fontSize: 12 }}>–</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--red)" }}>{euro(k.betrag)}</td>
                    <td style={{ textAlign: "right" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><Link href={`/kosten/${k.id}/edit`} className="delete-btn" title="Bearbeiten" style={{ color: "var(--muted)" }}>✎</Link><DeleteButton action={deleteKosten.bind(null, k.id)} className="delete-btn" label="✕" confirmText="Eintrag löschen?" /></span></td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon">📋</div><h4>Noch keine Ausgaben</h4><p>Erfasse Betriebskosten, Reparaturen oder Verwaltungskosten.</p><Link href="/kosten/new" className="btn btn-gold">＋ Ausgabe erfassen</Link></div></td></tr>
              )}
            </ExpandableRows>
          </table>
        </div>
      </div>
    </div>
  );
}
