// Ein- & Ausgaben: Einnahmen und Kosten in einem Reiter — KPIs, kumulierter
// Cashflow-Verlauf, Einnahmen-vs-Ausgaben-Balken, Kategorie-Split und die
// bestehenden Buchungslisten (Zeilen-Edit/Beleg/Löschen unverändert).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import BetragChart from "@/components/BetragChart";
import ZeitraumControl from "@/components/ZeitraumControl";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import EinnahmenListe from "@/components/lists/EinnahmenListe";
import KostenListe from "@/components/lists/KostenListe";
import CashflowListe from "@/components/lists/CashflowListe";
import AufklappSection from "@/components/AufklappSection";
import WiederkehrManager from "@/components/WiederkehrManager";
import type { RawPoint } from "@/lib/zeitraum";
import type { Einnahme, Kosten, Property, Tenant, WiederkehrVorlage } from "@/lib/types";

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: { typ?: string; prop?: string; jahr?: string };
}) {
  const supabase = createClient();
  const [{ data: einn }, { data: kost }, { data: props }, { data: miet }, { data: vRows }] = await Promise.all([
    supabase.from("einnahmen").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("kosten").select("*").order("buchungsdatum", { ascending: false }),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname,prop_id").order("nachname"),
    supabase.from("wiederkehrende_buchungen").select("*").order("created_at", { ascending: false }),
  ]);

  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];

  // ---- Wiederkehrende Buchungen (ausklappbarer Bereich) ----
  const wkVorlagen = (vRows ?? []) as WiederkehrVorlage[];
  const wkGebucht = new Map<string, string[]>();
  for (const r of [...((einn ?? []) as Einnahme[]), ...((kost ?? []) as Kosten[])]) {
    const id = (r as { wiederkehr_id?: string | null }).wiederkehr_id;
    if (!id || !r.buchungsdatum) continue;
    if (!wkGebucht.has(id)) wkGebucht.set(id, []);
    wkGebucht.get(id)!.push(r.buchungsdatum);
  }
  const wkMitStatus = wkVorlagen.map((v) => ({ ...v, gebuchteDaten: wkGebucht.get(v.id) ?? [] }));
  const wkProps = properties.map((p) => ({ id: p.id, bezeichnung: p.bezeichnung ?? "Objekt" }));
  const wkPropNamen: Record<string, string> = Object.fromEntries(wkProps.map((p) => [p.id, p.bezeichnung]));
  const wkMieter = ((miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname" | "prop_id">[]).map((m) => ({
    id: m.id,
    name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
    prop_id: m.prop_id,
  }));
  const wkMieterNamen: Record<string, string> = Object.fromEntries(wkMieter.map((m) => [m.id, m.name]));

  // ---- Filter (prop + jahr wirken auf alles; typ steuert nur die Listen) ----
  const aktuellesJahr = new Date().getFullYear();
  const jahr = searchParams.jahr ?? String(aktuellesJahr);
  const prop = searchParams.prop ?? "";
  const typ = searchParams.typ === "einnahme" || searchParams.typ === "ausgabe" ? searchParams.typ : "";

  const imJahr = (d: string | null) => jahr === "alle" || (d != null && new Date(d).getFullYear() === Number(jahr));
  const einnahmen = ((einn ?? []) as Einnahme[]).filter((e) => (!prop || e.prop_id === prop) && imJahr(e.buchungsdatum));
  const kosten = ((kost ?? []) as Kosten[]).filter((k) => (!prop || k.prop_id === prop) && imJahr(k.buchungsdatum));

  const jahre = Array.from(
    new Set([
      ...((einn ?? []) as Einnahme[]).map((e) => (e.buchungsdatum ? new Date(e.buchungsdatum).getFullYear() : null)),
      ...((kost ?? []) as Kosten[]).map((k) => (k.buchungsdatum ? new Date(k.buchungsdatum).getFullYear() : null)),
      aktuellesJahr,
    ].filter((y): y is number => y != null))
  ).sort((a, b) => b - a);

  // ---- Summen ----
  const einnahmenTotal = einnahmen.reduce((s, e) => s + (e.betrag ?? 0), 0);
  const ausgabenTotal = kosten.reduce((s, k) => s + (k.betrag ?? 0), 0);
  const netto = einnahmenTotal - ausgabenTotal;

  // ---- Cashflow-Verlauf (wie Dashboard „Portfolio-Entwicklung") ----
  const cashflowPoints: RawPoint[] = [
    ...einnahmen.filter((e) => e.buchungsdatum).map((e) => ({ date: e.buchungsdatum as string, value: e.betrag ?? 0 })),
    ...kosten.filter((k) => k.buchungsdatum).map((k) => ({ date: k.buchungsdatum as string, value: -(k.betrag ?? 0) })),
  ];

  // ---- Einnahmen vs. Ausgaben (proportionale Balken) ----
  const balkenMax = Math.max(einnahmenTotal, ausgabenTotal, 1);
  const balken = [
    { lbl: "Einnahmen", val: einnahmenTotal, col: "var(--green)" },
    { lbl: "Ausgaben", val: ausgabenTotal, col: "var(--red)" },
  ];

  // ---- Kategorie-Split ----
  const katSumme = (rows: { kategorie: string | null; betrag: number | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.kategorie || "Sonstiges", (m.get(r.kategorie || "Sonstiges") ?? 0) + (r.betrag ?? 0));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const einKat = katSumme(einnahmen);
  const ausKat = katSumme(kosten);

  const katBlock = (titel: string, kat: [string, number][], farbe: string) => {
    const max = Math.max(1, ...kat.map(([, v]) => v));
    return (
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3>{titel}</h3></div>
        <div className="section-body">
          {kat.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Keine Buchungen im Zeitraum.</p>
          ) : (
            kat.map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", width: 110, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={lbl}>{lbl}</div>
                <div style={{ flex: 1, height: 20, background: "var(--bg4)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${((val / max) * 100).toFixed(0)}%`, height: "100%", background: farbe, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: farbe, width: 80, textAlign: "right" }}>{euro(val)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const filters: FilterDef[] = [
    { name: "typ", label: "Typ", icon: "quelle", variant: "segmented", options: [{ value: "", label: "Alle" }, { value: "einnahme", label: "Einnahmen" }, { value: "ausgabe", label: "Ausgaben" }] },
    { name: "prop", label: "Immobilie", icon: "home", options: [{ value: "", label: "Alle Immobilien" }, ...properties.map((p) => ({ value: p.id, label: p.bezeichnung }))] },
    { name: "jahr", label: "Jahr", icon: "jahr", defaultValue: String(aktuellesJahr), options: [...jahre.map((y) => ({ value: String(y), label: String(y) })), { value: "alle", label: "Alle Jahre" }] },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Ein- &amp; Ausgaben</div>
          <div className="topbar-sub">Einnahmen und Kosten im Vergleich</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/api/export/buchungen" className="btn btn-ghost" style={{ fontSize: 12 }}>CSV-Export</a>
          <Link href="/cashflow/neu" className="btn btn-gold">＋ Buchung</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-3 mb-20" style={{ gap: 14 }}>
        <div className="kpi-card">
          <div className="kpi-label">Einnahmen</div>
          <div className="kpi-value" style={{ color: "var(--green)" }}>{euro(einnahmenTotal)}</div>
          <div className="kpi-sub">{einnahmen.length} Buchungen</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ausgaben</div>
          <div className="kpi-value" style={{ color: "var(--red)" }}>{euro(ausgabenTotal)}</div>
          <div className="kpi-sub">{kosten.length} Buchungen</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Netto-Cashflow</div>
          <div className="kpi-value" style={{ color: netto >= 0 ? "var(--green)" : "var(--red)" }}>
            {netto >= 0 ? "+ " : "− "}{euro(Math.abs(netto))}
          </div>
          <div className="kpi-sub">
            <span className={`badge ${netto >= 0 ? "badge-green" : "badge-red"}`}>{netto >= 0 ? "Positiv" : "Negativ"}</span>
          </div>
        </div>
      </div>

      {/* Cashflow-Verlauf */}
      <div className="section mb-20">
        <div className="section-header">
          <h3>Cashflow-Verlauf</h3>
          <ZeitraumControl />
        </div>
        <div className="section-body">
          <BetragChart points={cashflowPoints} mode="area" cumulative color="var(--gold)" caption="Kumulierter Cashflow (Einnahmen − Ausgaben)" />
        </div>
      </div>

      {/* Einnahmen vs. Ausgaben */}
      <div className="section mb-20">
        <div className="section-header"><h3>Einnahmen vs. Ausgaben</h3></div>
        <div className="section-body">
          {balken.map((b) => (
            <div key={b.lbl} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", width: 80, textAlign: "right" }}>{b.lbl}</div>
              <div style={{ flex: 1, height: 20, background: "var(--bg4)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${((b.val / balkenMax) * 100).toFixed(0)}%`, height: "100%", background: b.col, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: b.col, width: 80, textAlign: "right" }}>{euro(b.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Kategorie-Split */}
      <div className="grid-2 mb-20">
        {katBlock("Einnahmen nach Kategorie", einKat, "var(--green)")}
        {katBlock("Ausgaben nach Kategorie", ausKat, "var(--red)")}
      </div>

      {/* Wiederkehrende Buchungen — ausklappbar, nicht als eigener Reiter */}
      <AufklappSection
        titel="🔁 Wiederkehrende Buchungen"
        untertitel={
          wkVorlagen.length > 0
            ? `${wkVorlagen.length} Vorlage${wkVorlagen.length === 1 ? "" : "n"} · Miete, Grundsteuer, Müll … automatisch im Zyklus erzeugen`
            : "Miete, Grundsteuer, Müll … einmal anlegen, im Zyklus erzeugen (rückwirkend bis 10 Jahre)"
        }
      >
        <WiederkehrManager
          vorlagen={wkMitStatus}
          propNamen={wkPropNamen}
          mieterNamen={wkMieterNamen}
          properties={wkProps}
          mieter={wkMieter}
        />
      </AufklappSection>

      <FilterBar filters={filters} />

      {/* Buchungsansicht: "Alle" = chronologische Merge-Tabelle; die
          Einzel-Filter behalten die bestehenden Listen (inkl. Umlage-Spalte). */}
      {typ === "" && (
        <div className="section">
          <div className="section-header">
            <h3>Alle Buchungen</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{einnahmen.length + kosten.length} Buchungen · Netto <span style={{ color: netto >= 0 ? "var(--green)" : "var(--red)" }}>{euro(netto)}</span></span>
          </div>
          <div className="section-body">
            <CashflowListe einnahmen={einnahmen} kosten={kosten} properties={properties} tenants={tenants} />
          </div>
        </div>
      )}
      {typ === "einnahme" && (
        <div className="section">
          <div className="section-header">
            <h3>💰 Einnahmen</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{einnahmen.length} Buchungen · <span style={{ color: "var(--green)" }}>{euro(einnahmenTotal)}</span></span>
          </div>
          <div className="section-body">
            <EinnahmenListe rows={einnahmen} properties={properties} tenants={tenants} />
          </div>
        </div>
      )}
      {typ === "ausgabe" && (
        <div className="section">
          <div className="section-header">
            <h3>📋 Ausgaben</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{kosten.length} Buchungen · <span style={{ color: "var(--red)" }}>{euro(ausgabenTotal)}</span></span>
          </div>
          <div className="section-body">
            <KostenListe rows={kosten} properties={properties} tenants={tenants} />
          </div>
        </div>
      )}
    </div>
  );
}
