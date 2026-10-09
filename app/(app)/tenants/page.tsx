import { heuteBerlin } from "@/lib/zeitraum";
import Link from "next/link";
import { Plus, User, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { euro, datum } from "@/lib/format";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import type { Tenant, Property } from "@/lib/types";

export default async function TenantsPage(props0: { searchParams: Promise<{ q?: string; prop?: string }> }) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const [{ data: tenants }, { data: props }] = await Promise.all([
    supabase.from("mieter").select("*").order("nachname"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const alle = (tenants ?? []) as Tenant[];
  const propList = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const nameOf = new Map(propList.map((p): [string, string] => [p.id, p.bezeichnung]));

  // Suche über Name/Einheit/Kontakt + Objekt-Filter (URL-gesteuert wie überall).
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const prop = searchParams.prop ?? "";
  const list = alle.filter((m) => {
    if (prop && m.prop_id !== prop) return false;
    if (!q) return true;
    return [m.vorname, m.nachname, m.einheit, m.email, m.telefon]
      .some((t) => (t ?? "").toLowerCase().includes(q));
  });

  const filters: FilterDef[] = [
    { name: "q", label: "Suche", variant: "search", placeholder: "Name, Einheit, E-Mail…", options: [] },
    { name: "prop", label: "Immobilie", icon: "home", options: [{ value: "", label: "Alle Immobilien" }, ...propList.map((p) => ({ value: p.id, label: p.bezeichnung }))] },
  ];

  // Ausgezogene Mieter zaehlten in den KPIs voll mit: Wer seit Jahren
  // ausgezogen ist, erhoehte „Kaltmiete / Mo." weiter, und seine laengst
  // abgerechnete Kaution stand dauerhaft unter „Kaution offen". Die Kennzahlen
  // beziehen sich jetzt auf LAUFENDE Mietverhaeltnisse; die Liste darunter
  // zeigt weiterhin alle.
  const heuteISO = heuteBerlin();
  const laeuft = (m: Tenant) =>
    (m.mietende ?? "") === "" || (m.mietende as string) >= heuteISO;
  const aktive = list.filter(laeuft);
  const ehemalige = list.length - aktive.length;

  const gesamtMiete = aktive.reduce((s, m) => s + (m.kaltmiete ?? 0), 0);
  const gesamtKaution = aktive.reduce((s, m) => s + (m.kaution ?? 0), 0);
  const offeneKaution = aktive.filter((m) => m.kaution_status !== "ja").length;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Verwaltung · Vermietung</div>
          <div className="topbar-title">Mieter</div>
          <div className="topbar-sub">Mietverträge, Fristen, Einheiten &amp; Dokumente</div>
        </div>
        <Link href="/tenants/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Mieter</Link>
      </div>
      <hr className="topbar-rule" />

      <div className="staffel grid-4 mb-20">
        <div className="kpi-card" title={ehemalige > 0 ? `${ehemalige} bereits ausgezogen` : undefined}>
          <div className="kpi-label">Aktive Mietverhältnisse</div>
          <div className="kpi-value">{aktive.length}{ehemalige > 0 && <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}> / {list.length}</span>}</div>
        </div>
        <div className="kpi-card" title="Nur laufende Mietverhältnisse"><div className="kpi-label">Kaltmiete / Mo.</div><div className="kpi-value" style={{ color: "var(--green)" }}>{euro(gesamtMiete)}</div></div>
        <div className="kpi-card" title="Nur laufende Mietverhältnisse"><div className="kpi-label">Kautionen</div><div className="kpi-value">{euro(gesamtKaution)}</div></div>
        <div className="kpi-card" title="Nur laufende Mietverhältnisse"><div className="kpi-label">Kaution offen</div><div className="kpi-value" style={{ color: offeneKaution > 0 ? "var(--amber)" : "var(--green)" }}>{offeneKaution}</div></div>
      </div>

      <FilterBar filters={filters} />

      {list.length === 0 ? (
        <div className="staffel prop-grid">
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <User className="empty-icon" size={36} color="var(--faint)" />
            {alle.length > 0 ? (
              <>
                <h4>Keine Treffer</h4>
                <p>Kein Mieter passt zur aktuellen Suche/Filterung.</p>
              </>
            ) : (
              <>
                <h4>Noch keine Mieter</h4>
                <p>Füge deinen ersten Mieter hinzu.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="section-body listen">
            {aktive.map((m) => <MieterZeile key={m.id} aktiv m={m} objekt={(m.prop_id && nameOf.get(m.prop_id)) || null} />)}
            {ehemalige > 0 && <div className="listen-gruppe">Ausgezogen ({ehemalige})</div>}
            {list.filter((m) => !laeuft(m)).map((m) => <MieterZeile key={m.id} m={m} objekt={(m.prop_id && nameOf.get(m.prop_id)) || null} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Eine Zeile je Mietverhältnis (03.10.2026): Name, Objekt · Einheit · Mietzeit, Miete rechts.
 *  Telefon, E-Mail, Bearbeiten und NK-Abrechnung liegen auf der Mieterseite — ein Klick. */
function MieterZeile({ m, objekt, aktiv = false }: { m: Tenant; objekt: string | null; aktiv?: boolean }) {
  const name = [m.vorname, m.nachname].filter(Boolean).join(" ") || "—";
  const zeit = m.mietbeginn ? `seit ${datum(m.mietbeginn)}${m.mietende ? ` bis ${datum(m.mietende)}` : ""}` : "Mietbeginn fehlt";
  const kuerzel = [m.vorname, m.nachname].map((t) => (t ?? "").trim().charAt(0)).join("").toUpperCase() || "?";
  return (
    <Link href={`/tenants/${m.id}`} className="listen-zeile" aria-label={`${name} öffnen`}>
      <span className="listen-icon" style={{ fontSize: 11.5, fontWeight: 600 }}>{kuerzel}</span>
      <span className="listen-zeile-text">
        <span className="listen-zeile-titel">{name}</span>
        <span className="listen-zeile-sub">{[objekt ?? "ohne Objekt", m.einheit, zeit].filter(Boolean).join(" · ")}</span>
      </span>
      {aktiv && m.kaution_status !== "ja" && <span className="badge badge-red listen-zeile-extra">Kaution offen</span>}
      <span className="listen-zeile-zahl">
        <b>{euro(m.kaltmiete)}</b>
        <small>{m.nk_vorauszahlung ? `+ ${euro(m.nk_vorauszahlung)} NK` : "kalt / Mo."}</small>
      </span>
      <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
    </Link>
  );
}
