import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datum, zahl } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import KrediteListe from "@/components/KrediteListe";
import { decryptKreditRow } from "@/lib/kreditData";
import type { Kredit, Property } from "@/lib/types";
import { Plus, Siren, Landmark } from "lucide-react";
import Leer from "@/components/Leer";
import { euro } from "@/lib/format";
import { beleihungsauslauf } from "@/lib/beleihungsauslauf";
import { holeIndexReihe } from "@/lib/wert/hpi";
import { fortschreibeKaufpreis } from "@/lib/wert/fortschreibung";

type KreditExt = Kredit;

export default async function KreditePage() {
  const supabase = await createClient();
  const [{ data: kred }, { data: props }] = await Promise.all([
    supabase.from("kredite").select("*"),
    supabase.from("properties").select("id,bezeichnung,wert,kaufpreis,kaufdatum"),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung" | "wert" | "kaufpreis" | "kaufdatum">[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const list = ((kred ?? []) as KreditExt[]).map(decryptKreditRow);

  const warnungen = list
    .map((k) => ({ k, w: getRefinanzWarning(k.zinsbindung) }))
    .filter((x): x is { k: KreditExt; w: NonNullable<ReturnType<typeof getRefinanzWarning>> } => !!x.w)
    .sort((a, b) => new Date(a.k.zinsbindung ?? 0).getTime() - new Date(b.k.zinsbindung ?? 0).getTime());

  // Beleihungsauslauf je Objekt (Ausbau-Paket 02.10.2026): Restschuld ÷ geschätztem Wert.
  const hpi = list.length ? await holeIndexReihe() : null;
  const auslauf = beleihungsauslauf(
    properties.map((p) => ({
      id: p.id, bezeichnung: p.bezeichnung, wert: p.wert, kaufpreis: p.kaufpreis,
      indexwert: hpi ? fortschreibeKaufpreis(p.kaufpreis, p.kaufdatum ?? null, hpi.reihe)?.wert ?? null : null,
    })),
    list,
  );
  const STUFE = {
    niedrig: { label: "niedrig", cls: "badge-green" },
    mittel: { label: "mittel", cls: "badge-amber" },
    hoch: { label: "hoch", cls: "badge-red" },
    unbekannt: { label: "Wert fehlt", cls: "badge-neutral" },
  } as const;
  const QUELLE = { gepflegt: "dein Wert", index: "Kaufpreis × Häuserpreisindex", kaufpreis: "Kaufpreis" } as const;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Finanzierung · Darlehen</div>
          <div className="topbar-title">Kredite &amp; Finanzierung</div>
          <div className="topbar-sub">Darlehen, Zinsbindung, Tilgungsplan</div>
        </div>
        <Link href="/kredite/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Darlehen</Link>
      </div>
      <hr className="topbar-rule" />

      {warnungen.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Refinanzierungs-Kalender</h3><div className="section-sub">Zinsbindungen bald ablaufend</div></div>
          <div className="section-body">
            {warnungen.map(({ k, w }) => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: w.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{k.bezeichnung || "Darlehen"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{(k.prop_id && nameOf.get(k.prop_id)) || "–"} · {k.bank || ""} · {zahl(k.zinssatz ?? 0, 1)} %</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: w.color }}>{w.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>bis: {datum(k.zinsbindung)}</div>
                </div>
                <span className={`badge ${w.level === "warnung" ? "badge-amber" : "badge-red"}`}>{w.level === "abgelaufen" ? <><Siren size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Abgelaufen</> : w.level === "kritisch" ? <><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--red)", marginRight: 5, verticalAlign: "-1px" }} />Dringend</> : <><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", marginRight: 5, verticalAlign: "-1px" }} />Bald</>}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {auslauf.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div><h3>Beleihungsauslauf je Objekt</h3><div className="section-sub">Restschuld im Verhältnis zum geschätzten Objektwert</div></div>
          </div>
          <div className="section-body">
            <div className="table-scroll"><table style={{ fontSize: 12, minWidth: 560 }}>
              <thead><tr><th>Objekt</th><th style={{ textAlign: "right" }}>Restschuld</th><th style={{ textAlign: "right" }}>Wert (Schätzung)</th><th style={{ textAlign: "right" }}>Auslauf</th><th style={{ textAlign: "right" }}>Freie Grundschuld</th></tr></thead>
              <tbody>
                {auslauf.map((z) => (
                  <tr key={z.propId}>
                    <td><Link href={`/properties/${z.propId}`}>{z.name}</Link>{z.kredite > 1 && <span style={{ color: "var(--faint)" }}> · {z.kredite} Darlehen</span>}</td>
                    <td style={{ textAlign: "right" }}>{euro(z.restschuld)}</td>
                    <td style={{ textAlign: "right" }} title={z.wertQuelle ? QUELLE[z.wertQuelle] : undefined}>
                      {z.wert != null ? euro(z.wert) : "–"}
                      {z.wertQuelle && z.wertQuelle !== "gepflegt" && <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{QUELLE[z.wertQuelle]}</div>}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {z.auslaufProzent != null && <span style={{ marginRight: 6 }}>{z.auslaufProzent.toLocaleString("de-DE")} %</span>}
                      <span className={`badge ${STUFE[z.stufe].cls}`}>{STUFE[z.stufe].label}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>{z.freieGrundschuld == null ? <span style={{ color: "var(--faint)" }}>nicht eingetragen</span> : euro(z.freieGrundschuld)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p style={{ fontSize: 11, color: "var(--faint)", margin: "8px 0 0" }}>
              Richtwert, keine Bankbewertung: Banken rechnen mit dem Beleihungswert, der meist unter dem Marktwert liegt.
              Bis 60 % gilt oft als gut besichert, über 80 % als hoch. Freie Grundschuld = eingetragene Grundschuld minus Restschuld —
              der Rahmen, den eine Bank bei einer Nachfinanzierung ohne neue Eintragung nutzen könnte.
            </p>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <Leer
          icon={Landmark}
          titel="Noch keine Darlehen"
          text="Trage deine Finanzierungen ein — MyImmo rechnet daraus Restschuld, Zinsbindung und Tilgungsverlauf und erinnert rechtzeitig an das Ende der Zinsbindung."
          aktion={{ href: "/kredite/new", label: "Darlehen anlegen" }}
        />
      ) : (
        <KrediteListe rows={list} properties={properties} />
      )}
    </div>
  );
}
