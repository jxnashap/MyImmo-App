import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateNotiz } from "@/lib/actions/buchungen";
import type { Property, Notiz } from "@/lib/types";

const KATEGORIEN = ["Allgemein", "Mietvertrag", "Versicherung", "Handwerker", "Steuer", "Aufgabe"];

export default async function NotizEditPage({ params, searchParams }: { params: { id: string }; searchParams: { back?: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }] = await Promise.all([
    supabase.from("notizen").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);
  if (!row) notFound();
  const n = row as Notiz;
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/notizen";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Notiz bearbeiten</div></div>
        </div>
      </div>

      <form action={updateNotiz.bind(null, n.id)} className="form-box">
        <h3>📁 Notiz bearbeiten</h3>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Titel *</label><input type="text" name="titel" defaultValue={n.titel ?? ""} required /></div>
          <div className="form-group"><label>Immobilie</label>
            <select name="prop_id" defaultValue={n.prop_id ?? ""}>
              <option value="">– Allgemein –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Kategorie</label>
            <select name="kategorie" defaultValue={n.kategorie ?? "Allgemein"}>{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Inhalt</label><textarea name="inhalt" rows={4} defaultValue={n.inhalt ?? ""} style={{ resize: "vertical" }} /></div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn btn-gold">Speichern</button>
        </div>
      </form>
    </div>
  );
}
