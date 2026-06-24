import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTermin } from "@/lib/actions/termine";
import type { Property, Termin } from "@/lib/types";

export default async function TerminEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }] = await Promise.all([
    supabase.from("termine").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);
  if (!row) notFound();
  const t = row as Termin;
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/termine" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Termin bearbeiten</div></div>
        </div>
      </div>

      <form action={updateTermin.bind(null, t.id)} className="form-box">
        <h3>📅 Termin bearbeiten</h3>
        <div className="form-row">
          <div className="form-group"><label>Titel *</label><input type="text" name="titel" defaultValue={t.titel ?? ""} required /></div>
          <div className="form-group"><label>Datum *</label><input type="date" name="datum" defaultValue={t.datum ?? ""} required /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Immobilie</label>
            <select name="prop_id" defaultValue={t.prop_id ?? ""}>
              <option value="">—</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Notiz</label><input type="text" name="notiz" defaultValue={t.notiz ?? ""} /></div>
        </div>
        <div className="form-actions">
          <Link href="/termine" className="btn btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn btn-gold">Speichern</button>
        </div>
      </form>
    </div>
  );
}
