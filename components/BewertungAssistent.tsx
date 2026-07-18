"use client";
import { useMemo, useState } from "react";
import { ExternalLink, TrendingUp, TriangleAlert, Info, Check } from "lucide-react";
import {
  ertragswert, sachwert, restnutzungsdauer, vervielfaeltiger, kaufpreisAmpel,
  NHK_TYPEN, GND_WOHNGEBAEUDE, type Bewertungsergebnis,
} from "@/lib/bewertung/immowertv";
import { BORIS_D, BORIS_LAENDER, LZ_DEFAULT } from "@/lib/bewertung/boris";
import { KAUF_BEWERTUNG_KEY, type KaufBewertung } from "@/lib/kauf/bewertung";
import { useToast } from "@/components/Toast";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const STANDARD = ["1 – sehr einfach", "2 – einfach", "3 – mittel", "4 – gehoben", "5 – hochwertig"];
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

export default function BewertungAssistent({
  imKaufFlow = false, onGespeichert,
}: {
  imKaufFlow?: boolean; onGespeichert?: () => void;
} = {}) {
  const jahr = new Date().getFullYear();
  const toast = useToast();
  const [zweck, setZweck] = useState<"kapitalanlage" | "eigennutzung">("kapitalanlage");
  const [land, setLand] = useState("");
  // gemeinsame Felder
  const [flaeche, setFlaeche] = useState("");
  const [grund, setGrund] = useState("");
  const [baujahr, setBaujahr] = useState("");
  const [brw, setBrw] = useState("");
  const [kaufpreis, setKaufpreis] = useState("");
  // Ertragswert
  const [miete, setMiete] = useState("");
  const [whg, setWhg] = useState("1");
  const [istEtw, setIstEtw] = useState(false);
  const [lz, setLz] = useState(String(LZ_DEFAULT.mfh));
  // Sachwert
  const [typ, setTyp] = useState("efh");
  const [stufe, setStufe] = useState("3");
  const [bpi, setBpi] = useState("1.9");
  const [regio, setRegio] = useState("1.0");
  const [swf, setSwf] = useState("1.0");
  const [modernisiert, setModernisiert] = useState(false);

  const borisUrl = useMemo(() => BORIS_LAENDER.find((b) => b.land === land)?.url ?? BORIS_D.url, [land]);
  const rnd = useMemo(
    () => (baujahr ? restnutzungsdauer(num(baujahr), jahr, GND_WOHNGEBAEUDE, modernisiert ? 1 : 0) : GND_WOHNGEBAEUDE),
    [baujahr, jahr, modernisiert],
  );

  const ergebnis: Bewertungsergebnis | null = useMemo(() => {
    if (zweck === "kapitalanlage") {
      if (!num(miete) || !num(flaeche)) return null;
      return ertragswert({
        jahresnettokaltmiete: num(miete), wohnflaeche: num(flaeche), anzahlWohnungen: Math.max(1, num(whg)),
        istEtw, bodenrichtwert: num(brw), grundstuecksflaeche: num(grund),
        liegenschaftszins: num(lz), restnutzungsdauer: rnd,
      });
    }
    if (!num(flaeche)) return null;
    return sachwert({
      typ, standardstufe: num(stufe), wohnflaeche: num(flaeche), baupreisindex: num(bpi),
      regionalfaktor: num(regio), restnutzungsdauer: rnd, bodenrichtwert: num(brw),
      grundstuecksflaeche: num(grund), sachwertfaktor: num(swf),
    });
  }, [zweck, miete, flaeche, whg, istEtw, brw, grund, lz, rnd, typ, stufe, bpi, regio, swf]);

  const vf = num(kaufpreis) && num(miete) ? vervielfaeltiger(num(kaufpreis), num(miete)) : null;
  const ampel = ergebnis && num(kaufpreis) ? kaufpreisAmpel(ergebnis.wert, num(kaufpreis)) : null;
  const ampelFarbe = ampel?.farbe === "gruen" ? "var(--green)" : ampel?.farbe === "rot" ? "var(--red)" : "var(--amber)";

  // Marktwert speichern → bleibt bei Punkt 1 sichtbar und wird in den Rechner übernommen.
  function speichern() {
    if (!ergebnis) return;
    const b: KaufBewertung = {
      marktwert: ergebnis.wert, min: ergebnis.min, max: ergebnis.max,
      kaufpreis: num(kaufpreis), flaeche: num(flaeche),
      jahresmiete: zweck === "kapitalanlage" ? num(miete) : 0,
      gespeichertAm: new Date().toISOString().slice(0, 10),
    };
    try { localStorage.setItem(KAUF_BEWERTUNG_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    toast("Marktwert gespeichert und in den Rechner übernommen.");
    onGespeichert?.();
  }

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* -------- Eingaben -------- */}
      <div className="form-box" style={{ flex: "1 1 440px", maxWidth: 560 }}>
        <h3>Marktwert schätzen</h3>
        <p>Nach den Modellen der ImmoWertV 2021. Orientierungswert — kein Gutachten (§ 194 BauGB).</p>

        <div className="form-section-label">Nutzung</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          {(["kapitalanlage", "eigennutzung"] as const).map((z) => (
            <button key={z} type="button" onClick={() => setZweck(z)}
              className={`btn ${zweck === z ? "btn-gold" : "btn-ghost"}`} style={{ flex: 1, fontSize: 12.5 }}>
              {z === "kapitalanlage" ? "Vermietet (Ertragswert)" : "Eigennutzung (Sachwert)"}
            </button>
          ))}
        </div>

        <div className="form-section-label">Objekt</div>
        <div className="form-row">
          <div className="form-group"><label>Wohnfläche (m²)</label><input value={flaeche} onChange={(e) => setFlaeche(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label>Grundstück (m²)</label><input value={grund} onChange={(e) => setGrund(e.target.value)} inputMode="decimal" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Baujahr</label><input value={baujahr} onChange={(e) => setBaujahr(e.target.value)} inputMode="numeric" placeholder="z. B. 1995" /></div>
          <div className="form-group"><label>Kaufpreis (€)</label><input value={kaufpreis} onChange={(e) => setKaufpreis(e.target.value)} inputMode="decimal" /></div>
        </div>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7, color: "var(--muted)" }}>
          <input type="checkbox" checked={modernisiert} onChange={(e) => setModernisiert(e.target.checked)} style={{ width: "auto" }} />
          durchgreifend modernisiert (hebt die Restnutzungsdauer — aktuell {rnd} J.)
        </label>

        <div className="form-section-label">Bodenwert</div>
        <div className="form-row">
          <div className="form-group"><label>Bundesland (für BORIS-Link)</label>
            <select value={land} onChange={(e) => setLand(e.target.value)}>
              <option value="">– wählen –</option>
              {BORIS_LAENDER.map((b) => <option key={b.land} value={b.land}>{b.land}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Bodenrichtwert (€/m²)</label><input value={brw} onChange={(e) => setBrw(e.target.value)} inputMode="decimal" /></div>
        </div>
        <a href={borisUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}>
          <ExternalLink size={13} style={{ verticalAlign: "-2px" }} /> Bodenrichtwert nachschlagen{land ? ` (${land})` : " (BORIS-D)"}
        </a>

        {zweck === "kapitalanlage" ? (
          <>
            <div className="form-section-label">Ertrag</div>
            <div className="form-row">
              <div className="form-group"><label>Jahresnettokaltmiete (€)</label><input value={miete} onChange={(e) => setMiete(e.target.value)} inputMode="decimal" placeholder="marktüblich, ohne NK" /></div>
              <div className="form-group"><label>Anzahl Wohnungen</label><input value={whg} onChange={(e) => setWhg(e.target.value)} inputMode="numeric" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Liegenschaftszins (%)</label><input value={lz} onChange={(e) => setLz(e.target.value)} inputMode="decimal" /></div>
              <div className="form-group" style={{ justifyContent: "flex-end" }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7, color: "var(--muted)" }}>
                  <input type="checkbox" checked={istEtw} onChange={(e) => setIstEtw(e.target.checked)} style={{ width: "auto" }} /> Eigentumswohnung (WEG)
                </label>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="form-section-label">Substanz</div>
            <div className="form-row">
              <div className="form-group"><label>Gebäudetyp</label>
                <select value={typ} onChange={(e) => setTyp(e.target.value)}>{NHK_TYPEN.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
              </div>
              <div className="form-group"><label>Ausstattungsstandard</label>
                <select value={stufe} onChange={(e) => setStufe(e.target.value)}>{STANDARD.map((s, i) => <option key={i} value={i + 1}>{s}</option>)}</select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Baupreisindex-Faktor</label><input value={bpi} onChange={(e) => setBpi(e.target.value)} inputMode="decimal" /></div>
              <div className="form-group"><label>Regionalfaktor</label><input value={regio} onChange={(e) => setRegio(e.target.value)} inputMode="decimal" /></div>
            </div>
            <div className="form-group"><label>Sachwertfaktor (Marktanpassung)</label><input value={swf} onChange={(e) => setSwf(e.target.value)} inputMode="decimal" /></div>
          </>
        )}
      </div>

      {/* -------- Ergebnis -------- */}
      <div style={{ flex: "1 1 340px", minWidth: 300 }}>
        <div className="section">
          <div className="section-header"><h3><TrendingUp size={15} style={{ verticalAlign: "-2px" }} /> Geschätzter Marktwert</h3></div>
          <div className="section-body">
            {!ergebnis ? (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>
                {zweck === "kapitalanlage" ? "Miete und Wohnfläche eingeben." : "Wohnfläche eingeben."} für ein Ergebnis.
              </p>
            ) : (
              <>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{eur(ergebnis.wert)}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Spanne: {eur(ergebnis.min)} – {eur(ergebnis.max)}</div>

                {ampel && (
                  <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "var(--bg3)", borderLeft: `3px solid ${ampelFarbe}`, fontSize: 12.5, color: ampelFarbe, fontWeight: 500 }}>
                    {ampel.text}
                  </div>
                )}
                {vf && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
                    Kaufpreisfaktor: <strong style={{ color: "var(--text)" }}>{vf.faktor}×</strong> Jahresmiete — {vf.hinweis}
                  </div>
                )}

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", display: "grid", gap: 5 }}>
                  {Object.entries(ergebnis.details).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>{k}</span>
                      <span style={{ fontWeight: 500 }}>{v.toLocaleString("de-DE")}</span>
                    </div>
                  ))}
                </div>

                {ergebnis.warnungen.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {ergebnis.warnungen.map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--amber)", marginBottom: 5 }}>
                        <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {imKaufFlow && (
                  <button type="button" className="btn btn-gold" style={{ marginTop: 14, fontSize: 13 }} onClick={speichern}>
                    <Check size={14} style={{ verticalAlign: "-2px" }} /> Marktwert speichern &amp; übernehmen
                  </button>
                )}
              </>
            )}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--faint)", display: "flex", gap: 7 }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Orientierungswert nach den Modellen der ImmoWertV 2021 — ersetzt kein Verkehrswertgutachten (§ 194 BauGB). Liegenschaftszins bzw. Sachwertfaktor bestimmen das Ergebnis stark; den örtlichen Wert aus dem Grundstücksmarktbericht des Gutachterausschusses verwenden.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
