"use client";
import { zinsUndTilgung, getilgtProzent, restschuldVon, rateVon, istGetilgt } from "@/lib/kredit";
import { useState } from "react";
import { TriangleAlert, Landmark, ChevronRight } from "lucide-react";
import { euro, datum, zahl } from "@/lib/format";
import { getRefinanzWarning } from "@/lib/fristen";
import { updateKredit, deleteKredit } from "@/lib/actions/buchungen";
import RowDialog from "@/components/RowDialog";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import type { Kredit, Property } from "@/lib/types";
import { laufzeitText } from "@/lib/kreditLaufzeit";

const SONDER = ["", "5% p.a.", "10% p.a.", "Nein", "Ja, unbegrenzt"];

/** „2,5 %" — deutsch, bis zu zwei Nachkommastellen, geschütztes Leerzeichen vor %. */
const pz = (n: number) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })}\u00a0%`;

/** Kennzahlen eines Darlehens — EINE Lesart für alle Seiten (lib/kredit.ts, Audit 07.10.2026). */
function kennzahlen(k: Kredit) {
  const { zins, tilgung } = zinsUndTilgung(k);
  return { getilgt: getilgtProzent(k), moZins: zins, moTilg: tilgung };
}

/** Alle Felder eines Darlehens — oben im Dialog, damit die kompakte Zeile nichts verschluckt. */
function Details({ k }: { k: Kredit }) {
  const { getilgt, moZins, moTilg } = kennzahlen(k);
  const warn = getRefinanzWarning(k.zinsbindung);
  const feld = (lbl: string, val: React.ReactNode, farbe?: string) => (
    <div><div className="kredit-field-lbl">{lbl}</div><div className="kredit-field-val" style={farbe ? { color: farbe } : undefined}>{val}</div></div>
  );
  return (
    <div style={{ marginBottom: 18 }}>
      {warn && (
        <div style={{ background: warn.bg, borderLeft: `3px solid ${warn.color}`, padding: "8px 12px", fontSize: 12, color: warn.color, fontWeight: 500, borderRadius: 8, marginBottom: 12 }}>
          <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> Zinsbindung läuft ab: <strong>{datum(k.zinsbindung)}</strong>
        </div>
      )}
      <div className="kredit-grid" style={{ marginBottom: 12 }}>
        {feld("Urspr. Darlehen", euro(k.betrag))}
        {feld("Restschuld", k.restschuld == null ? `${euro(restschuldVon(k))} (= Darlehenssumme)` : euro(restschuldVon(k)))}
        {feld("Rate / Monat", istGetilgt(k) ? "getilgt" : euro(rateVon(k)))}
        {feld("Laufzeit", laufzeitText(k.laufzeit, k.auszahlung_datum))}
        {feld("Zinsen / Mo.", euro(moZins), "var(--muted)")}
        {feld("Tilgung / Mo.", euro(moTilg), "var(--green)")}
        {feld("Tilgungssatz", k.tilgungssatz ? `${pz(k.tilgungssatz)} p.a.` : "–")}
        {feld("Zinsbindung", k.zinsbindung ? datum(k.zinsbindung) : "–", warn?.color)}
        {feld("Grundschuld", k.grundschuld ? euro(k.grundschuld) : "–")}
        {feld("Beleihungsauslauf laut Bank", k.beleihung ? pz(k.beleihung) : "–")}
        {feld("Sondertilgung", k.sonder || "–")}
        {feld("Getilgt", getilgt != null ? pz(getilgt) : "–")}
      </div>
      {/* Ohne Auszahlungsdatum fehlt die Frist fürs Sonderkündigungsrecht
          (lib/fristen.ts, 10 Jahre nach Vollauszahlung) — und in den
          Terminen steht dazu nichts (30.09.2026: 6 von 8 echten Krediten). */}
      {!k.auszahlung_datum && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          <TriangleAlert size={12} style={{ verticalAlign: "-2px", color: "var(--amber)" }} /> Auszahlungsdatum fehlt — ohne es
          berechnet MyImmo weder das Laufzeitende noch die Frist fürs Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB).
        </p>
      )}
    </div>
  );
}

// Kredit-Liste (03.10.2026): EINE Zeile je Darlehen — Bezeichnung, Objekt · Bank · Zinsbindung,
// Tilgungsbalken, Restschuld und Rate. Ein Klick öffnet den Dialog mit allen Feldern und dem
// Bearbeiten-Formular (vorher: vier Karten mit je zwölf Feldern untereinander).
export default function KrediteListe({
  rows,
  properties,
}: {
  rows: Kredit[];
  properties: Pick<Property, "id" | "bezeichnung">[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = new Map(properties.map((p): [string, string] => [p.id, p.bezeichnung]));
  const offen = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="section">
        <div className="section-header">
          <div><h3>Darlehen</h3><div className="section-sub">{rows.length} Darlehen · Klick öffnet alle Angaben</div></div>
        </div>
        <div className="section-body listen">
          {rows.map((k) => {
            const { getilgt } = kennzahlen(k);
            const warn = getRefinanzWarning(k.zinsbindung);
            const sub = [
              (k.prop_id && nameOf.get(k.prop_id)) || "ohne Objekt",
              k.bank,
              k.zinsbindung ? `Zinsbindung bis ${datum(k.zinsbindung)}` : null,
            ].filter(Boolean).join(" · ");
            return (
              <button key={k.id} type="button" className="listen-zeile" onClick={() => setOpenId(k.id)}
                aria-label={`${k.bezeichnung || "Darlehen"} öffnen`}>
                <span className="listen-icon"><Landmark size={16} /></span>
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">
                    {k.bezeichnung || k.bank || "Darlehen"}
                    {k.zinssatz != null && <span style={{ fontWeight: 400, color: "var(--muted)" }}> · {zahl(k.zinssatz, 1)} %</span>}
                  </span>
                  <span className="listen-zeile-sub" style={warn ? { color: warn.color } : undefined}>{sub}</span>
                </span>
                {!k.auszahlung_datum && <span className="badge badge-amber listen-zeile-extra" title="Ohne Auszahlungsdatum fehlen Laufzeitende und Frist nach § 489 BGB">Auszahlung fehlt</span>}
                {/* Kein inline `display` an der Zusatzspalte — er schlüge die Handy-Regel, die sie ausblendet. */}
                {getilgt != null && (
                  <span className="listen-zeile-extra" title={`${getilgt} % getilgt`}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
                      <span className="mini-balken"><i style={{ width: `${getilgt}%` }} /></span>{getilgt} %
                    </span>
                  </span>
                )}
                <span className="listen-zeile-zahl"><b>{euro(restschuldVon(k))}</b><small>{istGetilgt(k) ? "getilgt" : `${euro(rateVon(k))} / Mo.`}</small></span>
                <ChevronRight size={16} color="var(--faint)" style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>

      {offen && (
        <RowDialog title={offen.bezeichnung || "Darlehen"} onClose={() => setOpenId(null)}>
          <Details k={offen} />
          <form action={updateKredit.bind(null, offen.id)} className="form-box" style={{ padding: 0, border: "none", background: "none", boxShadow: "none", maxWidth: "none" }}>
            <input type="hidden" name="back" value="/kredite" />

            <div className="form-section-label">Grunddaten</div>
            <div className="form-row">
              <div className="form-group"><label>Bezeichnung *</label><input type="text" name="bezeichnung" defaultValue={offen.bezeichnung ?? ""} required /></div>
              <div className="form-group"><label>Immobilie</label>
                <select name="prop_id" defaultValue={offen.prop_id ?? ""}>
                  <option value="">– wählen –</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Bank / Gläubiger</label><input type="text" name="bank" defaultValue={offen.bank ?? ""} /></div>
              <div className="form-group"><label>Darlehensnummer</label><input type="text" name="darlnr" defaultValue={offen.darlnr ?? ""} /></div>
            </div>

            <div className="form-section-label">Beträge</div>
            <div className="form-row">
              <div className="form-group"><label>Urspr. Darlehenssumme (€) *</label><input type="number" step="0.01" name="betrag" defaultValue={offen.betrag ?? ""} required /></div>
              <div className="form-group"><label>Aktuelle Restschuld (€)</label><input type="number" step="0.01" min="0" name="restschuld" defaultValue={offen.restschuld ?? ""} />
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>Laut letztem Kontoauszug. Leer = Darlehenssumme, 0 = abbezahlt.</span></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Grundschuld (€)</label><input type="number" step="0.01" name="grundschuld" defaultValue={offen.grundschuld ?? ""} /></div>
              <div className="form-group"><label>Beleihungsauslauf laut Bank (%)</label><input type="number" step="0.1" name="beleihung" defaultValue={offen.beleihung ?? ""} /></div>
            </div>

            <div className="form-section-label">Konditionen</div>
            <div className="form-row">
              <div className="form-group"><label>Zinssatz (% p.a.)</label><input type="number" step="0.01" name="zinssatz" defaultValue={offen.zinssatz ?? ""} /></div>
              <div className="form-group"><label>Tilgungssatz (% p.a.)</label><input type="number" step="0.01" name="tilgungssatz" defaultValue={offen.tilgungssatz ?? ""} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Monatliche Rate (€) *</label><input type="number" step="0.01" min="0" name="monatsrate" defaultValue={offen.monatsrate ?? ""} required /></div>
              <div className="form-group"><label>Sondertilgung möglich</label>
                <select name="sonder" defaultValue={offen.sonder ?? ""}>
                  {SONDER.map((s) => <option key={s} value={s}>{s || "Nicht bekannt"}</option>)}
                </select>
              </div>
            </div>

            <div className="form-section-label">Laufzeit &amp; Zinsbindung</div>
            <div className="form-row">
              <div className="form-group">
                <label>Vollständige Auszahlung am</label>
                <input type="date" name="auszahlung_datum" defaultValue={offen.auszahlung_datum ?? ""} />
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
                  Start für das Sonderkündigungsrecht nach 10 Jahren (§ 489 BGB).</span>
              </div>
              <div className="form-group"><label>Zinsbindung bis</label><input type="date" name="zinsbindung" defaultValue={offen.zinsbindung ?? ""} /></div>
              <div className="form-group"><label>Gesamtlaufzeit (Jahre)</label><input type="number" name="laufzeit" defaultValue={offen.laufzeit ?? ""} /></div>
            </div>

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <DeleteButton action={deleteKredit.bind(null, offen.id)} className="btn btn-ghost" label="Löschen" confirmText={`„${offen.bezeichnung || "Darlehen"}" löschen?`} />
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </form>
        </RowDialog>
      )}
    </>
  );
}
