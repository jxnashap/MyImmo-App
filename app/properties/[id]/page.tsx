import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eur, eur2 } from "@/lib/format";
import type { Property, Tenant } from "@/lib/types";

type Kredit = { id: string; bezeichnung: string | null; bank: string | null; restschuld: number | null; monatsrate: number | null; zinssatz: number | null };
type Buchung = { betrag: number | null; buchungsdatum: string | null; kategorie: string | null };

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = params.id;
  const year = new Date().getFullYear();

  const [{ data: prop }, { data: mieter }, { data: einnahmen }, { data: kosten }, { data: kredite }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).single(),
      supabase.from("mieter").select("*").eq("prop_id", id).order("nachname"),
      supabase.from("einnahmen").select("betrag,buchungsdatum,kategorie").eq("prop_id", id),
      supabase.from("kosten").select("betrag,buchungsdatum,kategorie").eq("prop_id", id),
      supabase.from("kredite").select("id,bezeichnung,bank,restschuld,monatsrate,zinssatz").eq("prop_id", id),
    ]);

  if (!prop) notFound();
  const p = prop as Property;
  const tenants = (mieter ?? []) as Tenant[];
  const kred = (kredite ?? []) as Kredit[];

  const sumYear = (rows: Buchung[] | null) =>
    (rows ?? []).filter((r) => r.buchungsdatum?.startsWith(String(year))).reduce((s, r) => s + (r.betrag ?? 0), 0);

  const einnahmenJahr = sumYear(einnahmen as Buchung[]);
  const kostenJahr = sumYear(kosten as Buchung[]);
  const rateMo = kred.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  const restschuld = kred.reduce((s, k) => s + (k.restschuld ?? 0), 0);
  const sollMiete = p.miete ?? tenants.reduce((s, t) => s + (t.kaltmiete ?? 0), 0);
  const cashflowMo = sollMiete - kostenJahr / 12 - rateMo;

  const wert = p.wert ?? p.kaufpreis ?? 0;
  const preisQm = p.flaeche ? wert / p.flaeche : null;
  const faktor = sollMiete ? wert / (sollMiete * 12) : null;
  const bruttoRendite = wert ? ((sollMiete * 12) / wert) * 100 : null;

  return (
    <div>
      <div className="mb-2">
        <Link href="/properties" className="text-sm text-white/40 hover:text-white/70">← Objekte</Link>
      </div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl">{p.bezeichnung}</h1>
          <p className="mt-1 text-white/50">
            {p.adresse || "Keine Adresse"}
            {p.obj_status && <span className="badge badge-neutral ml-3">{p.obj_status}</span>}
          </p>
        </div>
        <Link href={`/properties/${id}/edit`} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
          Bearbeiten
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="kpi">
          <div className="kpi-label">Wert</div>
          <div className="kpi-value gold">{eur(wert)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Soll-Miete / Mo.</div>
          <div className="kpi-value">{eur(sollMiete)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Kosten / Mo. ({year})</div>
          <div className="kpi-value">{eur(kostenJahr / 12)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cashflow / Mo.</div>
          <div className="kpi-value" style={{ color: cashflowMo >= 0 ? "var(--green)" : "var(--red)" }}>
            {eur(cashflowMo)}
          </div>
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="stat-box"><div className="stat-lbl">Preis / m²</div><div className="stat-val gold">{preisQm ? eur(preisQm) : "—"}</div></div>
        <div className="stat-box"><div className="stat-lbl">Faktor</div><div className="stat-val">{faktor ? faktor.toFixed(1) : "—"}</div></div>
        <div className="stat-box"><div className="stat-lbl">Bruttomietrendite</div><div className="stat-val">{bruttoRendite ? bruttoRendite.toFixed(2) + " %" : "—"}</div></div>
        <div className="stat-box"><div className="stat-lbl">Restschuld</div><div className="stat-val">{eur(restschuld)}</div></div>
      </div>

      {/* Mieter */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Mieter</h2>
          <Link href="/tenants/new" className="text-sm text-gold hover:underline">+ Mieter</Link>
        </div>
        {tenants.length === 0 ? (
          <p className="text-white/40">Keine Mieter zugeordnet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tenants.map((t) => (
              <Link key={t.id} href={`/tenants/${t.id}/edit`} className="card transition hover:border-white/25">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{[t.vorname, t.nachname].filter(Boolean).join(" ")}</span>
                  <span className="text-gold">{eur2(t.kaltmiete)}</span>
                </div>
                <div className="mt-1 text-sm text-white/40">
                  {t.einheit || "Einheit —"}{t.flaeche ? ` · ${t.flaeche} m²` : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Finanzierung */}
      {kred.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl">Finanzierung</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {kred.map((k) => (
              <div key={k.id} className="card">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{k.bezeichnung || k.bank || "Darlehen"}</span>
                  <span className="text-white/60">{k.zinssatz != null ? k.zinssatz + " %" : ""}</span>
                </div>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-white/40">Restschuld</span><span>{eur(k.restschuld)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-white/40">Rate / Mo.</span><span className="gold">{eur2(k.monatsrate)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Jahresübersicht */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="card">
          <div className="kpi-label">Einnahmen {year}</div>
          <div className="mt-1 text-2xl gold" style={{ fontFamily: "Fraunces, serif" }}>{eur(einnahmenJahr)}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Kosten {year}</div>
          <div className="mt-1 text-2xl" style={{ fontFamily: "Fraunces, serif", color: "var(--red)" }}>{eur(kostenJahr)}</div>
        </div>
      </section>
    </div>
  );
}
