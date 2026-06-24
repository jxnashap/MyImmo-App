import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteNotiz } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import type { Notiz, Property } from "@/lib/types";

const KAT_COLORS: Record<string, string> = {
  Allgemein: "badge-teal", Mietvertrag: "badge-gold", Versicherung: "badge-green",
  Handwerker: "badge-red", Steuer: "badge-teal", Aufgabe: "badge-red",
};

export default async function NotizenPage() {
  const supabase = createClient();
  const [{ data: not }, { data: props }] = await Promise.all([
    supabase.from("notizen").select("*").order("created_at", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = (not ?? []) as Notiz[];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Dokumente &amp; Notizen</div>
          <div className="topbar-sub">Wichtige Infos und Merkzettel</div>
        </div>
        <Link href="/notizen/new" className="btn btn-gold">＋ Notiz</Link>
      </div>

      {list.length === 0 ? (
        <div className="prop-grid">
          <div className="empty" style={{ gridColumn: "1/-1" }}><div className="empty-icon">📁</div><h4>Noch keine Notizen</h4></div>
        </div>
      ) : (
        <div className="prop-grid">
          {list.map((n) => (
            <div key={n.id} className="prop-card">
              <div className="prop-card-header" style={{ gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prop-card-name">{n.titel || "Ohne Titel"}</div>
                  <div className="prop-card-addr">{(n.prop_id && nameOf.get(n.prop_id)) || "Allgemein"}</div>
                  {n.kategorie && (
                    <div style={{ marginTop: 5 }}>
                      <span className={`badge ${KAT_COLORS[n.kategorie] || "badge-teal"}`}>{n.kategorie}</span>
                    </div>
                  )}
                </div>
                <DeleteButton action={deleteNotiz.bind(null, n.id)} className="delete-btn" label="✕" confirmText={`„${n.titel || "Notiz"}" löschen?`} />
              </div>
              {n.inhalt && (
                <div style={{ padding: "10px 14px 14px", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {n.inhalt}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
