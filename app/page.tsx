import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import { CalendarDays } from "lucide-react";
import BetragChart from "@/components/BetragChart";
import ZeitraumControl from "@/components/ZeitraumControl";
import type { RawPoint } from "@/lib/zeitraum";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 28, color: "var(--gold)" }}>My<span style={{ fontStyle: "italic", fontWeight: 300 }}>Immo</span></div>
          <Link href="/login" className="btn btn-gold" style={{ marginTop: 20 }}>Einloggen</Link>
        </div>
      </div>
    );
  }

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }] = await Promise.all([
    supabase.from("properties").select("*"),
    supabase.from("einnahmen").select("*"),
    supabase.from("kosten").select("*"),
    supabase.from("kredite").select("*"),
  ]);

  const properties = (props ?? []) as Property[];
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));

  const refinanz = kredite.map((k) => ({ k, w: getRefinanzWarning(k.zinsbindung) })).filter((x) => x.w);

  const now = new Date();
  const mo = now.getMonth();
  const yr = now.getFullYear();

  const totalWert = properties.reduce((s, p) => s + (p.wert ?? 0), 0);
  const totalMiete = properties.reduce((s, p) => s + (p.miete ?? 0), 0);
  const kreditRates = kredite.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  const monatKosten = kosten
    .filter((k) => { const d = k.buchungsdatum ? new Date(k.buchungsdatum) : null; return d && d.getMonth() === mo && d.getFullYear() === yr; })
    .reduce((s, k) => s + (k.betrag ?? 0), 0);
  const totalKosten = kreditRates + monatKosten;
  const cashflow = totalMiete - totalKosten;
  const bruttoRendite = totalWert > 0 ? ((totalMiete * 12) / totalWert) * 100 : 0;
  // Leerstandsquote: nur vermietbare Objekte (Status "Vermietet"/"Leer");
  // Benchmark: 2–5 % gesund, >10 % kritisch.
  const vermietbar = properties.filter((p) => p.obj_status === "Vermietet" || p.obj_status === "Leer");
  const leerCount = properties.filter((p) => p.obj_status === "Leer").length;
  const leerstand = vermietbar.length > 0 ? (leerCount / vermietbar.length) * 100 : 0;
  const leerFarbe = leerstand <= 5 ? "var(--green)" : leerstand <= 10 ? "var(--amber)" : "var(--red)";

  // Portfolio-Entwicklung: kumulierter Cashflow (Einnahmen − Ausgaben),
  // Zeitraum wird clientseitig per Segmented-Control gefiltert.
  const portfolioPoints: RawPoint[] = [
    ...einnahmen.filter((e) => e.buchungsdatum).map((e) => ({ date: e.buchungsdatum as string, value: e.betrag ?? 0 })),
    ...kosten.filter((k) => k.buchungsdatum).map((k) => ({ date: k.buchungsdatum as string, value: -(k.betrag ?? 0) })),
  ];

  // Einnahmen vs. Ausgaben
  const balkenMax = Math.max(totalMiete, totalKosten, 1);
  const balken = [
    { lbl: "Einnahmen", val: totalMiete, col: "var(--green)" },
    { lbl: "Kredite", val: kreditRates, col: "var(--gold)" },
    { lbl: "Kosten", val: monatKosten, col: "var(--red)" },
  ];

  // Letzte Transaktionen
  const trans = [
    ...einnahmen.map((e) => ({ ...e, _typ: "einnahme" as const })),
    ...kosten.map((k) => ({ ...k, _typ: "kosten" as const })),
  ]
    .sort((a, b) => new Date(b.buchungsdatum ?? 0).getTime() - new Date(a.buchungsdatum ?? 0).getTime())
    .slice(0, 6);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-sub">Portfolio-Übersicht</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Link href="/termine" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CalendarDays size={15} /> Terminkalender</Link>
          <Link href="/properties/new" className="btn btn-gold">＋ Immobilie</Link>
        </div>
      </div>

      {refinanz.length > 0 && (
        <div style={{ marginBottom: 16, background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: "var(--red)", fontSize: 13 }}>{refinanz.length} Zinsbindung{refinanz.length > 1 ? "en" : ""} läuft bald ab</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{refinanz.map(({ k }) => `${k.bezeichnung || "Darlehen"} (${datum(k.zinsbindung)})`).join(" · ")}</div>
          </div>
          <Link href="/kredite" className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 11 }}>Ansehen</Link>
        </div>
      )}

      <div className="grid-5 mb-20">
        <div className="kpi-card">
          <div className="kpi-label">Portfolio-Wert</div>
          <div className="kpi-value">{euro(totalWert)}</div>
          <div className="kpi-sub"><span className="badge badge-teal">{properties.length} Objekt{properties.length === 1 ? "" : "e"}</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Einnahmen / Mo.</div>
          <div className="kpi-value">{euro(totalMiete)}</div>
          <div className="kpi-sub">{bruttoRendite > 0 ? <span className="badge badge-gold">{bruttoRendite.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Brutto-Rendite</span> : "Kaltmiete gesamt"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Kosten / Mo.</div>
          <div className="kpi-value">{euro(totalKosten)}</div>
          <div className="kpi-sub">Kredit + laufend</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cashflow / Mo.</div>
          <div className="kpi-value" style={{ color: cashflow >= 0 ? "var(--green)" : "var(--red)" }}>{cashflow >= 0 ? "+ " : "− "}{euro(Math.abs(cashflow))}</div>
          <div className="kpi-sub"><span className={`badge ${cashflow >= 0 ? "badge-green" : "badge-red"}`}>{cashflow >= 0 ? "Positiver Cashflow" : "Negativer Cashflow"}</span></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Leerstandsquote</div>
          <div className="kpi-value" style={{ color: vermietbar.length ? leerFarbe : "var(--muted)" }}>
            {vermietbar.length ? leerstand.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " %" : "–"}
          </div>
          <div className="kpi-sub"><span className="badge badge-teal">{leerCount} von {vermietbar.length} leer</span></div>
        </div>
      </div>

      <div className="section mb-20">
        <div className="section-header">
          <h3>Portfolio-Entwicklung</h3>
          <ZeitraumControl />
        </div>
        <div className="section-body">
          <BetragChart points={portfolioPoints} mode="area" cumulative color="var(--gold)" caption="Kumulierter Cashflow (Einnahmen − Ausgaben)" />
        </div>
      </div>

      <div className="grid-2 mb-20">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Einnahmen vs. Ausgaben</h3></div>
          <div className="section-body">
            {properties.length === 0 ? (
              <div className="empty"><div className="empty-icon">📊</div><p>Noch keine Daten</p></div>
            ) : (
              balken.map((b) => (
                <div key={b.lbl} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", width: 80, textAlign: "right" }}>{b.lbl}</div>
                  <div style={{ flex: 1, height: 20, background: "var(--bg4)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${((b.val / balkenMax) * 100).toFixed(0)}%`, height: "100%", background: b.col, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: b.col, width: 70, textAlign: "right" }}>{euro(b.val)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-header"><h3>Aktuelle Kredite</h3></div>
          <div className="section-body">
            {kredite.length === 0 ? (
              <div className="empty"><div className="empty-icon">🏦</div><p>Noch keine Kredite</p></div>
            ) : (
              kredite.slice(0, 3).map((k) => {
                const pct = k.betrag && k.betrag > 0 ? Math.max(0, Math.min(100, Math.round(((k.restschuld ?? 0) / k.betrag) * 100))) : 100;
                return (
                  <div key={k.id} style={{ borderLeft: "3px solid var(--gold)", padding: "10px 14px", background: "var(--gold-pale)", borderRadius: "0 8px 8px 0", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <strong style={{ fontSize: 13 }}>{k.bezeichnung || k.bank || "Darlehen"}</strong>
                      {k.zinssatz != null && <span className="badge badge-gold">{k.zinssatz}%</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                      <span>Restschuld: <strong style={{ color: "var(--text)" }}>{euro(k.restschuld)}</strong></span>
                      <span>Rate: <strong style={{ color: "var(--text)" }}>{euro(k.monatsrate)}/Mo</strong></span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${100 - pct}%`, background: "var(--teal)" }} /></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3>Letzte Transaktionen</h3></div>
        <div className="section-body">
          {trans.length === 0 ? (
            <div className="empty"><div className="empty-icon">💸</div><p>Noch keine Transaktionen</p></div>
          ) : (
            <table>
              <thead><tr><th>Datum</th><th>Immobilie</th><th>Art</th><th>Beschreibung</th><th>Betrag</th></tr></thead>
              <tbody>
                {trans.map((t) => {
                  const isEin = t._typ === "einnahme";
                  return (
                    <tr key={`${t._typ}-${t.id}`}>
                      <td>{datum(t.buchungsdatum)}</td>
                      <td>{t.prop_id ? nameOf.get(t.prop_id) ?? "–" : "–"}</td>
                      <td><span className={`badge ${isEin ? "badge-green" : "badge-red"}`}>{isEin ? "Einnahme" : "Ausgabe"}</span></td>
                      <td style={{ color: "var(--muted)" }}>{t.beschreibung || t.kategorie || ""}</td>
                      <td style={{ fontWeight: 600, color: isEin ? "var(--green)" : "var(--red)" }}>{isEin ? "+ " : "− "}{euro(t.betrag)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
