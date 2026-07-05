"use client";

// Immobilien-Formular: zeigt je nach gewählter Immobilienart nur die passenden
// Felder, benennt sie um und setzt sinnvolle Vorgaben. Nicht gerenderte Felder
// werden serverseitig als null gespeichert (parse() liest jedes Feld einzeln) —
// die Speicher-Action bleibt unverändert.
//
// AfA-Hinweis (§ 7 EStG, ohne Gewähr, keine Steuerberatung): Grundstücke sind
// nicht abschreibbar → AfA-Block ausgeblendet und über versteckte Felder auf 0
// gesetzt. Gebäude (inkl. Garagen) sind abschreibbar; die auto-Methode deckt
// Wohngebäude nach Baujahr ab.

import { useState } from "react";
import type { Property } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";

const TYPEN = [
  "Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbeimmobilie",
  "Ferienimmobilie", "Grundstück", "Garage / Stellplatz", "Garagenkomplex",
];
const STATUS = ["Vermietet", "Selbst bewohnt", "Leer", "Feriennutzung"];

const AFA_METHODEN = [
  { v: "auto", l: "Automatisch (linear, je Baujahr)" },
  { v: "degressiv", l: "Degressiv 5 % (Neubau 10/2023–09/2029)" },
  { v: "manuell", l: "Manueller Betrag (§ 7b / Denkmal)" },
];

// Feld-Konfiguration je Immobilienart: Sichtbarkeit, Labels und Vorgaben.
type TypConfig = {
  flaeche: string;                 // Label für das flaeche-Feld
  flaecheHinweis?: string;         // z. B. "(optional)"
  einheiten: string | false;      // Label für einheiten_anzahl (false = ausblenden)
  baujahr: boolean;
  miete: boolean;
  hausgeld: boolean;
  zimmer: boolean;
  energie: boolean;               // Energieklasse + Energieausweis
  afa: boolean;                   // AfA-Block (false = Grundstück, keine AfA)
  status: string;                 // Vorgabe-Status
  gebHinweis?: string;            // typ-spezifischer Hinweis zum Gebäudeanteil
};

const CONFIG: Record<string, TypConfig> = {
  Eigentumswohnung: { flaeche: "Wohnfläche (m²)", einheiten: false, baujahr: true, miete: true, hausgeld: true, zimmer: true, energie: true, afa: true, status: "Vermietet", gebHinweis: "Bei Eigentumswohnungen oft 70–75 % (Grund- und Gemeinschaftsanteil) — Feld editierbar." },
  Einfamilienhaus: { flaeche: "Wohnfläche (m²)", einheiten: false, baujahr: true, miete: true, hausgeld: false, zimmer: true, energie: true, afa: true, status: "Vermietet" },
  Mehrfamilienhaus: { flaeche: "Wohnfläche (m²)", einheiten: "Anzahl Einheiten", baujahr: true, miete: true, hausgeld: false, zimmer: false, energie: true, afa: true, status: "Vermietet" },
  Gewerbeimmobilie: { flaeche: "Nutzfläche (m²)", einheiten: "Anzahl Einheiten (optional)", baujahr: true, miete: true, hausgeld: false, zimmer: false, energie: true, afa: true, status: "Vermietet" },
  Ferienimmobilie: { flaeche: "Wohnfläche (m²)", einheiten: false, baujahr: true, miete: true, hausgeld: true, zimmer: true, energie: true, afa: true, status: "Feriennutzung" },
  Grundstück: { flaeche: "Grundstücksfläche (m²)", einheiten: false, baujahr: false, miete: false, hausgeld: false, zimmer: false, energie: false, afa: false, status: "Leer" },
  "Garage / Stellplatz": { flaeche: "Nutzfläche (m²)", einheiten: false, baujahr: true, miete: true, hausgeld: true, zimmer: false, energie: false, afa: true, status: "Vermietet" },
  Garagenkomplex: { flaeche: "Grundstücks-/Nutzfläche (m²)", flaecheHinweis: "(optional)", einheiten: "Anzahl Garagen/Stellplätze", baujahr: true, miete: true, hausgeld: false, zimmer: false, energie: false, afa: true, status: "Vermietet" },
};

