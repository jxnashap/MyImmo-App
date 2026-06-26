import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateEinnahme } from "@/lib/actions/buchungen";
import type { Property, Tenant, Einnahme } from "@/lib/types";

const KATEGORIEN = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"];

export default async function EinnahmeEditPage({ params, searchParams }: { params: { id: string }; searchParams: { back?: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }, { data: miet }] = await Promise.all([
    supabase.from("einnahmen").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);
  if (!row) notFound();
  const e = row as Einnahme;
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];
  const back = searchParams.back || "/einnahmen";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Einnahme bearbeiten</div></div>
        </div>
      </div>

      <form action={updateEinnahme.bind(null, e.id)} className="form-box">
        <h3>💰 Einnahme bearbeiten</h3>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Datum *</label><input type="date" name="buchungsdatum" defaultValue={e.buchungsdatum ?? ""} required /></div>
          <div className="form-group"><label>Immobilie *</label>
            <select name="prop_id" defaultValue={e.prop_id ?? ""} required>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Kategorie</label>
            <select name="kategorie" defaultValue={e.kategorie ?? "Miete"}>{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <div className="form-group"><label>Betrag (€) *</label><input type="number" step="0.01" min="0.01" name="betrag" defaultValue={e.betrag ?? ""} required /></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Mieter zuordnen (optional)</label>
            <select name="mieter_id" defaultValue={e.mieter_id ?? ""}>
              <option value="">– Kein Mieter –</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—"}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Beschreibung</label><input type="text" name="beschreibung" defaultValue={e.beschreibung ?? ""} /></div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
