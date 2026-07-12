// Vermieter-Seite: eingegangene Anliegen der verknüpften Mieter
// (Schaden / Dokument / Frage) mit Status und Antwort.
import { createClient } from "@/lib/supabase/server";
import AnliegenManager, { type AnliegenVermieterRow } from "@/components/AnliegenManager";

export default async function AnliegenPage() {
  const supabase = createClient();
  const [{ data: rows }, { data: mieter }, { data: props }] = await Promise.all([
    supabase.from("anliegen").select("*").order("created_at", { ascending: false }),
    supabase.from("mieter").select("id,vorname,nachname"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

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
  }));

  const offen = liste.filter((a) => a.status !== "erledigt").length;

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
      <div className="section">
        <div className="section-body">
          <AnliegenManager rows={liste} />
        </div>
      </div>
    </div>
  );
}
