import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createNotiz } from "@/lib/actions/buchungen";
import type { Property } from "@/lib/types";

const KATEGORIEN = ["Allgemein", "Mietvertrag", "Versicherung", "Handwerker", "Steuer", "Aufgabe"];

export default async function NeueNotizPage({ searchParams }: { searchParams: { prop?: string; back?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  const properties = (data ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/notizen";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Notiz hinzufügen</div></div>
        </div>
      </div>

      <form action={createNotiz} className="form-box">
        <h3>📁 Notiz hinzufügen</h3>
        <p>Wichtige Infos, Dokumente oder Aufgaben vermerken.</p>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Titel *</label><input type="text" name="titel" placeholder="z.B. Mietvertrag Laufzeit" required /></div>
          <div className="form-group"><label>Immobilie</label>
            <select name="prop_id" defaultValue={searchParams.prop ?? ""}>
              <option value="">– Allgemein –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Kategorie</label>
            <select name="kategorie" defaultValue="Allgemein">{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Inhalt</label><textarea name="inhalt" rows={4} placeholder="Notiz, wichtige Daten, To-Dos..." style={{ resize: "vertical" }} /></div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <button type="submit" className="btn btn-gold">Speichern</button>
        </div>
      </form>
    </div>
  );
}
