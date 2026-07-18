"use client";

import { useMemo, useState } from "react";
import { Check, TrendingDown, Scale, ShieldCheck, Zap, Info } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  konfiguriereDarlehen, beispielZins, KAUF_DARLEHEN_KEY,
  type Prioritaet, type DarlehenAuswahl,
} from "@/lib/kauf/darlehen";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const num = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;
const JETZT = new Date().getFullYear();

const PRIOS: { id: Prioritaet; label: string; icon: typeof Scale; text: string }[] = [
  { id: "gleiche_rate", label: "Planbare, gleiche Rate", icon: Scale, text: "konstante Monatsrate, lange Sicherheit" },
  { id: "niedrige_rate", label: "Möglichst niedrige Rate", icon: TrendingDown, text: "geringe Tilgung — längere Laufzeit" },
  { id: "schnell_schuldenfrei", label: "Schnell schuldenfrei", icon: Zap, text: "hohe Tilgung, weniger Zinsen" },
  { id: "zinssicherheit", label: "Maximale Zinssicherheit", icon: ShieldCheck, text: "möglichst lange Zinsbindung" },
];

export default function DarlehenWizard({ darlehenVorschlag = 0 }: { darlehenVorschlag?: number }) {
  const toast = useToast();
  const [darlehen, setDarlehen] = useState(darlehenVorschlag ? String(Math.round(darlehenVorschlag)) : "");
  const [prio, setPrio] = useState<Prioritaet>("gleiche_rate");
  const [zinsbindung, setZinsbindung] = useState(15);
  const [zinsManuell, setZinsManuell] = useState(false);
  const [sollzins, setSollzins] = useState(String(beispielZins(15)));
  const [sondertilgung, setSondertilgung] = useState(true);

  // Zinsbindung ändern → Beispielzins nachziehen, solange nicht manuell gesetzt.
  function setzeBindung(j: number) {
    setZinsbindung(j);
    if (!zinsManuell) setSollzins(String(beispielZins(j)));
  }

  const konfig = useMemo(
    () => konfiguriereDarlehen(
      { darlehen: num(darlehen), prioritaet: prio, zinsbindung, sollzins: num(sollzins), sondertilgung },
      JETZT,
    ),
    [darlehen, prio, zinsbindung, sollzins, sondertilgung],
  );

  function uebernehmen() {
    const a: DarlehenAuswahl = {
      darlehen: num(darlehen),
      prioritaet: prio,
      zinsbindung,
      sollzins: num(sollzins),
      sondertilgung,
      anfangstilgung: konfig.anfangstilgung,
      monatsrate: konfig.monatsrate,
      gewaehltAm: new Date().toISOString().slice(0, 10),
    };
    try { localStorage.setItem(KAUF_DARLEHEN_KEY, JSON.stringify(a)); } catch { /* ignore */ }
    toast("Finanzierungswunsch für den Kreditantrag übernommen.");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="field" style={{ maxWidth: 260 }}>
        <label>Darlehensbedarf (€)</label>
        <input inputMode="decimal" value={darlehen} onChange={(e) => setDarlehen(e.target.value)} placeholder="z. B. 250000" />
      </div>

      <div>
        <div className="form-section-label">Was ist dir am wichtigsten?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {PRIOS.map((p) => {
            const aktiv = prio === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPrio(p.id)}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${aktiv ? "var(--gold)" : "var(--line2)"}`,
                  background: aktiv ? "var(--gold-pale, rgba(212,175,90,0.1))" : "var(--bg3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                  <p.icon size={15} color={aktiv ? "var(--gold)" : "var(--muted)"} /> {p.label}
                  {aktiv && <Check size={14} color="var(--gold)" style={{ marginLeft: "auto" }} />}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{p.text}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
        <div>
          <div className="form-section-label">Zinsbindung</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[10, 15, 20].map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setzeBindung(j)}
                className={`btn ${zinsbindung === j ? "btn-gold" : "btn-ghost"}`}
                style={{ fontSize: 12.5 }}
              >
                {j} Jahre
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{ maxWidth: 150 }}>
          <label>Sollzins (% p.a.)</label>
          <input inputMode="decimal" value={sollzins} onChange={(e) => { setSollzins(e.target.value); setZinsManuell(true); }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer", paddingBottom: 8 }}>
          <input type="checkbox" checked={sondertilgung} onChange={(e) => setSondertilgung(e.target.checked)} />
          Sondertilgungsrecht (meist kostenlos)
        </label>
      </div>

      {/* Ergebnis */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            <Kennzahl label="Monatsrate" wert={eur(konfig.monatsrate) + "/Mo"} gold />
            <Kennzahl label="Anfangstilgung" wert={konfig.anfangstilgung.toLocaleString("de-DE") + " %"} />
            <Kennzahl label={`Restschuld nach ${konfig.zinsbindung} J.`} wert={eur(konfig.restschuldNachBindung)} />
            <Kennzahl label="Schuldenfrei ca." wert={konfig.laufzeitJahre > 0 ? `${konfig.volltilgungJahr} (${konfig.laufzeitJahre} J.)` : "–"} />
            <Kennzahl label={`Zinskosten (${konfig.zinsbindung} J.)`} wert={eur(konfig.zinskostenBindung)} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{konfig.empfehlung}</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-gold" onClick={uebernehmen} disabled={num(darlehen) <= 0}>
              <Check size={15} /> Für den Kreditantrag übernehmen
            </button>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
        Beispielrechnung mit angenommenem Sollzins — die echten Konditionen bekommst du von der Bank.
        MyImmo gibt keine Finanzierungsempfehlung und vermittelt keine Darlehen.
      </div>
    </div>
  );
}

function Kennzahl({ label, wert, gold }: { label: string; wert: string; gold?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: gold ? "var(--gold)" : undefined }}>{wert}</div>
    </div>
  );
}
