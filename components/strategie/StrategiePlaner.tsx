"use client";

// Strategie-Planer (BuyImmo, Umbau 06.10.2026): Kaufschritte über zehn Jahre als Stammbaum. Gerechnet
// wird nur in lib/strategie.ts — hier wird eingegeben und angezeigt. Der Plan liegt im Browser
// (localStorage, in try/catch); Speichern ins Konto kommt mit einer eigenen Tabelle, wenn die Stufe
// steht. Keine Empfehlung: Der Nutzer wählt die Taktik, die Rechnung zeigt Folgen nach SEINEN Annahmen.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { euro } from "@/lib/format";
import { BUNDESLAENDER } from "@/lib/kalk";
import {
  HORIZONT_JAHRE,
  MAX_KAEUFE,
  OHNE_OBJEKT_ID,
  SZENARIO_VORSICHTIG,
  TAKTIKEN,
  WURZEL_ID,
  geldAus,
  kinder,
  leereStrategie,
  moeglicheQuellen,
  neuerKauf,
  rechneStrategie,
  strategieAus,
  taktik,
  type BestandObjekt,
  type KaufErgebnis,
  type KaufSchritt,
  type StrategieEntwurf,
  type TaktikId,
} from "@/lib/strategie";

const SPEICHER = "buyimmo:strategie";

const neueId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

type Feld = Exclude<keyof StrategieEntwurf, "version" | "kaeufe" | "grest">;
const ANNAHMEN: { key: Feld; label: string; einheit: string; hilfe: string }[] = [
  { key: "zins", label: "Sollzins", einheit: "% p. a.", hilfe: "Beispielzins wie im Kauf-Assistenten — real nennt ihn deine Bank." },
  { key: "tilgung", label: "Tilgung", einheit: "% p. a.", hilfe: "Anfangstilgung je Darlehen." },
  { key: "wertentwicklung", label: "Wertentwicklung", einheit: "% p. a.", hilfe: "0 = Werte bleiben gleich. Eine Steigerung ist eine Annahme, keine Zusage." },
  { key: "bewirtschaftung", label: "Bewirtschaftung", einheit: "% der Miete", hilfe: "Nicht umlegbare Kosten und Rücklage, wie im Objekt-Rechner." },
  { key: "beleihungsgrenze", label: "Beleihungsgrenze", einheit: "% vom Wert", hilfe: "Bis zu welchem Anteil des Werts ein Objekt beliehen werden kann. Banken rechnen mit ihrem Beleihungswert." },
  { key: "makler", label: "Makler beim Kauf", einheit: "%", hilfe: "Käuferanteil der Provision; 0 ohne Makler." },
  { key: "verkaufskosten", label: "Kosten beim Verkauf", einheit: "% vom Wert", hilfe: "Z. B. Makler beim Verkauf." },
];

