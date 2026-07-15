"use client";

// Import-Assistent (C6 „Umzug von vermietet.de & Co."): CSV hochladen oder
// einfügen → Spalten den MyImmo-Feldern zuordnen (Auto-Vorschlag) → Vorschau →
// bestätigen. Nichts wird ohne den finalen Klick importiert.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Upload, ArrowRight, CheckCircle2, TriangleAlert, FileSpreadsheet, RotateCcw } from "lucide-react";
import {
  parseCsv, autoMap, baueDatensaetze, IMPORT_FELDER,
  type CsvTabelle, type ImportTyp,
} from "@/lib/importCsv";
import { importiereDaten, type ImportAktionErgebnis } from "@/lib/actions/importDaten";

const TYP_LABEL: Record<ImportTyp, string> = { objekte: "Immobilien / Objekte", mieter: "Mieter" };

export default function ImportAssistent({ objektNamen }: { objektNamen: string[] }) {
  const [typ, setTyp] = useState<ImportTyp>("objekte");
  const [tabelle, setTabelle] = useState<CsvTabelle | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<ImportAktionErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ladeText(text: string, name: string | null) {
    setFehler(null);
    setErgebnis(null);
    const t = parseCsv(text);
    if (t.headers.length < 2 || t.rows.length === 0) {
      setFehler("Die Datei konnte nicht gelesen werden — erwartet wird eine CSV mit Kopfzeile und mindestens einer Datenzeile.");
      setTabelle(null);
      return;
    }
    setTabelle(t);
    setDateiName(name);
    setMapping(autoMap(t.headers, typ));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFehler("Datei zu groß (max. 2 MB)."); return; }
    ladeText(await file.text(), file.name);
  }

  function wechsleTyp(t: ImportTyp) {
    setTyp(t);
    setErgebnis(null);
    if (tabelle) setMapping(autoMap(tabelle.headers, t));
  }

  const daten = useMemo(
    () => (tabelle ? baueDatensaetze(tabelle, typ, mapping) : null),
    [tabelle, typ, mapping],
  );

  const felder = IMPORT_FELDER[typ];
  const zugeordnet = felder.filter((f) => mapping[f.key]);
  const pflichtFehlt = felder.filter((f) => f.pflicht && !mapping[f.key]);

  // Mieter-Import: wie viele Zeilen finden ihr Objekt über den Namen?
  const objekteLower = useMemo(() => new Set(objektNamen.map((n) => n.trim().toLowerCase())), [objektNamen]);
  const ohneObjekt = typ === "mieter" && daten
    ? daten.zeilen.filter((z) => !objekteLower.has(String(z.objekt ?? "").trim().toLowerCase())).length
    : 0;

  function importieren() {
    if (!daten || daten.zeilen.length === 0) return;
    startTransition(async () => {
      const res = await importiereDaten(typ, daten.zeilen);
      setErgebnis(res);
      if (!res.ok) setFehler(res.fehler ?? "Import fehlgeschlagen.");
    });
  }

  if (ergebnis?.ok) {
    return (
      <div className="section">
        <div className="section-body" style={{ textAlign: "center", padding: "40px 20px" }}>
          <CheckCircle2 size={40} color="var(--green)" style={{ marginBottom: 12 }} />
          <h3 style={{ marginBottom: 8 }}>{ergebnis.angelegt} {TYP_LABEL[typ]} importiert ✓</h3>
          {ergebnis.ohneObjekt > 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 480, margin: "0 auto 8px" }}>
              {ergebnis.ohneObjekt} Mieter konnten keinem Objekt zugeordnet werden (Objektname nicht gefunden) —
              du kannst das Objekt in der Mieterliste je Mieter nachtragen.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <Link href={typ === "objekte" ? "/properties" : "/tenants"} className="btn btn-gold">
              {typ === "objekte" ? "Zu den Objekten" : "Zu den Mietern"} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => { setTabelle(null); setErgebnis(null); }}>
              <RotateCcw size={13} style={{ verticalAlign: "-2px" }} /> Weitere Datei importieren
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Schritt 1: Typ + Datei */}
      <div className="section">
        <div className="section-header"><h3>1. Was möchtest du importieren?</h3></div>
        <div className="section-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(Object.keys(TYP_LABEL) as ImportTyp[]).map((t) => (
              <button
                key={t} type="button"
                className={`btn ${typ === t ? "btn-gold" : "btn-ghost"}`}
                onClick={() => wechsleTyp(t)}
              >
                {TYP_LABEL[t]}
              </button>
            ))}
          </div>
          <label className="btn btn-ghost" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} /> CSV-Datei wählen
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: "none" }} />
          </label>
          {dateiName && tabelle && (
            <span style={{ marginLeft: 10, fontSize: 12.5, color: "var(--muted)" }}>
              <FileSpreadsheet size={13} style={{ verticalAlign: "-2px" }} /> {dateiName} — {tabelle.rows.length} Zeilen, {tabelle.headers.length} Spalten
            </span>
          )}
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 10, marginBottom: 0 }}>
            Export aus vermietet.de, objego oder Excel: dort als CSV exportieren/speichern und hier hochladen.
            Die Datei bleibt in deinem Browser, bis du den Import bestätigst.
          </p>
        </div>
      </div>

      {fehler && !ergebnis && (
        <div className="section" style={{ borderColor: "var(--red)" }}>
          <div className="section-body" style={{ fontSize: 13, color: "var(--red)" }}>
            <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> {fehler}
          </div>
        </div>
      )}

      {/* Schritt 2: Mapping */}
      {tabelle && (
        <div className="section">
          <div className="section-header">
            <h3>2. Spalten zuordnen</h3>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{zugeordnet.length} von {felder.length} Feldern zugeordnet</span>
          </div>
          <div className="section-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px 18px" }}>
              {felder.map((f) => (
                <label key={f.key} style={{ fontSize: 12.5 }}>
                  <span style={{ display: "block", color: "var(--muted)", marginBottom: 3 }}>
                    {f.label}{f.pflicht && <span style={{ color: "var(--gold)" }}> *</span>}
                  </span>
                  <select
                    className="input" style={{ width: "100%" }}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  >
                    <option value="">— nicht importieren —</option>
                    {tabelle.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {typ === "mieter" && (
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 12, marginBottom: 0 }}>
                Die Objekt-Zuordnung läuft über den Objektnamen — er muss exakt so heißen wie ein Objekt in MyImmo
                ({objektNamen.length > 0 ? `vorhanden: ${objektNamen.slice(0, 4).join(", ")}${objektNamen.length > 4 ? ", …" : ""}` : "noch keine Objekte angelegt — importiere zuerst die Objekte"}).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Schritt 3: Vorschau + Import */}
      {tabelle && daten && (
        <div className="section">
          <div className="section-header"><h3>3. Prüfen und importieren</h3></div>
          <div className="section-body">
            {pflichtFehlt.length > 0 ? (
              <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>
                <TriangleAlert size={13} style={{ verticalAlign: "-2px" }} /> Bitte zuerst zuordnen: {pflichtFehlt.map((f) => f.label).join(", ")}
              </p>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>{zugeordnet.map((f) => <th key={f.key}>{f.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {daten.zeilen.slice(0, 5).map((z, i) => (
                        <tr key={i}>
                          {zugeordnet.map((f) => <td key={f.key}>{z[f.key] == null ? "–" : String(z[f.key])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {daten.zeilen.length > 5 && (
                  <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>… und {daten.zeilen.length - 5} weitere Zeilen.</p>
                )}
                {daten.fehler.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--red)" }}>
                    {daten.fehler.slice(0, 5).map((f, i) => <div key={i}>• {f}</div>)}
                    {daten.fehler.length > 5 && <div>… {daten.fehler.length - 5} weitere Hinweise.</div>}
                  </div>
                )}
                {ohneObjekt > 0 && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "var(--gold)" }}>
                    <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> {ohneObjekt} von {daten.zeilen.length} Mietern
                    finden aktuell kein Objekt mit passendem Namen — sie werden ohne Objekt-Zuordnung importiert.
                  </p>
                )}
                <button
                  type="button" className="btn btn-gold" style={{ marginTop: 16 }}
                  disabled={pending || daten.zeilen.length === 0}
                  onClick={importieren}
                >
                  {pending ? "Importiere…" : <>{daten.zeilen.length} {TYP_LABEL[typ]} importieren <ArrowRight size={14} style={{ verticalAlign: "-2px" }} /></>}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
