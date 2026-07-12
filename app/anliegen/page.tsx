// Vermieter-Seite: eingegangene Anliegen der verknüpften Mieter
// (Schaden / Dokument / Frage) mit Status und Antwort.
import { createClient } from "@/lib/supabase/server";
import AnliegenManager, { type AnliegenVermieterRow } from "@/components/AnliegenManager";
import VermieterAnfragen, { type VermieterAnfrageRow } from "@/components/VermieterAnfragen";

export default async function AnliegenPage() {
  const supabase = createClient();
  const [{ data: rows }, { data: mieter }, { data: props }, { data: anfrageRows }, { data: zugaenge }] = await Promise.all([
    supabase.from("anliegen").select("*").order("created_at", { ascending: false }),
    supabase.from("mieter").select("id,vorname,nachname"),
    supabase.from("properties").select("id,bezeichnung"),
    supabase.from("vermieter_anfragen").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("mieter_zugaenge").select("mieter_id"),
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

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Anliegen</div>
          <div className="topbar-sub">
            Meldungen deiner Mieter aus dem Mieterportal
            {liste.length > 0 ? ` · ${offen} offen von ${liste.length}` : ""}
          </div>
        </div>
      </div>
      <VermieterAnfragen anfragen={anfragen} mieter={verbundeneMieter} />

      <div className="section">
        <div className="section-header"><h3>Meldungen deiner Mieter</h3></div>
        <div className="section-body">
          <AnliegenManager rows={liste} />
        </div>
      </div>
    </div>
  );
}
