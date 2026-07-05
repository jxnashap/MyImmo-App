// Marktwert-Karte (ImmoWertV) für die Objekt-Detailseite. Server-Komponente:
// zeigt aktuellen Wert + Spanne + Stand + Verfahren, aufklappbare Herleitung,
// Vergleichsangebote, Mini-Verlauf und ein Formular für die regionalen Kennzahlen
// mit „Jetzt aktualisieren". Interaktivität nur über <details> + Server-Action.

import SubmitButton from "@/components/SubmitButton";
import { euro, datum } from "@/lib/format";

type Herleitungszeile = { label: string; wert: number; einheit?: string; hinweis?: string };
type Erg = {
  verfahren: "vergleich" | "ertrag" | "sach";
  marktwert: number | null;
  spanne: { min: number; max: number } | null;
  mietwert: number | null;
  herleitung: Herleitungszeile[];
  fehlend: string[];
  hinweis: string;
};
type HistoriePunkt = { datum: string; marktwert: number };
type Comp = { quelle: string; art: string | null; flaeche: number | null; zimmer: number | null; preis: number | null; preis_pro_qm: number | null; distanz_km: number | null };

const VERFAHREN_LABEL: Record<string, string> = { vergleich: "Vergleichswertverfahren", ertrag: "Ertragswertverfahren", sach: "Sachwertverfahren" };

