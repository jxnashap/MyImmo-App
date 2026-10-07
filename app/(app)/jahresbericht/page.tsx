import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { jahresZeile } from "@/lib/jahresberichtZeile";

export default async function JahresberichtPage(
  props0: {
    searchParams: Promise<{ year?: string }>;
  }
) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const year = Number(searchParams.year) || new Date().getFullYear();

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("einnahmen").select("*"),
    supabase.from("kosten").select(KOSTEN_SPALTEN),
    supabase.from("kredite").select("*"),
  ]);

  const properties = (props ?? []) as Property[];
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];


  const heute = new Date();
  const aktuellesJahr = heute.getFullYear();
  // Raten: vergangene Jahre = 12 Monate, laufendes Jahr = verstrichene Monate, Zukunft = 12 (Projektion)
  const monate = year < aktuellesJahr ? 12 : year > aktuellesJahr ? 12 : heute.getMonth() + 1;

  // Rechnung gemeinsam mit dem PDF (lib/jahresberichtZeile.ts) — vorher
  // rechnete das PDF anders und zog gebuchte Zinsen doppelt ab.
  const rows = properties.map((p) => ({
    id: p.id,
    name: p.bezeichnung,
    ...jahresZeile(p.id, year, monate, { einnahmen, kosten, kredite, kaufdatum: p.kaufdatum }),
  }));

  const sum = rows.reduce(
    (a, r) => ({
      e: a.e + r.e, k: a.k + r.k, zins: a.zins + r.zins, tilgung: a.tilgung + r.tilgung, cashflow: a.cashflow + r.cashflow,
    }),
    { e: 0, k: 0, zins: 0, tilgung: 0, cashflow: 0 },
  );

  // Jahr-Filter dynamisch: vom aktuellen Jahr zurück bis zum ältesten Datenjahr
  // (Kaufdatum/Buchung), mindestens aber 5 Jahre — damit auch alte Berichte
  // (z. B. für eine Steuernachfrage) erreichbar sind.
  const datenJahre = [
    ...properties.map((p) => p.kaufdatum),
    ...einnahmen.map((x) => x.buchungsdatum),
    ...kosten.map((x) => x.buchungsdatum),
  ]
    .map((d) => (d ? Number(String(d).slice(0, 4)) : NaN))
    .filter((y) => y >= 1990 && y <= aktuellesJahr);
  const vonJahr = Math.min(datenJahre.length ? Math.min(...datenJahre) : aktuellesJahr, aktuellesJahr - 4);
  const years: number[] = [];
  for (let y = aktuellesJahr; y >= vonJahr; y--) years.push(y);
  const filters: FilterDef[] = [
    { name: "year", label: "Jahr", icon: "jahr", defaultValue: String(aktuellesJahr), options: years.map((y) => ({ value: String(y), label: String(y) })) },
  ];

  const border = "2px solid var(--line2)";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Auswertung · Jahresbericht</div>
          <div className="topbar-title">Jahresbericht &amp; Steuer-Export</div>
          <div className="topbar-sub">Cashflow-Auswertung · Druckansicht</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/steuer" className="btn btn-ghost" style={{ fontSize: 12 }}>Steuerliche Auswertung (Anlage V) →</Link>
          <a href={`/api/berichte/jahresbericht?jahr=${year}`} target="_blank" rel="noopener" className="btn btn-gold" style={{ fontSize: 12 }}>
            PDF-Bericht
          </a>
        </div>
      </div>
      <hr className="topbar-rule" />

      <FilterBar filters={filters} />

      <div className="section">
        <div className="section-header">
          <h3>Auswertung {year}</h3>
          {year === aktuellesJahr && (
            <div className="section-sub">
              Stand Jan–{heute.toLocaleDateString("de-DE", { month: "short" })} {year} · unterjährig, Zins/Tilgung anteilig
            </div>
          )}
        </div>
        <div className="section-body">
          <div className="table-scroll"><table className="list-table report">
            <thead>
              <tr>
                <th>Immobilie</th>
                <th style={{ textAlign: "right" }}>Einnahmen</th>
                <th style={{ textAlign: "right" }} title="Laufende Kosten aus deinen Kosten-Buchungen (Bewirtschaftung)">Laufende Kosten</th>
                <th style={{ textAlign: "right" }} title="Gebuchte Schuldzinsen des Jahres; ohne Buchung geschätzt aus Restschuld × Zinssatz (mit ~ markiert)">Zins</th>
                <th style={{ textAlign: "right" }}>Tilgung</th>
                <th style={{ textAlign: "right" }} title="Einnahmen − laufende Kosten − Kreditraten (Zins + Tilgung) des Jahres, aus deinen Buchungen">Cashflow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}><Link href={`/properties/${r.id}`} style={{ color: "inherit", textDecoration: "none" }}>{r.name}</Link></td>
                  <td style={{ textAlign: "right", color: "var(--green)" }}>{euro(r.e)}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }}>{euro(r.k)}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }} title={r.zinsGeschaetzt ? "Geschätzt aus der heutigen Restschuld — für die Steuer die Zinsbescheinigung verwenden." : "Summe der gebuchten Schuldzinsen."}>{r.zinsGeschaetzt ? "~ " : ""}{euro(r.zins)}</td>
                  <td style={{ textAlign: "right", color: "var(--muted)" }} title="Tilgung baut Vermögen auf – kein Aufwand">{euro(r.tilgung)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: r.cashflow >= 0 ? "var(--green)" : "var(--red)" }}>{euro(r.cashflow)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td style={{ borderTop: border }}>Summe</td>
                <td style={{ textAlign: "right", color: "var(--green)", borderTop: border }}>{euro(sum.e)}</td>
                <td style={{ textAlign: "right", color: "var(--red)", borderTop: border }}>{euro(sum.k)}</td>
                <td style={{ textAlign: "right", color: "var(--red)", borderTop: border }}>{euro(sum.zins)}</td>
                <td style={{ textAlign: "right", color: "var(--muted)", borderTop: border }} title="Tilgung baut Vermögen auf – kein Aufwand">{euro(sum.tilgung)}</td>
                <td style={{ textAlign: "right", color: sum.cashflow >= 0 ? "var(--green)" : "var(--red)", borderTop: border }}>{euro(sum.cashflow)}</td>
              </tr>
            </tfoot>
          </table></div>
        </div>
      </div>

      {rows.some((r) => r.kreditOhneStart) && (
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          Mindestens ein Darlehen hat weder Auszahlungs- noch Kaufdatum — seine Raten sind für das ganze Jahr angenommen.
          Trag das Auszahlungsdatum unter <Link href="/kredite">Kredite</Link> nach, dann zählen nur die Monate, in denen es lief.
        </p>
      )}
      <p style={{ fontSize: 11, color: "var(--muted)" }}>„PDF-Bericht“ erzeugt den Jahresbericht als Dokument im MyImmo-Briefkopf — zum Ablegen, Versenden oder für den Steuerberater.</p>
    </div>
  );
}
