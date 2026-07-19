import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { createEinnahme } from "@/lib/actions/buchungen";
import type { Property, Tenant } from "@/lib/types";

const KATEGORIEN = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"];

export default async function NeueEinnahmePage({ searchParams }: { searchParams: { prop?: string; back?: string } }) {
  const supabase = createClient();
  const [{ data }, { data: miet }] = await Promise.all([
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);
  const properties = (data ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];
  const back = searchParams.back || "/einnahmen";
  const heute = new Date().toISOString().slice(0, 10);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Einnahme erfassen</div></div>
        </div>
      </div>

      <form action={createEinnahme} className="form-box">
        <h3>Einnahme erfassen</h3>
        <p>Mietzahlungen, Kautionen oder sonstige Erträge.</p>
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
            <select name="kategorie" defaultValue="Miete">{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <div className="form-group"><label>Betrag (€) *</label><input type="number" step="0.01" min="0.01" name="betrag" placeholder="1200" required /></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Mieter zuordnen (optional)</label>
            <select name="mieter_id" defaultValue="">
              <option value="">– Kein Mieter –</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim() || "—"}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Beschreibung</label><input type="text" name="beschreibung" placeholder="z.B. Miete August 2025" /></div>
        </div>
        <div className="form-row single">
          <div className="form-group">
            <label>davon Nebenkosten-Vorauszahlung (€)</label>
            <input type="number" step="0.01" min="0" name="nk_anteil" placeholder="z.B. 160" />
            <small style={{ color: "var(--muted)" }}>In „Miete“ enthalten – erscheint in der Anlage V als Umlagen (Zeile 13).</small>
          </div>
        </div>
        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
