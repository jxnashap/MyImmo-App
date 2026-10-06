import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { createKredit } from "@/lib/actions/buchungen";
import type { Property } from "@/lib/types";
import { darlehenVorbelegung } from "@/lib/kauf/darlehenUebergabe";

const SONDER = ["", "5% p.a.", "10% p.a.", "Nein", "Ja, unbegrenzt"];

export default async function NeuerKreditPage(props: { searchParams: Promise<{ prop?: string; back?: string; betrag?: string; zins?: string; tilgung?: string; rate?: string; bindung?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  const properties = (data ?? []) as Pick<Property, "id" | "bezeichnung">[];
  const back = searchParams.back || "/kredite";
  // Paket E (06.10.2026): Finanzierungswunsch aus BuyImmo als Vorgabe (lib/kauf/darlehenUebergabe.ts).
  const vb = darlehenVorbelegung(searchParams);
  const ausWunsch = vb.betrag != null;
  const eur = (n: number) => Math.round(n).toLocaleString("de-DE") + " €";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div><div className="topbar-title">Darlehen erfassen</div></div>
        </div>
      </div>

      <form action={createKredit} className="form-box" style={{ maxWidth: 640 }}>
        <h3>Darlehen erfassen</h3>
        <p>Immobiliendarlehen mit allen Finanzierungsdetails.</p>
        <input type="hidden" name="back" value={back} />
        {ausWunsch && (
          <div className="vorbelegt-hinweis">
            Vorbelegt aus deinem Finanzierungswunsch (Beispielrechnung). Trag die Werte aus dem Darlehensvertrag ein —
            vor allem die Monatsrate und das Ende der Zinsbindung.
          </div>
        )}

        <div className="form-section-label">Grunddaten</div>
        <div className="form-row">
          <div className="form-group"><label>Bezeichnung *</label><input type="text" name="bezeichnung" placeholder="z. B. Hypothek Volksbank" required /></div>
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
          <div className="form-group"><label>Urspr. Darlehenssumme (€) *</label><input type="number" step="0.01" name="betrag" placeholder="200000" required defaultValue={vb.betrag ?? undefined} /></div>
          <div className="form-group"><label>Aktuelle Restschuld (€)</label><input type="number" step="0.01" name="restschuld" placeholder="180000" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Grundschuld (€)</label><input type="number" step="0.01" name="grundschuld" placeholder="220000" /></div>
          <div className="form-group"><label>Beleihungsauslauf laut Bank (%)</label><input type="number" step="0.1" name="beleihung" placeholder="70" /><span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>Nur zum Nachschlagen. MyImmo rechnet den Auslauf je Objekt selbst aus Restschuld und Wert (Übersicht unter Kredite).</span></div>
        </div>

        <div className="form-section-label">Konditionen</div>
        <div className="form-row">
          <div className="form-group"><label>Zinssatz (% p.a.)</label><input type="number" step="0.01" name="zinssatz" placeholder="3.5" defaultValue={vb.zinssatz ?? undefined} /></div>
          <div className="form-group"><label>Tilgungssatz (% p.a.)</label><input type="number" step="0.01" name="tilgungssatz" placeholder="2.0" defaultValue={vb.tilgungssatz ?? undefined} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Monatliche Rate (€) — laut Darlehensvertrag</label><input type="number" step="0.01" min="0.01" name="monatsrate" placeholder="850" required />{vb.rateWunsch != null && <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>Beispielrechnung im Wunsch: ca. {eur(vb.rateWunsch)}. Bitte die Rate aus dem Vertrag eintragen.</span>}</div>
          <div className="form-group"><label>Sondertilgung möglich</label>
            <select name="sonder" defaultValue="">{SONDER.map((s) => <option key={s} value={s}>{s || "Nicht bekannt"}</option>)}</select>
          </div>
        </div>

        <div className="form-section-label">Laufzeit &amp; Zinsbindung</div>
        <div className="form-row">
          <div className="form-group">
            <label>Vollständige Auszahlung am</label>
            <input type="date" name="auszahlung_datum" />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Start für das Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB).</span>
          </div>
          <div className="form-group" />
        </div>
        <div className="form-row">
          <div className="form-group"><label>Zinsbindung bis</label><input type="date" name="zinsbindung" />{vb.bindungJahre != null && <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>Gewünscht: {vb.bindungJahre} Jahre ab Auszahlung.</span>}</div>
          <div className="form-group"><label>Gesamtlaufzeit (Jahre)</label><input type="number" name="laufzeit" placeholder="30" min="1" max="60" /></div>
        </div>

        <div className="form-actions">
          <Link href={back} className="btn btn-ghost">Abbrechen</Link>
          <SubmitButton>Speichern</SubmitButton>
        </div>
      </form>
    </div>
  );
}
