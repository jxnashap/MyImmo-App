import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { createKredit } from "@/lib/actions/buchungen";
import type { Property } from "@/lib/types";

const SONDER = ["", "5% p.a.", "10% p.a.", "Nein", "Ja, unbegrenzt"];

export default async function NeuerKreditPage({ searchParams }: { searchParams: { prop?: string; back?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  const properties = (data ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/kredite";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Darlehen erfassen</div></div>
        </div>
      </div>

      <form action={createKredit} className="form-box" style={{ maxWidth: 640 }}>
        <h3>🏦 Darlehen erfassen</h3>
        <p>Immobiliendarlehen mit allen Finanzierungsdetails.</p>
        <input type="hidden" name="back" value={back} />

        <div className="form-section-label">Grunddaten</div>
        <div className="form-row">
          <div className="form-group"><label>Bezeichnung *</label><input type="text" name="bezeichnung" placeholder="z.B. Hypothek Volksbank" required /></div>
          <div className="form-group"><label>Immobilie</label>
            <select name="prop_id" defaultValue={searchParams.prop ?? ""}>
              <option value="">– wählen –</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Bank / Gläubiger</label><input type="text" name="bank" placeholder="Volksbank Hamburg" /></div>
          <div className="form-group"><label>Darlehensnummer</label><input type="text" name="darlnr" placeholder="1234567890" /></div>
        </div>

        <div className="form-section-label">Beträge</div>
        <div className="form-row">
          <div className="form-group"><label>Urspr. Darlehenssumme (€) *</label><input type="number" step="0.01" name="betrag" placeholder="200000" required /></div>
          <div className="form-group"><label>Aktuelle Restschuld (€)</label><input type="number" step="0.01" name="restschuld" placeholder="180000" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Grundschuld (€)</label><input type="number" step="0.01" name="grundschuld" placeholder="220000" /></div>
          <div className="form-group"><label>Beleihungsauslauf (%)</label><input type="number" step="0.1" name="beleihung" placeholder="70" /></div>
        </div>

        <div className="form-section-label">Konditionen</div>
        <div className="form-row">
          <div className="form-group"><label>Zinssatz (% p.a.)</label><input type="number" step="0.01" name="zinssatz" placeholder="3.5" /></div>
          <div className="form-group"><label>Tilgungssatz (% p.a.)</label><input type="number" step="0.01" name="tilgungssatz" placeholder="2.0" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Monatliche Rate (€)</label><input type="number" step="0.01" name="monatsrate" placeholder="850" /></div>
          <div className="form-group"><label>Sondertilgung möglich</label>
            <select name="sonder" defaultValue="">{SONDER.map((s) => <option key={s} value={s}>{s || "Nicht bekannt"}</option>)}</select>
          </div>
        </div>

        <div className="form-section-label">Laufzeit &amp; Zinsbindung</div>
        <div className="form-row">
          <div className="form-group"><label>Zinsbindung bis</label><input type="date" name="zinsbindung" /></div>
          <div className="form-group"><label>Gesamtlaufzeit bis (Jahr)</label><input type="number" name="laufzeit" placeholder="2042" /></div>
        </div>

        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
