import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateVerbrauch } from "@/lib/actions/buchungen";
import type { Property, Verbrauch } from "@/lib/types";

const ARTEN = ["Strom", "Gas", "Wasser", "Heizöl", "Fernwärme", "Sonstiges"];
const EINHEITEN = ["kWh", "m³", "Liter", "Pauschal"];

export default async function VerbrauchEditPage({ params, searchParams }: { params: { id: string }; searchParams: { back?: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }] = await Promise.all([
    supabase.from("verbrauch").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);
  if (!row) notFound();
  const v = row as Verbrauch;
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/verbrauch";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Verbrauch bearbeiten</div></div>
        </div>
      </div>

      <form action={updateVerbrauch.bind(null, v.id)} className="form-box">
        <h3>⚡ Verbrauch bearbeiten</h3>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Datum *</label><input type="date" name="buchungsdatum" defaultValue={v.buchungsdatum ?? ""} required /></div>
          <div className="form-group"><label>Immobilie *</label>
            <select name="prop_id" defaultValue={v.prop_id ?? ""} required>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Art</label><select name="art" defaultValue={v.art ?? "Strom"}>{ARTEN.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="form-group"><label>Menge</label><input type="number" step="0.01" name="menge" defaultValue={v.menge ?? ""} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Einheit</label><select name="einheit" defaultValue={v.einheit ?? "kWh"}>{EINHEITEN.map((u) => <option key={u}>{u}</option>)}</select></div>
          <div className="form-group"><label>Kosten (€) *</label><input type="number" step="0.01" name="verbrauchkosten" defaultValue={v.verbrauchkosten ?? ""} required /></div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn btn-gold">Speichern</button>
        </div>
      </form>
    </div>
  );
}
