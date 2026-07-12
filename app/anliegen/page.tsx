// Vermieter-Seite "Mieterportal": alles, was über das Portal mit Mietern
// (und Bewerbern) läuft — Anliegen der Mieter, eigene Anfragen an Mieter
// und der Bewerbungs-Eingang mit Selbstauskunft-Links.
import Link from "next/link";
import { MessageSquareText, UserRoundSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnliegenManager, { type AnliegenVermieterRow } from "@/components/AnliegenManager";
import VermieterAnfragen, { type VermieterAnfrageRow } from "@/components/VermieterAnfragen";
import BewerbungenManager, { type BewerberLinkRow, type BewerbungRow } from "@/components/BewerbungenManager";

export default async function AnliegenPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "bewerbungen" ? "bewerbungen" : "anliegen";

  const supabase = createClient();
  const [
    { data: rows }, { data: mieter }, { data: props }, { data: anfrageRows }, { data: zugaenge },
    { data: linkRows }, { data: bewerbungRows },
  ] = await Promise.all([
    supabase.from("anliegen").select("*").order("created_at", { ascending: false }),
    supabase.from("mieter").select("id,vorname,nachname"),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("vermieter_anfragen").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("mieter_zugaenge").select("mieter_id"),
    supabase.from("bewerber_links").select("*").order("created_at", { ascending: false }),
    supabase.from("bewerbungen").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const { data: dateiRows } = (rows ?? []).length
    ? await supabase
        .from("anliegen_dateien")
        .select("id,name,anliegen_id")
        .in("anliegen_id", (rows ?? []).map((a) => a.id))
    : { data: [] as { id: string; name: string; anliegen_id: string }[] };

  const mieterName = (id: string) => {
    const m = (mieter ?? []).find((x) => x.id === id);
    return m ? [m.vorname, m.nachname].filter(Boolean).join(" ") : "Mieter";
  };
  const objektName = (id: string | null) =>
    (props ?? []).find((p) => p.id === id)?.bezeichnung ?? "–";

  const liste: AnliegenVermieterRow[] = (rows ?? []).map((a) => ({
    id: a.id,
    typ: a.typ,
    titel: a.titel,
    beschreibung: a.beschreibung,
    status: a.status,
    antwort: a.antwort,
    created_at: a.created_at,
    mieterName: mieterName(a.mieter_id),
    objektName: objektName(a.prop_id),
    dateien: (dateiRows ?? []).filter((d) => d.anliegen_id === a.id).map((d) => ({ id: d.id, name: d.name })),
  }));

  const offen = liste.filter((a) => a.status !== "erledigt").length;

  const anfragen: VermieterAnfrageRow[] = ((anfrageRows ?? []) as any[]).map((a) => ({
    id: a.id,
    typ: a.typ,
    titel: a.titel,
    beschreibung: a.beschreibung,
    termin: a.termin,
    faellig_bis: a.faellig_bis,
    status: a.status,
    antwort: a.antwort,
    created_at: a.created_at,
    mieterName: mieterName(a.mieter_id),
    objektName: objektName(a.prop_id),
  }));
  const verbundeneIds = new Set((zugaenge ?? []).map((z) => z.mieter_id));
  const verbundeneMieter = (mieter ?? [])
    .filter((m) => verbundeneIds.has(m.id))
    .map((m) => ({ id: m.id, name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter" }));

  const links: BewerberLinkRow[] = ((linkRows ?? []) as any[]).map((l) => ({
    id: l.id, token: l.token, titel: l.titel, aktiv: l.aktiv, created_at: l.created_at,
    objektName: objektName(l.prop_id),
  }));
  const bewerbungen: BewerbungRow[] = ((bewerbungRows ?? []) as any[]).map((b) => ({
    id: b.id, name: b.name, email: b.email, telefon: b.telefon, einzug_ab: b.einzug_ab,
    personen: b.personen, beruf: b.beruf, arbeitgeber: b.arbeitgeber,
    netto_einkommen: b.netto_einkommen == null ? null : Number(b.netto_einkommen),
    raucher: b.raucher, haustiere: b.haustiere, schufa: b.schufa, nachricht: b.nachricht,
    unterschrift_data: b.unterschrift_data, status: b.status, created_at: b.created_at,
    objektName: objektName(b.prop_id),
  }));
  const neueBewerbungen = bewerbungen.filter((b) => b.status === "neu").length;

  const TABS = [
    { key: "anliegen", label: "Anliegen & Anfragen", icon: MessageSquareText, badge: offen },
    { key: "bewerbungen", label: "Bewerbungen", icon: UserRoundSearch, badge: neueBewerbungen },
  ] as const;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Mieterportal</div>
          <div className="topbar-sub">
            {tab === "bewerbungen"
              ? `Selbstauskunft-Links & Bewerbungs-Eingang${bewerbungen.length > 0 ? ` · ${neueBewerbungen} neu von ${bewerbungen.length}` : ""}`
              : `Meldungen deiner Mieter & deine Anfragen an sie${liste.length > 0 ? ` · ${offen} offen von ${liste.length}` : ""}`}
          </div>
        </div>
      </div>

      {/* Bereichs-Umschalter im Glass-Stil (wie im Mieter-Portal) */}
      <nav className="glass-bar" aria-label="Mieterportal-Bereiche" style={{ marginBottom: 20 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.key} href={`/anliegen?tab=${t.key}`} className={`glass-item ${tab === t.key ? "active" : ""}`}>
              <Icon size={14} /> {t.label}
              {t.badge > 0 && tab !== t.key && (
                <span className="badge badge-amber" style={{ fontSize: 10, padding: "1px 7px" }}>{t.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "anliegen" && (
        <>
          <VermieterAnfragen anfragen={anfragen} mieter={verbundeneMieter} />
          <div className="section">
            <div className="section-header"><h3>Meldungen deiner Mieter</h3></div>
            <div className="section-body">
              <AnliegenManager rows={liste} />
            </div>
          </div>
        </>
      )}

      {tab === "bewerbungen" && (
        <BewerbungenManager links={links} bewerbungen={bewerbungen} properties={props ?? []} />
      )}
    </div>
  );
}
