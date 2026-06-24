import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tenant, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DokumentePage() {
  const supabase = createClient();
  const [{ data: miet }, { data: props }] = await Promise.all([
    supabase.from("mieter").select("id,vorname,nachname,prop_id,einheit").order("nachname"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname" | "prop_id" | "einheit">[];
  const propName = new Map(((props ?? []) as Pick<Property, "id" | "bezeichnung">[]).map((p): [string, string] => [p.id, p.bezeichnung]));

  const DOK_ARTEN = [
    { icon: "✉️", titel: "Brief / Schreiben", sub: "Mieterhöhung, Mahnung, Kündigung, Zahlungserinnerung u. a. — bearbeitbare Druckansicht.", pfad: "dokument" },
    { icon: "📑", titel: "NK-Abrechnung", sub: "Nebenkostenabrechnung als Vorschau und fertiges PDF.", pfad: "nk" },
    { icon: "🔑", titel: "Übergabeprotokoll", sub: "Wohnungsübergabe mit Zählerständen und Raumzustand.", pfad: "protokoll" },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">📄 Dokumente</div>
          <div className="topbar-sub">Schreiben, Abrechnungen & Protokolle — pro Mieter erstellen</div>
        </div>
        <Link href="/einstellungen" className="btn btn-ghost" style={{ fontSize: 12 }}>⚙️ Absender & IBANs</Link>
      </div>

      {/* Was es gibt */}
      <div className="grid-3 mb-20">
        {DOK_ARTEN.map((d) => (
          <div key={d.pfad} className="card">
            <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontSize: 26, lineHeight: 1 }}>{d.icon}</div>
              <div>
                <div className="card-title" style={{ marginBottom: 4 }}>{d.titel}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{d.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mieter auswählen */}
      <div className="section">
        <div className="section-header"><h3>Mieter wählen</h3><span style={{ fontSize: 12, color: "var(--muted)" }}>{tenants.length} Mieter</span></div>
        <div className="section-body">
          {tenants.length === 0 ? (
            <div className="empty"><div className="empty-icon">📄</div><p>Noch keine Mieter — Dokumente werden pro Mieter erstellt.</p><Link href="/tenants/new" className="btn btn-gold" style={{ marginTop: 10 }}>＋ Mieter anlegen</Link></div>
          ) : (
            tenants.map((t) => {
              const name = [t.vorname, t.nachname].filter(Boolean).join(" ") || "Mieter";
              const wo = [(t.prop_id && propName.get(t.prop_id)) || null, t.einheit].filter(Boolean).join(" · ");
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{name}</div>
                    {wo && <div style={{ fontSize: 12, color: "var(--muted)" }}>{wo}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Link href={`/tenants/${t.id}/dokument`} className="btn btn-ghost" style={{ fontSize: 12 }}>✉️ Brief</Link>
                    <Link href={`/tenants/${t.id}/nk`} className="btn btn-ghost" style={{ fontSize: 12 }}>📑 NK-Abrechnung</Link>
                    <Link href={`/tenants/${t.id}/protokoll`} className="btn btn-ghost" style={{ fontSize: 12 }}>🔑 Protokoll</Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
