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

  const year = new Date().getFullYear();
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

  const inYear = (d: string | null) => !!d && d.startsWith(String(year));
  const kostenYear = kosten.filter((k) => inYear(k.buchungsdatum)).reduce((s, k) => s + (k.betrag ?? 0), 0);
  const kostenMo = kostenYear / 12;
  const cashflowMo = sollMiete - kostenMo - rateMo;

  // Monatlicher Cashflow für den Graphen
  const monthSum = (rows: { buchungsdatum: string | null; betrag: number | null }[], m: number) =>
    rows
      .filter((r) => r.buchungsdatum && new Date(r.buchungsdatum).getFullYear() === year && new Date(r.buchungsdatum).getMonth() === m)
      .reduce((s, r) => s + (r.betrag ?? 0), 0);

  const chart = MONATE.map((label, m) => ({
    label,
    value: monthSum(einnahmen, m) - monthSum(kosten, m) - rateMo,
  }));

  const kpis: { label: string; value: string; cls?: string; color?: string }[] = [
    { label: "Portfolio-Wert", value: eur(totalValue), cls: "gold" },
    { label: "Einnahmen / Mo.", value: eur(sollMiete) },
    { label: "Kosten / Mo.", value: eur(kostenMo) },
    { label: "Cashflow / Mo.", value: eur(cashflowMo), color: cashflowMo >= 0 ? "var(--green)" : "var(--red)" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl">Dashboard</h1>
        <Link href="/termine" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
          ◷ Terminkalender
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.cls ?? ""}`} style={k.color ? { color: k.color } : undefined}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <CashflowChart data={chart} />

      <p className="mt-3 text-xs text-white/40">
        Cashflow = Einnahmen − Kosten − Kreditraten ({eur(rateMo)}/Mo.). Werte aus {year}.
      </p>
    </div>
  );
}
