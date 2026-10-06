import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { datum, zahl } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import KrediteListe from "@/components/KrediteListe";
import { decryptKreditRow } from "@/lib/kreditData";
import type { Kredit, Property } from "@/lib/types";
import { Plus, Siren, Landmark } from "lucide-react";
import Leer from "@/components/Leer";
import SchuldenUhr from "@/components/SchuldenUhr";
import { schuldenStand } from "@/lib/schuldenStand";
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
  // Kennzahlen über alle Darlehen. Ø-Zins nach Restschuld gewichtet (ein kleines teures
  // Darlehen soll den Schnitt nicht so stark ziehen wie ein großes).
  const summeRate = list.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  const gewichtet = list.filter((k) => k.zinssatz != null && (k.restschuld ?? 0) > 0);
  const basis = gewichtet.reduce((s, k) => s + (k.restschuld ?? 0), 0);
  const zinsSchnitt = basis > 0 ? gewichtet.reduce((s, k) => s + (k.zinssatz ?? 0) * (k.restschuld ?? 0), 0) / basis : null;

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

      {/* Schulden-Uhr (04.10.2026): eine Zeile über den Krediten statt vier Kacheln. */}
      {list.length > 0 && (
        <div className="mb-20">
          {/* Geschützte Leerzeichen innerhalb der Teile: Am Handy darf nur am „·“ umbrochen werden, nie „Ø Zins“ / „3,09 %“. */}
          <SchuldenUhr
            stand={schuldenStand(list)}
            zusatz={[`Raten ${euro(summeRate)} / Mo.`, zinsSchnitt != null ? `Ø Zins ${zahl(zinsSchnitt, 2)} %` : null]
              .filter((t): t is string => t != null)
              .map((t) => t.replace(/ /g, "\u00a0"))
              .join(" · ")}
          />
        </div>
      )}

      {warnungen.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Refinanzierungs-Kalender</h3><div className="section-sub">Zinsbindungen bald ablaufend</div></div>
          <div className="section-body">
            <div className="listen">
              {warnungen.map(({ k, w }) => (
                <div key={k.id} className="listen-zeile">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: w.color, flexShrink: 0 }} />
                  <span className="listen-zeile-text">
                    <span className="listen-zeile-titel">{k.bezeichnung || "Darlehen"}</span>
                    <span className="listen-zeile-sub">{(k.prop_id && nameOf.get(k.prop_id)) || "–"}{k.bank ? ` · ${k.bank}` : ""} · {zahl(k.zinssatz ?? 0, 1)} %</span>
                  </span>
                  <span className="listen-zeile-zahl"><b style={{ color: w.color }}>{datum(k.zinsbindung)}</b><small>{w.label}</small></span>
                  <span className={`badge ${w.level === "warnung" ? "badge-amber" : "badge-red"}`}>{w.level === "abgelaufen" ? <><Siren size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Abgelaufen</> : w.level === "kritisch" ? "Dringend" : "Bald"}</span>
                </div>
              ))}
            </div>
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

      {auslauf.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div><h3>Beleihungsauslauf je Objekt</h3><div className="section-sub">Restschuld im Verhältnis zum geschätzten Objektwert</div></div>
          </div>
          <div className="section-body">
            <div className="table-scroll"><table style={{ fontSize: 12, minWidth: 560 }}>
              {/* „Auslauf“ steht direkt hinter dem Objekt: Am Handy ist die Tabelle breiter als der
                Schirm, und die Kennzahl, um die es geht, soll ohne Wischen zu sehen sein. */}
              <thead><tr><th>Objekt</th><th style={{ textAlign: "right" }}>Auslauf</th><th style={{ textAlign: "right" }}>Restschuld</th><th style={{ textAlign: "right" }}>Wert (Schätzung)</th><th style={{ textAlign: "right" }}>Freie Grundschuld</th></tr></thead>
              <tbody>
                {auslauf.map((z) => (
                  <tr key={z.propId}>
                    <td><Link href={`/properties/${z.propId}`}>{z.name}</Link>{z.kredite > 1 && <span style={{ color: "var(--faint)" }}> · {z.kredite} Darlehen</span>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {z.auslaufProzent != null && <span style={{ marginRight: 6 }}>{z.auslaufProzent.toLocaleString("de-DE")}&nbsp;%</span>}
                      <span className={`badge ${STUFE[z.stufe].cls}`}>{STUFE[z.stufe].label}</span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{euro(z.restschuld)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} title={z.wertQuelle ? QUELLE[z.wertQuelle] : undefined}>
                      {z.wert != null ? euro(z.wert) : "–"}
                      {z.wertQuelle && z.wertQuelle !== "gepflegt" && <div style={{ fontSize: "var(--text-xs)", color: "var(--faint)", whiteSpace: "normal" }}>{QUELLE[z.wertQuelle]}</div>}
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

    </div>
  );
}
