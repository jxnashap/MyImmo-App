import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateKredit } from "@/lib/actions/buchungen";
import { decryptKreditRow } from "@/lib/kreditData";
import type { Property, Kredit } from "@/lib/types";

const SONDER = ["", "5% p.a.", "10% p.a.", "Nein", "Ja, unbegrenzt"];

export default async function KreditEditPage({ params, searchParams }: { params: { id: string }; searchParams: { back?: string } }) {
  const supabase = createClient();
  const [{ data: row }, { data: propsData }] = await Promise.all([
    supabase.from("kredite").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
  ]);
  if (!row) notFound();
  const k = decryptKreditRow(row as Kredit);
  const properties = (propsData ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/kredite";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Darlehen bearbeiten</div></div>
        </div>
      </div>

      <form action={updateKredit.bind(null, k.id)} className="form-box" style={{ maxWidth: 640 }}>
        <h3>Darlehen bearbeiten</h3>
        <input type="hidden" name="back" value={back} />

        <div className="form-section-label">Grunddaten</div>
        <div className="form-row">
          <div className="form-group"><label>Bezeichnung *</label><input type="text" name="bezeichnung" defaultValue={k.bezeichnung ?? ""} required /></div>
          <div className="form-group"><label>Immobilie</label>
            <select name="prop_id" defaultValue={k.prop_id ?? ""}>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Bank / Gläubiger</label><input type="text" name="bank" defaultValue={k.bank ?? ""} /></div>
          <div className="form-group"><label>Darlehensnummer</label><input type="text" name="darlnr" defaultValue={k.darlnr ?? ""} /></div>
        </div>

        <div className="form-section-label">Beträge</div>
        <div className="form-row">
          <div className="form-group"><label>Urspr. Darlehenssumme (€) *</label><input type="number" step="0.01" name="betrag" defaultValue={k.betrag ?? ""} required /></div>
          <div className="form-group"><label>Aktuelle Restschuld (€)</label><input type="number" step="0.01" name="restschuld" defaultValue={k.restschuld ?? ""} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Grundschuld (€)</label><input type="number" step="0.01" name="grundschuld" defaultValue={k.grundschuld ?? ""} /></div>
          <div className="form-group"><label>Beleihungsauslauf (%)</label><input type="number" step="0.1" name="beleihung" defaultValue={k.beleihung ?? ""} /></div>
        </div>

        <div className="form-section-label">Konditionen</div>
        <div className="form-row">
          <div className="form-group"><label>Zinssatz (% p.a.)</label><input type="number" step="0.01" name="zinssatz" defaultValue={k.zinssatz ?? ""} /></div>
          <div className="form-group"><label>Tilgungssatz (% p.a.)</label><input type="number" step="0.01" name="tilgungssatz" defaultValue={k.tilgungssatz ?? ""} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Monatliche Rate (€)</label><input type="number" step="0.01" name="monatsrate" defaultValue={k.monatsrate ?? ""} /></div>
          <div className="form-group"><label>Sondertilgung möglich</label>
            <select name="sonder" defaultValue={k.sonder ?? ""}>
              {SONDER.map((s) => <option key={s} value={s}>{s || "Nicht bekannt"}</option>)}
            </select>
          </div>
        </div>

        <div className="form-section-label">Laufzeit &amp; Zinsbindung</div>
        <div className="form-row">
          <div className="form-group">
            <label>Vollständige Auszahlung am</label>
            <input type="date" name="auszahlung_datum" defaultValue={k.auszahlung_datum ?? ""} />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Start für das Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB).</span>
          </div>
          <div className="form-group"><label>Zinsbindung bis</label><input type="date" name="zinsbindung" defaultValue={k.zinsbindung ?? ""} /></div>
          <div className="form-group"><label>Gesamtlaufzeit bis (Jahr)</label><input type="number" name="laufzeit" defaultValue={k.laufzeit ?? ""} /></div>
        </div>

        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
