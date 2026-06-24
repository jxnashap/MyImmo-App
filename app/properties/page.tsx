import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import { deleteProperty } from "@/lib/actions/properties";
import DeleteButton from "@/components/DeleteButton";
import type { Property, Kredit } from "@/lib/types";

// Emoji je Objekttyp — exakt wie in der HTML-Vorlage (propIcons).
const PROP_ICONS: Record<string, string> = {
  Eigentumswohnung: "🏢",
  Einfamilienhaus: "🏠",
  Mehrfamilienhaus: "🏘",
  Gewerbeimmobilie: "🏪",
  Ferienimmobilie: "🏖",
  Grundstück: "🌿",
};

function statusBadge(status: string | null) {
  if (status === "Vermietet") return "badge-green";
  if (status === "Leer") return "badge-red";
  return "badge-teal";
}

export default async function PropertiesPage() {
  const supabase = createClient();
  const [{ data }, { data: kred }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("kredite").select("prop_id,restschuld"),
  ]);

  const list = (data ?? []) as Property[];
  const kredite = (kred ?? []) as Pick<Kredit, "prop_id" | "restschuld">[];

  const restMap = new Map<string, number>();
  for (const k of kredite) {
    if (!k.prop_id) continue;
    restMap.set(k.prop_id, (restMap.get(k.prop_id) ?? 0) + (k.restschuld ?? 0));
  }

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Immobilien</div>
          <div className="topbar-sub">Alle erfassten Objekte</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/properties/new" className="btn btn-ghost">🔗 Importieren</Link>
          <Link href="/properties/new" className="btn btn-gold">＋ Neu</Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="prop-grid">
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <div className="empty-icon">🏠</div>
            <h4>Noch keine Immobilien</h4>
          </div>
        </div>
      ) : (
        <div className="prop-grid">
          {list.map((p) => {
            const wert = p.wert ?? p.kaufpreis ?? 0;
            const rendite = p.miete && wert ? ((p.miete * 12) / wert) * 100 : null;
            const rest = restMap.get(p.id) ?? 0;
            return (
              <div key={p.id} className="prop-card">
                <div className="prop-card-header">
                  <div className="prop-icon">{(p.typ && PROP_ICONS[p.typ]) || "🏠"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/properties/${p.id}`} className="prop-card-name" style={{ color: "var(--text)", textDecoration: "none", display: "block" }}>
                      {p.bezeichnung}
                    </Link>
                    <div className="prop-card-addr">{p.adresse || p.typ || "—"}</div>
                    {p.obj_status && (
                      <div style={{ marginTop: 5 }}>
                        <span className={`badge ${statusBadge(p.obj_status)}`}>{p.obj_status}</span>
                      </div>
                    )}
                  </div>
                  <DeleteButton
                    action={deleteProperty.bind(null, p.id)}
                    confirmText={`„${p.bezeichnung}" wirklich löschen?`}
                    className="delete-btn"
                    label="✕"
                    title="Löschen"
                  />
                </div>
                <div className="prop-card-stats">
                  <div className="prop-stat">
                    <div className="prop-stat-val">{euro(wert)}</div>
                    <div className="prop-stat-lbl">Wert</div>
                  </div>
                  <div className="prop-stat">
                    <div className="prop-stat-val">{p.miete ? euro(p.miete) : "–"}</div>
                    <div className="prop-stat-lbl">Miete/Mo</div>
                  </div>
                  <div className="prop-stat">
                    <div className="prop-stat-val" style={{ color: "var(--teal)" }}>{rendite != null ? `${rendite.toFixed(2)}%` : "–"}</div>
                    <div className="prop-stat-lbl">Rendite</div>
                  </div>
                </div>
                {rest > 0 && (
                  <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)" }}>
                    🏦 Restschuld: <strong style={{ color: "var(--text)" }}>{euro(rest)}</strong>
                  </div>
                )}
                <Link
                  href={`/properties/${p.id}`}
                  style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                >
                  <span style={{ color: "var(--gold)" }}>→</span> Details anzeigen
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
