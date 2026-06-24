import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eur, eur2, datum } from "@/lib/format";
import { deleteProperty } from "@/lib/actions/properties";
import DeleteButton from "@/components/DeleteButton";
import type { Property, Tenant } from "@/lib/types";

type Kredit = {
  id: string;
  bezeichnung: string | null;
  bank: string | null;
  betrag: number | null;
  restschuld: number | null;
  monatsrate: number | null;
  zinssatz: number | null;
  tilgungssatz: number | null;
  zinsbindung: string | null;
};
type Buchung = { id: string; betrag: number | null; buchungsdatum: string | null; kategorie: string | null };

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = params.id;

  const [{ data: prop }, { data: mieter }, { data: einn }, { data: kost }, { data: kredite }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).single(),
      supabase.from("mieter").select("*").eq("prop_id", id).order("mietbeginn"),
      supabase.from("einnahmen").select("id,betrag,buchungsdatum,kategorie").eq("prop_id", id).order("buchungsdatum", { ascending: false }),
      supabase.from("kosten").select("id,betrag,buchungsdatum,kategorie").eq("prop_id", id).order("buchungsdatum", { ascending: false }),
      supabase.from("kredite").select("id,bezeichnung,bank,betrag,restschuld,monatsrate,zinssatz,tilgungssatz,zinsbindung").eq("prop_id", id),
    ]);

  if (!prop) notFound();
  const p = prop as Property;
  const tenants = (mieter ?? []) as Tenant[];
  const kred = (kredite ?? []) as Kredit[];
  const einnahmen = (einn ?? []) as Buchung[];
  const kosten = (kost ?? []) as Buchung[];

  const wert = p.wert ?? p.kaufpreis ?? 0;
  const sollMiete = p.miete ?? tenants.reduce((s, t) => s + (t.kaltmiete ?? 0), 0);
  const rateMo = kred.reduce((s, k) => s + (k.monatsrate ?? 0), 0);
  const restschuld = kred.reduce((s, k) => s + (k.restschuld ?? 0), 0);
  const cashflowMo = sollMiete - rateMo;
  const einnahmenGesamt = einnahmen.reduce((s, e) => s + (e.betrag ?? 0), 0);
  const kostenGesamt = kosten.reduce((s, k) => s + (k.betrag ?? 0), 0);

  const jahresMiete = sollMiete * 12;
  const bruttoRendite = wert ? (jahresMiete / wert) * 100 : null;
  const faktor = jahresMiete && p.kaufpreis ? p.kaufpreis / jahresMiete : null;

  const kpis = [
    { label: "Aktueller Wert", value: eur(wert), cls: "gold" },
    { label: "Kaltmiete / Mo.", value: sollMiete ? eur(sollMiete) : "–" },
    { label: "Restschuld gesamt", value: eur(restschuld) },
    {
      label: "Cashflow / Mo.",
      value: (cashflowMo >= 0 ? "+ " : "") + eur(cashflowMo),
      color: cashflowMo >= 0 ? "var(--green)" : "var(--red)",
      sub: cashflowMo >= 0 ? "positiv" : "negativ",
    },
  ];

  const stamm: [string, React.ReactNode][] = [
    ["Typ", p.typ || "–"],
    ["Adresse", p.adresse || "–"],
    ["Wohnfläche", p.flaeche ? `${p.flaeche} m²` : "–"],
    ["Zimmer", p.zimmer ?? "–"],
    ["Baujahr", p.baujahr ?? "–"],
    ["Kaufpreis", eur(p.kaufpreis)],
    ["Aktueller Wert", eur(p.wert)],
    ["Energieklasse", p.energieklasse || "–"],
    ["Hausgeld / Mo.", p.hausgeld ? `${eur(p.hausgeld)}/Mo` : "–"],
    ["Status", p.obj_status || "–"],
    ["Notiz", p.notiz_import || "–"],
  ];

  const kennzahlen: { label: string; sub: string; value: string; pill: string }[] = [
    { label: "Bruttomietrendite", sub: "Jahreskaltmiete / Wert", value: bruttoRendite != null ? `${bruttoRendite.toFixed(2)}%` : "–", pill: bruttoRendite != null && bruttoRendite >= 4 ? "pill-teal" : "pill-red" },
    { label: "Kaufpreisfaktor", sub: "Kaufpreis / Jahreskaltmiete", value: faktor != null ? `${faktor.toFixed(1)}x` : "–", pill: "pill-teal" },
    { label: "Kreditrate / Mo.", sub: "Summe aller Darlehensraten", value: eur(rateMo), pill: "pill-teal" },
    { label: "Restschuld gesamt", sub: "Summe aller Darlehen", value: eur(restschuld), pill: "pill-teal" },
    { label: "Cashflow / Mo.", sub: "Miete minus Kreditrate", value: (cashflowMo >= 0 ? "+ " : "") + eur(cashflowMo), pill: cashflowMo >= 0 ? "pill-green" : "pill-red" },
    { label: "Einnahmen gesamt", sub: "Alle erfassten Einnahmen", value: eur(einnahmenGesamt), pill: "pill-green" },
    { label: "Kosten gesamt", sub: "Alle erfassten Ausgaben", value: eur(kostenGesamt), pill: "pill-red" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/properties" className="btn-outline mb-3">← Zurück</Link>
          <h1 className="text-3xl">{p.bezeichnung}</h1>
          <p className="mt-1 text-white/40">
            {p.adresse || "Keine Adresse"}
            {p.obj_status ? ` · ${p.obj_status}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Link href={`/properties/${id}/edit`} className="btn-outline">✏️ Bearbeiten</Link>
          <DeleteButton
            action={deleteProperty.bind(null, id)}
            confirmText={`„${p.bezeichnung}" wirklich löschen?`}
            label="🗑️ Löschen"
            className="btn-red"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.cls ?? ""}`} style={k.color ? { color: k.color } : undefined}>{k.value}</div>
            {k.sub && <div className="mt-1 text-xs" style={{ color: k.color }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Stammdaten + Kennzahlen */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-2 section-title">📋 Stammdaten</div>
          <div>
            {stamm.map(([k, v]) => (
              <div key={k} className="kv-row">
                <span className="text-sm text-white/50">{k}</span>
                <span className="text-right text-sm">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-2 section-title">📈 Kennzahlen &amp; Rendite</div>
          <div>
            {kennzahlen.map((k) => (
              <div key={k.label} className="kv-row">
                <span>
                  <span className="block text-sm">{k.label}</span>
                  <span className="block text-xs text-white/40">{k.sub}</span>
                </span>
                <span className={`pill ${k.pill}`}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mieter */}
      <section className="mt-4 card">
        <div className="mb-4 flex items-center justify-between">
          <div className="section-title">👤 Mieter dieser Immobilie</div>
          <Link href="/tenants/new" className="btn-outline">+ Mieter</Link>
        </div>
        {tenants.length === 0 ? (
          <p className="text-white/40">Keine Mieter zugeordnet.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {tenants.map((t) => (
              <Link key={t.id} href={`/tenants/${t.id}/edit`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-sm text-white/50">
                  {(t.vorname?.[0] ?? t.nachname?.[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {[t.vorname, t.nachname].filter(Boolean).join(" ") || "—"}
                    {t.einheit ? <span className="text-white/40"> · {t.einheit}</span> : ""}
                  </div>
                  <div className="text-xs text-white/40">seit {datum(t.mietbeginn)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm gold">{eur(t.kaltmiete)}</div>
                  <div className="text-[11px] text-white/35">Kaltmiete / Mo.</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Kredite & Finanzierung */}
      <section className="mt-4 card">
        <div className="mb-4 flex items-center justify-between">
          <div className="section-title">🏦 Kredite &amp; Finanzierung</div>
          <Link href="/kredite" className="btn-outline">+ Darlehen</Link>
        </div>
        {kred.length === 0 ? (
          <p className="text-white/40">Keine Darlehen erfasst.</p>
        ) : (
          <div className="space-y-6">
            {kred.map((k) => {
              const getilgt = k.betrag && k.betrag > 0 ? Math.max(0, Math.min(100, ((k.betrag - (k.restschuld ?? 0)) / k.betrag) * 100)) : null;
              return (
                <div key={k.id}>
                  <div className="font-medium">{k.bezeichnung || "Darlehen"}</div>
                  <div className="text-sm text-white/40">
                    {[k.bank, k.zinssatz != null ? `${k.zinssatz}% Zins` : null, k.tilgungssatz != null ? `${k.tilgungssatz}% Tilgung` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-xs text-white/40">Restschuld</div>
                      <div className="text-sm" style={{ color: "var(--red)" }}>{eur(k.restschuld)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Rate/Mo.</div>
                      <div className="text-sm">{eur(k.monatsrate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Volltilgung</div>
                      <div className="text-sm">{k.zinsbindung || "–"}</div>
                    </div>
                  </div>
                  {getilgt != null && (
                    <div className="mt-3">
                      <div className="mb-1 text-xs text-white/40">Getilgt: {Math.round(getilgt)}%</div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full" style={{ width: `${getilgt}%`, background: "var(--green)" }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Einnahmen + Kosten */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <BuchungsListe
          title="💰 Einnahmen"
          gesamt={einnahmenGesamt}
          gesamtColor="var(--green)"
          rows={einnahmen}
          addHref={`/einnahmen?prop=${id}`}
          amountColor="var(--green)"
        />
        <BuchungsListe
          title="📋 Kosten & Ausgaben"
          gesamt={kostenGesamt}
          gesamtColor="var(--red)"
          rows={kosten}
          addHref={`/kosten?prop=${id}`}
          amountColor="var(--red)"
        />
      </div>
    </div>
  );
}

function BuchungsListe({
  title,
  gesamt,
  gesamtColor,
  rows,
  addHref,
  amountColor,
}: {
  title: string;
  gesamt: number;
  gesamtColor: string;
  rows: Buchung[];
  addHref: string;
  amountColor: string;
}) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div className="section-title">{title}</div>
        <Link href={addHref} className="btn-outline">+ Hinzufügen</Link>
      </div>
      <div className="mb-3 text-sm">
        Gesamt: <span style={{ color: gesamtColor }}>{eur(gesamt)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-white/40">Keine Buchungen.</p>
      ) : (
        <div className="divide-y divide-white/10">
          {rows.slice(0, 12).map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 text-white/50">{datum(r.buchungsdatum)}</span>
              <span className="flex-1">
                {r.kategorie ? <span className="pill pill-neutral">{r.kategorie}</span> : ""}
              </span>
              <span className="text-right" style={{ color: amountColor }}>{eur2(r.betrag)}</span>
            </div>
          ))}
          {rows.length > 12 && (
            <div className="pt-2 text-xs text-white/40">… und {rows.length - 12} weitere</div>
          )}
        </div>
      )}
    </div>
  );
}
