import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import KrediteListe from "@/components/KrediteListe";
import { decryptKreditRow } from "@/lib/kreditData";
import type { Kredit, Property } from "@/lib/types";
import { Plus, Siren, Landmark } from "lucide-react";

type KreditExt = Kredit;

export default async function KreditePage() {
  const supabase = createClient();
  const [{ data: kred }, { data: props }] = await Promise.all([
    supabase.from("kredite").select("*"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = ((kred ?? []) as KreditExt[]).map(decryptKreditRow);

  const warnungen = list
    .map((k) => ({ k, w: getRefinanzWarning(k.zinsbindung) }))
    .filter((x): x is { k: KreditExt; w: NonNullable<ReturnType<typeof getRefinanzWarning>> } => !!x.w)
    .sort((a, b) => new Date(a.k.zinsbindung ?? 0).getTime() - new Date(b.k.zinsbindung ?? 0).getTime());

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Kredite &amp; Finanzierung</div>
          <div className="topbar-sub">Darlehen, Zinsbindung, Tilgungsplan</div>
        </div>
        <Link href="/kredite/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Darlehen</Link>
      </div>

      {warnungen.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Refinanzierungs-Kalender</h3><span style={{ fontSize: 11, color: "var(--muted)" }}>Zinsbindungen bald ablaufend</span></div>
          <div className="section-body">
            {warnungen.map(({ k, w }) => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: w.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{k.bezeichnung || "Darlehen"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{(k.prop_id && nameOf.get(k.prop_id)) || "–"} · {k.bank || ""} · {k.zinssatz ?? 0}%</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: w.color }}>{w.label}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>bis: {datum(k.zinsbindung)}</div>
                </div>
                <span className={`badge ${w.level === "warnung" ? "badge-amber" : "badge-red"}`}>{w.level === "abgelaufen" ? <><Siren size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Abgelaufen</> : w.level === "kritisch" ? <><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--red)", marginRight: 5, verticalAlign: "-1px" }} />Dringend</> : <><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", marginRight: 5, verticalAlign: "-1px" }} />Bald</>}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty"><Landmark className="empty-icon" size={36} color="var(--faint)" /><h4>Noch keine Darlehen</h4></div>
      ) : (
        <KrediteListe rows={list} properties={properties} />
      )}
    </div>
  );
}
