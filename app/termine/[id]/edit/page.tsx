import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTermin } from "@/lib/actions/termine";
import { KATEGORIE_STIL, TERMIN_KATEGORIEN, WIEDERKEHRUNG_LABEL } from "@/lib/termine";
import type { Property, Termin } from "@/lib/types";

export default async function TerminEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }, { data: mieterData }] = await Promise.all([
    supabase.from("termine").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);
  if (!row) notFound();
  const t = row as Termin;
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const mieter = (mieterData ?? []) as { id: string; vorname: string | null; nachname: string | null }[];

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/termine" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Termin bearbeiten</div></div>
        </div>
      </div>

      <form action={updateTermin.bind(null, t.id)} className="form-box">
        <h3>Termin bearbeiten</h3>
        <div className="form-row">
          <div className="form-group"><label>Titel *</label><input type="text" name="titel" defaultValue={t.titel ?? ""} required /></div>
          <div className="form-group"><label>Datum *</label><input type="date" name="datum" defaultValue={t.datum ?? ""} required /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Kategorie</label>
            <select name="kategorie" defaultValue={t.kategorie ?? "Sonstiges"}>
              {TERMIN_KATEGORIEN.map((k) => <option key={k} value={k}>{KATEGORIE_STIL[k]?.icon} {k}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Wiederkehrung</label>
            <select name="wiederkehrung" defaultValue={t.wiederkehrung ?? ""}>
              <option value="">einmalig</option>
              {Object.entries(WIEDERKEHRUNG_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Immobilie</label>
            <select name="prop_id" defaultValue={t.prop_id ?? ""}>
              <option value="">—</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Mieter (optional)</label>
            <select name="mieter_id" defaultValue={t.mieter_id ?? ""}>
              <option value="">—</option>
              {mieter.map((m) => <option key={m.id} value={m.id}>{[m.vorname, m.nachname].filter(Boolean).join(" ")}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Vorlauf (Tage, für Kalender-Erinnerung)</label>
            <input type="number" name="vorlauf_tage" min="0" max="365" defaultValue={t.vorlauf_tage ?? ""} placeholder="—" />
          </div>
          <div className="form-group"><label>Notiz</label><input type="text" name="notiz" defaultValue={t.notiz ?? ""} /></div>
        </div>
        <div className="form-actions">
          <Link href="/termine" className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
