import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";
import { deleteProperty } from "@/lib/actions/properties";
import DeleteButton from "@/components/DeleteButton";
import type { Property, Kredit } from "@/lib/types";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import { sortiereObjekte, SORT_OPTIONEN } from "@/lib/objektSortierung";
import { objektUmfaenge, objektFolgenText } from "@/lib/loeschUmfang";
import { Building2, Home, Building, Store, TreePalm, Sprout, Link2, Upload, Plus, X, Landmark, type LucideIcon } from "lucide-react";

// Icon je Objekttyp — exakt wie in der HTML-Vorlage (propIcons).
const PROP_ICONS: Record<string, LucideIcon> = {
  Eigentumswohnung: Building2,
  Einfamilienhaus: Home,
  Mehrfamilienhaus: Building,
  Gewerbeimmobilie: Store,
  Ferienimmobilie: TreePalm,
  Grundstück: Sprout,
};

function statusBadge(status: string | null) {
  if (status === "Vermietet") return "badge-green";
  if (status === "Leer") return "badge-red";
  return "badge-teal";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { sort?: string; q?: string; status?: string };
}) {
  const supabase = createClient();
  const [{ data }, { data: kred }, umfaenge] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("kredite").select("prop_id,restschuld"),
    // Was am Objekt haengt — gehoert VOR den Loeschklick (lib/loeschUmfang.ts).
    objektUmfaenge(),
  ]);

  const alle = (data ?? []) as Property[];
  const kredite = (kred ?? []) as Pick<Kredit, "prop_id" | "restschuld">[];

  const restMap = new Map<string, number>();
  for (const k of kredite) {
    if (!k.prop_id) continue;
    restMap.set(k.prop_id, (restMap.get(k.prop_id) ?? 0) + (k.restschuld ?? 0));
  }

  // Suchen, filtern, sortieren — alles über die URL-Query (wie in den anderen Listen).
  const suche = (searchParams.q ?? "").trim().toLowerCase();
  let list = alle;
  if (suche)
    list = list.filter((p) =>
      [p.bezeichnung, p.adresse, p.typ].filter(Boolean).join(" ").toLowerCase().includes(suche),
    );
  if (searchParams.status) list = list.filter((p) => p.obj_status === searchParams.status);
  list = sortiereObjekte(list, searchParams.sort);

  const filters: FilterDef[] = [
    { name: "q", label: "Suche", variant: "search", placeholder: "Name, Adresse oder Typ…", options: [] },
    {
      name: "status", label: "Status",
      options: [{ value: "", label: "Alle Status" }, ...["Vermietet", "Leer", "Selbst bewohnt", "Feriennutzung"].map((s) => ({ value: s, label: s }))],
    },
    { name: "sort", label: "Sortierung", defaultValue: "name", options: SORT_OPTIONEN.map((o) => ({ value: o.value, label: o.label })) },
  ];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Immobilien · Portfolio</div>
          <div className="topbar-title">Immobilien</div>
          <div className="topbar-sub">Alle erfassten Objekte</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Zwei verschiedene Dinge hiessen beide "Importieren": das KI-Auslesen
              EINES Exposes und der CSV-Umzug aus einer anderen App. Wer eine
              vermietet.de-Exportdatei hatte, klickte oben und landete in einem
              PDF/Link-Formular, das seine CSV nicht annimmt. Jetzt eindeutig
              benannt und beide Wege an derselben Stelle. */}
          <Link href="/properties/import" className="btn btn-ghost" title="Ein einzelnes Objekt aus einem Expose (PDF/Link/Text) auslesen">
            <Link2 size={14} style={{ verticalAlign: "-2px" }} /> Expose auslesen
          </Link>
          <Link href="/einstellungen/import" className="btn btn-ghost" title="Bestandsdaten aus vermietet.de, objego oder Excel (CSV) uebernehmen">
            <Upload size={14} style={{ verticalAlign: "-2px" }} /> Daten uebernehmen
          </Link>
          <Link href="/properties/new" className="btn btn-gold"><Plus size={14} style={{ verticalAlign: "-2px" }} /> Neu</Link>
        </div>
      </div>
      <hr className="topbar-rule" />

      {alle.length > 0 && <FilterBar filters={filters} />}

      {list.length === 0 ? (
        <div className="staffel prop-grid">
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <Home className="empty-icon" size={36} color="var(--faint)" />
            <h4>{alle.length === 0 ? "Noch keine Immobilien" : "Keine Treffer"}</h4>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
              Lege oben dein erstes Objekt an, lies ein{" "}
              <Link href="/properties/import" style={{ color: "var(--gold)" }}>Exposé</Link>{" "}
              aus — oder{" "}
              <Link href="/einstellungen/import" style={{ color: "var(--gold)" }}>
                übernimm deine Daten aus vermietet.de, objego oder Excel (CSV)
              </Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="staffel prop-grid">
          {list.map((p) => {
            const wert = p.wert ?? p.kaufpreis ?? 0;
            const rendite = p.miete && wert ? ((p.miete * 12) / wert) * 100 : null;
            const rest = restMap.get(p.id) ?? 0;
            return (
              <div key={p.id} className="prop-card">
                {/* Ganze Kachel klickbar: unsichtbarer Link über der Karte.
                    Der Löschen-Knopf liegt darüber (z-index) und bleibt bedienbar. */}
                <Link href={`/properties/${p.id}`} className="prop-card-link" aria-label={`${p.bezeichnung} öffnen`} />
                <div className="prop-card-header">
                  <div className="prop-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{(() => { const Icon = (p.typ && PROP_ICONS[p.typ]) || Home; return <Icon size={18} />; })()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="prop-card-name" style={{ color: "var(--text)" }}>{p.bezeichnung}</div>
                    <div className="prop-card-addr">{p.adresse || p.typ || "—"}</div>
                    {p.obj_status && (
                      <div style={{ marginTop: 5 }}>
                        <span className={`badge ${statusBadge(p.obj_status)}`}>{p.obj_status}</span>
                      </div>
                    )}
                  </div>
                  <span className="prop-card-above">
                    <DeleteButton
                      action={deleteProperty.bind(null, p.id)}
                      confirmText={`„${p.bezeichnung}" wirklich löschen? ${objektFolgenText(umfaenge.get(p.id))}`.trim()}
                      className="delete-btn"
                      label={<X size={14} />}
                    />
                  </span>
                </div>
                <div className="prop-card-stats">
                  <div className="prop-stat">
                    <div className="prop-stat-val">{euro(wert)}</div>
                    <div className="prop-stat-lbl">Wert</div>
                  </div>
                  <div className="prop-stat">
                    <div className="prop-stat-val">{p.miete ? euro(p.miete) : "–"}</div>
                    <div className="prop-stat-lbl">Miete/Mo</div>
                  </div>
                  <div className="prop-stat">
                    <div className="prop-stat-val" style={{ color: "var(--teal)" }}>{rendite != null ? `${rendite.toFixed(2)}%` : "–"}</div>
                    <div className="prop-stat-lbl">Rendite</div>
                  </div>
                </div>
                {rest > 0 && (
                  <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)" }}>
                    <Landmark size={12} style={{ verticalAlign: "-2px" }} /> Restschuld: <strong style={{ color: "var(--text)" }}>{euro(rest)}</strong>
                  </div>
                )}
                <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--gold)" }}>→</span> Details anzeigen
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile-Schnellaktion: schwebender „+"-Button (nur < 860px sichtbar) */}
      <Link href="/properties/new" className="btn-fab show-mobile" aria-label="Neue Immobilie anlegen" title="Neue Immobilie">
        <Plus size={24} />
      </Link>
    </div>
  );
}
