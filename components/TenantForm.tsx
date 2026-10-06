"use client";
import { TriangleAlert } from "lucide-react";

import { useRef, useState } from "react";
import { mieterwechselVerdacht } from "@/lib/mieterZugang";
import { abWannFragen } from "@/lib/sollAb";
import { ymPlus } from "@/lib/mietkonto";
import type { Tenant, Property } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";

const KAUTION_STATUS = [
  { v: "nein", label: "Ausstehend" },
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
  propInitial = "",
  back,
  portalKonto = null,
}: {
  action: (formData: FormData) => void;
  tenant?: Tenant;
  properties: Pick<Property, "id" | "bezeichnung">[];
  submitLabel: string;
  propInitial?: string;
  /** Wohin nach dem Speichern zurueck (z. B. die Objektseite, von der man kam). */
  back?: string;
  /** E-Mail des verbundenen Portal-Kontos (S4: Rückfrage bei Mieterwechsel), sonst null. */
  portalKonto?: string | null;
}) {
  const [mietart, setMietart] = useState((tenant?.mietart as string) || "standard");
  const v = (k: keyof Tenant) => (tenant?.[k] as string | number | null) ?? "";

  // S4: Name oder Mietbeginn eines Mieters mit Portal-Konto geändert? Erst fragen —
  // sonst sähe der bisherige Mieter alles, was künftig für den neuen bestimmt ist.
  // Der Server setzt dieselbe Regel durch (lib/actions/tenants.ts).
  const formRef = useRef<HTMLFormElement>(null);
  const [entscheidung, setEntscheidung] = useState("");
  const [frage, setFrage] = useState(false);
  // Paket B (06.10.2026): Ändert sich die Miete eines laufenden Mietverhältnisses, fragen,
  // AB WANN — sonst rechnete das Mietkonto rückwirkend mit dem neuen Betrag. Der Server
  // setzt dieselbe Regel durch (lib/actions/tenants.ts, abWannFragen in lib/sollAb.ts).
  const [mieteAb, setMieteAb] = useState("");
  const [abFrage, setAbFrage] = useState(false);
  const [abMonat, setAbMonat] = useState("");
  const pruefeWechsel = (e: React.FormEvent<HTMLFormElement>) => {
    if (!tenant) return;
    const f = new FormData(e.currentTarget);
    const wert = (k: string) => (String(f.get(k) ?? "") || null);
    const alt = { vorname: tenant.vorname ?? null, nachname: tenant.nachname ?? null, mietbeginn: (tenant.mietbeginn as string | null) ?? null };
    if (portalKonto && !entscheidung && mieterwechselVerdacht(alt, { vorname: wert("vorname"), nachname: wert("nachname"), mietbeginn: wert("mietbeginn") })) {
      e.preventDefault();
      setFrage(true);
      return;
    }
    const zahl = (k: string) => (wert(k) == null ? null : Number(String(wert(k)).replace(",", ".")));
    const aktuell = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 7);
    if (!mieteAb && abWannFragen(
      wert("mietbeginn") ?? alt.mietbeginn,
      { kaltmiete: tenant.kaltmiete ?? null, nk_vorauszahlung: tenant.nk_vorauszahlung ?? null, stellplatz_miete: tenant.stellplatz_miete ?? null },
      { kaltmiete: zahl("kaltmiete"), nk_vorauszahlung: zahl("nk_vorauszahlung"), stellplatz_miete: zahl("stellplatz_miete") },
      aktuell,
    )) {
      e.preventDefault();
      setAbMonat(ymPlus(aktuell, 1));
      setAbFrage(true);
    }
  };
  const bestaetigeAb = (wahl: string) => {
    setMieteAb(wahl);
    setAbFrage(false);
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  };
  const entscheide = (wahl: "korrektur" | "trennen") => {
    setEntscheidung(wahl);
    setFrage(false);
    // Nach dem Rendern abschicken, damit das versteckte Feld den neuen Wert trägt.
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  return (
    <form ref={formRef} action={action} onSubmit={pruefeWechsel} className="form-box" style={{ maxWidth: 640 }}>
      {entscheidung && <input type="hidden" name="mieterwechsel" value={entscheidung} />}
      {mieteAb && <input type="hidden" name="miete_ab" value={mieteAb} />}
      {/* Rueckweg mitgeben, damit der Nutzer nach dem Speichern dort landet, wo
          er angefangen hat (z. B. auf der Objektseite) — nicht in der Liste. */}
      {back && <input type="hidden" name="back" value={back} />}
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
      <div className="form-row single">
        <div className="form-group">
          <label>Bankverbindung des Mieters (IBAN)</label>
          <input name="iban" defaultValue={tenant?.iban ?? ""} placeholder="DE.." style={{ textTransform: "uppercase" }} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Verschlüsselt gespeichert; erscheint im Erstattungs-Hinweis der NK-Abrechnung.
          </div>
        </div>
      </div>

      <div className="form-section-label">Mietverhältnis</div>
      <div className="form-row">
        <div className="form-group"><label>Objekt</label>
          <select name="prop_id" defaultValue={tenant?.prop_id ?? propInitial}>
            <option value="">— kein Objekt —</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Einheit (z. B. EG links)</label><input name="einheit" defaultValue={v("einheit")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Mietbeginn</label><input type="date" name="mietbeginn" defaultValue={v("mietbeginn")} /></div>
        <div className="form-group"><label>Mietende</label><input type="date" name="mietende" defaultValue={v("mietende")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Kündigungsfrist (Monate)</label><input type="number" name="kuendigung" defaultValue={tenant ? v("kuendigung") : "3"} placeholder="3" /></div>
        <div className="form-group"><label>Wohnfläche (m²)</label><input type="number" step="0.01" name="flaeche" defaultValue={v("flaeche")} /></div>
      </div>

      <div className="form-section-label">Miete &amp; Kaution</div>
      <div className="form-row">
        <div className="form-group"><label>Kaltmiete (€)</label><input type="number" step="0.01" name="kaltmiete" defaultValue={v("kaltmiete")} /><span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>Ändert sich der Betrag, fragt MyImmo beim Speichern, ab welchem Monat er gilt — frühere Monate bleiben, wie sie waren.</span></div>
        <div className="form-group"><label>NK-Vorauszahlung (€)</label><input type="number" step="0.01" name="nk_vorauszahlung" defaultValue={v("nk_vorauszahlung")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Stellplatz / Garage (Bezeichnung)</label>
          <input name="stellplatz" defaultValue={v("stellplatz")} placeholder="z. B. TG-Platz 12" /></div>
        <div className="form-group"><label>Stellplatz-Miete (€ / Mo.)</label>
          <input type="number" step="0.01" name="stellplatz_miete" defaultValue={v("stellplatz_miete")} /></div>
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
          <select name="mietart" value={mietart} onChange={(e) => setMietart(e.target.value)}>{MIETART.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select>
        </div>
        <div className="form-group"><label>Letzte Mieterhöhung</label><input type="date" name="letzte_erhoehung" defaultValue={v("letzte_erhoehung")} /></div>
      </div>
      {mietart === "staffel" && (
        <>
          <div className="form-row">
            <div className="form-group"><label>Nächste Erhöhung (erste Stufe)</label><input type="date" name="staffel_datum" defaultValue={v("staffel_datum")} /></div>
            <div className="form-group"><label>Erhöhungsbetrag (€)</label><input type="number" step="0.01" name="staffel_betrag" defaultValue={v("staffel_betrag")} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Intervall (Monate)</label><input name="staffel_intervall" defaultValue={v("staffel_intervall")} placeholder="12" /></div>
            <div className="form-group"><label>Staffel-Art</label>
              <select name="staffel_typ" defaultValue={(tenant?.staffel_typ as string) || "betrag"}>
                <option value="betrag">Fester Betrag</option>
                <option value="prozent">Prozent</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Erhöhung (%) je Stufe</label><input type="number" step="0.01" name="staffel_prozent" defaultValue={v("staffel_prozent")} placeholder="z. B. 3" /></div>
            <div className="form-group"><label>Anzahl Stufen (optional)</label><input type="number" name="staffel_stufen" defaultValue={v("staffel_stufen")} placeholder="5" /></div>
          </div>
          <div className="form-row single">
            <small style={{ color: "var(--muted)", fontSize: 12, display: "block", marginTop: -6 }}>
              Staffelmiete wird vertraglich in Euro-Beträgen vereinbart (§ 557a BGB); die
              Prozent-Angabe ist nur eine Rechenhilfe — angezeigt werden die konkreten Beträge.
            </small>
          </div>
        </>
      )}

      <div className="form-row single">
        <div className="form-group"><label>Notiz</label><textarea name="notiz" rows={3} defaultValue={v("notiz")} style={{ resize: "vertical" }} />
          <small style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, display: "block" }}>
            <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Bitte keine besonderen Kategorien personenbezogener Daten erfassen
            (z.&nbsp;B. Gesundheit, Religion, Herkunft, Gewerkschaft) — Art.&nbsp;9 DSGVO.
          </small>
        </div>
      </div>

      {frage && (
        <div role="alertdialog" aria-label="Neuer Mieter?" className="glass-card" style={{ padding: "14px 16px", margin: "8px 0 4px", borderLeft: "3px solid var(--amber)" }}>
          <strong style={{ fontSize: 13.5 }}>Ist das ein neuer Mieter?</strong>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px", lineHeight: 1.55 }}>
            Du hast Name oder Mietbeginn geändert. Mit diesem Mieter ist das Portal-Konto <strong>{portalKonto}</strong> verbunden.
            Ist es eine andere Person, sähe der bisherige Mieter sonst alles, was du künftig zustellst — dann den Zugang trennen
            und den neuen Mieter einladen (besser noch: den neuen Mieter als eigenen Eintrag anlegen).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-gold" onClick={() => entscheide("trennen")}>Neuer Mieter — Zugang trennen und speichern</button>
            <button type="button" className="btn btn-ghost" onClick={() => entscheide("korrektur")}>Gleiche Person, nur korrigiert</button>
            <button type="button" className="btn btn-ghost" onClick={() => setFrage(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {abFrage && (
        <div role="alertdialog" aria-label="Ab wann gilt die neue Miete?" className="glass-card" style={{ padding: "14px 16px", margin: "8px 0 4px", borderLeft: "3px solid var(--gold)" }}>
          <strong style={{ fontSize: 13.5 }}>Ab wann gilt der neue Betrag?</strong>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px", lineHeight: 1.55 }}>
            Du hast Kaltmiete, NK-Vorauszahlung oder Stellplatzmiete geändert. Die Monate davor rechnet das
            Mietkonto weiter mit dem bisherigen Betrag.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="month" aria-label="Gilt ab Monat" className="set-input" value={abMonat} onChange={(e) => setAbMonat(e.target.value)} style={{ width: "auto" }} />
            <button type="button" className="btn btn-gold" disabled={!/^\d{4}-\d{2}$/.test(abMonat)} onClick={() => bestaetigeAb(abMonat)}>Ab diesem Monat speichern</button>
            <button type="button" className="btn btn-ghost" onClick={() => bestaetigeAb("korrektur")}>Tippfehler — gilt seit Mietbeginn</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAbFrage(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="form-actions">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