function Sparkline({ punkte }: { punkte: HistoriePunkt[] }) {
  if (punkte.length < 2) return null;
  const werte = punkte.map((p) => p.marktwert);
  const min = Math.min(...werte), max = Math.max(...werte);
  const span = max - min || 1;
  const W = 240, H = 46;
  const pts = punkte.map((p, i) => {
    const x = (i / (punkte.length - 1)) * W;
    const y = H - ((p.marktwert - min) / span) * (H - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const steigend = werte[werte.length - 1] >= werte[0];
  const col = steigend ? "var(--gold)" : "var(--red)";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }} aria-hidden>
      <polyline points={pts} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MarktwertCard({
  erg, defaults, marktwertStand, quelleninfo, historie, comparables, adresse, koordinaten, action,
}: {
  erg: Erg;
  defaults: {
    bodenrichtwert: number | null; liegenschaftszins: number | null; restnutzungsdauer: number | null;
    vergleichspreis_m2: number | null; vergleichsmiete_m2: number | null; bewertungsverfahren: string | null;
    bodenrichtwert_stichtag: string | null;
  };
  marktwertStand: string | null;
  quelleninfo: Record<string, unknown> | null;
  historie: HistoriePunkt[];
  comparables: Comp[];
  adresse: string | null;
  koordinaten: { lat: number | null; lng: number | null };
  action: (formData: FormData) => void;
}) {
  const hatWert = erg.marktwert != null;
  const brwQuelle = (quelleninfo?.brwQuelle as string) ?? null;
  const geokodiert = koordinaten.lat != null && koordinaten.lng != null;

  return (
    <div className="section mb-20">
      <div className="section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3><span style={{ color: "var(--gold)", marginRight: 6 }}>⌂</span>Marktwert (ImmoWertV)</h3>
        <span className="badge badge-teal" style={{ fontSize: 10 }}>automatisch aktualisiert</span>
      </div>
      <div className="section-body">
        {/* Kopf: Wert + Spanne + Stand + Verfahren */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, color: hatWert ? "var(--gold)" : "var(--muted)", lineHeight: 1.1 }}>
              {hatWert ? euro(erg.marktwert) : "— nicht berechenbar"}
            </div>
            {erg.spanne && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                Spanne {euro(erg.spanne.min)} – {euro(erg.spanne.max)}
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="badge badge-gold" style={{ fontSize: 10 }}>{VERFAHREN_LABEL[erg.verfahren]}</span>
              <span>Stand: {marktwertStand ? datum(marktwertStand) : "noch nicht berechnet"}</span>
              {erg.mietwert != null && <span>· ortsübl. Miete ≈ {euro(erg.mietwert)}/Mo.</span>}
            </div>
          </div>
          {historie.length >= 2 && (
            <div style={{ textAlign: "right" }}>
              <Sparkline punkte={historie} />
              <div style={{ fontSize: 10, color: "var(--faint)" }}>Verlauf ({historie.length} Stände)</div>
            </div>
          )}
        </div>

        {/* Fehlende Kennzahlen */}
        {erg.fehlend.length > 0 && (
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", fontSize: 12, color: "var(--text)" }}>
            <strong style={{ color: "var(--gold)" }}>Für die Berechnung fehlen noch:</strong> {erg.fehlend.join(" · ")}
            <div style={{ color: "var(--muted)", marginTop: 4 }}>
              Trage sie unten ein (aus BORIS-Portal / Marktbericht deiner Gemeinde in ~2 Min. ablesbar) und klicke „Jetzt aktualisieren".
            </div>
          </div>
        )}

        {/* Kennzahlen-Formular + Aktualisieren */}
        <form action={action} style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Feld name="bodenrichtwert" label="Bodenrichtwert (€/m²)" def={defaults.bodenrichtwert} step="1" placeholder="z. B. 450" />
            <Feld name="vergleichspreis_m2" label="Vergleichspreis (€/m²)" def={defaults.vergleichspreis_m2} step="1" placeholder="z. B. 3800" />
            <Feld name="vergleichsmiete_m2" label="ortsübl. Miete (€/m²·Mo.)" def={defaults.vergleichsmiete_m2} step="0.1" placeholder="z. B. 11,5" />
            <Feld name="liegenschaftszins" label="Liegenschaftszins (%)" def={defaults.liegenschaftszins} step="0.1" placeholder="z. B. 3,5" />
            <Feld name="restnutzungsdauer" label="Restnutzungsdauer (J.)" def={defaults.restnutzungsdauer} step="1" placeholder="auto aus Baujahr" />
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11, color: "var(--muted)" }}>Verfahren</label>
              <select name="bewertungsverfahren" className="input" defaultValue={defaults.bewertungsverfahren ?? ""}>
                <option value="">Automatisch (nach Nutzung)</option>
                <option value="vergleich">Vergleichswert</option>
                <option value="ertrag">Ertragswert</option>
                <option value="sach">Sachwert</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <SubmitButton pendingLabel="Aktualisiere…">↻ Jetzt aktualisieren</SubmitButton>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {geokodiert ? "📍 geokodiert" : (adresse ? "📍 Adresse wird beim Aktualisieren geokodiert" : "⚠ keine Adresse hinterlegt")}
              {brwQuelle && brwQuelle !== "—" ? ` · Bodenrichtwert: ${brwQuelle}` : ""}
            </span>
          </div>
        </form>

        {/* Herleitung (aufklappbar) */}
        {erg.herleitung.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Herleitung anzeigen</summary>
            <table style={{ fontSize: 12, marginTop: 8, width: "100%" }}>
              <tbody>
                {erg.herleitung.map((h, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--muted)", padding: "4px 8px 4px 0" }}>
                      {h.label}{h.hinweis ? <span style={{ color: "var(--faint)" }}> — {h.hinweis}</span> : null}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {h.einheit === "€" ? euro(h.wert) : `${h.wert.toLocaleString("de-DE", { maximumFractionDigits: 2 })}${h.einheit ? " " + h.einheit : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {/* Vergleichsangebote */}
        <details style={{ marginTop: 10 }} open={comparables.length > 0}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            Vergleichsangebote Umgebung ({comparables.length})
          </summary>
          {comparables.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Noch keine Vergleichsangebote. Externe Portale (z. B. ImmoScout24) sind als Schnittstelle vorbereitet und werden aktiv,
              sobald ein Partnerzugang hinterlegt ist; bis dahin dient der eigene Bestand als Vergleich.
            </p>
          ) : (
            <table style={{ fontSize: 12, marginTop: 8, width: "100%" }}>
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th style={{ textAlign: "left" }}>Quelle</th><th style={{ textAlign: "right" }}>Fläche</th>
                  <th style={{ textAlign: "right" }}>€/m²</th><th style={{ textAlign: "right" }}>Preis</th><th style={{ textAlign: "right" }}>Distanz</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((c, i) => (
                  <tr key={i}>
                    <td>{c.quelle}{c.art ? ` · ${c.art}` : ""}</td>
                    <td style={{ textAlign: "right" }}>{c.flaeche ? `${c.flaeche} m²` : "—"}</td>
                    <td style={{ textAlign: "right" }}>{c.preis_pro_qm ? euro(c.preis_pro_qm) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{c.preis ? euro(c.preis) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{c.distanz_km != null ? `${c.distanz_km} km` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>

        {/* Transparenz-Hinweis */}
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 14, lineHeight: 1.6 }}>
          {erg.hinweis} Quellen &amp; Stichtage werden gespeichert und ausgewiesen
          {defaults.bodenrichtwert_stichtag ? ` (Bodenrichtwert-Stichtag: ${datum(defaults.bodenrichtwert_stichtag)})` : ""}.
          Regionale Kennzahlen werden — soweit eine Quelle angebunden ist — automatisch aktualisiert.
        </p>
      </div>
    </div>
  );
}

function Feld({ name, label, def, step, placeholder }: { name: string; label: string; def: number | null; step: string; placeholder: string }) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label style={{ fontSize: 11, color: "var(--muted)" }}>{label}</label>
      <input className="input" type="number" step={step} name={name} defaultValue={def ?? ""} placeholder={placeholder} />
    </div>
  );
}
