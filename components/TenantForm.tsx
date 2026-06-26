import type { Tenant, Property } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";

const KAUTION_STATUS = [
  { v: "nein", label: "⚠️ Ausstehend" },
  { v: "teilweise", label: "Teilweise" },
  { v: "ja", label: "✓ Vollständig" },
];
const MIETART = [
  { v: "standard", label: "Standard" },
  { v: "staffel", label: "Staffelmiete" },
  { v: "index", label: "Indexmiete" },
];

export default function TenantForm({
  action,
  tenant,
  properties,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  tenant?: Tenant;
  properties: Pick<Property, "id" | "bezeichnung">[];
  submitLabel: string;
}) {
  const v = (k: keyof Tenant) => (tenant?.[k] as string | number | null) ?? "";

  return (
    <form action={action} className="form-box" style={{ maxWidth: 640 }}>
      <h3>{tenant ? "Mieter bearbeiten" : "Mieter erfassen"}</h3>
      <p>Mietvertrag, Fristen, Kaution und Einheit.</p>

      <div className="form-section-label">Person</div>
      <div className="form-row">
        <div className="form-group"><label>Vorname *</label><input name="vorname" required defaultValue={v("vorname")} /></div>
        <div className="form-group"><label>Nachname *</label><input name="nachname" required defaultValue={v("nachname")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>E-Mail</label><input type="email" name="email" defaultValue={v("email")} /></div>
        <div className="form-group"><label>Telefon</label><input name="telefon" defaultValue={v("telefon")} /></div>
      </div>
      <div className="form-row single">
        <div className="form-group"><label>Adresse des Mieters</label><input name="mieter_adresse" defaultValue={v("mieter_adresse")} /></div>
      </div>

      <div className="form-section-label">Mietverhältnis</div>
      <div className="form-row">
        <div className="form-group"><label>Objekt</label>
          <select name="prop_id" defaultValue={tenant?.prop_id ?? ""}>
            <option value="">— kein Objekt —</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Einheit (z.B. EG links)</label><input name="einheit" defaultValue={v("einheit")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Mietbeginn</label><input type="date" name="mietbeginn" defaultValue={v("mietbeginn")} /></div>
        <div className="form-group"><label>Mietende</label><input type="date" name="mietende" defaultValue={v("mietende")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Kündigungsfrist (Monate)</label><input type="number" name="kuendigung" defaultValue={v("kuendigung")} placeholder="3" /></div>
        <div className="form-group"><label>Wohnfläche (m²)</label><input type="number" step="0.01" name="flaeche" defaultValue={v("flaeche")} /></div>
      </div>

      <div className="form-section-label">Miete &amp; Kaution</div>
      <div className="form-row">
        <div className="form-group"><label>Kaltmiete (€)</label><input type="number" step="0.01" name="kaltmiete" defaultValue={v("kaltmiete")} /></div>
        <div className="form-group"><label>NK-Vorauszahlung (€)</label><input type="number" step="0.01" name="nk_vorauszahlung" defaultValue={v("nk_vorauszahlung")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Kaution (€)</label><input type="number" step="0.01" name="kaution" defaultValue={v("kaution")} /></div>
        <div className="form-group"><label>Kaution-Status</label>
          <select name="kaution_status" defaultValue={(tenant?.kaution_status as string) || "nein"}>{KAUTION_STATUS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select>
        </div>
      </div>

      <div className="form-section-label">Mieterhöhung</div>
      <div className="form-row">
        <div className="form-group"><label>Mietart</label>
          <select name="mietart" defaultValue={(tenant?.mietart as string) || "standard"}>{MIETART.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select>
        </div>
        <div className="form-group"><label>Letzte Mieterhöhung</label><input type="date" name="letzte_erhoehung" defaultValue={v("letzte_erhoehung")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Nächste Erhöhung (Staffel/Index)</label><input type="date" name="staffel_datum" defaultValue={v("staffel_datum")} /></div>
        <div className="form-group"><label>Erhöhungsbetrag (€)</label><input type="number" step="0.01" name="staffel_betrag" defaultValue={v("staffel_betrag")} /></div>
      </div>
      <div className="form-row single">
        <div className="form-group"><label>Intervall (Monate)</label><input name="staffel_intervall" defaultValue={v("staffel_intervall")} placeholder="12" /></div>
      </div>

      <div className="form-row single">
        <div className="form-group"><label>Notiz</label><textarea name="notiz" rows={3} defaultValue={v("notiz")} style={{ resize: "vertical" }} />
          <small style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, display: "block" }}>
            ⚠️ Bitte keine besonderen Kategorien personenbezogener Daten erfassen
            (z.&nbsp;B. Gesundheit, Religion, Herkunft, Gewerkschaft) — Art.&nbsp;9 DSGVO.
          </small>
        </div>
      </div>

      <div className="form-actions">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
