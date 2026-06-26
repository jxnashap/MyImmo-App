import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateKosten } from "@/lib/actions/buchungen";
import type { Property, Tenant, Kosten } from "@/lib/types";

const KATEGORIEN = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];

export default async function KostenEditPage({ params, searchParams }: { params: { id: string }; searchParams: { back?: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }, { data: miet }] = await Promise.all([
    supabase.from("kosten").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase.from("mieter").select("id,vorname,nachname").order("nachname"),
  ]);
  if (!row) notFound();
  const k = row as Kosten;
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const tenants = (miet ?? []) as Pick<Tenant, "id" | "vorname" | "nachname">[];
  const back = searchParams.back || "/kosten";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Ausgabe bearbeiten</div></div>
        </div>
      </div>

      <form action={updateKosten.bind(null, k.id)} className="form-box">
        <h3>Ausgabe bearbeiten</h3>
        <input type="hidden" name="back" value={back} />
        <div className="form-row">
          <div className="form-group"><label>Datum *</label><input type="date" name="buchungsdatum" defaultValue={k.buchungsdatum ?? ""} required /></div>
          <div className="form-group"><label>Immobilie *</label>
            <select name="prop_id" defaultValue={k.prop_id ?? ""} required>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Kategorie</label>
            <select name="kategorie" defaultValue={k.kategorie ?? "Reparatur"}>{KATEGORIEN.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="form-group"><label>Betrag (€) *</label><input type="number" step="0.01" min="0.01" name="betrag" defaultValue={k.betrag ?? ""} required /></div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Mieter zuordnen (optional)</label>
            <select name="mieter_id" defaultValue={k.mieter_id ?? ""}>
              <option value="">– Kein Mieter –</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{`${t.vorname ?? ""} ${t.nachname ?? ""}`.trim()}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group"><label>Beschreibung</label><input type="text" name="beschreibung" defaultValue={k.beschreibung ?? ""} /></div>
        </div>
        <div className="form-row single">
          <div className="form-group">
            <label>Rechnung / Beleg {k.rechnung_name ? "ersetzen" : "(optional · PDF/Bild · max. 6 MB)"}</label>
            {k.rechnung_name && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                Aktuell: <a href={`/kosten/${k.id}/rechnung`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>{k.rechnung_name}</a>
                {k.rechnung_size ? ` · ${k.rechnung_size}` : ""} — neue Datei wählen zum Ersetzen.
              </div>
            )}
            <input type="file" name="rechnung" accept="application/pdf,image/*" />
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
