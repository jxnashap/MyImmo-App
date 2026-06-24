import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { eur } from "@/lib/format";
import CashflowChart from "@/components/CashflowChart";
import BrandMark from "@/components/BrandMark";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center px-4 py-10"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <div
          className="w-full max-w-[400px] rounded-2xl border p-8 text-center sm:p-10"
          style={{
            background: "var(--bg2)",
            borderColor: "var(--line2)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 18px 50px -20px rgba(0,0,0,0.28)",
          }}
        >
          <BrandMark size="lg" />
          <Link
            href="/login"
            className="mt-9 block w-full rounded-lg py-2.5 text-[15px] font-semibold transition hover:brightness-95"
            style={{ background: "var(--gold)", color: "#1a1a17" }}
          >
            Einloggen
          </Link>
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

  const totalValue = properties.reduce((s, p) => s + (p.wert ?? p.kaufpreis ?? 0), 0);
  const sollMiete = properties.reduce((s, p) => s + (p.miete ?? 0), 0);
  const rateMo = kredite.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  const restSumme = kredite.reduce((s, k) => s + (k.restschuld ?? 0), 0);

  const now = new Date();
  const year = now.getFullYear();
  const inYear = (d: string | null) => !!d && d.startsWith(String(year));
  const kostenYear = kosten.filter((k) => inYear(k.buchungsdatum)).reduce((s, k) => s + (k.betrag ?? 0), 0);
  const kostenMo = kostenYear / 12;
  const kostenGesamtMo = kostenMo + rateMo;
  const cashflowMo = sollMiete - kostenGesamtMo;

  // Rollierende letzte 12 Monate, kumulierter Cashflow
  const monthSum = (rows: { buchungsdatum: string | null; betrag: number | null }[], y: number, m: number) =>
    rows
      .filter((r) => r.buchungsdatum && new Date(r.buchungsdatum).getFullYear() === y && new Date(r.buchungsdatum).getMonth() === m)
      .reduce((s, r) => s + (r.betrag ?? 0), 0);

  let kum = 0;
  const chart = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    const flow = monthSum(einnahmen, d.getFullYear(), d.getMonth()) - monthSum(kosten, d.getFullYear(), d.getMonth()) - rateMo;
    kum += flow;
    return { label: MONATE[d.getMonth()], value: kum };
  });

  const kpis = [
    { label: "Portfolio-Wert", value: eur(totalValue), valueCls: "gold", badge: `${properties.length} Objekte`, badgeCls: "pill-teal" },
    { label: "Einnahmen / Mo.", value: eur(sollMiete), sub: "Kaltmiete gesamt" },
    { label: "Kosten / Mo.", value: eur(kostenGesamtMo), sub: "Kredit + laufend" },
    {
      label: "Cashflow / Mo.",
      value: (cashflowMo >= 0 ? "+ " : "") + eur(cashflowMo),
      valueColor: cashflowMo >= 0 ? "var(--green)" : "var(--red)",
      badge: cashflowMo >= 0 ? "Positiver Cashflow" : "Negativer Cashflow",
      badgeCls: cashflowMo >= 0 ? "pill-green" : "pill-red",
    },
  ];

  // Einnahmen vs. Ausgaben (Monatswerte)
  const balken = [
    { label: "Einnahmen", value: sollMiete, color: "var(--green)" },
    { label: "Kredit", value: rateMo, color: "var(--gold)" },
    { label: "Laufende Kosten", value: kostenMo, color: "var(--red)" },
  ];
  const balkenMax = Math.max(1, ...balken.map((b) => b.value));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Dashboard</h1>
          <p className="mt-1 text-white/40">Portfolio-Übersicht</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/termine" className="btn-outline">📅 Terminkalender</Link>
          <Link href="/properties/new" className="btn-gold">+ Immobilie</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.valueCls ?? ""}`} style={k.valueColor ? { color: k.valueColor } : undefined}>
              {k.value}
            </div>
            {k.badge ? (
              <div className="mt-2"><span className={`pill ${k.badgeCls}`}>{k.badge}</span></div>
            ) : (
              <div className="mt-2 text-xs text-white/40">{k.sub}</div>
            )}
          </div>
        ))}
      </div>

      <CashflowChart data={chart} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Einnahmen vs. Ausgaben */}
        <div className="card">
          <div className="mb-4 section-title">⚖️ Einnahmen vs. Ausgaben</div>
          <div className="space-y-4">
            {balken.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-white/60">{b.label}</span>
                  <span>{eur(b.value)}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${(b.value / balkenMax) * 100}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3 text-sm">
            <span className="text-white/40">Cashflow / Mo.</span>{" "}
            <span style={{ color: cashflowMo >= 0 ? "var(--green)" : "var(--red)" }}>
              {cashflowMo >= 0 ? "+ " : ""}{eur(cashflowMo)}
            </span>
          </div>
        </div>

        {/* Aktuelle Kredite */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="section-title">🏦 Aktuelle Kredite</div>
            <span className="text-sm text-white/40">{eur(restSumme)} Restschuld</span>
          </div>
          {kredite.length === 0 ? (
            <p className="text-white/40">Keine Kredite erfasst.</p>
          ) : (
            <div className="space-y-2">
              {kredite.slice(0, 5).map((k) => (
                <div key={k.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{k.bezeichnung || k.bank || "Darlehen"}</div>
                    <div className="text-xs text-white/40">{k.bank ?? ""}{k.zinssatz != null ? ` · ${k.zinssatz}% Zins` : ""}</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-sm">{eur(k.restschuld)}</div>
                    <div className="text-xs text-white/40">{eur(k.monatsrate)}/Mo.</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-white/40">
        Cashflow = Einnahmen − laufende Kosten − Kreditraten ({eur(rateMo)}/Mo.). Laufende Werte aus {year}.
      </p>
    </div>
  );
}
