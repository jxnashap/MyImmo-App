import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import { deleteKredit } from "@/lib/actions/buchungen";
import DeleteButton from "@/components/DeleteButton";
import type { Kredit, Property } from "@/lib/types";
import { Plus, Pencil, X, Siren, Landmark, TriangleAlert } from "lucide-react";

type KreditExt = Kredit & { darlnr?: string | null; grundschuld?: number | null; beleihung?: number | null };

export default async function KreditePage() {
  const supabase = createClient();
  const [{ data: kred }, { data: props }] = await Promise.all([
    supabase.from("kredite").select("*"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = (kred ?? []) as KreditExt[];

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
        list.map((k) => {
          const pct = k.betrag && k.betrag > 0 ? Math.max(0, Math.min(100, Math.round(((k.restschuld ?? 0) / k.betrag) * 100))) : 100;
          const tilgtPct = 100 - pct;
          const moZins = k.restschuld ? (k.restschuld * (k.zinssatz ?? 0) / 100) / 12 : 0;
          const moTilg = (k.monatsrate ?? 0) - moZins;
          const warn = getRefinanzWarning(k.zinsbindung);
          return (
            <div key={k.id} className="section" style={{ marginBottom: 14 }}>
              {warn && (
                <div style={{ background: warn.bg, borderLeft: `3px solid ${warn.color}`, padding: "8px 14px", fontSize: 12, color: warn.color, fontWeight: 500 }}>
                  <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> Zinsbindung läuft ab: <strong>{datum(k.zinsbindung)}</strong>
                </div>
              )}
              <div className="section-header">
                <div>
                  <h3>{k.bezeichnung || k.bank || "Darlehen"}</h3>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{(k.prop_id && nameOf.get(k.prop_id)) || "–"}{k.bank ? ` · ${k.bank}` : ""}{k.darlnr ? ` · Nr. ${k.darlnr}` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {k.zinssatz != null && <span className="badge badge-gold">{k.zinssatz}% Zins</span>}
                  <Link href={`/kredite/${k.id}/edit`} className="delete-btn" title="Bearbeiten" style={{ color: "var(--muted)" }}><Pencil size={14} /></Link>
                  <DeleteButton action={deleteKredit.bind(null, k.id)} className="delete-btn" label={<X size={14} />} confirmText={`„${k.bezeichnung || "Darlehen"}" löschen?`} />
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
                  <div><div className="kredit-field-lbl">Zinsbindung</div><div className="kredit-field-val" style={{ color: warn ? warn.color : "inherit" }}>{k.zinsbindung ? datum(k.zinsbindung) : "–"}</div></div>
                </div>
                {(k.grundschuld || k.beleihung || k.sonder) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    <div><div className="kredit-field-lbl">Grundschuld</div><div className="kredit-field-val">{k.grundschuld ? euro(k.grundschuld) : "–"}</div></div>
                    <div><div className="kredit-field-lbl">Beleihungsauslauf</div><div className="kredit-field-val">{k.beleihung ? `${k.beleihung}%` : "–"}</div></div>
                    <div><div className="kredit-field-lbl">Darlehensnr.</div><div className="kredit-field-val" style={{ fontSize: 11 }}>{k.darlnr || "–"}</div></div>
                    <div><div className="kredit-field-lbl">Sondertilgung</div>
                      <div className="kredit-field-val">{k.sonder || "–"}</div></div>
                  </div>
                )}
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
