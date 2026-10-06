"use client";

// Die Seiten des Sanierungs-Guides — EINE Darstellung je Seite, benutzt vom Guide (eine Seite je
// Bildschirm) UND von der Übersicht (alle untereinander). Was offen ist, entscheidet nur
// `offeneSeiten()` (lib/sanierung/guide.ts); gerechnet wird nur in lib/sanierung/auswertung.ts.

import { Copy, Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { euro } from "@/lib/format";
import { MASSNAHMEN, flaechen, type MassnahmeId } from "@/lib/sanierung/rechner";
import {
  ALTBELAEGE,
  RAUM_TYPEN,
  WER_GEWERKE,
  massDe,
  mitKopie,
  neuerPosten,
  type Altbelag,
  type Entsorgung,
  type Entwurf,
  type LohnFeld,
  type PostenFeld,
  type RaumFeld,
  type RaumTyp,
  type Wissen,
  type ZustandGewerkId,
  type GewerkFeld,
} from "@/lib/sanierung/eingabe";
import {
  fragtBoden,
  fragtTapete,
  fragtWandfliesen,
  mitTyp,
  relevanteGewerke,
  setzeAnzahl,
  type SeiteId,
} from "@/lib/sanierung/guide";
import { altbauRisiko, mengeVorschlag, raeumeMitMassen, type Auswertung } from "@/lib/sanierung/auswertung";
import { ARBEITEN, preisSpanne, type ArbeitId } from "@/lib/sanierung/arbeiten";
import { ZUSTAND_ANNAHME, arbeitenDesGewerks, gemeinschaftsPruefpunkte, vorauswahl, type Zustand } from "@/lib/sanierung/zustand";
import { FOERDER_ARTEN, type FoerderArt } from "@/lib/sanierung/foerderung";
import { zahlDe0 } from "@/lib/zahl";

export type Aendern = (f: (e: Entwurf) => Entwurf) => void;
export type SeitenProps = { e: Entwurf; aendern: Aendern; auswertung: Auswertung; neueId: () => string };

const zahl = (n: number, stellen = 1) => n.toLocaleString("de-DE", { maximumFractionDigits: stellen });

/** Auswahl als Chips (Radio) — dieselbe Optik wie die Maßnahmen. */
function Wahl<T extends string>({ name, wert, optionen, setzen }: { name: string; wert: T | ""; optionen: { id: T; label: string }[]; setzen: (v: T) => void }) {
  return (
    <div className="massnahmen-wahl" role="radiogroup" aria-label={name}>
      {optionen.map((o) => (
        <label key={o.id} className="massnahme-chip">
          <input type="radio" name={name} checked={wert === o.id} onChange={() => setzen(o.id)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const WISSEN: { id: Wissen; label: string }[] = [
  { id: "ja", label: "Ja" },
  { id: "nein", label: "Nein" },
  { id: "unbekannt", label: "Weiß ich nicht" },
];

/** Eine Frage mit festem Erklärtext darunter (keine Statusmeldung — steht immer da, wenn übergeben). */
function Frage({ titel, children, erklaerung }: { titel: string; children: React.ReactNode; erklaerung?: React.ReactNode }) {
  return (
    <div className="guide-frage">
      <div className="guide-frage-titel">{titel}</div>
      {children}
      {erklaerung != null && <div className="sanierung-klein">{erklaerung}</div>}
    </div>
  );
}

const setRaum = (aendern: Aendern, id: string, teil: Partial<RaumFeld>) =>
  aendern((e) => ({ ...e, raeume: e.raeume.map((r) => (r.id === id ? { ...r, ...teil } : r)) }));

// ---- 1–5: Projekt, Objekt, Eckdaten, Ziel, Arbeit ------------------------------------------------

function ProjektSeite({ e, aendern }: SeitenProps) {
  return (
    <div className="form-group guide-feld">
      <label htmlFor="g-name">Name</label>
      <input id="g-name" className="input" placeholder="z. B. Wohnung Lindenstraße" value={e.projekt.name} onChange={(x) => aendern((d) => ({ ...d, projekt: { ...d.projekt, name: x.target.value } }))} />
    </div>
  );
}

function ObjektSeite({ e, aendern }: SeitenProps) {
  return (
    <div className="form-group guide-feld">
      <label htmlFor="g-adresse">Adresse (optional)</label>
      <input id="g-adresse" className="input" placeholder="Straße, Ort" value={e.projekt.adresse} onChange={(x) => aendern((d) => ({ ...d, projekt: { ...d.projekt, adresse: x.target.value } }))} />
    </div>
  );
}

function EckdatenSeite({ e, aendern }: SeitenProps) {
  const p = e.projekt;
  const setP = (teil: Partial<Entwurf["projekt"]>) => aendern((d) => ({ ...d, projekt: { ...d.projekt, ...teil } }));
  return (
    <>
      <Frage titel="Ist es eine Eigentumswohnung?" erklaerung="Dann gehören z. B. die Fenster der Gemeinschaft — sie zählen nicht als deine Kosten.">
        <Wahl name="g-etw" wert={p.etw} optionen={[{ id: "ja", label: "Ja" }, { id: "nein", label: "Nein" }]} setzen={(v) => setP({ etw: v })} />
      </Frage>
      <div className="guide-felder">
        <div className="form-group">
          <label htmlFor="g-baujahr">Baujahr</label>
          <input id="g-baujahr" className="input" inputMode="numeric" placeholder="z. B. 1972" disabled={p.baujahrUnbekannt} value={p.baujahr} onChange={(x) => setP({ baujahr: x.target.value.replace(/\D/g, "").slice(0, 4) })} />
        </div>
        <div className="form-group">
          <label htmlFor="g-wohnflaeche">Wohnfläche m²</label>
          <input id="g-wohnflaeche" className="input" inputMode="decimal" value={p.wohnflaeche} onChange={(x) => setP({ wohnflaeche: x.target.value })} />
        </div>
      </div>
      <label className="sanierung-eigen">
        <input type="checkbox" checked={p.baujahrUnbekannt} onChange={(x) => setP({ baujahrUnbekannt: x.target.checked })} />
        Baujahr weiß ich nicht — wird behandelt wie vor 1993 (Asbest möglich)
      </label>
    </>
  );
}

function ZielSeite({ e, aendern }: SeitenProps) {
  const p = e.projekt;
  return (
    <>
      <Frage titel="Was hast du vor?">
        <Wahl name="g-nutzung" wert={p.nutzung} optionen={[{ id: "vermieten", label: "Vermieten" }, { id: "eigennutzen", label: "Selbst wohnen" }]} setzen={(v) => aendern((d) => ({ ...d, projekt: { ...d.projekt, nutzung: v } }))} />
      </Frage>
      <div className="form-group guide-feld">
        <label htmlFor="g-budget">Budget € (optional)</label>
        <input id="g-budget" className="input" inputMode="decimal" placeholder="zum Vergleich im Ergebnis" value={p.budget} onChange={(x) => aendern((d) => ({ ...d, projekt: { ...d.projekt, budget: x.target.value } }))} />
      </div>
    </>
  );
}

function ArbeitSeite({ e, aendern }: SeitenProps) {
  return (
    <>
      {WER_GEWERKE.map((g) => (
        <Frage key={g.id} titel={g.label}>
          <Wahl
            name={`g-wer-${g.id}`}
            wert={e.projekt.wer[g.id]}
            optionen={[{ id: "selbst", label: "Mache ich selbst" }, { id: "handwerker", label: "Handwerker" }]}
            setzen={(v) => aendern((d) => ({ ...d, projekt: { ...d.projekt, wer: { ...d.projekt.wer, [g.id]: v } } }))}
          />
        </Frage>
      ))}
      <p className="sanierung-klein">
        Selbst: Material aus dem Baumarkt, deine Zeit trägst du unter „Eigene Posten“ ein. Handwerker: Preis je m² aus
        Preisquellen — beim Maler mit Material, bei Boden und Fliesen nur die Arbeit (das Material kommt dazu).
      </p>
    </>
  );
}

// ---- 6–9: Räume, Maße, Maßnahmen, Ist-Zustand --------------------------------------------------

function RaeumeSeite({ e, aendern, neueId }: SeitenProps) {
  const ohneTyp = e.raeume.filter((r) => r.typ === "");
  return (
    <>
      <div className="guide-zaehler-liste">
        {RAUM_TYPEN.map((t) => {
          const n = e.raeume.filter((r) => r.typ === t.id).length;
          const setzen = (anzahl: number) => aendern((d) => ({ ...d, raeume: setzeAnzahl(d.raeume, t.id, anzahl, neueId).raeume }));
          return (
            <div key={t.id} className="guide-zaehler">
              <span>{t.label}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`${t.label} weniger`} disabled={n === 0} onClick={() => setzen(n - 1)}><Minus size={14} /></button>
              <span className="zahl guide-zaehler-zahl" aria-live="polite">{n}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`${t.label} mehr`} onClick={() => setzen(n + 1)}><Plus size={14} /></button>
            </div>
          );
        })}
      </div>
      <p className="sanierung-klein">Ein Raum mit eingetragenen Maßen fällt beim Verringern nicht weg — den löschst du bei den Maßen.</p>
      {ohneTyp.length > 0 && (
        <Frage titel="Räume ohne Art">
          {ohneTyp.map((r) => (
            <div key={r.id} className="guide-feld form-group">
              <label htmlFor={`${r.id}-typ`}>{r.name || "Raum"}</label>
              <select id={`${r.id}-typ`} className="input" value="" onChange={(x) => aendern((d) => ({ ...d, raeume: mitTyp(d.raeume, r.id, x.target.value as RaumTyp) }))}>
                <option value="" disabled>Art wählen</option>
                {RAUM_TYPEN.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          ))}
        </Frage>
      )}
    </>
  );
}

function MasseSeite({ e, aendern, neueId, auswertung }: SeitenProps) {
  if (e.raeume.length === 0) return <p className="sanierung-leer">Lege zuerst die Räume an.</p>;
  return (
    <div className="sanierung-raeume">
      {e.raeume.map((r) => {
        const aus = auswertung.raeume.find((x) => x.id === r.id);
        const f = flaechen({ laenge: massDe(r.laenge), breite: massDe(r.breite), hoehe: massDe(r.hoehe), oeffnungen: massDe(r.oeffnungen) });
        return (
          <div key={r.id} className="sanierung-raum">
            <div className="sanierung-raum-kopf">
              <input className="input sanierung-raum-name" aria-label="Name des Raums" value={r.name} onChange={(x) => setRaum(aendern, r.id, { name: x.target.value })} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`${r.name || "Raum"} kopieren`} title="Raum kopieren" onClick={() => aendern((d) => ({ ...d, raeume: mitKopie(d.raeume, r.id, neueId()) }))}><Copy size={14} /></button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`${r.name || "Raum"} entfernen`} onClick={() => aendern((d) => ({ ...d, raeume: d.raeume.filter((x) => x.id !== r.id) }))}><Trash2 size={14} /></button>
            </div>
            <div className="sanierung-masse">
              {(
                [
                  ["laenge", "Länge m"],
                  ["breite", "Breite m"],
                  ["hoehe", "Höhe m"],
                  ["oeffnungen", "Fenster + Türen m²"],
                ] as const
              ).map(([feld, label]) => (
                <div className="form-group" key={feld}>
                  <label htmlFor={`${r.id}-${feld}`}>{label}</label>
                  <input id={`${r.id}-${feld}`} inputMode="decimal" value={r[feld]} onChange={(x) => setRaum(aendern, r.id, { [feld]: x.target.value })} />
                </div>
              ))}
            </div>
            <label className="sanierung-eigen">
              <input type="checkbox" checked={r.masseGeschaetzt} onChange={(x) => setRaum(aendern, r.id, { masseGeschaetzt: x.target.checked })} />
              Noch nicht gemessen — aus der Wohnfläche schätzen
            </label>
            <div className="sanierung-klein">
              {f.boden > 0
                ? `Wand ${zahl(f.wand)} m² · Decke ${zahl(f.decke)} m² · Boden ${zahl(f.boden)} m² · Umfang ${zahl(f.umfang)} m`
                : aus?.geschaetzt
                  ? `Geschätzt: Boden ${zahl(aus.laenge * aus.breite)} m²`
                  : "Noch keine Maße"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MassnahmenSeite({ e, aendern }: SeitenProps) {
  if (e.raeume.length === 0) return <p className="sanierung-leer">Lege zuerst die Räume an.</p>;
  const umschalten = (r: RaumFeld, id: MassnahmeId) =>
    setRaum(aendern, r.id, { massnahmen: r.massnahmen.includes(id) ? r.massnahmen.filter((m) => m !== id) : [...r.massnahmen, id], massnahmenBestaetigt: true });
  return (
    <div className="sanierung-raeume">
      {e.raeume.map((r) => {
        const hinweise = MASSNAHMEN.filter((m) => m.hinweis && r.massnahmen.includes(m.id));
        return (
          <div key={r.id} className="sanierung-raum">
            <div className="guide-raum-kopf">
              <strong>{r.name || "Raum"}</strong>
              {!r.massnahmenBestaetigt && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRaum(aendern, r.id, { massnahmenBestaetigt: true })}>
                  Vorschlag passt
                </button>
              )}
            </div>
            <div className="massnahmen-wahl" role="group" aria-label={`Maßnahmen in ${r.name || "diesem Raum"}`}>
              {MASSNAHMEN.map((m) => (
                <label key={m.id} className="massnahme-chip">
                  <input type="checkbox" checked={r.massnahmen.includes(m.id)} onChange={() => umschalten(r, m.id)} />
                  {m.label}
                </label>
              ))}
            </div>
            {r.massnahmen.includes("wand_fliesen") && (
              <div className="form-group sanierung-fliesenhoehe">
                <label htmlFor={`${r.id}-fliesenhoehe`}>Fliesenhöhe m (leer = bis zur Decke)</label>
                <input id={`${r.id}-fliesenhoehe`} inputMode="decimal" placeholder="z. B. 1,20" value={r.fliesenhoehe} onChange={(x) => setRaum(aendern, r.id, { fliesenhoehe: x.target.value })} />
              </div>
            )}
            {hinweise.length > 0 && (
              <ul className="sanierung-hinweise">
                {hinweise.map((m) => <li key={m.id}>{m.hinweis}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IstSeite({ e, aendern }: SeitenProps) {
  const altbau = altbauRisiko(e);
  const raeume = e.raeume.filter((r) => fragtTapete(r) || fragtBoden(r) || fragtWandfliesen(r));
  if (raeume.length === 0) return <p className="sanierung-leer">In keinem Raum wird an Wand oder Boden gearbeitet — hier gibt es nichts zu fragen.</p>;
  return (
    <div className="sanierung-raeume">
      {raeume.map((r) => {
        const verdacht = altbau && fragtBoden(r) && (r.altbelag === "pvc" || r.altbelag === "unbekannt");
        return (
          <div key={r.id} className="sanierung-raum">
            <strong>{r.name || "Raum"}</strong>
            {fragtTapete(r) && (
              <Frage titel="Alte Tapete drauf, die runter muss?">
                <Wahl name={`${r.id}-tapete`} wert={r.tapeteRunter} optionen={WISSEN} setzen={(v) => setRaum(aendern, r.id, { tapeteRunter: v })} />
              </Frage>
            )}
            {fragtBoden(r) && (
              <>
                <div className="form-group guide-feld">
                  <label htmlFor={`${r.id}-altbelag`}>Was liegt heute auf dem Boden?</label>
                  <select id={`${r.id}-altbelag`} className="input" value={r.altbelag} onChange={(x) => setRaum(aendern, r.id, { altbelag: x.target.value as Altbelag })}>
                    <option value="" disabled>Bitte wählen</option>
                    {ALTBELAEGE.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
                {r.altbelag !== "" && r.altbelag !== "keiner" && (
                  <Frage titel="Muss der alte Boden raus?">
                    <Wahl name={`${r.id}-raus`} wert={r.belagRaus} optionen={[{ id: "ja", label: "Ja, raus" }, { id: "nein", label: "Nein, drüber verlegen" }]} setzen={(v) => setRaum(aendern, r.id, { belagRaus: v })} />
                  </Frage>
                )}
                {verdacht && (
                  <div className="sanierung-frist" role="note">
                    <TriangleAlert size={16} aria-hidden />
                    <span>Gebäude vor 1993: Bodenplatten und Kleber können Asbest enthalten. Nicht selbst entfernen und nicht überdecken, bevor er geprüft ist (§ 11 GefStoffV).</span>
                  </div>
                )}
              </>
            )}
            {fragtWandfliesen(r) && (
              <Frage titel="Alte Wandfliesen, die runter müssen?">
                <Wahl name={`${r.id}-wandfliesen`} wert={r.wandfliesenRaus} optionen={WISSEN} setzen={(v) => setRaum(aendern, r.id, { wandfliesenRaus: v })} />
              </Frage>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- 10: Zustand-Baukasten ---------------------------------------------------------------------

const ZUSTAND_WAHL: { id: Zustand | "unbekannt"; label: string }[] = [
  { id: "gut", label: "Gut" },
  { id: "mittel", label: "Mittel" },
  { id: "schlecht", label: "Schlecht" },
  { id: "unbekannt", label: "Weiß ich nicht" },
];

/** Menge und eigener Betrag einer Arbeit — dieselben Felder in Technik-Seite und Ergebnis. */
export function ArbeitFelder({ id, e, aendern, vorschlag }: { id: ArbeitId; e: Entwurf; aendern: Aendern; vorschlag: { menge: number; annahme: string | null } | null }) {
  const a = ARBEITEN[id];
  return (
    <div className="guide-arbeit-felder">
      <label className="guide-mini">
        Menge ({a.einheit.replace(/^je /, "")})
        <input className="input sanierung-preis" inputMode="decimal" placeholder={vorschlag ? zahl(vorschlag.menge, 2) : "eintragen"} value={e.arbeitMengen[id] ?? ""} onChange={(x) => aendern((d) => ({ ...d, arbeitMengen: { ...d.arbeitMengen, [id]: x.target.value } }))} />
      </label>
      <label className="guide-mini">
        Angebot €
        <input className="input sanierung-preis" inputMode="decimal" placeholder="optional" value={e.arbeitPreise[id] ?? ""} onChange={(x) => aendern((d) => ({ ...d, arbeitPreise: { ...d.arbeitPreise, [id]: x.target.value } }))} />
      </label>
      {vorschlag?.annahme && <span className="sanierung-klein">Vorschlag: {vorschlag.annahme}</span>}
    </div>
  );
}

function ZustandSeite({ e, aendern }: SeitenProps) {
  const etw = e.projekt.etw === "ja";
  const { raeume } = raeumeMitMassen(e);
  const setGewerk = (gewerk: ZustandGewerkId, teil: Partial<GewerkFeld>) =>
    aendern((d) => ({ ...d, gewerke: { ...d.gewerke, [gewerk]: { ...d.gewerke[gewerk], ...teil } } }));
  return (
    <div className="sanierung-raeume">
      {relevanteGewerke(e).map((g) => {
        const feld = e.gewerke[g.gewerk];
        return (
          <div key={g.gewerk} className="sanierung-raum">
            <strong>{g.titel}</strong>
            <ul className="sanierung-hinweise">
              {g.anzeichen.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <Wahl
              name={`z-${g.gewerk}`}
              wert={feld.zustand}
              optionen={ZUSTAND_WAHL}
              // Ein gewählter Zustand kreuzt vor; „weiß ich nicht“ wie „mittel“ (Annahme im Ergebnis).
              setzen={(v) => setGewerk(g.gewerk, { zustand: v, arbeiten: vorauswahl(g.gewerk, v === "unbekannt" ? ZUSTAND_ANNAHME : v, etw) })}
            />
            {feld.zustand !== "" && (
              <div className="sanierung-klein">
                {feld.zustand === "unbekannt" ? `Angenommen: ${g.stufen[ZUSTAND_ANNAHME]}` : g.stufen[feld.zustand]}
              </div>
            )}
            {feld.zustand !== "" && (
              <div className="guide-arbeiten">
                {arbeitenDesGewerks(g.gewerk).map((id) => {
                  const a = ARBEITEN[id];
                  const an = feld.arbeiten.includes(id);
                  const p = preisSpanne(a);
                  return (
                    <div key={id} className="guide-arbeit">
                      <label className="massnahme-chip">
                        <input type="checkbox" checked={an} onChange={() => setGewerk(g.gewerk, { arbeiten: an ? feld.arbeiten.filter((x) => x !== id) : [...feld.arbeiten, id] })} />
                        {a.label}
                      </label>
                      <span className="sanierung-klein zahl">
                        {p.min === p.max ? euro(p.min) : `${euro(p.min)} – ${euro(p.max)}`} {a.einheit}
                        {a.nurFachbetrieb ? " · Fachbetrieb" : ""}
                      </span>
                      {an && <ArbeitFelder id={id} e={e} aendern={aendern} vorschlag={mengeVorschlag(id, e, raeume)} />}
                    </div>
                  );
                })}
              </div>
            )}
            {etw && g.etwHinweis && <div className="sanierung-klein">Eigentumswohnung: {g.etwHinweis}</div>}
          </div>
        );
      })}
      {gemeinschaftsPruefpunkte(etw).map((p) => (
        <div key={p.gewerk} className="sanierung-raum">
          <strong>{p.titel} — Sache der Gemeinschaft</strong>
          <div className="sanierung-klein">{p.hinweis}</div>
        </div>
      ))}
    </div>
  );
}

// ---- 11–13: Abschluss, eigene Posten, Förderung -------------------------------------------------

const ENTSORGUNG: { id: Entsorgung; label: string }[] = [
  { id: "keine", label: "Keine (Sperrmüll, Wertstoffhof)" },
  { id: "bauschutt", label: "Container Bauschutt" },
  { id: "mischabfall", label: "Container Mischabfall" },
  { id: "beide", label: "Beide" },
  { id: "unbekannt", label: "Weiß ich nicht" },
];
const PUFFER = ["0", "10", "15", "20"];

function AbschlussSeite({ e, aendern }: SeitenProps) {
  const setP = (teil: Partial<Entwurf["projekt"]>) => aendern((d) => ({ ...d, projekt: { ...d.projekt, ...teil } }));
  return (
    <>
      <Frage titel="Entsorgung" erklaerung="„Weiß ich nicht“ übernimmt den Vorschlag aus deinem Rückbau (Fliesen → Bauschutt, Beläge → Mischabfall).">
        <Wahl name="g-entsorgung" wert={e.projekt.entsorgung} optionen={ENTSORGUNG} setzen={(v) => setP({ entsorgung: v })} />
      </Frage>
      <Frage titel="Puffer für Unvorhergesehenes" erklaerung="Wie viel Reserve du einplanst, entscheidest du — eine belegte Faustregel haben wir nicht gefunden.">
        <div className="massnahmen-wahl">
          <Wahl name="g-puffer" wert={PUFFER.includes(e.projekt.puffer) ? e.projekt.puffer : ""} optionen={PUFFER.map((p) => ({ id: p, label: `${p} %` }))} setzen={(v) => setP({ puffer: v })} />
          <input className="input guide-puffer" inputMode="decimal" aria-label="Eigener Puffer in Prozent" placeholder="eigener %" value={PUFFER.includes(e.projekt.puffer) ? "" : e.projekt.puffer} onChange={(x) => setP({ puffer: x.target.value })} />
        </div>
      </Frage>
    </>
  );
}

function PostenSeite({ e, aendern, neueId }: SeitenProps) {
  const setLohn = (id: string, teil: Partial<LohnFeld>) => aendern((d) => ({ ...d, lohn: d.lohn.map((l) => (l.id === id ? { ...l, ...teil } : l)) }));
  const setPosten = (id: string, teil: Partial<PostenFeld>) => aendern((d) => ({ ...d, eigene: d.eigene.map((p) => (p.id === id ? { ...p, ...teil } : p)) }));
  return (
    <div className="grid-2 sanierung-unten">
      <div>
        <div className="guide-frage-titel">Arbeitszeit</div>
        <div className="sanierung-klein" style={{ marginBottom: 8 }}>Stunden × dein Stundensatz — für dich, Helfer oder einen Handwerker</div>
        {e.lohn.map((l) => (
          <div key={l.id} className="sanierung-zeile">
            <input className="input" aria-label="Wer oder was" placeholder="z. B. Eigene Arbeit" value={l.bezeichnung} onChange={(x) => setLohn(l.id, { bezeichnung: x.target.value })} />
            <input className="input" inputMode="decimal" aria-label="Stunden" placeholder="Std." value={l.stunden} onChange={(x) => setLohn(l.id, { stunden: x.target.value })} />
            <input className="input" inputMode="decimal" aria-label="Euro je Stunde" placeholder="€/Std." value={l.satz} onChange={(x) => setLohn(l.id, { satz: x.target.value })} />
            <span className="zahl sanierung-betrag">{euro(zahlDe0(l.stunden) * zahlDe0(l.satz))}</span>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Zeile entfernen" onClick={() => aendern((d) => ({ ...d, lohn: d.lohn.filter((x) => x.id !== l.id) }))}><Trash2 size={14} /></button>
            <label className="sanierung-eigen">
              <input type="checkbox" checked={l.eigenleistung} onChange={(x) => setLohn(l.id, { eigenleistung: x.target.checked })} />
              Eigenleistung — kostet kein Geld, geht nicht in den Kauf-Assistenten
            </label>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => aendern((d) => ({ ...d, lohn: [...d.lohn, { id: neueId(), bezeichnung: "", stunden: "", satz: "", eigenleistung: false }] }))}><Plus size={14} /> Zeile</button>
      </div>
      <div>
        <div className="guide-frage-titel">Eigene Posten</div>
        <div className="sanierung-klein" style={{ marginBottom: 8 }}>Was du schon kennst — z. B. ein Angebot</div>
        {e.eigene.map((p) => (
          <div key={p.id} className="sanierung-zeile sanierung-zeile-posten">
            <input className="input" aria-label="Posten" placeholder="z. B. Küche laut Angebot" value={p.bezeichnung} onChange={(x) => setPosten(p.id, { bezeichnung: x.target.value })} />
            <input className="input" inputMode="decimal" aria-label="Betrag in Euro" placeholder="€" value={p.betrag} onChange={(x) => setPosten(p.id, { betrag: x.target.value })} />
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Posten entfernen" onClick={() => aendern((d) => ({ ...d, eigene: d.eigene.filter((x) => x.id !== p.id) }))}><Trash2 size={14} /></button>
            <select className="input sanierung-foerderart" aria-label={`Förderung für ${p.bezeichnung || "diesen Posten"}`} value={p.foerderung} onChange={(x) => setPosten(p.id, { foerderung: x.target.value as FoerderArt })}>
              {FOERDER_ARTEN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => aendern((d) => ({ ...d, eigene: [...d.eigene, neuerPosten(neueId())] }))}><Plus size={14} /> Posten</button>
      </div>
    </div>
  );
}

function FoerderSeite({ e, aendern }: SeitenProps) {
  const setF = (teil: Partial<Entwurf["foerder"]>) => aendern((d) => ({ ...d, foerder: { ...d.foerder, ...teil } }));
  return (
    <div className="sanierung-foerderung">
      <div className="sanierung-frist" role="note">
        <TriangleAlert size={16} aria-hidden />
        <span>
          <strong>Erst beantragen, dann beauftragen.</strong> Gefördert wird nur, wenn der Antrag steht, bevor du einen
          Handwerker beauftragst oder Material kaufst. Ein Vertrag mit der Bedingung „nur bei Förderzusage“ ist erlaubt.
        </span>
      </div>
      <div className="sanierung-foerder-wahl">
        <div className="form-group">
          <label htmlFor="foerder-we">Betroffene Wohneinheiten</label>
          <input id="foerder-we" inputMode="numeric" value={e.foerder.wohneinheiten} onChange={(x) => setF({ wohneinheiten: x.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="foerder-gebaeude">Gebäude</label>
          <select id="foerder-gebaeude" className="input" value={e.foerder.gebaeude} onChange={(x) => setF({ gebaeude: x.target.value === "haus" ? "haus" : "mfh" })}>
            <option value="mfh">Mehrfamilienhaus</option>
            <option value="haus">Ein-/Zweifamilienhaus</option>
          </select>
        </div>
        <label className="massnahme-chip sanierung-isfp">
          <input type="checkbox" checked={e.foerder.isfp} onChange={(x) => setF({ isfp: x.target.checked })} />
          Mit Sanierungsfahrplan (iSFP)
        </label>
      </div>
      <p className="sanierung-klein">
        Fenster und Wärmepumpe aus „Technik“ zählen automatisch mit. Spachteln, Streichen, Böden und Fliesen werden nicht
        gefördert. Dämmung oder Lüftung trägst du als eigenen Posten mit Förderart ein.
      </p>
    </div>
  );
}

export const SEITEN_INHALT: Record<SeiteId, (p: SeitenProps) => React.ReactElement> = {
  projekt: ProjektSeite,
  objekt: ObjektSeite,
  eckdaten: EckdatenSeite,
  ziel: ZielSeite,
  arbeit: ArbeitSeite,
  raeume: RaeumeSeite,
  masse: MasseSeite,
  massnahmen: MassnahmenSeite,
  ist: IstSeite,
  zustand: ZustandSeite,
  abschluss: AbschlussSeite,
  posten: PostenSeite,
  foerderung: FoerderSeite,
};