export default function StrategiePlaner({
  bestand,
  erspartesStart,
  startJahr,
}: {
  bestand: BestandObjekt[];
  /** Eigenkapital aus der Selbstauskunft — Vorschlag fürs Ersparte, änderbar. */
  erspartesStart: number;
  startJahr: number;
}) {
  const [e, setE] = useState<StrategieEntwurf>(() => leereStrategie(erspartesStart));
  const [geladen, setGeladen] = useState(false);
  const [szenario, setSzenario] = useState<"annahmen" | "vorsichtig">("annahmen");

  // Plan erst nach dem Mount lesen — beim Server-Rendern gibt es keinen Browser-Speicher.
  useEffect(() => {
    try {
      const roh = localStorage.getItem(SPEICHER);
      const gelesen = roh ? strategieAus(JSON.parse(roh)) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserwert erst nach dem Mount lesen (Hydration)
      if (gelesen) setE(gelesen);
    } catch {
      /* kaputter oder gesperrter Speicher: mit leerem Plan weiter */
    }
    setGeladen(true);
  }, []);

  useEffect(() => {
    if (!geladen) return;
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(e));
    } catch {
      /* privates Fenster o. Ä. */
    }
  }, [e, geladen]);

  const annahmen = useMemo(() => rechneStrategie(e, bestand, startJahr), [e, bestand, startJahr]);
  const vorsichtig = useMemo(() => rechneStrategie(e, bestand, startJahr, SZENARIO_VORSICHTIG), [e, bestand, startJahr]);
  const vorsichtigJe = useMemo(() => new Map(vorsichtig.kaeufe.map((k) => [k.id, k])), [vorsichtig]);
  const jahre = (szenario === "annahmen" ? annahmen : vorsichtig).jahre;

  const setFeld = (key: Feld | "grest", wert: string) => setE((d) => ({ ...d, [key]: wert }));
  const setKauf = (id: string, teil: Partial<KaufSchritt>) => setE((d) => ({ ...d, kaeufe: d.kaeufe.map((k) => (k.id === id ? { ...k, ...teil } : k)) }));
  const jahreAuswahl = Array.from({ length: HORIZONT_JAHRE + 1 }, (_, i) => startJahr + i);
  const bestandQuellen = bestand.map((b) => ({ id: b.id, name: b.name }));

  const setTaktik = (k: KaufSchritt, id: TaktikId) => {
    const t = taktik(id);
    const quellen = moeglicheQuellen(e.kaeufe, k, bestandQuellen);
    const quelle = t.quelle ? (quellen.some((q) => q.id === k.quelle) ? k.quelle : (quellen[0]?.id ?? "")) : k.quelle;
    setKauf(k.id, { taktik: id, quelle });
  };

  /** Beispiel für Einsteiger — klar als Beispiel benannt, überschreibt nur die Kaufschritte. */
  const beispiel = () => {
    const a = neueId();
    setE((d) => ({
      ...d,
      sparrate: d.sparrate || "800",
      kaeufe: [
        { ...neuerKauf(a, startJahr), name: "Beispiel: erste Wohnung", kaufpreis: "180000", kaltmiete: "650", taktik: "ansparen", ekAnteil: "20" },
        { ...neuerKauf(neueId(), startJahr + 3), name: "Beispiel: zweite Wohnung", kaufpreis: "200000", kaltmiete: "720", taktik: "beleihung", ekAnteil: "10", quelle: a },
      ],
    }));
  };

  const knoten = (r: KaufErgebnis) => {
    const v = vorsichtigJe.get(r.id);
    const t = taktik(r.taktik);
    return (
      <li key={r.id}>
        <div className={`baum-knoten${r.gedeckt ? "" : " offen"}`}>
          <div className="baum-kopf">
            <span className="baum-jahr zahl">{r.jahr}</span>
            <strong>{r.name}</strong>
            <span className="badge badge-neutral">{t.titel}</span>
          </div>
          {r.grund ? (
            <div className="baum-zeile">{r.grund}</div>
          ) : (
            <>
              <div className="baum-zeile zahl">
                Kaufpreis {euro(r.kaufpreis)} · Nebenkosten {euro(r.nebenkosten)} · Eigenkapital nötig {euro(r.ekBedarf)}
              </div>
              {r.erloes !== 0 && <div className="baum-zeile zahl">Verkaufserlös nach Kosten und Schulden: {euro(r.erloes)}</div>}
              {r.gedeckt ? (
                <div className="baum-zeile zahl">
                  <span className="baum-status gedeckt">Rechnerisch gedeckt</span>
                  {r.ausBeleihung > 0 && <> · {euro(r.ausBeleihung)} aus Beleihung</>}
                  {r.ausErspartem > 0 && <> · {euro(r.ausErspartem)} aus Erspartem</>}
                  {" "}· Rate {euro(r.rateMo)}/Mo. · Miete nach Kosten minus Rate {euro(r.ueberschussMo)}/Mo.
                </div>
              ) : (
                <div className="baum-zeile zahl">
                  <span className="baum-status luecke">Rechnerische Lücke {euro(r.luecke)}</span> · Erspartes zu dem Zeitpunkt {euro(Math.max(0, r.verfuegbar))}
                </div>
              )}
              {v && v.gedeckt !== r.gedeckt && (
                <div className="baum-zeile">
                  Vorsichtig gerechnet (Zins +1 Prozentpunkt, keine Wertsteigerung):{" "}
                  {v.gedeckt ? "gedeckt" : <>Lücke {euro(v.luecke || v.ekBedarf)}</>}
                </div>
              )}
              {v && v.gedeckt && r.gedeckt && Math.round(v.ueberschussMo) !== Math.round(r.ueberschussMo) && (
                <div className="baum-zeile zahl">Vorsichtig: Miete nach Kosten minus Rate {euro(v.ueberschussMo)}/Mo.</div>
              )}
            </>
          )}
          {r.hinweise.map((h) => (
            <div key={h} className="baum-zeile baum-hinweis">{h}</div>
          ))}
        </div>
        {kinder(annahmen.kaeufe, r.id).length > 0 && <ul>{kinder(annahmen.kaeufe, r.id).map(knoten)}</ul>}
      </li>
    );
  };

  const bestandMitKindern = bestand.filter((b) => kinder(annahmen.kaeufe, b.id).length > 0);
  // Der Sammelposten „Kredite ohne Objekt“ ist kein Objekt.
  const objektZahl = bestand.filter((b) => b.id !== OHNE_OBJEKT_ID).length;
  const bestandWert = bestand.reduce((s, b) => s + b.wert, 0);
  const bestandSchulden = bestand.reduce((s, b) => s + b.kredite.reduce((t, k) => t + k.restschuld, 0), 0);

  // `data-demo-erlaubt`: In der Demo bedienbar — der Plan liegt nur im Browser des Besuchers.
  return (
    <div className="strategie" data-demo-erlaubt>
      <div className="section">
        <div className="section-header">
          <div>
            <h3>Dein Start</h3>
            <div className="section-sub">Was du heute hast und im Monat zurücklegst</div>
          </div>
        </div>
        <div className="section-body">
          <div className="strategie-felder">
            <label className="form-group">
              <span>Erspartes heute (€)</span>
              <input className="input" inputMode="decimal" value={e.erspartes} onChange={(x) => setFeld("erspartes", x.target.value)} placeholder="z. B. 40.000" />
              <small>{erspartesStart > 0 ? `Aus deiner Selbstauskunft: ${euro(erspartesStart)}` : "Geld, das du für Käufe einsetzen kannst"}</small>
            </label>
            <label className="form-group">
              <span>Sparrate (€ im Monat)</span>
              <input className="input" inputMode="decimal" value={e.sparrate} onChange={(x) => setFeld("sparrate", x.target.value)} placeholder="z. B. 800" />
              <small>Was du zurücklegst — inklusive Überschuss aus deinem Bestand</small>
            </label>
            <label className="form-group">
              <span>Bundesland (Grunderwerbsteuer)</span>
              <select className="input" value={e.grest} onChange={(x) => setFeld("grest", x.target.value)}>
                {BUNDESLAENDER.map((b) => (
                  <option key={b.l} value={String(b.v)}>{b.l}</option>
                ))}
              </select>
              <small>Wie im Objekt-Rechner, dazu Notar und Grundbuch</small>
            </label>
          </div>
          {bestand.length > 0 && (
            <p className="sanierung-klein" style={{ marginTop: 10 }}>
              Dein Bestand aus MyImmo: {objektZahl} {objektZahl === 1 ? "Objekt" : "Objekte"}, Wert {euro(bestandWert)},
              Schulden {euro(bestandSchulden)}. Er kann Kapital geben (Beleihung, Verkauf).
            </p>
          )}
          <details className="klapp">
            <summary>Annahmen <span className="klapp-hint">— Zins, Tilgung, Wertentwicklung und mehr, alle änderbar</span></summary>
            <div className="klapp-body strategie-felder">
              {ANNAHMEN.map((a) => (
                <label key={a.key} className="form-group">
                  <span>{a.label} ({a.einheit})</span>
                  <input className="input" inputMode="decimal" value={e[a.key]} onChange={(x) => setFeld(a.key, x.target.value)} />
                  <small>{a.hilfe}</small>
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Taktiken</h3>
            <div className="section-sub">Wie ein Kauf finanziert wird — du wählst je Kauf. Die Reihenfolge ist keine Rangfolge.</div>
          </div>
        </div>
        <div className="section-body strategie-taktiken">
          {TAKTIKEN.map((t) => (
            <details key={t.id} className="klapp">
              <summary>{t.titel}</summary>
              <div className="klapp-body">
                <p className="sanierung-klein" style={{ marginTop: 0 }}>{t.rechnung}</p>
                <ul className="strategie-risiken">
                  {t.risiken.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Deine Kaufschritte</h3>
            <div className="section-sub">Bis zu {MAX_KAEUFE} Käufe in den nächsten {HORIZONT_JAHRE} Jahren</div>
          </div>
          {e.kaeufe.length === 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={beispiel}>Beispiel laden</button>
          )}
        </div>
        <div className="section-body">
          {e.kaeufe.length === 0 && (
            <p className="sanierung-leer">
              Lege an, was du wann kaufen willst — oder lade das Beispiel (zwei Wohnungen, die zweite per Beleihung der ersten).
            </p>
          )}
          {e.kaeufe.map((k) => {
            const t = taktik(k.taktik);
            const quellen = moeglicheQuellen(e.kaeufe, k, bestandQuellen);
            return (
              <div key={k.id} className="strategie-kauf">
                <div className="strategie-felder">
                  <label className="form-group">
                    <span>Name</span>
                    <input className="input" value={k.name} onChange={(x) => setKauf(k.id, { name: x.target.value })} placeholder="z. B. Wohnung Kiel" />
                  </label>
                  <label className="form-group">
                    <span>Jahr</span>
                    <select className="input" value={k.jahr} onChange={(x) => setKauf(k.id, { jahr: x.target.value })}>
                      {jahreAuswahl.map((j) => <option key={j} value={String(j)}>{j}</option>)}
                    </select>
                  </label>
                  <label className="form-group">
                    <span>Kaufpreis (€)</span>
                    <input className="input" inputMode="decimal" value={k.kaufpreis} onChange={(x) => setKauf(k.id, { kaufpreis: x.target.value })} />
                  </label>
                  <label className="form-group">
                    <span>Kaltmiete (€/Monat)</span>
                    <input className="input" inputMode="decimal" value={k.kaltmiete} onChange={(x) => setKauf(k.id, { kaltmiete: x.target.value })} placeholder="leer = selbst wohnen" />
                  </label>
                  <label className="form-group">
                    <span>Taktik</span>
                    <select className="input" value={k.taktik} onChange={(x) => setTaktik(k, x.target.value as TaktikId)}>
                      {TAKTIKEN.map((x) => <option key={x.id} value={x.id}>{x.titel}</option>)}
                    </select>
                  </label>
                  {t.anteil && (
                    <label className="form-group">
                      <span>Eigenkapital-Anteil am Kaufpreis (%)</span>
                      <input className="input" inputMode="decimal" value={k.ekAnteil} onChange={(x) => setKauf(k.id, { ekAnteil: x.target.value })} />
                      <small>Zusätzlich zu den Nebenkosten</small>
                    </label>
                  )}
                  {t.quelle && (
                    <label className="form-group">
                      <span>{k.taktik === "verkauf" ? "Welches Objekt wird verkauft?" : "Welches Objekt wird beliehen?"}</span>
                      <select className="input" value={k.quelle} onChange={(x) => setKauf(k.id, { quelle: x.target.value })}>
                        <option value="">Bitte wählen</option>
                        {quellen.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                      </select>
                      {quellen.length === 0 && <small>Noch kein früheres Objekt — erst einen Kauf davor anlegen.</small>}
                    </label>
                  )}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setE((d) => ({ ...d, kaeufe: d.kaeufe.filter((x) => x.id !== k.id) }))}>
                  <Trash2 size={13} aria-hidden /> Entfernen
                </button>
              </div>
            );
          })}
          {e.kaeufe.length < MAX_KAEUFE && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setE((d) => ({ ...d, kaeufe: [...d.kaeufe, neuerKauf(neueId(), startJahr)] }))}>
              <Plus size={14} aria-hidden /> Kauf hinzufügen
            </button>
          )}
        </div>
      </div>

      {e.kaeufe.length > 0 && (
        <>
          <div className="section">
            <div className="section-header">
              <div>
                <h3>Dein Stammbaum</h3>
                <div className="section-sub">Ein Kauf, der Kapital aus einem früheren Objekt nimmt, hängt darunter.</div>
              </div>
            </div>
            <div className="section-body">
              <ul className="baum">
                <li>
                  <div className="baum-knoten wurzel">
                    <div className="baum-kopf">
                      <span className="baum-jahr zahl">{startJahr}</span>
                      <strong>Heute</strong>
                    </div>
                    <div className="baum-zeile zahl">
                      Erspartes {euro(geldAus(e.erspartes))}
                      {geldAus(e.sparrate) > 0 && <> · Sparrate {euro(geldAus(e.sparrate))}/Mo.</>}
                    </div>
                  </div>
                  <ul>
                    {bestandMitKindern.map((b) => (
                      <li key={b.id}>
                        <div className="baum-knoten bestand">
                          <div className="baum-kopf">
                            <strong>{b.name}</strong>
                            <span className="badge badge-neutral">Bestand</span>
                          </div>
                          <div className="baum-zeile zahl">Wert {euro(b.wert)} · Schulden {euro(b.kredite.reduce((s, k) => s + k.restschuld, 0))}</div>
                        </div>
                        <ul>{kinder(annahmen.kaeufe, b.id).map(knoten)}</ul>
                      </li>
                    ))}
                    {kinder(annahmen.kaeufe, WURZEL_ID).map(knoten)}
                  </ul>
                </li>
              </ul>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <div>
                <h3>Die nächsten {HORIZONT_JAHRE} Jahre</h3>
                <div className="section-sub">Jeweils am Jahresende</div>
              </div>
              <div className="tabs" role="tablist" aria-label="Szenario">
                <button type="button" role="tab" aria-selected={szenario === "annahmen"} className={`tab-btn${szenario === "annahmen" ? " active" : ""}`} onClick={() => setSzenario("annahmen")}>
                  Deine Annahmen
                </button>
                <button type="button" role="tab" aria-selected={szenario === "vorsichtig"} className={`tab-btn${szenario === "vorsichtig" ? " active" : ""}`} onClick={() => setSzenario("vorsichtig")}>
                  Vorsichtig
                </button>
              </div>
            </div>
            <div className="section-body">
              {szenario === "vorsichtig" && <p className="sanierung-klein">Zins einen Prozentpunkt höher, keine Wertsteigerung.</p>}
              <div className="vergleich-scroll">
                <table className="guide-tabelle strategie-jahre">
                  <thead>
                    <tr>
                      <th>Jahr</th>
                      <th>Objekte</th>
                      <th>Wert</th>
                      <th>Schulden</th>
                      <th>Wert − Schulden</th>
                      <th>Erspartes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jahre.map((j) => (
                      <tr key={j.jahr}>
                        <td data-label="Jahr">{j.jahr}</td>
                        <td data-label="Objekte" className="zahl">{j.objekte}</td>
                        <td data-label="Wert" className="zahl">{euro(j.wert)}</td>
                        <td data-label="Schulden" className="zahl">{euro(j.schulden)}</td>
                        <td data-label="Wert − Schulden" className="zahl">{euro(j.eigenkapital)}</td>
                        <td data-label="Erspartes" className={`zahl${j.erspartes < 0 ? " negativ" : ""}`}>{euro(j.erspartes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <p className="sanierung-klein strategie-grenze">
        Eine Rechnung nach deinen Annahmen, keine Anlage- oder Finanzierungsberatung. Ob eine Bank finanziert, hängt auch an
        deinem Einkommen, deiner Bonität und ihrem Beleihungswert — das prüft dieser Plan nicht. Steuern sind nicht gerechnet.
        Der Plan liegt nur in diesem Browser.
      </p>
    </div>
  );
}
