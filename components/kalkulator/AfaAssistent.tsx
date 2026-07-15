"use client";

// AfA-Assistent (D1): vier Planungswerkzeuge rund um die Gebäude-AfA.
// Kaufpreisaufteilung → Gebäudewert speist die anderen Rechner. Reine
// Orientierung, keine Steuerberatung.
import { useMemo, useState } from "react";
import { Building2, TrendingDown, BadgeCheck, CalendarClock, Landmark } from "lucide-react";
import { euro } from "@/lib/format";
import {
  afaSatzNachFertigstellung, degressivVsLinear, pruefe7b, verteile82b, kaufpreisAufteilung,
} from "@/lib/steuer/afa";

export type AfaObjekt = {
  id: string;
  bezeichnung: string;
  kaufpreis: number | null;
  flaeche: number | null;
  grundstuecksflaeche: number | null;
  bodenrichtwert: number | null;
  baujahr: number | null;
  gebaeudeanteil: number | null;
};

const numOr = (s: string, fallback = 0) => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : fallback;
};

export default function AfaAssistent({ objekte }: { objekte: AfaObjekt[] }) {
  // Gemeinsame Eingaben (per Objekt vorbefüllbar)
  const [kaufpreis, setKaufpreis] = useState("300000");
  const [grundflaeche, setGrundflaeche] = useState("");
  const [bodenrichtwert, setBodenrichtwert] = useState("");
  const [wohnflaeche, setWohnflaeche] = useState("100");
  const [baujahr, setBaujahr] = useState("2024");

  function ladeObjekt(id: string) {
    const o = objekte.find((x) => x.id === id);
    if (!o) return;
    if (o.kaufpreis != null) setKaufpreis(String(o.kaufpreis));
    setGrundflaeche(o.grundstuecksflaeche != null ? String(o.grundstuecksflaeche) : "");
    setBodenrichtwert(o.bodenrichtwert != null ? String(o.bodenrichtwert) : "");
    if (o.flaeche != null) setWohnflaeche(String(o.flaeche));
    if (o.baujahr != null) setBaujahr(String(o.baujahr));
  }

  // 1) Kaufpreisaufteilung → Gebäudewert
  const aufteilung = useMemo(
    () => kaufpreisAufteilung(numOr(kaufpreis), grundflaeche ? numOr(grundflaeche) : null, bodenrichtwert ? numOr(bodenrichtwert) : null),
    [kaufpreis, grundflaeche, bodenrichtwert],
  );
  const gebaeudeAK = aufteilung?.gebaeudewert ?? 0;

  // 2) Degressiv vs. linear
  const linearSatz = afaSatzNachFertigstellung(numOr(baujahr) || null);
  const vergleich = useMemo(
    () => (gebaeudeAK > 0 ? degressivVsLinear(gebaeudeAK, linearSatz, 15) : null),
    [gebaeudeAK, linearSatz],
  );

  // 3) § 7b
  const [neueWohnung, setNeueWohnung] = useState(true);
  const [qng, setQng] = useState(false);
  const [baukosten, setBaukosten] = useState("4800");
  const p7b = useMemo(
    () => pruefe7b({
      bauantragJahr: numOr(baujahr) || null,
      neueWohnung, qngNachweis: qng,
      baukostenProM2: baukosten ? numOr(baukosten) : null,
      flaeche: wohnflaeche ? numOr(wohnflaeche) : null,
    }),
    [baujahr, neueWohnung, qng, baukosten, wohnflaeche],
  );

  // 4) § 82b
  const [erhaltung, setErhaltung] = useState("12000");
  const [jahre82b, setJahre82b] = useState(3);
  const [grenzsteuer, setGrenzsteuer] = useState("42");
  const v82b = useMemo(
    () => verteile82b(numOr(erhaltung), jahre82b, grenzsteuer ? numOr(grenzsteuer) : null),
    [erhaltung, jahre82b, grenzsteuer],
  );

  const feld: React.CSSProperties = { width: "100%" };
  const label: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 3 };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {objekte.length > 0 && (
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Aus Objekt vorbefüllen:</span>
            <select className="input" style={{ maxWidth: 280 }} defaultValue="" onChange={(e) => ladeObjekt(e.target.value)}>
              <option value="" disabled>Objekt wählen…</option>
              {objekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Gemeinsame Eingaben */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3><Building2 size={15} style={{ verticalAlign: "-2px" }} /> Eckdaten</h3></div>
        <div className="section-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            <label><span style={label}>Kaufpreis gesamt (€)</span><input className="input" style={feld} value={kaufpreis} onChange={(e) => setKaufpreis(e.target.value)} inputMode="decimal" /></label>
            <label><span style={label}>Grundstücksfläche (m²)</span><input className="input" style={feld} value={grundflaeche} onChange={(e) => setGrundflaeche(e.target.value)} placeholder="optional" inputMode="decimal" /></label>
            <label><span style={label}>Bodenrichtwert (€/m²)</span><input className="input" style={feld} value={bodenrichtwert} onChange={(e) => setBodenrichtwert(e.target.value)} placeholder="optional" inputMode="decimal" /></label>
            <label><span style={label}>Wohnfläche (m²)</span><input className="input" style={feld} value={wohnflaeche} onChange={(e) => setWohnflaeche(e.target.value)} inputMode="decimal" /></label>
            <label><span style={label}>Fertigstellungsjahr</span><input className="input" style={feld} value={baujahr} onChange={(e) => setBaujahr(e.target.value)} inputMode="numeric" /></label>
          </div>
        </div>
      </div>

      {/* 1) Kaufpreisaufteilung */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3><Landmark size={15} style={{ verticalAlign: "-2px" }} /> Kaufpreisaufteilung</h3></div>
        <div className="section-body">
          {aufteilung ? (
            <>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8 }}>
                <Kennwert label="Gebäude (AfA-Basis)" wert={euro(aufteilung.gebaeudewert)} prozent={`${aufteilung.gebaeudeanteilProzent.toLocaleString("de-DE")} %`} farbe="var(--green)" />
                <Kennwert label="Grund und Boden" wert={euro(aufteilung.bodenwert)} prozent={`${aufteilung.grundanteilProzent.toLocaleString("de-DE")} %`} farbe="var(--muted)" />
              </div>
              <div style={{ height: 8, borderRadius: 5, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${aufteilung.gebaeudeanteilProzent}%`, background: "var(--green)" }} />
                <div style={{ width: `${aufteilung.grundanteilProzent}%`, background: "var(--line)" }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10, marginBottom: 0 }}>{aufteilung.hinweis}</p>
            </>
          ) : <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Kaufpreis eingeben.</p>}
        </div>
      </div>

      {/* 2) Degressiv vs. linear */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header">
          <h3><TrendingDown size={15} style={{ verticalAlign: "-2px" }} /> Degressiv vs. linear</h3>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>linearer Satz {linearSatz} % (Baujahr {baujahr || "?"})</span>
        </div>
        <div className="section-body">
          {vergleich ? (
            <>
              <p style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
                Empfehlung: <strong>degressiv abschreiben</strong> (5 % vom Restwert) und im <strong>Jahr {vergleich.wechseljahr}</strong> auf die lineare AfA wechseln.
                In den ersten 10 Jahren bringt die optimale Strategie <strong style={{ color: "var(--green)" }}>{euro(vergleich.summeOptimal10)}</strong> AfA
                (rein linear: {euro(vergleich.plan.slice(0, 10).reduce((s, j) => s + j.linear, 0))}).
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ fontSize: 12 }}>
                  <thead><tr><th>Jahr</th><th>Degressiv (5 %)</th><th>Linear ({linearSatz} %)</th><th>Optimal</th></tr></thead>
                  <tbody>
                    {vergleich.plan.slice(0, 12).map((j) => (
                      <tr key={j.jahr} style={j.jahr === vergleich.wechseljahr ? { background: "var(--gold-pale)" } : undefined}>
                        <td>{j.jahr}{j.jahr === vergleich.wechseljahr && <span className="badge badge-gold" style={{ marginLeft: 6 }}>Wechsel</span>}</td>
                        <td>{euro(j.degressiv)}</td>
                        <td>{euro(j.linear)}</td>
                        <td style={{ fontWeight: 600, color: "var(--green)" }}>{euro(j.optimal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10, marginBottom: 0 }}>
                Degressive AfA (§ 7 Abs. 5a) nur für neue Wohngebäude mit Baubeginn 10/2023–09/2029. Vereinfachtes Modell, keine Monats-Zeitanteiligkeit im 1. Jahr.
              </p>
            </>
          ) : <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Erst Kaufpreis/Gebäudewert ermitteln.</p>}
        </div>
      </div>

      {/* 3) § 7b Sonder-AfA */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header">
          <h3><BadgeCheck size={15} style={{ verticalAlign: "-2px" }} /> § 7b Sonder-AfA</h3>
          <span className={`badge ${p7b.berechtigt ? "badge-green" : "badge-neutral"}`}>{p7b.berechtigt ? "möglich" : "nicht erfüllt"}</span>
        </div>
        <div className="section-body">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={neueWohnung} onChange={(e) => setNeueWohnung(e.target.checked)} style={{ width: "auto" }} /> Neue Wohnung
            </label>
            <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={qng} onChange={(e) => setQng(e.target.checked)} style={{ width: "auto" }} /> EH40 / QNG-Nachweis
            </label>
            <label style={{ fontSize: 12.5 }}>
              <span style={{ color: "var(--muted)", marginRight: 6 }}>Baukosten €/m²</span>
              <input className="input" style={{ width: 110, display: "inline-block" }} value={baukosten} onChange={(e) => setBaukosten(e.target.value)} inputMode="decimal" />
            </label>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", fontSize: 12.5 }}>
            {p7b.gruende.map((g, i) => (
              <li key={i} style={{ color: g.ok ? "var(--green)" : "var(--red)", marginBottom: 3 }}>{g.ok ? "✓" : "✗"} {g.text}</li>
            ))}
          </ul>
          {p7b.berechtigt && (
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>
              Zusätzliche Sonder-AfA: <strong style={{ color: "var(--green)" }}>bis {euro(p7b.maxSonderAfaProJahr)} / Jahr</strong> in den Jahren 1–4
              (Bemessungsgrundlage {euro(p7b.bemessungsgrundlageProM2)}/m², gedeckelt).
            </p>
          )}
          <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>{p7b.hinweis}</p>
        </div>
      </div>

      {/* 4) § 82b Verteilung */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3><CalendarClock size={15} style={{ verticalAlign: "-2px" }} /> Erhaltungsaufwand verteilen (§ 82b)</h3></div>
        <div className="section-body">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <label style={{ fontSize: 12.5 }}><span style={label}>Betrag (€)</span><input className="input" style={{ width: 130 }} value={erhaltung} onChange={(e) => setErhaltung(e.target.value)} inputMode="decimal" /></label>
            <label style={{ fontSize: 12.5 }}><span style={label}>Verteilen auf</span>
              <select className="input" style={{ width: 110 }} value={jahre82b} onChange={(e) => setJahre82b(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} Jahr{n > 1 ? "e" : ""}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12.5 }}><span style={label}>Grenzsteuersatz (%)</span><input className="input" style={{ width: 90 }} value={grenzsteuer} onChange={(e) => setGrenzsteuer(e.target.value)} inputMode="decimal" /></label>
          </div>
          <p style={{ fontSize: 13, margin: "0 0 6px" }}>
            <strong>{euro(v82b.proJahr)}</strong> pro Jahr über {v82b.jahre} Jahr{v82b.jahre > 1 ? "e" : ""}
            {v82b.verteiltErsparnisProJahr != null && <> — Steuerersparnis ca. <strong style={{ color: "var(--green)" }}>{euro(v82b.verteiltErsparnisProJahr)}</strong> / Jahr</>}.
          </p>
          <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>{v82b.hinweis}</p>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", margin: "4px 0 0" }}>
        Alle Berechnungen sind vereinfachte Orientierungswerte ohne Gewähr und ersetzen keine Steuerberatung.
      </p>
    </div>
  );
}

function Kennwert({ label, wert, prozent, farbe }: { label: string; wert: string; prozent: string; farbe: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: farbe }}>{wert}</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{prozent}</div>
    </div>
  );
}
