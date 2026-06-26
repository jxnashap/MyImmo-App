import type { Property } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";

const TYPEN = ["Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Ferienimmobilie", "Grundstück"];
const STATUS = ["Vermietet", "Selbst bewohnt", "Leer", "Feriennutzung"];

export default function PropertyForm({
  action,
  property,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  property?: Property;
  submitLabel: string;
}) {
  const v = (k: keyof Property) => (property?.[k] as string | number | null) ?? "";

  return (
    <form action={action} className="form-box" style={{ maxWidth: 640 }}>
      <h3>{property ? "Immobilie bearbeiten" : "Immobilie erfassen"}</h3>
      <p>{property ? "Objektdaten aktualisieren." : "Neues Objekt zum Portfolio hinzufügen."}</p>

      <div className="form-row">
        <div className="form-group"><label>Name *</label><input type="text" name="bezeichnung" required defaultValue={v("bezeichnung")} placeholder="z.B. Wohnung Hamburg-Altona" /></div>
        <div className="form-group"><label>Typ</label>
          <select name="typ" defaultValue={(property?.typ as string) || "Eigentumswohnung"}>{TYPEN.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
      </div>
      <div className="form-row single">
        <div className="form-group"><label>Adresse</label><input type="text" name="adresse" defaultValue={v("adresse")} placeholder="Straße, PLZ, Ort" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Kaufpreis (€)</label><input type="number" step="0.01" name="kaufpreis" defaultValue={v("kaufpreis")} placeholder="250000" /></div>
        <div className="form-group"><label>Aktueller Wert (€)</label><input type="number" step="0.01" name="wert" defaultValue={v("wert")} placeholder="280000" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Wohnfläche (m²)</label><input type="number" step="0.01" name="flaeche" defaultValue={v("flaeche")} placeholder="75" /></div>
        <div className="form-group"><label>Baujahr</label><input type="number" name="baujahr" defaultValue={v("baujahr")} placeholder="1985" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Kaltmiete / Mo. (€)</label><input type="number" step="0.01" name="miete" defaultValue={v("miete")} placeholder="1200" /></div>
        <div className="form-group"><label>Status</label>
          <select name="obj_status" defaultValue={(property?.obj_status as string) || "Vermietet"}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Hausgeld / Mo. (€)</label><input type="number" step="0.01" name="hausgeld" defaultValue={v("hausgeld")} placeholder="250" /></div>
        <div className="form-group"><label>Zimmer</label><input type="number" step="0.5" name="zimmer" defaultValue={v("zimmer")} placeholder="3" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Energieklasse</label><input type="text" name="energieklasse" defaultValue={v("energieklasse")} placeholder="z.B. B" /></div>
        <div className="form-group" />
      </div>

      <div className="form-actions">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
