import type { Property } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";

const TYPEN = ["Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie", "Ferienimmobilie", "Grundstück", "Garage / Stellplatz", "Garagenkomplex"];
const STATUS = ["Vermietet", "Selbst bewohnt", "Leer", "Feriennutzung"];

const AFA_METHODEN = [
  { v: "auto", l: "Automatisch (linear, je Baujahr)" },
  { v: "degressiv", l: "Degressiv 5 % (Neubau 10/2023–09/2029)" },
  { v: "manuell", l: "Manueller Betrag (§ 7b / Denkmal)" },
];

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
        <div className="form-group"><label>Anzahl Einheiten / Garagen (optional)</label><input type="number" name="einheiten_anzahl" defaultValue={v("einheiten_anzahl")} placeholder="z. B. 8" /></div>
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
        <div className="form-group">
          <label>Energieausweis ausgestellt am</label>
          <input type="date" name="energieausweis_datum" defaultValue={v("energieausweis_datum")} />
          <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
            10 Jahre gültig (§ 79 GEG) — Erinnerung erscheint automatisch im Kalender.</span>
        </div>
      </div>

      {/* AfA-Einstellung je Objekt (Anlage V) */}
      <div className="form-row">
        <div className="form-group"><label>AfA-Methode</label>
          <select name="afa_methode" defaultValue={(property?.afa_methode as string) || "auto"}>
            {AFA_METHODEN.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Gebäudeanteil (%) — optional</label>
          <input type="number" step="1" name="afa_gebaeudeanteil" defaultValue={v("afa_gebaeudeanteil")} placeholder="Standard 80" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Startjahr (nur degressiv)</label>
          <input type="number" name="afa_start_jahr" defaultValue={v("afa_start_jahr")} placeholder="= Baujahr" />
        </div>
        <div className="form-group"><label>Manueller AfA-Betrag (€/Jahr, nur „manuell")</label>
          <input type="number" step="0.01" name="afa_betrag" defaultValue={v("afa_betrag")} placeholder="z.B. 7500" />
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
        Degressiv nur für neue Wohngebäude, Baubeginn/Kauf 10/2023–09/2029. Faustformel ohne Gewähr, keine Steuerberatung.
      </p>

      <div className="form-actions">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