const fallback = CONFIG.Eigentumswohnung;

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

  const initialTyp = (property?.typ as string) || "Eigentumswohnung";
  const [typ, setTyp] = useState(initialTyp);
  // Status ist kontrolliert, damit die Vorgabe bei Typwechsel (nur Neuanlage) mitzieht.
  const [status, setStatus] = useState((property?.obj_status as string) || (CONFIG[initialTyp] ?? fallback).status);

  const cfg = CONFIG[typ] ?? fallback;

  const onTypChange = (neu: string) => {
    setTyp(neu);
    if (!property) setStatus((CONFIG[neu] ?? fallback).status); // Neuanlage: Status-Vorgabe übernehmen
  };

  return (
    <form action={action} className="form-box" style={{ maxWidth: 640 }}>
      <h3>{property ? "Immobilie bearbeiten" : "Immobilie erfassen"}</h3>
      <p>{property ? "Objektdaten aktualisieren." : "Neues Objekt zum Portfolio hinzufügen."}</p>

      <div className="form-row">
        <div className="form-group"><label>Name *</label><input type="text" name="bezeichnung" required defaultValue={v("bezeichnung")} placeholder="z.B. Wohnung Hamburg-Altona" /></div>
        <div className="form-group"><label>Typ</label>
          <select name="typ" value={typ} onChange={(e) => onTypChange(e.target.value)}>{TYPEN.map((t) => <option key={t}>{t}</option>)}</select>
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
        <div className="form-group">
          <label>{cfg.flaeche}{cfg.flaecheHinweis ? ` ${cfg.flaecheHinweis}` : ""}</label>
          <input type="number" step="0.01" name="flaeche" defaultValue={v("flaeche")} placeholder="75" />
        </div>
        {cfg.einheiten && (
          <div className="form-group"><label>{cfg.einheiten}</label><input type="number" name="einheiten_anzahl" defaultValue={v("einheiten_anzahl")} placeholder="z. B. 8" /></div>
        )}
        {cfg.baujahr && (
          <div className="form-group"><label>Baujahr</label><input type="number" name="baujahr" defaultValue={v("baujahr")} placeholder="1985" /></div>
        )}
      </div>

      <div className="form-row">
        {cfg.miete && (
          <div className="form-group"><label>Kaltmiete / Mo. (€)</label><input type="number" step="0.01" name="miete" defaultValue={v("miete")} placeholder="1200" /></div>
        )}
        <div className="form-group"><label>Status</label>
          <select name="obj_status" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>

      {(cfg.hausgeld || cfg.zimmer) && (
        <div className="form-row">
          {cfg.hausgeld && (
            <div className="form-group"><label>Hausgeld / Mo. (€)</label><input type="number" step="0.01" name="hausgeld" defaultValue={v("hausgeld")} placeholder="250" /></div>
          )}
          {cfg.zimmer && (
            <div className="form-group"><label>Zimmer</label><input type="number" step="0.5" name="zimmer" defaultValue={v("zimmer")} placeholder="3" /></div>
          )}
        </div>
      )}

      {cfg.energie && (
        <div className="form-row">
          <div className="form-group"><label>Energieklasse</label><input type="text" name="energieklasse" defaultValue={v("energieklasse")} placeholder="z.B. B" /></div>
          <div className="form-group">
            <label>Energieausweis ausgestellt am</label>
            <input type="date" name="energieausweis_datum" defaultValue={v("energieausweis_datum")} />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              10 Jahre gültig (§ 79 GEG) — Erinnerung erscheint automatisch im Kalender.</span>
          </div>
        </div>
      )}

      {/* AfA-Einstellung je Objekt (Anlage V) */}
      {cfg.afa ? (
        <>
          <div className="form-row">
            <div className="form-group"><label>AfA-Methode</label>
              <select name="afa_methode" defaultValue={(property?.afa_methode as string) || "auto"}>
                {AFA_METHODEN.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Gebäudeanteil (%) — optional</label>
              <input type="number" step="1" name="afa_gebaeudeanteil" defaultValue={v("afa_gebaeudeanteil")} placeholder="Standard 80" />
              {cfg.gebHinweis && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>{cfg.gebHinweis}</span>
              )}
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
            {typ === "Gewerbeimmobilie"
              ? "Gewerbe im Privatvermögen i. d. R. 2 % linear — ggf. „Manueller Betrag“ wählen. "
              : ""}
            Degressiv nur für neue Wohngebäude, Baubeginn/Kauf 10/2023–09/2029. Faustformel ohne Gewähr, keine Steuerberatung.
          </p>
        </>
      ) : (
        // Grundstück: nicht abschreibbar → AfA fest auf 0 (ohne Server-Änderung).
        <>
          <input type="hidden" name="afa_methode" value="manuell" />
          <input type="hidden" name="afa_betrag" value="0" />
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
            Grundstücke sind steuerlich nicht abschreibbar (§ 7 EStG) — keine AfA. Ohne Gewähr, keine Steuerberatung.
          </p>
        </>
      )}

      <div className="form-actions">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
