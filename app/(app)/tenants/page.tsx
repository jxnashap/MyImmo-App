import Link from "next/link";
import { Plus, User, Pencil, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import type { Tenant, Property } from "@/lib/types";

export default async function TenantsPage(props0: { searchParams: Promise<{ q?: string; prop?: string }> }) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const [{ data: tenants }, { data: props }] = await Promise.all([
    supabase.from("mieter").select("*").order("nachname"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const alle = (tenants ?? []) as Tenant[];
  const propList = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(propList.map((p): [string, string] => [p.id, p.bezeichnung]));

  // Suche über Name/Einheit/Kontakt + Objekt-Filter (URL-gesteuert wie überall).
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const prop = searchParams.prop ?? "";
  const list = alle.filter((m) => {
    if (prop && m.prop_id !== prop) return false;
    if (!q) return true;
    return [m.vorname, m.nachname, m.einheit, m.email, m.telefon]
      .some((t) => (t ?? "").toLowerCase().includes(q));
  });

  const filters: FilterDef[] = [
    { name: "q", label: "Suche", variant: "search", placeholder: "Name, Einheit, E-Mail…", options: [] },
    { name: "prop", label: "Immobilie", icon: "home", options: [{ value: "", label: "Alle Immobilien" }, ...propList.map((p) => ({ value: p.id, label: p.bezeichnung }))] },
  ];

  // Ausgezogene Mieter zaehlten in den KPIs voll mit: Wer seit Jahren
  // ausgezogen ist, erhoehte „Kaltmiete / Mo." weiter, und seine laengst
  // abgerechnete Kaution stand dauerhaft unter „Kaution offen". Die Kennzahlen
  // beziehen sich jetzt auf LAUFENDE Mietverhaeltnisse; die Liste darunter
  // zeigt weiterhin alle.
  const heuteISO = new Date().toISOString().slice(0, 10);
  const laeuft = (m: Tenant) =>
    (m.mietende ?? "") === "" || (m.mietende as string) >= heuteISO;
  const aktive = list.filter(laeuft);
  const ehemalige = list.length - aktive.length;

  const gesamtMiete = aktive.reduce((s, m) => s + (m.kaltmiete ?? 0), 0);
  const gesamtKaution = aktive.reduce((s, m) => s + (m.kaution ?? 0), 0);
  const offeneKaution = aktive.filter((m) => m.kaution_status !== "ja").length;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Verwaltung · Vermietung</div>
          <div className="topbar-title">Mieter</div>
          <div className="topbar-sub">Mietverträge, Fristen, Einheiten &amp; Dokumente</div>
        </div>
        <Link href="/tenants/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Mieter</Link>
      </div>
      <hr className="topbar-rule" />

      <div className="staffel grid-4 mb-20">
        <div className="kpi-card" title={ehemalige > 0 ? `${ehemalige} bereits ausgezogen` : undefined}>
          <div className="kpi-label">Aktive Mietverhältnisse</div>
          <div className="kpi-value">{aktive.length}{ehemalige > 0 && <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}> / {list.length}</span>}</div>
        </div>
        <div className="kpi-card" title="Nur laufende Mietverhältnisse"><div className="kpi-label">Kaltmiete / Mo.</div><div className="kpi-value" style={{ color: "var(--green)" }}>{euro(gesamtMiete)}</div></div>
        <div className="kpi-card" title="Nur laufende Mietverhältnisse"><div className="kpi-label">Kautionen</div><div className="kpi-value">{euro(gesamtKaution)}</div></div>
        <div className="kpi-card" title="Nur laufende Mietverhältnisse"><div className="kpi-label">Kaution offen</div><div className="kpi-value" style={{ color: offeneKaution > 0 ? "var(--amber)" : "var(--green)" }}>{offeneKaution}</div></div>
      </div>

      <FilterBar filters={filters} />

      {list.length === 0 ? (
        <div className="staffel prop-grid">
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <User className="empty-icon" size={36} color="var(--faint)" />
            {alle.length > 0 ? (
              <>
                <h4>Keine Treffer</h4>
                <p>Kein Mieter passt zur aktuellen Suche/Filterung.</p>
              </>
            ) : (
              <>
                <h4>Noch keine Mieter</h4>
                <p>Füge deinen ersten Mieter hinzu.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="staffel prop-grid">
          {list.map((m) => (
            <div key={m.id} className="prop-card">
              {/* Ganze Kachel klickbar (wie bei den Immobilien) — die Knöpfe
                  unten liegen darüber und bleiben eigenständig bedienbar. */}
              <Link href={`/tenants/${m.id}`} className="prop-card-link" aria-label={`${[m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter"} öffnen`} />
              <div className="prop-card-header" style={{ gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prop-card-name" style={{ color: "var(--text)" }}>
                    {[m.vorname, m.nachname].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div className="prop-card-addr">{(m.prop_id && nameOf.get(m.prop_id)) || "–"}{m.einheit ? ` · ${m.einheit}` : ""}</div>
                  <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span className="badge badge-green">{euro(m.kaltmiete)} / Mo</span>
                    {m.kaution_status === "ja"
                      ? <span className="badge badge-teal">Kaution ✓</span>
                      : <span className="badge badge-red">Kaution offen</span>}
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                <div><span style={{ color: "var(--muted)" }}>Beginn:</span> {m.mietbeginn ? datum(m.mietbeginn) : "–"}</div>
                <div><span style={{ color: "var(--muted)" }}>Ende:</span> {m.mietende ? datum(m.mietende) : "unbefristet"}</div>
                {m.telefon && <div><span style={{ color: "var(--muted)" }}>Tel:</span> {m.telefon}</div>}
                {m.email && <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ color: "var(--muted)" }}>Mail:</span> {m.email}</div>}
              </div>
              <div className="prop-card-above" style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", display: "flex", gap: 6 }}>
                <Link href={`/tenants/${m.id}/edit`} className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: 5, justifyContent: "center", gap: 5 }} title="Mieter bearbeiten" aria-label="Mieter bearbeiten"><Pencil size={14} /> Bearbeiten</Link>
                <Link href={`/tenants/${m.id}/nk`} className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: 5, justifyContent: "center", gap: 5 }} title="Nebenkostenabrechnung erstellen" aria-label="Nebenkostenabrechnung erstellen"><ReceiptText size={14} /> NK</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
