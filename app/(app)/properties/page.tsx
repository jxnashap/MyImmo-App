import { restschuldVon } from "@/lib/kredit";
import { objektCheck, type CheckMieter } from "@/lib/objektCheck";
import { mitGeltendenBetraegen } from "@/lib/sollAb";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro, prozent } from "@/lib/format";
import type { Property, Kredit } from "@/lib/types";
import FilterBar, { type FilterDef } from "@/components/filters/FilterBar";
import { sortiereObjekte, SORT_OPTIONEN } from "@/lib/objektSortierung";
import { sollKaltmiete } from "@/lib/sollMiete";
import { aktuellerWert, bruttoRendite } from "@/lib/portfolioKennzahlen";
import { heuteBerlin } from "@/lib/zeitraum";
import { Building2, Home, Building, Store, TreePalm, Sprout, Link2, Upload, Plus, ChevronRight, type LucideIcon } from "lucide-react";

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

export default async function PropertiesPage(
  props: {
    searchParams: Promise<{ sort?: string; q?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [{ data }, { data: kred }, { data: miet }, { data: mz }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("kredite").select("id,prop_id,restschuld,betrag,auszahlung_datum"),
    supabase.from("mieter").select("id,prop_id,kaltmiete,stellplatz_miete,mietbeginn,mietende"),
    supabase.from("miet_zeitraeume").select("mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete"),
  ]);

  // Miete je Objekt nach derselben Regel wie Dashboard und Objektseite
  // (lib/sollMiete.ts) — auch für Rendite und Sortierung „nach Miete".
  // Stichtag in Europe/Berlin (Audit P8, C15) — wie Dashboard und Objektseite.
  const heute = heuteBerlin();
  // Paket B: mit den Beträgen, die diesen Monat gelten (Miet-Zeiträume vor dem Mieterfeld).
  const mietJetzt = mitGeltendenBetraegen((miet ?? []) as { id: string; prop_id: string | null; kaltmiete: number | null; stellplatz_miete: number | null; mietbeginn: string | null; mietende: string | null }[], (mz ?? []) as never[], heute.slice(0, 7));
  const alle = ((data ?? []) as Property[]).map((p) => ({ ...p, miete: sollKaltmiete(p, mietJetzt, heute).betrag }));
  const kredite = (kred ?? []) as Pick<Kredit, "id" | "prop_id" | "restschuld" | "betrag" | "auszahlung_datum">[];

  const restMap = new Map<string, number>();
  for (const k of kredite) {
    if (!k.prop_id) continue;
    restMap.set(k.prop_id, (restMap.get(k.prop_id) ?? 0) + restschuldVon(k));
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
            <Link2 size={14} style={{ verticalAlign: "-2px" }} /> Exposé auslesen
          </Link>
          <Link href="/einstellungen/import" className="btn btn-ghost" title="Bestandsdaten aus vermietet.de, objego oder Excel (CSV) übernehmen">
            <Upload size={14} style={{ verticalAlign: "-2px" }} /> Daten übernehmen
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
            {alle.length > 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
                Kein Objekt passt zu Suche oder Status-Filter — Filter oben anpassen.
              </p>
            ) : (
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
              Lege oben dein erstes Objekt an, lies ein{" "}
              <Link href="/properties/import" style={{ color: "var(--gold)" }}>Exposé</Link>{" "}
              aus — oder{" "}
              <Link href="/einstellungen/import" style={{ color: "var(--gold)" }}>
                übernimm deine Daten aus vermietet.de, objego oder Excel (CSV)
              </Link>.
            </p>
            )}
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="section-body listen">
          {list.map((p) => {
            // Wert und Rendite nach derselben Regel wie Objektseite und Dashboard
            // (lib/portfolioKennzahlen.ts, Audit P8 B24): Rendite auf den Kaufpreis.
            const wert = aktuellerWert(p) ?? 0;
            const rendite = bruttoRendite(p, p.miete);
            const rest = restMap.get(p.id) ?? 0;
            const Icon = (p.typ && PROP_ICONS[p.typ]) || Home;
            // Objekt-Check (lib/objektCheck.ts): „8/10“ neben dem Status, nur wenn etwas fehlt.
            const c = objektCheck(p, (miet ?? []) as CheckMieter[], kredite, heute);
            return (
              <Link key={p.id} href={`/properties/${p.id}`} className="listen-zeile" aria-label={`${p.bezeichnung} öffnen`}>
                <span className="listen-icon"><Icon size={16} /></span>
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">{p.bezeichnung}</span>
                  <span className="listen-zeile-sub">{p.adresse || p.typ || "—"}</span>
                </span>
                {c.fehlend.length > 0 && <span className="badge badge-neutral listen-zeile-extra" title={`Fehlt: ${c.fehlend.map((f) => f.label).join(", ")}`}>{c.erfuellt}/{c.gesamt} Angaben</span>}
                {p.obj_status && <span className={`badge ${statusBadge(p.obj_status)} listen-zeile-extra`}>{p.obj_status}</span>}
                <span className="listen-zeile-zahl listen-zeile-extra" title={`Bruttorendite (Kaltmiete × 12 ÷ ${rendite?.basis === "wert" ? "Wert — kein Kaufpreis erfasst" : "Kaufpreis"}) und Restschuld`}>
                  <b style={{ color: "var(--teal)" }}>{rendite ? prozent(rendite.prozent, 2) : "–"}</b>
                  <small>{rest > 0 ? `${euro(rest)} Schuld` : "schuldenfrei"}</small>
                </span>
                <span className="listen-zeile-zahl">
                  <b>{euro(wert)}</b>
                  <small>{p.miete ? `${euro(p.miete)} / Mo.` : "keine Miete"}</small>
                </span>
                <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
              </Link>
            );
          })}
          </div>
        </div>
      )}

      {/* Mobile-Schnellaktion: schwebender „+"-Button (nur < 860px sichtbar) */}
      <Link href="/properties/new" className="btn-fab show-mobile" aria-label="Neue Immobilie anlegen" title="Neue Immobilie">
        <Plus size={24} />
      </Link>
    </div>
  );
}
