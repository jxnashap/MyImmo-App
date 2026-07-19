import Link from "next/link";
import { Plus, User, Pencil, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import type { Tenant, Property } from "@/lib/types";

export default async function TenantsPage() {
  const supabase = createClient();
  const [{ data: tenants }, { data: props }] = await Promise.all([
    supabase.from("mieter").select("*").order("nachname"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const list = (tenants ?? []) as Tenant[];
  const propList = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(propList.map((p): [string, string] => [p.id, p.bezeichnung]));

  const gesamtMiete = list.reduce((s, m) => s + (m.kaltmiete ?? 0), 0);
  const gesamtKaution = list.reduce((s, m) => s + (m.kaution ?? 0), 0);
  const offeneKaution = list.filter((m) => m.kaution_status !== "ja").length;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Mieter</div>
          <div className="topbar-sub">Mietverträge, Fristen, Einheiten &amp; Dokumente</div>
        </div>
        <Link href="/tenants/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Mieter</Link>
      </div>

      <div className="grid-4 mb-20">
        <div className="kpi-card"><div className="kpi-label">Mieter gesamt</div><div className="kpi-value">{list.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Kaltmiete / Mo.</div><div className="kpi-value" style={{ color: "var(--green)" }}>{euro(gesamtMiete)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Kautionen</div><div className="kpi-value">{euro(gesamtKaution)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Kaution offen</div><div className="kpi-value" style={{ color: offeneKaution > 0 ? "var(--amber)" : "var(--green)" }}>{offeneKaution}</div></div>
      </div>

      {list.length === 0 ? (
        <div className="prop-grid">
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <User className="empty-icon" size={36} color="var(--faint)" />
            <h4>Noch keine Mieter</h4>
            <p>Füge deinen ersten Mieter hinzu.</p>
          </div>
        </div>
      ) : (
        <div className="prop-grid">
          {list.map((m) => (
            <div key={m.id} className="prop-card">
              <div className="prop-card-header" style={{ gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/tenants/${m.id}`} className="prop-card-name" style={{ color: "var(--text)", textDecoration: "none", display: "block" }}>
                    {[m.vorname, m.nachname].filter(Boolean).join(" ") || "—"}
                  </Link>
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
              <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", display: "flex", gap: 6 }}>
                <Link href={`/tenants/${m.id}`} className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: 5, justifyContent: "center" }}>Details</Link>
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
