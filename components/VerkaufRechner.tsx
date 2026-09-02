"use client";
import { useMemo, useState } from "react";
import { ShieldCheck, TriangleAlert, Info, Home } from "lucide-react";
import { berechneVerkauf, SPEK_FREIGRENZE } from "@/lib/verkauf";
import { datum as fmtDatum } from "@/lib/format";
import { zahlDe0 } from "@/lib/zahl";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const num = zahlDe0;

// Vorbefüllung aus dem Bestand: Objekt wählen → Kaufpreis/-datum, aktueller
// Wert (als Verkaufspreis-Vorschlag) und Restschuld werden übernommen.
export type VerkaufObjekt = {
  id: string;
  name: string;
  kaufpreis: number | null;
  kaufdatum: string | null;
  wert: number | null;
  restschuld: number;
};

export default function VerkaufRechner({
  objekte = [], demo = false,
}: { objekte?: VerkaufObjekt[]; demo?: boolean }) {
  // In der oeffentlichen Demo ist die Objekt-Auswahl gesperrt (fieldset
  // disabled). Ohne Vorbelegung bliebe der Rechner deshalb dauerhaft leer —
  // man koennte nie ein Objekt waehlen und saehe nie eine Rechnung. Deshalb
  // steht dort das erste Bestandsobjekt von Anfang an drin.
  const start = demo ? objekte[0] : undefined;

  const [vp, setVp] = useState(start?.wert ? String(Math.round(start.wert)) : "");
  const [kaufdatum, setKaufdatum] = useState(start?.kaufdatum ? start.kaufdatum.slice(0, 10) : "");
  const [kp, setKp] = useState(start?.kaufpreis ? String(Math.round(start.kaufpreis)) : "");
  const [knk, setKnk] = useState("");
  const [afa, setAfa] = useState("");
  const [vk, setVk] = useState("");
  const [rest, setRest] = useState(start && start.restschuld > 0 ? String(Math.round(start.restschuld)) : "");
  const [vfe, setVfe] = useState("");
  const [satz, setSatz] = useState("42");
  const [weitere, setWeitere] = useState("");
  const [objId, setObjId] = useState(start?.id ?? "");
  const [eigen, setEigen] = useState(false);

  // Bestandsobjekt übernehmen — überschreibt nur die zugehörigen Felder.
  function uebernehmeObjekt(id: string) {
    setObjId(id);
    const o = objekte.find((x) => x.id === id);
    if (!o) return;
    if (o.wert && o.wert > 0) setVp(String(Math.round(o.wert)));
    if (o.kaufdatum) setKaufdatum(o.kaufdatum.slice(0, 10));
    if (o.kaufpreis && o.kaufpreis > 0) setKp(String(Math.round(o.kaufpreis)));
    setRest(o.restschuld > 0 ? String(Math.round(o.restschuld)) : "");
  }

  const r = useMemo(() => {
    if (!num(vp)) return null;
    return berechneVerkauf({
      verkaufspreis: num(vp), kaufdatum: kaufdatum || null, kaufpreis: num(kp),
      kaufnebenkosten: num(knk), afaKumuliert: num(afa), verkaufskosten: num(vk),
      restschuld: num(rest), vorfaelligkeit: num(vfe), steuersatz: num(satz),
      weitereGewinneImJahr: num(weitere), eigennutzung: eigen,
    });
  }, [vp, kaufdatum, kp, knk, afa, vk, rest, vfe, satz, weitere, eigen]);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 320px", display: "grid", gap: 10 }}>
        {objekte.length > 0 && (
          <div className="form-group">
            <label><Home size={12} style={{ verticalAlign: "-2px" }} /> Objekt aus deinem Bestand übernehmen</label>
            <select value={objId} onChange={(e) => uebernehmeObjekt(e.target.value)}>
              <option value="">– selbst eintragen –</option>
              {objekte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {objId && (
              <span style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>
                Übernommen: aktueller Wert als Verkaufspreis-Vorschlag, Kaufpreis/-datum, Restschuld. AfA &amp; Kosten bitte selbst ergänzen.
              </span>
            )}
          </div>
        )}
        <div className="form-row">
          <div className="form-group"><label>Voraussichtl. Verkaufspreis (€)</label><input value={vp} onChange={(e) => setVp(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label>Kaufdatum (Notarvertrag)</label><input type="date" value={kaufdatum} onChange={(e) => setKaufdatum(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>damaliger Kaufpreis (€)</label><input value={kp} onChange={(e) => setKp(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label>damalige Kaufnebenkosten (€)</label><input value={knk} onChange={(e) => setKnk(e.target.value)} inputMode="decimal" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>bisher genutzte AfA (€)</label><input value={afa} onChange={(e) => setAfa(e.target.value)} inputMode="decimal" placeholder="erhöht den Gewinn" /></div>
          <div className="form-group"><label>Verkaufskosten (Makler/Notar) (€)</label><input value={vk} onChange={(e) => setVk(e.target.value)} inputMode="decimal" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Restschuld Darlehen (€)</label><input value={rest} onChange={(e) => setRest(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group">
            <label>Vorfälligkeitsentschädigung (€)</label>
            <input value={vfe} onChange={(e) => setVfe(e.target.value)} inputMode="decimal" />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Zählt als Veräußerungskosten und mindert den steuerpflichtigen Gewinn — als
              Werbungskosten bei Vermietung ist sie dagegen nicht abziehbar.
            </span>
          </div>
          <div className="form-group">
            <label>Weitere private Veräußerungsgewinne im selben Jahr (€)</label>
            <input value={weitere} onChange={(e) => setWeitere(e.target.value)} inputMode="decimal" placeholder="0" />
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Krypto, Gold, weitere Immobilien … Die Freigrenze von {eur(SPEK_FREIGRENZE)} gilt für
              die Summe aller Geschäfte eines Jahres, nicht je Verkauf.
            </span>
          </div>
        </div>
        <div className="form-group" style={{ maxWidth: 220 }}><label>persönl. Steuersatz (%)</label><input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal" /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={eigen} onChange={(e) => setEigen(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Selbst bewohnt
            <span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>
              Im Verkaufsjahr und in den beiden Kalenderjahren davor selbst genutzt — dann ist der
              Gewinn nach § 23 Abs. 1 Nr. 1 S. 3 EStG steuerfrei, auch innerhalb der 10 Jahre.
            </span>
          </span>
        </label>
      </div>

      <div style={{ flex: "1 1 280px", minWidth: 260 }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body">
            {!r ? (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>Verkaufspreis eingeben für die Berechnung.</p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {r.steuerfreiGrund === "frist" ? (
                    <span className="badge badge-green"><ShieldCheck size={12} style={{ verticalAlign: "-1px" }} /> Spekulationsfrist abgelaufen — steuerfrei</span>
                  ) : r.steuerfreiGrund === "eigennutzung" ? (
                    <span className="badge badge-green"><ShieldCheck size={12} style={{ verticalAlign: "-1px" }} /> Selbst bewohnt — steuerfrei (§ 23 Abs. 1 Nr. 1 S. 3)</span>
                  ) : r.steuerfreiGrund === "verlust" ? (
                    <span className="badge badge-teal">Veräußerungsverlust — keine Steuer</span>
                  ) : r.steuerfreiGrund === "freigrenze" ? (
                    <span className="badge badge-green"><ShieldCheck size={12} style={{ verticalAlign: "-1px" }} /> Unter der Freigrenze von {eur(SPEK_FREIGRENZE)} — keine Steuer</span>
                  ) : (
                    <span className="badge badge-amber"><TriangleAlert size={12} style={{ verticalAlign: "-1px" }} /> Innerhalb der 10-Jahres-Frist</span>
                  )}
                </div>
                {r.fehlend.length > 0 && (
                  <div style={{ fontSize: 12, background: "var(--gold-pale)", border: "1px solid var(--gold-dim)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                    Ohne diese Angabe ist das Ergebnis nicht belastbar: {r.fehlend.join(", ")}.
                    {!kaufdatum && " Ohne Kaufdatum rechnet die App vorsorglich mit voller Steuerpflicht."}
                  </div>
                )}
                {r.verlust && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                    Rechnerischer Veräußerungsverlust: <strong>{eur(Math.abs(r.ergebnisRoh))}</strong>. Er ist
                    nur mit Gewinnen aus anderen privaten Veräußerungsgeschäften verrechenbar (§ 23 Abs. 3 S. 7 EStG).
                  </div>
                )}
                {r.steuerfreiGrund === "freigrenze" && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                    Gewinn {eur(r.ergebnisRoh)}
                    {num(weitere) > 0 && <> zzgl. {eur(num(weitere))} aus weiteren Geschäften = <strong>{eur(r.jahresSumme)}</strong></>}
                    {" "}— unter der Freigrenze. Sie gilt für die Summe ALLER privaten
                    Veräußerungsgeschäfte eines Jahres; ein weiterer Verkauf kann sie kippen, und
                    dann ist der volle Gewinn steuerpflichtig, nicht nur der Teil darüber.
                  </div>
                )}
                {!r.steuerfreiGrund && num(weitere) > 0 && r.jahresSumme >= SPEK_FREIGRENZE && r.ergebnisRoh < SPEK_FREIGRENZE && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                    Dieser Verkauf allein läge mit {eur(r.ergebnisRoh)} unter der Freigrenze —
                    zusammen mit den weiteren Geschäften des Jahres ({eur(r.jahresSumme)}) ist sie
                    aber überschritten, und damit ist der volle Gewinn steuerpflichtig.
                  </div>
                )}
                {r.steuerfreiAb && !r.spekulationsfrei && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Steuerfrei ab: <strong>{fmtDatum(r.steuerfreiAb)}</strong></div>
                )}
                {!r.steuerfreiGrund && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                      <span style={{ color: "var(--muted)" }}>Veräußerungsgewinn</span><span style={{ fontWeight: 600 }}>{eur(r.veraeusserungsgewinn)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                      <span style={{ color: "var(--muted)" }}>Spekulationssteuer</span><span style={{ fontWeight: 600, color: "var(--red)" }}>−{eur(r.spekulationssteuer)}</span>
                    </div>
                  </>
                )}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Netto-Erlös nach Tilgung, Kosten &amp; Steuer</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: r.nettoErloes >= 0 ? "var(--green)" : "var(--red)" }}>{eur(r.nettoErloes)}</div>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--faint)", display: "flex", gap: 7 }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Überschlägige Rechnung, keine Steuerberatung. § 23 EStG kennt Ausnahmen (z. B. Eigennutzung im Verkaufsjahr + 2 Vorjahren = steuerfrei). Bei Verkauf mehrerer Objekte in kurzer Zeit droht der gewerbliche Grundstückshandel („Drei-Objekt-Grenze").</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
