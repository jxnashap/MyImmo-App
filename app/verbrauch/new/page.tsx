import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createVerbrauch } from "@/lib/actions/buchungen";
import type { Property } from "@/lib/types";

const ARTEN = ["Strom", "Gas", "Wasser", "Heizöl", "Fernwärme", "Sonstiges"];
const EINHEITEN = ["kWh", "m³", "Liter", "Pauschal"];

export default async function NeuerVerbrauchPage({ searchParams }: { searchParams: { prop?: string; back?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  const properties = (data ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/verbrauch";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Verbrauch erfassen</div></div>
        </div>
      </div>

      <form action={createVerbrauch} className="form-box">
        <h3>⚡ Verbrauch erfassen</h3>
        <p>Strom, Gas, Wasser, Heizöl und andere Energieträger.</p>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Datum *</label><input type="date" name="buchungsdatum" required /></div>
          <div className="form-group"><label>Immobilie *</label>
            <select name="prop_id" defaultValue={searchParams.prop ?? ""} required>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Art</label><select name="art" defaultValue="Strom">{ARTEN.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="form-group"><label>Menge</label><input type="number" step="0.01" name="menge" placeholder="1250" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Einheit</label><select name="einheit" defaultValue="kWh">{EINHEITEN.map((e) => <option key={e}>{e}</option>)}</select></div>
          <div className="form-group"><label>Kosten (€) *</label><input type="number" step="0.01" name="verbrauchkosten" placeholder="180" required /></div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn btn-gold">Speichern</button>
        </div>
      </form>
    </div>
  );
}
