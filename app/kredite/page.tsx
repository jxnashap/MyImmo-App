import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { deleteKredit } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import type { Kredit, Property } from "@/lib/types";

export default async function KreditePage() {
  const supabase = createClient();
  const [{ data: kred }, { data: props }] = await Promise.all([
    supabase.from("kredite").select("*"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = (kred ?? []) as Kredit[];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Kredite &amp; Finanzierung</div>
          <div className="topbar-sub">Darlehen, Zinsbindung, Tilgungsplan</div>
        </div>
        <Link href="/kredite/new" className="btn btn-gold">＋ Darlehen</Link>
      </div>

      {list.length === 0 ? (
        <div className="empty"><div className="empty-icon">🏦</div><h4>Noch keine Darlehen</h4></div>
      ) : (
        list.map((k) => {
          const pct = k.betrag ? Math.round(((k.restschuld ?? 0) / k.betrag) * 100) : 0;
          const tilgtPct = 100 - pct;
          const moZins = k.restschuld ? (k.restschuld * (k.zinssatz ?? 0) / 100) / 12 : 0;
          const moTilg = (k.monatsrate ?? 0) - moZins;
          return (
            <div key={k.id} className="section" style={{ marginBottom: 14 }}>
              <div className="section-header">
                <div>
                  <h3>{k.bezeichnung || k.bank || "Darlehen"}</h3>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{(k.prop_id && nameOf.get(k.prop_id)) || "–"}{k.bank ? ` · ${k.bank}` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {k.zinssatz != null && <span className="badge badge-gold">{k.zinssatz}% Zins</span>}
                  <DeleteButton action={deleteKredit.bind(null, k.id)} className="delete-btn" label="✕" confirmText={`„${k.bezeichnung || "Darlehen"}" löschen?`} />
                </div>
              </div>
              <div className="section-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
                  <div><div className="kredit-field-lbl">Urspr. Darlehen</div><div className="kredit-field-val">{euro(k.betrag)}</div></div>
                  <div><div className="kredit-field-lbl">Restschuld</div><div className="kredit-field-val" style={{ color: "var(--red)" }}>{euro(k.restschuld)}</div></div>
                  <div><div className="kredit-field-lbl">Rate / Monat</div><div className="kredit-field-val">{euro(k.monatsrate)}</div></div>
                  <div><div className="kredit-field-lbl">Laufzeit bis</div><div className="kredit-field-val">{k.laufzeit ?? "–"}</div></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <div><div className="kredit-field-lbl">Zinsen / Mo.</div><div className="kredit-field-val" style={{ color: "var(--muted)" }}>{euro(moZins)}</div></div>
                  <div><div className="kredit-field-lbl">Tilgung / Mo.</div><div className="kredit-field-val" style={{ color: "var(--green)" }}>{euro(Math.max(0, moTilg))}</div></div>
                  <div><div className="kredit-field-lbl">Tilgungssatz</div><div className="kredit-field-val">{k.tilgungssatz ? `${k.tilgungssatz}% p.a.` : "–"}</div></div>
                  <div><div className="kredit-field-lbl">Zinsbindung</div><div className="kredit-field-val">{k.zinsbindung ? datum(k.zinsbindung) : "–"}</div></div>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>Getilgt: <strong style={{ color: "var(--text)" }}>{tilgtPct}%</strong></div>
                <div className="progress-bar" style={{ height: 8 }}><div className="progress-fill" style={{ width: `${tilgtPct}%`, background: "var(--teal)" }} /></div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
