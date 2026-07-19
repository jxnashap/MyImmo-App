import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { createKosten } from "@/lib/actions/buchungen";
import type { Property, Tenant } from "@/lib/types";

const KATEGORIEN = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

export default async function NeueKostenPage({ searchParams }: { searchParams: { prop?: string; back?: string } }) {
  const supabase = createClient();
  const [{ data: props }, { data: miet }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname,prop_id").order("nachname"),
  ]);
  const properties = (props ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname" | "prop_id">[];
  const back = searchParams.back || "/kosten";
  const heute = new Date().toISOString().slice(0, 10);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Ausgabe erfassen</div></div>
        </div>
      </div>

      <form action={createKosten} className="form-box">
        <h3>Ausgabe erfassen</h3>
        <p>Kosten für Reparaturen, Verwaltung, Versicherungen etc.</p>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Datum *</label><input type="date" name="buchungsdatum" required defaultValue={heute} /></div>
          <div className="form-group"><label>Immobilie *</label>
            <select name="prop_id" defaultValue={searchParams.prop ?? ""} required>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Kategorie</label>
            <select name="kategorie" defaultValue="Reparatur">{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <div className="form-group"><label>Betrag (€) *</label><input type="number" step="0.01" min="0.01" name="betrag" placeholder="350" required /></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Mieter zuordnen (optional)</label>
            <select name="mieter_id" defaultValue="">
              <option value="">– Kein Mieter –</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim()}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Beschreibung</label><input type="text" name="beschreibung" placeholder="z.B. Heizung repariert" /></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Rechnung / Beleg (optional · PDF/Bild · max. 15 MB)</label><input type="file" name="rechnung" accept="application/pdf,image/*" /></div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
