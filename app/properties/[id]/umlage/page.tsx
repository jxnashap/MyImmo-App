import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UmlageAssistent from "@/components/UmlageAssistent";

export const dynamic = "force-dynamic";

export default async function UmlagePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = params.id;

  const [{ data: prop }, { data: mieter }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung,flaeche").eq("id", id).single(),
    supabase
      .from("mieter")
      .select("id,vorname,nachname,einheit,flaeche,mietbeginn,mietende")
      .eq("prop_id", id)
      .order("mietbeginn"),
  ]);

  if (!prop) notFound();

  const tenants = (mieter ?? []).map((m) => ({
    id: m.id,
    name: [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter",
    einheit: m.einheit,
    flaeche: m.flaeche,
    mietbeginn: m.mietbeginn,
    mietende: m.mietende,
  }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/properties/${id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
            ← Zurück
          </Link>
          <div>
            <div className="topbar-title">Nebenkosten verteilen</div>
            <div className="topbar-sub">
              {prop.bezeichnung} · Gesamtkosten einmal eingeben, automatisch nach m² auf alle Mieter aufteilen
            </div>
          </div>
        </div>
      </div>

      <UmlageAssistent
        propId={id}
        propName={prop.bezeichnung}
        propFlaeche={prop.flaeche}
        mieter={tenants}
        jahrDefault={new Date().getFullYear() - 1}
      />
    </div>
  );
}
